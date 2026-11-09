import React from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { formatNumber } from '../../api/auravitalApi';
import type { makeStyles } from '../../features/home/screens/HomeScreen.styles';

// Tach nguyen van tu HomeScreen.tsx: the nuoc uong (so ml + hang coc
// bam de them/bot 250 ml). Style lay tu makeStyles chung cua man hinh.
export function WaterCard({
  water,
  waterGoal,
  filled,
  cupCount,
  isToday,
  onGlassPress,
  onOpenDetail,
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
  // Bấm vào tiêu đề thì mở trang nước uống riêng (nhập lượng linh hoạt).
  onOpenDetail?: () => void;
  title: string;
  readOnlyText: string;
  s: ReturnType<typeof makeStyles>;
}) {
  return (
    <View style={s.card}>
      <TouchableOpacity
        style={s.rowBetween}
        onPress={onOpenDetail}
        disabled={!onOpenDetail}
        activeOpacity={0.7}
      >
        <Text style={s.cardTitle}>{title}</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
          <Text style={s.waterValue}>
            {formatNumber(water)}
            <Text style={s.muted}>
              {waterGoal > 0 ? `/${formatNumber(waterGoal)} ml` : ' ml'}
            </Text>
          </Text>
          {onOpenDetail ? (
            <Ionicons name='chevron-forward' size={18} color='#8A968E' />
          ) : null}
        </View>
      </TouchableOpacity>
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
