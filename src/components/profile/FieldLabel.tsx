import React from 'react';
import { Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { s } from '../../features/profile/screens/ProfileSetupScreen.styles';

// Nhãn trường có icon nhỏ, thay cho nhãn gắn emoji.
// Dời nguyên văn từ screens/ProfileSetupScreen.tsx; style s.label /
// s.labelRow vẫn nằm trong ProfileSetupScreen.styles.ts vì màn hình
// cũng dùng trực tiếp.
export function FieldLabel({ icon, children, theme }: any) {
  return (
    <View style={s.labelRow}>
      <Ionicons name={icon} size={18} color="#2E7D32" />
      <Text style={[s.label, { color: theme.text, marginTop: 0, marginBottom: 0 }]}>
        {children}
      </Text>
    </View>
  );
}
