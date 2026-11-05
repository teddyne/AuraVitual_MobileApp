// Ham thuan + hang so dung chung cho man hinh Chia se (doi nguyen van tu
// SharingScreen.tsx, khong doi logic).
export const CODE_RE = /^[A-HJKMNP-Z2-9]{8}$/;

export function fmtExpiry(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')} ngày ${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export function badgeBg(label: string): string {
  if (label === 'Tốt') return '#E8F5E9';
  if (label === 'Ổn định') return '#FFF8E1';
  if (label === 'Cần chú ý') return '#FFEBEE';
  return '#F1F1F1';
}
