import type { Flow } from './types';

export const PRIMARY = '#4E8A47';
export const TODAY_BG = '#2E7D32';
export const PINK_BG = '#FCE4EC';
export const PINK_TEXT = '#880E4F';
export const YELLOW_DOT = '#F2C94C';
export const CELL_W = 68;
export const CELL_GAP = 8;

export const FLOW_OPTIONS: { value: Exclude<Flow, null>; label: string }[] = [
  { value: 'light', label: 'Ít' },
  { value: 'medium', label: 'Trung bình' },
  { value: 'heavy', label: 'Nhiều' },
];

export const SYMPTOMS = [
  { key: 'happy', label: 'Vui vẻ' },
  { key: 'tired', label: 'Mệt mỏi' },
  { key: 'bloated', label: 'Đầy hơi' },
  { key: 'pain', label: 'Đau nhẹ' },
  { key: 'cramps', label: 'Đau bụng' },
  { key: 'headache', label: 'Đau đầu' },
  { key: 'nausea', label: 'Buồn nôn' },
  { key: 'hot_flash', label: 'Bốc hỏa' },
];

export const WD = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];

export const MONTH_NAMES = [
  'Tháng 1',
  'Tháng 2',
  'Tháng 3',
  'Tháng 4',
  'Tháng 5',
  'Tháng 6',
  'Tháng 7',
  'Tháng 8',
  'Tháng 9',
  'Tháng 10',
  'Tháng 11',
  'Tháng 12',
];
