// Cai dat nhac nho cua RemindersScreen (doi nguyen van tu man hinh).
//
// LUU Y: src/lib/reminders.ts da export san NOTIF_SETTINGS_KEY
// ('@auravital:notifications'), ReminderSettings va DEFAULT_REMINDERS gan
// giong het ban nay — nhung ban cua man hinh khac o 2 diem nen KHONG doi
// sang import lib de giu nguyen hanh vi: (1) waterIntervalHours la
// bat buoc o day (trong lib la optional), (2) DEFAULT o day co
// waterIntervalHours: 2 (ban lib khong co). Gop ban sao la viec rieng,
// can quyet sau, khong lam trong dot tach nay.
export const NOTIF_KEY = '@auravital:notifications';
export const CYCLE_DAYS = [1, 2, 3, 5];
export const GREY_PILL = '#D9D9D9';

export type NotifSettings = {
  enabled: boolean;
  water: boolean;
  waterIntervalHours: number;
  sleep: boolean;
  sleepTime: string;
  cycle: boolean;
  cycleDaysBefore: number;
  meal: boolean;
  mealBreakfast: string;
  mealLunch: string;
  mealDinner: string;
  wake: boolean;
  wakeTime: string;
};

export const DEFAULT_NOTIF: NotifSettings = {
  enabled: true,
  water: true,
  waterIntervalHours: 2,
  sleep: true,
  sleepTime: '22:00',
  cycle: true,
  cycleDaysBefore: 3,
  meal: true,
  mealBreakfast: '07:00',
  mealLunch: '12:00',
  mealDinner: '18:30',
  wake: true,
  wakeTime: '07:30',
};

export const normalizeTime = (text: string): string | null => {
  const m = text.trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  const hh = Number(m[1]);
  const mm = Number(m[2]);
  if (hh > 23 || mm > 59) return null;
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
};
