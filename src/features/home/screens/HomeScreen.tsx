import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert,
  Modal,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from '@react-navigation/native';
import { useAuth } from '../../auth/AuthContext';
import { useSettings } from '../../../context/SettingsContext';
import { supabase } from '../../../lib/supabase';
import {
  formatNumber,
  formatSleep,
  getDaysToNextPeriodOnDate,
  getMetricByDate,
  getPost,
  getProfile,
  getWeekMetricsEndingOn,
  saveWater,
  type Metric,
  type Profile,
} from '../../../lib/auravitalApi';
import { getNutritionDay } from '../../../lib/nutritionApi';
import {
  HighlightCards,
  HomeArticles,
  TodayWorkoutCard,
  WeeklySummaryCard,
} from '../../../components/home/HomeSections';
import {
  getArticles,
  getWeeklySummary,
  getWorkouts,
  type Post,
  type WeeklySummary,
} from '../../../lib/workoutApi';
import { computeWakeAt } from '../../../lib/sleepSession';

const SESSION_KEY = '@auravital:sleep_session';
const MODE_KEY = '@auravital:sleep_mode';
const NOTIF_KEY = '@auravital:notifications';
const READ_ALL_KEY = '@auravital:notifications_read_all';

const pad = (n: number) => String(n).padStart(2, '0');
const toKey = (d: Date) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const addDays = (d: Date, n: number) => {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
};

function resolveGreetingName(profile: Profile, user: any): string {
  const fromProfile = profile.display_name?.trim() ?? '';
  if (fromProfile && !fromProfile.includes('@')) return fromProfile;
  const fromAuth = user?.name?.trim() ?? '';
  const emailPrefix = user?.email?.split('@')[0] ?? '';
  if (fromAuth && !fromAuth.includes('@') && fromAuth !== emailPrefix)
    return fromAuth;
  return 'Bạn';
}

function calcHealthScore(
  metric: Metric | null,
  profile: Profile,
  kcal: number,
): number | null {
  const parts: { ratio: number; weight: number }[] = [];
  if (metric?.steps != null && profile.step_goal) {
    parts.push({
      ratio: Math.min(1, Number(metric.steps) / Number(profile.step_goal)),
      weight: 40,
    });
  }
  if (metric?.sleep_hours != null && profile.sleep_goal_hours) {
    parts.push({
      ratio: Math.min(
        1,
        Number(metric.sleep_hours) / Number(profile.sleep_goal_hours),
      ),
      weight: 30,
    });
  }
  if (metric?.water_ml != null && profile.water_goal_ml) {
    parts.push({
      ratio: Math.min(
        1,
        Number(metric.water_ml) / Number(profile.water_goal_ml),
      ),
      weight: 20,
    });
  }
  if (kcal > 0 && profile.calorie_goal) {
    const goal = Number(profile.calorie_goal);
    parts.push({
      ratio: 1 - Math.min(1, Math.abs(kcal - goal) / goal),
      weight: 10,
    });
  }
  if (parts.length < 2) return null;
  const totalWeight = parts.reduce((s, pr) => s + pr.weight, 0);
  const weighted = parts.reduce((s, pr) => s + pr.ratio * pr.weight, 0);
  return Math.round((weighted / totalWeight) * 100);
}

type DetailRoute =
  'StepsDetail' | 'SleepTracker' | 'CycleTracking' | 'Nutrition';

