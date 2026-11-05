// Hàm thuần dùng chung cho cụm hồ sơ (ProfileSetup / Recommendation).
// Dời nguyên văn từ screens/ProfileSetupScreen.tsx (parseDate, isoToText,
// ageFromIso, fmtSleepHours, toDbTime, toTimeInput) và
// screens/RecommendationScreen.tsx (fmtHours).
//
// Lưu ý: toDbTime / toTimeInput KHÔNG import từ src/lib/sleepSession.ts
// vì bản trong ProfileSetup không giống hệt bản đó — toTimeInput ở đây
// chỉ slice(0, 5) (vd "6:30:00" -> "6:30"), còn bản sleepSession chuẩn
// hoá bằng regex ("6:30:00" -> "06:30"); toDbTime ở đây chỉ thêm ":00"
// khi chuỗi dài đúng 5 ký tự, còn bản sleepSession chuẩn hoá trước.
// Giữ nguyên văn ở đây để không đổi hành vi, đừng tạo bản thứ ba.
// fmtSleepHours cũng khác src/components/home/homeFormat.ts
// ("X giờ Y phút" so với "Xh Ym") nên giữ bản riêng ở đây.

export function parseDate(text: string) {
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(text.trim());
  if (!m) return null;
  const d = parseInt(m[1], 10),
    mo = parseInt(m[2], 10),
    y = parseInt(m[3], 10);
  const date = new Date(y, mo - 1, d);
  if (
    date.getFullYear() !== y ||
    date.getMonth() !== mo - 1 ||
    date.getDate() !== d
  )
    return null;
  if (y < 1900 || date > new Date()) return null;
  return {
    iso: `${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`,
    date,
  };
}

export function isoToText(iso: string) {
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

export function ageFromIso(iso: string | null) {
  if (!iso) return null;
  const b = new Date(iso + 'T00:00:00'),
    t = new Date();
  let age = t.getFullYear() - b.getFullYear();
  if (
    t.getMonth() < b.getMonth() ||
    (t.getMonth() === b.getMonth() && t.getDate() < b.getDate())
  )
    age -= 1;
  return age;
}

// locale: 'vi' mặc định giữ nguyên chuỗi cũ; 'en' dùng dạng rút gọn "Xh Ym".
export function fmtSleepHours(h: number, locale: 'vi' | 'en' = 'vi') {
  const hh = Math.floor(h),
    mm = Math.round((h - hh) * 60);
  if (locale === 'en')
    return mm === 60 ? `${hh + 1}h` : `${hh}h ${mm}m`;
  return mm === 60 ? `${hh + 1} giờ` : `${hh} giờ ${mm} phút`;
}

export const toDbTime = (v: string) => {
  const t = v.trim();
  return t.length === 5 ? `${t}:00` : t;
};

export const toTimeInput = (t: string | null) => (t ? t.slice(0, 5) : '');

export function fmtHours(h: number, locale: 'vi' | 'en' = 'vi') {
  const hh = Math.floor(h),
    mm = Math.round((h - hh) * 60);
  if (locale === 'en') return `${hh}h ${mm}m`;
  return `${hh} giờ ${mm} phút`;
}
