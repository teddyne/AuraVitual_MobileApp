import React from 'react';
import { Text, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { PRIMARY } from '../constants';
import { styles } from '../screens/CycleTrackingScreen.styles';

const R = 102;
const CIRC = 2 * Math.PI * R;

// Vong tron tien do chu ky, doi nguyen van tu CycleTrackingScreen.
export function CycleHeroRing({
  progress,
  daysUntilNext,
  phase,
}: {
  progress: number;
  daysUntilNext: number | null;
  phase: string;
}) {
  return (
    <View style={styles.heroRingWrap}>
      <Svg width={280} height={280} viewBox='0 0 240 240'>
        <Circle
          cx={120}
          cy={120}
          r={R}
          stroke='#F3D9D9'
          strokeWidth={16}
          fill='none'
        />
        <Circle
          cx={120}
          cy={120}
          r={R}
          stroke={PRIMARY}
          strokeWidth={16}
          fill='none'
          strokeDasharray={`${progress * CIRC} ${CIRC - progress * CIRC}`}
          transform='rotate(-90 120 120)'
          strokeLinecap='round'
        />
      </Svg>
      <View style={styles.heroCenter}>
        <Text style={styles.heroLabel}>CHU KỲ HIỆN TẠI</Text>
        {daysUntilNext !== null && daysUntilNext >= 0 ? (
          <>
            <Text style={styles.heroMain}>Kỳ sau</Text>
            <Text style={styles.heroDays}>
              {daysUntilNext === 0 ? 'Hôm nay' : `${daysUntilNext} ngày`}
            </Text>
          </>
        ) : (
          <>
            <Text style={styles.heroMain}>Đã quá</Text>
            <Text style={styles.heroDays}>
              {daysUntilNext !== null ? `${-daysUntilNext} ngày` : ''}
            </Text>
          </>
        )}
        <Text style={styles.heroPhase}>● {phase}</Text>
      </View>
    </View>
  );
}
