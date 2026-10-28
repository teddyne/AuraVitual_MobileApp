import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSettings } from '../../../context/SettingsContext';
import { supabase } from '../../../lib/supabase';
import { getDaysToNextPeriod, getProfile } from '../../../lib/auravitalApi';

const PRIMARY = '#4E8A47';
const NOTIF_KEY = '@auravital:notifications';
const READ_KEY = '@auravital:notifications_read';
const READ_ALL_KEY = '@auravital:notifications_read_all';
const GREY_PILL = '#D9D9D9';

type NotifCard = {
  id: string;
  kind: 'reminder' | 'family' | 'milestone';
  category: string;
  timeLabel: string;
  title: string;
  body: string;
  icon: string;
  iconBg: string;
  progress: number | null;
  progressText: string | null;
  action: 'sleep' | null;
};

const todayKey = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

export default function NotificationsScreen({ navigation }: any) {
  const { theme, locale } = useSettings();
  const [cards, setCards] = useState<NotifCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<
    'all' | 'reminder' | 'family' | 'milestone'
  >('all');
  const [readIds, setReadIds] = useState<string[]>([]);
  const [hiddenIds, setHiddenIds] = useState<string[]>([]);
  const [notifEnabled, setNotifEnabled] = useState(true);

  const loadAll = useCallback(async () => {
    const readRaw = await AsyncStorage.getItem(READ_KEY);
    if (readRaw) {
      try {
        setReadIds(JSON.parse(readRaw));
      } catch {}
    }
    const notifRaw = await AsyncStorage.getItem(NOTIF_KEY);
    const notif = notifRaw
      ? {
          enabled: true,
          water: true,
          waterIntervalHours: 2,
          sleep: true,
          sleepTime: '22:00',
          cycle: true,
          cycleDaysBefore: 3,
          meal: true,
          mealBreakfast: '07:00',
          mealLunch: '12:00',
          mealDinner: '18:30',
          wake: true,
          wakeTime: '07:30',
          ...JSON.parse(notifRaw),
        }
      : null;
    if (!notif || !notif.enabled) {
      setNotifEnabled(false);
      setCards([]);
      setLoading(false);
      return;
    }
    setNotifEnabled(true);

    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) {
      setCards([]);
      setLoading(false);
      return;
    }
    const uid = auth.user.id;
    const profile = await getProfile(uid).catch(() => null);
    const today = todayKey();
    const { data: metric, error: metricError } = await supabase
      .from('health_metrics')
      .select('water_ml, steps')
      .eq('user_id', uid)
      .eq('log_date', today)
      .maybeSingle();
    if (metricError) {
      console.warn('Cannot load health metrics for notifications', metricError);
    }
    const waterToday =
      metric?.water_ml != null ? Number(metric.water_ml) : null;
    const stepsToday = metric?.steps != null ? Number(metric.steps) : null;
    const waterGoal = profile?.water_goal_ml ?? null;
    const stepGoal = profile?.step_goal ?? null;
    const daysToPeriod = await getDaysToNextPeriod(uid).catch(() => null);

    const now = new Date();
    const nowMin = now.getHours() * 60 + now.getMinutes();
    const next: NotifCard[] = [];

    if (notif.water) {
      const pct =
        waterToday != null && waterGoal
          ? Math.round((waterToday / waterGoal) * 100)
          : null;
      next.push({
        id: 'water',
        kind: 'reminder',
        category: locale === 'vi' ? 'THÓI QUEN SINH HOẠT' : 'DAILY HABIT',
        timeLabel: locale === 'vi' ? 'Hôm nay' : 'Today',
        title: locale === 'vi' ? 'Nhắc nhở uống nước' : 'Water reminder',
        body:
          waterToday != null && waterGoal
            ? locale === 'vi'
              ? `Bạn đã ghi nhận ${waterToday} / ${waterGoal}ml hôm nay.`
              : `You logged ${waterToday} / ${waterGoal}ml today.`
            : waterToday != null
              ? locale === 'vi'
                ? `Bạn đã ghi nhận ${waterToday}ml hôm nay.`
                : `You logged ${waterToday}ml today.`
              : locale === 'vi'
                ? 'Chưa ghi nhận nước hôm nay.'
                : 'No water logged today.',
        icon: '💧',
        iconBg: '#E8F0FE',
        progress: pct != null ? Math.min(pct, 100) / 100 : null,
        progressText:
          pct != null
            ? locale === 'vi'
              ? `Mục tiêu: ${pct}%`
              : `Goal: ${pct}%`
            : null,
        action: null,
      });
    }

    if (notif.meal) {
      const meals = [
        {
          key: 'breakfast',
          label: locale === 'vi' ? 'Bữa sáng' : 'Breakfast',
          time: notif.mealBreakfast,
        },
        {
          key: 'lunch',
          label: locale === 'vi' ? 'Bữa trưa' : 'Lunch',
          time: notif.mealLunch,
        },
        {
          key: 'dinner',
          label: locale === 'vi' ? 'Bữa tối' : 'Dinner',
          time: notif.mealDinner,
        },
      ];
      const upcoming = meals.find((m) => {
        const [h, mm] = m.time.split(':').map(Number);
        return h * 60 + mm > nowMin;
      });
      const meal = upcoming ?? meals[0];
      next.push({
        id: 'meal',
        kind: 'reminder',
        category: locale === 'vi' ? 'BỮA ĂN' : 'MEALS',
        timeLabel: meal.time,
        title: locale === 'vi' ? 'Nhắc bữa ăn' : 'Meal reminder',
        body:
          locale === 'vi'
            ? `${meal.label} lúc ${meal.time}.`
            : `${meal.label} at ${meal.time}.`,
        icon: '🍽',
        iconBg: '#FFF3E0',
        progress: null,
        progressText: null,
        action: null,
      });
    }

    if (notif.wake) {
      next.push({
        id: 'wake',
        kind: 'reminder',
        category: locale === 'vi' ? 'THỨC DẬY' : 'WAKE UP',
        timeLabel: notif.wakeTime,
        title: locale === 'vi' ? 'Nhắc thức dậy' : 'Wake reminder',
        body:
          locale === 'vi'
            ? `Đã đặt nhắc thức dậy lúc ${notif.wakeTime}. Đây chỉ là cài đặt nhắc, không thay báo thức trong màn hình giấc ngủ.`
            : `Wake reminder set at ${notif.wakeTime}. This is a reminder setting only, not the alarm in the sleep screen.`,
        icon: '⏰',
        iconBg: '#FFF8E1',
        progress: null,
        progressText: null,
        action: null,
      });
    }

    if (notif.sleep) {
      const [h, m] = notif.sleepTime.split(':').map(Number);
      const mins =
        !Number.isNaN(h) && !Number.isNaN(m)
          ? h * 60 + m > nowMin
            ? h * 60 + m - nowMin
            : 24 * 60 - (nowMin - (h * 60 + m))
          : null;
      next.push({
        id: 'sleep',
        kind: 'reminder',
        category: locale === 'vi' ? 'GIẤC NGỦ' : 'SLEEP',
        timeLabel: notif.sleepTime,
        title:
          locale === 'vi'
            ? 'Chuẩn bị giấc ngủ phục hồi'
            : 'Get ready for restorative sleep',
        body:
          mins != null
            ? locale === 'vi'
              ? `Còn ${mins} phút nữa đến giờ đi ngủ (${notif.sleepTime}).`
              : `${mins} minutes until bedtime (${notif.sleepTime}).`
            : locale === 'vi'
              ? `Giờ đi ngủ là ${notif.sleepTime}.`
              : `Bedtime is ${notif.sleepTime}.`,
        icon: '🌙',
        iconBg: '#EEF1FF',
        progress: null,
        progressText: null,
        action: 'sleep',
      });
    }

    if (
      notif.cycle &&
      daysToPeriod != null &&
      daysToPeriod <= notif.cycleDaysBefore
    ) {
      next.push({
        id: 'cycle',
        kind: 'reminder',
        category: locale === 'vi' ? 'CHU KỲ' : 'CYCLE',
        timeLabel:
          locale === 'vi'
            ? `${daysToPeriod} ngày nữa`
            : `${daysToPeriod} days left`,
        title: locale === 'vi' ? 'Sắp đến chu kỳ' : 'Cycle approaching',
        body:
          locale === 'vi'
            ? `Còn ${daysToPeriod} ngày nữa đến chu kỳ, đã đến lúc nhắc trước ${notif.cycleDaysBefore} ngày.`
            : `${daysToPeriod} days until your cycle, within your ${notif.cycleDaysBefore}-day reminder window.`,
        icon: '🌸',
        iconBg: '#FCE4EC',
        progress: null,
        progressText: null,
        action: null,
      });
    }

    if (stepsToday != null && stepGoal && stepsToday >= stepGoal) {
      next.push({
        id: 'milestone',
        kind: 'milestone',
        category: locale === 'vi' ? 'CỘT MỐC SỨC SỐNG' : 'MILESTONE',
        timeLabel: locale === 'vi' ? 'Hôm nay' : 'Today',
        title:
          locale === 'vi'
            ? 'Chúc mừng mục tiêu vận động!'
            : 'You hit your activity goal!',
        body:
          locale === 'vi'
            ? `Bạn đã đạt ${stepsToday} bước hôm nay, vượt mục tiêu ${stepGoal} bước.`
            : `You reached ${stepsToday} steps today, above your ${stepGoal} goal.`,
        icon: '🏆',
        iconBg: '#FFF3E0',
        progress: null,
        progressText: null,
        action: null,
      });
    }

    setCards(next);
    setLoading(false);
  }, [locale]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadAll();
    setRefreshing(false);
  };

  const saveReadIds = (next: string[]) => {
    setReadIds(next);
    AsyncStorage.setItem(READ_KEY, JSON.stringify(next)).catch(() => {});
  };

  const markAllRead = () => {
    saveReadIds(cards.map((c) => c.id));
    AsyncStorage.setItem(READ_ALL_KEY, todayKey()).catch(() => {});
  };

  const unreadCount = cards.filter(
    (c) => !readIds.includes(c.id) && !hiddenIds.includes(c.id),
  ).length;

  const visible = cards.filter((c) => {
    if (hiddenIds.includes(c.id)) return false;
    if (filter === 'all') return true;
    return c.kind === filter;
  });

  const tabs: { id: typeof filter; label: string }[] = [
    { id: 'all', label: locale === 'vi' ? 'Tất cả' : 'All' },
    { id: 'reminder', label: locale === 'vi' ? 'Nhắc nhở' : 'Reminders' },
    { id: 'family', label: locale === 'vi' ? 'Chia sẻ gia đình' : 'Family' },
    { id: 'milestone', label: locale === 'vi' ? 'Cột mốc' : 'Milestones' },
  ];

  const goSleep = () =>
    (navigation.getParent() ?? navigation).navigate('SleepTracker');

  if (loading) {
    return (
      <SafeAreaProvider>
        <SafeAreaView style={[s.safe, { backgroundColor: theme.background }]}>
          <ActivityIndicator
            size='large'
            color={PRIMARY}
            style={{ marginTop: 80 }}
          />
        </SafeAreaView>
      </SafeAreaProvider>
    );
  }

  return (
    <SafeAreaProvider>
      <SafeAreaView style={[s.safe, { backgroundColor: theme.background }]}>
        <ScrollView
          contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
        >
          <View style={s.headerRow}>
            <TouchableOpacity onPress={() => navigation.goBack()}>
              <Text style={[s.back, { color: theme.primaryDark }]}>‹</Text>
            </TouchableOpacity>
            <Text style={[s.headerTitle, { color: theme.text }]}>
              {locale === 'vi'
                ? 'Thông báo & Nhắc nhở'
                : 'Notifications & Reminders'}
            </Text>
            <View style={s.avatar}>
              <Text>👤</Text>
            </View>
          </View>

          <View style={s.summaryRow}>
            <Text style={[s.summary, { color: theme.text }]}>
              ● {unreadCount}{' '}
              {locale === 'vi' ? 'cập nhật chưa đọc' : 'unread updates'}
            </Text>
            <TouchableOpacity onPress={markAllRead}>
              <Text style={[s.readAll, { color: theme.primaryDark }]}>
                ✓ {locale === 'vi' ? 'Đã đọc tất cả' : 'Mark all read'}
              </Text>
            </TouchableOpacity>
          </View>

          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={s.tabRow}>
              {tabs.map((t) => (
                <TouchableOpacity
                  key={t.id}
                  style={[
                    s.tabPill,
                    {
                      backgroundColor: filter === t.id ? PRIMARY : GREY_PILL,
                    },
                  ]}
                  onPress={() => setFilter(t.id)}
                >
                  <Text
                    style={[
                      s.tabText,
                      { color: filter === t.id ? '#fff' : theme.text },
                    ]}
                  >
                    {t.label}
                    {t.id === 'all' ? ` ${unreadCount}` : ''}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>

          <Text style={[s.hint, { color: theme.muted }]}>
            {locale === 'vi'
              ? 'BẤM THẺ ĐỂ ĐÁNH DẤU ĐÃ ĐỌC, BẤM ✕ ĐỂ ẨN THẺ'
              : 'TAP A CARD TO MARK AS READ, TAP ✕ TO HIDE IT'}
          </Text>

          <View style={s.sectionRow}>
            <Text style={[s.sectionTitle, { color: theme.text }]}>
              {locale === 'vi' ? 'Hôm nay' : 'Today'}
            </Text>
            <Text style={[s.sectionRight, { color: theme.primaryDark }]}>
              {unreadCount} {locale === 'vi' ? 'tin mới' : 'new'}
            </Text>
          </View>

          {!notifEnabled ? (
            <Text style={[s.empty, { color: theme.muted }]}>
              {locale === 'vi'
                ? 'Thông báo đang tắt trong Cài đặt nhắc nhở.'
                : 'Notifications are off in Reminder settings.'}
            </Text>
          ) : visible.length === 0 ? (
            <Text style={[s.empty, { color: theme.muted }]}>
              {filter === 'family'
                ? locale === 'vi'
                  ? 'Chưa có chia sẻ gia đình.'
                  : 'No family sharing yet.'
                : locale === 'vi'
                  ? 'Hôm nay chưa có thông báo nào trong mục này.'
                  : 'No notifications in this section today.'}
            </Text>
          ) : (
            visible.map((c) => {
              const unread = !readIds.includes(c.id);
              return (
                <TouchableOpacity
                  key={c.id}
                  style={[s.card, { backgroundColor: theme.card }]}
                  onPress={() => {
                    if (unread) saveReadIds([...readIds, c.id]);
                  }}
                >
                  <View style={[s.iconCircle, { backgroundColor: c.iconBg }]}>
                    <Text style={s.iconText}>{c.icon}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <View style={s.cardTop}>
                      <Text style={[s.category, { color: PRIMARY }]}>
                        {c.category}
                      </Text>
                      <Text style={[s.timeLabel, { color: theme.muted }]}>
                        {c.timeLabel}
                      </Text>
                      {unread && <Text style={{ color: PRIMARY }}>●</Text>}
                    </View>
                    <Text style={[s.cardTitle, { color: theme.text }]}>
                      {c.title}
                    </Text>
                    <Text style={[s.cardBody, { color: theme.text }]}>
                      {c.body}
                    </Text>
                    {c.progress != null && (
                      <>
                        <View style={s.progressTrack}>
                          <View
                            style={[
                              s.progressFill,
                              { width: `${c.progress * 100}%` },
                            ]}
                          />
                        </View>
                        {c.progressText && (
                          <View style={s.progressRow}>
                            <Text
                              style={[s.progressText, { color: theme.muted }]}
                            >
                              {c.progressText}
                            </Text>
                          </View>
                        )}
                      </>
                    )}
                    {c.action === 'sleep' && (
                      <TouchableOpacity style={s.actionBtn} onPress={goSleep}>
                        <Text style={s.actionBtnText}>
                          {locale === 'vi' ? 'Mở giấc ngủ' : 'Open sleep'}
                        </Text>
                      </TouchableOpacity>
                    )}
                  </View>
                  <TouchableOpacity
                    onPress={() => setHiddenIds((prev) => [...prev, c.id])}
                  >
                    <Text style={{ color: theme.muted, fontSize: 16 }}>✕</Text>
                  </TouchableOpacity>
                </TouchableOpacity>
              );
            })
          )}
        </ScrollView>
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1 },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  back: { fontSize: 30, fontWeight: '800' },
  headerTitle: { flex: 1, fontSize: 20, fontWeight: '800' },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#E8F5E9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  summary: { fontWeight: '700' },
  readAll: { fontWeight: '800' },
  tabRow: { flexDirection: 'row', gap: 8 },
  tabPill: { borderRadius: 999, paddingVertical: 8, paddingHorizontal: 14 },
  tabText: { fontWeight: '700' },
  hint: { fontSize: 11, marginTop: 14, marginBottom: 8 },
  sectionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  sectionTitle: { fontSize: 18, fontWeight: '800' },
  sectionRight: { fontWeight: '700' },
  empty: { lineHeight: 20, marginTop: 12 },
  card: {
    flexDirection: 'row',
    gap: 12,
    borderRadius: 16,
    padding: 14,
    marginTop: 10,
  },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconText: { fontSize: 20 },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  category: { fontSize: 11, fontWeight: '800' },
  timeLabel: { fontSize: 12 },
  cardTitle: { fontSize: 15, fontWeight: '800', marginTop: 2 },
  cardBody: { lineHeight: 20, marginTop: 4 },
  progressTrack: {
    height: 6,
    backgroundColor: '#E5E7EB',
    borderRadius: 3,
    marginTop: 10,
    overflow: 'hidden',
  },
  progressFill: { height: 6, backgroundColor: PRIMARY, borderRadius: 3 },
  progressRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 6,
  },
  progressText: { fontSize: 12 },
  actionBtn: {
    backgroundColor: '#EEF1FF',
    borderRadius: 999,
    paddingVertical: 8,
    paddingHorizontal: 14,
    alignSelf: 'flex-start',
    marginTop: 10,
  },
  actionBtnText: { fontWeight: '800', color: '#111' },
});
