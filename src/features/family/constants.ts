// Hang so dung chung cho cum Gia dinh (doi nguyen van tu SharingSettingsScreen).
// title/desc la key i18n (family.content.*); man hinh dich bang t() khi render.
// icon: ten Ionicons (dang outline) hien o moi hang — dong bo voi cac
// hang Row o trang Tai khoan, khong dung emoji.
import type { SharingSettings } from '../../api/familyApi';

export const CONTENT_ROWS: {
  key: keyof Omit<SharingSettings, 'share_enabled'>;
  titleKey: string;
  descKey: string;
  icon: string;
}[] = [
  { key: 'share_steps', titleKey: 'family.content.steps.title', descKey: 'family.content.steps.desc', icon: 'footsteps-outline' },
  { key: 'share_sleep', titleKey: 'family.content.sleep.title', descKey: 'family.content.sleep.desc', icon: 'moon-outline' },
  { key: 'share_heart_rate', titleKey: 'family.content.heartRate.title', descKey: 'family.content.heartRate.desc', icon: 'heart-outline' },
  { key: 'share_spo2', titleKey: 'family.content.spo2.title', descKey: 'family.content.spo2.desc', icon: 'pulse-outline' },
  { key: 'share_water', titleKey: 'family.content.water.title', descKey: 'family.content.water.desc', icon: 'water-outline' },
  { key: 'share_weight', titleKey: 'family.content.weight.title', descKey: 'family.content.weight.desc', icon: 'barbell-outline' },
  { key: 'share_kcal', titleKey: 'family.content.kcal.title', descKey: 'family.content.kcal.desc', icon: 'flame-outline' },
  { key: 'share_cycle', titleKey: 'family.content.cycle.title', descKey: 'family.content.cycle.desc', icon: 'calendar-outline' },
];
