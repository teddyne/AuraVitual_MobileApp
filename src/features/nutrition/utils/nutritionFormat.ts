// Ham thuan dung chung cho cum dinh duong, doi nguyen van tu cac man hinh.
// toLocalDateString KHONG nam o day — da co san trong src/lib/nutritionApi.ts.
import type { MealType } from '../../../lib/nutritionApi';

export function defaultMealType(): MealType {
  const h = new Date().getHours();
  if (h < 10) return 'breakfast';
  if (h < 15) return 'lunch';
  if (h < 21) return 'dinner';
  return 'snack';
}

export const round1 = (n: number) => Math.round(n * 10) / 10;

export const toNum = (s: string, fallback = 0) => {
  const n = Number(s.replace(',', '.'));
  return Number.isFinite(n) ? n : fallback;
};

export const timeOf = (iso: string) => {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};
