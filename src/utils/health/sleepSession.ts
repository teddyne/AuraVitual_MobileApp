import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  AndroidImportance,
  AndroidNotificationPriority,
  AndroidNotificationVisibility,
} from 'expo-notifications';
import * as Notifications from 'expo-notifications';
import { translate } from '../../i18n/locale';

export const SESSION_KEY = '@auravital:sleep_session';
// Nhóm B (v6) — chủ sở hữu của phiên đang mở. SESSION_KEY KHÔNG gắn
// user nên phiên của tài khoản trước trên cùng máy bị tài khoản mới đọc
// nhầm (loadSession trả về phiên lạ → biểu đồ ngày vẽ giờ ngủ giả).
// Lưu user_id riêng 1 key để KHÔNG đổi định dạng SESSION_KEY (HomeScreen
// và AlarmWatcher vẫn đọc key đó trực tiếp).
export const SESSION_USER_KEY = '@auravital:sleep_session_user';
export const MODE_KEY = '@auravital:sleep_mode';
export const NOISE_KEY = '@auravital:white_noise';
export const NOTIF_KEY = '@auravital:sleep_notif_ids';
export const ALARMS_KEY = '@auravital:alarms';
export const TRIGGERED_KEY = '@auravital:alarms_triggered';
export const WAKE_HANDLED_KEY = '@auravital:wake_handled_date';

// Đánh dấu "sáng nay đã dậy": chặn cả nhánh reo lại của AlarmWatcher
// (qua trig schedule_wake) lẫn thông báo lịch tới muộn.
export async function markWakeHandled() {
  try {
    const today = toKey(new Date());
    await AsyncStorage.setItem(WAKE_HANDLED_KEY, today);
    const raw = await AsyncStorage.getItem(TRIGGERED_KEY);
    const trig = raw ? JSON.parse(raw) : {};
    trig['schedule_wake'] = today;
    await AsyncStorage.setItem(TRIGGERED_KEY, JSON.stringify(trig));
  } catch {}
}

export async function isWakeHandledToday() {
  try {
    return (await AsyncStorage.getItem(WAKE_HANDLED_KEY)) === toKey(new Date());
  } catch {
    return false;
  }
}
export const SNOOZE_KEY = '@auravital:alarm_snooze';
export const WAKE_NAV_KEY = '@auravital:wake_nav';
export const SNOOZE_NOTIF_KEY = '@auravital:snooze_notif_id';

export type SleepProfile = {
  bedtime_time: string | null;
  wake_time: string | null;
  sleep_reminder_enabled: boolean;
  alarm_enabled: boolean;
  sleep_goal_hours: number | null;
};

export type SleepSession = {
  startedAt: string;
  snoozeUntil: string | null;
  snoozeCount: number;
};

export type AlarmItem = {
  id: string;
  time: string; // HH:MM
  label: string;
  enabled: boolean;
  days: number[]; // 0: CN (Sun), 1: T2 (Mon), ..., 6: T7 (Sat). [] means ring once then disable
  snoozeMinutes: number;
};

export const pad = (n: number) => String(n).padStart(2, '0');
export const toKey = (d: Date) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const keyToDisplay = (k: string) => {
  const [y, m, d] = k.split('-');
  return `${d}/${m}/${y}`;
};
export const fmtHHMM = (d: Date) =>
  `${pad(d.getHours())}:${pad(d.getMinutes())}`;
export const fmtDur = (min: number) => `${Math.floor(min / 60)}h ${min % 60}m`;

export const parseHHMM = (t: string) => {
  const m = t.trim().match(/^([0-1]?\d|2[0-3]):([0-5]\d)(?::[0-5]\d)?$/);
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
};

export const normalizeHHMM = (t: string) => {
  const m = t.trim().match(/^([0-1]?\d|2[0-3]):([0-5]\d)/);
  if (!m) return '';
  return `${m[1].padStart(2, '0')}:${m[2]}`;
};

export const toTimeInput = (t: string | null) => {
  if (!t) return '';
  const m = t.trim().match(/^([0-1]?\d|2[0-3]):([0-5]\d)/);
  return m ? `${m[1].padStart(2, '0')}:${m[2]}` : t.slice(0, 5);
};

export const toDbTime = (v: string) => {
  const norm = normalizeHHMM(v);
  return norm ? `${norm}:00` : v.trim();
};

export function computeWakeAt(startedAt: string, wakeTime: string | null) {
  if (!wakeTime || parseHHMM(wakeTime) === null) return null;
  const start = new Date(startedAt);
  const mins = parseHHMM(wakeTime)!;
  const wake = new Date(start);
  wake.setHours(Math.floor(mins / 60), mins % 60, 0, 0);
  if (wake.getTime() <= start.getTime()) wake.setDate(wake.getDate() + 1);
  return wake;
}

