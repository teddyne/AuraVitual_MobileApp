import { supabase } from './supabase';

export type Profile = {
  id: string;
  display_name: string;
  height_cm: number;
  weight_kg: number;
  date_of_birth: string | null;
  gender: string | null;
  step_goal: number;
  water_goal_ml: number;
  sleep_goal_hours: number;
  calorie_goal: number;
  wake_time?: string | null;
};

export type Metric = {
  steps: number | null;
  sleep_hours: number | null;
  water_ml: number | null;
  weight_kg: number | null;
  heart_rate: number | null;
  spo2: number | null;
};

export function localToday(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function dayRange(dateStr: string) {
  const start = new Date(`${dateStr}T00:00:00`);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return { start: start.toISOString(), end: end.toISOString() };
}
export function formatSleep(hours: number | null): string {
  if (hours == null) return 'Chưa ghi nhận';
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  return `${h}h ${m}m`;
}
export function formatNumber(n: number, lang: string = 'vi'): string {
  return n.toLocaleString(lang === 'en' ? 'en-US' : 'vi-VN');
}

export async function getProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function getMetricByDate(
  userId: string,
  dateKey: string,
): Promise<Metric | null> {
  const { data, error } = await supabase
    .from('health_metrics')
    .select('steps,sleep_hours,water_ml,weight_kg,heart_rate,spo2')
    .eq('user_id', userId)
    .eq('log_date', dateKey)
    .maybeSingle();
  if (error) throw error;
  return data;
}
export async function getTodayMetric(userId: string): Promise<Metric | null> {
  return getMetricByDate(userId, localToday());
}

export async function getWeekMetricsEndingOn(userId: string, endKey: string) {
  const [y, m, d] = endKey.split('-').map(Number);
  const end = new Date(y, m - 1, d);
  const start = new Date(y, m - 1, d - 6);
  const fmt = (x: Date) =>
    `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;
  const { data, error } = await supabase
    .from('health_metrics')
    .select('steps,sleep_hours,water_ml')
    .eq('user_id', userId)
    .gte('log_date', fmt(start))
    .lte('log_date', fmt(end));
  if (error) throw error;
  return (data ?? []).reduce(
    (a, r) => ({
      steps: a.steps + (r.steps ?? 0),
      water: a.water + (r.water_ml ?? 0),
      sleep: a.sleep + Number(r.sleep_hours ?? 0),
    }),
    { steps: 0, water: 0, sleep: 0 },
  );
}
export async function getWeekMetrics(userId: string) {
  return getWeekMetricsEndingOn(userId, localToday());
}

export async function getNutritionByDate(userId: string, dateKey: string) {
  const { start, end } = dayRange(dateKey);
  const { data, error } = await supabase
    .from('meals')
    .select('total_kcal,total_carb_g,total_protein_g,total_fat_g')
    .eq('user_id', userId)
    .gte('eaten_at', start)
    .lt('eaten_at', end);
  if (error) throw error;
  return (data ?? []).reduce(
    (a, r) => ({
      kcal: a.kcal + Number(r.total_kcal ?? 0),
      carbs: a.carbs + Number(r.total_carb_g ?? 0),
      protein: a.protein + Number(r.total_protein_g ?? 0),
      fat: a.fat + Number(r.total_fat_g ?? 0),
    }),
    { kcal: 0, carbs: 0, protein: 0, fat: 0 },
  );
}
export async function getTodayNutrition(userId: string) {
  return getNutritionByDate(userId, localToday());
}

export async function getDaysToNextPeriodOnDate(
  userId: string,
  dateKey: string,
): Promise<number | null> {
  const { data, error } = await supabase
    .from('cycles')
    .select('start_date,cycle_length_days')
    .eq('user_id', userId)
    .order('start_date', { ascending: true });
  if (error) throw error;
  if (!data || !data.length) return null;
  const selected = new Date(dateKey);
  const sorted = [...data];
  const base =
    sorted.filter((c: any) => new Date(c.start_date) <= selected).pop() ??
    sorted[0];
  const length = base.cycle_length_days || 28;
  const next = new Date(base.start_date);
  next.setDate(next.getDate() + length);
  while (next < selected) next.setDate(next.getDate() + length);
  return Math.ceil((next.getTime() - selected.getTime()) / 86400000);
}
export async function getDaysToNextPeriod(
  userId: string,
): Promise<number | null> {
  return getDaysToNextPeriodOnDate(userId, localToday());
}

export async function getPost(kind: 'article' | 'workout') {
  const { data, error } = await supabase
    .from('posts')
    .select('title,summary,duration_min,level')
    .eq('kind', kind)
    .order('published_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data;
}
export async function saveWater(userId: string, waterMl: number) {
  const { error } = await supabase
    .from('health_metrics')
    .upsert(
      { user_id: userId, log_date: localToday(), water_ml: waterMl },
      { onConflict: 'user_id,log_date' },
    );
  if (error) throw error;
}
export async function saveProfile(
  userId: string,
  displayName: string,
  heightCm: number,
  weightKg: number,
  dateOfBirth: string | null,
  gender?: string | null,
) {
  const existing = await getProfile(userId);
  if (existing) {
    const updateData: any = {
      display_name: displayName,
      height_cm: heightCm,
      weight_kg: weightKg,
      date_of_birth: dateOfBirth,
    };
    if (gender) updateData.gender = gender;
    const { error } = await supabase
      .from('profiles')
      .update(updateData)
      .eq('id', userId);
    if (error) throw error;
  } else {
    const { error } = await supabase.from('profiles').insert({
      id: userId,
      display_name: displayName,
      height_cm: heightCm,
      weight_kg: weightKg,
      date_of_birth: dateOfBirth,
      gender: gender ?? null,
      consented_at: new Date().toISOString(),
    });
    if (error) throw error;
  }
}
export async function saveCycleStart(
  userId: string,
  startDate: string,
  cycleLengthDays: number,
  periodLengthDays: number,
) {
  const { error } = await supabase.from('cycles').insert({
    user_id: userId,
    start_date: startDate,
    cycle_length_days: cycleLengthDays,
    period_length_days: periodLengthDays,
  });
  if (error) throw error;
}

// Trọng số theo tài liệu dự án: bước 40 + ngủ 25 + nước 20 + SpO2 15.
// SpO2 quy đổi tuyến tính 90 -> 0, 100 -> 15. Nếu utils/score.ts đã có công thức khác thì dùng file đó thay hàm này.
export function healthScore(
  m: Metric | null,
  p: Profile | null,
): number | null {
  if (
    !m ||
    !p ||
    m.steps == null ||
    m.sleep_hours == null ||
    m.water_ml == null ||
    m.spo2 == null
  )
    return null;
  return Math.round(
    Math.min(m.steps / p.step_goal, 1) * 40 +
      Math.min(Number(m.sleep_hours) / Number(p.sleep_goal_hours), 1) * 25 +
      Math.min(m.water_ml / p.water_goal_ml, 1) * 20 +
      Math.max(0, Math.min(1, (m.spo2 - 90) / 10)) * 15,
  );
}

// ===== Mục tiêu / đề xuất đã lưu (bảng recommendations) =====
// Mỗi user chỉ giữ 1 bản mới nhất (upsert theo user_id).
// payload giữ nguyên object rec để RecommendationScreen hiển thị lại
// đúng như lúc tính, không cần tính lại.
export async function saveRecommendation(userId: string, rec: any) {
  const { error } = await supabase.from('recommendations').upsert(
    {
      user_id: userId,
      goal: rec.goal,
      calorie_target: rec.calorieTarget ?? null,
      water_ml: rec.waterMl ?? null,
      sleep_hours:
        rec.goal === 'sleep' ? (rec.recommendedSleepHours ?? null) : null,
      target_weight_kg: rec.targetWeightKg ?? null,
      payload: rec,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id' },
  );
  if (error) throw error;
}

export async function getRecommendation(userId: string) {
  const { data, error } = await supabase
    .from('recommendations')
    .select('payload, updated_at')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw error;
  if (!data?.payload) return null;
  return {
    ...data.payload,
    updatedAt: data.updated_at ?? data.payload.updatedAt,
  };
}

export async function syncRecommendationToProfile(userId: string, rec: any) {
  const patch: any = {};
  if (rec.calorieTarget != null) patch.calorie_goal = rec.calorieTarget;
  if (rec.waterMl != null) patch.water_goal_ml = rec.waterMl;
  if (rec.goal === 'sleep' && rec.recommendedSleepHours != null)
    patch.sleep_goal_hours = rec.recommendedSleepHours;
  if (Object.keys(patch).length === 0) return;
  const { error } = await supabase
    .from('profiles')
    .update(patch)
    .eq('id', userId);
  if (error) throw error;
}
export type Locale = 'vi' | 'en';
