import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  RefreshControl,
  ScrollView,
  StyleSheet,
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
  timeAgo,
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
  type HistoryKind,
} from '../../../lib/notificationHistory';

// =====================================================================
// Màn chuông LÀM LẠI (2/11/2026): chỉ hiện LỊCH SỬ thông báo, từ hiện
// tại trở về quá khứ, mới nhất trước, chia nhóm Hôm nay / Hôm qua /
// Tuần này / Cũ hơn (nhóm nào không có dòng thì không hiện tên nhóm).
// Không còn các thẻ "sắp tới" dựng sẵn như bản cũ (khung nước tiếp
// theo, bữa tiếp theo, đếm ngược giờ ngủ...).
// - Lịch sử = dòng đã ghi khi thông báo thực sự đổ chuông (nhắc
//   nước/bữa/ngủ, báo thức), sự kiện gia đình, cột mốc đạt mục tiêu.
// - Lời mời kết nối là thẻ live từ server, gộp chung vào dòng thời
//   gian theo ngày tạo, vẫn có nút Đồng ý / Từ chối ngay trên thẻ.
// - Thời gian trên thẻ là thời gian tương đối từ lúc thông báo xuất
//   hiện ("5 phút trước", "1 giờ trước", ...).
// - Chấm chưa đọc: bấm thẻ = đã đọc; "Đã đọc tất cả" = đã đọc hết
//   các dòng hiện có (KHÔNG còn theo ngày như bản cũ: thông báo mới
//   tới sau đó vẫn hiện chấm lại như thường).
// =====================================================================

const PRIMARY = '#4E8A47';
const READ_KEY = '@auravital:notifications_read';
const GREY_PILL = '#D9D9D9';

type DisplayItem = {
  id: string;
  kind: HistoryKind;
  category: string;
  time: number;
  title: string;
  body: string;
  icon: string;
  iconBg: string;
  read: boolean;
  memberId?: string | null;
  invite?: {
    requestId: string;
    fromUserId: string;
    fromName: string;
  } | null;
};

const GROUP_ORDER: HistoryGroup[] = ['today', 'yesterday', 'week', 'older'];