// Nhóm B (v6) — chỉ trả phiên của đúng user hiện tại. userId được
// truyền vào thì key chủ sở hữu phải trùng, nếu không (phiên của tài
// khoản khác, hoặc phiên cũ từ trước khi có key chủ sở hữu — không xác
// định được chủ) thì trả null và KHÔNG xóa bản ghi: tài khoản cũ đăng
// nhập lại vẫn thấy phiên của mình. Không truyền userId thì giữ hành vi
// cũ (trả phiên đang lưu) cho AlarmWatcher — chỗ đó không có userId.
export async function loadSession(
  userId?: string | null,
): Promise<SleepSession | null> {
  const raw = await AsyncStorage.getItem(SESSION_KEY);
  if (!raw) return null;
  if (userId != null) {
    try {
      const owner = await AsyncStorage.getItem(SESSION_USER_KEY);
      if (owner !== userId) return null;
    } catch {
      return null;
    }
  }
  try {
    return JSON.parse(raw) as SleepSession;
  } catch {
    return null;
  }
}

export async function saveSession(s: SleepSession, userId?: string | null) {
  await AsyncStorage.setItem(SESSION_KEY, JSON.stringify(s));
  if (userId != null) {
    await AsyncStorage.setItem(SESSION_USER_KEY, userId);
  }
}

export async function startSession(
  userId?: string | null,
): Promise<SleepSession> {
  const s: SleepSession = {
    startedAt: new Date().toISOString(),
    snoozeUntil: null,
    snoozeCount: 0,
  };
  await saveSession(s, userId);
  await AsyncStorage.setItem(MODE_KEY, '1');
  return s;
}

// Nhóm B (v2) — ngủ sâu theo chu kỳ 90 phút, thay cho cách tính theo tỉ lệ
// cố định cũ.
// Công thức: deepSleepMinutes = số chu kỳ 90 phút HOÀN CHỈNH trong tổng
// thời lượng phiên × 20 phút ngủ sâu mỗi chu kỳ.
// Vd: phiên 7.5h = 450 phút = 5 chu kỳ → 5 × 20 = 100 phút ngủ sâu.
// Giả định: mỗi chu kỳ ~90 phút có khoảng 20 phút ngủ sâu. Đây vẫn là
// con số SUY RA từ thời lượng phiên (app không có cảm biến giai đoạn ngủ),
// không phải số đo thật — công thức chỉ ghi trong comment code, không
// hiện chữ đó lên giao diện.
export const SLEEP_CYCLE_MINUTES = 90;
export const DEEP_SLEEP_MINUTES_PER_CYCLE = 20;
export const REFRESHING_CYCLES = 5; // 5 chu kỳ = 7 tiếng rưỡi

export function calcDeepSleepMinutes(totalMinutes: number): number {
  if (!totalMinutes || totalMinutes <= 0 || !isFinite(totalMinutes)) return 0;
  const cycles = Math.floor(totalMinutes / SLEEP_CYCLE_MINUTES);
  return cycles * DEEP_SLEEP_MINUTES_PER_CYCLE;
}

/** Giờ dậy tỉnh táo = giờ bắt đầu ngủ + 5 chu kỳ 90 phút (7 tiếng rưỡi). */
export function calcRefreshingWakeTime(startedAt: string): Date {
  const d = new Date(startedAt);
  d.setMinutes(
    d.getMinutes() + REFRESHING_CYCLES * SLEEP_CYCLE_MINUTES,
  );
  return d;
}

// Chống ghi đúp
let finishingStartedAt: string | null = null;

