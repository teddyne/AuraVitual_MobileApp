import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { supabase } from '../../api/supabase';
import { getProfile, getTodayMetric } from '../../api/auravitalApi';
import { setupNotificationChannels, NOTIF_KEY, SNOOZE_NOTIF_KEY } from '../health/sleepSession';
import { translate } from '../../i18n/locale';

// =====================================================================
// Nhắc hẹn giờ bằng local push (expo-notifications, DAILY trigger).
// - Nước: 8 khung giờ vàng CỐ ĐỊNH, nhắc 1 lần vào ĐẦU mỗi khung giờ
//   (không nhắc kiểu "mỗi 2 giờ" nữa, không báo tiến độ ml đã uống).
//   Nếu hôm đó đã uống đủ mục tiêu thì hủy hết nhắc nước còn lại.
// - Bữa ăn: đúng giờ trong Cài đặt nhắc nhở (sáng/trưa/tối).
// - Ngủ/báo thức: KHÔNG đặt ở đây nữa. Nhóm C (v3): nhắc đi ngủ
//   (bedtime), báo thức dậy (wake) và báo thức tùy chỉnh đều do
//   syncAllAlarmNotifications trong utils/health/sleepSession.ts làm
//   CHỦ duy nhất, tránh đặt trùng 2 nơi (trước đây reminders.ts đặt
//   sleep-reminder theo settings.sleepTime, sleepSession đặt bedtime
//   theo profile.bedtime_time nên tới giờ đổ chuông 2 lần).
// Đồng bộ lại khi: mở app, lưu cài đặt, ghi nhận nước xong.
// =====================================================================

export const NOTIF_SETTINGS_KEY = '@auravital:notifications';
const SCHED_IDS_KEY = '@auravital:reminder_notif_ids';
// Cờ dọn lịch mồ côi 1 lần, bản v2 (thay cờ cũ
// '@auravital:reminder_fixed_ids_migrated' bản vá 2/11/2026 chỉ dọn
// water/meal/sleep): v2 dọn cả lịch bedtime/wake/custom alarm mồ côi.
const CLEANUP_V2_KEY = '@auravital:notif-cleanup-v2';
let syncInFlight = false;
let syncQueued = false;

// Bộ identifier cố định duy nhất được phép tồn tại sau khi đồng bộ
// (đặt lại cùng identifier thì expo-notifications THAY THẾ lịch cũ
// thay vì tạo thêm). Mọi lịch có identifier ngoài bộ này đều là lịch
// mồ côi từ bản cũ chưa có identifier cố định — kể cả lịch
// 'sleep-reminder' cũ (nhóm C đã bỏ nguồn đặt lịch này, xem dưới).
const FIXED_ID_PATTERNS: RegExp[] = [
  /^water-\d{2}:\d{2}$/,
  /^meal-(breakfast|lunch|dinner)$/,
  /^bedtime$/,
  /^wake-alarm$/,
  /^alarm-[^/]+$/, // custom alarm: alarm-<id> hoặc alarm-<id>-<weekday>
  /^snooze-alarm$/,
];

export function isFixedNotificationId(id: string): boolean {
  return FIXED_ID_PATTERNS.some((re) => re.test(id));
}

// Bắn 1 thông báo local NGAY LẬP TỨC (không đặt lịch): dùng cho cột
// mốc mới (đạt mục tiêu bước chân...) để người dùng thấy banner như
// nhắc uống/ăn, thay vì chỉ có chấm trên chuông. Chưa cấp quyền
// thông báo thì bỏ qua lặng lẽ.
export async function notifyNow(
  title: string,
  body: string,
  data?: Record<string, any>,
): Promise<void> {
  try {
    const perm = await Notifications.getPermissionsAsync();
    if (!perm.granted) return;
    await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        data: { kind: 'milestone', screen: 'Notifications', ...(data ?? {}) },
        sound: 'default',
      },
      trigger: null,
    });
  } catch {}
}

