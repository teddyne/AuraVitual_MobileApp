import { useEffect, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { supabase } from '../lib/supabase';
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
} from '../lib/sleepSession';
import { navigationRef } from '../lib/navigationRef';

export default function AlarmWatcher() {
  const checking = useRef(false);

  useEffect(() => {
    // 1. Setup Android notification channels & foreground notification handler
    setupNotificationChannels().catch(() => {});

    // 2. Handle notification tap when user clicks notification
    const responseSub = Notifications.addNotificationResponseReceivedListener(
      (response) => {
        const data = response?.notification?.request?.content?.data;
        if (data?.screen === 'Sleep' || data?.alarm) {
          if (navigationRef.isReady()) {
            navigationRef.navigate('SleepTracker', {
              alarm: true,
              alarmId: data.alarmId ?? null,
              autoSleep: data.autoSleep ?? false,
              triggerToken: Date.now(),
            });
          }
        }
      },
    );

    // 3. Handle cold-start from notification click
    Notifications.getLastNotificationResponseAsync()
      .then((response) => {
        if (!response) return;
        const data = response?.notification?.request?.content?.data;
        if (data?.screen === 'Sleep' || data?.alarm) {
          if (navigationRef.isReady()) {
            navigationRef.navigate('SleepTracker', {
              alarm: true,
              alarmId: data.alarmId ?? null,
              autoSleep: data.autoSleep ?? false,
              triggerToken: Date.now(),
            });
          }
        }
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
              if (target && now >= target) {
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

    check();
    const id = setInterval(check, 5000);
    return () => {
      clearInterval(id);
      responseSub.remove();
    };
  }, []);

  return null;
}
