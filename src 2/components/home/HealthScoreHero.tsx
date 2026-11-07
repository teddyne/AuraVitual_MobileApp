import React from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { makeStyles } from '../../features/home/screens/HomeScreen.styles';

// Tach nguyen van tu HomeScreen.tsx: khoi hero diem suc khoe (vong tron
// diem + tieu de + mo ta). Cac chuoi hien thi do man hinh dich bang tr()
// roi truyen xuong; style lay tu makeStyles chung cua man hinh (prop s).
// Bấm vào hero sẽ mở trang Dữ liệu sức khỏe tổng hợp (prop onPress).
export function HealthScoreHero({
  score,
  scoreLabel,
  title,
  desc,
  s,
  onPress,
  detailsText,
}: {
  score: number | null;
  scoreLabel: string;
  title: string;
  desc: string;
  s: ReturnType<typeof makeStyles>;
  onPress?: () => void;
  detailsText?: string;
}) {
  return (
    <TouchableOpacity
      style={s.hero}
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole={onPress ? 'button' : undefined}
      activeOpacity={0.7}
    >
      <View style={s.scoreCircle}>
        <Text style={s.score}>{score == null ? '--' : score}</Text>
        <Text style={s.scoreLabel}>{scoreLabel}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={s.heroTitle}>🌿 {title}</Text>
        <Text style={s.heroText}>{desc}</Text>
        {onPress && detailsText ? (
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              marginTop: 8,
              gap: 2,
            }}
          >
            <Text style={{ color: '#2E7D32', fontWeight: '700', fontSize: 13 }}>
              {detailsText}
            </Text>
            <Ionicons name='chevron-forward' size={16} color='#2E7D32' />
          </View>
        ) : null}
      </View>
    </TouchableOpacity>
  );
}