export type WaterWindow = {
  time: string; // HH:MM, mốc bắt đầu
  range: string; // khung giờ hiển thị
  // Key i18n (reminders.waterWindows.*); tieu de/noi dung lay bang
  // translate() luc dung, khong dong cung tieng Viet o day.
  titleKey: string;
  bodyKey: string;
};

export const WATER_WINDOWS: WaterWindow[] = [
  {
    time: '06:00',
    range: '6:00 – 7:00',
    titleKey: 'reminders.waterWindows.morning.title',
    bodyKey: 'reminders.waterWindows.morning.body',
  },
  {
    time: '08:00',
    range: '8:00 – 9:00',
    titleKey: 'reminders.waterWindows.afterBreakfast.title',
    bodyKey: 'reminders.waterWindows.afterBreakfast.body',
  },
  {
    time: '11:00',
    range: '11:00 – 12:00',
    titleKey: 'reminders.waterWindows.beforeLunch.title',
    bodyKey: 'reminders.waterWindows.beforeLunch.body',
  },
  {
    time: '13:00',
    range: '13:00 – 14:00',
    titleKey: 'reminders.waterWindows.afterLunch.title',
    bodyKey: 'reminders.waterWindows.afterLunch.body',
  },
  {
    time: '15:00',
    range: '15:00 – 16:00',
    titleKey: 'reminders.waterWindows.afternoon.title',
    bodyKey: 'reminders.waterWindows.afternoon.body',
  },
  {
    time: '17:00',
    range: '17:00',
    titleKey: 'reminders.waterWindows.beforeLeave.title',
    bodyKey: 'reminders.waterWindows.beforeLeave.body',
  },
  {
    time: '19:00',
    range: '19:00 – 20:00',
    titleKey: 'reminders.waterWindows.beforeDinner.title',
    bodyKey: 'reminders.waterWindows.beforeDinner.body',
  },
  {
    time: '21:00',
    range: '21:00 – 22:00',
    titleKey: 'reminders.waterWindows.beforeBed.title',
    bodyKey: 'reminders.waterWindows.beforeBed.body',
  },
];

export type ReminderSettings = {
  enabled: boolean;
  water: boolean;
  sleep: boolean;
  sleepTime: string;
  meal: boolean;
  mealBreakfast: string;
  mealLunch: string;
  mealDinner: string;
  wake: boolean;
  wakeTime: string;
  cycle: boolean;
  cycleDaysBefore: number;
  // waterIntervalHours còn nằm trong dữ liệu cũ, giờ không dùng nữa
  // (nước nhắc theo 8 khung cố định ở trên).
  waterIntervalHours?: number;
};

export const DEFAULT_REMINDERS: ReminderSettings = {
  enabled: true,
  water: true,
  sleep: true,
  sleepTime: '22:00',
  meal: true,
  mealBreakfast: '07:00',
  mealLunch: '12:00',
  mealDinner: '18:30',
  wake: true,
  wakeTime: '07:30',
  cycle: true,
  cycleDaysBefore: 3,
};

