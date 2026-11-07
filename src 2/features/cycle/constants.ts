import type { Flow } from './types';

export const PRIMARY = '#4E8A47';
export const TODAY_BG = '#2E7D32';
export const PINK_BG = '#FCE4EC';
export const PINK_TEXT = '#880E4F';
export const YELLOW_DOT = '#F2C94C';
export const CELL_W = 68;
export const CELL_GAP = 8;

export const FLOW_OPTIONS: {
  value: Exclude<Flow, null>;
  labelKey: string;
}[] = [
  { value: 'light', labelKey: 'cycle.flow.light' },
  { value: 'medium', labelKey: 'cycle.flow.medium' },
  { value: 'heavy', labelKey: 'cycle.flow.heavy' },
];

export const SYMPTOMS = [
  { key: 'happy', labelKey: 'cycle.symptom.happy' },
  { key: 'tired', labelKey: 'cycle.symptom.tired' },
  { key: 'bloated', labelKey: 'cycle.symptom.bloated' },
  { key: 'pain', labelKey: 'cycle.symptom.pain' },
  { key: 'cramps', labelKey: 'cycle.symptom.cramps' },
  { key: 'headache', labelKey: 'cycle.symptom.headache' },
  { key: 'nausea', labelKey: 'cycle.symptom.nausea' },
  { key: 'hot_flash', labelKey: 'cycle.symptom.hot_flash' },
];

export const WD = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
export const WD_EN = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

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

export const MONTH_NAMES_EN = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];