export async function finishSession(
  supabase: any,
  userId: string,
  session: SleepSession,
  source: 'alarm' | 'next_day' | 'manual',
) {
  if (finishingStartedAt === session.startedAt) return null;
  finishingStartedAt = session.startedAt;
  try {
    const currentRaw = await AsyncStorage.getItem(SESSION_KEY);
    if (!currentRaw) return null;
    try {
      const current = JSON.parse(currentRaw) as SleepSession;
      if (current.startedAt !== session.startedAt) return null;
    } catch {
      return null;
    }
    await AsyncStorage.removeItem(SESSION_KEY);
    await AsyncStorage.removeItem(SESSION_USER_KEY);
    await AsyncStorage.setItem(MODE_KEY, '0');
    const ended = new Date();
    const minutes = Math.round(
      (ended.getTime() - new Date(session.startedAt).getTime()) / 60000,
    );
    if (minutes <= 0 || minutes > 1440) return null;
    const wakeKey = toKey(ended);
    const hours = Math.round((minutes / 60) * 100) / 100;
    // Cộng dồn với số giờ đã ghi trong ngày thay vì ghi đè.
    const { data: prev } = await supabase
      .from('health_metrics')
      .select('sleep_hours')
      .eq('user_id', userId)
      .eq('log_date', wakeKey)
      .maybeSingle();
    const totalHours = Math.round(((prev?.sleep_hours ?? 0) + hours) * 100) / 100;
    try {
      const { error } = await supabase
        .from('health_metrics')
        .upsert(
          { user_id: userId, log_date: wakeKey, sleep_hours: totalHours },
          { onConflict: 'user_id,log_date' },
        );
      if (error) throw new Error(error.message);
      const { error: sessionError } = await supabase.from('sleep_sessions').insert({
        user_id: userId,
        started_at: session.startedAt,
        ended_at: ended.toISOString(),
        duration_minutes: minutes,
        // Ngủ sâu: hiện chỉ dùng giá trị thật từ DB, null = chưa có dữ
        // liệu. Đã bỏ cách ghi số ước tính (nhóm C, v3) nên bỏ field deep_sleep_minutes khỏi insert để DB ghi
        // null; KHÔNG xóa cột trong DB. Hàm calcDeepSleepMinutes vẫn
        // giữ export để không vỡ import khác, nhưng không còn chỗ nào
        // trong file này gọi nó để ghi DB.
        snooze_count: session.snoozeCount,
        source,
      });
      if (sessionError)
        console.warn('sleep_sessions insert failed', sessionError.message);
    } catch (e) {
      await saveSession(session, userId);
      await AsyncStorage.setItem(MODE_KEY, '1');
      throw e;
    }
    return {
      minutes,
      wakeKey,
      hours,
      // Không còn số ước tính: null = chưa có dữ liệu thật.
      deepSleepMinutes: null,
    };
  } finally {
    finishingStartedAt = null;
  }
}

export async function setupNotificationChannels() {
  Notifications.setNotificationHandler({
    handleNotification: async (notification) => {
      const kind = (notification.request.content.data as any)?.kind;
      // Nhắc hẹn giờ (nước/bữa ăn/ngủ) và sự kiện gia đình: toast
      // trong app lo hiển thị nên tắt banner hệ thống khi app đang mở
      // (tránh hiện 2 lần). Khi app ở nền hoặc bị tắt, hệ thống vẫn
      // hiện thông báo như thường.
      if (
        kind === 'water' ||
        kind === 'meal' ||
        kind === 'sleep' ||
        kind === 'family'
      ) {
        return {
          shouldShowAlert: false,
          shouldPlaySound: true,
          shouldSetBadge: false,
          shouldShowBanner: false,
          shouldShowList: false,
          priority: AndroidNotificationPriority.DEFAULT,
        };
      }
      return {
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
        shouldShowBanner: true,
        shouldShowList: true,
        priority: AndroidNotificationPriority.MAX,
      };
    },
  });

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('alarm-channel', {
      name: translate('reminders.channelAlarm'),
      importance: AndroidImportance.MAX,
      sound: 'default',
      vibrationPattern: [0, 500, 250, 500],
      lightColor: '#4E8A47',
      enableVibrate: true,
      enableLights: true,
      bypassDnd: true,
      lockscreenVisibility: AndroidNotificationVisibility.PUBLIC,
    });
    await Notifications.setNotificationChannelAsync('reminder-channel', {
      name: translate('reminders.channelSleepReminder'),
      importance: AndroidImportance.HIGH,
      sound: 'default',
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#4E8A47',
      enableVibrate: true,
    });
  }
}

export async function clearTriggeredAlarm(alarmId: string) {
  try {
    const trigRaw = await AsyncStorage.getItem(TRIGGERED_KEY);
    if (trigRaw) {
      const trig = JSON.parse(trigRaw);
      delete trig[alarmId];
      await AsyncStorage.setItem(TRIGGERED_KEY, JSON.stringify(trig));
    }
  } catch {}
}

export async function cancelSnoozeNotification() {
  try {
    const id = await AsyncStorage.getItem(SNOOZE_NOTIF_KEY);
    if (id) {
      await Notifications.cancelScheduledNotificationAsync(id).catch(() => {});
      await AsyncStorage.removeItem(SNOOZE_NOTIF_KEY);
    }
  } catch {}
}

