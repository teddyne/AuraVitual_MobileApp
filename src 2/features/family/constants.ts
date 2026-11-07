// Hang so dung chung cho cum Gia dinh (doi nguyen van tu SharingSettingsScreen).
// title/desc la key i18n (family.content.*); man hinh dich bang t() khi render.
import type { SharingSettings } from '../../api/familyApi';

export const CONTENT_ROWS: {
  key: keyof Omit<SharingSettings, 'share_enabled'>;
  titleKey: string;
  descKey: string;
}[] = [
  { key: 'share_steps', titleKey: 'family.content.steps.title', descKey: 'family.content.steps.desc' },
  { key: 'share_sleep', titleKey: 'family.content.sleep.title', descKey: 'family.content.sleep.desc' },
  { key: 'share_heart_rate', titleKey: 'family.content.heartRate.title', descKey: 'family.content.heartRate.desc' },
  { key: 'share_spo2', titleKey: 'family.content.spo2.title', descKey: 'family.content.spo2.desc' },
  { key: 'share_water', titleKey: 'family.content.water.title', descKey: 'family.content.water.desc' },
  { key: 'share_weight', titleKey: 'family.content.weight.title', descKey: 'family.content.weight.desc' },
];
