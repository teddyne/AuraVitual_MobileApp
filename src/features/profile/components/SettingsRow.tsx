import React from 'react';
import { Alert, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { s } from '../screens/ProfileSettingsScreen.styles';

// Icon kiểu ảnh bạn gửi: vòng tròn nhạt + icon xanh đậm.
// solid = true thì vòng xanh đặc + icon trắng (dùng cho hàng Chat).
// Dời nguyên văn từ screens/ProfileSettingsScreen.tsx (component Row);
// style s.row / s.iconBadge / s.rowTitle / s.muted / s.rowRight vẫn nằm
// trong ProfileSettingsScreen.styles.ts vì màn hình cũng dùng trực tiếp.
export function Row({ icon, solid, title, sub, right, onPress, theme, dark }: any) {
  const iconBg = solid ? '#2E7D32' : dark ? theme.cardAlt : '#EAF0FF';
  const iconColor = solid ? '#fff' : '#2E7D32';
  return (
    <TouchableOpacity
      style={[s.row, { backgroundColor: theme.card }]}
      onPress={
        onPress ||
        (() =>
          Alert.alert(
            'Chưa làm',
            'Mục này chưa nối dữ liệu thật, chỉ là hàng giao diện.',
          ))
      }
    >
      <View style={[s.iconBadge, { backgroundColor: iconBg }]}>
        <Ionicons name={icon} size={22} color={iconColor} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[s.rowTitle, { color: theme.text }]}>{title}</Text>
        {sub && <Text style={[s.muted, { color: theme.muted }]}>{sub}</Text>}
      </View>
      {right ? (
        <Text style={[s.rowRight, { color: theme.primaryDark }]}>{right}</Text>
      ) : (
        <Ionicons name='chevron-forward' size={20} color={theme.muted} />
      )}
    </TouchableOpacity>
  );
}
