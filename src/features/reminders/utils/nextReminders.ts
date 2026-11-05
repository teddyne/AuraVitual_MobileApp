// Tinh danh sach nhac sap toi de hien thi (doi nguyen van tu RemindersScreen).
// Luu y: man hinh goc tinh ra nextReminders nhung khong render no ra UI
// (chi con lai style previewCard/previewLine thua); giu nguyen phep tinh
// de khong doi hanh vi.
import { nextWaterWindow } from '../../../lib/reminders';
import type { NotifSettings } from './reminderSettings';

export function buildNextReminders(
  notif: NotifSettings,
  locale: string,
): string[] {
  const nextReminders: string[] = [];
  if (notif.enabled) {
    const now = new Date();
    const nowMin = now.getHours() * 60 + now.getMinutes();
    if (notif.water) {
      const { window, tomorrow } = nextWaterWindow(now);
      nextReminders.push(
        `💧 ${locale === 'vi' ? 'Uống nước lúc' : 'Drink water at'} ${window.time}${tomorrow ? (locale === 'vi' ? ' (ngày mai)' : ' (tomorrow)') : ''}`,
      );
    }
    if (notif.meal) {
      nextReminders.push(
        `🍽 ${locale === 'vi' ? 'Bữa sáng' : 'Breakfast'} ${notif.mealBreakfast} • ${locale === 'vi' ? 'Bữa trưa' : 'Lunch'} ${notif.mealLunch} • ${locale === 'vi' ? 'Bữa tối' : 'Dinner'} ${notif.mealDinner}`,
      );
    }
    if (notif.wake) {
      nextReminders.push(
        `⏰ ${locale === 'vi' ? 'Nhắc thức dậy lúc' : 'Wake reminder at'} ${notif.wakeTime}`,
      );
    }
    if (notif.sleep) {
      const [h, m] = notif.sleepTime.split(':').map(Number);
      if (!Number.isNaN(h) && !Number.isNaN(m)) {
        if (h * 60 + m > nowMin)
          nextReminders.push(
            `😴 ${locale === 'vi' ? 'Đi ngủ lúc' : 'Bedtime at'} ${notif.sleepTime}`,
          );
        else
          nextReminders.push(
            `😴 ${locale === 'vi' ? 'Đi ngủ lúc' : 'Bedtime at'} ${notif.sleepTime} (${locale === 'vi' ? 'ngày mai' : 'tomorrow'})`,
          );
      }
    }
    if (notif.cycle) {
      nextReminders.push(
        `🌸 ${locale === 'vi' ? `Nhắc chu kỳ trước ${notif.cycleDaysBefore} ngày` : `Cycle reminder ${notif.cycleDaysBefore} days before`}`,
      );
    }
  }
  return nextReminders;
}
