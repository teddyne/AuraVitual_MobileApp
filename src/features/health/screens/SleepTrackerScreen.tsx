import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Keyboard,
  KeyboardAvoidingView,
  PanResponder,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAudioPlayer, setAudioModeAsync } from 'expo-audio';
import * as Notifications from 'expo-notifications';
import { supabase } from '../../../lib/supabase';
import {
  MODE_KEY,
  NOISE_KEY,
  SleepProfile,
  SleepSession,
  computeWakeAt,
  fmtDur,
  fmtHHMM,
  keyToDisplay,
  loadSession,
  parseHHMM,
  saveSession,
  scheduleSleepNotifications,
  scheduleSnoozeNotification,
  cancelSnoozeNotification,
  syncAllAlarmNotifications,
  startSession,
  finishSession,
  toDbTime,
  toKey,
  toTimeInput,
} from '../../../lib/sleepSession';

const PRIMARY = '#4E8A47';
const RAIN_SOUND = require('../../../../assets/audio/rain.mp3');
const ALARM_SOUND = require('../../../../assets/audio/alarm.mp3');
const ALARMS_KEY = '@auravital:alarms';
const TRIGGERED_KEY = '@auravital:alarms_triggered';
const SNOOZE_KEY = '@auravital:alarm_snooze';
const WAKE_NAV_KEY = '@auravital:wake_nav';
const WD = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
const DAY_SHORT = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];

type SleepRow = { log_date: string; sleep_hours: number | null };
type AlarmItem = {
  id: string;
  time: string;
  label: string;
  enabled: boolean;
  days: number[];
  snoozeMinutes: number;
};

function fmtMMSS(sec: number) {
  if (!sec || sec < 0 || !isFinite(sec)) return '00:00';
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function displayLabel(label: string) {
  const v = (label || 'Báo thức').trim();
  if (!v) return 'Báo thức';
  return v.charAt(0).toUpperCase() + v.slice(1);
}

function alarmSub(a: AlarmItem) {
  const days = a.days ?? [];
  if (days.length === 0) return `${displayLabel(a.label)}, Một lần`;
  const short = [...days]
    .sort((x, y) => x - y)
    .map((d) => DAY_SHORT[d])
    .join(' ');
  return `${displayLabel(a.label)}, ${short}`;
}

function ProgressTrack({
  progress,
  onSeek,
}: {
  progress: number;
  onSeek: (ratio: number) => void;
}) {
  const [w, setW] = useState(0);
  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (e) => {
        if (!w) return;
        onSeek(Math.max(0, Math.min(1, e.nativeEvent.locationX / w)));
      },
      onPanResponderMove: (e) => {
        if (!w) return;
        onSeek(Math.max(0, Math.min(1, e.nativeEvent.locationX / w)));
      },
    }),
  ).current;
  const pct = Math.max(0, Math.min(1, progress));
  return (
    <View
      onLayout={(e) => setW(e.nativeEvent.layout.width)}
      {...pan.panHandlers}
      style={{ height: 28, justifyContent: 'center' }}
    >
      <View
        style={{ height: 6, backgroundColor: '#D9E2F3', borderRadius: 3 }}
      />
      <View
        style={{
          position: 'absolute',
          left: 0,
          height: 6,
          width: `${pct * 100}%`,
          backgroundColor: PRIMARY,
          borderRadius: 3,
        }}
      />
      <View
        style={{
          position: 'absolute',
          left: `${pct * 100}%`,
          marginLeft: -11,
          width: 22,
          height: 22,
          borderRadius: 11,
          backgroundColor: PRIMARY,
          borderWidth: 2,
          borderColor: '#fff',
        }}
      />
    </View>
  );
}

