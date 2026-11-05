import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  RefreshControl,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { useAuth } from '../../auth/AuthContext';
import { useSettings } from '../../../context/SettingsContext';
import { AppHeader } from '../../../components/ui/AppHeader';
import {
  getNutritionDay,
  toLocalDateString,
  type DayNutrition,
  type MealType,
} from '../../../lib/nutritionApi';
import {
  DEFAULT_MEALS,
  MACRO_COLORS,
  MEAL_ICONS,
  MEAL_TYPES,
} from '../constants';
import { timeOf } from '../utils/nutritionFormat';
import { RingChart } from '../components/RingChart';
import { makeStyles } from './NutritionTrackerScreen.styles';

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
  // remaining âm nghĩa là đã vượt mục tiêu: hiện "Đã nạp dư X kcal"
  // thay cho "-X kcal Còn lại". Chưa đặt mục tiêu thì vẫn là 0 và
  // dòng này không hiện.
  const remaining =
    day && day.calorieGoal > 0 ? day.calorieGoal - eatenKcal : 0;
  const isOver = day ? day.calorieGoal > 0 && remaining < 0 : false;
  const macroPct = (macroKcal: number) =>
    eatenKcal > 0 ? Math.round((macroKcal / eatenKcal) * 100) : 0;
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
        <View style={{ paddingHorizontal: 16, paddingTop: 16 }}>
          <AppHeader title={t('nutrition.trackerTitle')} withTopInset={false} />
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
                  {isOver
                    ? locale === 'en'
                      ? `Over goal by ${Math.abs(remaining)} kcal`
                      : `Đã nạp dư ${Math.abs(remaining)} kcal so với mục tiêu`
                    : `${remaining} kcal ${t('nutrition.remaining')}`}
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
