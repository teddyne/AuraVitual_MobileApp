import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import type { ThemePalette } from '../../../context/SettingsContext';
import { GREY_PILL, PRIMARY } from '../constants';
import type { NotificationFilter } from '../utils/notificationDisplay';

// Hang vien loc trong NotificationsScreen (doi nguyen van).
export function NotificationFilterTabs({
  tabs,
  filter,
  unreadCount,
  theme,
  onSelect,
}: {
  tabs: { id: NotificationFilter; label: string }[];
  filter: NotificationFilter;
  unreadCount: number;
  theme: ThemePalette;
  onSelect: (f: NotificationFilter) => void;
}) {
  return (
    <View style={styles.tabRow}>
      {tabs.map((t) => (
        <TouchableOpacity
          key={t.id}
          style={[
            styles.tabPill,
            {
              backgroundColor: filter === t.id ? PRIMARY : GREY_PILL,
            },
          ]}
          onPress={() => onSelect(t.id)}
        >
          <Text
            style={[
              styles.tabText,
              { color: filter === t.id ? '#fff' : theme.text },
            ]}
          >
            {t.label}
            {t.id === 'all' ? ` ${unreadCount}` : ''}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  tabRow: { flexDirection: 'row', gap: 8 },
  tabPill: { borderRadius: 999, paddingVertical: 8, paddingHorizontal: 14 },
  tabText: { fontWeight: '700' },
});
