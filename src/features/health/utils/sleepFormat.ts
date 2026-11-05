import { DAY_SHORT } from '../constants';
import { AlarmItem } from '../../../lib/sleepSession';

export function fmtMMSS(sec: number) {
  if (!sec || sec < 0 || !isFinite(sec)) return '00:00';
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export function displayLabel(label: string) {
  const v = (label || 'Báo thức').trim();
  if (!v) return 'Báo thức';
  return v.charAt(0).toUpperCase() + v.slice(1);
}

export function alarmSub(a: AlarmItem) {
  const days = a.days ?? [];
  if (days.length === 0) return `${displayLabel(a.label)}, Một lần`;
  const short = [...days]
    .sort((x, y) => x - y)
    .map((d) => DAY_SHORT[d])
    .join(' ');
  return `${displayLabel(a.label)}, ${short}`;
}

