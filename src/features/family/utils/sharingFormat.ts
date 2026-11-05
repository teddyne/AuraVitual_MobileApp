// Ham thuan + hang so dung chung cho man hinh Chia se (doi nguyen van tu
// SharingScreen.tsx, khong doi logic).
import { translate } from '../../../i18n/locale';

export const CODE_RE = /^[A-HJKMNP-Z2-9]{8}$/;

export function fmtExpiry(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return translate('family.codeExpiry', {
    time: `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`,
    date: `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`,
  });
}

export function badgeBg(label: string): string {
  if (label === translate('family.badgeGood')) return '#E8F5E9';
  if (label === translate('family.badgeStable')) return '#FFF8E1';
  if (label === translate('family.badgeAttention')) return '#FFEBEE';
  return '#F1F1F1';
}
