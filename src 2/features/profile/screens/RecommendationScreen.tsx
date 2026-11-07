import React, { useEffect, useRef, useState } from 'react';
import {
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { s } from './RecommendationScreen.styles';
import { CardTitle } from '../../../components/profile/CardTitle';
import { GOAL_LABEL } from '../constants';
import { fmtHours } from '../../../utils/profile/profileFormat';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '../../auth/AuthContext';
import { useSettings } from '../../../context/SettingsContext';
import {
  getRecommendation,
  saveRecommendation,
  syncRecommendationToProfile,
} from '../../../api/auravitalApi';
import {
  isoToLabel,
  localizeBmiLabel,
  localizeBmiRisk,
} from '../../../utils/health/healthCalc';

export default function RecommendationScreen({ route, navigation }: any) {
  const { theme, t, locale } = useSettings();
  const { user } = useAuth();
  const [rec, setRec] = useState<any>(route.params?.recommendation ?? null);
  const [loading, setLoading] = useState(!route.params?.recommendation);
  const savedRef = useRef(false);

  useEffect(() => {
    // Có params = vừa tính xong ở ProfileSetup: lưu lên DB, không chặn UI
    if (route.params?.recommendation) {
      if (user && !savedRef.current) {
        savedRef.current = true;
        (async () => {
          try {
            await saveRecommendation(user.id, route.params.recommendation);
            await syncRecommendationToProfile(
              user.id,
              route.params.recommendation,
            );
            await AsyncStorage.setItem(
              '@auravital:recommendation',
              JSON.stringify(route.params.recommendation),
            );
          } catch (e) {
            console.log('Save recommendation failed', e);
          }
        })();
      }
      return;
    }
    // Không có params: ưu tiên DB, rồi mới fallback AsyncStorage cũ
    (async () => {
      if (user) {
        try {
          const fromDb = await getRecommendation(user.id);
          if (fromDb) {
            setRec(fromDb);
            setLoading(false);
            return;
          }
        } catch (e) {
          console.log('Load recommendation from DB failed', e);
        }
      }
      const raw = await AsyncStorage.getItem('@auravital:recommendation');
      if (raw) setRec(JSON.parse(raw));
      setLoading(false);
    })();
  }, [user]);

  if (loading)
    return (
      <SafeAreaProvider>
        <SafeAreaView style={[s.wrap, { backgroundColor: theme.background }]}>
          <Text style={{ color: theme.text }}>
            {t('profile.recommendation.loading')}
          </Text>
        </SafeAreaView>
      </SafeAreaProvider>
    );
  if (!rec)
    return (
      <SafeAreaProvider>
        <SafeAreaView style={[s.wrap, { backgroundColor: theme.background }]}>
          <Text style={[s.title, { color: theme.text }]}>
            {t('profile.recommendation.empty')}
          </Text>
          <TouchableOpacity
            style={[s.primaryBtn, { backgroundColor: theme.primaryDark }]}
            onPress={() => navigation.replace('ProfileSetup')}
          >
            <Text style={s.primaryBtnText}>
              {t('settings.setupProfile')}
            </Text>
          </TouchableOpacity>
        </SafeAreaView>
      </SafeAreaProvider>
    );
  const isWeight = ['maintain', 'lose', 'gain'].includes(rec.goal);
  const updated = rec.updatedAt ? new Date(rec.updatedAt) : null;
  const bmiColor =
    rec.asia.label === 'Bình thường'
      ? '#4E8A47'
      : rec.asia.label === 'Thiếu cân'
        ? '#F59E0B'
        : rec.asia.label === 'Thừa cân'
          ? '#D97706'
          : '#EF4444';
  return (
    <SafeAreaProvider>
      <SafeAreaView style={[s.wrap, { backgroundColor: theme.background }]}>
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 32 }}>
          <View style={[s.hero, { backgroundColor: theme.primaryDark }]}>
            <Text style={s.eyebrow}>
              {t('profile.recommendation.eyebrow')}
            </Text>
            <Text style={s.heroName}>
              {rec.displayName || t('profile.recommendation.defaultName')}
            </Text>
            {updated && (
              <Text style={s.heroSub}>
                {t('profile.recommendation.updatedAt', {
                  date: updated.toLocaleDateString(
                    locale === 'vi' ? 'vi-VN' : 'en-US',
                  ),
                  time: updated.toLocaleTimeString(
                    locale === 'vi' ? 'vi-VN' : 'en-US',
                    { hour: '2-digit', minute: '2-digit' },
                  ),
                })}
              </Text>
            )}
            <View style={s.pill}>
              <Text style={s.pillText}>
                {GOAL_LABEL[rec.goal] ? t(GOAL_LABEL[rec.goal]) : rec.goal}
              </Text>
            </View>
          </View>

          {rec.goal === 'sleep' && (
            <View style={[s.card, { backgroundColor: theme.card }]}>
              <CardTitle icon='moon-outline' theme={theme}>
                {t('profile.recommendation.sleepTitle')}
              </CardTitle>
              <Text style={[s.big, { color: theme.text }]}>
                {t('profile.recommendation.hoursPerDay', {
                  value: rec.recommendedSleepHours,
                })}
              </Text>
              <Text style={{ color: theme.muted }}>
                {t('profile.recommendation.sleepNormalRange', {
                  range: rec.recommendedSleepRange,
                })}
              </Text>
              <Text style={{ color: theme.text, marginTop: 10 }}>
                {t('profile.recommendation.sleepHabit', {
                  bedtime: rec.sleepBedtime,
                  wake: rec.sleepWakeTime,
                  habit:
                    rec.habitualSleepHours !== null
                      ? fmtHours(rec.habitualSleepHours, locale)
                      : t('profile.recommendation.notCalculated'),
                })}
              </Text>
              {rec.habitualSleepHours !== null &&
                rec.habitualSleepHours < rec.recommendedSleepHours && (
                  <Text style={{ color: '#E65100', marginTop: 8 }}>
                    {t('profile.recommendation.sleepDeficit', {
                      deficit: (
                        rec.recommendedSleepHours - rec.habitualSleepHours
                      ).toFixed(1),
                    })}
                  </Text>
                )}
              {rec.habitualSleepHours !== null &&
                rec.habitualSleepHours >= rec.recommendedSleepHours && (
                  <Text style={{ color: '#4E8A47', marginTop: 8 }}>
                    {t('profile.recommendation.sleepMet')}
                  </Text>
                )}
            </View>
          )}
          {rec.goal === 'cycle' && (
            <View style={[s.card, { backgroundColor: theme.card }]}>
              <CardTitle icon='flower-outline' theme={theme}>
                {t('profile.setup.cardCycle')}
              </CardTitle>
              <Text style={{ color: theme.text }}>
                {t('profile.recommendation.cycleSummary', {
                  start: isoToLabel(rec.cycleStartDate),
                  length: rec.cycleLengthDays,
                  period: rec.periodLengthDays,
                })}
              </Text>
              <Text style={{ color: theme.text, marginTop: 10 }}>
                {t('profile.recommendation.cycleNext')}{' '}
                <Text style={{ fontWeight: '800' }}>
                  {rec.cycleNextPeriodLabel}
                </Text>
              </Text>
              <Text style={{ color: theme.text, marginTop: 4 }}>
                {t('profile.recommendation.cycleOvulation', {
                  label: rec.cycleOvulationLabel,
                })}
              </Text>
            </View>
          )}

          <View style={[s.card, { backgroundColor: theme.card }]}>
            <CardTitle icon='flash-outline' theme={theme}>
              {t('profile.recommendation.energyTitle')}
            </CardTitle>
            <View style={s.row}>
              <View style={s.badge}>
                <Text style={s.badgeText}>
                  {rec.goal === 'lose'
                    ? `−${rec.deficit}`
                    : rec.goal === 'gain'
                      ? `+${rec.surplus}`
                      : '0'}
                </Text>
                <Text style={s.badgeSub}>
                  {t('profile.recommendation.kcalPerDayUnit')}
                </Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[s.big, { color: theme.text }]}>
                  {t('profile.recommendation.kcalPerDay', {
                    value: rec.calorieTarget.toLocaleString(
                      locale === 'vi' ? 'vi-VN' : 'en-US',
                    ),
                  })}
                </Text>
                <Text style={{ color: theme.muted }}>
                  {rec.goal === 'lose'
                    ? t('profile.recommendation.deficit', {
                        value: rec.deficit,
                      })
                    : rec.goal === 'gain'
                      ? t('profile.recommendation.surplus', {
                          value: rec.surplus,
                        })
                      : t('profile.recommendation.maintainEnergy')}
                </Text>
              </View>
            </View>
            <View style={s.statRow}>
              <View style={s.stat}>
                <Text style={{ color: theme.muted }}>TDEE</Text>
                <Text style={{ color: theme.text, fontWeight: '700' }}>
                  {rec.tdee.toLocaleString(
                    locale === 'vi' ? 'vi-VN' : 'en-US',
                  )}{' '}
                  kcal
                </Text>
              </View>
              <View style={s.stat}>
                <Text style={{ color: theme.muted }}>BMR</Text>
                <Text style={{ color: theme.text, fontWeight: '700' }}>
                  {rec.bmr.toLocaleString(
                    locale === 'vi' ? 'vi-VN' : 'en-US',
                  )}{' '}
                  kcal
                </Text>
              </View>
            </View>
            <Text style={{ color: theme.muted, marginTop: 8 }}>
              {t('profile.recommendation.intensity', {
                label: rec.activityLabel,
                factor: rec.factor,
              })}
              {!isWeight
                ? t('profile.recommendation.intensityDefaultNote')
                : ''}
            </Text>
            {rec.durationLabel && (
              <Text style={{ color: theme.muted, marginTop: 4 }}>
                {t('profile.recommendation.durationPrefix', {
                  label: rec.durationLabel,
                })}
                {rec.weeklyChangeKg
                  ? t('profile.recommendation.weeklyChange', {
                      kg: rec.weeklyChangeKg,
                    })
                  : ''}
              </Text>
            )}
            {rec.ageEstimated && (
              <Text style={{ color: theme.muted, marginTop: 4 }}>
                {t('profile.recommendation.ageEstimated')}
              </Text>
            )}
            {rec.isTooFast && rec.adviceText && (
              <View style={s.advice}>
                <View style={s.adviceTitleRow}>
                  <Ionicons
                    name='alert-circle-outline'
                    size={18}
                    color='#E65100'
                  />
                  <Text style={s.adviceTitle}>
                    {t('profile.recommendation.adviceTitle')}
                  </Text>
                </View>
                <Text
                  style={{ color: theme.muted, marginTop: 4, lineHeight: 19 }}
                >
                  {rec.adviceText}
                </Text>
              </View>
            )}
          </View>

          <View style={[s.card, { backgroundColor: theme.card }]}>
            <CardTitle icon='bar-chart-outline' theme={theme}>
              {t('profile.recommendation.bmiTitle')}
            </CardTitle>
            <View style={s.row}>
              <Text style={[s.big, { color: theme.text }]}>
                {rec.bmi.toFixed(1)}
              </Text>
              <View style={[s.pill, { backgroundColor: bmiColor }]}>
                <Text style={s.pillText}>
                  {localizeBmiLabel(rec.asia.label)}
                </Text>
              </View>
            </View>
            <Text style={{ color: theme.muted }}>
              {localizeBmiRisk(rec.asia.risk)}
            </Text>
            <Text style={{ color: theme.text, marginTop: 8 }}>
              {t('profile.recommendation.heightWeight', {
                height: rec.heightCm,
                weight: rec.weightKg,
              })}
            </Text>
            <View style={s.scale}>
              {[14, 18.5, 23, 25, 30, 35].map((v, i) => null)}
              <View
                style={{
                  flexDirection: 'row',
                  height: 10,
                  borderRadius: 5,
                  overflow: 'hidden',
                }}
              >
                <View style={{ flex: 4.5, backgroundColor: '#F59E0B' }} />
                <View style={{ flex: 4.5, backgroundColor: '#4E8A47' }} />
                <View style={{ flex: 2, backgroundColor: '#D97706' }} />
                <View style={{ flex: 5, backgroundColor: '#F97316' }} />
                <View style={{ flex: 5, backgroundColor: '#EF4444' }} />
              </View>
            </View>
          </View>

          <View style={[s.card, { backgroundColor: theme.card }]}>
            <CardTitle icon='water-outline' theme={theme}>
              {t('profile.recommendation.waterTitle')}
            </CardTitle>
            <Text style={[s.big, { color: theme.text }]}>
              {t('profile.recommendation.waterPerDay', {
                value: rec.waterMl.toLocaleString(
                  locale === 'vi' ? 'vi-VN' : 'en-US',
                ),
              })}
            </Text>
            <Text style={{ color: theme.muted }}>
              {t('profile.recommendation.waterFormula', {
                cups: rec.waterCups,
                weight: rec.weightKg,
                extra: rec.waterExtra
                  ? t('profile.recommendation.waterExtra', {
                      value: rec.waterExtra,
                    })
                  : '',
              })}
            </Text>
          </View>

          {isWeight && (
            <View style={[s.card, { backgroundColor: theme.card }]}>
              <CardTitle icon='walk-outline' theme={theme}>
                {t('profile.recommendation.exerciseTitle')}
              </CardTitle>
              <Text style={[s.big, { color: theme.text }]}>
                {t('profile.recommendation.exercisePerWeek', {
                  minutes: rec.exercise.minutes,
                })}
              </Text>
              <Text style={{ color: theme.muted }}>
                {t('profile.recommendation.exerciseDesc', {
                  desc: rec.exercise.desc,
                  kcal: rec.exercise.kcalPerWeek,
                })}
              </Text>
              <View style={s.dotRow}>
                {Array.from({ length: 7 }, (_, i) => (
                  <View
                    key={i}
                    style={[
                      s.dot,
                      i < rec.exercise.sessions && {
                        backgroundColor: theme.primaryDark,
                      },
                    ]}
                  />
                ))}
              </View>
              <Text style={{ color: theme.muted, marginTop: 8 }}>
                {t('profile.recommendation.exerciseSummary', {
                  sessions: rec.exercise.sessions,
                  duration: rec.exercise.duration,
                  minutes: rec.exercise.minutes,
                })}
              </Text>
            </View>
          )}

          {(rec.goal === 'lose' || rec.goal === 'gain') && (
            <View style={[s.card, { backgroundColor: theme.card }]}>
              <CardTitle icon='flag-outline' theme={theme}>
                {t('profile.recommendation.goalChartTitle')}
              </CardTitle>
              <View style={s.barRow}>
                <View style={{ alignItems: 'center' }}>
                  <View
                    style={[s.bar, { height: 80, backgroundColor: '#D1D5DB' }]}
                  />
                  <Text style={{ color: theme.muted }}>
                    {t('profile.recommendation.currentWeight', {
                      weight: rec.weightKg,
                    })}
                  </Text>
                </View>
                <View style={{ alignItems: 'center' }}>
                  <View
                    style={[
                      s.bar,
                      {
                        height: Math.max(
                          40,
                          80 *
                            (rec.targetWeightKg /
                              Math.max(rec.weightKg, rec.targetWeightKg)),
                        ),
                        backgroundColor: theme.primaryDark,
                      },
                    ]}
                  />
                  <Text style={{ color: theme.muted }}>
                    {t('profile.recommendation.targetWeightLabel', {
                      weight: rec.targetWeightKg,
                    })}
                  </Text>
                </View>
              </View>
              <View
                style={[
                  s.pill,
                  {
                    backgroundColor: theme.primaryDark,
                    alignSelf: 'center',
                    marginTop: 12,
                  },
                ]}
              >
                <Text style={s.pillText}>
                  {t('profile.recommendation.needChange', {
                    direction:
                      rec.targetDiff > 0
                        ? t('profile.recommendation.increase')
                        : t('profile.recommendation.decrease'),
                    diff: Math.abs(rec.targetDiff),
                    label:
                      rec.durationLabel ||
                      t('profile.recommendation.durationFallback', {
                        weeks: rec.durationWeeks,
                      }),
                  })}
                </Text>
              </View>
            </View>
          )}
          {rec.goal === 'maintain' && (
            <View style={[s.card, { backgroundColor: theme.card }]}>
              <CardTitle icon='flag-outline' theme={theme}>
                {t('profile.recommendation.goalChartTitle')}
              </CardTitle>
              <View
                style={[
                  s.pill,
                  { backgroundColor: theme.primaryDark, alignSelf: 'center' },
                ]}
              >
                <Text style={s.pillText}>
                  {t('profile.recommendation.maintainRange', {
                    min: rec.healthyMinKg,
                    max: rec.healthyMaxKg,
                    label: rec.durationLabel ?? '',
                  })}
                </Text>
              </View>
            </View>
          )}

          <TouchableOpacity
            style={[s.primaryBtn, { backgroundColor: theme.primaryDark }]}
            onPress={() => navigation.replace('Main')}
          >
            <View style={s.btnRow}>
              <Text style={s.primaryBtnText}>
                {t('profile.recommendation.goHome')}
              </Text>
              <Ionicons name='arrow-forward' size={18} color='#fff' />
            </View>
          </TouchableOpacity>
          <TouchableOpacity
            style={[s.secondaryBtn, { borderColor: theme.primaryDark }]}
            onPress={() => navigation.replace('ProfileSetup')}
          >
            <Text style={[s.secondaryText, { color: theme.primaryDark }]}>
              {t('settings.editProfile')}
            </Text>
          </TouchableOpacity>
          <Text
            style={{ color: theme.muted, textAlign: 'center', marginTop: 12 }}
          >
            {t('profile.recommendation.disclaimer')}
          </Text>
        </ScrollView>
      </SafeAreaView>
    </SafeAreaProvider>
  );
}
