import React from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { formatNumber } from '../../../lib/auravitalApi';
import type { makeStyles } from '../screens/HomeScreen.styles';

// Tach nguyen van tu HomeScreen.tsx: the nuoc uong (so ml + hang coc
// bam de them/bot 250 ml). Style lay tu makeStyles chung cua man hinh.
export function WaterCard({
  water,
  waterGoal,
  filled,
  cupCount,
  isToday,
  onGlassPress,
  title,
  readOnlyText,
  s,
}: {
  water: number;
  waterGoal: number;
  filled: number;
  cupCount: number;
  isToday: boolean;
  onGlassPress: (index: number) => void;
  title: string;
  readOnlyText: string;
  s: ReturnType<typeof makeStyles>;
}) {
  return (
    <View style={s.card}>
      <View style={s.rowBetween}>
        <Text style={s.cardTitle}>{title}</Text>
        <Text style={s.waterValue}>
          {formatNumber(water)}
          <Text style={s.muted}>
            {waterGoal > 0 ? `/${formatNumber(waterGoal)} ml` : ' ml'}
          </Text>
        </Text>
      </View>
      <View style={s.glasses}>
        {Array.from({ length: cupCount }).map((_, i) => (
          <TouchableOpacity
            key={i}
            disabled={!isToday}
            style={[
              s.glass,
              i < filled && s.glassFilled,
              i === filled && isToday && s.glassNext,
            ]}
            onPress={() => onGlassPress(i)}
          >
            <Ionicons
              name={
                i < filled
                  ? 'water'
                  : i === filled && isToday
                    ? 'add'
                    : 'water-outline'
              }
              size={20}
              color={
                i < filled
                  ? '#fff'
                  : i === filled && isToday
                    ? '#2196F3'
                    : '#90CAF9'
              }
            />
          </TouchableOpacity>
        ))}
      </View>
      {!isToday && <Text style={s.muted}>{readOnlyText}</Text>}
    </View>
  );
}