export async function loadReminderSettings(): Promise<ReminderSettings> {
  try {
    const raw = await AsyncStorage.getItem(NOTIF_SETTINGS_KEY);
    if (!raw) return DEFAULT_REMINDERS;
    return { ...DEFAULT_REMINDERS, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_REMINDERS;
  }
}

// Khung giờ nước tiếp theo (đầu khung còn chưa tới hôm nay, nếu không
// thì khung đầu tiên của ngày mai). Dùng cho thẻ nước trong trang TB.
export function nextWaterWindow(now = new Date()): {
  window: WaterWindow;
  tomorrow: boolean;
} {
  const nowMin = now.getHours() * 60 + now.getMinutes();
  for (const w of WATER_WINDOWS) {
    const [h, m] = w.time.split(':').map(Number);
    if (h * 60 + m > nowMin) return { window: w, tomorrow: false };
  }
  return { window: WATER_WINDOWS[0], tomorrow: true };
}

function parseHM(t: string): { hour: number; minute: number } | null {
  const m = t.trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  const hour = Number(m[1]);
  const minute = Number(m[2]);
  if (hour > 23 || minute > 59) return null;
  return { hour, minute };
}

async function cancelTracked(): Promise<void> {
  try {
    const raw = await AsyncStorage.getItem(SCHED_IDS_KEY);
    if (!raw) return;
    const ids = JSON.parse(raw) as string[];
    for (const id of ids) {
      await Notifications.cancelScheduledNotificationAsync(id).catch(() => {});
    }
    await AsyncStorage.removeItem(SCHED_IDS_KEY);
  } catch {}
}

// Dọn lịch mồ côi 1 lần duy nhất (bản v2): hủy mọi lịch đã đặt có
// identifier KHÔNG nằm trong bộ identifier cố định mới (kể cả lịch
// bedtime/wake/custom alarm mồ côi và lịch 'sleep-reminder' cũ), rồi
// đặt lại bộ mới. Chỉ chạy 1 lần theo cờ CLEANUP_V2_KEY, KHÔNG chạy
// mỗi lần mở app.
async function cleanupOrphanNotificationsV2(): Promise<void> {
  try {
    const done = await AsyncStorage.getItem(CLEANUP_V2_KEY).catch(
      () => null,
    );
    if (done) return;
    try {
      const scheduled =
        await Notifications.getAllScheduledNotificationsAsync();
      for (const req of scheduled) {
        if (!isFixedNotificationId(req.identifier)) {
          await Notifications.cancelScheduledNotificationAsync(
            req.identifier,
          ).catch(() => {});
        }
      }
    } catch {}
    await AsyncStorage.setItem(CLEANUP_V2_KEY, '1').catch(() => {});
  } catch {}
}

// Nút "Dọn lịch thông báo trùng" (RemindersScreen): hủy TOÀN BỘ lịch
// nhắc/báo thức đã đặt — kể cả các lịch mồ côi trên máy user mà code
// mới không tự xóa được — xóa bộ id đã lưu, rồi đồng bộ lại 1 bộ
// water+meal mới duy nhất. Lịch bedtime/wake/custom alarm được đồng
// bộ lại ngay sau đó ở màn hình gọi hàm này (scheduleSleepNotifications
// trong RemindersScreen), không đặt ở đây để giữ 1 chủ duy nhất.
export async function cleanupDuplicateNotifications(): Promise<void> {
  await Notifications.cancelAllScheduledNotificationsAsync().catch(
    () => {},
  );
  await AsyncStorage.removeItem(SCHED_IDS_KEY).catch(() => {});
  await AsyncStorage.removeItem(NOTIF_KEY).catch(() => {});
  await AsyncStorage.removeItem(SNOOZE_NOTIF_KEY).catch(() => {});
  await AsyncStorage.setItem(CLEANUP_V2_KEY, '1').catch(() => {});
  await syncReminderNotifications();
}

export async function syncReminderNotifications(): Promise<void> {
  if (syncInFlight) {
    syncQueued = true;
    return;
  }
  syncInFlight = true;
  try {
    await syncReminderNotificationsInner();
  } finally {
    syncInFlight = false;
    if (syncQueued) {
      syncQueued = false;
      syncReminderNotifications().catch(() => {});
    }
  }
}

async function syncReminderNotificationsInner(): Promise<void> {
  try {
    const settings = await loadReminderSettings();
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) return; // chưa đăng nhập thì giữ nguyên lịch cũ
    if (!settings.enabled) {
      await cancelTracked();
      // Tắt nhắc thì dọn luôn lịch mồ côi (chỉ hủy, không cần quyền).
      await cleanupOrphanNotificationsV2();
      return;
    }

    const perm = await Notifications.getPermissionsAsync();
    let status = perm.status;
    if (status !== 'granted') {
      const req = await Notifications.requestPermissionsAsync();
      status = req.status;
    }
    // Không có quyền thì GIỮ lịch cũ (đừng xóa rồi để trống).
    if (status !== 'granted') return;

    // Tạo channel trước khi đặt lịch (kênh reminder-channel nằm ở đây).
    await setupNotificationChannels().catch(() => {});

    // Dọn lịch mồ côi 1 lần duy nhất (bản v2), rồi mới đặt lại bộ mới.
    // Xem cleanupOrphanNotificationsV2 bên dưới.
    await cleanupOrphanNotificationsV2();

    await cancelTracked();
    const ids: string[] = [];

    // Nước: đã uống đủ mục tiêu hôm nay thì không nhắc nữa.
    if (settings.water) {
      let goalMet = false;
      try {
        const [profile, metric] = await Promise.all([
          getProfile(auth.user.id).catch(() => null),
          getTodayMetric(auth.user.id).catch(() => null),
        ]);
        if (
          profile?.water_goal_ml != null &&
          metric?.water_ml != null &&
          metric.water_ml >= profile.water_goal_ml
        ) {
          goalMet = true;
        }
      } catch {
        // Lấy dữ liệu lỗi thì vẫn nhắc (fail-open).
      }
      if (!goalMet) {
        for (const w of WATER_WINDOWS) {
          const hm = parseHM(w.time);
          if (!hm) continue;
          const id = await Notifications.scheduleNotificationAsync({
            // Mã cố định theo khung giờ: đặt lại cùng mã thì hệ thống
            // THAY THẾ lịch cũ thay vì tạo thêm — không còn trùng được.
            identifier: `water-${w.time}`,
            content: {
              title: translate(w.titleKey),
              body: translate(w.bodyKey),
              data: { kind: 'water', screen: 'Notifications', window: w.time },
              sound: 'default',
            },
            trigger: {
              type: Notifications.SchedulableTriggerInputTypes.DAILY,
              hour: hm.hour,
              minute: hm.minute,
              channelId: 'reminder-channel',
            },
          });
          ids.push(id);
        }
      }
    }

    // Bữa ăn: đúng giờ đã thiết lập trong cài đặt.
    if (settings.meal) {
      const meals = [
        { key: 'breakfast', labelKey: 'nutrition.breakfast', time: settings.mealBreakfast },
        { key: 'lunch', labelKey: 'nutrition.lunch', time: settings.mealLunch },
        { key: 'dinner', labelKey: 'nutrition.dinner', time: settings.mealDinner },
      ];
      for (const meal of meals) {
        const hm = parseHM(meal.time);
        if (!hm) continue;
        const mealLabel = translate(meal.labelKey).toLowerCase();
        const id = await Notifications.scheduleNotificationAsync({
          identifier: `meal-${meal.key}`,
          content: {
            title: translate('reminders.mealNotifyTitle', { meal: mealLabel }),
            body: translate('reminders.mealNotifyBody', { meal: mealLabel, time: meal.time }),
            data: { kind: 'meal', screen: 'Notifications', meal: mealLabel },
            sound: 'default',
          },
          trigger: {
            type: Notifications.SchedulableTriggerInputTypes.DAILY,
            hour: hm.hour,
            minute: hm.minute,
            channelId: 'reminder-channel',
          },
        });
        ids.push(id);
      }
    }

    // Ngủ/báo thức: KHÔNG đặt ở đây nữa (nhóm C, v3). Trước đây khối
    // này đặt 'sleep-reminder' theo settings.sleepTime, trong khi
    // syncAllAlarmNotifications (sleepSession.ts) cũng đặt bedtime theo
    // profile.bedtime_time — 2 nguồn nên tới giờ đổ chuông 2 lần.
    // Giờ bedtime/wake/custom alarm chỉ do sleepSession.ts làm chủ.
    // (Giữ nguyên field sleep/sleepTime trong ReminderSettings vì màn
    // hình Cài đặt nhắc nhở vẫn hiển thị công tắc giờ ngủ; việc đặt
    // lịch thực tế theo profile.sleep_reminder_enabled ở màn Ngủ.)

    await AsyncStorage.setItem(SCHED_IDS_KEY, JSON.stringify(ids));
  } catch (err) {
    console.warn('syncReminderNotifications failed', err);
  }
}
