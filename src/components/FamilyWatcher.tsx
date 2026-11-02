import { useEffect, useRef } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../lib/supabase';
import {
  DEFAULT_SHARING,
  displayNameOf,
  getMembers,
  getReceivedRequests,
} from '../lib/familyApi';
import { useToast } from './NotificationToast';
import type { ToastTarget } from './NotificationToast';
import { appendHistory } from '../lib/notificationHistory';

// =====================================================================
// Theo dõi gia đình khi app đang mở:
// - Lời mời kết nối mới -> toast, bấm vào sang tab Chia sẻ.
// - Chỉ số người thân THAY ĐỔI (đạt mục tiêu bước chân / ngủ đủ /
//   đủ nước, hoặc có chỉ số ngày mới) -> toast, bấm vào sang màn
//   chi tiết của người đó. Chỉ xét các mục người đó đang chia sẻ,
//   và lần đầu thấy thành viên thì chỉ lưu mốc, không toast.
// Chạy: lúc mở app, khi app quay lại foreground, và mỗi 2 phút.
// =====================================================================

const SEEN_REQUESTS_KEY = '@auravital:family_seen_requests';
const SNAPSHOT_KEY = '@auravital:family_snapshot';

type SnapshotEntry = {
  log_date: string;
  steps: number | null;
  sleep_hours: number | null;
  water_ml: number | null;
};

export default function FamilyWatcher() {
  const { showToast } = useToast();
  const busy = useRef(false);

  // Toast + ghi lịch sử cho sự kiện gia đình (sự kiện gia đình là
  // "mọi thông báo" nên cũng vào lịch sử chuông). Lời mời KHÔNG ghi
  // ở đây: nó là thẻ live từ server, màn chuông lấy trực tiếp.
  const toastFamilyEvent = (
    icon: string,
    title: string,
    body: string,
    target: ToastTarget,
    memberId: string,
    logDate: string,
  ) => {
    showToast({ title: `${icon} ${title}`, body, target });
    appendHistory({
      kind: 'family',
      category: 'CHIA SẺ GIA ĐÌNH',
      title,
      body,
      icon,
      iconBg: '#E8F5E9',
      firedAt: Date.now(),
      dedupeKey: `family-${memberId}-${logDate}-${title}`,
      memberId,
    }).catch(() => {});
  };

  const check = async () => {
    if (busy.current) return;
    busy.current = true;
    try {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) return;

      // 1. Lời mời mới.
      const reqs = await getReceivedRequests().catch(() => []);
      if (reqs.length > 0) {
        const seenRaw = await AsyncStorage.getItem(SEEN_REQUESTS_KEY);
        const seen: string[] = seenRaw ? JSON.parse(seenRaw) : [];
        const fresh = reqs.filter((r) => !seen.includes(r.id));
        if (fresh.length > 0) {
          const first = fresh[0];
          showToast({
            title: '👨‍👩‍👧 Lời mời kết nối mới',
            body: `${first.fromName} muốn kết nối gia đình với bạn.`,
            target: { screen: 'Sharing' },
          });
        }
        // Chỉ giữ id các lời mời còn đang chờ -> tự dọn sau Đồng ý/Từ chối.
        await AsyncStorage.setItem(
          SEEN_REQUESTS_KEY,
          JSON.stringify(reqs.map((r) => r.id)),
        );
      }

      // 2. Thay đổi chỉ số thành viên.
      const members = await getMembers().catch(() => []);
      const snapRaw = await AsyncStorage.getItem(SNAPSHOT_KEY);
      const snap: Record<string, SnapshotEntry> = snapRaw
        ? JSON.parse(snapRaw)
        : {};
      const next: Record<string, SnapshotEntry> = {};
      let toasted = false;

      for (const m of members) {
        const cur = m.latest
          ? {
              log_date: m.latest.log_date,
              steps: m.latest.steps,
              sleep_hours: m.latest.sleep_hours,
              water_ml: m.latest.water_ml,
            }
          : null;
        const prev = snap[m.ownerId];
        if (cur) next[m.ownerId] = cur;
        else if (prev) next[m.ownerId] = prev;
        if (!cur || !prev) continue; // lần đầu thấy: lưu mốc, không toast

        const s = m.settings ?? DEFAULT_SHARING;
        if (!s.share_enabled) continue;
        const name = displayNameOf(m);
        const target = {
          screen: 'FamilyDetail',
          params: { memberId: m.ownerId },
        };

        if (
          !toasted &&
          s.share_steps &&
          prev.steps != null &&
          cur.steps != null &&
          prev.steps < m.stepGoal &&
          cur.steps >= m.stepGoal
        ) {
          toastFamilyEvent(
            '🎉',
            'Thành viên đạt mục tiêu',
            `${name} vừa hoàn thành mục tiêu ${m.stepGoal.toLocaleString('vi-VN')} bước!`,
            target,
            m.ownerId,
            cur.log_date,
          );
          toasted = true;
        } else if (
          !toasted &&
          s.share_sleep &&
          prev.sleep_hours != null &&
          cur.sleep_hours != null &&
          prev.sleep_hours < m.sleepGoalHours &&
          cur.sleep_hours >= m.sleepGoalHours
        ) {
          toastFamilyEvent(
            '🌙',
            'Giấc ngủ đủ giấc',
            `${name} vừa ngủ đủ mục tiêu ${m.sleepGoalHours} giờ.`,
            target,
            m.ownerId,
            cur.log_date,
          );
          toasted = true;
        } else if (
          !toasted &&
          s.share_water &&
          prev.water_ml != null &&
          cur.water_ml != null &&
          prev.water_ml < m.waterGoalMl &&
          cur.water_ml >= m.waterGoalMl
        ) {
          toastFamilyEvent(
            '💧',
            'Uống đủ nước',
            `${name} vừa uống đủ nước hôm nay.`,
            target,
            m.ownerId,
            cur.log_date,
          );
          toasted = true;
        } else if (!toasted && cur.log_date !== prev.log_date) {
          toastFamilyEvent(
            '💚',
            'Cập nhật sức khỏe',
            `${name} vừa cập nhật chỉ số ngày mới.`,
            target,
            m.ownerId,
            cur.log_date,
          );
          toasted = true;
        }
      }
      await AsyncStorage.setItem(SNAPSHOT_KEY, JSON.stringify(next));
    } catch {
      // Lỗi lẻ không chặn app; lần kiểm tra sau thử lại.
    } finally {
      busy.current = false;
    }
  };

  useEffect(() => {
    check();
    const sub = AppState.addEventListener('change', (st: AppStateStatus) => {
      if (st === 'active') check();
    });
    const timer = setInterval(check, 120000);
    return () => {
      sub.remove();
      clearInterval(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
}
