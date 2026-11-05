import React from 'react';
import { Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Circle } from 'react-native-svg';
import { PRIMARY } from '../constants';
import { fmt } from '../utils/stepsFormat';
import { useSettings } from '../../../context/SettingsContext';
import { styles } from '../screens/StepsDetailScreen.styles';

// Vong gauge 3/4: cung 270 do, ho 90 do o phia duoi. Doi nguyen van tu
// StepsDetailScreen.
export function StepsGauge({
  todaySteps,
  goal,
  percent,
}: {
  todaySteps: number;
  goal: number;
  percent: number;
}) {
  const { t } = useSettings();
  const R = 82;
  const C = 2 * Math.PI * R;
  const arc = 0.75 * C;
  return (
    <View style={styles.card}>
      <View style={{ alignItems: 'center' }}>
        <Svg width={230} height={230} viewBox='0 0 200 200'>
          <Circle
            cx={100}
            cy={100}
            r={R}
            stroke='#E3EBE6'
            strokeWidth={16}
            fill='none'
            strokeDasharray={`${arc} ${C - arc}`}
            transform='rotate(135 100 100)'
            strokeLinecap='round'
          />
          <Circle
            cx={100}
            cy={100}
            r={R}
            stroke={PRIMARY}
            strokeWidth={16}
            fill='none'
            strokeDasharray={`${percent * arc} ${C - percent * arc}`}
            transform='rotate(135 100 100)'
            strokeLinecap='round'
          />
        </Svg>
        <View style={styles.gaugeCenter}>
          <Text style={styles.gaugeNumber}>{fmt(todaySteps)}</Text>
          <Text style={styles.gaugeSub}>
            {t('steps.ofGoal', { goal: fmt(goal) })}
          </Text>
        </View>
      </View>
      <View style={styles.banner}>
        <Ionicons name='trophy-outline' size={18} color={PRIMARY} />
        <Text style={styles.bannerText}>
          {percent >= 1
            ? t('steps.goalReached')
            : t('steps.goalProgress', {
                pct: Math.round(percent * 100),
              })}
        </Text>
      </View>
    </View>
  );
}