export default function HomeScreen({ navigation }: any) {
  const { user } = useAuth();
  const { theme, isDark, t, locale } = useSettings();
  const s = makeStyles(theme, isDark);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [metric, setMetric] = useState<Metric | null>(null);
  const [week, setWeek] = useState({ steps: 0, water: 0, sleep: 0 });
  const [kcal, setKcal] = useState(0);
  const [cycleDays, setCycleDays] = useState<number | null>(null);
  const [workout, setWorkout] = useState<any>(null);
  const [article, setArticle] = useState<any>(null);
  const [featuredWorkout, setFeaturedWorkout] = useState<Post | null>(null);
  const [homeArticles, setHomeArticles] = useState<Post[]>([]);
  const [weeklySummary, setWeeklySummary] = useState<WeeklySummary | null>(
    null,
  );
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [wakePrompt, setWakePrompt] = useState<any>(null);
  const [bellDot, setBellDot] = useState(false);
  const [selected, setSelected] = useState(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  });
  const [calendarVisible, setCalendarVisible] = useState(false);
  const [calendarMonth, setCalendarMonth] = useState(
    () => new Date(new Date().getFullYear(), new Date().getMonth(), 1),
  );

  const firstLoad = useRef(true);
  const firstFocus = useRef(true);
  const touchX = useRef<number | null>(null);

  const tr = (key: string, vi: string, en: string) => {
    try {
      const v = t(key);
      if (v && v !== key) return v;
    } catch {}
    return locale === 'en' ? en : vi;
  };

  const userId = user?.id;
  const todayKey = toKey(new Date());
  const selectedKey = toKey(selected);
  const isToday = selectedKey === todayKey;
  const todayMidnight = new Date();
  todayMidnight.setHours(0, 0, 0, 0);
  const dateLocale = locale === 'en' ? 'en-US' : 'vi-VN';
  const selectedLabel = selected.toLocaleDateString(dateLocale, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  const load = useCallback(
    async (showLoading = true) => {
      if (!userId) {
        setLoading(false);
        setRefreshing(false);
        setBellDot(false);
        return;
      }
      if (showLoading) setLoading(true);
      const dateKey = selectedKey;
      const results = await Promise.allSettled([
        getProfile(userId),
        getMetricByDate(userId, dateKey),
        getWeekMetricsEndingOn(userId, dateKey),
        (async () => {
          const day: any = await getNutritionDay(userId, dateKey);
          return {
            kcal: day?.totalKcal ?? day?.kcal ?? 0,
          };
        })(),
        getDaysToNextPeriodOnDate(userId, dateKey),
        getPost('workout'),
        getPost('article'),
      ]);
      results.forEach((r, i) => {
        if (r.status === 'rejected')
          console.warn(`Home load [${i}] failed`, r.reason);
      });
      const value = (i: number, fallback: any) =>
        results[i].status === 'fulfilled'
          ? ((results[i] as any).value ?? fallback)
          : fallback;
      const loadedProfile = value(0, null);
      setProfile(loadedProfile);
      setMetric(value(1, null));
      setWeek(value(2, { steps: 0, water: 0, sleep: 0 }));
      setKcal(value(3, { kcal: 0 }).kcal ?? 0);
      setCycleDays(value(4, null));
      setWorkout(value(5, null));
      setArticle(value(6, null));
      if (dateKey === toKey(new Date())) {
        try {
          const raw = await AsyncStorage.getItem(SESSION_KEY);
          if (raw) {
            const session = JSON.parse(raw);
            const wakeAt = session.snoozeUntil
              ? new Date(session.snoozeUntil)
              : computeWakeAt(
                  session.startedAt,
                  typeof loadedProfile?.wake_time === 'string'
                    ? loadedProfile.wake_time
                    : null,
                );
            const isOverdue = wakeAt
              ? Date.now() >= wakeAt.getTime()
              : toKey(new Date(session.startedAt)) !== dateKey;
            setWakePrompt(isOverdue ? session : null);
          } else {
            setWakePrompt(null);
          }
        } catch {
          setWakePrompt(null);
        }
      } else {
        setWakePrompt(null);
      }
      try {
        const notifRaw = await AsyncStorage.getItem(NOTIF_KEY);
        const readAllAt = await AsyncStorage.getItem(READ_ALL_KEY);
        let on = false;
        if (notifRaw) {
          const n = JSON.parse(notifRaw);
          on = !!n.enabled && readAllAt !== todayKey;
        }
        setBellDot(on);
      } catch {
        setBellDot(false);
      }
      setLoading(false);
      setRefreshing(false);
    },
    [userId, selectedKey],
  );

  useEffect(() => {
    if (firstLoad.current) {
      firstLoad.current = false;
      load(true);
    } else {
      load(false);
    }
  }, [load]);

  useFocusEffect(
    useCallback(() => {
      if (firstFocus.current) {
        firstFocus.current = false;
        return;
      }
      load(false);
    }, [load]),
  );

  useEffect(() => {
    if (!userId || !profile) return;
    (async () => {
      const results = await Promise.allSettled([
        getWorkouts(),
        getArticles(3),
        getWeeklySummary(userId, selectedKey, profile.water_goal_ml ?? null),
      ]);
      if (results[0].status === 'fulfilled') {
        const list = (results[0] as any).value ?? [];
        setFeaturedWorkout(list[0] ?? null);
      }
      if (results[1].status === 'fulfilled') {
        setHomeArticles((results[1] as any).value ?? []);
      }
      if (results[2].status === 'fulfilled') {
        setWeeklySummary((results[2] as any).value ?? null);
      } else {
        console.warn('Home workout weekly failed', (results[2] as any).reason);
        setWeeklySummary(null);
      }
    })();
  }, [userId, profile, selectedKey]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    load(false);
  }, [load]);

  const changeDay = (delta: number) => {
    const next = addDays(selected, delta);
    if (next > todayMidnight) return;
    setSelected(next);
  };

  const selectDate = (d: Date) => {
    const day = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    setSelected(day > todayMidnight ? todayMidnight : day);
    setCalendarVisible(false);
  };

  const openCalendar = () => {
    setCalendarMonth(new Date(selected.getFullYear(), selected.getMonth(), 1));
    setCalendarVisible(true);
  };

  const onDateTouchStart = (e: any) => {
    touchX.current = e.nativeEvent.pageX;
  };
  const onDateTouchEnd = (e: any) => {
    if (touchX.current == null) return;
    const dx = e.nativeEvent.pageX - touchX.current;
    touchX.current = null;
    if (dx < -60) changeDay(1);
    else if (dx > 60) changeDay(-1);
  };

  const getRootNav = () => {
    let nav: any = navigation;
    while (nav?.getParent?.()) nav = nav.getParent();
    return nav || navigation;
  };
  const goDetail = (name: DetailRoute | null) => {
    if (!name) return;
    const target = getRootNav();
    if (typeof target?.navigate === 'function') target.navigate(name);
    else if (typeof navigation?.navigate === 'function')
      navigation.navigate(name);
  };
  const goProfileSetup = () => {
    const target = getRootNav();
    if (typeof target?.navigate === 'function') target.navigate('ProfileSetup');
    else if (typeof navigation?.navigate === 'function')
      navigation.navigate('ProfileSetup');
  };
  const goNotifications = () => {
    const target = getRootNav();
    if (typeof target?.navigate === 'function')
      target.navigate('Notifications');
    else if (typeof navigation?.navigate === 'function')
      navigation.navigate('Notifications');
  };
  const goExplore = () => {
    let target = navigation;
    while (target) {
      const routeNames = target.getState?.().routeNames;
      if (routeNames?.includes('ExploreTab')) {
        target.navigate('ExploreTab');
        return;
      }
      if (routeNames?.includes('Main')) {
        target.navigate('Main', { screen: 'ExploreTab' });
        return;
      }
      target = target.getParent?.();
    }

    Alert.alert('Không mở được mục Khám phá', 'Vui lòng thử lại sau.');
  };
  const goPlayer = (post: Post) => {
    const target = getRootNav();
    if (typeof target?.navigate === 'function')
      target.navigate('WorkoutPlayer', { postId: post.id });
    else if (typeof navigation?.navigate === 'function')
      navigation.navigate('WorkoutPlayer', { postId: post.id });
  };
  const goArticle = (post: Post) => {
    const target = getRootNav();
    if (typeof target?.navigate === 'function')
      target.navigate('ArticleDetail', { postId: post.id });
    else if (typeof navigation?.navigate === 'function')
      navigation.navigate('ArticleDetail', { postId: post.id });
  };
  const goWorkoutLog = () => {
    const target = getRootNav();
    if (typeof target?.navigate === 'function')
      target.navigate('WorkoutLog', {});
    else if (typeof navigation?.navigate === 'function')
      navigation.navigate('WorkoutLog', {});
  };

  const finishWakePrompt = async () => {
    if (!wakePrompt || !user) return;
    const ended = new Date();
    const minutes = Math.round(
      (ended.getTime() - new Date(wakePrompt.startedAt).getTime()) / 60000,
    );
    if (minutes <= 0 || minutes > 1440) {
      await AsyncStorage.removeItem(SESSION_KEY);
      await AsyncStorage.setItem(MODE_KEY, '0');
      setWakePrompt(null);
      return;
    }
    const hours = Math.round((minutes / 60) * 100) / 100;
    const { error } = await supabase
      .from('health_metrics')
      .upsert(
        { user_id: user.id, log_date: toKey(ended), sleep_hours: hours },
        { onConflict: 'user_id,log_date' },
      );
    if (error) {
      Alert.alert(tr('common.errorTitle', 'Lỗi', 'Error'), error.message);
      return;
    }
    await supabase.from('sleep_sessions').insert({
      user_id: user.id,
      started_at: wakePrompt.startedAt,
      ended_at: ended.toISOString(),
      duration_minutes: minutes,
      snooze_count: wakePrompt.snoozeCount ?? 0,
      source: 'next_day',
    });
    await AsyncStorage.removeItem(SESSION_KEY);
    await AsyncStorage.setItem(MODE_KEY, '0');
    setWakePrompt(null);
    load(false);
  };

  if (loading && !profile) {
    return (
      <SafeAreaProvider>
        <SafeAreaView style={s.center}>
          <Text style={{ color: theme.text }}>
            {tr(
              'home.loading',
              'Đang tải dữ liệu từ database...',
              'Loading data from the database...',
            )}
          </Text>
        </SafeAreaView>
      </SafeAreaProvider>
    );
  }
  if (!user) {
    return (
      <SafeAreaProvider>
        <SafeAreaView style={s.center}>
          <Text style={{ color: theme.text }}>
            {tr('home.notLoggedIn', 'Chưa đăng nhập.', 'Not signed in.')}
          </Text>
        </SafeAreaView>
      </SafeAreaProvider>
    );
  }
  if (!profile) {
    return (
      <SafeAreaProvider>
        <SafeAreaView style={s.center}>
          <Text style={s.centerTitle}>
            {tr('home.noProfile', 'Chưa có hồ sơ', 'No profile yet')}
          </Text>
          <Text style={s.muted}>
            {tr(
              'home.noProfileDesc',
              'Tài khoản này chưa có dòng trong bảng profiles.',
              'This account has no row in the profiles table.',
            )}
          </Text>
          <TouchableOpacity style={s.primaryBtn} onPress={goProfileSetup}>
            <Text style={s.primaryBtnText}>
              {tr(
                'home.setupProfile',
                'Thiết lập hồ sơ ngay',
                'Set up your profile now',
              )}
            </Text>
          </TouchableOpacity>
        </SafeAreaView>
      </SafeAreaProvider>
    );
  }

  const hour = new Date().getHours();
  const greetingWord =
    hour < 11
      ? tr('home.morning', 'Chào buổi sáng', 'Good morning')
      : hour < 18
        ? tr('home.afternoon', 'Chào buổi chiều', 'Good afternoon')
        : tr('home.evening', 'Chào buổi tối', 'Good evening');
  const greetingName = resolveGreetingName(profile, user);
  const score = calcHealthScore(metric, profile, kcal);
  const water = metric?.water_ml ?? 0;
  const waterGoal = profile.water_goal_ml ?? 0;
  const filled = Math.floor(water / 250);
  const cupCount =
    waterGoal > 0
      ? Math.max(1, Math.ceil(waterGoal / 250))
      : Math.max(1, filled + 1);

  const onGlassPress = async (index: number) => {
    if (!user || !isToday) return;
    const next =
      index < filled ? index * 250 : index === filled ? water + 250 : water;
    if (next === water || next < 0 || next > 10000) return;
    try {
      await saveWater(user.id, next);
      setMetric((prev) =>
        prev ? { ...prev, water_ml: next } : ({ water_ml: next } as Metric),
      );
    } catch (e: any) {
      Alert.alert(
        tr(
          'home.waterSaveFailed',
          'Không lưu được lượng nước',
          'Could not save water intake',
        ),
        e.message,
      );
    }
  };

  const featuredPost: Post | null =
    featuredWorkout ?? (workout ? (workout as Post) : null);
  const articlesForHome: Post[] =
    homeArticles.length > 0 ? homeArticles : article ? [article as Post] : [];
  const weeklyForCard: WeeklySummary | null = weeklySummary ?? {
    stepsTotal: week.steps,
    stepsPrevTotal: 0,
    stepsChangePct: null,
    workoutMinutes: 0,
    workoutSessions: 0,
    workoutKcal: 0,
    waterTotalMl: week.water,
    waterAvgPctOfGoal:
      waterGoal > 0 ? Math.round((week.water / 7 / waterGoal) * 100) : null,
    sleepTotalHours: week.sleep,
    sleepAvgHours: Math.round((week.sleep / 7) * 10) / 10,
  };

  const calYear = calendarMonth.getFullYear();
  const calMonth = calendarMonth.getMonth();
  const calDays = new Date(calYear, calMonth + 1, 0).getDate();
  const calOffset = (new Date(calYear, calMonth, 1).getDay() + 6) % 7;
  const calCells: (number | null)[] = [
    ...Array(calOffset).fill(null),
    ...Array.from({ length: calDays }, (_, i) => i + 1),
  ];
  const weekdayLabels =
    locale === 'en'
      ? ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su']
      : ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];
  const monthLabel = calendarMonth.toLocaleDateString(dateLocale, {
    month: 'long',
    year: 'numeric',
  });

  return (
    <SafeAreaProvider>
      <SafeAreaView style={s.safe}>
        <ScrollView
          style={s.wrap}
          contentContainerStyle={{ paddingBottom: 24 }}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
        >
          <View style={s.topBar}>
            <View style={{ flex: 1 }}>
              <Text style={s.logo}>AuraVital</Text>
              <Text style={s.hello}>
                {greetingWord}, {greetingName}
              </Text>
              {greetingName === 'Bạn' && (
                <Text style={s.muted}>
                  {tr(
                    'home.profileNameMissing',
                    'Hồ sơ chưa có họ tên đầy đủ, vào tab Tài khoản để cập nhật.',
                    'Your profile has no full name yet. Update it in the Account tab.',
                  )}
                </Text>
              )}
            </View>
            <TouchableOpacity onPress={goNotifications} style={s.bellBtn}>
              <Ionicons
                name='notifications-outline'
                size={26}
                color='#3D4A41'
              />
              {bellDot && <View style={s.bellDot} />}
            </TouchableOpacity>
          </View>

          <View
            style={s.dateNav}
            onTouchStart={onDateTouchStart}
            onTouchEnd={onDateTouchEnd}
          >
            <TouchableOpacity
              style={s.dateNavBtn}
              onPress={() => changeDay(-1)}
            >
              <Text style={s.dateNavBtnText}>‹</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.dateNavCenter} onPress={openCalendar}>
              <Text style={s.dateLabel}>{selectedLabel}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={s.dateNavBtn}
              onPress={() => changeDay(1)}
              disabled={isToday}
            >
              <Text style={[s.dateNavBtnText, isToday && s.disabledText]}>
                ›
              </Text>
            </TouchableOpacity>
          </View>
          {!isToday && (
            <>
              <Text style={s.viewingPast}>
                {tr(
                  'home.viewingPast',
                  'Đang xem lại ngày cũ',
                  'Viewing a past date',
                )}
              </Text>
              <TouchableOpacity
                style={s.todayChip}
                onPress={() => selectDate(new Date())}
              >
                <Text style={s.todayChipText}>
                  {tr('home.backToToday', 'Về hôm nay', 'Back to today')}
                </Text>
              </TouchableOpacity>
            </>
          )}

          {wakePrompt ? (
            <View style={s.wakeCard}>
              <Text style={s.cardTitle}>
                {tr('home.wokeUpTitle', 'Bạn đã dậy chưa?', 'Are you awake?')}
              </Text>
              <Text style={s.muted}>
                {tr(
                  'home.wokeUpDesc',
                  'Đã đến giờ thức dậy nhưng phiên ngủ chưa được xác nhận. Bấm Đã dậy để tắt chế độ ngủ và lưu giấc ngủ.',
                  'It is past your wake-up time, but this sleep session is still unconfirmed. Tap Woke up to end sleep mode and save it.',
                )}
              </Text>
              <TouchableOpacity style={s.primaryBtn} onPress={finishWakePrompt}>
                <Text style={s.primaryBtnText}>
                  {tr('home.wokeUp', 'Đã dậy', 'Woke up')}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={s.ghostBtn}
                onPress={() => setWakePrompt(null)}
              >
                <Text style={s.ghostBtnText}>
                  {tr('home.stillSleeping', 'Vẫn đang ngủ', 'Still sleeping')}
                </Text>
              </TouchableOpacity>
            </View>
          ) : null}

          <View style={s.hero}>
            <View style={s.scoreCircle}>
              <Text style={s.score}>{score == null ? '--' : score}</Text>
              <Text style={s.scoreLabel}>
                {score == null
                  ? tr('home.notEnough', 'CHƯA ĐỦ DỮ LIỆU', 'NOT ENOUGH DATA')
                  : tr('home.healthScore', 'ĐIỂM SỨC KHỎE', 'HEALTH SCORE')}
              </Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.heroTitle}>
                🌿 {tr('home.healthScore', 'Điểm số Sức khỏe', 'Health Score')}
              </Text>
              {score == null ? (
                <Text style={s.heroText}>
                  {tr(
                    'home.notEnoughDesc',
                    'Chưa đủ dữ liệu ngày này để tính điểm. Cần có ít nhất 2 trong các chỉ số: bước chân, giấc ngủ, nước và năng lượng trong ngày đó.',
                    'Not enough data on this date to calculate a score. At least 2 of steps, sleep, water and energy are needed for that date.',
                  )}
                </Text>
              ) : (
                <Text style={s.heroText}>
                  {tr(
                    'home.scoreDesc',
                    'Dựa trên phân tích nhịp sinh học tổng thể, điểm sức khỏe của bạn là',
                    'Based on your overall biorhythm analysis, your health score is',
                  )}{' '}
                  {score}.
                </Text>
              )}
            </View>
          </View>

          <View style={s.card}>
            <View style={s.rowBetween}>
              <Text style={s.cardTitle}>
                💧 {tr('home.waterTitle', 'Lượng nước đã uống', 'Water drunk')}
              </Text>
              <Text style={s.waterValue}>
                {formatNumber(water)}
                <Text style={s.muted}>
                  {waterGoal > 0 ? `/${formatNumber(waterGoal)} ml` : ' ml'}
                </Text>
              </Text>
            </View>
            <View style={s.glasses}>
              {Array.from({ length: cupCount }).map((_, i) => (
                <TouchableOpacity
                  key={i}
                  disabled={!isToday}
                  style={[
                    s.glass,
                    i < filled && s.glassFilled,
                    i === filled && isToday && s.glassNext,
                  ]}
                  onPress={() => onGlassPress(i)}
                >
                  <Ionicons
                    name={
                      i < filled
                        ? 'water'
                        : i === filled && isToday
                          ? 'add'
                          : 'water-outline'
                    }
                    size={20}
                    color={
                      i < filled
                        ? '#fff'
                        : i === filled && isToday
                          ? '#2196F3'
                          : '#90CAF9'
                    }
                  />
                </TouchableOpacity>
              ))}
            </View>
            {!isToday && (
              <Text style={s.muted}>
                {tr(
                  'home.readOnly',
                  'Chỉ xem lại, không sửa được nước của ngày cũ.',
                  'Read-only. Water from a past date cannot be edited.',
                )}
              </Text>
            )}
          </View>

          {/* MỚI 1/4 — Chỉ số nổi bật: thay toàn bộ lưới emoji cũ. */}
          <HighlightCards
            steps={metric?.steps == null ? null : Number(metric.steps)}
            stepGoal={
              profile.step_goal == null ? null : Number(profile.step_goal)
            }
            daysToPeriod={cycleDays}
            cyclePhaseLabel={null}
            sleepHours={
              metric?.sleep_hours == null ? null : Number(metric.sleep_hours)
            }
            sleepGoalHours={
              profile.sleep_goal_hours == null
                ? null
                : Number(profile.sleep_goal_hours)
            }
            kcal={Math.round(kcal)}
            calorieGoal={
              profile.calorie_goal == null ? null : Number(profile.calorie_goal)
            }
            onSteps={() => goDetail('StepsDetail')}
            onCycle={() => goDetail('CycleTracking')}
            onSleep={() => goDetail('SleepTracker')}
            onNutrition={() => goDetail('Nutrition')}
          />

          {/* MỚI 2/4 — Đề xuất bài tập: thay banner + Alert cũ. */}
          <TodayWorkoutCard
            post={featuredPost}
            onPress={goPlayer}
            onSeeAll={goExplore}
          />

          {/* MỚI 3/4 — Tổng kết tuần: thay lưới cũ (kể cả dòng
              "Chưa có bảng log tập luyện trong v5" đã bỏ). */}
          <WeeklySummaryCard
            summary={weeklyForCard}
            onPressWorkout={goWorkoutLog}
          />

          {/* MỚI 4/4 — Kiến thức dinh dưỡng: thay 1 bài + Alert cũ. */}
          <HomeArticles
            articles={articlesForHome}
            onPressArticle={goArticle}
            onSeeAll={goExplore}
          />
        </ScrollView>

        <Modal
          visible={calendarVisible}
          transparent
          animationType='fade'
          onRequestClose={() => setCalendarVisible(false)}
        >
          <View style={s.modalOverlay}>
            <View style={s.modalCard}>
              <View style={s.calHeader}>
                <TouchableOpacity
                  onPress={() =>
                    setCalendarMonth(new Date(calYear, calMonth - 1, 1))
                  }
                >
                  <Text style={s.calArrow}>‹</Text>
                </TouchableOpacity>
                <Text style={s.calMonthLabel}>{monthLabel}</Text>
                <TouchableOpacity
                  onPress={() =>
                    setCalendarMonth(new Date(calYear, calMonth + 1, 1))
                  }
                >
                  <Text style={s.calArrow}>›</Text>
                </TouchableOpacity>
              </View>
              <View style={s.calHeader}>
                <TouchableOpacity
                  onPress={() =>
                    setCalendarMonth(new Date(calYear - 1, calMonth, 1))
                  }
                >
                  <Text style={s.calArrow}>‹</Text>
                </TouchableOpacity>
                <Text style={s.calMonthLabel}>
                  {locale === 'en' ? `Year ${calYear}` : `Năm ${calYear}`}
                </Text>
                <TouchableOpacity
                  onPress={() =>
                    setCalendarMonth(new Date(calYear + 1, calMonth, 1))
                  }
                >
                  <Text style={s.calArrow}>›</Text>
                </TouchableOpacity>
              </View>
              <View style={s.calWeekRow}>
                {weekdayLabels.map((w) => (
                  <Text key={w} style={s.calWeekText}>
                    {w}
                  </Text>
                ))}
              </View>
              <View style={s.calGrid}>
                {calCells.map((day, idx) => {
                  if (day === null)
                    return <View key={`empty-${idx}`} style={s.calCell} />;
                  const cellDate = new Date(calYear, calMonth, day);
                  const isFuture = cellDate > todayMidnight;
                  const isSelectedCell = toKey(cellDate) === selectedKey;
                  const isTodayCell = toKey(cellDate) === todayKey;
                  return (
                    <TouchableOpacity
                      key={day}
                      disabled={isFuture}
                      onPress={() => selectDate(cellDate)}
                      style={[
                        s.calCell,
                        isSelectedCell && s.calCellSelected,
                        isTodayCell && !isSelectedCell && s.calCellToday,
                      ]}
                    >
                      <Text
                        style={[
                          s.calCellText,
                          isSelectedCell && s.calCellTextSelected,
                          isFuture && s.calCellTextDisabled,
                        ]}
                      >
                        {day}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
              <TouchableOpacity
                style={s.primaryBtn}
                onPress={() => setCalendarVisible(false)}
              >
                <Text style={s.primaryBtnText}>
                  {tr('common.close', 'Đóng', 'Close')}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

function makeStyles(theme: any, isDark: boolean) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: theme.background },
    wrap: { flex: 1, backgroundColor: theme.background, padding: 16 },
    center: {
      flex: 1,
      backgroundColor: theme.background,
      alignItems: 'center',
      justifyContent: 'center',
      padding: 24,
    },
    centerTitle: { fontSize: 18, fontWeight: '800', color: theme.text },
    muted: { fontSize: 12, color: theme.muted, marginTop: 4, lineHeight: 17 },
    primaryBtn: {
      backgroundColor: theme.primaryDark,
      borderRadius: 999,
      padding: 14,
      marginTop: 16,
      alignItems: 'center',
    },
    primaryBtnText: { color: '#fff', fontWeight: '800' },
    ghostBtn: { alignItems: 'center', paddingVertical: 10, marginTop: 4 },
    ghostBtnText: { color: theme.text, fontWeight: '700' },
    topBar: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
    },
    refreshText: { color: theme.primaryDark, fontWeight: '700' },
    bellBtn: { position: 'relative', padding: 6 },
    bellDot: {
      position: 'absolute',
      top: 4,
      right: 4,
      width: 10,
      height: 10,
      borderRadius: 5,
      backgroundColor: theme.primaryDark,
    },
    logo: { fontSize: 18, fontWeight: '800', color: theme.primaryDark },
    hello: { fontSize: 20, fontWeight: '800', color: theme.text, marginTop: 2 },
    dateNav: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme.card,
      borderRadius: 20,
      paddingVertical: 12,
      paddingHorizontal: 8,
      marginTop: 16,
    },
    dateNavBtn: { paddingHorizontal: 12, paddingVertical: 6 },
    dateNavBtnText: {
      fontSize: 28,
      color: theme.primaryDark,
      fontWeight: '800',
    },
    dateNavCenter: { flex: 1, alignItems: 'center' },
    dateLabel: {
      fontSize: 15,
      fontWeight: '800',
      color: theme.text,
      textAlign: 'center',
      textTransform: 'capitalize',
    },
    swipeHint: {
      fontSize: 11,
      color: theme.muted,
      marginTop: 4,
      textAlign: 'center',
    },
    disabledText: { color: theme.muted },
    viewingPast: {
      textAlign: 'center',
      color: theme.muted,
      fontSize: 12,
      marginTop: 10,
    },
    todayChip: {
      alignSelf: 'center',
      backgroundColor: theme.cardAlt,
      borderRadius: 999,
      paddingHorizontal: 16,
      paddingVertical: 8,
      marginTop: 8,
    },
    todayChipText: {
      color: theme.primaryDark,
      fontWeight: '800',
      fontSize: 13,
    },
    wakeCard: {
      backgroundColor: '#FFF8E1',
      borderRadius: 20,
      padding: 16,
      marginTop: 16,
      borderWidth: 1,
      borderColor: '#F2C94C',
    },
    hero: {
      flexDirection: 'row',
      backgroundColor: theme.card,
      borderRadius: 20,
      padding: 16,
      marginTop: 16,
      gap: 14,
    },
    scoreCircle: {
      width: 72,
      height: 72,
      borderRadius: 36,
      borderWidth: 4,
      borderColor: '#A5D6A7',
      alignItems: 'center',
      justifyContent: 'center',
    },
    score: { fontSize: 24, fontWeight: '800', color: theme.primaryDark },
    scoreLabel: {
      fontSize: 9,
      fontWeight: '700',
      color: theme.muted,
      textAlign: 'center',
    },
    heroTitle: { fontSize: 16, fontWeight: '800', color: theme.text },
    heroText: { color: theme.muted, lineHeight: 20, marginTop: 6 },
    card: {
      backgroundColor: theme.card,
      borderRadius: 20,
      padding: 16,
      marginTop: 16,
    },
    rowBetween: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginTop: 20,
    },
    cardTitle: { fontSize: 14, fontWeight: '700', color: theme.text, flex: 1 },
    waterValue: { fontSize: 18, fontWeight: '800', color: '#1976D2' },
    glasses: { flexDirection: 'row', gap: 8, marginVertical: 12 },
    glass: {
      flex: 1,
      height: 46,
      borderRadius: 23,
      backgroundColor: theme.cardAlt,
      alignItems: 'center',
      justifyContent: 'center',
    },
    glassFilled: { backgroundColor: '#2196F3' },
    glassNext: {
      backgroundColor: '#E3F2FD',
      borderWidth: 1.5,
      borderColor: '#2196F3',
      borderStyle: 'dashed',
    },
    sectionTitle: { fontSize: 16, fontWeight: '800', color: theme.text },
    grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 12 },
    miniCard: {
      width: '47%',
      backgroundColor: theme.card,
      borderRadius: 18,
      padding: 14,
    },
    miniIcon: { fontSize: 20 },
    miniSub: { fontSize: 11, color: theme.muted, marginTop: 6 },
    miniValue: {
      fontSize: 20,
      fontWeight: '800',
      color: theme.text,
      marginTop: 6,
    },
    miniLabel: { fontSize: 13, color: theme.muted, marginTop: 2 },
    banner: {
      backgroundColor: '#2E7D32',
      borderRadius: 20,
      padding: 16,
      marginTop: 12,
    },
    bannerTag: { color: '#C8E6C9', fontSize: 11, fontWeight: '800' },
    bannerTitle: {
      color: '#fff',
      fontSize: 17,
      fontWeight: '800',
      marginTop: 8,
    },
    bannerSub: { color: '#E8F5E9', marginTop: 4 },
    article: {
      flexDirection: 'row',
      backgroundColor: theme.card,
      borderRadius: 18,
      padding: 12,
      marginTop: 12,
      gap: 12,
    },
    articleThumb: { fontSize: 40 },
    articleTag: { fontSize: 11, fontWeight: '800', color: theme.primaryDark },
    articleTitle: {
      fontSize: 15,
      fontWeight: '700',
      color: theme.text,
      marginVertical: 4,
    },
    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.45)',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 20,
    },
    modalCard: {
      backgroundColor: theme.card,
      borderRadius: 24,
      padding: 16,
      width: '100%',
    },
    calHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 8,
    },
    calArrow: {
      fontSize: 26,
      color: theme.primaryDark,
      fontWeight: '800',
      paddingHorizontal: 10,
    },
    calMonthLabel: {
      fontSize: 15,
      fontWeight: '800',
      color: theme.text,
      textTransform: 'capitalize',
    },
    calWeekRow: { flexDirection: 'row', marginTop: 6, marginBottom: 4 },
    calWeekText: {
      width: '14.28%',
      textAlign: 'center',
      fontSize: 12,
      fontWeight: '700',
      color: theme.muted,
    },
    calGrid: { flexDirection: 'row', flexWrap: 'wrap' },
    calCell: {
      width: '14.28%',
      height: 40,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 20,
    },
    calCellSelected: { backgroundColor: theme.primaryDark },
    calCellToday: { borderWidth: 1, borderColor: theme.primaryDark },
    calCellText: { color: theme.text, fontWeight: '600' },
    calCellTextSelected: { color: '#fff', fontWeight: '800' },
    calCellTextDisabled: { color: theme.muted },
  });
}
