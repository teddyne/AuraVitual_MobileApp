// =====================================================================
// AuraVital — workoutApi.ts
// Đặt tại: src/lib/workoutApi.ts (cùng thư mục với auravitalApi.ts,
// vì vậy import './supabase' dưới đây khớp đúng file thật của bạn).
// Nếu bạn đặt file ở chỗ khác thì sửa 1 dòng import này cho khớp.
//
// Phụ thuộc DB: migration v6 (posts.kcal_estimate + bảng workout_logs).
// Chưa chạy v6 mà gọi các hàm này thì Supabase sẽ báo lỗi cột/bảng
// không tồn tại — chạy sql/01_migration_v6_workouts.sql trước.
// Phong cách giống auravitalApi thật: lỗi thì throw, chỗ gọi tự bắt.
// =====================================================================
import { supabase } from './supabase';

export type Post = {
  id: string;
  kind: 'article' | 'workout';
  title: string;
  summary: string | null;
  body: string | null;
  cover_url: string | null;
  video_url: string | null;
  duration_min: number | null;
  level: 'beginner' | 'intermediate' | 'advanced' | null;
  kcal_estimate: number | null;
  published_at: string | null;
};

export type WorkoutStep = {
  id: string;
  post_id: string;
  step_order: number;
  title: string;
  instruction: string | null;
  duration_sec: number;
  start_at_sec: number | null;
};

export type WorkoutLog = {
  id: string;
  user_id: string;
  post_id: string;
  log_date: string;
  minutes: number;
  kcal: number;
  post?: { title: string; duration_min: number | null; kcal_estimate: number | null } | null;
};

export type WeeklySummary = {
  stepsTotal: number;
  stepsPrevTotal: number;
  stepsChangePct: number | null; // null = tuần trước không có dữ liệu để so
  workoutMinutes: number;
  workoutSessions: number;
  workoutKcal: number;
  waterTotalMl: number;
  waterAvgPctOfGoal: number | null; // null = chưa có water_goal_ml
  sleepTotalHours: number;
  sleepAvgHours: number;
};

export const LEVEL_LABEL: Record<string, string> = {
  beginner: 'Cơ bản',
  intermediate: 'Trung cấp',
  advanced: 'Nâng cao',
};

export function levelLabel(level: string | null): string {
  return LEVEL_LABEL[level ?? ''] ?? 'Cơ bản';
}

/** Kcal ước lượng theo số phút thật, tỉ lệ với kcal của 1 buổi chuẩn. */
export function calcKcal(post: { duration_min: number | null; kcal_estimate: number | null }, minutes: number): number {
  if (!post.kcal_estimate || !post.duration_min || post.duration_min <= 0) return 0;
  return Math.round((post.kcal_estimate * minutes) / post.duration_min);
}

