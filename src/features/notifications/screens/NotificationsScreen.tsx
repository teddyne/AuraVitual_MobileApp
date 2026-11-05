import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  RefreshControl,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSettings } from '../../../context/SettingsContext';
import {
  acceptRequest,
  declineRequest,
  getReceivedRequests,
} from '../../../lib/familyApi';
import {
  deleteHistoryEntry,
  groupOf,
  loadHistory,
  markAllHistoryRead,
  markEntryRead,
  reconcilePresentedNotifications,
  type HistoryEntry,
  type HistoryGroup,
} from '../../../lib/notificationHistory';
import { Ionicons } from '@expo/vector-icons';
import { PRIMARY } from '../constants';
import {
  GROUP_ORDER,
  groupLabel,
  type DisplayItem,
  type NotificationFilter,
} from '../utils/notificationDisplay';
import { NotificationCard } from '../components/NotificationCard';
import { NotificationFilterTabs } from '../components/NotificationFilterTabs';
import { s } from './NotificationsScreen.styles';

const READ_KEY = '@auravital:notifications_read';

export default function NotificationsScreen({ navigation }: any) {
  const { theme, locale, t } = useSettings();
  const [items, setItems] = useState<DisplayItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<NotificationFilter>('all');
  const [readIds, setReadIds] = useState<string[]>([]);
  const [hiddenIds, setHiddenIds] = useState<string[]>([]);

  const vi = locale === 'vi';

  const loadAll = useCallback(async () => {
    // Đối chiếu khay hệ thống trước: thông báo đổ chuông lúc app đóng
    // mà chưa ghi thì ghi nốt rồi mới hiển thị.
    await reconcilePresentedNotifications().catch(() => {});
    const readRaw = await AsyncStorage.getItem(READ_KEY);
    const readList: string[] = readRaw ? JSON.parse(readRaw) : [];
    setReadIds(readList);

    const history: DisplayItem[] = (await loadHistory()).map(
      (e: HistoryEntry) => ({
        id: e.id,
        kind: e.kind,
        category: e.category,
        time: e.firedAt,
        title: e.title,
        body: e.body,
        icon: e.icon,
        iconBg: e.iconBg,
        read: e.read,
        memberId: e.memberId ?? null,
        invite: null,
      }),
    );

    const received = await getReceivedRequests().catch(() => []);
    const inviteItems: DisplayItem[] = received.map((r) => ({
      id: `invite:${r.id}`,
      kind: 'family' as const,
      category: t('family.category'),
      time: new Date(r.createdAt).getTime() || Date.now(),
      title: t('notifications.inviteTitle', { name: r.fromName }),
      body: t('notifications.inviteBody', { name: r.fromName }),
      icon: '👨‍👩‍👧',
      iconBg: '#E8F5E9',
      read: readList.includes(`invite:${r.id}`),
      memberId: null,
      invite: {
        requestId: r.id,
        fromUserId: r.fromUserId,
        fromName: r.fromName,
      },
    }));

    setItems(
      [...history, ...inviteItems].sort((a, b) => b.time - a.time),
    );
    setLoading(false);
  }, [vi]);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadAll();
    setRefreshing(false);
  };

  const saveReadIds = (next: string[]) => {
    setReadIds(next);
    AsyncStorage.setItem(READ_KEY, JSON.stringify(next)).catch(() => {});
  };

  const markAllRead = async () => {
    await markAllHistoryRead().catch(() => {});
    const inviteIds = items
      .filter((i) => i.invite)
      .map((i) => i.id);
    saveReadIds([...readIds, ...inviteIds]);
    setItems((prev) => prev.map((i) => ({ ...i, read: true })));
  };

  const unreadCount = items.filter(
    (i) => !i.read && !hiddenIds.includes(i.id),
  ).length;

  const visible = items.filter((i) => {
    if (hiddenIds.includes(i.id)) return false;
    if (filter === 'all') return true;
    return i.kind === filter;
  });

  const grouped: { group: HistoryGroup; rows: DisplayItem[] }[] =
    GROUP_ORDER.map((group) => ({
      group,
      rows: visible.filter((i) => groupOf(i.time) === group),
    })).filter((g) => g.rows.length > 0);

  const tabs: { id: NotificationFilter; label: string }[] = [
    { id: 'all', label: t('notifications.filter.all') },
    { id: 'reminder', label: t('notifications.filter.reminder') },
    { id: 'family', label: t('notifications.filter.family') },
    { id: 'milestone', label: t('notifications.filter.milestone') },
  ];

  const goSharing = () =>
    (navigation.getParent() ?? navigation).navigate('Main', {
      screen: 'ShareTab',
    });

  const onCardPress = async (item: DisplayItem) => {
    if (item.invite) {
      if (!item.read) saveReadIds([...readIds, item.id]);
      goSharing();
      return;
    }
    if (!item.read) {
      await markEntryRead(item.id).catch(() => {});
      setItems((prev) =>
        prev.map((i) => (i.id === item.id ? { ...i, read: true } : i)),
      );
    }
    if (item.kind === 'family' && item.memberId) {
      navigation.navigate('FamilyDetail', { memberId: item.memberId });
    }
  };

  const onHidePress = async (item: DisplayItem) => {
    // Thẻ lịch sử: ✕ là xóa hẳn khỏi kho. Thẻ lời mời: ✕ chỉ ẩn
    // trong phiên này (lời mời là dữ liệu server, không xóa ở đây).
    if (item.invite) {
      setHiddenIds((prev) => [...prev, item.id]);
      return;
    }
    await deleteHistoryEntry(item.id).catch(() => {});
    setItems((prev) => prev.filter((i) => i.id !== item.id));
  };

  // Đồng ý lời mời ngay trên thẻ chuông: xong thì sang tab Chia sẻ kèm
  // tham số để màn đó hiện hộp đặt biệt danh cho người vừa kết nối.
  const onInviteAccept = async (item: DisplayItem) => {
    if (!item.invite) return;
    const ok = await acceptRequest(item.invite.requestId);
    if (!ok) {
      Alert.alert(
        t('family.errorTitle'),
        t('notifications.inviteAcceptFailed'),
      );
      return;
    }
    setItems((prev) => prev.filter((x) => x.id !== item.id));
    (navigation.getParent() ?? navigation).navigate('Main', {
      screen: 'ShareTab',
      params: {
        justAcceptedOwnerId: item.invite.fromUserId,
        justAcceptedName: item.invite.fromName,
      },
    });
  };

  const onInviteDecline = async (item: DisplayItem) => {
    if (!item.invite) return;
    if (await declineRequest(item.invite.requestId)) {
      setItems((prev) => prev.filter((x) => x.id !== item.id));
    }
  };

  if (loading) {
    return (
      <SafeAreaProvider>
        <SafeAreaView style={[s.safe, { backgroundColor: theme.background }]}>
          <ActivityIndicator
            size='large'
            color={PRIMARY}
            style={{ marginTop: 80 }}
          />
        </SafeAreaView>
      </SafeAreaProvider>
    );
  }

  return (
    <SafeAreaProvider>
      <SafeAreaView style={[s.safe, { backgroundColor: theme.background }]}>
        <View style={{ paddingHorizontal: 16, paddingTop: 16 }}>
          <View style={s.headerRow}>
            <TouchableOpacity onPress={() => navigation.goBack()} style={{ paddingVertical: 4 }}>
              <Ionicons name="chevron-back" size={28}/>
            </TouchableOpacity>
            <Text style={[s.headerTitle, { color: theme.text }]}>
              {t('settings.notificationsSection')}
            </Text>
          </View>
        </View>
        <ScrollView
          contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
        >

          <View style={s.summaryRow}>
            <Text style={[s.summary, { color: theme.text }]}>
              ● {t('notifications.unread', { count: unreadCount })}
            </Text>
            <TouchableOpacity onPress={markAllRead}>
              <Text style={[s.readAll, { color: theme.primaryDark }]}>
                ✓ {t('notifications.markAllRead')}
              </Text>
            </TouchableOpacity>
          </View>

          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <NotificationFilterTabs
              tabs={tabs}
              filter={filter}
              unreadCount={unreadCount}
              theme={theme}
              onSelect={setFilter}
            />
          </ScrollView>

          <Text style={[s.hint, { color: theme.muted }]}>
            {t('notifications.hint')}
          </Text>

          {grouped.length === 0 ? (
            <Text style={[s.empty, { color: theme.muted }]}>
              {filter === 'family'
                ? t('notifications.emptyFamily')
                : t('notifications.emptyAll')}
            </Text>
          ) : (
            grouped.map(({ group, rows }) => (
              <View key={group}>
                <View style={s.sectionRow}>
                  <Text style={[s.sectionTitle, { color: theme.text }]}>
                    {groupLabel(group)}
                  </Text>
                  <Text
                    style={[s.sectionRight, { color: theme.primaryDark }]}
                  >
                    {rows.filter((r) => !r.read).length}{' '}
                    {t('notifications.newItems')}
                  </Text>
                </View>
                {rows.map((item) => (
                  <NotificationCard
                    key={item.id}
                    item={item}
                    theme={theme}
                    onPress={() => onCardPress(item)}
                    onHide={() => onHidePress(item)}
                    onInviteAccept={() => onInviteAccept(item)}
                    onInviteDecline={() => onInviteDecline(item)}
                  />
                ))}
              </View>
            ))
          )}
        </ScrollView>
      </SafeAreaView>
    </SafeAreaProvider>
  );
}
