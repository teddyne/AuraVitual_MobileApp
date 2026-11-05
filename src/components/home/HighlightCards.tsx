import React from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { fmt, fmtSleepHours } from './homeFormat';
import { useSettings } from '../../context/SettingsContext';
import { styles } from './HomeSections.styles';

function ProgressBar({ pct, color }: { pct: number; color: string }) {
  const clamped = Math.max(0, Math.min(100, pct));
  return (
    <View style={styles.barTrack}>
      <View
        style={[
          styles.barFill,
          { width: `${clamped}%`, backgroundColor: color },
        ]}
      />
    </View>
  );
}

function IconCircle({ bg, name }: { bg: string; name: any }) {
  return (
    <View style={[styles.iconCircle, { backgroundColor: bg }]}>
      <Ionicons name={name} size={19} color='#fff' />
    </View>
  );
}

export type HighlightProps = {
  steps: number | null;
  stepGoal: number | null;
  daysToPeriod: number | null; // null = chưa có dữ liệu chu kỳ
  cyclePhaseLabel: string | null; // ví dụ "Pha nang noãn", null thì ẩn dòng này
  sleepHours: number | null;
  sleepGoalHours: number | null;
  kcal: number | null;
  calorieGoal: number | null;
  onSteps: () => void;
  onCycle: () => void;
  onSleep: () => void;
  onNutrition: () => void;
};

export function HighlightCards(p: HighlightProps) {
  const { t } = useSettings();
  const stepPct =
    p.steps != null && p.stepGoal ? (p.steps / p.stepGoal) * 100 : 0;
  const sleepPct =
    p.sleepHours != null && p.sleepGoalHours
      ? (p.sleepHours / p.sleepGoalHours) * 100
      : 0;
  const kcalPct =
    p.kcal != null && p.calorieGoal ? (p.kcal / p.calorieGoal) * 100 : 0;
  return (
    <View>
      <View style={styles.sectionHead}>
        <Text style={styles.sectionTitle}>{t('home.highlights')}</Text>
      </View>
      <View style={styles.grid}>
        <TouchableOpacity
          style={[styles.card, { backgroundColor: '#EAF6EC' }]}
          onPress={p.onSteps}
        >
          <IconCircle bg='#2E7D32' name='walk' />
          <Text style={styles.big}>{p.steps != null ? fmt(p.steps) : '—'}</Text>
          <Text style={styles.cardLabel}>{t('home.steps')}</Text>
          <ProgressBar pct={stepPct} color='#2E7D32' />
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.card, { backgroundColor: '#FDECEC' }]}
          onPress={p.onCycle}
        >
          <IconCircle bg='#D96C6C' name='heart' />
          <Text style={[styles.big, { color: '#B23A3A' }]}>
            {p.daysToPeriod != null
              ? `${p.daysToPeriod} ${t('home.dayUnit')}`
              : '—'}
          </Text>
          <Text style={styles.cardLabel}>{t('home.nextPeriod')}</Text>
          {p.cyclePhaseLabel ? (
            <Text style={styles.phase}>● {p.cyclePhaseLabel}</Text>
          ) : null}
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.card, { backgroundColor: '#EAF0FF' }]}
          onPress={p.onSleep}
        >
          <IconCircle bg='#5B6FD6' name='moon' />
          <Text style={styles.big}>
            {p.sleepHours != null ? fmtSleepHours(p.sleepHours) : '—'}
          </Text>
          <Text style={styles.cardLabel}>{t('home.goodSleep')}</Text>
          <ProgressBar pct={sleepPct} color='#5B6FD6' />
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.card, { backgroundColor: '#FFF6E3' }]}
          onPress={p.onNutrition}
        >
          <IconCircle bg='#E9A23B' name='restaurant' />
          <Text style={styles.big}>
            {p.kcal != null ? fmt(p.kcal) : '—'}
            <Text style={styles.big}> kcal</Text>
          </Text>
          <Text style={styles.cardLabel}>{t('home.energy')}</Text>
          <ProgressBar pct={kcalPct} color='#E9A23B' />
        </TouchableOpacity>
      </View>
    </View>
  );
}