export async function scheduleSnoozeNotification(
  title: string,
  body: string,
  minutes: number,
  alarmId: string | null,
) {
  try {
    await setupNotificationChannels();
    const permission = await Notifications.getPermissionsAsync();
    if (!permission.granted) {
      throw new Error('Notification permission is not granted.');
    }

    await cancelSnoozeNotification();
    const target = new Date(Date.now() + minutes * 60 * 1000);
    const id = await Notifications.scheduleNotificationAsync({
      // Identifier cố định: đặt lại snooze thì THAY THẾ lịch snooze cũ.
      identifier: 'snooze-alarm',
      content: {
        title: `⏰ ${title}`,
        body,
        data: { screen: 'Sleep', alarm: true, alarmId, isSnooze: true },
        sound: 'default',
        priority: AndroidNotificationPriority.MAX,
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: target,
        channelId: 'alarm-channel',
      },
    });
    await AsyncStorage.setItem(SNOOZE_NOTIF_KEY, id);
  } catch (e) {
    console.warn('Cannot schedule snooze notification', e);
    throw e;
  }
}

// Chống sync chồng chéo (nhóm C, v3): SleepTrackerScreen gọi sync ở
// 4 chỗ (mở màn hình, lưu lịch ngủ, lưu báo thức, bắt đầu phiên ngủ)
// nên các lần gọi có thể chạm nhau và mỗi lần chạy lại đặt thêm 1 bản
// sao lịch. Gom các lần gọi trong 700ms thành 1 lần chạy với tham số
// mới nhất, và không chạy 2 lần cùng lúc.
const ALARM_SYNC_DEBOUNCE_MS = 700;
let alarmSyncTimer: ReturnType<typeof setTimeout> | null = null;
let alarmSyncInFlight = false;
let alarmSyncPending: {
  alarms: AlarmItem[];
  profile: SleepProfile | null;
} | null = null;
let alarmSyncWaiters: Array<() => void> = [];

export async function syncAllAlarmNotifications(
  alarms: AlarmItem[],
  profile: SleepProfile | null,
): Promise<void> {
  alarmSyncPending = { alarms, profile };
  const done = new Promise<void>((resolve) => {
    alarmSyncWaiters.push(resolve);
  });
  if (alarmSyncTimer) clearTimeout(alarmSyncTimer);
  alarmSyncTimer = setTimeout(() => {
    alarmSyncTimer = null;
    void runAlarmSync();
  }, ALARM_SYNC_DEBOUNCE_MS);
  return done;
}

async function runAlarmSync(): Promise<void> {
  if (alarmSyncInFlight) return;
  alarmSyncInFlight = true;
  try {
    const job = alarmSyncPending;
    alarmSyncPending = null;
    if (job) await syncAllAlarmNotificationsInner(job.alarms, job.profile);
  } finally {
    alarmSyncInFlight = false;
    if (alarmSyncPending) {
      // Có lần gọi mới tới trong lúc đang chạy: chạy tiếp 1 lần nữa
      // với tham số mới nhất trước khi trả lời các lần chờ.
      alarmSyncTimer = setTimeout(() => {
        alarmSyncTimer = null;
        void runAlarmSync();
      }, 0);
    } else {
      const waiters = alarmSyncWaiters;
      alarmSyncWaiters = [];
      waiters.forEach((resolve) => resolve());
    }
  }
}

