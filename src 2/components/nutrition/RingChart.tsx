import React from 'react';
import { Text, View } from 'react-native';
import Svg, { Circle, G } from 'react-native-svg';
import { MACRO_COLORS } from '../../features/nutrition/constants';

export function RingChart({
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
