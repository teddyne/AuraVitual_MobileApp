import { useEffect, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { supabase } from '../api/supabase';
import {
  ALARMS_KEY,
  TRIGGERED_KEY,
  SNOOZE_KEY,
  WAKE_NAV_KEY,
  AlarmItem,
  loadSession,
  computeWakeAt,
  toKey,
  parseHHMM,
  toTimeInput,
  setupNotificationChannels,
  cancelSnoozeNotification,
} from '../utils/health/sleepSession';
import { navigationRef } from '../navigation/navigationRef';
import { translate } from '../i18n/locale';
import { useToast } from './NotificationToast';
import { syncReminderNotifications } from '../utils/reminders/reminders';
import {
  reconcilePresentedNotifications,
  recordDeliveredNotification,
} from '../utils/notifications/notificationHistory';
import { getProfile, getTodayMetric } from '../api/auravitalApi';

// Điều hướng từ dữ liệu đính kèm trong thông báo (data.screen).
// Khi app vừa khởi động lạnh, navigation có thể chưa sẵn sàng nên
// thử lại tối đa 5 giây thay vì bỏ qua lần bấm đó.
function routeFromNotification(data: any, attempt = 0) {
  if (!data) return;
  if (!navigationRef.isReady()) {
    if (attempt < 10) {
      setTimeout(() => routeFromNotification(data, attempt + 1), 500);
    }
    return;
  }
  try {
    if (data.screen === 'Sleep' || data.alarm) {
      navigationRef.navigate('SleepTracker', {
        alarm: true,
        alarmId: data.alarmId ?? null,
        autoSleep: data.autoSleep ?? false,
        triggerToken: Date.now(),
      });
    } else if (data.screen === 'Notifications') {
      navigationRef.navigate('Notifications');
    } else if (data.screen === 'Sharing') {
      (navigationRef as any).navigate('Main', { screen: 'ShareTab' });
    } else if (data.screen === 'FamilyDetail' && data.memberId) {
      navigationRef.navigate('FamilyDetail', { memberId: data.memberId });
    }
  } catch {}
}

export default function AlarmWatcher() {
  const checking = useRef(false);
  const { showToast } = useToast();

  useEffect(() => {
    // 1. Setup Android notification channels & foreground notification handler
    setupNotificationChannels().catch(() => {});

    // 1b. Đồng bộ nhắc hẹn giờ (8 khung nước, bữa ăn, ngủ đúng giờ).
    syncReminderNotifications().catch(() => {});

    // 1c. Đối chiếu khay hệ thống: thông báo đã đổ chuông lúc app
    // đóng cũng được ghi vào lịch sử (listener chỉ gặp khi app mở).
    reconcilePresentedNotifications().catch(() => {});

    // 2. Handle notification tap when user clicks notification
    const responseSub = Notifications.addNotificationResponseReceivedListener(
      (response) => {
        // Bấm vào thông báo cũng ghi lịch sử (trường hợp nó đổ chuông
        // lúc app đóng, listener nhận chưa từng gặp nó).
        if (response?.notification) {
          recordDeliveredNotification(response.notification).catch(() => {});
        }
        routeFromNotification(response?.notification?.request?.content?.data);
      },
    );

    // 2b. App đang mở mà push nhắc tới: hiện toast thay cho banner hệ
    // thống (banner đã tắt cho các kind này trong setupNotificationChannels).
    // Nước: nếu lúc này đã uống đủ mục tiêu thì không hiện nữa.
    const receivedSub = Notifications.addNotificationReceivedListener(
      async (notification) => {
        // Ghi lịch sử cho MỌI thông báo nhận được (kể cả loại không
        // hiện toast bên dưới); trùng thì tự bỏ qua.
        recordDeliveredNotification(notification).catch(() => {});
        const content = notification?.request?.content;
        const data: any = content?.data;
        if (!data || !['water', 'meal', 'sleep'].includes(data.kind)) return;
        if (data.kind === 'water') {
          try {
            const { data: auth } = await supabase.auth.getUser();
            if (auth.user) {
              const [profile, metric] = await Promise.all([
                getProfile(auth.user.id).catch(() => null),
                getTodayMetric(auth.user.id).catch(() => null),
              ]);
              if (
                profile?.water_goal_ml != null &&
                metric?.water_ml != null &&
                metric.water_ml >= profile.water_goal_ml
              ) {
                return;
              }
            }
          } catch {}
        }
        showToast({
          title: content.title ?? translate('notifications.fallbackTitle'),
          body: content.body ?? '',
          target: { screen: 'Notifications' },
        });
      },
    );

    // 3. Handle cold-start from notification click
    Notifications.getLastNotificationResponseAsync()
      .then((response) => {
        if (!response) return;
        if (response.notification) {
          recordDeliveredNotification(response.notification).catch(() => {});
        }
        routeFromNotification(response?.notification?.request?.content?.data);
      })
      .catch(() => {});

    // 4. In-app interval check (every 5 seconds)
    const check = async () => {
      if (checking.current) return;
      if (!navigationRef.isReady()) return;
      checking.current = true;
      try {
        const now = new Date();
        const nowKey = toKey(now);
        const nowMins = now.getHours() * 60 + now.getMinutes();

        // Check Snooze
        const snoozeRaw = await AsyncStorage.getItem(SNOOZE_KEY);
        if (snoozeRaw) {
          try {
            const sno = JSON.parse(snoozeRaw);
            if (sno.until && new Date(sno.until) <= now) {
              await AsyncStorage.removeItem(SNOOZE_KEY);
              await cancelSnoozeNotification();
              navigationRef.navigate('SleepTracker', {
                alarm: true,
                alarmId: sno.alarmId ?? null,
                triggerToken: Date.now(),
              });
              return;
            }
          } catch {}
        }

        // Check Custom Alarms
        const alarmsRaw = await AsyncStorage.getItem(ALARMS_KEY);
        if (alarmsRaw) {
          try {
            const alarms = JSON.parse(alarmsRaw) as AlarmItem[];
            const trigRaw = await AsyncStorage.getItem(TRIGGERED_KEY);
            const trig = trigRaw ? JSON.parse(trigRaw) : {};

            for (const a of alarms) {
              if (!a.enabled) continue;
              const aMins = parseHHMM(a.time);
              if (aMins === null) continue;

              const diff = (nowMins - aMins + 1440) % 1440;
              if (diff > 1) continue;

              const days = Array.isArray(a.days)
                ? a.days
                : [0, 1, 2, 3, 4, 5, 6];
              if (days.length > 0 && !days.includes(now.getDay())) continue;
              if (trig[a.id] === nowKey) continue;

              // Mark triggered
              const nextTrig = { ...trig, [a.id]: nowKey };
              await AsyncStorage.setItem(
                TRIGGERED_KEY,
                JSON.stringify(nextTrig),
              );

              // Auto-disable if one-time alarm
              if (days.length === 0) {
                const updated = alarms.map((x) =>
                  x.id === a.id ? { ...x, enabled: false } : x,
                );
                await AsyncStorage.setItem(ALARMS_KEY, JSON.stringify(updated));
              }

              navigationRef.navigate('SleepTracker', {
                alarm: true,
                alarmId: a.id,
                triggerToken: Date.now(),
              });
              return;
            }
          } catch {}
        }

        // Check Schedule Wake-Up Alarm
        const { data: auth } = await supabase.auth.getUser();
        if (auth.user) {
          const prof = await supabase
            .from('profiles')
            .select('wake_time, alarm_enabled')
            .eq('id', auth.user.id)
            .maybeSingle();

          if (prof.data?.alarm_enabled !== false && prof.data?.wake_time) {
            const session = await loadSession();
            if (session) {
              const target = session.snoozeUntil
                ? new Date(session.snoozeUntil)
                : computeWakeAt(
                    session.startedAt,
                    String(prof.data.wake_time),
                  );
              if (
                target &&
                now >= target &&
                now.getTime() - target.getTime() <= 30 * 60 * 1000
              ) {
                const navKey =
                  session.startedAt + '|' + (session.snoozeUntil ?? '');
                const navRaw = await AsyncStorage.getItem(WAKE_NAV_KEY);
                if (navRaw !== navKey) {
                  await AsyncStorage.setItem(WAKE_NAV_KEY, navKey);
                  navigationRef.navigate('SleepTracker', {
                    alarm: true,
                    alarmId: null,
                    triggerToken: Date.now(),
                  });
                  return;
                }
              }
            } else {
              // Wake alarm without active session
              const wMins = parseHHMM(toTimeInput(String(prof.data.wake_time)));
              if (wMins !== null) {
                const diff = (nowMins - wMins + 1440) % 1440;
                if (diff <= 1) {
                  const trigRaw = await AsyncStorage.getItem(TRIGGERED_KEY);
                  const trig = trigRaw ? JSON.parse(trigRaw) : {};
                  if (trig['schedule_wake'] !== nowKey) {
                    const nextTrig = { ...trig, schedule_wake: nowKey };
                    await AsyncStorage.setItem(
                      TRIGGERED_KEY,
                      JSON.stringify(nextTrig),
                    );
                    navigationRef.navigate('SleepTracker', {
                      alarm: true,
                      alarmId: null,
                      triggerToken: Date.now(),
                    });
                    return;
                  }
                }
              }
            }
          }
        }
      } catch {
      } finally {
        checking.current = false;
      }
    };

    void check();
    const id = setInterval(check, 5000);
    return () => {
      clearInterval(id);
      responseSub.remove();
      receivedSub.remove();
    };
  }, []);

  return null;
}
