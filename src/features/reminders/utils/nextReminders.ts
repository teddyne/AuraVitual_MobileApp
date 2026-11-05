// Tinh danh sach nhac sap toi de hien thi (doi nguyen van tu RemindersScreen).
// Luu y: man hinh goc tinh ra nextReminders nhung khong render no ra UI
// (chi con lai style previewCard/previewLine thua); giu nguyen phep tinh
// de khong doi hanh vi.
import { translate } from '../../../i18n/locale';
import { nextWaterWindow } from '../../../lib/reminders';
import type { NotifSettings } from './reminderSettings';

export function buildNextReminders(notif: NotifSettings): string[] {
  const nextReminders: string[] = [];
  if (notif.enabled) {
    const now = new Date();
    const nowMin = now.getHours() * 60 + now.getMinutes();
    if (notif.water) {
      const { window, tomorrow } = nextWaterWindow(now);
      nextReminders.push(
        `💧 ${translate('reminders.nextWater', {
          time: window.time,
          tomorrow: tomorrow ? translate('reminders.nextTomorrow') : '',
        })}`,
      );
    }
    if (notif.meal) {
      nextReminders.push(
        `🍽 ${translate('nutrition.breakfast')} ${notif.mealBreakfast} • ${translate('nutrition.lunch')} ${notif.mealLunch} • ${translate('nutrition.dinner')} ${notif.mealDinner}`,
      );
    }
    if (notif.wake) {
      nextReminders.push(
        `⏰ ${translate('reminders.nextWake', { time: notif.wakeTime })}`,
      );
    }
    if (notif.sleep) {
      const [h, m] = notif.sleepTime.split(':').map(Number);
      if (!Number.isNaN(h) && !Number.isNaN(m)) {
        const base = translate('reminders.nextSleep', { time: notif.sleepTime });
        nextReminders.push(
          h * 60 + m > nowMin
            ? `😴 ${base}`
            : `😴 ${base}${translate('reminders.nextTomorrow')}`,
        );
      }
    }
    if (notif.cycle) {
      nextReminders.push(
        `🌸 ${translate('reminders.nextCycle', { days: notif.cycleDaysBefore })}`,
      );
    }
  }
  return nextReminders;
}
