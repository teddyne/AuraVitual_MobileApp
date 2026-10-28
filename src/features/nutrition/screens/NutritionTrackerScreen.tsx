import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Circle, G } from 'react-native-svg';
import { useFocusEffect } from '@react-navigation/native';
import { useAuth } from '../../auth/AuthContext';
import { useSettings } from '../../../context/SettingsContext';
import {
  getNutritionDay,
  toLocalDateString,
  type DayNutrition,
  type MealType,
} from '../../../lib/nutritionApi';

const MACRO_COLORS = { carbs: '#4E8A47', protein: '#A63D2F', fat: '#E8930C' };
// ĐÃ BỎ MACRO_ICONS: chú thích biểu đồ không còn dùng emoji 🍞🥩🧈 nữa,
// chỉ còn chấm màu + tên + %, màu giữ nguyên như cũ.
const MEAL_ICONS: Record<MealType, string> = {
  breakfast: '🍳',
  lunch: '🍱',
  dinner: '🍲',
  snack: '🍩',
};
const DEFAULT_MEALS: MealType[] = ['breakfast', 'lunch', 'dinner'];
const MEAL_TYPES: MealType[] = ['breakfast', 'lunch', 'dinner', 'snack'];

function RingChart({
  totalKcal,
  goal,
  carb,
  protein,
  fat,
}: {
  totalKcal: number;
  goal: number;
  carb: number;
  protein: number;
  fat: number;
}) {
  const eatenKcal = totalKcal > 0 ? totalKcal : 1;
  const shares = [
    { r: 95, color: MACRO_COLORS.carbs, share: (carb * 4) / eatenKcal },
    { r: 75, color: MACRO_COLORS.protein, share: (protein * 4) / eatenKcal },
    { r: 55, color: MACRO_COLORS.fat, share: (fat * 9) / eatenKcal },
  ];
  const pct = goal > 0 ? Math.round((totalKcal / goal) * 100) : 0;
  return (
    <View style={{ alignItems: 'center' }}>
      <Svg width={220} height={220} viewBox='0 0 220 220'>
        <G rotation='-90' origin='110, 110'>
          {shares.map((ring) => {
            const c = 2 * Math.PI * ring.r;
            const filled = c * Math.min(1, Math.max(0, ring.share));
            return (
              <React.Fragment key={ring.r}>
                <Circle
                  cx={110}
                  cy={110}
                  r={ring.r}
                  stroke='#E9E9E9'
                  strokeWidth={12}
                  fill='none'
                />
                <Circle
                  cx={110}
                  cy={110}
                  r={ring.r}
                  stroke={ring.color}
                  strokeWidth={12}
                  fill='none'
                  strokeDasharray={`${filled} ${c}`}
                  strokeLinecap='round'
                />
              </React.Fragment>
            );
          })}
        </G>
      </Svg>
      <View
        style={{
          position: 'absolute',
          top: 0,
          bottom: 0,
          justifyContent: 'center',
          alignItems: 'center',
        }}
      >
        <Text style={{ fontSize: 36, fontWeight: '800' }}>{pct}%</Text>
        <Text style={{ fontSize: 14, color: '#666' }}>{totalKcal} kcal</Text>
      </View>
    </View>
  );
}