async function syncAllAlarmNotificationsInner(
  alarms: AlarmItem[],
  profile: SleepProfile | null,
) {
  try {
    await setupNotificationChannels();

    const perm = await Notifications.getPermissionsAsync();
    let status = perm.status;
    if (status !== 'granted') {
      const req = await Notifications.requestPermissionsAsync();
      status = req.status;
    }
    if (status !== 'granted') return;

    // Keep existing schedules if permission is denied; do not replace them with nothing.
    const old = await AsyncStorage.getItem(NOTIF_KEY);
    if (old) {
      try {
        const ids = JSON.parse(old) as string[];
        for (const id of ids) {
          await Notifications.cancelScheduledNotificationAsync(id).catch(
            () => {},
          );
        }
      } catch {}
    }

    const ids: string[] = [];

    // 3. Bedtime reminder
    if (
      profile?.sleep_reminder_enabled &&
      profile?.bedtime_time &&
      parseHHMM(profile.bedtime_time) !== null
    ) {
      const mins = parseHHMM(profile.bedtime_time)!;
      const id = await Notifications.scheduleNotificationAsync({
        // Identifier cố định 'bedtime': đặt lại thì THAY THẾ lịch cũ.
        identifier: 'bedtime',
        content: {
          title: translate('reminders.bedtimeTitle'),
          body: translate('reminders.bedtimeBody'),
          data: { screen: 'Sleep', autoSleep: true },
          sound: 'default',
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DAILY,
          hour: Math.floor(mins / 60),
          minute: mins % 60,
          channelId: 'reminder-channel',
        },
      });
      ids.push(id);
    }

    // 4. Wake schedule alarm
    if (
      profile?.alarm_enabled &&
      profile?.wake_time &&
      parseHHMM(profile.wake_time) !== null
    ) {
      const mins = parseHHMM(profile.wake_time)!;
      const id = await Notifications.scheduleNotificationAsync({
        // Identifier cố định 'wake-alarm': đặt lại thì THAY THẾ lịch cũ.
        identifier: 'wake-alarm',
        content: {
          title: translate('reminders.wakeAlarmTitle'),
          body: translate('reminders.wakeAlarmBody'),
          data: { screen: 'Sleep', alarm: true, alarmId: null },
          sound: 'default',
          priority: AndroidNotificationPriority.MAX,
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DAILY,
          hour: Math.floor(mins / 60),
          minute: mins % 60,
          channelId: 'alarm-channel',
        },
      });
      ids.push(id);
    }

    // 5. Custom alarms
    for (const a of alarms) {
      if (!a.enabled) continue;
      const mins = parseHHMM(a.time);
      if (mins === null) continue;
      const hour = Math.floor(mins / 60);
      const minute = mins % 60;
      const days = Array.isArray(a.days) ? a.days : [0, 1, 2, 3, 4, 5, 6];

      if (days.length === 0) {
        // One-time alarm: next upcoming time
        const target = new Date();
        target.setHours(hour, minute, 0, 0);
        if (target.getTime() <= Date.now()) {
          target.setDate(target.getDate() + 1);
        }
        const id = await Notifications.scheduleNotificationAsync({
          // Báo thức 1 lần: identifier cố định theo id báo thức.
          identifier: `alarm-${a.id}`,
          content: {
            title: `⏰ ${a.label || translate('reminders.alarmDefault')}`,
            body: translate('reminders.alarmBody', { time: a.time }),
            data: { screen: 'Sleep', alarm: true, alarmId: a.id },
            sound: 'default',
            priority: AndroidNotificationPriority.MAX,
          },
          trigger: {
            type: Notifications.SchedulableTriggerInputTypes.DATE,
            date: target,
            channelId: 'alarm-channel',
          },
        });
        ids.push(id);
      } else if (days.length === 7) {
        // Daily alarm
        const id = await Notifications.scheduleNotificationAsync({
          // Báo thức hằng ngày: identifier cố định theo id báo thức.
          identifier: `alarm-${a.id}`,
          content: {
            title: `⏰ ${a.label || translate('reminders.alarmDefault')}`,
            body: translate('reminders.alarmBody', { time: a.time }),
            data: { screen: 'Sleep', alarm: true, alarmId: a.id },
            sound: 'default',
            priority: AndroidNotificationPriority.MAX,
          },
          trigger: {
            type: Notifications.SchedulableTriggerInputTypes.DAILY,
            hour,
            minute,
            channelId: 'alarm-channel',
          },
        });
        ids.push(id);
      } else {
        // Weekly on specific days (Expo: 1=Sun, 2=Mon... jsDay 0..6 -> weekday = d + 1)
        for (const d of days) {
          const id = await Notifications.scheduleNotificationAsync({
            // Mỗi ngày trong tuần 1 identifier riêng (alarm-<id>-<d>):
            // dùng chung 1 identifier cho cả tuần thì các ngày sẽ ghi
            // đè nhau chỉ còn 1 ngày.
            identifier: `alarm-${a.id}-${d}`,
            content: {
              title: `⏰ ${a.label || translate('reminders.alarmDefault')}`,
              body: translate('reminders.alarmBody', { time: a.time }),
              data: { screen: 'Sleep', alarm: true, alarmId: a.id },
              sound: 'default',
              priority: AndroidNotificationPriority.MAX,
            },
            trigger: {
              type: Notifications.SchedulableTriggerInputTypes.WEEKLY,
              weekday: d + 1,
              hour,
              minute,
              channelId: 'alarm-channel',
            },
          });
          ids.push(id);
        }
      }
    }

    await AsyncStorage.setItem(NOTIF_KEY, JSON.stringify(ids));
  } catch (e) {
    console.warn('Error syncing alarm notifications:', e);
  }
}

export async function scheduleSleepNotifications(profile: SleepProfile) {
  try {
    const raw = await AsyncStorage.getItem(ALARMS_KEY);
    const alarms: AlarmItem[] = raw ? JSON.parse(raw) : [];
    await syncAllAlarmNotifications(alarms, profile);
  } catch {
    await syncAllAlarmNotifications([], profile);
  }
}
