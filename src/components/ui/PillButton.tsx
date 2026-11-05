import React, { type ReactNode } from 'react';
import { StyleSheet, Text, TouchableOpacity } from 'react-native';
import { colors } from '../../theme/colors';

// Nút pill màu Xanh Sage, dùng chung cho cả 3 màn hình.
export function PillButton({
  title,
  onPress,
  disabled,
}: {
  title: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <TouchableOpacity
      style={[styles.pill, disabled && styles.pillDisabled]}
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.85}
    >
      <Text style={styles.pillText}>{title}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  pill: {
    backgroundColor: colors.sage,
    borderRadius: 999,
    paddingVertical: 15,
    alignItems: 'center',
  },
  pillDisabled: { opacity: 0.5 },
  pillText: { color: colors.white, fontSize: 16, fontWeight: '700' },
});
