import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert,
  RefreshControl,
  ScrollView,
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
import { getReceivedRequests } from '../../../lib/familyApi';
import { syncReminderNotifications } from '../../../lib/reminders';
import {
  appendHistory,
  countUnreadHistory,
} from '../../../lib/notificationHistory';
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
import { calcHealthScore } from '../../../lib/healthCalc';
import { addDays, toKey } from '../../../utils/dates';
import { resolveGreetingName } from '../utils/homeUtils';
import { makeStyles } from './HomeScreen.styles';
import { HomeBannerCarousel } from '../components/HomeBannerCarousel';
import { HealthScoreHero } from '../components/HealthScoreHero';
import { WaterCard } from '../components/WaterCard';
import { DateNavigator } from '../components/DateNavigator';
import { WakePromptCard } from '../components/WakePromptCard';
import { CalendarModal } from '../components/CalendarModal';

const SESSION_KEY = '@auravital:sleep_session';
const MODE_KEY = '@auravital:sleep_mode';
const READ_KEY = '@auravital:notifications_read';

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
  const [bannerIndex, setBannerIndex] = useState(0);
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

  // 3 ảnh banner Trang chủ (lướt ngang).
  const homeBanners = [
    {
      uri: 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?auto=format&fit=crop&w=1200&q=80',
      title: tr('home.bannerTitle', 'Sống khỏe mỗi ngày cùng AuraVital', 'Live healthy every day with AuraVital'),
      sub: tr('home.bannerSub', 'Ăn đủ chất, ngủ đủ giấc, vận động đều đặn.', 'Eat well, sleep well, move every day.'),
    },
    {
      uri: 'https://images.unsplash.com/photo-1493770348161-369560ae357d?auto=format&fit=crop&w=1200&q=80',
      title: tr('home.bannerTitle2', 'Bữa sáng đủ chất, ngày mới năng lượng', 'A nutritious breakfast, an energetic day'),
      sub: tr('home.bannerSub2', 'Bắt đầu ngày mới bằng một bữa ăn cân bằng.', 'Start your day with a balanced meal.'),
    },
    {
      uri: 'https://images.unsplash.com/photo-1575052814086-f385e2e2ad1b?auto=format&fit=crop&w=1200&q=80',
      title: tr('home.bannerTitle3', 'Vận động nhẹ nhàng, cơ thể dẻo dai', 'Gentle movement for a flexible body'),
      sub: tr('home.bannerSub3', 'Dành vài phút mỗi ngày để giãn cơ và thở sâu.', 'Take a few minutes each day to stretch and breathe deeply.'),
    },
  ];

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
      // Cột mốc: lần đầu trong ngày thấy bước chân đạt mục tiêu thì
      // ghi 1 dòng lịch sử (dedupeKey theo ngày nên load lại cũng
      // không ghi thêm). Chỉ xét ngày hôm nay, không xét ngày cũ.
      if (dateKey === toKey(new Date())) {
        try {
          const m: any = value(1, null);
          const steps = m?.steps != null ? Number(m.steps) : null;
          const goal =
            loadedProfile?.step_goal != null
              ? Number(loadedProfile.step_goal)
              : null;
          if (steps != null && goal != null && steps >= goal) {
            await appendHistory({
              kind: 'milestone',
              category: 'CỘT MỐC SỨC SỐNG',
              title: 'Chúc mừng mục tiêu vận động!',
              body: `Bạn đã đạt ${steps} bước hôm nay, vượt mục tiêu ${goal} bước.`,
              icon: '🏆',
              iconBg: '#FFF3E0',
              firedAt: Date.now(),
              dedupeKey: `milestone-steps-${dateKey}`,
            });
          }
        } catch {}
      }
      // Chấm chuông (bản làm lại 2/11/2026): hiện khi còn lịch sử
      // chưa đọc HOẶC còn lời mời chưa xử lý. Không còn gắn với nút
      // "Đã đọc tất cả" theo ngày nữa: bấm nút đó chỉ đánh dấu đã đọc
      // các dòng hiện có, thông báo mới tới vẫn hiện chấm lại.
      // Tính lại mỗi lần load trang chủ (kể cả khi quay về từ màn khác).
      try {
        const unreadHistory = await countUnreadHistory();
        let unreadInvite = false;
        try {
          const readRaw = await AsyncStorage.getItem(READ_KEY);
          const readIds: string[] = readRaw ? JSON.parse(readRaw) : [];
          const received = await getReceivedRequests();
          unreadInvite = received.some(
            (r) => !readIds.includes(`invite:${r.id}`),
          );
        } catch {}
        setBellDot(unreadHistory > 0 || unreadInvite);
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
      void load(true);
    } else {
      void load(false);
    }
  }, [load]);

  useFocusEffect(
    useCallback(() => {
      if (firstFocus.current) {
        firstFocus.current = false;
        return;
      }
      void load(false);
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
    void load(false);
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
    void load(false);
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

  let greetingWord = '';
  if (hour < 11) {
    greetingWord = tr('home.morning', 'Chào buổi sáng', 'Good morning');
  } else if (hour < 13) {
    greetingWord = tr('home.noon', 'Chào buổi trưa', 'Good afternoon'); 
  } else if (hour < 18) {
    greetingWord = tr('home.afternoon', 'Chào buổi chiều', 'Good afternoon');
  } else {
    greetingWord = tr('home.evening', 'Chào buổi tối', 'Good evening');
  }

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
      // Ghi nước xong thì đồng bộ lại nhắc: nếu vừa đủ mục tiêu thì
      // hủy hết nhắc nước còn lại trong ngày.
      syncReminderNotifications().catch(() => {});
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

          {/* Banner lướt ngang */}
          <HomeBannerCarousel
            banners={homeBanners}
            bannerIndex={bannerIndex}
            onIndexChange={setBannerIndex}
            theme={theme}
          />

          <DateNavigator
            selectedLabel={selectedLabel}
            isToday={isToday}
            onPrev={() => changeDay(-1)}
            onNext={() => changeDay(1)}
            onOpenCalendar={openCalendar}
            onBackToToday={() => selectDate(new Date())}
            onTouchStart={onDateTouchStart}
            onTouchEnd={onDateTouchEnd}
            viewingPastText={tr(
              'home.viewingPast',
              'Đang xem lại ngày cũ',
              'Viewing a past date',
            )}
            backToTodayText={tr(
              'home.backToToday',
              'Về hôm nay',
              'Back to today',
            )}
            s={s}
          />

          {wakePrompt ? (
            <WakePromptCard
              title={tr('home.wokeUpTitle', 'Bạn đã dậy chưa?', 'Are you awake?')}
              desc={tr(
                'home.wokeUpDesc',
                'Đã đến giờ thức dậy nhưng phiên ngủ chưa được xác nhận. Bấm Đã dậy để tắt chế độ ngủ và lưu giấc ngủ.',
                'It is past your wake-up time, but this sleep session is still unconfirmed. Tap Woke up to end sleep mode and save it.',
              )}
              wokeUpText={tr('home.wokeUp', 'Đã dậy', 'Woke up')}
              stillSleepingText={tr(
                'home.stillSleeping',
                'Vẫn đang ngủ',
                'Still sleeping',
              )}
              onFinish={finishWakePrompt}
              onDismiss={() => setWakePrompt(null)}
              s={s}
            />
          ) : null}

          <HealthScoreHero
            score={score}
            scoreLabel={
              score == null
                ? tr('home.notEnough', 'CHƯA ĐỦ DỮ LIỆU', 'NOT ENOUGH DATA')
                : tr('home.healthScore', 'ĐIỂM SỨC KHỎE', 'HEALTH SCORE')
            }
            title={tr('home.healthScore', 'Điểm số Sức khỏe', 'Health Score')}
            desc={
              score == null
                ? tr(
                    'home.notEnoughDesc',
                    'Chưa đủ dữ liệu ngày này để tính điểm. Cần có ít nhất 2 trong các chỉ số: bước chân, giấc ngủ, nước và năng lượng trong ngày đó.',
                    'Not enough data on this date to calculate a score. At least 2 of steps, sleep, water and energy are needed for that date.',
                  )
                : `${tr(
                    'home.scoreDesc',
                    'Dựa trên phân tích nhịp sinh học tổng thể, điểm sức khỏe của bạn là',
                    'Based on your overall biorhythm analysis, your health score is',
                  )} ${score}.`
            }
            s={s}
          />

          <WaterCard
            water={water}
            waterGoal={waterGoal}
            filled={filled}
            cupCount={cupCount}
            isToday={isToday}
            onGlassPress={onGlassPress}
            title={tr('home.waterTitle', 'Lượng nước đã uống', 'Water drunk')}
            readOnlyText={tr(
              'home.readOnly',
              'Chỉ xem lại, không sửa được nước của ngày cũ.',
              'Read-only. Water from a past date cannot be edited.',
            )}
            s={s}
          />

          {/* 1/4 — Chỉ số nổi bật */}
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

          {/* 2/4 — Đề xuất bài tập*/}
          <TodayWorkoutCard
            post={featuredPost}
            onPress={goPlayer}
            onSeeAll={goExplore}
          />

          {/* 3/4 — Tổng kết tuần */}
          <WeeklySummaryCard
            summary={weeklyForCard}
            onPressWorkout={goWorkoutLog}
          />

          {/* 4/4 — Kiến thức dinh dưỡng */}
          <HomeArticles
            articles={articlesForHome}
            onPressArticle={goArticle}
            onSeeAll={goExplore}
          />
        </ScrollView>

        <CalendarModal
          visible={calendarVisible}
          month={calendarMonth}
          onMonthChange={setCalendarMonth}
          onClose={() => setCalendarVisible(false)}
          onSelectDate={selectDate}
          selectedKey={selectedKey}
          todayKey={todayKey}
          todayMidnight={todayMidnight}
          locale={locale}
          dateLocale={dateLocale}
          closeText={tr('common.close', 'Đóng', 'Close')}
          s={s}
        />
      </SafeAreaView>
    </SafeAreaProvider>
  );
}
