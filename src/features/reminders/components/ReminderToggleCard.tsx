import React from 'react';
import { StyleSheet, Switch, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { ThemePalette } from '../../../context/SettingsContext';

// The bat/tat mot loai nhac trong RemindersScreen.
export function ReminderToggleCard({
  title,
  desc,
  value,
  disabled,
  dimmed,
  theme,
  onValueChange,
  expandable,
  expanded,
  onToggleExpand,
  summary,
  children,
}: {
  title: string;
  desc: string;
  value: boolean;
  disabled?: boolean;
  dimmed?: boolean;
  theme: ThemePalette;
  onValueChange: (v: boolean) => void;
  expandable?: boolean;
  expanded?: boolean;
  onToggleExpand?: () => void;
  summary?: React.ReactNode;
  children?: React.ReactNode;
}) {
  const canExpand = !!expandable && !!value;
  return (
    <View
      style={[
        styles.card,
        { backgroundColor: theme.card },
        dimmed && { opacity: 0.5 },
      ]}
    >
      <View style={styles.row}>
        <TouchableOpacity
          style={{ flex: 1 }}
          activeOpacity={canExpand ? 0.7 : 1}
          onPress={canExpand ? onToggleExpand : undefined}
        >
          <Text style={[styles.rowTitle, { color: theme.text }]}>
            {title}
          </Text>
          <Text style={[styles.muted, { color: theme.muted }]}>{desc}</Text>
        </TouchableOpacity>
        <Switch
          disabled={disabled}
          value={value}
          onValueChange={onValueChange}
          trackColor={{ false: '#CCCCCC', true: theme.primaryDark }}
          thumbColor='#FFFFFF'
        />
        {canExpand && (
          <TouchableOpacity onPress={onToggleExpand} hitSlop={8}>
            <Ionicons
              name={expanded ? 'chevron-up' : 'chevron-down'}
              size={20}
              color={theme.muted}
            />
          </TouchableOpacity>
        )}
      </View>
      {!expanded && value && summary ? (
        <View style={styles.summaryWrap}>{summary}</View>
      ) : null}
      {expanded && children ? (
        <View style={[styles.detailWrap, { borderTopColor: theme.border }]}>
          {children}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 20, padding: 16, marginTop: 12 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  rowTitle: { fontSize: 16, fontWeight: '700' },
  muted: { fontSize: 13, lineHeight: 18, marginTop: 3 },
  summaryWrap: { marginTop: 12 },
  detailWrap: { borderTopWidth: 1, marginTop: 12 },
});
