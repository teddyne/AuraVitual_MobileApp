// Hàm ngày tháng dùng chung cho các màn hình.
//
// pad / toKey / keyToDisplay đã có sẵn trong src/lib/sleepSession.ts
// (AlarmWatcher và màn hình Ngủ đều import từ đó) nên chỉ re-export
// ở đây, không định nghĩa lại — tránh bản sao thứ ba.
import { pad, toKey, keyToDisplay } from './health/sleepSession';

export { pad, toKey, keyToDisplay };

export const fromKey = (k: string) => {
  const [y, m, d] = k.split('-').map(Number);
  return new Date(y, m - 1, d);
};

export const displayToKey = (t: string) => {
  const p = t.trim().split('/');
  if (p.length !== 3) return null;
  const d = Number(p[0]);
  const m = Number(p[1]);
  const y = Number(p[2]);
  const date = new Date(y, m - 1, d);
  if (
    date.getFullYear() !== y ||
    date.getMonth() !== m - 1 ||
    date.getDate() !== d
  )
    return null;
  return toKey(date);
};

export const addDaysKey = (k: string, days: number) => {
  const d = fromKey(k);
  d.setDate(d.getDate() + days);
  return toKey(d);
};

export const diffDays = (aKey: string, bKey: string) =>
  Math.round((fromKey(bKey).getTime() - fromKey(aKey).getTime()) / 86400000);

export const addDays = (d: Date, n: number) => {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
};

/**
 * Định dạng ngày khi gõ: chỉ giữ chữ số, tự chèn '/' thành DD/MM/YYYY.
 * Vd gõ 17082005 -> 17/08/2005. Kẹp ngày 01-31, tháng 01-12, năm
 * 1900-năm hiện tại (chỉ kẹp khi đã gõ đủ số của phần đó). Dùng cho
 * mọi ô nhập ngày DD/MM/YYYY (ngày sinh, ngày bắt đầu kỳ kinh...).
 * Không đổi hành vi các hàm cũ trên (parseDate vẫn ở profileFormat).
 */
export function formatDateInputDigits(text: string): string {
  const digits = text.replace(/[^0-9]/g, '').slice(0, 8);
  let d = digits.slice(0, 2);
  let m = digits.slice(2, 4);
  let y = digits.slice(4, 8);
  if (d.length === 2) {
    const n = Number(d);
    d = String(Math.min(Math.max(n, 1), 31)).padStart(2, '0');
  }
  if (m.length === 2) {
    const n = Number(m);
    m = String(Math.min(Math.max(n, 1), 12)).padStart(2, '0');
  }
  if (y.length === 4) {
    const n = Number(y);
    const thisYear = new Date().getFullYear();
    y = String(Math.min(Math.max(n, 1900), thisYear));
  }
  let out = d;
  if (m) out += `/${m}`;
  else if (digits.length > 2) out += '/';
  if (y) out += `/${y}`;
  else if (digits.length > 4) out += '/';
  return out;
}

/** Parse chuỗi DD/MM/YYYY, trả null khi sai định dạng hoặc ngày không có thật. */
export function parseDateText(text: string): { iso: string; date: Date } | null {
  const key = displayToKey(text);
  if (!key) return null;
  const [y, m, d] = key.split('-').map(Number);
  return { iso: key, date: new Date(y, m - 1, d) };
}

export function isValidDateText(text: string): boolean {
  return parseDateText(text) !== null;
}
