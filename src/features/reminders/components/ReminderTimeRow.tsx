import React from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import type { ThemePalette } from '../../../context/SettingsContext';

// Hang nhap gio (HH:MM) trong RemindersScreen (doi nguyen van).
export function ReminderTimeRow({
  label,
  value,
  placeholder,
  theme,
  onChangeText,
  onBlur,
}: {
  label: string;
  value: string;
  placeholder: string;
  theme: ThemePalette;
  onChangeText: (v: string) => void;
  onBlur: () => void;
}) {
  return (
    <View style={styles.timeRow}>
      <Text style={[styles.rowTitle, { color: theme.text }]}>
        {label}
      </Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        onBlur={onBlur}
        keyboardType='numbers-and-punctuation'
        placeholder={placeholder}
        placeholderTextColor={theme.muted}
        maxLength={5}
        style={[
          styles.timeInput,
          { backgroundColor: theme.cardAlt, color: theme.text },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  rowTitle: { fontWeight: '800' },
  timeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
  },
  timeInput: {
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 14,
    width: 90,
    textAlign: 'center',
    fontWeight: '800',
  },
});
