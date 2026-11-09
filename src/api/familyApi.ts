import { supabase } from './supabase';
import {
  getDaysToNextPeriodOnDate,
  localToday,
  type Metric,
} from './auravitalApi';
import { getNutritionDay } from './nutritionApi';
import { displayLocale, translate } from '../i18n/locale';
import type { AppIconName } from '../components/ui/AppIcon';

// =====================================================================
// Chia sẻ gia đình — lớp API duy nhất cho tính năng này.
// Luồng: A nhập mã của B -> gửi lời mời -> B thấy trong tab Chia sẻ,
// bấm Đồng ý thì tạo 2 hàng family_links (xem được nhau), bấm Từ chối
// thì hàng chuyển sang 'declined' để A thấy và bấm Ẩn.
// Dữ liệu thành viên đọc qua view shared_profiles (chỉ lộ id, tên và
// mục tiêu) + bảng health_metrics (policy metrics_read_shared chỉ cho
// người đã kết nối đọc). profiles gốc là owner-only nên KHÔNG dùng
// getProfile() cho thành viên khác.
// =====================================================================

export type SharingSettings = {
  share_enabled: boolean;
  share_steps: boolean;
  share_sleep: boolean;
  share_heart_rate: boolean;
  share_spo2: boolean;
  share_water: boolean;
  share_weight: boolean;
  share_kcal: boolean;
  share_cycle: boolean;
};

export const DEFAULT_SHARING: SharingSettings = {
  share_enabled: true,
  share_steps: true,
  share_sleep: true,
  share_heart_rate: true,
  share_spo2: true,
  share_water: true,
  share_weight: true,
  share_kcal: true,
  share_cycle: true,
};

export type MemberMetric = Metric & {
  log_date: string;
  updated_at: string;
};

export type FamilyMember = {
  ownerId: string;
  displayName: string;
  nickname: string | null;
  stepGoal: number;
  waterGoalMl: number;
  sleepGoalHours: number;
  today: MemberMetric | null;
  settings: SharingSettings | null;
  kcalToday: number | null;
  daysToNextPeriod: number | null;
};

export type FamilyRequest = {
  id: string;
  fromUserId: string;
  toUserId: string;
  code: string;
  fromName: string;
  toName: string | null;
  status: 'pending' | 'accepted' | 'declined';
  createdAt: string;
};

export type SendInviteResult =
  | { ok: true; toUserId: string; toName: string }
  | { ok: false; error: string };

function toRequest(row: any): FamilyRequest {
  return {
    id: row.id,
    fromUserId: row.from_user_id,
    toUserId: row.to_user_id,
    code: row.code,
    fromName: row.from_name,
    toName: row.to_name ?? null,
    status: row.status,
    createdAt: row.created_at,
  };
}

// Tên hiển thị: biệt danh (do mình đặt) ưu tiên hơn tên thật.
export function displayNameOf(m: {
  displayName: string;
  nickname: string | null;
}): string {
  const nick = (m.nickname ?? '').trim();
  return nick.length > 0 ? nick : m.displayName;
}

// "10 phút trước", "1 giờ trước", "Hôm qua", "dd/mm".
export function timeAgo(iso: string | null | undefined): string {
  if (!iso) return translate('family.timeNever');
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return translate('family.timeNever');
  const diffMin = Math.max(0, Math.floor((Date.now() - then) / 60000));
  if (diffMin < 1) return translate('family.timeJustNow');
  if (diffMin < 60) return translate('family.timeMinAgo', { min: diffMin });
  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) return translate('family.timeHourAgo', { hour: diffHour });
  const d = new Date(iso);
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
}

// Ước lượng từ số bước (khớp số liệu Figma: 6420 bước ~ 4,2 km, ~310 kcal).
export function stepsToKm(steps: number): number {
  return steps * 0.00065;
}
export function stepsToKcal(steps: number): number {
  return Math.round(steps * 0.048);
}