export default function NutritionTrackerScreen({ navigation }: any) {
  const { user } = useAuth();
  const { theme, t, locale } = useSettings();
  const [day, setDay] = useState<DayNutrition | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [mealPickerVisible, setMealPickerVisible] = useState(false);
  const [visibleMeals, setVisibleMeals] = useState<MealType[]>(DEFAULT_MEALS);
  const today = toLocalDateString(new Date());

  const load = useCallback(async () => {
    if (!user?.id) {
      setLoading(false);
      return;
    }
    try {
      setError(false);
      setErrorMsg('');
      setDay(await getNutritionDay(user.id, today));
    } catch (e: any) {
      setError(true);
      setErrorMsg(e?.message ?? '');
      console.warn('Nutrition load failed', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user?.id, today]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  useEffect(() => {
    if (!day) return;
    setVisibleMeals((prev) => {
      const next = [...prev];
      for (const type of MEAL_TYPES) {
        if (day.meals[type].length > 0 && !next.includes(type)) next.push(type);
      }
      return next;
    });
  }, [day]);

  const goAdd = (mealType: MealType) =>
    navigation.navigate('AddMeal', { mealType, date: today });
  const chooseMeal = (mealType: MealType) => {
    setVisibleMeals((prev) =>
      prev.includes(mealType) ? prev : [...prev, mealType],
    );
    setMealPickerVisible(false);
    goAdd(mealType);
  };
  const styles = makeStyles(theme);
  const eatenKcal = day?.totalKcal ?? 0;
  // SỬA Ở ĐÂY: bỏ Math.max(0, ...) để còn lại giữ nguyên dấu.
  // Mục tiêu 2000, đã ăn 2150 -> remaining = -150, hiện "-150 kcal Còn lại".
  // Chưa đặt mục tiêu (calorieGoal <= 0) thì vẫn là 0 và dòng này không hiện.
  const remaining =
    day && day.calorieGoal > 0 ? day.calorieGoal - eatenKcal : 0;
  const isOver = day ? day.calorieGoal > 0 && remaining < 0 : false;
  const macroPct = (macroKcal: number) =>
    eatenKcal > 0 ? Math.round((macroKcal / eatenKcal) * 100) : 0;
  const timeOf = (iso: string) => {
    const d = new Date(iso);
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  };
  const loadFailedText = (() => {
    try {
      const v = (t as any)('nutrition.loadFailed');
      if (v && v !== 'nutrition.loadFailed') return v;
    } catch {}
    return locale === 'en'
      ? 'Failed to load nutrition data'
      : 'Không tải được dữ liệu dinh dưỡng';
  })();

  return (
    <SafeAreaProvider>
      <SafeAreaView style={styles.wrap}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Text style={styles.back}>‹</Text>
          </TouchableOpacity>
          <Text style={styles.title}>{t('nutrition.trackerTitle')}</Text>
          <View style={{ width: 32 }} />
        </View>
        {loading ? (
          <ActivityIndicator
            style={{ marginTop: 40 }}
            color={theme.primaryDark}
          />
        ) : error || !day ? (
          <View style={{ padding: 20, alignItems: 'center' }}>
            <Text style={styles.muted}>{loadFailedText}</Text>
            {errorMsg ? (
              <Text style={[styles.muted, { marginTop: 8 }]}>{errorMsg}</Text>
            ) : null}
            <TouchableOpacity
              style={styles.primaryBtn}
              onPress={() => {
                setLoading(true);
                load();
              }}
            >
              <Text style={styles.primaryBtnText}>{t('nutrition.retry')}</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <ScrollView
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={() => {
                  setRefreshing(true);
                  load();
                }}
              />
            }
          >
            <View style={styles.hero}>
              <Text style={styles.heroSmall}>
                {t('nutrition.today')} • {t('nutrition.goal')}:{' '}
                {day.calorieGoal > 0
                  ? `${day.calorieGoal} kcal`
                  : t('nutrition.noGoal')}
              </Text>
              <Text style={styles.heroBig}>
                {t('nutrition.eatenToday')} {eatenKcal} kcal
              </Text>
              <RingChart
                totalKcal={eatenKcal}
                goal={day.calorieGoal}
                carb={day.totalCarb}
                protein={day.totalProtein}
                fat={day.totalFat}
              />
              {day.calorieGoal > 0 && (
                <Text
                  style={[styles.heroSmall, isOver && styles.overRemaining]}
                >
                  {remaining} kcal {t('nutrition.remaining')}
                </Text>
              )}
              <View style={styles.legend}>
                <Text
                  style={[styles.legendText, { color: MACRO_COLORS.carbs }]}
                >
                  ● {t('nutrition.carbs')} {macroPct(day.totalCarb * 4)}%
                </Text>
                <Text
                  style={[styles.legendText, { color: MACRO_COLORS.protein }]}
                >
                  ● {t('nutrition.protein')} {macroPct(day.totalProtein * 4)}%
                </Text>
                <Text style={[styles.legendText, { color: MACRO_COLORS.fat }]}>
                  ● {t('nutrition.fat')} {macroPct(day.totalFat * 9)}%
                </Text>
              </View>
            </View>

            <Text style={styles.section}>
              {t('nutrition.macroDistribution')}
            </Text>
            {[
              {
                label: t('nutrition.carbs'),
                g: day.totalCarb,
                color: MACRO_COLORS.carbs,
              },
              {
                label: t('nutrition.protein'),
                g: day.totalProtein,
                color: MACRO_COLORS.protein,
              },
              {
                label: t('nutrition.fat'),
                g: day.totalFat,
                color: MACRO_COLORS.fat,
              },
            ].map((m) => (
              <View key={m.label} style={styles.card}>
                <View style={[styles.colorBar, { backgroundColor: m.color }]} />
                <Text style={styles.cardTitle}>{m.label}</Text>
                <Text style={styles.cardValue}>{m.g}g</Text>
              </View>
            ))}

            <Text style={styles.section}>{t('nutrition.mealLog')}</Text>
            {visibleMeals.map((type) => {
              const items = day.meals[type];
              const kcal = items.reduce((s, it) => s + it.kcal, 0);
              return (
                <View key={type} style={styles.card}>
                  <Text style={styles.mealIcon}>{MEAL_ICONS[type]}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.cardTitle}>
                      {t(`nutrition.${type}`)}
                      {items.length > 0 ? `  ${timeOf(items[0].eatenAt)}` : ''}
                    </Text>
                    <Text style={styles.muted} numberOfLines={2}>
                      {items.length > 0
                        ? items.map((it) => it.name).join(', ')
                        : t('nutrition.notLoggedToday')}
                    </Text>
                  </View>
                  <Text style={styles.cardValue}>{kcal} kcal</Text>
                  <TouchableOpacity
                    style={styles.plusBtn}
                    onPress={() => goAdd(type)}
                  >
                    <Text style={styles.plusText}>+</Text>
                  </TouchableOpacity>
                </View>
              );
            })}
            <View style={{ height: 90 }} />
          </ScrollView>
        )}

        <TouchableOpacity
          style={styles.fab}
          onPress={() => setMealPickerVisible(true)}
        >
          <Text style={styles.fabText}>+</Text>
        </TouchableOpacity>

        <Modal visible={mealPickerVisible} transparent animationType='fade'>
          <TouchableOpacity
            style={styles.modalOverlay}
            activeOpacity={1}
            onPress={() => setMealPickerVisible(false)}
          >
            <View style={styles.modalCard}>
              <Text style={styles.modalTitle}>{t('nutrition.addMeal')}</Text>
              <Text style={styles.modalSub}>{t('nutrition.chooseMeal')}</Text>
              {MEAL_TYPES.map((type) => (
                <TouchableOpacity
                  key={type}
                  style={styles.modalBtn}
                  onPress={() => chooseMeal(type)}
                >
                  <Text style={styles.modalBtnText}>
                    {MEAL_ICONS[type]} {t(`nutrition.${type}`)}
                  </Text>
                </TouchableOpacity>
              ))}
              <TouchableOpacity onPress={() => setMealPickerVisible(false)}>
                <Text style={styles.cancelText}>{t('nutrition.cancel')}</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </Modal>
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

function makeStyles(theme: any) {
  return StyleSheet.create({
    wrap: { flex: 1, backgroundColor: theme.background },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingVertical: 10,
    },
    back: { fontSize: 30, color: theme.text, width: 32 },
    title: { fontSize: 18, fontWeight: '700', color: theme.text },
    hero: {
      backgroundColor: theme.card,
      margin: 16,
      borderRadius: 20,
      padding: 16,
      alignItems: 'center',
    },
    heroSmall: {
      fontSize: 12,
      color: theme.muted,
      marginVertical: 4,
      textAlign: 'center',
    },
    // SỬA Ở ĐÂY: dòng còn lại khi âm sẽ hiện màu đỏ, đậm hơn để dễ thấy là đã vượt.
    overRemaining: { color: '#C62828', fontWeight: '700' },
    heroBig: {
      fontSize: 18,
      fontWeight: '700',
      color: theme.text,
      textAlign: 'center',
      marginBottom: 8,
    },
    legend: {
      flexDirection: 'row',
      gap: 16,
      marginTop: 8,
      flexWrap: 'wrap',
      justifyContent: 'center',
    },
    legendText: { fontSize: 12, fontWeight: '700' },
    section: {
      fontSize: 16,
      fontWeight: '700',
      color: theme.text,
      marginHorizontal: 16,
      marginTop: 8,
      marginBottom: 8,
    },
    card: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme.card,
      marginHorizontal: 16,
      marginBottom: 10,
      borderRadius: 16,
      padding: 14,
      gap: 10,
    },
    colorBar: { width: 6, height: 32, borderRadius: 3 },
    mealIcon: { fontSize: 24 },
    cardTitle: { fontSize: 15, fontWeight: '600', color: theme.text, flex: 1 },
    cardValue: { fontSize: 15, fontWeight: '700', color: theme.text },
    muted: { fontSize: 13, color: theme.muted, marginTop: 2 },
    plusBtn: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: theme.cardAlt,
      alignItems: 'center',
      justifyContent: 'center',
    },
    plusText: {
      fontSize: 20,
      color: theme.primaryDark,
      fontWeight: '800',
      lineHeight: 22,
    },
    primaryBtn: {
      backgroundColor: theme.primaryDark,
      borderRadius: 999,
      paddingHorizontal: 20,
      paddingVertical: 10,
      marginTop: 12,
    },
    primaryBtnText: { color: '#fff', fontWeight: '700' },
    fab: {
      position: 'absolute',
      right: 20,
      bottom: 24,
      width: 56,
      height: 56,
      borderRadius: 28,
      backgroundColor: theme.primaryDark,
      alignItems: 'center',
      justifyContent: 'center',
    },
    fabText: { color: '#fff', fontSize: 28, lineHeight: 30 },
    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.4)',
      justifyContent: 'flex-end',
    },
    modalCard: {
      backgroundColor: theme.card,
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      padding: 20,
    },
    modalTitle: { fontSize: 18, fontWeight: '800', color: theme.text },
    modalSub: {
      fontSize: 13,
      color: theme.muted,
      marginTop: 4,
      marginBottom: 12,
    },
    modalBtn: {
      backgroundColor: theme.cardAlt,
      borderRadius: 12,
      padding: 14,
      marginBottom: 8,
    },
    modalBtnText: { color: theme.primaryDark, fontWeight: '700', fontSize: 15 },
    cancelText: {
      color: theme.muted,
      fontWeight: '700',
      textAlign: 'center',
      padding: 10,
    },
  });
}