function addDaysStr(iso: string, days: number): string {
  const d = new Date(`${iso}T12:00:00`);
  d.setDate(d.getDate() + days);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export async function getWorkouts(): Promise<Post[]> {
  const { data, error } = await supabase
    .from('posts')
    .select('id,kind,title,summary,body,cover_url,video_url,duration_min,level,kcal_estimate,published_at')
    .eq('kind', 'workout')
    .order('duration_min', { ascending: true });
  if (error) throw error;
  return (data ?? []) as Post[];
}

export async function getArticles(limit = 3): Promise<Post[]> {
  const { data, error } = await supabase
    .from('posts')
    .select('id,kind,title,summary,body,cover_url,video_url,duration_min,level,kcal_estimate,published_at')
    .eq('kind', 'article')
    .order('published_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as Post[];
}

export async function getPostById(id: string): Promise<Post | null> {
  const { data, error } = await supabase
    .from('posts')
    .select('id,kind,title,summary,body,cover_url,video_url,duration_min,level,kcal_estimate,published_at')
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  return (data ?? null) as Post | null;
}

export async function getWorkoutSteps(postId: string): Promise<WorkoutStep[]> {
  const { data, error } = await supabase
    .from('workout_steps')
    .select('id,post_id,step_order,title,instruction,duration_sec,start_at_sec')
    .eq('post_id', postId)
    .order('step_order', { ascending: true });
  if (error) throw error;
  return (data ?? []) as WorkoutStep[];
}

/** Nhật ký của 1 ngày, kèm tên + thời lượng chuẩn của bài tập. */
export async function getWorkoutLogsForDate(userId: string, logDate: string): Promise<WorkoutLog[]> {
  const { data, error } = await supabase
    .from('workout_logs')
    .select('id,user_id,post_id,log_date,minutes,kcal,post:posts(title,duration_min,kcal_estimate)')
    .eq('user_id', userId)
    .eq('log_date', logDate)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return (data ?? []) as unknown as WorkoutLog[];
}

/**
 * Ghi / cập nhật nhật ký: 1 bài / 1 ngày chỉ có 1 dòng (UNIQUE v6),
 * nên upsert sẽ cộng dồn KHÔNG tự động — hàm này GHI ĐÈ minutes bằng
 * số phút người dùng nhập. Muốn cộng dồn thì ở màn hình lấy dòng cũ
 * cộng thêm rồi mới gọi hàm này.
 */
export async function saveWorkoutLog(
  userId: string,
  post: { id: string; duration_min: number | null; kcal_estimate: number | null },
  logDate: string,
  minutes: number,
): Promise<void> {
  const { error } = await supabase.from('workout_logs').upsert(
    {
      user_id: userId,
      post_id: post.id,
      log_date: logDate,
      minutes,
      kcal: calcKcal(post, minutes),
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id,post_id,log_date' },
  );
  if (error) throw error;
}

export async function updateWorkoutLogMinutes(
  logId: string,
  post: { duration_min: number | null; kcal_estimate: number | null },
  minutes: number,
): Promise<void> {
  const { error } = await supabase
    .from('workout_logs')
    .update({ minutes, kcal: calcKcal(post, minutes), updated_at: new Date().toISOString() })
    .eq('id', logId);
  if (error) throw error;
}

export async function deleteWorkoutLog(logId: string): Promise<void> {
  const { error } = await supabase.from('workout_logs').delete().eq('id', logId);
  if (error) throw error;
}

/**
 * Tổng kết 14 ngày kết thúc ở endDate (YYYY-MM-DD):
 * 7 ngày cuối so với 7 ngày trước đó. Không bịa "ngủ sâu +8%" hay
 * "đạt mục tiêu tuần" vì DB không có cột ngủ sâu và không có mục
 * tiêu tập tuần trong profiles — màn hình chỉ hiện số thật + số buổi.
 */
export async function getWeeklySummary(
  userId: string,
  endDate: string,
  waterGoalMl: number | null,
): Promise<WeeklySummary> {
  const startPrev = addDaysStr(endDate, -13);
  const startWeek = addDaysStr(endDate, -6);
  const [metricsRes, logsRes] = await Promise.all([
    supabase
      .from('health_metrics')
      .select('log_date,steps,water_ml,sleep_hours')
      .eq('user_id', userId)
      .gte('log_date', startPrev)
      .lte('log_date', endDate),
    supabase
      .from('workout_logs')
      .select('log_date,minutes,kcal')
      .eq('user_id', userId)
      .gte('log_date', startPrev)
      .lte('log_date', endDate),
  ]);
  if (metricsRes.error) throw metricsRes.error;
  if (logsRes.error) throw logsRes.error;

  let stepsTotal = 0;
  let stepsPrevTotal = 0;
  let waterTotalMl = 0;
  let sleepTotalHours = 0;
  for (const m of metricsRes.data ?? []) {
    const steps = m.steps ?? 0;
    const water = m.water_ml ?? 0;
    const sleep = Number(m.sleep_hours ?? 0);
    if ((m.log_date as string) >= startWeek) {
      stepsTotal += steps;
      waterTotalMl += water;
      sleepTotalHours += sleep;
    } else {
      stepsPrevTotal += steps;
    }
  }

  let workoutMinutes = 0;
  let workoutKcal = 0;
  let workoutSessions = 0;
  for (const l of logsRes.data ?? []) {
    if ((l.log_date as string) >= startWeek) {
      workoutMinutes += l.minutes ?? 0;
      workoutKcal += l.kcal ?? 0;
      workoutSessions += 1;
    }
  }

  return {
    stepsTotal,
    stepsPrevTotal,
    stepsChangePct: stepsPrevTotal > 0 ? Math.round(((stepsTotal - stepsPrevTotal) / stepsPrevTotal) * 100) : null,
    workoutMinutes,
    workoutSessions,
    workoutKcal,
    waterTotalMl,
    waterAvgPctOfGoal:
      waterGoalMl && waterGoalMl > 0 ? Math.round(((waterTotalMl / 7) / waterGoalMl) * 100) : null,
    sleepTotalHours,
    sleepAvgHours: Math.round((sleepTotalHours / 7) * 10) / 10,
  };
}

export type NewWorkoutInput = {
  title: string;
  summary: string | null;
  duration_min: number;
  kcal_estimate: number | null;
  level: 'beginner' | 'intermediate' | 'advanced';
  video_url?: string | null;
  cover_url?: string | null;
};

/** Bài tập người dùng tự thêm: lưu vào posts kind='workout'.
 *  Lưu ý: posts v5 không có cột chủ sở hữu nên bài tự thêm sẽ hiện
 *  cho mọi tài khoản trong cùng database demo. */
export async function addCustomWorkout(input: NewWorkoutInput): Promise<Post> {
  const { data, error } = await supabase
    .from('posts')
    .insert({
      kind: 'workout',
      title: input.title,
      summary: input.summary,
      body: input.summary,
      cover_url: input.cover_url || null,
      video_url: input.video_url || null,
      duration_min: input.duration_min,
      level: input.level,
      kcal_estimate: input.kcal_estimate,
    })
    .select('id,kind,title,summary,body,cover_url,video_url,duration_min,level,kcal_estimate,published_at')
    .single();
  if (error) throw error;
  return data as Post;
}