// ---- Mã mời của chính mình: lấy mã đang còn hạn, hết thì tạo mới. ----
export async function getMyInviteCode(): Promise<{
  code: string;
  expiresAt: string;
} | null> {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return null;
  const { data, error } = await supabase
    .from('family_invites')
    .select('code, expires_at')
    .eq('owner_id', auth.user.id)
    .is('used_at', null)
    .gt('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!error && data) return { code: data.code, expiresAt: data.expires_at };
  const { data: rpc, error: rpcError } = await supabase.rpc('create_invite');
  if (rpcError || typeof rpc !== 'string') return null;
  const expires = new Date(Date.now() + 24 * 3600 * 1000).toISOString();
  return { code: rpc, expiresAt: expires };
}

// ---- Tạo lại mã mời: hủy mã cũ còn hiệu lực rồi cấp mã mới. ----
// (Nút "Tải lại mã" cũ chỉ gọi lại getMyInviteCode, mà hàm đó ưu tiên
// trả mã cũ còn hiệu lực nên bấm không đổi mã. Hàm này mới đổi thật.)
export async function rotateInviteCode(): Promise<{
  code: string;
  expiresAt: string;
} | null> {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return null;
  const { data, error } = await supabase.rpc('rotate_invite');
  if (error || typeof data !== 'string') return null;
  const expires = new Date(Date.now() + 24 * 3600 * 1000).toISOString();
  return { code: data, expiresAt: expires };
}

// ---- Gửi lời mời bằng mã 8 ký tự của người nhận. ----
export async function sendInvite(code: string): Promise<SendInviteResult> {
  const { data, error } = await supabase.rpc('send_family_request', {
    p_code: code.trim().toUpperCase(),
  });
  if (error) return { ok: false, error: 'network' };
  if (!data || data.ok !== true)
    return { ok: false, error: String(data?.error ?? 'invalid_code') };
  return { ok: true, toUserId: data.to_user_id, toName: data.to_name };
}

// ---- Lời mời mình NHẬN (chờ mình Đồng ý / Từ chối). ----
export async function getReceivedRequests(): Promise<FamilyRequest[]> {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return [];
  const { data, error } = await supabase
    .from('family_requests')
    .select('*')
    .eq('to_user_id', auth.user.id)
    .eq('status', 'pending')
    .order('created_at', { ascending: false });
  if (error || !data) return [];
  return data.map(toRequest);
}

// ---- Lời mời mình ĐÃ GỬI (đang chờ hoặc đã bị từ chối). ----
export async function getSentRequests(): Promise<FamilyRequest[]> {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return [];
  const { data, error } = await supabase
    .from('family_requests')
    .select('*')
    .eq('from_user_id', auth.user.id)
    .in('status', ['pending', 'declined'])
    .order('created_at', { ascending: false });
  if (error || !data) return [];
  return data.map(toRequest);
}

export async function acceptRequest(id: string): Promise<boolean> {
  const { data, error } = await supabase.rpc('accept_family_request', {
    p_request_id: id,
  });
  return !error && data?.ok === true;
}

export async function declineRequest(id: string): Promise<boolean> {
  const { data, error } = await supabase.rpc('decline_family_request', {
    p_request_id: id,
  });
  return !error && data?.ok === true;
}

export async function dismissRequest(id: string): Promise<boolean> {
  const { data, error } = await supabase.rpc('dismiss_family_request', {
    p_request_id: id,
  });
  return !error && data?.ok === true;
}

// ---- Thành viên đã kết nối (mình là người xem). ----
export async function getMembers(): Promise<FamilyMember[]> {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return [];
  const me = auth.user.id;

  const { data: links, error: linkError } = await supabase
    .from('family_links')
    .select('owner_id, nickname')
    .eq('viewer_id', me);
  if (linkError || !links || links.length === 0) return [];

  const ownerIds = links.map((l) => l.owner_id);
  const nickByOwner = new Map<string, string | null>(
    links.map((l) => [l.owner_id, l.nickname]),
  );

  const { data: profiles } = await supabase
    .from('shared_profiles')
    .select('id, display_name, step_goal, water_goal_ml, sleep_goal_hours')
    .in('id', ownerIds);
  const profileById = new Map<string, any>(
    (profiles ?? []).map((p) => [p.id, p]),
  );

  const todayKey = localToday();
  const { data: metrics } = await supabase
    .from('health_metrics')
    .select('user_id, log_date, updated_at, steps, sleep_hours, water_ml, weight_kg, heart_rate, spo2')
    .in('user_id', ownerIds)
    .eq('log_date', todayKey);
  const todayByOwner = new Map<string, MemberMetric>();
  for (const m of metrics ?? []) {
    if (!todayByOwner.has(m.user_id)) {
      todayByOwner.set(m.user_id, {
        log_date: m.log_date,
        updated_at: m.updated_at,
        steps: m.steps,
        sleep_hours: m.sleep_hours != null ? Number(m.sleep_hours) : null,
        water_ml: m.water_ml,
        weight_kg: m.weight_kg != null ? Number(m.weight_kg) : null,
        heart_rate: m.heart_rate,
        spo2: m.spo2,
      });
    }
  }

  const { data: settingsRows } = await supabase
    .from('sharing_settings')
    .select('*')
    .in('user_id', ownerIds);
  const settingsByOwner = new Map<string, SharingSettings>(
    (settingsRows ?? []).map((s) => [
      s.user_id,
      {
        share_enabled: s.share_enabled,
        share_steps: s.share_steps,
        share_sleep: s.share_sleep,
        share_heart_rate: s.share_heart_rate,
        share_spo2: s.share_spo2,
        share_water: s.share_water,
        share_weight: s.share_weight,
        share_kcal: s.share_kcal ?? true,
        share_cycle: s.share_cycle ?? true,
      },
    ]),
  );

  const extraByOwner = new Map<
    string,
    { kcalToday: number | null; daysToNextPeriod: number | null }
  >();
  await Promise.all(
    ownerIds.map(async (ownerId) => {
      const [kcalRes, cycleRes] = await Promise.allSettled([
        getNutritionDay(ownerId, todayKey),
        getDaysToNextPeriodOnDate(ownerId, todayKey),
      ]);
      const day = kcalRes.status === 'fulfilled' ? kcalRes.value : null;
      const mealCount = day
        ? Object.values(day.meals).reduce((n, arr) => n + arr.length, 0)
        : 0;
      extraByOwner.set(ownerId, {
        kcalToday:
          day && mealCount > 0 ? Math.round(day.totalKcal ?? 0) : null,
        daysToNextPeriod:
          cycleRes.status === 'fulfilled' ? cycleRes.value : null,
      });
    }),
  );

  return ownerIds.map((ownerId) => {
    const p = profileById.get(ownerId);
    const extra = extraByOwner.get(ownerId) ?? {
      kcalToday: null,
      daysToNextPeriod: null,
    };
    return {
      ownerId,
      displayName: p?.display_name ?? translate('family.userFallback'),
      nickname: nickByOwner.get(ownerId) ?? null,
      stepGoal: p?.step_goal ?? 10000,
      waterGoalMl: p?.water_goal_ml ?? 2200,
      sleepGoalHours: p?.sleep_goal_hours != null ? Number(p.sleep_goal_hours) : 8,
      today: todayByOwner.get(ownerId) ?? null,
      settings: settingsByOwner.get(ownerId) ?? null,
      kcalToday: extra.kcalToday,
      daysToNextPeriod: extra.daysToNextPeriod,
    };
  });
}

export async function getMemberDetail(
  ownerId: string,
): Promise<FamilyMember | null> {
  const members = await getMembers();
  return members.find((m) => m.ownerId === ownerId) ?? null;
}

// Đặt biệt danh cho thành viên (chỉ mình xem được sửa hàng của mình).
export async function setNickname(
  ownerId: string,
  nickname: string,
): Promise<boolean> {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return false;
  const nick = nickname.trim().slice(0, 30);
  const { error } = await supabase
    .from('family_links')
    .update({ nickname: nick.length > 0 ? nick : null })
    .eq('owner_id', ownerId)
    .eq('viewer_id', auth.user.id);
  return !error;
}

// Hủy kết nối: xóa cả 2 chiều (mình xem họ + họ xem mình).
// Dùng 2 lệnh xóa riêng thay cho .or() để tránh lỗi cú pháp PostgREST.
export async function revokeLink(ownerId: string): Promise<boolean> {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return false;
  const me = auth.user.id;
  const r1 = await supabase
    .from('family_links')
    .delete()
    .eq('owner_id', ownerId)
    .eq('viewer_id', me);
  const r2 = await supabase
    .from('family_links')
    .delete()
    .eq('owner_id', me)
    .eq('viewer_id', ownerId);
  return !r1.error && !r2.error;
}

// ---- Cài đặt chia sẻ của chính mình. ----
export async function getMySharingSettings(): Promise<SharingSettings> {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return DEFAULT_SHARING;
  const { data } = await supabase
    .from('sharing_settings')
    .select('*')
    .eq('user_id', auth.user.id)
    .maybeSingle();
  if (!data) return DEFAULT_SHARING;
  return {
    share_enabled: data.share_enabled,
    share_steps: data.share_steps,
    share_sleep: data.share_sleep,
    share_heart_rate: data.share_heart_rate,
    share_spo2: data.share_spo2,
    share_water: data.share_water,
    share_weight: data.share_weight,
    share_kcal: data.share_kcal ?? true,
    share_cycle: data.share_cycle ?? true,
  };
}

export async function saveMySharingSettings(
  patch: Partial<SharingSettings>,
): Promise<boolean> {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return false;
  const current = await getMySharingSettings();
  const next = { ...current, ...patch };
  const { error } = await supabase.from('sharing_settings').upsert(
    { user_id: auth.user.id, ...next },
    { onConflict: 'user_id' },
  );
  return !error;
}

// ---- Sự kiện trong ngày của thành viên, suy ra từ dữ liệu thật.
// Chỉ xét chỉ số HÔM NAY và chỉ các mục thành viên đó đang chia sẻ.
// (Nhịp tim lúc tập, huyết áp... không có nguồn dữ liệu nên không bịa.)
export type MemberEvent = {
  id: string;
  icon: AppIconName;
  title: string;
  subtitle: string;
  body: string;
};

export function deriveEvents(m: FamilyMember): MemberEvent[] {
  const events: MemberEvent[] = [];
  const metric = m.today;
  if (!metric || metric.log_date !== localToday()) return events;
  const name = displayNameOf(m);
  const s = m.settings ?? DEFAULT_SHARING;
  if (!s.share_enabled) return events;

  if (
    s.share_steps &&
    metric.steps != null &&
    m.stepGoal > 0 &&
    metric.steps >= m.stepGoal
  ) {
    events.push({
      id: 'steps-goal',
      icon: 'footsteps-outline',
      title: translate('family.eventStepsTitle'),
      subtitle: translate('family.eventStepsSub', {
        name,
        goal: m.stepGoal.toLocaleString(displayLocale()),
      }),
      body: translate('family.eventStepsBody', { name }),
    });
  }
  if (
    s.share_sleep &&
    metric.sleep_hours != null &&
    m.sleepGoalHours > 0 &&
    metric.sleep_hours >= m.sleepGoalHours
  ) {
    events.push({
      id: 'sleep-goal',
      icon: 'moon-outline',
      title: translate('family.eventSleepTitle'),
      subtitle: translate('family.eventSleepSub'),
      body: translate('family.eventSleepBody', {
        hours: metric.sleep_hours,
      }),
    });
  }
  if (
    s.share_water &&
    metric.water_ml != null &&
    m.waterGoalMl > 0 &&
    metric.water_ml >= m.waterGoalMl
  ) {
    events.push({
      id: 'water-goal',
      icon: 'water-outline',
      title: translate('family.eventWaterTitle'),
      subtitle: translate('family.eventWaterSub', {
        name,
        ml: m.waterGoalMl.toLocaleString(displayLocale()),
      }),
      body: translate('family.eventWaterBody'),
    });
  }
  return events;
}

// Nhãn trạng thái sức khỏe từ điểm số (để hiển thị badge như Figma).
export function healthBadge(score: number | null): string {
  if (score == null) return translate('family.noData');
  if (score >= 80) return translate('family.badgeGood');
  if (score >= 60) return translate('family.badgeStable');
  return translate('family.badgeAttention');
}
