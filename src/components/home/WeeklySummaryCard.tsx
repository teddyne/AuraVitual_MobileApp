import React from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { fmt, fmtHoursMinutes, fmtSleepHours } from './homeFormat';
import { type WeeklySummary } from '../../lib/workoutApi';
import { useSettings } from '../../context/SettingsContext';
import { styles } from './HomeSections.styles';

export function WeeklySummaryCard({
  summary,
  onPressWorkout,
}: {
  summary: WeeklySummary | null;
  onPressWorkout: () => void;
}) {
  const { t } = useSettings();
  return (
    <View style={styles.weeklyWrap}>
      <View style={styles.sectionHead}>
        <View>
          <Text style={[styles.sectionTitle, { color: '#000' }]}>
            {t('home.weeklyTitle')}
          </Text>
        </View>
        <View style={styles.sparkle}>
          <Ionicons name='sparkles' size={20} color='#2E7D32' />
        </View>
      </View>
      <View style={styles.grid}>
        <View style={styles.miniCard}>
          <Text style={styles.miniLabel}>{t('home.totalSteps')}</Text>
          <Text style={styles.miniBig}>
            {summary ? fmt(summary.stepsTotal) : '—'}
          </Text>
          <Text style={styles.miniSub}>
            {summary && summary.stepsChangePct != null
              ? t('home.vsLastWeek', {
                  pct: `${summary.stepsChangePct >= 0 ? '+' : ''}${summary.stepsChangePct}%`,
                })
              : t('home.noPrevWeekData')}
          </Text>
        </View>
        <TouchableOpacity style={styles.miniCard} onPress={onPressWorkout}>
          <Text style={styles.miniLabel}>{t('home.totalWorkout')}</Text>
          <Text style={styles.miniBig}>
            {summary ? fmtHoursMinutes(summary.workoutMinutes) : '—'}
          </Text>
          <Text style={styles.miniSub}>
            {summary
              ? t('home.sessionsEst', {
                  sessions: summary.workoutSessions,
                  kcal: fmt(summary.workoutKcal),
                })
              : ''}
          </Text>
          <Text style={styles.miniLink}>{t('home.logWorkout')}</Text>
        </TouchableOpacity>
        <View style={styles.miniCard}>
          <Text style={styles.miniLabel}>{t('home.totalWater')}</Text>
          <Text style={styles.miniBig}>
            {summary ? `${fmt(summary.waterTotalMl)} ml` : '—'}
          </Text>
          <Text style={styles.miniSub}>
            {summary && summary.waterAvgPctOfGoal != null
              ? t('home.waterAvgPct', { pct: summary.waterAvgPctOfGoal })
              : t('home.noWaterGoal')}
          </Text>
        </View>
        <View style={styles.miniCard}>
          <Text style={styles.miniLabel}>{t('home.totalSleep')}</Text>
          <Text style={styles.miniBig}>
            {summary ? fmtSleepHours(summary.sleepTotalHours) : '—'}
          </Text>
          <Text style={styles.miniSub}>
            {summary
              ? t('home.sleepAvg', { hours: summary.sleepAvgHours })
              : ''}
          </Text>
        </View>
      </View>
    </View>
  );
}

