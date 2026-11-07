import React from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import type { makeStyles } from '../../features/home/screens/HomeScreen.styles';

// Tach nguyen van tu HomeScreen.tsx: the hoi "Ban da day chua?" khi
// phien ngu qua gio ma chua duoc xac nhan. Style lay tu makeStyles
// chung cua man hinh.
export function WakePromptCard({
  title,
  desc,
  wokeUpText,
  stillSleepingText,
  onFinish,
  onDismiss,
  s,
}: {
  title: string;
  desc: string;
  wokeUpText: string;
  stillSleepingText: string;
  onFinish: () => void;
  onDismiss: () => void;
  s: ReturnType<typeof makeStyles>;
}) {
  return (
    <View style={s.wakeCard}>
      <Text style={s.cardTitle}>{title}</Text>
      <Text style={s.muted}>{desc}</Text>
      <TouchableOpacity style={s.primaryBtn} onPress={onFinish}>
        <Text style={s.primaryBtnText}>{wokeUpText}</Text>
      </TouchableOpacity>
      <TouchableOpacity style={s.ghostBtn} onPress={onDismiss}>
        <Text style={s.ghostBtnText}>{stillSleepingText}</Text>
      </TouchableOpacity>
    </View>
  );
}
