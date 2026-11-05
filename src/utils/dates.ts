// Hàm ngày tháng dùng chung cho các màn hình.
//
// pad / toKey / keyToDisplay đã có sẵn trong src/lib/sleepSession.ts
// (AlarmWatcher và màn hình Ngủ đều import từ đó) nên chỉ re-export
// ở đây, không định nghĩa lại — tránh bản sao thứ ba.
import { pad, toKey, keyToDisplay } from '../lib/sleepSession';

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
