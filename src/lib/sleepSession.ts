import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  AndroidImportance,
  AndroidNotificationPriority,
  AndroidNotificationVisibility,
} from 'expo-notifications';
import * as Notifications from 'expo-notifications';

export const SESSION_KEY = '@auravital:sleep_session';
export const MODE_KEY = '@auravital:sleep_mode';
export const NOISE_KEY = '@auravital:white_noise';
export const NOTIF_KEY = '@auravital:sleep_notif_ids';
export const ALARMS_KEY = '@auravital:alarms';
export const TRIGGERED_KEY = '@auravital:alarms_triggered';
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

export async function loadSession(): Promise<SleepSession | null> {
  const raw = await AsyncStorage.getItem(SESSION_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as SleepSession;
  } catch {
    return null;
  }
}

export async function saveSession(s: SleepSession) {
  await AsyncStorage.setItem(SESSION_KEY, JSON.stringify(s));
}

export async function startSession(): Promise<SleepSession> {
  const s: SleepSession = {
    startedAt: new Date().toISOString(),
    snoozeUntil: null,
    snoozeCount: 0,
  };
  await saveSession(s);
  await AsyncStorage.setItem(MODE_KEY, '1');
  return s;
}

export async function finishSession(
  supabase: any,
  userId: string,
  session: SleepSession,
  source: 'alarm' | 'next_day' | 'manual',
) {
  const ended = new Date();
  const minutes = Math.round(
    (ended.getTime() - new Date(session.startedAt).getTime()) / 60000,
  );
  if (minutes <= 0 || minutes > 1440) return null;
  const wakeKey = toKey(ended);
  const hours = Math.round((minutes / 60) * 100) / 100;
  const { error } = await supabase
    .from('health_metrics')
    .upsert(
      { user_id: userId, log_date: wakeKey, sleep_hours: hours },
      { onConflict: 'user_id,log_date' },
    );
  if (error) throw new Error(error.message);
  const { error: sessionError } = await supabase.from('sleep_sessions').insert({
    user_id: userId,
    started_at: session.startedAt,
    ended_at: ended.toISOString(),
    duration_minutes: minutes,
    snooze_count: session.snoozeCount,
    source,
  });
  if (sessionError)
    console.warn('sleep_sessions insert failed', sessionError.message);
  await AsyncStorage.removeItem(SESSION_KEY);
  await AsyncStorage.setItem(MODE_KEY, '0');
  return { minutes, wakeKey, hours };
}

export async function setupNotificationChannels() {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
      shouldShowBanner: true,
      shouldShowList: true,
      priority: AndroidNotificationPriority.MAX,
    }),
  });

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('alarm-channel', {
      name: 'Báo thức (Alarm)',
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
      name: 'Nhắc nhở giấc ngủ',
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

export async function syncAllAlarmNotifications(
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
        content: {
          title: 'Đến giờ đi ngủ',
          body: 'Bấm để bắt đầu chế độ ngủ.',
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
        content: {
          title: '⏰ Báo thức thức dậy',
          body: 'Đã đến giờ dậy rồi!',
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
          content: {
            title: `⏰ ${a.label || 'Báo thức'}`,
            body: `Báo thức lúc ${a.time}`,
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
          content: {
            title: `⏰ ${a.label || 'Báo thức'}`,
            body: `Báo thức lúc ${a.time}`,
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
            content: {
              title: `⏰ ${a.label || 'Báo thức'}`,
              body: `Báo thức lúc ${a.time}`,
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
