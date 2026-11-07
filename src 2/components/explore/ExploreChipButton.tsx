import React from 'react';
import { StyleSheet, Text, TouchableOpacity } from 'react-native';

// Nut chip loc trong ExploreScreen (doi nguyen van tu ham chipBtn).
export function ExploreChipButton({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      style={[styles.chip, active && styles.chipActive]}
      onPress={onPress}
    >
      <Text style={[styles.chipText, active && styles.chipTextActive]}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: '#EEF1FF',
    marginRight: 8,
  },
  chipActive: { backgroundColor: '#2E7D32' },
  chipText: { fontSize: 14, color: '#5B665E' },
  chipTextActive: { color: '#fff', fontWeight: '700' },
});