export default function NotificationsScreen({ navigation }: any) {
  const { theme, locale } = useSettings();
  const [items, setItems] = useState<DisplayItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<
    'all' | 'reminder' | 'family' | 'milestone'
  >('all');
  const [readIds, setReadIds] = useState<string[]>([]);
  const [hiddenIds, setHiddenIds] = useState<string[]>([]);

  const vi = locale === 'vi';
  const groupLabel = (g: HistoryGroup) =>
    g === 'today'
      ? vi
        ? 'Hôm nay'
        : 'Today'
      : g === 'yesterday'
        ? vi
          ? 'Hôm qua'
          : 'Yesterday'
        : g === 'week'
          ? vi
            ? 'Tuần này'
            : 'This week'
          : vi
            ? 'Cũ hơn'
            : 'Older';

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
      category: vi ? 'CHIA SẺ GIA ĐÌNH' : 'FAMILY SHARING',
      time: new Date(r.createdAt).getTime() || Date.now(),
      title: vi
        ? `Lời mời kết nối từ ${r.fromName}`
        : `Connection invite from ${r.fromName}`,
      body: vi
        ? `${r.fromName} muốn kết nối sức khỏe gia đình với bạn. Đồng ý để xem chỉ số của nhau, hoặc Từ chối.`
        : `${r.fromName} wants to connect family health with you. Accept to share health data, or decline.`,
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
    loadAll();
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

  // "Đã đọc tất cả" (bản mới): đánh dấu đã đọc hết các dòng lịch sử
  // hiện có + các lời mời hiện có. Không còn cờ theo ngày: thông báo
  // mới tới sau đó vẫn chưa đọc và vẫn hiện chấm như thường.
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

  const tabs: { id: typeof filter; label: string }[] = [
    { id: 'all', label: vi ? 'Tất cả' : 'All' },
    { id: 'reminder', label: vi ? 'Nhắc nhở' : 'Reminders' },
    { id: 'family', label: vi ? 'Chia sẻ gia đình' : 'Family' },
    { id: 'milestone', label: vi ? 'Cột mốc' : 'Milestones' },
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
        'Lỗi',
        vi
          ? 'Không đồng ý được lời mời, thử lại sau.'
          : 'Could not accept the invite, please try again.',
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
        <ScrollView
          contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
        >
          <View style={s.headerRow}>
            <TouchableOpacity onPress={() => navigation.goBack()}>
              <Text style={[s.back, { color: theme.primaryDark }]}>‹</Text>
            </TouchableOpacity>
            <Text style={[s.headerTitle, { color: theme.text }]}>
              {vi ? 'Thông báo & Nhắc nhở' : 'Notifications & Reminders'}
            </Text>
            <View style={s.avatar}>
              <Text>👤</Text>
            </View>
          </View>

          <View style={s.summaryRow}>
            <Text style={[s.summary, { color: theme.text }]}>
              ● {unreadCount} {vi ? 'cập nhật chưa đọc' : 'unread updates'}
            </Text>
            <TouchableOpacity onPress={markAllRead}>
              <Text style={[s.readAll, { color: theme.primaryDark }]}>
                ✓ {vi ? 'Đã đọc tất cả' : 'Mark all read'}
              </Text>
            </TouchableOpacity>
          </View>

          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={s.tabRow}>
              {tabs.map((t) => (
                <TouchableOpacity
                  key={t.id}
                  style={[
                    s.tabPill,
                    {
                      backgroundColor: filter === t.id ? PRIMARY : GREY_PILL,
                    },
                  ]}
                  onPress={() => setFilter(t.id)}
                >
                  <Text
                    style={[
                      s.tabText,
                      { color: filter === t.id ? '#fff' : theme.text },
                    ]}
                  >
                    {t.label}
                    {t.id === 'all' ? ` ${unreadCount}` : ''}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>

          <Text style={[s.hint, { color: theme.muted }]}>
            {vi
              ? 'BẤM THẺ ĐỂ ĐÁNH DẤU ĐÃ ĐỌC, BẤM ✕ ĐỂ XÓA/ẨN THẺ'
              : 'TAP A CARD TO MARK AS READ, TAP ✕ TO DELETE/HIDE IT'}
          </Text>

          {grouped.length === 0 ? (
            <Text style={[s.empty, { color: theme.muted }]}>
              {filter === 'family'
                ? vi
                  ? 'Chưa có chia sẻ gia đình.'
                  : 'No family sharing yet.'
                : vi
                  ? 'Chưa có thông báo nào.'
                  : 'No notifications yet.'}
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
                    {vi ? 'tin mới' : 'new'}
                  </Text>
                </View>
                {rows.map((item) => {
                  const unread = !item.read;
                  return (
                    <TouchableOpacity
                      key={item.id}
                      style={[s.card, { backgroundColor: theme.card }]}
                      onPress={() => onCardPress(item)}
                    >
                      <View
                        style={[s.iconCircle, { backgroundColor: item.iconBg }]}
                      >
                        <Text style={s.iconText}>{item.icon}</Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <View style={s.cardTop}>
                          <Text style={[s.category, { color: PRIMARY }]}>
                            {item.category}
                          </Text>
                          <Text style={[s.timeLabel, { color: theme.muted }]}>
                            {timeAgo(new Date(item.time).toISOString())}
                          </Text>
                          {unread && <Text style={{ color: PRIMARY }}>●</Text>}
                        </View>
                        <Text style={[s.cardTitle, { color: theme.text }]}>
                          {item.title}
                        </Text>
                        <Text style={[s.cardBody, { color: theme.text }]}>
                          {item.body}
                        </Text>
                        {item.invite && (
                          <View style={s.inviteRow}>
                            <TouchableOpacity
                              style={s.inviteAccept}
                              onPress={() => onInviteAccept(item)}
                            >
                              <Text style={s.inviteAcceptText}>
                                {vi ? 'Đồng ý' : 'Accept'}
                              </Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                              style={s.inviteDecline}
                              onPress={() => onInviteDecline(item)}
                            >
                              <Text style={s.inviteDeclineText}>
                                {vi ? 'Từ chối' : 'Decline'}
                              </Text>
                            </TouchableOpacity>
                          </View>
                        )}
                      </View>
                      <TouchableOpacity onPress={() => onHidePress(item)}>
                        <Text style={{ color: theme.muted, fontSize: 16 }}>
                          ✕
                        </Text>
                      </TouchableOpacity>
                    </TouchableOpacity>
                  );
                })}
              </View>
            ))
          )}
        </ScrollView>
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1 },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  back: { fontSize: 30, fontWeight: '800' },
  headerTitle: { flex: 1, fontSize: 20, fontWeight: '800' },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#E8F5E9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  summary: { fontWeight: '700' },
  readAll: { fontWeight: '800' },
  tabRow: { flexDirection: 'row', gap: 8 },
  tabPill: { borderRadius: 999, paddingVertical: 8, paddingHorizontal: 14 },
  tabText: { fontWeight: '700' },
  hint: { fontSize: 11, marginTop: 14, marginBottom: 8 },
  sectionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
    marginTop: 8,
  },
  sectionTitle: { fontSize: 18, fontWeight: '800' },
  sectionRight: { fontWeight: '700' },
  empty: { lineHeight: 20, marginTop: 12 },
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