export default function SleepTrackerScreen({ navigation, route }: any) {
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [profile, setProfile] = useState<SleepProfile | null>(null);
  const [hasProfile, setHasProfile] = useState(false);
  const [week, setWeek] = useState<SleepRow[]>([]);
  const [session, setSession] = useState<SleepSession | null>(null);
  const [sleepMode, setSleepMode] = useState(false);
  const [noiseOn, setNoiseOn] = useState(false);
  const [rainProgress, setRainProgress] = useState({ current: 0, duration: 0 });
  const [alarmVisible, setAlarmVisible] = useState(false);
  const [ringingAlarm, setRingingAlarm] = useState<AlarmItem | null>(null);
  const [customSnooze, setCustomSnooze] = useState<{
    alarmId: string;
    until: string;
  } | null>(null);
  const [tick, setTick] = useState(0);
  const [bedtimeInput, setBedtimeInput] = useState('22:00');
  const [wakeInput, setWakeInput] = useState('07:30');
  const [goalInput, setGoalInput] = useState('8');
  const [editingSchedule, setEditingSchedule] = useState(false);
  const [alarms, setAlarms] = useState<AlarmItem[]>([]);
  const [triggeredMap, setTriggeredMap] = useState<Record<string, string>>({});
  const [alarmFormVisible, setAlarmFormVisible] = useState(false);
  const [editingAlarmId, setEditingAlarmId] = useState<string | null>(null);
  const [alarmTimeInput, setAlarmTimeInput] = useState('07:30');
  const [alarmLabelInput, setAlarmLabelInput] = useState('');
  const [alarmDays, setAlarmDays] = useState<number[]>([]);
  const [alarmSnoozeInput, setAlarmSnoozeInput] = useState('10');
  const handledRoute = useRef(false);
  const lastAlarmTrigger = useRef<number | null>(null);
  // SỬA: chống reo trùng cùng một phiên quá giờ khi loadAll chạy 2 lần
  // (mount + focus) hoặc khi focus lại nhiều lần.
  const overdueRingRef = useRef<string | null>(null);
  const rainTimerRef = useRef<any>(null);
  const rainPlayer = useAudioPlayer(RAIN_SOUND);
  const alarmPlayer = useAudioPlayer(ALARM_SOUND);
  const moonAnim = useRef(new Animated.Value(1)).current;

  const stopRain = useCallback(async () => {
    if (rainTimerRef.current) {
      clearTimeout(rainTimerRef.current);
      rainTimerRef.current = null;
    }
    try {
      rainPlayer.pause();
      rainPlayer.seekTo(0);
    } catch {}
  }, [rainPlayer]);
  const stopAlarm = async () => {
    try {
      alarmPlayer.pause();
      alarmPlayer.seekTo(0);
      alarmPlayer.setActiveForLockScreen(false);
    } catch {}
  };
  const playRain = async () => {
    try {
      if (!rainPlayer.playing) rainPlayer.play();
      if (rainTimerRef.current) clearTimeout(rainTimerRef.current);
      rainTimerRef.current = setTimeout(
        async () => {
          await stopRain();
          setNoiseOn(false);
          await AsyncStorage.setItem(NOISE_KEY, '0').catch(() => {});
        },
        45 * 60 * 1000,
      );
    } catch (e) {
      console.warn('Cannot play rain sound', e);
    }
  };
  const playAlarm = useCallback(async () => {
    try {
      await setAudioModeAsync({
        playsInSilentMode: true,
        shouldPlayInBackground: true,
        interruptionMode: 'doNotMix',
      });
      alarmPlayer.setActiveForLockScreen(true, {
        title: 'Báo thức thức dậy',
        artist: 'AuraVital',
      });
      alarmPlayer.seekTo(0);
      alarmPlayer.play();
    } catch (e) {
      console.warn('Cannot play alarm sound', e);
    }
  }, [alarmPlayer]);
  const ringAlarm = useCallback(
    async (custom: AlarmItem | null) => {
      await stopRain();
      setNoiseOn(false);
      await AsyncStorage.setItem(NOISE_KEY, '0').catch(() => {});
      setRingingAlarm(custom);
      setAlarmVisible(true);
      await playAlarm();
    },
    [playAlarm, stopRain],
  );

  const seekRain = (ratio: number) => {
    const dur = rainProgress.duration;
    if (!dur || dur <= 0) return;
    try {
      rainPlayer.seekTo(ratio * dur);
      setRainProgress((prev) => ({ ...prev, current: ratio * dur }));
    } catch {}
  };

  useEffect(() => {
    rainPlayer.loop = true;
    rainPlayer.volume = 0.6;
    alarmPlayer.loop = true;
    alarmPlayer.volume = 1;
  }, [rainPlayer, alarmPlayer]);

  useEffect(() => {
    const id = setInterval(() => {
      const cur = rainPlayer.currentTime ?? 0;
      const dur = rainPlayer.duration ?? 0;
      setRainProgress((prev) =>
        prev.current === cur && prev.duration === dur
          ? prev
          : { current: cur, duration: dur },
      );
    }, 500);
    return () => clearInterval(id);
  }, [rainPlayer]);

  useEffect(() => {
    setAudioModeAsync({
      playsInSilentMode: true,
      shouldPlayInBackground: true,
      interruptionMode: 'doNotMix',
    }).catch((e) => {
      console.warn('Cannot configure alarm audio mode', e);
    });
    return () => {
      stopRain();
      stopAlarm();
    };
  }, []);

  useEffect(() => {
    if (!sleepMode) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(moonAnim, {
          toValue: 1.1,
          duration: 1800,
          useNativeDriver: true,
        }),
        Animated.timing(moonAnim, {
          toValue: 1,
          duration: 1800,
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [sleepMode, moonAnim]);

  const loadAll = useCallback(async () => {
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) {
      setLoading(false);
      return;
    }
    const uid = auth.user.id;
    setUserId(uid);
    const prof = await supabase
      .from('profiles')
      .select(
        'sleep_goal_hours, bedtime_time, wake_time, sleep_reminder_enabled, alarm_enabled',
      )
      .eq('id', uid)
      .maybeSingle();
    const p: SleepProfile = {
      sleep_goal_hours: prof.data?.sleep_goal_hours
        ? Number(prof.data.sleep_goal_hours)
        : null,
      bedtime_time: prof.data?.bedtime_time
        ? String(prof.data.bedtime_time)
        : null,
      wake_time: prof.data?.wake_time ? String(prof.data.wake_time) : null,
      sleep_reminder_enabled: prof.data?.sleep_reminder_enabled !== false,
      alarm_enabled: prof.data?.alarm_enabled !== false,
    };
    setProfile(p);
    setHasProfile(!!prof.data);
    setBedtimeInput(toTimeInput(p.bedtime_time) || '22:00');
    setWakeInput(toTimeInput(p.wake_time) || '07:30');
    setGoalInput(p.sleep_goal_hours ? String(p.sleep_goal_hours) : '8');
    setEditingSchedule(!p.bedtime_time || !p.wake_time);
    await scheduleSleepNotifications(p);
    const from = new Date();
    from.setDate(from.getDate() - 6);
    const res = await supabase
      .from('health_metrics')
      .select('log_date, sleep_hours')
      .eq('user_id', uid)
      .gte('log_date', toKey(from))
      .order('log_date', { ascending: true });
    setWeek((res.data || []) as SleepRow[]);
    const noiseVal = await AsyncStorage.getItem(NOISE_KEY);
    setNoiseOn(noiseVal === '1');
    // SỬA: giữ danh sách báo thức và map đã reo trong biến cục bộ để
    // kiểm tra báo thức trễ ngay trong lần load này, không đợi state.
    let parsedAlarms: AlarmItem[] = [];
    const alarmsRaw = await AsyncStorage.getItem(ALARMS_KEY);
    if (alarmsRaw) {
      try {
        const parsed = JSON.parse(alarmsRaw) as any[];
        parsedAlarms = parsed.map((a) => ({
          ...a,
          days: Array.isArray(a.days) ? a.days : [0, 1, 2, 3, 4, 5, 6],
          snoozeMinutes:
            typeof a.snoozeMinutes === 'number' ? a.snoozeMinutes : 10,
        }));
        setAlarms(parsedAlarms);
      } catch {}
    }
    let trigMap: Record<string, string> = {};
    const trigRaw = await AsyncStorage.getItem(TRIGGERED_KEY);
    if (trigRaw) {
      try {
        trigMap = JSON.parse(trigRaw);
        setTriggeredMap(trigMap);
      } catch {}
    }
    const mode = await AsyncStorage.getItem(MODE_KEY);
    setSleepMode(mode === '1');
    const s = await loadSession();
    setSession(s);
    if (!handledRoute.current) {
      handledRoute.current = true;
      if (route?.params?.autoSleep && !s) {
        const created = await startSession();
        setSession(created);
        setSleepMode(true);
        if (noiseVal === '1') await playRain();
      }
    }
    // SỬA: khôi phục báo thức đã bấm "báo lại" trước khi thoát app.
    // Trước đây SNOOZE_KEY không bao giờ được đọc lại nên báo lại bị mất.
    // Nếu đã quá giờ báo lại thì để effect tick xử lý (nó sẽ reo ngay
    // khi customSnooze đổi), nếu chưa tới giờ thì giữ lại để chờ.
    const snoozeRaw = await AsyncStorage.getItem(SNOOZE_KEY);
    if (snoozeRaw) {
      try {
        const sno = JSON.parse(snoozeRaw);
        if (sno?.alarmId && sno?.until) {
          setCustomSnooze({ alarmId: sno.alarmId, until: sno.until });
        }
      } catch {}
    }
    let alreadyRinging = false;
    // SỬA: đọc WAKE_NAV_KEY — key này trước đây chỉ được xóa trong
    // finish() chứ chưa bao giờ được đọc, nên bấm thông báo báo thức
    // cũng không chuyển sang màn báo thức.
    const wakeNavRaw = await AsyncStorage.getItem(WAKE_NAV_KEY);
    if (wakeNavRaw) {
      await AsyncStorage.removeItem(WAKE_NAV_KEY).catch(() => {});
      let wakeAlarmId: string | undefined;
      try {
        const parsed = JSON.parse(wakeNavRaw);
        wakeAlarmId =
          typeof parsed === 'string'
            ? parsed
            : (parsed?.alarmId ?? parsed?.alarm_id);
      } catch {
        wakeAlarmId = wakeNavRaw;
      }
      const found = wakeAlarmId
        ? parsedAlarms.find((x) => x.id === wakeAlarmId)
        : undefined;
      await ringAlarm(found ?? null);
      alreadyRinging = true;
    }
    // SỬA: phiên ngủ đã quá giờ dậy — xử lý ngay khi mở màn, không
    // đợi tick 20 giây và không đợi người dùng tự cuộn xuống thẻ hỏi.
    // Quá giờ trong vòng 30 phút thì reo luôn; quá lâu hơn thì không
    // reo ầm lên nữa mà để banner "Bạn đã dậy chưa?" ở dưới lo việc
    // xác nhận, tránh reo lúc trưa cho một giờ dậy lúc sáng.
    if (!alreadyRinging && s && p.alarm_enabled !== false) {
      const target = s.snoozeUntil
        ? new Date(s.snoozeUntil)
        : computeWakeAt(s.startedAt, p.wake_time);
      if (target && new Date() >= target) {
        const key = `${s.startedAt}|${target.toISOString()}`;
        if (overdueRingRef.current !== key) {
          if (Date.now() - target.getTime() <= 30 * 60 * 1000) {
            overdueRingRef.current = key;
            await ringAlarm(null);
            alreadyRinging = true;
          }
        }
      }
    }
    // SỬA: báo thức tùy chỉnh mở app trễ tối đa 5 phút vẫn reo bù.
    // Trước đây chỉ khớp đúng phút nên mở trễ là mất hẳn.
    if (!alreadyRinging && parsedAlarms.length > 0) {
      const nowDate = new Date();
      const nowKey = toKey(nowDate);
      const nowMin = nowDate.getHours() * 60 + nowDate.getMinutes();
      for (const a of parsedAlarms) {
        if (!a.enabled) continue;
        const [ah, am] = a.time.split(':').map(Number);
        if (isNaN(ah) || isNaN(am)) continue;
        const diff = nowMin - (ah * 60 + am);
        if (diff < 0 || diff > 5) continue;
        const days = a.days ?? [0, 1, 2, 3, 4, 5, 6];
        if (days.length > 0 && !days.includes(nowDate.getDay())) continue;
        if (days.length > 0 && trigMap[a.id] === nowKey) continue;
        if (days.length === 0 && trigMap[a.id]) continue;
        const nextMap = { ...trigMap, [a.id]: nowKey };
        trigMap = nextMap;
        setTriggeredMap(nextMap);
        await AsyncStorage.setItem(
          TRIGGERED_KEY,
          JSON.stringify(nextMap),
        ).catch(() => {});
        if (days.length === 0) {
          const updated = parsedAlarms.map((x) =>
            x.id === a.id ? { ...x, enabled: false } : x,
          );
          parsedAlarms = updated;
          await AsyncStorage.setItem(ALARMS_KEY, JSON.stringify(updated)).catch(
            () => {},
          );
          setAlarms(updated);
        }
        await ringAlarm(a);
        break;
      }
    }
    setLoading(false);
  }, [route]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  // SỬA: load lại mỗi lần màn được focus — đây là chỗ sửa lỗi
  // "thoát ra đăng nhập lại mà không thấy xác nhận dậy". Trước đây
  // màn chỉ load lúc mount nên state phiên ngủ bị cũ sau khi
  // đăng xuất / đăng nhập lại hoặc đi màn khác rồi quay về.
  useFocusEffect(
    useCallback(() => {
      loadAll();
    }, [loadAll]),
  );

  useEffect(() => {
    if (loading || !route?.params?.alarm) return;
    const triggerToken = route?.params?.triggerToken;
    if (triggerToken && triggerToken === lastAlarmTrigger.current) return;
    if (triggerToken) lastAlarmTrigger.current = triggerToken;

    const alarmId = route?.params?.alarmId;
    (async () => {
      if (!alarmId) {
        await ringAlarm(null);
        return;
      }

      const raw = await AsyncStorage.getItem(ALARMS_KEY);
      if (!raw) {
        await ringAlarm(null);
        return;
      }
      try {
        const list = JSON.parse(raw) as AlarmItem[];
        const found = list.find((x) => x.id === alarmId);
        if (found) {
          const foundDays = Array.isArray(found.days)
            ? found.days
            : [0, 1, 2, 3, 4, 5, 6];
          if (found.enabled && foundDays.length === 0) {
            const updated = list.map((alarm) =>
              alarm.id === alarmId ? { ...alarm, enabled: false } : alarm,
            );
            await saveAlarms(updated);
          }
          await ringAlarm({
            ...found,
            days: Array.isArray(found.days)
              ? found.days
              : [0, 1, 2, 3, 4, 5, 6],
            snoozeMinutes:
              typeof found.snoozeMinutes === 'number'
                ? found.snoozeMinutes
                : 10,
          });
        } else {
          await ringAlarm(null);
        }
      } catch {
        await ringAlarm(null);
      }
    })();
  }, [
    loading,
    route?.params?.alarm,
    route?.params?.alarmId,
    route?.params?.triggerToken,
  ]);

  useEffect(() => {
    const subscription = Notifications.addNotificationReceivedListener(
      (notification) => {
        const data = notification.request.content.data;
        if (
          data?.alarm !== true ||
          loading ||
          alarmVisible ||
          !navigation.isFocused()
        ) {
          return;
        }

        const alarmId =
          typeof data.alarmId === 'string' ? data.alarmId : null;
        const customAlarm = alarmId
          ? (alarms.find((alarm) => alarm.id === alarmId) ?? null)
          : null;
        void ringAlarm(customAlarm);
      },
    );

    return () => subscription.remove();
  }, [alarms, alarmVisible, loading, navigation, ringAlarm]);

  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 20000);
    return () => clearInterval(id);
  }, []);

  // Lưu ý: effect này chỉ chạy khi màn Ngủ đang mở. Khi app đóng hoặc
  // đang ở màn khác, giờ dậy chỉ có thể tới qua thông báo đã đặt lịch
  // + AlarmWatcher điều hướng (xem file AlarmWatcher bên dưới).
  useEffect(() => {
    if (!session || !profile?.alarm_enabled || alarmVisible) return;
    const target = session.snoozeUntil
      ? new Date(session.snoozeUntil)
      : computeWakeAt(session.startedAt, profile.wake_time);
    if (target && new Date() >= target) {
      ringAlarm(null);
    }
  }, [session, profile, alarmVisible, tick, ringAlarm]);

  useEffect(() => {
    if (alarmVisible) return;
    const now = new Date();
    const nowKey = toKey(now);
    const nowHHMM = `${String(now.getHours()).padStart(2, '0')}:${String(
      now.getMinutes(),
    ).padStart(2, '0')}`;
    if (customSnooze && new Date(customSnooze.until) <= now) {
      const a = alarms.find((x) => x.id === customSnooze.alarmId);
      if (a) {
        ringAlarm(a);
      }
      setCustomSnooze(null);
      AsyncStorage.removeItem(SNOOZE_KEY).catch(() => {});
      cancelSnoozeNotification();
      return;
    }
    for (const a of alarms) {
      if (!a.enabled || a.time !== nowHHMM) continue;
      const days = a.days ?? [0, 1, 2, 3, 4, 5, 6];
      if (days.length > 0 && !days.includes(now.getDay())) continue;
      if (days.length > 0 && triggeredMap[a.id] === nowKey) continue;
      if (days.length === 0 && triggeredMap[a.id]) continue;
      const nextMap = { ...triggeredMap, [a.id]: nowKey };
      setTriggeredMap(nextMap);
      AsyncStorage.setItem(TRIGGERED_KEY, JSON.stringify(nextMap)).catch(
        () => {},
      );
      if (days.length === 0) {
        saveAlarms(
          alarms.map((x) => (x.id === a.id ? { ...x, enabled: false } : x)),
        );
      }
      ringAlarm(a);
      break;
    }
  }, [tick, alarms, triggeredMap, customSnooze, alarmVisible, ringAlarm]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadAll();
    setRefreshing(false);
  };

  const saveSchedule = async () => {
    if (!userId) return;
    if (!hasProfile) {
      Alert.alert(
        'Chưa có hồ sơ',
        'Tài khoản này chưa có hồ sơ, cần thiết lập hồ sơ trước rồi mới lưu được lịch ngủ.',
        [
          { text: 'Để sau', style: 'cancel' },
          {
            text: 'Thiết lập hồ sơ',
            onPress: () => navigation?.navigate('ProfileSetup'),
          },
        ],
      );
      return;
    }
    if (parseHHMM(bedtimeInput) === null || parseHHMM(wakeInput) === null) {
      Alert.alert(
        'Giờ chưa đúng',
        'Nhập giờ dạng HH:MM, ví dụ 22:00 và 07:30.',
      );
      return;
    }
    const goalNum = parseFloat(goalInput.replace(',', '.'));
    if (isNaN(goalNum) || goalNum < 4 || goalNum > 12) {
      Alert.alert('Mục tiêu chưa đúng', 'Mục tiêu giấc ngủ từ 4 đến 12 giờ.');
      return;
    }
    setSaving(true);
    const patch = {
      bedtime_time: toDbTime(bedtimeInput),
      wake_time: toDbTime(wakeInput),
      sleep_goal_hours: goalNum,
    };
    const { error } = await supabase
      .from('profiles')
      .update(patch)
      .eq('id', userId);
    setSaving(false);
    if (error) {
      Alert.alert('Lưu thất bại', error.message);
      return;
    }
    const nextProfile: SleepProfile = {
      ...(profile ?? {
        bedtime_time: null,
        wake_time: null,
        sleep_reminder_enabled: true,
        alarm_enabled: true,
        sleep_goal_hours: null,
      }),
      bedtime_time: patch.bedtime_time,
      wake_time: patch.wake_time,
      sleep_goal_hours: goalNum,
    };
    setProfile(nextProfile);
    await scheduleSleepNotifications(nextProfile);
    setEditingSchedule(false);
    Alert.alert(
      'Đã lưu lịch ngủ',
      'Lịch này sẽ dùng cho chế độ ngủ và giờ dậy.',
    );
  };

  const cancelEditSchedule = () => {
    setBedtimeInput(toTimeInput(profile?.bedtime_time ?? null) || '22:00');
    setWakeInput(toTimeInput(profile?.wake_time ?? null) || '07:30');
    setGoalInput(
      profile?.sleep_goal_hours ? String(profile.sleep_goal_hours) : '8',
    );
    setEditingSchedule(false);
  };

  const saveAlarms = async (next: AlarmItem[]) => {
    try {
      await AsyncStorage.setItem(ALARMS_KEY, JSON.stringify(next));
      setAlarms(next);
      await syncAllAlarmNotifications(next, profile);
    } catch (e: any) {
      Alert.alert('Không lưu được báo thức', e?.message || 'Vui lòng thử lại.');
    }
  };

  const openAddAlarm = () => {
    setEditingAlarmId(null);
    setAlarmTimeInput('07:30');
    setAlarmLabelInput('');
    setAlarmDays([]);
    setAlarmSnoozeInput('10');
    setAlarmFormVisible(true);
  };

  const openEditAlarm = (a: AlarmItem) => {
    setEditingAlarmId(a.id);
    setAlarmTimeInput(a.time);
    setAlarmLabelInput(a.label);
    setAlarmDays([...(a.days ?? [])]);
    setAlarmSnoozeInput(String(a.snoozeMinutes ?? 10));
    setAlarmFormVisible(true);
  };

  const saveAlarm = async () => {
    if (parseHHMM(alarmTimeInput) === null) {
      Alert.alert('Giờ chưa đúng', 'Nhập giờ dạng HH:MM, ví dụ 07:30.');
      return;
    }
    const snoozeNum = parseInt(alarmSnoozeInput, 10);
    if (isNaN(snoozeNum) || snoozeNum < 1 || snoozeNum > 120) {
      Alert.alert('Thời lượng báo lại chưa đúng', 'Nhập số phút từ 1 đến 120.');
      return;
    }
    const [h, m] = alarmTimeInput.trim().split(':');
    const time = `${h.padStart(2, '0')}:${m.padStart(2, '0')}`;
    const days = [...alarmDays].sort((a, b) => a - b);
    if (editingAlarmId) {
      await saveAlarms(
        alarms.map((x) =>
          x.id === editingAlarmId
            ? {
                ...x,
                time,
                label: alarmLabelInput.trim() || 'Báo thức',
                days,
                snoozeMinutes: snoozeNum,
              }
            : x,
        ),
      );
    } else {
      await saveAlarms([
        ...alarms,
        {
          id: Date.now().toString(),
          time,
          label: alarmLabelInput.trim() || 'Báo thức',
          enabled: true,
          days,
          snoozeMinutes: snoozeNum,
        },
      ]);
    }
    setEditingAlarmId(null);
    setAlarmFormVisible(false);
    Keyboard.dismiss();
  };

  const deleteAlarm = (id: string) => {
    Alert.alert('Xóa báo thức', 'Xóa báo thức này?', [
      { text: 'Hủy', style: 'cancel' },
      {
        text: 'Xóa',
        style: 'destructive',
        onPress: () => saveAlarms(alarms.filter((a) => a.id !== id)),
      },
    ]);
  };

  const toggleAlarmDay = (d: number) => {
    setAlarmDays((prev) =>
      prev.includes(d)
        ? prev.filter((x) => x !== d)
        : [...prev, d].sort((a, b) => a - b),
    );
  };

  const map = new Map(week.map((w) => [w.log_date, w.sleep_hours]));
  const last7 = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const k = toKey(d);
    last7.push({ key: k, label: WD[d.getDay()], hours: map.get(k) ?? null });
  }
  const withData = last7.filter((x) => x.hours !== null);
  const avgMin = withData.length
    ? Math.round(
        (withData.reduce((s, x) => s + Number(x.hours), 0) / withData.length) *
          60,
      )
    : null;
  const goal = profile?.sleep_goal_hours ?? null;

  const startSleep = async () => {
    const s = await startSession();
    setSession(s);
    setSleepMode(true);
    // SỬA: đặt lại thông báo giờ dậy ngay khi bắt đầu phiên mới, để
    // đóng app vẫn có thông báo đánh thức (chứ không chỉ trông chờ
    // vào interval trong màn này).
    try {
      if (profile) await scheduleSleepNotifications(profile);
    } catch {}
    if (noiseOn) await playRain();
  };

  const enterSleepScreen = async () => {
    setSleepMode(true);
    await AsyncStorage.setItem(MODE_KEY, '1');
    if (noiseOn) await playRain();
  };

  const exitSleepScreen = async () => {
    setSleepMode(false);
    await AsyncStorage.setItem(MODE_KEY, '0');
    await stopRain();
  };

  const toggleNoise = async (v: boolean) => {
    setNoiseOn(v);
    await AsyncStorage.setItem(NOISE_KEY, v ? '1' : '0');
    if (v) await playRain();
    else await stopRain();
  };

  const finish = async (source: 'alarm' | 'next_day' | 'manual') => {
    if (!session || !userId) return;
    setSaving(true);
    try {
      const result = await finishSession(supabase, userId, session, source);
      await stopAlarm();
      await stopRain();
      setAlarmVisible(false);
      setRingingAlarm(null);
      setSleepMode(false);
      setSession(null);
      await AsyncStorage.removeItem(SNOOZE_KEY).catch(() => {});
      await AsyncStorage.removeItem(WAKE_NAV_KEY).catch(() => {});
      await cancelSnoozeNotification();
      if (!result) {
        Alert.alert('Chưa lưu được', 'Phiên ngủ quá ngắn hoặc quá 24 giờ.');
        return;
      }
      Alert.alert(
        'Đã lưu giấc ngủ',
        `${fmtDur(result.minutes)} cho ngày ${keyToDisplay(result.wakeKey)}.`,
      );
      loadAll();
    } catch (e: any) {
      Alert.alert('Lưu thất bại', e?.message || 'Thử lại sau.');
    } finally {
      setSaving(false);
    }
  };

  const snooze = async () => {
    if (session) {
      const next: SleepSession = {
        ...session,
        snoozeUntil: new Date(Date.now() + 10 * 60000).toISOString(),
        snoozeCount: session.snoozeCount + 1,
      };
      await saveSession(next);
      setSession(next);
      try {
        await scheduleSnoozeNotification(
          'Báo thức thức dậy',
          'Đã đến giờ dậy rồi!',
          10,
          null,
        );
      } catch {
        Alert.alert(
          'Không đặt được thông báo báo lại',
          'Hãy kiểm tra quyền thông báo. Báo thức trong ứng dụng vẫn sẽ được thử lại khi ứng dụng đang mở.',
        );
      }
      setAlarmVisible(false);
      await stopAlarm();
      return;
    }
    if (ringingAlarm) {
      const mins = ringingAlarm.snoozeMinutes ?? 10;
      const until = new Date(Date.now() + mins * 60000).toISOString();
      setCustomSnooze({ alarmId: ringingAlarm.id, until });
      await AsyncStorage.setItem(
        SNOOZE_KEY,
        JSON.stringify({ alarmId: ringingAlarm.id, until }),
      );
      try {
        await scheduleSnoozeNotification(
          ringingAlarm.label || 'Báo thức',
          `Báo lại sau ${mins} phút.`,
          mins,
          ringingAlarm.id,
        );
      } catch {
        Alert.alert(
          'Không đặt được thông báo báo lại',
          'Hãy kiểm tra quyền thông báo. Báo thức trong ứng dụng vẫn sẽ được thử lại khi ứng dụng đang mở.',
        );
      }
      setAlarmVisible(false);
      setRingingAlarm(null);
      await stopAlarm();
    }
  };

  const dismissAlarm = async () => {
    await stopAlarm();
    setAlarmVisible(false);
    setRingingAlarm(null);
    setCustomSnooze(null);
    await AsyncStorage.removeItem(SNOOZE_KEY).catch(() => {});
    await cancelSnoozeNotification();
  };

  if (loading) {
    return (
      <SafeAreaProvider>
        <SafeAreaView style={styles.safe}>
          <ActivityIndicator
            size='large'
            color={PRIMARY}
            style={{ marginTop: 80 }}
          />
        </SafeAreaView>
      </SafeAreaProvider>
    );
  }

  if (alarmVisible) {
    const elapsed = session
      ? Math.max(
          0,
          Math.round(
            (Date.now() - new Date(session.startedAt).getTime()) / 60000,
          ),
        )
      : 0;
    const snoozeMins = ringingAlarm ? (ringingAlarm.snoozeMinutes ?? 10) : 10;
    return (
      <SafeAreaProvider>
        <SafeAreaView style={styles.darkSafe}>
          <View style={styles.alarmBox}>
            <Ionicons
              name='alarm-outline'
              size={64}
              color='#fff'
              style={{ marginBottom: 12 }}
            />
            <Text style={styles.alarmTitle}>BÁO THỨC</Text>
            <Text style={styles.alarmTime}>{fmtHHMM(new Date())}</Text>
            <Text style={styles.alarmText}>
              {session
                ? `Bạn đã ngủ ${fmtDur(elapsed)}.`
                : ringingAlarm
                  ? `${ringingAlarm.label} • ${ringingAlarm.time}`
                  : 'Đã đến giờ dậy.'}
            </Text>
            <TouchableOpacity style={styles.snoozeButton} onPress={snooze}>
              <Text style={styles.snoozeText}>
                Phát lại sau {snoozeMins} phút
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.wakeButton}
              onPress={() => (session ? finish('alarm') : dismissAlarm())}
              disabled={saving}
            >
              <Text style={styles.wakeText}>
                {saving ? 'Đang lưu...' : 'Đã dậy'}
              </Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </SafeAreaProvider>
    );
  }

  if (sleepMode && session) {
    const wakeAt = computeWakeAt(session.startedAt, profile?.wake_time ?? null);
    const elapsed = Math.max(
      0,
      Math.round((Date.now() - new Date(session.startedAt).getTime()) / 60000),
    );
    return (
      <SafeAreaProvider>
        <SafeAreaView style={styles.darkSafe}>
          <Text style={styles.star1}>✦</Text>
          <Text style={styles.star2}>✦</Text>
          <Text style={styles.star3}>✧</Text>
          <Animated.View
            style={{ transform: [{ scale: moonAnim }], marginBottom: 20 }}
          >
            <Ionicons name='moon' size={90} color='#FDE68A' />
          </Animated.View>
          <Text style={styles.darkTitle}>Chế độ ngủ</Text>
          <Text style={styles.darkText}>
            Bắt đầu lúc {fmtHHMM(new Date(session.startedAt))}
          </Text>
          <Text style={styles.darkText}>Đã ngủ {fmtDur(elapsed)}</Text>
          {wakeAt ? (
            <Text style={styles.darkText}>
              Dự kiến dậy {fmtHHMM(wakeAt)} ngày {keyToDisplay(toKey(wakeAt))}
            </Text>
          ) : null}
          <View style={styles.darkRow}>
            <Text style={styles.darkText}>Tiếng mưa</Text>
            <Switch value={noiseOn} onValueChange={toggleNoise} />
          </View>
          <TouchableOpacity
            style={styles.wakeButton}
            onPress={() => finish('manual')}
            disabled={saving}
          >
            <Text style={styles.wakeText}>
              {saving ? 'Đang lưu...' : 'Đã dậy'}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.darkGhost} onPress={exitSleepScreen}>
            <Text style={styles.darkGhostText}>Rời màn hình ngủ</Text>
          </TouchableOpacity>
          <Text style={styles.darkNote}>
            Rời màn hình không hủy phiên ngủ. Bạn vẫn có thể bấm Đã dậy ở đây
            hoặc ở Trang chủ vào sáng hôm sau.
          </Text>
        </SafeAreaView>
      </SafeAreaProvider>
    );
  }

  const wakeAt = session
    ? computeWakeAt(session.startedAt, profile?.wake_time ?? null)
    : null;
  const elapsed = session
    ? Math.max(
        0,
        Math.round(
          (Date.now() - new Date(session.startedAt).getTime()) / 60000,
        ),
      )
    : 0;
  // SỬA: banner xác nhận dậy — tính cả giờ báo lại (snoozeUntil) chứ
  // không chỉ giờ dậy gốc, và cập nhật theo tick 20 giây.
  const bannerWakeAt = session
    ? session.snoozeUntil
      ? new Date(session.snoozeUntil)
      : wakeAt
    : null;
  const isWakeOverdue = !!(
    session &&
    bannerWakeAt &&
    new Date() >= bannerWakeAt
  );
  const hasSchedule = !!(profile?.bedtime_time && profile?.wake_time);
  const rainRatio =
    rainProgress.duration > 0
      ? rainProgress.current / rainProgress.duration
      : 0;

  return (
    <SafeAreaProvider>
      <SafeAreaView style={styles.safe}>
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <ScrollView
            contentContainerStyle={[styles.scroll, { paddingBottom: 160 }]}
            keyboardShouldPersistTaps='handled'
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
            }
          >
            <View style={styles.header}>
              <TouchableOpacity onPress={() => navigation?.goBack()}>
                <Ionicons
                  name='chevron-back'
                  size={30}
                  color='#111'
                  style={{ marginRight: 12 }}
                />
              </TouchableOpacity>
              <Text style={[styles.headerTitle, { flex: 1 }]}>
                Theo dõi giấc ngủ
              </Text>
              <TouchableOpacity
                onPress={onRefresh}
                disabled={refreshing}
                style={{ padding: 6 }}
              >
                <Ionicons name='refresh-outline' size={20} color={PRIMARY} />
              </TouchableOpacity>
            </View>

            <View style={styles.banner}>
              <View
                style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}
              >
                <Ionicons name='moon-outline' size={14} color='#A8E6A1' />
                <Text style={styles.bannerTag}>GIẤC NGỦ PHỤC HỒI</Text>
              </View>
              <Text style={styles.bannerLabel}>Thời lượng ngủ trung bình</Text>
              <Text style={styles.bannerNumber}>
                {avgMin !== null ? fmtDur(avgMin) : '--'}
              </Text>
              <Text style={styles.bannerText}>
                {avgMin === null
                  ? 'Chưa có ngày nào ghi sleep_hours trong 7 ngày qua.'
                  : goal
                    ? `Tính trên ${withData.length} ngày có dữ liệu, mục tiêu ${goal} giờ. ${avgMin >= goal * 60 ? 'Đã đạt mục tiêu.' : `Còn thiếu ${fmtDur(goal * 60 - avgMin)} so với mục tiêu.`}`
                    : `Tính trên ${withData.length} ngày có dữ liệu.`}
              </Text>
            </View>

            <View style={styles.card}>
              <Text style={styles.cardTitle}>Thống kê giấc ngủ (7 ngày)</Text>
              <View style={styles.barArea}>
                {goal ? (
                  <View
                    style={[styles.goalLine, { bottom: (goal / 12) * 140 }]}
                  />
                ) : null}
                {last7.map((d) => (
                  <View key={d.key} style={styles.barCol}>
                    <View
                      style={[
                        styles.bar,
                        {
                          height:
                            d.hours !== null
                              ? Math.min((Number(d.hours) / 12) * 140, 140)
                              : 0,
                        },
                      ]}
                    />
                    <Text style={styles.barValue}>
                      {d.hours !== null ? Number(d.hours).toFixed(1) : '--'}
                    </Text>
                    <Text style={styles.barLabel}>{d.label}</Text>
                  </View>
                ))}
              </View>
            </View>

            <View style={styles.card}>
              <View style={styles.noiseHeader}>
                <View style={styles.noiseIconCircle}>
                  <Ionicons
                    name='musical-notes-outline'
                    size={20}
                    color={PRIMARY}
                  />
                </View>
                <Text style={[styles.cardTitle, { marginBottom: 0 }]}>
                  Rừng mưa nhiệt đới
                </Text>
              </View>
              <View style={styles.progressRow}>
                <TouchableOpacity
                  style={styles.playBtn}
                  onPress={() => toggleNoise(!noiseOn)}
                >
                  <Ionicons
                    name={noiseOn ? 'pause' : 'play'}
                    size={20}
                    color='#111'
                  />
                </TouchableOpacity>
                <View style={{ flex: 1 }}>
                  <ProgressTrack progress={rainRatio} onSeek={seekRain} />
                  <View
                    style={{
                      flexDirection: 'row',
                      justifyContent: 'space-between',
                    }}
                  >
                    <Text style={styles.progressTime}>
                      {fmtMMSS(rainProgress.current)}
                    </Text>
                    <Text style={styles.progressTime}>
                      {fmtMMSS(rainProgress.duration)}
                    </Text>
                  </View>
                </View>
              </View>
              <Text style={styles.note}>Tự tắt sau 45 phút</Text>
            </View>

            {editingSchedule ? (
              <View style={styles.card}>
                <Text style={styles.cardTitle}>
                  {hasSchedule ? 'Sửa lịch ngủ' : 'Thiết lập lịch ngủ'}
                </Text>
                <Text style={styles.label}>Giờ đi ngủ</Text>
                <TextInput
                  style={styles.input}
                  value={bedtimeInput}
                  onChangeText={setBedtimeInput}
                  placeholder='22:00'
                  keyboardType='numbers-and-punctuation'
                />
                <Text style={styles.label}>Giờ dậy</Text>
                <TextInput
                  style={styles.input}
                  value={wakeInput}
                  onChangeText={setWakeInput}
                  placeholder='07:30'
                  keyboardType='numbers-and-punctuation'
                />
                <Text style={styles.label}>Mục tiêu giấc ngủ (giờ)</Text>
                <TextInput
                  style={styles.input}
                  value={goalInput}
                  onChangeText={setGoalInput}
                  placeholder='8'
                  keyboardType='decimal-pad'
                />
                <TouchableOpacity
                  style={styles.saveButton}
                  onPress={saveSchedule}
                  disabled={saving}
                >
                  <Text style={styles.saveButtonText}>
                    {saving ? 'Đang lưu...' : 'Lưu lịch ngủ'}
                  </Text>
                </TouchableOpacity>
                {hasSchedule ? (
                  <TouchableOpacity
                    style={styles.secondaryButton}
                    onPress={cancelEditSchedule}
                  >
                    <Text style={styles.secondaryButtonText}>Hủy</Text>
                  </TouchableOpacity>
                ) : null}
              </View>
            ) : (
              <View style={styles.card}>
                <View style={styles.scheduleHeader}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.cardTitle}>Lịch biểu phục hồi</Text>
                    <Text style={styles.cardText}>
                      Đồng bộ với nhịp sinh học tự nhiên
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={styles.editPill}
                    onPress={() => setEditingSchedule(true)}
                  >
                    <View style={styles.btnRow}>
                      <Ionicons
                        name='settings-outline'
                        size={14}
                        color='#111'
                      />
                      <Text style={styles.editPillText}>Chỉnh sửa</Text>
                    </View>
                  </TouchableOpacity>
                </View>
                <View style={{ flexDirection: 'row', gap: 12, marginTop: 12 }}>
                  <View style={styles.timeBox}>
                    <View
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 6,
                      }}
                    >
                      <Ionicons name='moon-outline' size={14} color='#333' />
                      <Text style={styles.timeBoxLabel}>GIỜ ĐI NGỦ</Text>
                    </View>
                    <Text style={styles.timeBoxTime}>
                      {profile?.bedtime_time
                        ? toTimeInput(profile.bedtime_time)
                        : '--:--'}
                    </Text>
                    <Text style={styles.timeBoxSub}>Giờ đi ngủ</Text>
                  </View>
                  <View style={styles.timeBox}>
                    <View
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 6,
                      }}
                    >
                      <Ionicons name='sunny-outline' size={14} color='#333' />
                      <Text style={styles.timeBoxLabel}>GIỜ THỨC DẬY</Text>
                    </View>
                    <Text style={styles.timeBoxTime}>
                      {profile?.wake_time
                        ? toTimeInput(profile.wake_time)
                        : '--:--'}
                    </Text>
                    <Text style={styles.timeBoxSub}>Giờ dậy</Text>
                  </View>
                </View>
                <Text style={[styles.cardText, { marginTop: 12 }]}>
                  Mục tiêu: {goal ? `${goal} giờ` : 'Chưa thiết lập'}
                </Text>
              </View>
            )}

            {session && isWakeOverdue ? (
              <View style={styles.questionCard}>
                <Text style={styles.questionTitle}>Bạn đã dậy chưa?</Text>
                <Text style={styles.cardText}>
                  Đã quá giờ dậy
                  {bannerWakeAt ? ` ${fmtHHMM(bannerWakeAt)}` : ''} mà phiên ngủ
                  vẫn chưa được xác nhận.
                </Text>
                <Text style={styles.cardText}>
                  Bạn đã dậy rồi hay vẫn đang ngủ?
                </Text>
                <View style={styles.sleepActionRow}>
                  <TouchableOpacity
                    style={[styles.sleepActionBtn, styles.greyBtn]}
                    onPress={snooze}
                  >
                    <Text style={styles.greyBtnText}>
                      Chưa dậy, báo lại 10 phút
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.saveButton, styles.sleepActionBtn]}
                    onPress={() => finish('alarm')}
                    disabled={saving}
                  >
                    <Text style={styles.saveButtonText}>
                      {saving ? 'Đang lưu...' : 'Đã dậy, lưu lại'}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : session ? (
              <View style={styles.questionCard}>
                <Text style={styles.questionTitle}>
                  Bạn đang trong phiên ngủ
                </Text>
                <Text style={styles.cardText}>
                  Bắt đầu lúc {fmtHHMM(new Date(session.startedAt))} ngày{' '}
                  {keyToDisplay(toKey(new Date(session.startedAt)))}.
                </Text>
                <Text style={styles.cardText}>
                  Đã ngủ {fmtDur(elapsed)}
                  {wakeAt ? `, dự kiến dậy ${fmtHHMM(wakeAt)}.` : '.'}
                </Text>
                <View style={styles.sleepActionRow}>
                  <TouchableOpacity
                    style={[styles.sleepActionBtn, styles.greyBtn]}
                    onPress={enterSleepScreen}
                  >
                    <Text style={styles.greyBtnText}>Vào chế độ ngủ</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.saveButton, styles.sleepActionBtn]}
                    onPress={() =>
                      finish(
                        toKey(new Date(session.startedAt)) !== toKey(new Date())
                          ? 'next_day'
                          : 'manual',
                      )
                    }
                    disabled={saving}
                  >
                    <Text style={styles.saveButtonText}>
                      {saving ? 'Đang lưu...' : 'Đã dậy, lưu lại'}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              <TouchableOpacity style={styles.bigButton} onPress={startSleep}>
                <View style={styles.btnRow}>
                  <Ionicons name='moon-outline' size={18} color='#fff' />
                  <Text style={styles.bigButtonText}>Bắt đầu chế độ ngủ</Text>
                </View>
              </TouchableOpacity>
            )}

            <View style={styles.card}>
              <Text style={styles.cardTitle}>Báo thức</Text>
              {alarms.map((a, idx) => (
                <View
                  key={a.id}
                  style={[styles.alarmRow, idx > 0 && styles.alarmRowDivider]}
                >
                  <TouchableOpacity
                    style={{ flex: 1 }}
                    onPress={() => openEditAlarm(a)}
                  >
                    <Text
                      style={[
                        styles.alarmRowTime,
                        !a.enabled && { color: '#999' },
                      ]}
                    >
                      {a.time}
                    </Text>
                    <Text style={styles.alarmRowSub}>{alarmSub(a)}</Text>
                  </TouchableOpacity>
                  <View style={styles.alarmControls}>
                    <Switch
                      value={a.enabled}
                      onValueChange={(v) =>
                        saveAlarms(
                          alarms.map((x) =>
                            x.id === a.id ? { ...x, enabled: v } : x,
                          ),
                        )
                      }
                      trackColor={{ false: '#D9D9D9', true: PRIMARY }}
                      thumbColor='#fff'
                    />
                    <TouchableOpacity onPress={() => deleteAlarm(a.id)}>
                      <Ionicons
                        name='close'
                        size={18}
                        color='#888'
                        style={{ marginLeft: 8 }}
                      />
                    </TouchableOpacity>
                  </View>
                </View>
              ))}
              {alarms.length === 0 && (
                <Text style={styles.note}>
                  Chưa có báo thức nào. Bấm + để thêm.
                </Text>
              )}
              {alarmFormVisible ? (
                <>
                  <Text style={[styles.cardTitle, { marginTop: 12 }]}>
                    {editingAlarmId ? 'Sửa báo thức' : 'Thêm báo thức'}
                  </Text>
                  <Text style={styles.label}>Giờ báo thức</Text>
                  <TextInput
                    style={styles.input}
                    value={alarmTimeInput}
                    onChangeText={setAlarmTimeInput}
                    placeholder='07:30'
                    keyboardType='numbers-and-punctuation'
                  />
                  <Text style={styles.label}>Nhãn</Text>
                  <TextInput
                    style={styles.input}
                    value={alarmLabelInput}
                    onChangeText={setAlarmLabelInput}
                    placeholder='Báo thức'
                  />
                  <Text style={styles.label}>Lặp lại vào các thứ</Text>
                  <View style={styles.dayRow}>
                    {DAY_SHORT.map((label, d) => (
                      <TouchableOpacity
                        key={label}
                        style={[
                          styles.dayChip,
                          {
                            backgroundColor: alarmDays.includes(d)
                              ? PRIMARY
                              : '#D9D9D9',
                          },
                        ]}
                        onPress={() => toggleAlarmDay(d)}
                      >
                        <Text
                          style={[
                            styles.dayChipText,
                            { color: alarmDays.includes(d) ? '#fff' : '#111' },
                          ]}
                        >
                          {label}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                  <Text style={styles.note}>
                    Không chọn thứ nào thì báo thức chỉ reo một lần rồi tự tắt.
                  </Text>
                  <Text style={styles.label}>Thời lượng báo lại (phút)</Text>
                  <TextInput
                    style={styles.input}
                    value={alarmSnoozeInput}
                    onChangeText={setAlarmSnoozeInput}
                    placeholder='10'
                    keyboardType='number-pad'
                  />
                  <TouchableOpacity
                    style={styles.saveButton}
                    onPress={saveAlarm}
                  >
                    <Text style={styles.saveButtonText}>
                      {editingAlarmId ? 'Lưu thay đổi' : 'Lưu báo thức'}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.secondaryButton}
                    onPress={() => {
                      setEditingAlarmId(null);
                      setAlarmFormVisible(false);
                    }}
                  >
                    <Text style={styles.secondaryButtonText}>Hủy</Text>
                  </TouchableOpacity>
                </>
              ) : (
                <TouchableOpacity
                  style={styles.addCircle}
                  onPress={openAddAlarm}
                >
                  <Text style={styles.addPlus}>+</Text>
                </TouchableOpacity>
              )}
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F9F9FF' },
  scroll: { padding: 16, paddingBottom: 32 },
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  back: { fontSize: 30, color: '#111', marginRight: 12 },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#111' },
  btnRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  banner: {
    backgroundColor: '#1E2A4A',
    borderRadius: 20,
    padding: 20,
    marginBottom: 16,
  },
  bannerTag: { color: '#A8E6A1', fontWeight: '800', fontSize: 12 },
  bannerLabel: { color: '#CBD5E1', marginTop: 12 },
  bannerNumber: {
    color: '#fff',
    fontSize: 36,
    fontWeight: '800',
    marginVertical: 4,
  },
  bannerText: { color: '#CBD5E1', lineHeight: 20 },
  card: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 16,
    marginBottom: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 8,
  },
  cardTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#111',
    marginBottom: 8,
  },
  cardText: { fontSize: 14, color: '#444', lineHeight: 20 },
  barArea: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    height: 170,
    position: 'relative',
    marginTop: 8,
  },
  goalLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    borderTopWidth: 1,
    borderTopColor: PRIMARY,
    borderStyle: 'dashed',
  },
  barCol: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-end',
    height: 170,
  },
  bar: {
    width: 18,
    backgroundColor: PRIMARY,
    borderTopLeftRadius: 8,
    borderTopRightRadius: 8,
  },
  barValue: { fontSize: 11, color: '#111', marginTop: 4 },
  barLabel: { fontSize: 11, color: '#666' },
  note: { fontSize: 12, color: '#888', marginTop: 8, lineHeight: 17 },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: '#333',
    marginTop: 8,
    marginBottom: 4,
  },
  input: {
    backgroundColor: '#EEF1FF',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    color: '#111',
    marginBottom: 8,
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginVertical: 6,
  },
  saveButton: {
    backgroundColor: PRIMARY,
    borderRadius: 999,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 8,
  },
  saveButtonText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  secondaryButton: {
    backgroundColor: '#EEF1FF',
    borderRadius: 999,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 8,
  },
  secondaryButtonText: { color: '#111', fontSize: 15, fontWeight: '700' },
  questionCard: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E5E5E5',
  },
  questionTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#111',
    marginBottom: 8,
  },
  sleepActionRow: { flexDirection: 'row', gap: 12, marginTop: 8 },
  sleepActionBtn: {
    flex: 1,
    borderRadius: 999,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 0,
  },
  greyBtn: { backgroundColor: '#D9D9D9' },
  greyBtnText: { color: '#111', fontSize: 15, fontWeight: '700' },
  bigButton: {
    backgroundColor: PRIMARY,
    borderRadius: 999,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 16,
  },
  bigButtonText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  noiseHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  noiseIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#E8F5E9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  noiseIcon: { fontSize: 20, color: PRIMARY },
  progressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 4,
  },
  playBtn: { padding: 6 },
  playText: { color: '#111', fontSize: 20 },
  progressTime: { fontSize: 12, color: '#666' },
  scheduleHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  editPill: {
    backgroundColor: '#EEF1FF',
    borderRadius: 999,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  editPillText: { color: '#111', fontWeight: '700', fontSize: 13 },
  timeBox: {
    flex: 1,
    backgroundColor: '#EEF1FF',
    borderRadius: 16,
    padding: 14,
  },
  timeBoxLabel: { fontSize: 12, fontWeight: '800', color: '#333' },
  timeBoxTime: { fontSize: 26, fontWeight: '800', color: '#111' },
  timeBoxSub: { fontSize: 12, color: '#666', marginTop: 4 },
  alarmRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#fff',
    paddingVertical: 12,
  },
  alarmRowDivider: {
    borderTopWidth: 1,
    borderTopColor: '#E5E5E5',
  },
  alarmRowTime: { fontSize: 26, fontWeight: '800', color: '#111' },
  alarmRowSub: { fontSize: 13, color: '#666', marginTop: 4 },
  alarmControls: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'center',
    marginTop: 10,
  },
  dayRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap', marginTop: 4 },
  dayChip: { borderRadius: 999, paddingVertical: 8, paddingHorizontal: 12 },
  dayChipText: { fontWeight: '700' },
  addCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: PRIMARY,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginTop: 12,
  },
  addPlus: { color: '#fff', fontSize: 28, fontWeight: '800' },
  darkSafe: {
    flex: 1,
    backgroundColor: '#000',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  moon: { fontSize: 90, marginBottom: 20 },
  star1: {
    position: 'absolute',
    top: 90,
    left: 50,
    color: '#FDE68A',
    fontSize: 20,
  },
  star2: {
    position: 'absolute',
    top: 150,
    right: 60,
    color: '#fff',
    fontSize: 16,
  },
  star3: {
    position: 'absolute',
    top: 240,
    left: 80,
    color: '#CBD5E1',
    fontSize: 14,
  },
  darkTitle: {
    color: '#fff',
    fontSize: 24,
    fontWeight: '800',
    marginBottom: 12,
  },
  darkText: {
    color: '#E2E8F0',
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
  },
  darkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    marginTop: 24,
    marginBottom: 12,
  },
  darkGhost: { marginTop: 14, paddingVertical: 10 },
  darkGhostText: { color: '#94A3B8', fontSize: 14, fontWeight: '600' },
  darkNote: {
    color: '#64748B',
    fontSize: 12,
    lineHeight: 17,
    textAlign: 'center',
    marginTop: 12,
  },
  alarmBox: { alignItems: 'center', width: '100%' },
  alarmMoon: { fontSize: 64, marginBottom: 12 },
  alarmTitle: {
    color: '#fff',
    fontSize: 28,
    fontWeight: '900',
    letterSpacing: 2,
  },
  alarmTime: {
    color: '#fff',
    fontSize: 52,
    fontWeight: '800',
    marginVertical: 8,
  },
  alarmText: { color: '#E2E8F0', fontSize: 15, marginBottom: 28 },
  snoozeButton: {
    backgroundColor: '#334155',
    borderRadius: 999,
    paddingVertical: 14,
    width: '100%',
    alignItems: 'center',
    marginBottom: 10,
  },
  snoozeText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  wakeButton: {
    backgroundColor: PRIMARY,
    borderRadius: 999,
    paddingVertical: 14,
    width: '100%',
    alignItems: 'center',
  },
  wakeText: { color: '#fff', fontSize: 16, fontWeight: '800' },
});
