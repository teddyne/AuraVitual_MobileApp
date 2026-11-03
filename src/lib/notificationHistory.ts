import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';

export type HistoryKind = 'reminder' | 'family' | 'milestone';

export type HistoryEntry = {
  id: string;
  kind: HistoryKind;
  category: string;
  title: string;
  body: string;
  icon: string;
  iconBg: string;
  // Epoch ms lúc thông báo xuất hiện (để xếp + tính "x phút trước").
  firedAt: number;
  read: boolean;
  // Thẻ gia đình bấm vào sang màn chi tiết của thành viên đó.
  memberId?: string | null;
};

const HISTORY_KEY = '@auravital:notification_history';
// Chặn kho phình vô hạn: chỉ giữ 200 dòng mới nhất.
const MAX_ENTRIES = 200;

function dayKeyOf(t: number): string {
  const d = new Date(t);
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

export async function loadHistory(): Promise<HistoryEntry[]> {
  try {
    const raw = await AsyncStorage.getItem(HISTORY_KEY);
    if (!raw) return [];
    const list = JSON.parse(raw) as HistoryEntry[];
    if (!Array.isArray(list)) return [];
    return list
      .filter((e) => e && typeof e.firedAt === 'number')
      .sort((a, b) => b.firedAt - a.firedAt);
  } catch {
    return [];
  }
}

async function saveHistory(list: HistoryEntry[]): Promise<void> {
  try {
    await AsyncStorage.setItem(
      HISTORY_KEY,
      JSON.stringify(list.slice(0, MAX_ENTRIES)),
    );
  } catch {}
}

export type NewHistoryEntry = {
  kind: HistoryKind;
  category: string;
  title: string;
  body: string;
  icon: string;
  iconBg: string;
  firedAt: number;
  dedupeKey: string;
  memberId?: string | null;
};

// Ghi 1 dòng lịch sử. Trùng dedupeKey thì bỏ qua (thông báo đã ghi
// rồi mà listener/tray đối chiếu gặp lại cũng không ghi thêm).
export async function appendHistory(
  entry: NewHistoryEntry,
): Promise<void> {
  try {
    const list = await loadHistory();
    if (list.some((e) => e.id === entry.dedupeKey)) return;
    list.unshift({
      id: entry.dedupeKey,
      kind: entry.kind,
      category: entry.category,
      title: entry.title,
      body: entry.body,
      icon: entry.icon,
      iconBg: entry.iconBg,
      firedAt: entry.firedAt,
      read: false,
      memberId: entry.memberId ?? null,
    });
    await saveHistory(list);
  } catch {}
}

export async function markEntryRead(id: string): Promise<void> {
  try {
    const list = await loadHistory();
    await saveHistory(
      list.map((e) => (e.id === id ? { ...e, read: true } : e)),
    );
  } catch {}
}

export async function markAllHistoryRead(): Promise<void> {
  try {
    const list = await loadHistory();
    await saveHistory(list.map((e) => ({ ...e, read: true })));
  } catch {}
}

export async function deleteHistoryEntry(id: string): Promise<void> {
  try {
    const list = await loadHistory();
    await saveHistory(list.filter((e) => e.id !== id));
  } catch {}
}

export async function countUnreadHistory(): Promise<number> {
  try {
    const list = await loadHistory();
    return list.filter((e) => !e.read).length;
  } catch {
    return 0;
  }
}

//Chỉ ghi thông báo mang dấu của AuraVital thì màn chuông
//mới không lẫn thông báo ngoài.
function mapDeliveredToEntry(
  n: Notifications.Notification,
): NewHistoryEntry | null {
  const req = n.request;
  const data: any = req.content.data ?? {};
  const firedAt = typeof n.date === 'number' ? n.date : Date.now();
  const title = req.content.title ?? 'Nhắc nhở';
  const body = req.content.body ?? '';
  const identifier = req.identifier ?? `${title}|${body}`;
  const dedupeKey = `${identifier}|${dayKeyOf(firedAt)}`;

  if (data.kind === 'water') {
    return {
      kind: 'reminder',
      category: 'THÓI QUEN SINH HOẠT',
      title,
      body,
      icon: '💧',
      iconBg: '#E8F0FE',
      firedAt,
      dedupeKey,
    };
  }
  if (data.kind === 'meal') {
    return {
      kind: 'reminder',
      category: 'BỮA ĂN',
      title,
      body,
      icon: '🍽',
      iconBg: '#FFF3E0',
      firedAt,
      dedupeKey,
    };
  }
  if (data.kind === 'sleep') {
    return {
      kind: 'reminder',
      category: 'GIẤC NGỦ',
      title,
      body,
      icon: '🌙',
      iconBg: '#EEF1FF',
      firedAt,
      dedupeKey,
    };
  }
  if (data.alarm || data.isSnooze || data.autoSleep) {
    return {
      kind: 'reminder',
      category: data.autoSleep && !data.alarm ? 'GIẤC NGỦ' : 'BÁO THỨC',
      title,
      body,
      icon: data.autoSleep && !data.alarm ? '🌙' : '⏰',
      iconBg: data.autoSleep && !data.alarm ? '#EEF1FF' : '#FFF8E1',
      firedAt,
      dedupeKey,
    };
  }
  return null;
}

// Ghi 1 thông báo hệ thống vừa nhận (gọi từ listener nhận/tap và từ
// bước đối chiếu khay hệ thống). Trùng thì appendHistory tự bỏ qua.
// Thông báo không mang dấu của app mình thì map trả null và bỏ qua.
export async function recordDeliveredNotification(
  n: Notifications.Notification,
): Promise<void> {
  try {
    const entry = mapDeliveredToEntry(n);
    if (!entry) return;
    await appendHistory(entry);
  } catch {}
}

async function purgeForeignEntries(): Promise<void> {
  try {
    const list = await loadHistory();
    const kept = list.filter((e) => e.category !== 'NHẮC NHỞ');
    if (kept.length !== list.length) await saveHistory(kept);
  } catch {}
}

// Đối chiếu khay hệ thống: những thông báo đã đổ chuông lúc app đóng
// (nằm trong khay mà listener chưa gặp) cũng được ghi vào lịch sử.
// Gọi lúc mở app và lúc mở màn chuông.
export async function reconcilePresentedNotifications(): Promise<void> {
  try {
    await purgeForeignEntries();
    const presented =
      await Notifications.getPresentedNotificationsAsync();
    for (const n of presented) {
      await recordDeliveredNotification(n);
    }
  } catch {}
}

// Nhóm ngày cho màn chuông: Hôm nay / Hôm qua / Tuần này (2–7 ngày
// trước) / Cũ hơn (> 7 ngày). Nhóm nào không có dòng thì màn hình
// không hiện tên nhóm đó.
export type HistoryGroup = 'today' | 'yesterday' | 'week' | 'older';

export function groupOf(firedAt: number): HistoryGroup {
  const startOf = (d: Date) =>
    new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const diffDays = Math.round(
    (startOf(new Date()) - startOf(new Date(firedAt))) / 86400000,
  );
  if (diffDays <= 0) return 'today';
  if (diffDays === 1) return 'yesterday';
  if (diffDays <= 7) return 'week';
  return 'older';
}
