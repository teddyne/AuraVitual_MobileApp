import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { supabase } from './supabase';
import { getProfile, getTodayMetric } from './auravitalApi';
import { setupNotificationChannels } from './sleepSession';

// =====================================================================
// Nhắc hẹn giờ bằng local push (expo-notifications, DAILY trigger).
// - Nước: 8 khung giờ vàng CỐ ĐỊNH, nhắc 1 lần vào ĐẦU mỗi khung giờ
//   (không nhắc kiểu "mỗi 2 giờ" nữa, không báo tiến độ ml đã uống).
//   Nếu hôm đó đã uống đủ mục tiêu thì hủy hết nhắc nước còn lại.
// - Bữa ăn: đúng giờ trong Cài đặt nhắc nhở (sáng/trưa/tối).
// - Ngủ: đúng giờ ngủ trong Cài đặt nhắc nhở, KHÔNG nhắc trước.
// Đồng bộ lại khi: mở app, lưu cài đặt, ghi nhận nước xong.
// =====================================================================

export const NOTIF_SETTINGS_KEY = '@auravital:notifications';
const SCHED_IDS_KEY = '@auravital:reminder_notif_ids';
// Cờ dọn lịch mồ côi 1 lần (bản vá trùng nhắc 2/11/2026).
const MIGRATION_KEY = '@auravital:reminder_fixed_ids_migrated';

// Khóa chống chạy chồng: syncReminderNotifications được gọi từ nhiều
// nơi (mở app, lưu cài đặt, ghi nước) và app dev reload liên tục —
// không có khóa này, 2 lần chạy gối nhau sẽ làm lịch cũ bị mồ côi.
let syncInFlight = false;
let syncQueued = false;

export type WaterWindow = {
  time: string; // HH:MM, mốc bắt đầu
  range: string; // khung giờ hiển thị
  title: string;
  body: string;
};

export const WATER_WINDOWS: WaterWindow[] = [
  {
    time: '06:00',
    range: '6:00 – 7:00',
    title: 'Uống nước buổi sáng',
    body: 'Uống 1 ly nước ấm (200–250ml) để kích hoạt hệ tiêu hóa và bù nước sau giấc ngủ dài.',
  },
  {
    time: '08:00',
    range: '8:00 – 9:00',
    title: 'Uống nước sau bữa sáng',
    body: 'Uống thêm 1 ly nước để bắt đầu ngày làm việc, tăng sự tập trung và trao đổi chất.',
  },
  {
    time: '11:00',
    range: '11:00 – 12:00',
    title: 'Uống nước trước bữa trưa',
    body: 'Uống khoảng 250ml nước để giữ ẩm cho da và hỗ trợ tiêu hóa hấp thụ dinh dưỡng.',
  },
  {
    time: '13:00',
    range: '13:00 – 14:00',
    title: 'Uống nước sau giờ nghỉ trưa',
    body: 'Uống 200–250ml nước giúp phục hồi tuần hoàn máu và hỗ trợ tiêu hóa.',
  },
  {
    time: '15:00',
    range: '15:00 – 16:00',
    title: 'Uống nước buổi chiều',
    body: 'Uống 1 ly nước để xua tan cảm giác buồn ngủ, mệt mỏi và duy trì năng lượng.',
  },
  {
    time: '17:00',
    range: '17:00',
    title: 'Uống nước trước khi tan làm',
    body: 'Uống 250–300ml nước giúp giảm cảm giác đói và phục hồi cơ thể sau một ngày làm việc.',
  },
  {
    time: '19:00',
    range: '19:00 – 20:00',
    title: 'Uống nước trước bữa tối',
    body: 'Uống 1 ly nước giúp hỗ trợ thanh lọc cơ thể và kiểm soát lượng thức ăn nạp vào.',
  },
  {
    time: '21:00',
    range: '21:00 – 22:00',
    title: 'Uống nước trước khi đi ngủ',
    body: 'Uống một lượng nhỏ (100–150ml) để phòng mất nước ban đêm, tránh uống quá nhiều.',
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

// Dọn lịch mồ côi 1 lần duy nhất (bản vá 2/11/2026): các lịch do bản
// cũ đặt bằng id ngẫu nhiên, bị mất dấu sau reload giữa chừng hoặc
// chạy chồng, nên cancelTracked không với tới được. Hủy dựa theo
// data.kind — lịch báo thức ngủ (sleepSession) không có data.kind
// nên không bị đụng tới. Chạy lại cũng an toàn (idempotent): nếu
// cờ chưa kịp ghi mà app reload, lần sau nó dọn lại từ đầu.
async function migrateOrphanCleanup(): Promise<void> {
  try {
    const migrated = await AsyncStorage.getItem(MIGRATION_KEY).catch(
      () => null,
    );
    if (migrated) return;
    try {
      const scheduled =
        await Notifications.getAllScheduledNotificationsAsync();
      for (const req of scheduled) {
        const kind = (req.content.data as any)?.kind;
        if (kind === 'water' || kind === 'meal' || kind === 'sleep') {
          await Notifications.cancelScheduledNotificationAsync(
            req.identifier,
          ).catch(() => {});
        }
      }
    } catch {}
    await AsyncStorage.setItem(MIGRATION_KEY, '1').catch(() => {});
  } catch {}
}

// Đồng bộ toàn bộ nhắc hẹn giờ. Chạy khi mở app, khi lưu cài đặt và
// mỗi lần ghi nhận nước (để hủy nhắc nước khi đã đủ mục tiêu).
// Wrapper khóa chống chạy chồng: nếu đang chạy thì chỉ đánh dấu chạy
// lại 1 lần sau khi xong, thay vì chạy song song gây mồ côi lịch.
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
      await migrateOrphanCleanup();
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

    // Dọn lịch mồ côi 1 lần duy nhất (bản vá 2/11/2026), rồi mới đặt
    // lại bộ mới. Xem migrateOrphanCleanup bên dưới.
    await migrateOrphanCleanup();

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
              title: `💧 ${w.title}`,
              body: w.body,
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
        { key: 'breakfast', label: 'Bữa sáng', time: settings.mealBreakfast },
        { key: 'lunch', label: 'Bữa trưa', time: settings.mealLunch },
        { key: 'dinner', label: 'Bữa tối', time: settings.mealDinner },
      ];
      for (const meal of meals) {
        const hm = parseHM(meal.time);
        if (!hm) continue;
        const id = await Notifications.scheduleNotificationAsync({
          identifier: `meal-${meal.key}`,
          content: {
            title: `🍽 Nhắc ${meal.label.toLowerCase()}`,
            body: `Đến giờ ${meal.label.toLowerCase()} (${meal.time}).`,
            data: { kind: 'meal', screen: 'Notifications', meal: meal.label },
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

    // Ngủ: đúng giờ ngủ trong cài đặt, KHÔNG nhắc trước.
    if (settings.sleep) {
      const hm = parseHM(settings.sleepTime);
      if (hm) {
        const id = await Notifications.scheduleNotificationAsync({
          identifier: 'sleep-reminder',
          content: {
            title: '😴 Đến giờ đi ngủ',
            body: `Đã đến giờ đi ngủ (${settings.sleepTime}). Chuẩn bị giấc ngủ phục hồi nhé.`,
            data: { kind: 'sleep', screen: 'Notifications' },
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

    await AsyncStorage.setItem(SCHED_IDS_KEY, JSON.stringify(ids));
  } catch (err) {
    console.warn('syncReminderNotifications failed', err);
  }
}
