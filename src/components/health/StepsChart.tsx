import React from 'react';
import { Dimensions, Text, TouchableOpacity, View } from 'react-native';
import Svg, { Circle, Line, Path } from 'react-native-svg';
import { PRIMARY } from '../../features/health/constants';
import { fmt, type Range } from '../../utils/health/stepsFormat';
import { useSettings } from '../../context/SettingsContext';
import { styles } from '../../features/health/screens/StepsDetailScreen.styles';

const SAGE = '#8FBF9A';

function smoothPath(pts: { x: number; y: number }[]) {
  if (pts.length === 0) return '';
  if (pts.length === 1) return `M ${pts[0].x} ${pts[0].y}`;
  let d = `M ${pts[0].x} ${pts[0].y}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(i - 1, 0)];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[Math.min(i + 2, pts.length - 1)];
    d += ` C ${p1.x + (p2.x - p0.x) / 6} ${p1.y + (p2.y - p0.y) / 6}, ${p2.x - (p3.x - p1.x) / 6} ${p2.y - (p3.y - p1.y) / 6}, ${p2.x} ${p2.y}`;
  }
  return d;
}

// Bieu do duong tron xu huong van dong. Doi nguyen van tu
// StepsDetailScreen.
export function StepsChart({
  chartData,
  range,
  onRangeChange,
  chartAvg,
  todaySteps,
  goal,
}: {
  chartData: { label: string; steps: number }[];
  range: Range;
  onRangeChange: (r: Range) => void;
  chartAvg: number;
  todaySteps: number;
  goal: number;
}) {
  const { t } = useSettings();
  // Biểu đồ đường trơn
  const chartW = Dimensions.get('window').width - 64;
  const chartH = 160;
  const maxY = Math.max(...chartData.map((x) => x.steps), goal, 1000) * 1.15;
  const pts = chartData.map((x, i) => ({
    x:
      chartData.length === 1
        ? chartW / 2
        : 10 + (i * (chartW - 20)) / (chartData.length - 1),
    y: chartH - 20 - (x.steps / maxY) * (chartH - 40),
  }));
  const goalY = chartH - 20 - (goal / maxY) * (chartH - 40);
  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>{t('steps.trendTitle')}</Text>
      <Text style={styles.cardText}>
        {range === 'today'
          ? t('steps.todaySteps', { steps: fmt(todaySteps) })
          : t('steps.avgSteps', {
              avg: fmt(chartAvg),
              n: chartData.length,
            })}
      </Text>
      <View style={styles.switchRow}>
        {(['today', 'week', 'month'] as Range[]).map((r) => (
          <TouchableOpacity
            key={r}
            style={[styles.switchBtn, range === r && styles.switchActive]}
            onPress={() => onRangeChange(r)}
          >
            <Text
              style={[
                styles.switchText,
                range === r && styles.switchTextActive,
              ]}
            >
              {r === 'today'
                ? t('home.today')
                : r === 'week'
                  ? t('steps.week')
                  : t('steps.month')}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
      <Svg width={chartW} height={chartH}>
        <Line
          x1={0}
          y1={goalY}
          x2={chartW}
          y2={goalY}
          stroke={SAGE}
          strokeWidth={1}
          strokeDasharray='6 6'
        />
        <Path
          d={smoothPath(pts)}
          stroke={PRIMARY}
          strokeWidth={2.5}
          fill='none'
        />
        {pts.map((p, i) => (
          <Circle
            key={i}
            cx={p.x}
            cy={p.y}
            r={4}
            fill={PRIMARY}
            stroke='#fff'
            strokeWidth={1.5}
          />
        ))}
      </Svg>
      <View style={styles.xLabels}>
        {chartData.map((x, i) => (
          <Text key={i} style={styles.xLabel}>
            {range === 'month'
              ? i % 5 === 0 || i === chartData.length - 1
                ? x.label
                : ''
              : x.label}
          </Text>
        ))}
      </View>
    </View>
  );
}
