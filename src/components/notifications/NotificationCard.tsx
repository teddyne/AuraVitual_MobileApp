import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSettings, type ThemePalette } from '../../context/SettingsContext';
import { AppIcon, type AppIconName } from '../ui/AppIcon';
import { timeAgo } from '../../api/familyApi';
import { PRIMARY } from '../../features/notifications/constants';
import type { DisplayItem } from '../../utils/notifications/notificationDisplay';

// Icon của thẻ: Ionicons theo loại thông báo (đồng bộ toàn app).
// Lịch sử cũ lưu icon emoji (💧🍽🌙🏆...) nên map cả 2 dạng: emoji cũ
// và tên Ionicons, để thẻ cũ vẫn hiện đúng icon mới.
function iconFor(item: DisplayItem): AppIconName {
  const byEmoji: Record<string, AppIconName> = {
    '💧': 'water-outline',
    '🍽': 'restaurant-outline',
    '🌙': 'moon-outline',
    '⏰': 'alarm-outline',
    '🏆': 'trophy-outline',
    '👨‍👩‍👧': 'people-outline',
  };
  if (byEmoji[item.icon]) return byEmoji[item.icon];
  if (item.icon.endsWith('-outline') || item.icon.endsWith('-sharp')) {
    return item.icon as AppIconName;
  }
  if (item.kind === 'family') return 'people-outline';
  if (item.kind === 'milestone') return 'trophy-outline';
  return 'notifications-outline';
}

// The thong bao trong NotificationsScreen (doi nguyen van).
export function NotificationCard({
  item,
  theme,
  onPress,
  onHide,
  onInviteAccept,
  onInviteDecline,
}: {
  item: DisplayItem;
  theme: ThemePalette;
  onPress: () => void;
  onHide: () => void;
  onInviteAccept: () => void;
  onInviteDecline: () => void;
}) {
  const { t } = useSettings();
  const unread = !item.read;
  return (
    <TouchableOpacity
      style={[styles.card, { backgroundColor: theme.card }]}
      onPress={onPress}
    >
      <View
        style={[styles.iconCircle, { backgroundColor: item.iconBg }]}
      >
        <AppIcon name={iconFor(item)} size={22} tone='primaryDark' />
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
                {t('family.accept')}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.inviteDecline}
              onPress={onInviteDecline}
            >
              <Text style={styles.inviteDeclineText}>
                {t('family.decline')}
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
