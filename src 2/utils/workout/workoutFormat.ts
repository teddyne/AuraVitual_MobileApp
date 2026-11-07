// Ham dinh dang thuan cho cum workout (doi nguyen van tu cac man hinh).
//
// Luu y: addDays(iso: string, days: number) cua WorkoutLogScreen
// KHONG nam o day — chu ky cua no khac addDays(Date) trong
// src/utils/dates.ts nen cu de nguyen tai cho trong man hinh.
// Cung khong dung lai fmtMMSS cua cum suc khoe (co them guard
// 00:00) hay fmtDur/toKey/keyToDisplay cua dates.ts: dinh dang
// tra ve khac (fmtHM tra "1h 5ph" / "5ph", displayDate tra "d/m"
// khong nam, fmtClock khong co guard).
import { translate } from '../../i18n/locale';

export function displayDate(iso: string): string {
  const [, m, d] = iso.split('-');
  return `${d}/${m}`;
}

export function fmtHM(totalMinutes: number): string {
  const h = Math.floor(totalMinutes / 60);
  const m = Math.round(totalMinutes % 60);
  return h > 0
    ? translate('workout.fmt.hoursMinutes', { h, m })
    : translate('workout.fmt.minutesOnly', { m });
}

export function fmtClock(totalSec: number): string {
  const m = Math.floor(totalSec / 60);
  const s = Math.floor(totalSec % 60);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}
