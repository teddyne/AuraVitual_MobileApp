import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  RefreshControl,
  ScrollView,
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
import DateTimePicker from '@react-native-community/datetimepicker';
import { supabase } from '../../../api/supabase';
// Nhóm B (v2): getPostsByTopic do nhóm C thêm vào auravitalApi
// (item 11b, kèm migration thêm cột topic cho posts + seed 3 bài ngủ).
import {
  getDeepSleepInRange,
  getPostsByTopic,
  getSleepMetricsInRange,
  getSleepSessionsInRange,
  type SleepSessionRange,
} from '../../../api/auravitalApi';
import {
  MODE_KEY,
  NOISE_KEY,
  ALARMS_KEY,
  TRIGGERED_KEY,
  SNOOZE_KEY,
  WAKE_NAV_KEY,
  AlarmItem,
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
  markWakeHandled,
  isWakeHandledToday,
  toDbTime,
  toKey,
  toTimeInput,
} from '../../../utils/health/sleepSession';
import { AppHeader } from '../../../components/ui/AppHeader';
import { AppIcon } from '../../../components/ui/AppIcon';
import { DropdownSelect } from '../../../components/ui/DropdownSelect';
import { ArticleCard } from '../../../components/explore/ArticleCard';
import { useSettings } from '../../../context/SettingsContext';
import {
  PRIMARY,
  RAIN_SOUND,
  ALARM_SOUND,
  WD,
  WD_EN,
  DAY_SHORT,
  DAY_SHORT_EN,
} from '../constants';
import { fmtMMSS, displayLabel, alarmSub } from '../../../utils/health/sleepFormat';
import { ProgressTrack } from '../../../components/health/SleepProgressTrack';
import { styles } from './SleepTrackerScreen.styles';

type SleepRow = { log_date: string; sleep_hours: number | null };

// Nhóm D — thống kê Ngày/Tuần/Tháng (chỉ thêm mới, không sửa logic cũ).
type StatsTab = 'day' | 'week' | 'month';
type DaySegment = { startMin: number; endMin: number };
const DAY_MINUTES = 24 * 60;
const DEFAULT_SLEEP_GOAL_HOURS = 8;

/**
 * Khoảng ngủ nằm trong ngày đang xem (anchor), tính bằng phút từ 00:00,
 * kẹp trong [0, 1440]. CHỈ vẽ từ phiên đang mở thật (session.startedAt
 * tới giờ dậy dự kiến hoặc tới hiện tại). Nhóm B (v6) đã XÓA nhánh
 * 'derived': trước đây không có phiên mà có health_metrics.sleep_hours
 * thì suy ra khoảng ngủ từ giờ dậy/giờ đi ngủ đã đặt — giờ đặt chỉ dùng
 * để nhắc/báo thức, không phải dữ liệu ngủ, nên ngày không có phiên thật
 * thì kind 'none' và biểu đồ hiện "Chưa có dữ liệu".
 */
function buildDaySegments(
  session: SleepSession | null,
  profile: SleepProfile | null,
  anchor: Date,
): {
  segments: DaySegment[];
  kind: 'session' | 'none';
  startLabel: string | null;
  endLabel: string | null;
} {
  const now = new Date();
  const midnight = new Date(
    anchor.getFullYear(),
    anchor.getMonth(),
    anchor.getDate(),
  );
  const isToday = toKey(anchor) === toKey(now);
  if (session && isToday) {
    const started = new Date(session.startedAt);
    const wakeAt = computeWakeAt(session.startedAt, profile?.wake_time ?? null);
    const end = wakeAt ?? now;
    const startMin = Math.max(
      0,
      Math.round((started.getTime() - midnight.getTime()) / 60000),
    );
    const endMin = Math.min(
      DAY_MINUTES,
      Math.round((end.getTime() - midnight.getTime()) / 60000),
    );
    return {
      segments: endMin > startMin ? [{ startMin, endMin }] : [],
      kind: 'session',
      startLabel: fmtHHMM(started),
      endLabel: fmtHHMM(end),
    };
  }
  return { segments: [], kind: 'none', startLabel: null, endLabel: null };
}

// Nhóm B (v3) — tiện ích tuần (bắt đầu thứ Hai), viết local trong file
// này (không sửa src/utils/dates.ts để tránh xung đột nhóm khác).
const WEEK_YEAR_OPTIONS = [2025, 2026, 2027];
const MONTH_SHORT_EN = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

function startOfWeekMonday(d: Date): Date {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  x.setDate(x.getDate() - ((x.getDay() + 6) % 7));
  return x;
}

