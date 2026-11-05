// Hang so dung chung cho cum Gia dinh (doi nguyen van tu SharingSettingsScreen).
import type { SharingSettings } from '../../lib/familyApi';

export const CONTENT_ROWS: {
  key: keyof Omit<SharingSettings, 'share_enabled'>;
  title: string;
  desc: string;
}[] = [
  { key: 'share_steps', title: 'Bước chân', desc: 'Số bước, quãng đường, kcal ước lượng' },
  { key: 'share_sleep', title: 'Giấc ngủ', desc: 'Thời lượng ngủ và mục tiêu giấc ngủ' },
  { key: 'share_heart_rate', title: 'Nhịp tim', desc: 'Nhịp tim lúc nghỉ' },
  { key: 'share_spo2', title: 'SpO2', desc: 'Độ bão hòa oxy trong máu' },
  { key: 'share_water', title: 'Nước', desc: 'Lượng nước đã uống trong ngày' },
  { key: 'share_weight', title: 'Cân nặng', desc: 'Cân nặng ghi nhận hôm nay' },
];
