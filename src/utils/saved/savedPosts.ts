import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../../api/supabase';
import { getPostById, type Post } from '../../api/workoutApi';

// =====================================================================
// Bài đã lưu (bookmark) — dùng chung cho bài viết lẫn bài luyện tập.
// Khóa tách theo từng tài khoản (cùng cách làm với lịch sử chuông và
// gói đăng ký, Nov 2026): tài khoản mới không thấy mục đã lưu của
// tài khoản trước trên cùng một máy. Chưa đăng nhập thì đọc trả [],
// ghi thì bỏ qua.
// Khóa cũ '@auravital:fav_workouts' (dùng chung mọi tài khoản) được
// nhận về một lần: lần đầu tải danh sách luyện tập mà khóa mới trống
// thì lấy luôn danh sách cũ sang.
// =====================================================================

export type SavedKind = 'workout' | 'article';

export type SavedPost = {
  id: string;
  kind: SavedKind;
  title: string;
  summary: string | null;
  cover_url: string | null;
  duration_min: number | null;
};

const WORKOUTS_KEY = '@auravital:saved_workouts';
const ARTICLES_KEY = '@auravital:saved_articles';
const LEGACY_FAV_KEY = '@auravital:fav_workouts';

function keyOf(kind: SavedKind): string {
  return kind === 'workout' ? WORKOUTS_KEY : ARTICLES_KEY;
}

async function currentUserId(): Promise<string | null> {
  try {
    const { data } = await supabase.auth.getSession();
    return data.session?.user?.id ?? null;
  } catch {
    return null;
  }
}

async function perUserKey(kind: SavedKind): Promise<string | null> {
  const uid = await currentUserId();
  if (!uid) return null;
  return `${keyOf(kind)}:${uid}`;
}

function parseIds(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const list = JSON.parse(raw) as unknown;
    if (!Array.isArray(list)) return [];
    return list.filter((x): x is string => typeof x === 'string');
  } catch {
    return [];
  }
}

export async function loadSavedIds(kind: SavedKind): Promise<string[]> {
  try {
    const key = await perUserKey(kind);
    if (!key) return [];
    let ids = parseIds(await AsyncStorage.getItem(key));
    // Nhận danh sách cũ (khóa chung) về một lần duy nhất.
    if (kind === 'workout' && ids.length === 0) {
      const legacy = parseIds(await AsyncStorage.getItem(LEGACY_FAV_KEY));
      if (legacy.length > 0) {
        ids = legacy;
        await AsyncStorage.setItem(key, JSON.stringify(ids)).catch(() => {});
      }
    }
    return ids;
  } catch {
    return [];
  }
}

export async function isSavedPost(
  kind: SavedKind,
  id: string,
): Promise<boolean> {
  const ids = await loadSavedIds(kind);
  return ids.includes(id);
}

// Bấm lưu / bỏ lưu. Trả về trạng thái mới (true = đã lưu).
export async function toggleSavedPost(
  kind: SavedKind,
  id: string,
): Promise<boolean> {
  try {
    const key = await perUserKey(kind);
    if (!key) return false;
    const ids = await loadSavedIds(kind);
    const next = ids.includes(id)
      ? ids.filter((x) => x !== id)
      : [...ids, id];
    await AsyncStorage.setItem(key, JSON.stringify(next));
    return next.includes(id);
  } catch {
    return false;
  }
}

export async function removeSavedPost(
  kind: SavedKind,
  id: string,
): Promise<void> {
  try {
    const key = await perUserKey(kind);
    if (!key) return;
    const ids = await loadSavedIds(kind);
    await AsyncStorage.setItem(
      key,
      JSON.stringify(ids.filter((x) => x !== id)),
    );
  } catch {}
}

// Toàn bộ bài đã lưu (cả 2 loại), mới lưu trước. Bài đã bị xóa khỏi
// DB thì bỏ qua lặng lẽ.
export async function loadSavedPosts(): Promise<SavedPost[]> {
  try {
    const [workoutIds, articleIds] = await Promise.all([
      loadSavedIds('workout'),
      loadSavedIds('article'),
    ]);
    const out: SavedPost[] = [];
    const posts: (Post | null)[] = await Promise.all([
      ...workoutIds.map((id) =>
        getPostById(id).catch(() => null),
      ),
      ...articleIds.map((id) => getPostById(id).catch(() => null)),
    ]);
    const kinds: SavedKind[] = [
      ...workoutIds.map(() => 'workout' as SavedKind),
      ...articleIds.map(() => 'article' as SavedKind),
    ];
    posts.forEach((p, i) => {
      if (!p) return;
      out.push({
        id: p.id,
        kind: kinds[i],
        title: p.title,
        summary: p.summary ?? null,
        cover_url: p.cover_url ?? null,
        duration_min: p.duration_min ?? null,
      });
    });
    return out;
  } catch {
    return [];
  }
}
