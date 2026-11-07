// Hang so dung chung cho cum dinh duong.
// MEAL_ICONS giong het nhau o AddMealScreen va NutritionTrackerScreen
// nen chi giu mot ban o day, khong de ban sao thu hai.
// Luu y: round1 / toNum KHONG lay tu src/lib/nutritionApi.ts —
// ban trong lib khong export va toNum ban string (replace ',' -> '.')
// khac ban trong lib; chung nam o ./utils/nutritionFormat.ts.
import type { DraftItem, MealType } from '../../api/nutritionApi';

export const MEAL_ORDER: MealType[] = ['breakfast', 'lunch', 'dinner', 'snack'];
// ĐÃ BỎ MACRO_ICONS: chú thích biểu đồ không còn dùng emoji 🍞🥩🧈 nữa,
// chỉ còn chấm màu + tên + %, màu giữ nguyên như cũ.
export const MEAL_ICONS: Record<MealType, string> = {
  breakfast: '🍳',
  lunch: '🍱',
  dinner: '🍲',
  snack: '🍩',
};
export const MACRO_COLORS = {
  carbs: '#4E8A47',
  protein: '#A63D2F',
  fat: '#E8930C',
};
export const MACRO_DOT_COLORS = {
  carbs: '#4E8A47',
  protein: '#A63D2F',
  fat: '#E8B84B',
};
export const PRESET_SUGGESTIONS = [
  'Cơm trắng',
  'Trứng luộc',
  'Ức gà luộc',
  'Chuối',
  'Phở bò',
  'Bún chả',
  'Tôm hấp',
];
export const EXCLUDED_SUGGESTION_NAMES = new Set(['sữa tươi không đường']);
export const isExcludedSuggestion = (name: string) =>
  EXCLUDED_SUGGESTION_NAMES.has(name.trim().toLowerCase());
export const EMPTY_DRAFTS: Record<MealType, DraftItem[]> = {
  breakfast: [],
  lunch: [],
  dinner: [],
  snack: [],
};
export const DEFAULT_MEALS: MealType[] = ['breakfast', 'lunch', 'dinner'];
export const MEAL_TYPES: MealType[] = ['breakfast', 'lunch', 'dinner', 'snack'];
