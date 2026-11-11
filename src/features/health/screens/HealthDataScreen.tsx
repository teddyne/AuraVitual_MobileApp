import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../auth/AuthContext';
import { useSettings } from '../../../context/SettingsContext';
import { AppHeader } from '../../../components/ui/AppHeader';
import { AppIcon } from '../../../components/ui/AppIcon';
import { IconBadge } from '../../../components/ui/IconBadge';
import {
  formatNumber,
  formatSleep,
  getDaysToNextPeriod,
  getProfile,
  getTodayMetric,
  getTodayNutrition,
  type Metric,
  type Profile,
} from '../../../api/auravitalApi';
import { PRIMARY } from '../constants';
import { styles } from './HealthDataScreen.styles';

// Trang "Dữ liệu sức khỏe tổng hợp": liệt kê các chỉ số hôm nay lấy từ
// DB thật (health_metrics, meals, cycles, profiles). Chỉ số nào DB
// không có (ví dụ huyết áp — bảng health_metrics không có cột đó) thì
// KHÔNG hiện hàng, chứ không bịa số. Chỉ số có cột nhưng hôm nay chưa
type Row = {
  id: string;
  icon: any;
  label: string;
  value: string | null; // null = chưa có dữ liệu
  sub?: string | null;
};

export default function HealthDataScreen() {
  const { user } = useAuth();
  const { t, locale } = useSettings();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [metric, setMetric] = useState<Metric | null>(null);
  const [kcal, setKcal] = useState<number | null>(null);
  const [cycleDays, setCycleDays] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [query, setQuery] = useState('');

  const load = useCallback(async () => {
    if (!user?.id) {
      setLoading(false);
      return;
    }
    const results = await Promise.allSettled([
      getProfile(user.id),
      getTodayMetric(user.id),
      getTodayNutrition(user.id),
      getDaysToNextPeriod(user.id),
    ]);
    results.forEach((r, i) => {
      if (r.status === 'rejected')
        console.warn(`HealthData load [${i}] failed`, r.reason);
    });
    const value = (i: number, fallback: any) =>
      results[i].status === 'fulfilled'
        ? ((results[i] as any).value ?? fallback)
        : fallback;
    setProfile(value(0, null));
    setMetric(value(1, null));
    const nutrition = value(2, null);
    setKcal(nutrition == null ? null : Number(nutrition.kcal ?? 0));
    setCycleDays(value(3, null));
    setLoadError(results.every((r) => r.status === 'rejected'));
    setLoading(false);
    setRefreshing(false);
  }, [user?.id]);

  useEffect(() => {
    void load();
  }, [load]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    void load();
  }, [load]);

  const noData = t('healthData.noData');

  // BMI tính trực tiếp từ chiều cao/cân nặng trong profiles, không lưu DB.
  const bmi =
    profile?.height_cm && profile?.weight_kg
      ? (profile.weight_kg / (profile.height_cm / 100) ** 2).toFixed(1)
      : null;

  const rows: Row[] = [
    {
      id: 'steps',
      icon: 'footsteps-outline',
      label: t('home.steps'),
      value:
        metric?.steps == null ? null : formatNumber(Number(metric.steps), locale),
      sub:
        profile?.step_goal != null
          ? t('healthData.goalSteps', { goal: formatNumber(profile.step_goal, locale) })
          : null,
    },
    {
      id: 'cycle',
      icon: 'calendar-outline',
      label: t('home.cycle'),
      value:
        cycleDays == null ? null : t('healthData.daysToPeriod', { days: cycleDays }),
    },
    {
      id: 'sleep',
      icon: 'moon-outline',
      label: t('healthData.sleepQuality'),
      value: metric?.sleep_hours == null ? null : formatSleep(Number(metric.sleep_hours)),
      sub:
        profile?.sleep_goal_hours != null
          ? t('healthData.goalSleep', { goal: profile.sleep_goal_hours })
          : null,
    },
    {
      id: 'heartRate',
      icon: 'heart-outline',
      label: t('healthData.heartRate'),
      value:
        metric?.heart_rate == null
          ? null
          : `${formatNumber(Number(metric.heart_rate), locale)} bpm`,
    },
    {
      id: 'calories',
      icon: 'flame-outline',
      label: t('healthData.calories'),
      value:
        kcal == null ? null : `${formatNumber(Math.round(kcal), locale)} kcal`,
      sub: t('healthData.today'),
    },
    {
      id: 'water',
      icon: 'water-outline',
      label: t('healthData.water'),
      value:
        metric?.water_ml == null
          ? null
          : `${formatNumber(Number(metric.water_ml), locale)} ml`,
      sub:
        profile?.water_goal_ml != null
          ? t('healthData.goalWater', { goal: formatNumber(profile.water_goal_ml, locale) })
          : null,
    },
    {
      id: 'bmi',
      icon: 'calculator-outline',
      label: t('healthData.bmi'),
      value: bmi,
    },
    {
      id: 'spo2',
      icon: 'pulse-outline',
      label: t('healthData.spo2'),
      value:
        metric?.spo2 == null ? null : `${Number(metric.spo2)}%`,
    },
    {
      id: 'weight',
      icon: 'barbell-outline',
      label: t('healthData.weight'),
      value: (() => {
        const w = metric?.weight_kg ?? profile?.weight_kg;
        return w == null ? null : `${w} kg`;
      })(),
    },
  ];

  const q = query.trim().toLowerCase();
  const filtered = q
    ? rows.filter((r) => r.label.toLowerCase().includes(q))
    : rows;
  // Chỉ số có dữ liệu lên trên, chưa có dữ liệu xuống dưới; giữ
  // nguyên thứ tự gốc trong từng nhóm (sort ổn định).
  const visible = [...filtered].sort(
    (a, b) => (a.value == null ? 1 : 0) - (b.value == null ? 1 : 0),
  );

  if (loading) {
    return (
      <SafeAreaProvider>
        <SafeAreaView style={styles.safe}>
          <View style={{ paddingHorizontal: 16, paddingTop: 16 }}>
            <AppHeader title={t('healthData.title')} withTopInset={false} />
          </View>
          <View style={styles.center}>
            <ActivityIndicator size='large' color={PRIMARY} />
            <Text style={{ color: '#888', marginTop: 12 }}>
              {t('common.loading')}
            </Text>
          </View>
        </SafeAreaView>
      </SafeAreaProvider>
    );
  }

  return (
    <SafeAreaProvider>
      <SafeAreaView style={styles.safe}>
        <View style={{ paddingHorizontal: 16, paddingTop: 16 }}>
          <AppHeader title={t('healthData.title')} withTopInset={false} />
        </View>
        <ScrollView
          contentContainerStyle={styles.scroll}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
        >
          <View style={styles.searchBox}>
            <AppIcon name='search-outline' size={20} tone='muted' />
            <TextInput
              style={styles.searchInput}
              value={query}
              onChangeText={setQuery}
              placeholder={t('healthData.searchPlaceholder')}
              placeholderTextColor='#999'
              returnKeyType='search'
              clearButtonMode='while-editing'
            />
            {query.length > 0 && (
              <TouchableOpacity onPress={() => setQuery('')} hitSlop={8}>
                <Ionicons name='close-circle' size={20} color='#999' />
              </TouchableOpacity>
            )}
          </View>

          {loadError ? (
            <View style={styles.center}>
              <Text style={styles.errorText}>{t('common.loadFailed')}</Text>
              <TouchableOpacity style={styles.retryBtn} onPress={onRefresh}>
                <Text style={styles.retryText}>{t('common.retry')}</Text>
              </TouchableOpacity>
            </View>
          ) : visible.length === 0 ? (
            <Text style={styles.empty}>{t('healthData.noResults')}</Text>
          ) : (
            visible.map((r) => (
              <View key={r.id} style={styles.row}>
                <IconBadge name={r.icon} />
                <View style={styles.rowText}>
                  <Text style={styles.rowLabel}>{r.label}</Text>
                  {r.sub ? <Text style={styles.rowSub}>{r.sub}</Text> : null}
                </View>
                <Text
                  style={[
                    styles.rowValue,
                    r.value == null && styles.rowValueEmpty,
                  ]}
                >
                  {r.value ?? noData}
                </Text>
              </View>
            ))
          )}
        </ScrollView>
      </SafeAreaView>
    </SafeAreaProvider>
  );
}
