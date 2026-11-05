import React from 'react';
import { Text, View } from 'react-native';
import type { makeStyles } from '../screens/HomeScreen.styles';

// Tach nguyen van tu HomeScreen.tsx: khoi hero diem suc khoe (vong tron
// diem + tieu de + mo ta). Cac chuoi hien thi do man hinh dich bang tr()
// roi truyen xuong; style lay tu makeStyles chung cua man hinh (prop s).
export function HealthScoreHero({
  score,
  scoreLabel,
  title,
  desc,
  s,
}: {
  score: number | null;
  scoreLabel: string;
  title: string;
  desc: string;
  s: ReturnType<typeof makeStyles>;
}) {
  return (
    <View style={s.hero}>
      <View style={s.scoreCircle}>
        <Text style={s.score}>{score == null ? '--' : score}</Text>
        <Text style={s.scoreLabel}>{scoreLabel}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={s.heroTitle}>🌿 {title}</Text>
        <Text style={s.heroText}>{desc}</Text>
      </View>
    </View>
  );
}
