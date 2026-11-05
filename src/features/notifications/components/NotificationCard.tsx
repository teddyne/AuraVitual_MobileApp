import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import type { ThemePalette } from '../../../context/SettingsContext';
import { timeAgo } from '../../../lib/familyApi';
import { PRIMARY } from '../constants';
import type { DisplayItem } from '../utils/notificationDisplay';

// The thong bao trong NotificationsScreen (doi nguyen van).
export function NotificationCard({
  item,
  theme,
  vi,
  onPress,
  onHide,
  onInviteAccept,
  onInviteDecline,
}: {
  item: DisplayItem;
  theme: ThemePalette;
  vi: boolean;
  onPress: () => void;
  onHide: () => void;
  onInviteAccept: () => void;
  onInviteDecline: () => void;
}) {
  const unread = !item.read;
  return (
    <TouchableOpacity
      style={[styles.card, { backgroundColor: theme.card }]}
      onPress={onPress}
    >
      <View
        style={[styles.iconCircle, { backgroundColor: item.iconBg }]}
      >
        <Text style={styles.iconText}>{item.icon}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <View style={styles.cardTop}>
          <Text style={[styles.category, { color: PRIMARY }]}>
            {item.category}
          </Text>
          <Text style={[styles.timeLabel, { color: theme.muted }]}>
            {timeAgo(new Date(item.time).toISOString())}
          </Text>
          {unread && <Text style={{ color: PRIMARY }}>●</Text>}
        </View>
        <Text style={[styles.cardTitle, { color: theme.text }]}>
          {item.title}
        </Text>
        <Text style={[styles.cardBody, { color: theme.text }]}>
          {item.body}
        </Text>
        {item.invite && (
          <View style={styles.inviteRow}>
            <TouchableOpacity
              style={styles.inviteAccept}
              onPress={onInviteAccept}
            >
              <Text style={styles.inviteAcceptText}>
                {vi ? 'Đồng ý' : 'Accept'}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.inviteDecline}
              onPress={onInviteDecline}
            >
              <Text style={styles.inviteDeclineText}>
                {vi ? 'Từ chối' : 'Decline'}
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
      <TouchableOpacity onPress={onHide}>
        <Text style={{ color: theme.muted, fontSize: 16 }}>
          ✕
        </Text>
      </TouchableOpacity>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    gap: 12,
    borderRadius: 16,
    padding: 14,
    marginTop: 10,
  },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconText: { fontSize: 20 },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  category: { fontSize: 11, fontWeight: '800' },
  timeLabel: { fontSize: 12 },
  cardTitle: { fontSize: 15, fontWeight: '800', marginTop: 2 },
  cardBody: { lineHeight: 20, marginTop: 4 },
  inviteRow: { flexDirection: 'row', gap: 8, marginTop: 10 },
  inviteAccept: {
    backgroundColor: PRIMARY,
    borderRadius: 999,
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  inviteAcceptText: { fontWeight: '800', color: '#fff' },
  inviteDecline: {
    borderRadius: 999,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  inviteDeclineText: { fontWeight: '800', color: '#111' },
});
