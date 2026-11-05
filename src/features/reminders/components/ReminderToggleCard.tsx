import React from 'react';
import { StyleSheet, Switch, Text, View } from 'react-native';
import type { ThemePalette } from '../../../context/SettingsContext';

// The bat/tat mot loai nhac trong RemindersScreen (doi nguyen van).
// children = noi dung mo rong ben duoi hang chinh (khung gio nuoc,
// o nhap gio, vien chon so ngay...). dimmed = mo khi tat nhac chung.
export function ReminderToggleCard({
  icon,
  title,
  desc,
  value,
  disabled,
  dimmed,
  theme,
  onValueChange,
  children,
}: {
  icon: string;
  title: string;
  desc: string;
  value: boolean;
  disabled?: boolean;
  dimmed?: boolean;
  theme: ThemePalette;
  onValueChange: (v: boolean) => void;
  children?: React.ReactNode;
}) {
  return (
    <View
      style={[
        styles.card,
        { backgroundColor: theme.card },
        dimmed && { opacity: 0.5 },
      ]}
    >
      <View style={styles.row}>
        <Text style={styles.icon}>{icon}</Text>
        <View style={{ flex: 1 }}>
          <Text style={[styles.rowTitle, { color: theme.text }]}>
            {title}
          </Text>
          <Text style={[styles.muted, { color: theme.muted }]}>
            {desc}
          </Text>
        </View>
        <Switch
          disabled={disabled}
          value={value}
          onValueChange={onValueChange}
          trackColor={{ false: '#CCCCCC', true: theme.primaryDark }}
          thumbColor='#FFFFFF'
        />
      </View>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 16, padding: 14, marginTop: 8 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  icon: { fontSize: 22 },
  rowTitle: { fontWeight: '800' },
  muted: { lineHeight: 18, marginTop: 2 },
});
