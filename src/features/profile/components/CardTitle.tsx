import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { IconBadge } from '../../../components/ui/IconBadge';

// Tiêu đề thẻ có icon, thay cho tiêu đề gắn emoji ở đầu.
// Dùng chung cho ProfileSetup và Recommendation (trước đây mỗi màn hình
// tự viết một bản giống hệt nhau). Style dời nguyên văn từ cả hai màn
// hình (hai bản giống hệt nhau).
export function CardTitle({ icon, children, theme }: any) {
  return (
    <View style={s.cardTitleRow}>
      <IconBadge name={icon} />
      <Text style={[s.cardTitle, { color: theme.text, marginBottom: 0 }]}>
        {children}
      </Text>
    </View>
  );
}

const s = StyleSheet.create({
  cardTitle: { fontSize: 17, fontWeight: '800', marginBottom: 10 },
  cardTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 10,
  },
});