function addDaysLocal(d: Date, n: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

/** Các thứ Hai mà tuần của nó chạm vào năm đã cho (kể cả tuần tràn từ cuối tháng 12 năm trước). */
function mondaysOfYear(year: number): Date[] {
  const out: Date[] = [];
  let m = startOfWeekMonday(new Date(year, 0, 1));
  const last = new Date(year, 11, 31);
  while (m.getTime() <= last.getTime()) {
    out.push(m);
    m = addDaysLocal(m, 7);
  }
  return out;
}

/** Nhãn tuần: "19–26 tháng 10", tuần tràn tháng thì "29 tháng 9 – 5 tháng 10". */
function formatWeekLabel(start: Date, locale: string): string {
  const end = addDaysLocal(start, 6);
  const sm = start.getMonth();
  const em = end.getMonth();
  if (locale === 'en') {
    return sm === em
      ? `${start.getDate()}–${end.getDate()} ${MONTH_SHORT_EN[sm]}`
      : `${start.getDate()} ${MONTH_SHORT_EN[sm]} – ${end.getDate()} ${MONTH_SHORT_EN[em]}`;
  }
  return sm === em
    ? `${start.getDate()}–${end.getDate()} tháng ${sm + 1}`
    : `${start.getDate()} tháng ${sm + 1} – ${end.getDate()} tháng ${em + 1}`;
}

// Nhóm B (v5, giữ cho biểu đồ ngày) — cửa sổ đêm: 22:00 ngày xem →
// 10:00 hôm sau (12 giờ), tính bằng phút từ 00:00 ngày xem: [1320,
// 2040]. Nhóm B (v6): biểu đồ tuần/tháng đã về lại cột dọc kiểu v4 nên
// không còn trục giờ dọc bên phải / thanh theo giờ (đã xóa
// NIGHT_CHART_H, NIGHT_PX_PER_HOUR và nightBarLayout).
const NIGHT_WINDOW_START_MIN = 22 * 60; // 1320
const NIGHT_WINDOW_END_MIN = (24 + 10) * 60; // 2040
const NIGHT_HOURS = 12;
const NIGHT_DAY_CHART_H = 180; // px, vùng biểu đồ ngày

/**
 * Pure: đưa 1 khoảng ngủ thật [startMs, endMs] về phút tính từ 00:00
 * ngày anchor, đặt vào cửa sổ đêm [1320, 2040]. Phiên qua nửa đêm thì
 * endMin += 1440 (vd 23:00 → 07:00 thành [-60, 420]); đoạn kết thúc
 * trước 22:00 thì dời +1440 để rơi đúng ô giờ của nó trong cửa sổ
 * (vd [-60, 420] thành [1380, 1860]). Đoạn nằm hẳn ngoài cửa sổ vẫn
 * giữ nguyên để nightCumulativeMinutes tự kẹp về 0 (vd giấc trưa).
 * Trả null khi khoảng rỗng (end <= start).
 */
function toNightSegment(
  startMs: number,
  endMs: number,
  midnightMs: number,
): DaySegment | null {
  if (endMs <= startMs) return null;
  let startMin = Math.round((startMs - midnightMs) / 60000);
  let endMin = Math.round((endMs - midnightMs) / 60000);
  if (endMin <= startMin) endMin += DAY_MINUTES;
  if (endMin <= NIGHT_WINDOW_START_MIN) {
    startMin += DAY_MINUTES;
    endMin += DAY_MINUTES;
  }
  return { startMin, endMin };
}

/**
 * Khoảng ngủ KHÔNG kẹp trong ngày (đối tác của buildDaySegments, không
 * sửa hàm đó): startMin có thể âm (ngủ từ tối hôm trước), endMin có thể
 * > 1440 (dậy sáng hôm sau). CHỈ từ dữ liệu đo thật:
 * - Phiên đang mở (ngày xem là hôm nay): session.startedAt + giờ dậy
 *   dự kiến (computeWakeAt) hoặc tới hiện tại.
 * - Phiên đã xong dậy vào ngày xem: từng dòng sleep_sessions thật đã
 *   tải vào viewSessions (started_at/ended_at), trừ phiên đang mở nếu
 *   trùng startedAt để không đếm đúp.
 * Nhóm B (v6) đã XÓA nhánh suy ra từ health_metrics.sleep_hours +
 * giờ dậy/giờ đi ngủ đã đặt (nhánh 'derived' cũ): tổng giờ thật vẫn
 * hiện ở thẻ tóm tắt qua viewHours, nhưng vị trí cột trên biểu đồ chỉ
 * vẽ khi có giờ bắt đầu/kết thúc thật. Sửa luôn lỗi v5 ở nhánh phiên
 * mở: phiên bắt đầu 23:00 với giờ dậy 07:00 hôm sau bị dời cả đoạn
 * +1440 rồi kẹp về 0 cột (endMin 420 < startMin 1380) nên biểu đồ trống.
 */
function buildNightSegments(
  session: SleepSession | null,
  profile: SleepProfile | null,
  finished: SleepSessionRange[],
  anchor: Date,
): DaySegment[] {
  const now = new Date();
  const midnight = new Date(
    anchor.getFullYear(),
    anchor.getMonth(),
    anchor.getDate(),
  );
  const midnightMs = midnight.getTime();
  const isToday = toKey(anchor) === toKey(now);
  const segments: DaySegment[] = [];
  if (session && isToday) {
    const started = new Date(session.startedAt);
    const wakeAt = computeWakeAt(session.startedAt, profile?.wake_time ?? null);
    const end = wakeAt ?? now;
    const seg = toNightSegment(started.getTime(), end.getTime(), midnightMs);
    if (seg) segments.push(seg);
  }
  for (const s of finished) {
    if (session && s.startedAt === session.startedAt) continue;
    const seg = toNightSegment(
      new Date(s.startedAt).getTime(),
      new Date(s.endedAt).getTime(),
      midnightMs,
    );
    if (seg) segments.push(seg);
  }
  return segments;
}

/**
 * Pure: từ các khoảng ngủ KHÔNG kẹp (buildNightSegments), trả về mảng
 * 12 số = tổng phút ngủ TÍCH LŨY đến cuối mỗi giờ trong cửa sổ đêm
 * 22:00 → 10:00 (giờ 22, 23, 00, ..., 09). Mỗi giờ cộng dồn đúng số
 * phút ngủ trong giờ đó rồi cộng vào tổng các giờ trước.
 * Vd đêm 23:00 → 07:00 (480 phút): [0, 60, 120, 180, 240, 300, 360,
 * 420, 480, 480, 480, 480] — cột 23:00 cao 60, cột 00:00 cao 120,
 * ..., cột 07:00 cao 480, các cột sau giữ nguyên 480.
 */
function nightCumulativeMinutes(segments: DaySegment[]): number[] {
  const perHour = Array.from({ length: NIGHT_HOURS }, () => 0);
  for (const s of segments) {
    for (let i = 0; i < NIGHT_HOURS; i++) {
      const hourStart = NIGHT_WINDOW_START_MIN + i * 60;
      const hourEnd = hourStart + 60;
      perHour[i] += Math.max(
        0,
        Math.min(s.endMin, hourEnd) - Math.max(s.startMin, hourStart),
      );
    }
  }
  const cumulative: number[] = [];
  let total = 0;
  for (const m of perHour) {
    total += m;
    cumulative.push(total);
  }
  return cumulative;
}

/**
 * Pure: gộp các phiên sleep_sessions vừa tải vào map theo ngày dậy,
 * thay thế (không cộng dồn trùng) các ngày trong [startKey, endKey].
 */
function mergeSessionRows(
  prev: Map<string, SleepSessionRange[]>,
  rows: SleepSessionRange[],
  startKey: string,
  endKey: string,
): Map<string, SleepSessionRange[]> {
  const next = new Map(prev);
  const start = new Date(`${startKey}T00:00:00`);
  const end = new Date(`${endKey}T00:00:00`);
  for (
    let d = new Date(start);
    d.getTime() <= end.getTime();
    d.setDate(d.getDate() + 1)
  ) {
    next.delete(toKey(d));
  }
  for (const r of rows) {
    const arr = next.get(r.day) ?? [];
    arr.push(r);
    next.set(r.day, arr);
  }
  return next;
}

export default function SleepTrackerScreen({ navigation, route }: any) {
  const { t, locale } = useSettings();
  const wd = locale === 'en' ? WD_EN : WD;
  const dayShort = locale === 'en' ? DAY_SHORT_EN : DAY_SHORT;
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [profile, setProfile] = useState<SleepProfile | null>(null);
  const [hasProfile, setHasProfile] = useState(false);
  const [week, setWeek] = useState<SleepRow[]>([]);
  // Nhóm D — tab thống kê + dữ liệu 30 ngày (tải lười khi chọn tab Tháng).
  const [statsTab, setStatsTab] = useState<StatsTab>('day');
  const [month, setMonth] = useState<SleepRow[]>([]);
  const [monthLoaded, setMonthLoaded] = useState(false);
  const [monthLoading, setMonthLoading] = useState(false);
  // Nhóm B (v2/v3) — ngày đang xem cho thống kê (mặc định hôm nay): chỉ
  // tab Ngày vẽ đúng ngày này (đổi bằng DateTimePicker bên dưới).
  // Nhóm B (v3) — tab Tuần vẽ đúng 7 ngày của tuần đã chọn (bắt đầu thứ
  // Hai, mặc định tuần này); tab Tháng vẽ đúng các ngày trong tháng đã
  // chọn (mặc định tháng hiện tại, đổi bằng dropdown tháng/năm bên dưới).
  const [viewDate, setViewDate] = useState(() => new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [weekYear, setWeekYear] = useState(2026);
  const [weekStart, setWeekStart] = useState(() =>
    startOfWeekMonday(new Date()),
  );
  const [viewRows, setViewRows] = useState<SleepRow[]>([]);
  const [viewDeep, setViewDeep] = useState<Map<string, number>>(new Map());
  // Nhóm B (v5) — phiên ngủ thật (started_at/ended_at) theo ngày dậy,
  // để vẽ thanh ngủ theo giờ trên biểu đồ tuần/tháng. Tải gộp trong
  // loadViewRange / loadWeekRange, không thêm state tải riêng.
  const [viewSessions, setViewSessions] = useState<
    Map<string, SleepSessionRange[]>
  >(new Map());
  const [viewLoading, setViewLoading] = useState(false);
  // Nhóm B (v2) — 3 bài viết về giấc ngủ, lấy từ DB qua
  // getPostsByTopic('sleep', 3) (nhóm C thêm hàm + seed bài, topic='sleep').
  type SleepArticle = { id: string; title: string; summary: string | null; cover_url: string | null };
  const [sleepArticles, setSleepArticles] = useState<SleepArticle[]>([]);
  const [articlesLoading, setArticlesLoading] = useState(false);
  // Ngủ sâu đọc từ DB (sleep_sessions.deep_sleep_minutes), theo ngày dậy.
  const [deepSleepByDay, setDeepSleepByDay] = useState<Map<string, number>>(
    new Map(),
  );
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
  // Nhóm B (v6) — sửa lịch ngủ bằng picker xoay (spinner) thay cho gõ tay,
  // cùng pattern với ProfileSetupScreen.
  const [scheduleTimePicker, setScheduleTimePicker] = useState<
    'bedtime' | 'wake' | null
  >(null);
  const scheduleTimeToDate = (v: string, fallback: string) => {
    const mins = parseHHMM(v) ?? parseHHMM(fallback) ?? 22 * 60;
    const d = new Date();
    d.setHours(Math.floor(mins / 60), mins % 60, 0, 0);
    return d;
  };
  const scheduleDateToHHMM = (d: Date) =>
    `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  const onScheduleTimePicked = (d: Date | undefined) => {
    if (!d || !scheduleTimePicker) return;
    const v = scheduleDateToHHMM(d);
    if (scheduleTimePicker === 'bedtime') setBedtimeInput(v);
    else setWakeInput(v);
    // Android: spinner là hộp thoại, chọn xong (bấm OK) tự đóng;
    // iOS: spinner hiện inline nên giữ lại để chọn tiếp, bấm "Đóng" mới ẩn.
    if (Platform.OS !== 'ios') setScheduleTimePicker(null);
  };
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
  // SỬA: chống bấm đúp nút "Đã dậy" — cờ state `saving` cập nhật sau
  // một nhịp render nên 2 lần bấm nhanh vẫn cùng lọt qua; cờ ref này
  // chặn ngay lập tức vì đọc/ghi ref là đồng bộ.
  const finishingRef = useRef(false);
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
        title: t('sleep.alarmWakeTitle'),
        artist: 'AuraVital',
      });
      alarmPlayer.seekTo(0);
      alarmPlayer.play();
    } catch (e) {
      console.warn('Cannot play alarm sound', e);
    }
  }, [alarmPlayer, t]);
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
    // Nhóm D: đánh dấu dữ liệu tháng đã cũ để tải lại khi mở tab Tháng.
    setMonthLoaded(false);
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
    // Nhóm B (v6) — chỉ nhận phiên của đúng user này (loadSession lọc
    // theo uid); MODE_KEY='1' còn sót từ tài khoản trước không được bật
    // chế độ ngủ khi không có phiên của user hiện tại.
    const mode = await AsyncStorage.getItem(MODE_KEY);
    const s = await loadSession(uid);
    setSession(s);
    setSleepMode(mode === '1' && s !== null);
    if (!handledRoute.current) {
      handledRoute.current = true;
      if (route?.params?.autoSleep && !s) {
        const created = await startSession(uid);
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

  // Nhóm D — tải ngủ sâu 30 ngày gần nhất từ sleep_sessions (chỉ 1 lần
  // cho cả 3 tab Ngày/Tuần/Tháng). Lỗi thì giữ map rỗng để thẻ hiện
  // "Chưa có dữ liệu", không tự sinh số.
  const loadDeepSleep = useCallback(async () => {
    if (!userId) return;
    try {
      const end = new Date();
      const start = new Date();
      start.setDate(start.getDate() - 29);
      const rows = await getDeepSleepInRange(
        userId,
        toKey(start),
        toKey(end),
      );
      setDeepSleepByDay(new Map(rows.map((r) => [r.day, r.deepMinutes])));
    } catch (e) {
      console.warn('Cannot load deep sleep minutes', e);
    }
  }, [userId]);

  useEffect(() => {
    void loadDeepSleep();
  }, [loadDeepSleep]);

  // Nhóm D — chỉ tải 30 ngày khi người dùng chọn tab Tháng (tải lười).
  const loadMonth = useCallback(async () => {
    if (!userId || monthLoaded) return;
    setMonthLoading(true);
    try {
      const end = new Date();
      const start = new Date();
      start.setDate(start.getDate() - 29);
      const rows = await getSleepMetricsInRange(
        userId,
        toKey(start),
        toKey(end),
      );
      setMonth((rows ?? []) as SleepRow[]);
      setMonthLoaded(true);
    } catch (e) {
      console.warn('Cannot load month sleep metrics', e);
    } finally {
      setMonthLoading(false);
    }
  }, [userId, monthLoaded]);

  useEffect(() => {
    if (statsTab === 'month') loadMonth();
  }, [statsTab, loadMonth]);

  // Nhóm B (v2) — tải giờ ngủ + ngủ sâu cho khoảng chứa ngày đang xem:
  // từ 29 ngày trước ngày xem tới ngày xem, mở rộng tới hết tháng của
  // ngày xem để chip tháng/năm luôn có dữ liệu. Dùng đúng hàm có sẵn
  // getSleepMetricsInRange / getDeepSleepInRange (DB thật, không tự sinh số).
  const loadViewRange = useCallback(async () => {
    if (!userId) return;
    setViewLoading(true);
    try {
      const end = new Date(viewDate);
      const start = new Date(viewDate);
      start.setDate(start.getDate() - 29);
      const firstOfMonth = new Date(
        viewDate.getFullYear(),
        viewDate.getMonth(),
        1,
      );
      const lastOfMonth = new Date(
        viewDate.getFullYear(),
        viewDate.getMonth() + 1,
        0,
      );
      if (firstOfMonth < start) start.setTime(firstOfMonth.getTime());
      if (lastOfMonth > end) end.setTime(lastOfMonth.getTime());
      const [rows, deep, sessions] = await Promise.all([
        getSleepMetricsInRange(userId, toKey(start), toKey(end)),
        getDeepSleepInRange(userId, toKey(start), toKey(end)),
        getSleepSessionsInRange(userId, toKey(start), toKey(end)),
      ]);
      setViewRows((rows ?? []) as SleepRow[]);
      setViewDeep(new Map(deep.map((r) => [r.day, r.deepMinutes])));
      setViewSessions((prev) =>
        mergeSessionRows(prev, sessions ?? [], toKey(start), toKey(end)),
      );
    } catch (e) {
      console.warn('Cannot load sleep stats for selected date', e);
    } finally {
      setViewLoading(false);
    }
  }, [userId, viewDate]);

  useEffect(() => {
    void loadViewRange();
  }, [loadViewRange]);

  // Nhóm B (v3) — tải giờ ngủ + ngủ sâu cho đúng 7 ngày của tuần đã chọn
  // (không neo vào viewDate nữa). Gộp vào viewRows/viewDeep đã có để
  // statsMap/deepMap dùng chung, không thêm nguồn dữ liệu mới.
  const loadWeekRange = useCallback(
    async (monday: Date) => {
      if (!userId) return;
      const start = monday;
      const end = addDaysLocal(monday, 6);
      try {
        const [rows, deep, sessions] = await Promise.all([
          getSleepMetricsInRange(userId, toKey(start), toKey(end)),
          getDeepSleepInRange(userId, toKey(start), toKey(end)),
          getSleepSessionsInRange(userId, toKey(start), toKey(end)),
        ]);
        setViewRows((prev) => {
          const m = new Map(prev.map((r) => [r.log_date, r]));
          for (const r of rows ?? []) m.set(r.log_date, r as SleepRow);
          return [...m.values()];
        });
        setViewSessions((prev) =>
          mergeSessionRows(prev, sessions ?? [], toKey(start), toKey(end)),
        );
        setViewDeep(
          (prev) =>
            new Map([
              ...prev,
              ...deep.map((r): [string, number] => [r.day, r.deepMinutes]),
            ]),
        );
      } catch (e) {
        console.warn('Cannot load sleep stats for selected week', e);
      }
    },
    [userId],
  );

  useEffect(() => {
    if (statsTab === 'week') void loadWeekRange(weekStart);
  }, [statsTab, weekStart, loadWeekRange]);

  // Nhóm B (v2) — 3 bài viết giấc ngủ từ DB thật. Lỗi (vd cột topic chưa
  // được migrate trên DB đang chạy) thì giữ danh sách rỗng để UI hiện
  // "Chưa có bài viết", không bịa nội dung trong code.
  const loadSleepArticles = useCallback(async () => {
    setArticlesLoading(true);
    try {
      const rows = await getPostsByTopic('sleep', 3);
      setSleepArticles((rows ?? []) as SleepArticle[]);
    } catch (e) {
      console.warn('Cannot load sleep articles', e);
      setSleepArticles([]);
    } finally {
      setArticlesLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadSleepArticles();
  }, [loadSleepArticles]);

  // SỬA: load lại mỗi lần màn được focus — đây là chỗ sửa lỗi
  // "thoát ra đăng nhập lại mà không thấy xác nhận dậy". Trước đây
  // màn chỉ load lúc mount nên state phiên ngủ bị cũ sau khi
  // đăng xuất / đăng nhập lại hoặc đi màn khác rồi quay về.
  useFocusEffect(
    useCallback(() => {
      loadAll();
      void loadDeepSleep();
    }, [loadAll, loadDeepSleep]),
  );

  useEffect(() => {
    if (loading || !route?.params?.alarm) return;
    const triggerToken = route?.params?.triggerToken;
    if (triggerToken && triggerToken === lastAlarmTrigger.current) return;
    if (triggerToken) lastAlarmTrigger.current = triggerToken;

    const alarmId = route?.params?.alarmId;
    (async () => {
      if (!alarmId && (await isWakeHandledToday())) return;
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
      async (notification) => {
        const data = notification.request.content.data;
        if (
          data?.alarm !== true ||
          loading ||
          alarmVisible ||
          !navigation.isFocused()
        ) {
          return;
        }
        // Đã dậy rồi mà thông báo lịch vẫn tới sau thì bỏ qua, khỏi reo lại.
        if (data.alarmId == null && (await isWakeHandledToday())) return;

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
        t('home.noProfile'),
        t('sleep.noProfileDesc'),
        [
          { text: t('sleep.later'), style: 'cancel' },
          {
            text: t('settings.setupProfile'),
            onPress: () => navigation?.navigate('ProfileSetup'),
          },
        ],
      );
      return;
    }
    if (parseHHMM(bedtimeInput) === null || parseHHMM(wakeInput) === null) {
      Alert.alert(
        t('sleep.invalidTimeTitle'),
        t('sleep.invalidTimeDesc'),
      );
      return;
    }
    const goalNum = parseFloat(goalInput.replace(',', '.'));
    if (isNaN(goalNum) || goalNum < 4 || goalNum > 12) {
      Alert.alert(
        t('sleep.invalidGoalTitle'),
        t('sleep.invalidGoalDesc'),
      );
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
      Alert.alert(t('sleep.saveFailed'), error.message);
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
      t('sleep.savedScheduleTitle'),
      t('sleep.savedScheduleDesc'),
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
      Alert.alert(
        t('sleep.alarmSaveFailed'),
        e?.message || t('sleep.tryAgain'),
      );
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
      Alert.alert(
        t('sleep.invalidTimeTitle'),
        t('sleep.invalidAlarmTimeDesc'),
      );
      return;
    }
    const snoozeNum = parseInt(alarmSnoozeInput, 10);
    if (isNaN(snoozeNum) || snoozeNum < 1 || snoozeNum > 120) {
      Alert.alert(
        t('sleep.invalidSnoozeTitle'),
        t('sleep.invalidSnoozeDesc'),
      );
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
                label: alarmLabelInput.trim() || t('sleep.alarm'),
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
          label: alarmLabelInput.trim() || t('sleep.alarm'),
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
    Alert.alert(t('sleep.deleteAlarmTitle'), t('sleep.deleteAlarmDesc'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.delete'),
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
    last7.push({ key: k, label: wd[d.getDay()], hours: map.get(k) ?? null });
  }
  const withData = last7.filter((x) => x.hours !== null);
  const avgMin = withData.length
    ? Math.round(
        (withData.reduce((s, x) => s + Number(x.hours), 0) / withData.length) *
          60,
      )
    : null;
  const goal = profile?.sleep_goal_hours ?? null;

  // Nhóm D — dữ liệu cho tab thống kê đang chọn.
  // Lưu ý: getWeekMetrics/getWeekMetricsEndingOn chỉ trả TỔNG 7 ngày nên cột
  // từng ngày của tab Tuần tái dùng đúng truy vấn theo ngày đã có trong loadAll
  // (health_metrics.sleep_hours, 7 ngày gần nhất); tab Tháng dùng hàm mới
  // getSleepMetricsInRange trong src/api/auravitalApi.ts.
  // Nhóm B (v2/v3) — gộp các nguồn DB thật đã tải: week (7 ngày gần nhất),
  // month (30 ngày gần nhất) và viewRows (khoảng chứa ngày xem / tuần đã
  // chọn); viewRows thắng khi trùng ngày. Tab Ngày neo theo ngày đang xem
  // (viewDate), tab Tuần neo theo tuần đã chọn (weekStart), tab Tháng neo
  // theo tháng của viewDate. Banner phía trên vẫn neo vào hôm nay (last7).
  const viewKey = toKey(viewDate);
  const statsMap = new Map<string, number | null>([
    ...map,
    ...new Map(month.map((w) => [w.log_date, w.sleep_hours])),
    ...new Map(viewRows.map((w) => [w.log_date, w.sleep_hours])),
  ]);
  const deepMap = new Map<string, number>([...deepSleepByDay, ...viewDeep]);
  const viewHours = statsMap.get(viewKey) ?? null;
  const daySegments = buildDaySegments(session, profile, viewDate);
  // Nhóm B (v5, v6) — biểu đồ ngày: cột tích lũy trong cửa sổ đêm
  // 22:00 ngày xem → 10:00 hôm sau (buildNightSegments không kẹp
  // segment, nightCumulativeMinutes cộng dồn theo giờ). Chỉ vẽ từ
  // phiên thật: phiên đang mở (daySegments, kind 'session') hoặc phiên
  // đã xong dậy vào ngày xem (viewSessions từ sleep_sessions).
  // daySegments dùng để biết có phiên đang mở hay không (kind 'none'
  // khi không có), nightSegments để biết có phiên đã xong hay không.
  const nightSegments = buildNightSegments(
    session,
    profile,
    viewSessions.get(viewKey) ?? [],
    viewDate,
  );
  const dayHasData =
    daySegments.kind !== 'none' || nightSegments.length > 0;
  const nightCumulative = nightCumulativeMinutes(nightSegments);
  const nightTotal = nightCumulative[nightCumulative.length - 1] ?? 0;
  // Nhóm B (v6) — mốc dọc tối đa: làm tròn tổng phút thật lên bội số
  // 60, tối thiểu 60 (v5 là tối thiểu 120, nhãn chỉ hiện cách 120ph).
  const nightMaxTick = Math.max(60, Math.ceil(nightTotal / 60) * 60);
  // Cột cuối cùng có dữ liệu (để hiện nhãn tổng phút ngay trên cột đó).
  const nightLastIdx = (() => {
    let idx = -1;
    nightCumulative.forEach((v, i) => {
      if (v > 0) idx = i;
    });
    return idx;
  })();
  // Nhóm B (v3) — tab Tuần: đúng 7 ngày của tuần đã chọn (thứ Hai →
  // Chủ nhật), không còn 7 ngày gần nhất neo vào ngày xem. Tab Tháng:
  // đúng các ngày trong tháng đã chọn, không còn 30 ngày gần nhất.
  const weekDays = [];
  for (let i = 0; i < 7; i++) {
    const d = addDaysLocal(weekStart, i);
    const k = toKey(d);
    weekDays.push({
      key: k,
      label: wd[d.getDay()],
      hours: statsMap.get(k) ?? null,
    });
  }
  const monthDays = [];
  const daysInMonth = new Date(
    viewDate.getFullYear(),
    viewDate.getMonth() + 1,
    0,
  ).getDate();
  for (let d = 1; d <= daysInMonth; d++) {
    const date = new Date(viewDate.getFullYear(), viewDate.getMonth(), d);
    const k = toKey(date);
    monthDays.push({
      key: k,
      label: `${d}/${viewDate.getMonth() + 1}`,
      hours: statsMap.get(k) ?? null,
    });
  }
  const monthWithData = monthDays.filter((x) => x.hours !== null);
  // Giờ ngủ dùng cho 2 thẻ tóm tắt: giờ hôm nay (tab Ngày), trung bình/ngày
  // (tab Tuần/Tháng). Tab Ngày đang có phiên mở mà DB chưa ghi thì dùng số giờ
  // đã ngủ tới hiện tại (tính từ giờ bắt đầu thật của phiên).
  const periodRows =
    statsTab === 'day'
      ? viewHours !== null
        ? [{ hours: viewHours }]
        : []
      : statsTab === 'week'
        ? weekDays.filter((x) => x.hours !== null)
        : monthWithData;
  const periodAvgHours = periodRows.length
    ? periodRows.reduce((s, x) => s + Number(x.hours), 0) / periodRows.length
    : null;
  const elapsedHours = session
    ? Math.max(
        0,
        (Date.now() - new Date(session.startedAt).getTime()) / 3600000,
      )
    : null;
  const isViewingToday = viewKey === toKey(new Date());
  const summaryHours =
    periodAvgHours ??
    (statsTab === 'day' && isViewingToday ? elapsedHours : null);
  const goalHours = profile?.sleep_goal_hours ?? DEFAULT_SLEEP_GOAL_HOURS;
  const isDefaultGoal = profile?.sleep_goal_hours == null;
  const sleepRatio =
    summaryHours !== null && goalHours > 0
      ? Math.round((summaryHours / goalHours) * 100)
      : null;
  // Ngủ sâu ĐỌC TỪ DB (sleep_sessions.deep_sleep_minutes), không tự tính
  // trong code hiển thị. Nhóm B (v3): đã bỏ cách tính chu kỳ 90 phút khỏi
  // UI — giá trị trong DB do sleepSession.ts ghi lúc kết thúc phiên (nhóm
  // khác sở hữu hàm đó). Tab Ngày: tổng phút ngủ sâu của phiên dậy vào
  // ngày xem; tab Tuần/Tháng: trung bình/ngày có dữ liệu ngủ sâu (giống
  // cách tính summaryHours). Ngày/khoảng không có phiên nào lưu
  // deep_sleep_minutes thì deepSleepHours = null → UI hiện "Chưa có dữ liệu".
  const deepDays =
    statsTab === 'day'
      ? [viewKey]
      : statsTab === 'week'
        ? weekDays.map((x) => x.key)
        : monthDays.map((x) => x.key);
  const deepMinutesList = deepDays
    .map((k) => deepMap.get(k))
    .filter((v): v is number => typeof v === 'number');
  const deepTotalMin = deepMinutesList.length
    ? deepMinutesList.reduce((s, v) => s + v, 0)
    : null;
  const deepSleepHours =
    deepTotalMin === null
      ? null
      : statsTab === 'day'
        ? Math.round(deepTotalMin / 6) / 10
        : Math.round((deepTotalMin / deepMinutesList.length / 60) * 10) / 10;

  // Nhóm B (v3) — chọn tuần: "Tuần này"/"Tuần trước" đặt cả tuần và năm
  // theo tuần đó; đổi năm thì chọn tuần hiện tại nếu là năm nay, không thì
  // tuần đầu tiên của năm đó. (Đã bỏ gợi ý "giờ dậy tỉnh táo" khỏi UI.)
  const thisWeekMonday = startOfWeekMonday(new Date());
  const lastWeekMonday = addDaysLocal(thisWeekMonday, -7);
  const selectThisWeek = () => {
    setWeekStart(thisWeekMonday);
    setWeekYear(thisWeekMonday.getFullYear());
  };
  const selectLastWeek = () => {
    setWeekStart(lastWeekMonday);
    setWeekYear(lastWeekMonday.getFullYear());
  };
  const selectWeekYear = (y: number) => {
    setWeekYear(y);
    setWeekStart(
      y === new Date().getFullYear() ? thisWeekMonday : mondaysOfYear(y)[0],
    );
  };
  // Nhóm A (v4) — dropdown chọn tuần: "Tuần này", "Tuần trước" rồi các
  // tuần cụ thể trong năm đã chọn (giữ nguyên mondaysOfYear /
  // formatWeekLabel; tuần tràn sang năm sau ghi đúng ngày bắt đầu–kết
  // thúc, vd "29 tháng 12 – 4 tháng 1"). Trùng Monday thì giữ nhãn đầu
  // tiên ("Tuần này"/"Tuần trước" thắng) để value không trùng nhau.
  const weekOptions = (() => {
    const seen = new Set<string>();
    const list = [
      { value: toKey(thisWeekMonday), label: t('sleep.weekThis') },
      { value: toKey(lastWeekMonday), label: t('sleep.weekLast') },
      ...mondaysOfYear(weekYear).map((m) => ({
        value: toKey(m),
        label: formatWeekLabel(m, locale),
      })),
    ];
    return list.filter((o) => {
      if (seen.has(o.value)) return false;
      seen.add(o.value);
      return true;
    });
  })();
  const onSelectWeek = (key: string) => {
    if (key === toKey(thisWeekMonday)) {
      selectThisWeek();
      return;
    }
    if (key === toKey(lastWeekMonday)) {
      selectLastWeek();
      return;
    }
    const m = mondaysOfYear(weekYear).find((x) => toKey(x) === key);
    if (m) setWeekStart(m);
  };

  const startSleep = async () => {
    const s = await startSession(userId);
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
    if (finishingRef.current) return;
    finishingRef.current = true;
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
      await markWakeHandled();
      if (!result) {
        Alert.alert(t('sleep.notSavedTitle'), t('sleep.notSavedDesc'));
        return;
      }
      Alert.alert(
        t('sleep.savedSleepTitle'),
        t('sleep.savedSleepDesc', {
          dur: fmtDur(result.minutes),
          date: keyToDisplay(result.wakeKey),
        }),
      );
      loadAll();
    } catch (e: any) {
      Alert.alert(t('sleep.saveFailed'), e?.message || t('sleep.tryAgainLater'));
    } finally {
      setSaving(false);
      finishingRef.current = false;
    }
  };

  const snooze = async () => {
    if (session) {
      const next: SleepSession = {
        ...session,
        snoozeUntil: new Date(Date.now() + 10 * 60000).toISOString(),
        snoozeCount: session.snoozeCount + 1,
      };
      await saveSession(next, userId);
      setSession(next);
      try {
        await scheduleSnoozeNotification(
          t('sleep.alarmWakeTitle'),
          t('sleep.wakeUpNow'),
          10,
          null,
        );
      } catch {
        Alert.alert(
          t('sleep.snoozeNotifyFailedTitle'),
          t('sleep.snoozeNotifyFailedDesc'),
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
          ringingAlarm.label || t('sleep.alarm'),
          t('sleep.snoozeAfter', { mins }),
          mins,
          ringingAlarm.id,
        );
      } catch {
        Alert.alert(
          t('sleep.snoozeNotifyFailedTitle'),
          t('sleep.snoozeNotifyFailedDesc'),
        );
      }
      setAlarmVisible(false);
      setRingingAlarm(null);
      await stopAlarm();
    }
  };

  const dismissAlarm = async () => {
    await stopAlarm();
    if (!ringingAlarm) await markWakeHandled();
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
            <Text style={styles.alarmTitle}>{t('sleep.alarmTitle')}</Text>
            <Text style={styles.alarmTime}>{fmtHHMM(new Date())}</Text>
            <Text style={styles.alarmText}>
              {session
                ? t('sleep.sleptFor', { dur: fmtDur(elapsed) })
                : ringingAlarm
                  ? `${ringingAlarm.label} • ${ringingAlarm.time}`
                  : t('sleep.wakeTimeReached')}
            </Text>
            <TouchableOpacity style={styles.snoozeButton} onPress={snooze}>
              <Text style={styles.snoozeText}>
                {t('sleep.snoozeIn', { mins: snoozeMins })}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.wakeButton}
              onPress={() => (session ? finish('alarm') : dismissAlarm())}
              disabled={saving}
            >
              <Text style={styles.wakeText}>
                {saving ? t('sleep.saving') : t('home.wokeUp')}
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
          <Text style={styles.darkTitle}>{t('sleep.sleepMode')}</Text>
          <Text style={styles.darkText}>
            {t('sleep.startedAt', {
              time: fmtHHMM(new Date(session.startedAt)),
            })}
          </Text>
          <Text style={styles.darkText}>
            {t('sleep.slept', { dur: fmtDur(elapsed) })}
          </Text>
          {wakeAt ? (
            <Text style={styles.darkText}>
              {t('sleep.wakeExpected', {
                time: fmtHHMM(wakeAt),
                date: keyToDisplay(toKey(wakeAt)),
              })}
            </Text>
          ) : null}
          <View style={styles.darkRow}>
            <Text style={styles.darkText}>{t('sleep.rainSound')}</Text>
            <Switch value={noiseOn} onValueChange={toggleNoise} />
          </View>
          <TouchableOpacity
            style={styles.wakeButton}
            onPress={() => finish('manual')}
            disabled={saving}
          >
            <Text style={styles.wakeText}>
              {saving ? t('sleep.saving') : t('home.wokeUp')}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.darkGhost} onPress={exitSleepScreen}>
            <Text style={styles.darkGhostText}>
              {t('sleep.leaveSleepScreen')}
            </Text>
          </TouchableOpacity>
          <Text style={styles.darkNote}>{t('sleep.leaveNote')}</Text>
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
          <View style={{ paddingHorizontal: 16, paddingTop: 16 }}>
            <AppHeader
              title={t('sleep.title')}
              withTopInset={false}
            />
          </View>
          <ScrollView
            contentContainerStyle={[styles.scroll, { paddingBottom: 160 }]}
            keyboardShouldPersistTaps='handled'
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
            }
          >

            <View style={styles.banner}>
              <View
                style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}
              >
                <Ionicons name='moon-outline' size={14} color='#A8E6A1' />
                <Text style={styles.bannerTag}>
                  {t('sleep.restorativeTag')}
                </Text>
              </View>
              <Text style={styles.bannerLabel}>
                {t('sleep.avgDuration')}
              </Text>
              <Text style={styles.bannerNumber}>
                {avgMin !== null ? fmtDur(avgMin) : '--'}
              </Text>
              <Text style={styles.bannerText}>
                {avgMin === null
                  ? t('sleep.statsNoData')
                  : goal
                    ? avgMin >= goal * 60
                      ? t('sleep.statsWithGoalReached', {
                          n: withData.length,
                          goal,
                        })
                      : t('sleep.statsWithGoalMissing', {
                          n: withData.length,
                          goal,
                          dur: fmtDur(goal * 60 - avgMin),
                        })
                    : t('sleep.statsNoGoal', { n: withData.length })}
              </Text>
            </View>

            {/* Nhóm B (v2) — đã XÓA khối "Thống kê giấc ngủ (7 ngày)" ở đây:
                nó vẽ lại đúng dữ liệu 7 ngày của tab Tuần bên dưới. Chỉ giữ
                1 biểu đồ chính là thống kê theo kỳ Ngày/Tuần/Tháng. */}
            {/* Nhóm D — thống kê Ngày/Tuần/Tháng (vẽ bằng View, không thêm lib chart). */}
            <View style={styles.card}>
              <Text style={styles.cardTitle}>
                {t('sleep.statsTabTitle')}
              </Text>
              <View style={styles.segRow}>
                {(['day', 'week', 'month'] as StatsTab[]).map((tab) => (
                  <TouchableOpacity
                    key={tab}
                    style={[
                      styles.segBtn,
                      statsTab === tab && styles.segBtnActive,
                    ]}
                    onPress={() => setStatsTab(tab)}
                  >
                    <Text
                      style={[
                        styles.segBtnText,
                        statsTab === tab && styles.segBtnTextActive,
                      ]}
                    >
                      {tab === 'day'
                        ? t('sleep.statsTabDay')
                        : tab === 'week'
                          ? t('sleep.statsTabWeek')
                          : t('sleep.statsTabMonth')}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Nhóm B (v3) — mỗi tab có bộ chọn riêng: tab Ngày chọn ngày
                  bằng DateTimePicker (onValueChange, không dùng onChange đã
                  deprecated); tab Tuần chọn tuần (bắt đầu thứ Hai) + năm;
                  tab Tháng chọn tháng + năm bằng dropdown (Nhóm A v4),
                  KHÔNG còn DateTimePicker chọn ngày trong tab Tháng.
                  Chọn tháng/năm thì xem tới cuối tháng đó. */}
              {statsTab === 'day' ? (
                <>
                  <TouchableOpacity
                    style={styles.datePickBtn}
                    onPress={() => setShowDatePicker(true)}
                  >
                    <Ionicons
                      name='calendar-outline'
                      size={16}
                      color={PRIMARY}
                    />
                    <Text style={styles.datePickText}>
                      {t('sleep.viewDate')}: {keyToDisplay(viewKey)}
                    </Text>
                  </TouchableOpacity>
                  {showDatePicker ? (
                    <>
                      <DateTimePicker
                        value={viewDate}
                        mode='date'
                        display={
                          Platform.OS === 'ios' ? 'spinner' : 'calendar'
                        }
                        maximumDate={new Date()}
                        onValueChange={(_e, d) => {
                          if (d) {
                            setViewDate(d);
                            // Android: lịch là hộp thoại, chọn xong tự đóng.
                            // iOS: spinner hiện inline nên giữ lại để chọn
                            // tiếp, bấm "Đóng" bên dưới mới ẩn.
                            if (Platform.OS !== 'ios')
                              setShowDatePicker(false);
                          }
                        }}
                        onDismiss={() => setShowDatePicker(false)}
                      />
                      {Platform.OS === 'ios' ? (
                        <TouchableOpacity
                          style={styles.secondaryButton}
                          onPress={() => setShowDatePicker(false)}
                        >
                          <Text style={styles.secondaryButtonText}>
                            {t('common.close')}
                          </Text>
                        </TouchableOpacity>
                      ) : null}
                    </>
                  ) : null}
                </>
              ) : null}
              {statsTab === 'week' ? (
                <View style={styles.dropdownRow}>
                  <View style={styles.dropdownCol}>
                    <DropdownSelect
                      label={t('sleep.weekPickerTitle')}
                      value={toKey(weekStart)}
                      options={weekOptions}
                      onChange={onSelectWeek}
                      placeholder={t('sleep.weekPickerTitle')}
                    />
                  </View>
                  <View style={styles.dropdownCol}>
                    <DropdownSelect
                      label={t('sleep.yearSelectLabel')}
                      value={String(weekYear)}
                      options={WEEK_YEAR_OPTIONS.map((y) => ({
                        value: String(y),
                        label: String(y),
                      }))}
                      onChange={(v) => selectWeekYear(Number(v))}
                      placeholder={t('sleep.yearSelectLabel')}
                    />
                  </View>
                </View>
              ) : null}
              {statsTab === 'month' ? (
                <View style={styles.dropdownRow}>
                  <View style={styles.dropdownCol}>
                    <DropdownSelect
                      label={t('sleep.monthSelectLabel')}
                      value={String(viewDate.getMonth() + 1)}
                      options={Array.from({ length: 12 }, (_, i) => i + 1).map(
                        (m) => ({
                          value: String(m),
                          label: t(`sleep.monthName${m}`),
                        }),
                      )}
                      onChange={(v) =>
                        setViewDate(
                          new Date(viewDate.getFullYear(), Number(v), 0),
                        )
                      }
                      placeholder={t('sleep.monthSelectLabel')}
                    />
                  </View>
                  <View style={styles.dropdownCol}>
                    <DropdownSelect
                      label={t('sleep.yearSelectLabel')}
                      value={String(viewDate.getFullYear())}
                      options={WEEK_YEAR_OPTIONS.map((y) => ({
                        value: String(y),
                        label: String(y),
                      }))}
                      onChange={(v) =>
                        setViewDate(
                          new Date(Number(v), viewDate.getMonth() + 1, 0),
                        )
                      }
                      placeholder={t('sleep.yearSelectLabel')}
                    />
                  </View>
                </View>
              ) : null}

              {statsTab === 'day' ? (
                !dayHasData ? (
                  <Text style={styles.note}>{t('sleep.statsNoData')}</Text>
                ) : (
                  <>
                    {/* Nhóm B (v5) — biểu đồ ngày: cửa sổ đêm 22:00 →
                        10:00, cột = tổng phút ngủ tích lũy đến cuối giờ
                        đó, lưới solid nhạt, trục dọc phút 0/60/120/...
                        (v6: hiện nhãn ở MỌI mốc 60ph). */}
                    <Text style={styles.note}>
                      {t('sleep.statsDayCumulativeNote')}
                    </Text>
                    <View style={styles.dayChartWrap}>
                      <View style={styles.nightDayYAxis}>
                        {Array.from(
                          { length: nightMaxTick / 60 + 1 },
                          (_, i) => i * 60,
                        ).map((tick) => (
                            <Text
                              key={tick}
                              style={[
                                styles.nightDayYLabel,
                                {
                                  top: `${(1 - tick / nightMaxTick) * 100}%`,
                                  marginTop:
                                    tick === 0
                                      ? -14
                                      : tick === nightMaxTick
                                        ? 0
                                        : -7,
                                },
                              ]}
                            >
                              {tick === 0 ? '0' : `${tick}ph`}
                            </Text>
                          ))}
                      </View>
                      <View style={{ flex: 1 }}>
                        <View style={styles.nightDayPlot}>
                          {Array.from(
                            { length: nightMaxTick / 60 + 1 },
                            (_, i) => i * 60,
                          )
                            .filter((tick) => tick > 0)
                            .map((tick) => (
                              <View
                                key={tick}
                                style={[
                                  styles.nightGridH,
                                  {
                                    top: `${(1 - tick / nightMaxTick) * 100}%`,
                                  },
                                ]}
                              />
                            ))}
                          {Array.from(
                            { length: NIGHT_HOURS + 1 },
                            (_, i) => i,
                          ).map((i) => (
                            <View
                              key={i}
                              style={[
                                styles.nightGridV,
                                { left: `${(i / NIGHT_HOURS) * 100}%` },
                              ]}
                            />
                          ))}
                          <View style={styles.nightDayBars}>
                            {nightCumulative.map((cum, i) => (
                              <View key={i} style={styles.nightDayCol}>
                                {i === nightLastIdx ? (
                                  <Text style={styles.nightDayValue}>
                                    {`${nightTotal} phút`}
                                  </Text>
                                ) : null}
                                <View
                                  style={[
                                    styles.nightDayBar,
                                    {
                                      height:
                                        (cum / nightMaxTick) *
                                        NIGHT_DAY_CHART_H,
                                    },
                                  ]}
                                />
                              </View>
                            ))}
                          </View>
                        </View>
                        <View style={styles.nightDayXAxis}>
                          {[
                            { label: '22:00', pos: 0 },
                            { label: '00:00', pos: 2 },
                            { label: '02:00', pos: 4 },
                            { label: '04:00', pos: 6 },
                            { label: '06:00', pos: 8 },
                            { label: '08:00', pos: 10 },
                            { label: '10:00', pos: 12 },
                          ].map((x) => (
                            <Text
                              key={x.label}
                              style={[
                                styles.nightDayXLabel,
                                { left: `${(x.pos / NIGHT_HOURS) * 100}%` },
                              ]}
                            >
                              {x.label}
                            </Text>
                          ))}
                        </View>
                      </View>
                    </View>
                  </>
                )
              ) : statsTab === 'week' ? (
                weekDays.filter((x) => x.hours !== null).length === 0 ? (
                  <Text style={styles.note}>{t('sleep.statsNoData')}</Text>
                ) : (
                  // Nhóm B (v6) — biểu đồ tuần về lại cột dọc kiểu v4:
                  // cao = giờ ngủ/ngày (scale /12*140), nhãn giá trị là
                  // số giờ, nhãn trục ngang là thứ; bỏ trục giờ dọc
                  // bên phải + thanh trải theo giờ đi ngủ→dậy của v5.
                  <View style={styles.barArea}>
                    {weekDays.map((d) => (
                      <View key={d.key} style={styles.barCol}>
                        <View
                          style={[
                            styles.bar,
                            {
                              height:
                                d.hours !== null
                                  ? Math.min(
                                      (Number(d.hours) / 12) * 140,
                                      140,
                                    )
                                  : 0,
                            },
                          ]}
                        />
                        <Text style={styles.barValue}>
                          {d.hours !== null
                            ? Number(d.hours).toFixed(1)
                            : '--'}
                        </Text>
                        <Text style={styles.barLabel}>{d.label}</Text>
                      </View>
                    ))}
                  </View>
                )
              ) : monthLoading || viewLoading ? (
                <ActivityIndicator
                  size='small'
                  color={PRIMARY}
                  style={{ marginVertical: 24 }}
                />
              ) : monthWithData.length === 0 ? (
                <Text style={styles.note}>{t('sleep.statsNoData')}</Text>
              ) : (
                // Nhóm B (v6) — biểu đồ tháng về lại cột dọc kiểu v4
                // (như biểu đồ tuần, cột hẹp hơn; nhãn ngày cách
                // 5 ngày); bỏ trục giờ dọc + thanh theo giờ của v5.
                <View style={styles.barArea}>
                  {monthDays.map((d, idx) => (
                    <View key={d.key} style={styles.monthBarCol}>
                      <View
                        style={[
                          styles.monthBar,
                          {
                            height:
                              d.hours !== null
                                ? Math.min((Number(d.hours) / 12) * 140, 140)
                                : 0,
                          },
                        ]}
                      />
                      <Text style={styles.monthBarLabel}>
                        {idx % 5 === 0 ? d.label : ''}
                      </Text>
                    </View>
                  ))}
                </View>
              )}

              <View style={styles.statRow}>
                <View style={styles.statCard}>
                  <View style={styles.statLabelRow}>
                    <Ionicons
                      name='battery-half-outline'
                      size={16}
                      color={PRIMARY}
                    />
                    <Text style={styles.statLabel}>
                      {t('sleep.statsSleepRatioLabel')}
                    </Text>
                  </View>
                  <Text style={styles.statValue}>
                    {sleepRatio !== null ? `${sleepRatio}%` : '--'}
                  </Text>
                  <Text style={styles.statSub}>
                    {summaryHours !== null
                      ? t('sleep.statsRatioSub', {
                          hours: (Math.round(summaryHours * 10) / 10).toString(),
                          goal: goalHours,
                        })
                      : t('sleep.statsNoData')}
                  </Text>
                  {isDefaultGoal ? (
                    <Text style={styles.statSub}>
                      {t('sleep.statsDefaultGoalNote')}
                    </Text>
                  ) : null}
                </View>
                <View style={styles.statCard}>
                  <View style={styles.statLabelRow}>
                    <Ionicons
                      name='moon-outline'
                      size={16}
                      color={PRIMARY}
                    />
                    <Text style={styles.statLabel}>
                      {t('sleep.statsDeepSleepLabel')}
                    </Text>
                  </View>
                  <Text style={styles.statValue}>
                    {deepSleepHours !== null
                      ? `${deepSleepHours}h`
                      : t('sleep.statsNoData')}
                  </Text>
                </View>
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
                  {t('sleep.rainforest')}
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
              <Text style={styles.note}>{t('sleep.autoOff')}</Text>
            </View>

            {editingSchedule ? (
              <View style={styles.card}>
                <Text style={styles.cardTitle}>
                  {hasSchedule
                    ? t('sleep.editSchedule')
                    : t('sleep.setupSchedule')}
                </Text>
                <Text style={styles.label}>{t('sleep.bedtime')}</Text>
                <TouchableOpacity
                  style={[styles.input, { justifyContent: 'center' }]}
                  onPress={() => setScheduleTimePicker('bedtime')}
                >
                  <Text>{bedtimeInput}</Text>
                </TouchableOpacity>
                <Text style={styles.label}>{t('sleep.wakeTime')}</Text>
                <TouchableOpacity
                  style={[styles.input, { justifyContent: 'center' }]}
                  onPress={() => setScheduleTimePicker('wake')}
                >
                  <Text>{wakeInput}</Text>
                </TouchableOpacity>
                {scheduleTimePicker ? (
                  <>
                    <DateTimePicker
                      value={scheduleTimeToDate(
                        scheduleTimePicker === 'bedtime'
                          ? bedtimeInput
                          : wakeInput,
                        scheduleTimePicker === 'bedtime' ? '22:00' : '07:30',
                      )}
                      mode='time'
                      display='spinner'
                      is24Hour
                      onValueChange={(_e, d) => onScheduleTimePicked(d)}
                      onDismiss={() => setScheduleTimePicker(null)}
                    />
                    {Platform.OS === 'ios' ? (
                      <TouchableOpacity
                        style={styles.secondaryButton}
                        onPress={() => setScheduleTimePicker(null)}
                      >
                        <Text style={styles.secondaryButtonText}>
                          {t('common.close')}
                        </Text>
                      </TouchableOpacity>
                    ) : null}
                  </>
                ) : null}
                <Text style={styles.label}>{t('sleep.sleepGoal')}</Text>
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
                    {saving ? t('sleep.saving') : t('sleep.saveSchedule')}
                  </Text>
                </TouchableOpacity>
                {hasSchedule ? (
                  <TouchableOpacity
                    style={styles.secondaryButton}
                    onPress={cancelEditSchedule}
                  >
                    <Text style={styles.secondaryButtonText}>
                      {t('common.cancel')}
                    </Text>
                  </TouchableOpacity>
                ) : null}
              </View>
            ) : (
              <View style={styles.card}>
                <View style={styles.scheduleHeader}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.cardTitle}>
                      {t('sleep.scheduleTitle')}
                    </Text>
                    <Text style={styles.cardText}>
                      {t('sleep.scheduleSub')}
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
                      <Text style={styles.editPillText}>
                        {t('common.edit')}
                      </Text>
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
                      <Text style={styles.timeBoxLabel}>
                        {t('sleep.bedtimeUpper')}
                      </Text>
                    </View>
                    <Text style={styles.timeBoxTime}>
                      {profile?.bedtime_time
                        ? toTimeInput(profile.bedtime_time)
                        : '--:--'}
                    </Text>
                    <Text style={styles.timeBoxSub}>{t('sleep.bedtime')}</Text>
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
                      <Text style={styles.timeBoxLabel}>
                        {t('sleep.wakeTimeUpper')}
                      </Text>
                    </View>
                    <Text style={styles.timeBoxTime}>
                      {profile?.wake_time
                        ? toTimeInput(profile.wake_time)
                        : '--:--'}
                    </Text>
                    <Text style={styles.timeBoxSub}>{t('sleep.wakeTime')}</Text>
                  </View>
                </View>
                <Text style={[styles.cardText, { marginTop: 12 }]}>
                  {goal
                    ? t('sleep.goalLine', { goal })
                    : t('sleep.goalNotSet')}
                </Text>
              </View>
            )}

            {session && isWakeOverdue ? (
              <View style={styles.questionCard}>
                <Text style={styles.questionTitle}>
                  {t('home.wokeUpTitle')}
                </Text>
                <Text style={styles.cardText}>
                  {t('sleep.overdueDesc', {
                    time: bannerWakeAt ? ` ${fmtHHMM(bannerWakeAt)}` : '',
                  })}
                </Text>
                <Text style={styles.cardText}>
                  {t('sleep.wokeOrSleeping')}
                </Text>
                <View style={styles.sleepActionRow}>
                  <TouchableOpacity
                    style={[styles.sleepActionBtn, styles.greyBtn]}
                    onPress={snooze}
                  >
                    <Text style={styles.greyBtnText}>
                      {t('sleep.notYetSnooze')}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.saveButton, styles.sleepActionBtn]}
                    onPress={() => finish('alarm')}
                    disabled={saving}
                  >
                    <Text style={styles.saveButtonText}>
                      {saving ? t('sleep.saving') : t('sleep.wokeUpSave')}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : session ? (
              <View style={styles.questionCard}>
                <Text style={styles.questionTitle}>
                  {t('sleep.inSession')}
                </Text>
                <Text style={styles.cardText}>
                  {t('sleep.sessionStarted', {
                    time: fmtHHMM(new Date(session.startedAt)),
                    date: keyToDisplay(toKey(new Date(session.startedAt))),
                  })}
                </Text>
                <Text style={styles.cardText}>
                  {t('sleep.slept', { dur: fmtDur(elapsed) })}
                  {wakeAt
                    ? t('sleep.wakeExpectedSuffix', { time: fmtHHMM(wakeAt) })
                    : '.'}
                </Text>
                <View style={styles.sleepActionRow}>
                  <TouchableOpacity
                    style={[styles.sleepActionBtn, styles.greyBtn]}
                    onPress={enterSleepScreen}
                  >
                    <Text style={styles.greyBtnText}>
                      {t('sleep.enterSleepMode')}
                    </Text>
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
                      {saving ? t('sleep.saving') : t('sleep.wokeUpSave')}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              <TouchableOpacity style={styles.bigButton} onPress={startSleep}>
                <View style={styles.btnRow}>
                  <Ionicons name='moon-outline' size={18} color='#fff' />
                  <Text style={styles.bigButtonText}>
                    {t('sleep.startSleepMode')}
                  </Text>
                </View>
              </TouchableOpacity>
            )}

            <View style={styles.card}>
              <Text style={styles.cardTitle}>{t('sleep.alarm')}</Text>
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
                <Text style={styles.note}>{t('sleep.noAlarms')}</Text>
              )}
              {alarmFormVisible ? (
                <>
                  <Text style={[styles.cardTitle, { marginTop: 12 }]}>
                    {editingAlarmId
                      ? t('sleep.editAlarm')
                      : t('sleep.addAlarm')}
                  </Text>
                  <Text style={styles.label}>{t('sleep.alarmTime')}</Text>
                  <TextInput
                    style={styles.input}
                    value={alarmTimeInput}
                    onChangeText={setAlarmTimeInput}
                    placeholder='07:30'
                    keyboardType='numbers-and-punctuation'
                  />
                  <Text style={styles.label}>{t('sleep.label')}</Text>
                  <TextInput
                    style={styles.input}
                    value={alarmLabelInput}
                    onChangeText={setAlarmLabelInput}
                    placeholder={t('sleep.alarm')}
                  />
                  <Text style={styles.label}>
                    {t('sleep.repeatWeekdays')}
                  </Text>
                  <View style={styles.dayRow}>
                    {dayShort.map((label, d) => (
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
                    {t('sleep.repeatNote')}
                  </Text>
                  <Text style={styles.label}>
                    {t('sleep.snoozeDuration')}
                  </Text>
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
                      {editingAlarmId
                        ? t('sleep.saveChanges')
                        : t('sleep.saveAlarm')}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.secondaryButton}
                    onPress={() => {
                      setEditingAlarmId(null);
                      setAlarmFormVisible(false);
                    }}
                  >
                    <Text style={styles.secondaryButtonText}>
                      {t('common.cancel')}
                    </Text>
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

            {/* Nhóm B (v2/v3) — 3 bài viết về giấc ngủ, lấy từ DB thật qua
                getPostsByTopic('sleep', 3). Bấm vào mở ArticleDetail (cùng
                cách mở bài viết như màn Khám phá / Trang chủ). Chưa có bài
                trong DB thì hiện "Chưa có bài viết", không bịa nội dung.
                Nhóm B (v3): dời xuống CUỐI màn hình, sau mục Báo thức. */}
            <View style={styles.card}>
              <Text style={styles.cardTitle}>
                {t('sleep.articlesTitle')}
              </Text>
              {articlesLoading ? (
                <ActivityIndicator
                  size='small'
                  color={PRIMARY}
                  style={{ marginVertical: 12 }}
                />
              ) : sleepArticles.length === 0 ? (
                <Text style={styles.note}>{t('sleep.noArticles')}</Text>
              ) : (
                // Nhóm B (v4): chỉ thay UI render bài bằng ArticleCard
                // chuẩn dùng chung (có ảnh cover ở đầu thẻ). Vị trí
                // (cuối màn hình, sau Báo thức), dữ liệu
                // getPostsByTopic('sleep', 3) và mở ArticleDetail giữ nguyên.
                sleepArticles.map((a) => (
                  <ArticleCard
                    key={a.id}
                    post={a}
                    onOpen={() =>
                      navigation?.navigate('ArticleDetail', {
                        postId: a.id,
                      })
                    }
                  />
                ))
              )}
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

