import { supabase } from './supabase';

export type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack';

export type Food = {
  id: string;
  name: string;
  servingLabel: string;
  kcalPerServing: number;
  carbG: number;
  proteinG: number;
  fatG: number;
  barcode?: string | null;
  source?: string;
};

export type DraftItem = {
  key: string;
  foodId: string | null;
  name: string;
  servingLabel: string;
  servings: number;
  kcalPerServing: number;
  carbPerServing: number;
  proteinPerServing: number;
  fatPerServing: number;
  source: 'library' | 'barcode' | 'ai' | 'manual';
  barcode?: string | null;
  grams?: number;
};

export type LoggedItem = {
  id: string; // id của dòng meal_items, dùng để xóa đúng 1 dòng
  mealId: string;
  mealType: MealType;
  eatenAt: string;
  name: string;
  servings: number;
  kcal: number;
  carbG: number;
  proteinG: number;
  fatG: number;
  grams?: number | null;
  barcode?: string | null;
};

export type DayNutrition = {
  date: string;
  calorieGoal: number;
  totalKcal: number;
  totalCarb: number;
  totalProtein: number;
  totalFat: number;
  meals: Record<MealType, LoggedItem[]>;
};

export type BarcodeProduct = {
  barcode: string;
  name: string;
  kcal100: number;
  carb100: number;
  protein100: number;
  fat100: number;
};

export type AiSuggestionItem = {
  name: string;
  estimatedGrams: number;
  kcal: number;
  carbG: number;
  proteinG: number;
  fatG: number;
};

const EMPTY_MEALS: Record<MealType, LoggedItem[]> = {
  breakfast: [],
  lunch: [],
  dinner: [],
  snack: [],
};

export function uuidv4(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export function toLocalDateString(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

const round1 = (n: number) => Math.round(n * 10) / 10;
const toNum = (v: any, fallback = 0) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
};

function toFood(row: any): Food {
  return {
    id: row.id,
    name: row.name,
    servingLabel: row.serving_label ?? '1 suất',
    kcalPerServing: toNum(row.kcal_per_serving),
    carbG: toNum(row.carb_g),
    proteinG: toNum(row.protein_g),
    fatG: toNum(row.fat_g),
    barcode: row.barcode ?? null,
    source: row.source,
  };
}

export async function searchFoods(
  userId: string,
  query: string,
): Promise<Food[]> {
  const q = query.trim();
  if (q.length < 2) return [];
  const pattern = `%${q}%`;

  const [systemRes, ownRes] = await Promise.all([
    supabase
      .from('foods')
      .select(
        'id, name, serving_label, kcal_per_serving, carb_g, protein_g, fat_g, barcode, source',
      )
      .is('owner_id', null)
      .ilike('name', pattern)
      .limit(20),
    supabase
      .from('foods')
      .select(
        'id, name, serving_label, kcal_per_serving, carb_g, protein_g, fat_g, barcode, source',
      )
      .eq('owner_id', userId)
      .ilike('name', pattern)
      .limit(20),
  ]);
  if (systemRes.error) throw systemRes.error;
  if (ownRes.error) throw ownRes.error;

  const seen = new Set<string>();
  const out: Food[] = [];
  for (const row of [...(systemRes.data ?? []), ...(ownRes.data ?? [])]) {
    if (!seen.has(row.id)) {
      seen.add(row.id);
      out.push(toFood(row));
    }
  }
  return out;
}

export async function getFrequentFoods(userId: string): Promise<Food[]> {
  const since = new Date();
  since.setDate(since.getDate() - 30);
  const { data: meals, error: mealError } = await supabase
    .from('meals')
    .select('id')
    .eq('user_id', userId)
    .gte('eaten_at', since.toISOString())
    .limit(200);
  if (mealError) throw mealError;
  const mealIds = (meals ?? []).map((m: any) => m.id);
  if (mealIds.length === 0) return [];

  const { data: items, error: itemError } = await supabase
    .from('meal_items')
    .select('food_id')
    .in('meal_id', mealIds)
    .not('food_id', 'is', null)
    .limit(500);
  if (itemError) throw itemError;

  const counts = new Map<string, number>();
  for (const it of items ?? []) {
    if (it.food_id) counts.set(it.food_id, (counts.get(it.food_id) ?? 0) + 1);
  }
  const topIds = [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([id]) => id);
  if (topIds.length === 0) return [];

  const { data: foods, error: foodError } = await supabase
    .from('foods')
    .select(
      'id, name, serving_label, kcal_per_serving, carb_g, protein_g, fat_g, barcode, source',
    )
    .in('id', topIds);
  if (foodError) throw foodError;
  const byId = new Map((foods ?? []).map((f: any) => [f.id, toFood(f)]));
  return topIds.map((id) => byId.get(id)).filter(Boolean) as Food[];
}

export async function getNutritionDay(
  userId: string,
  date: string,
): Promise<DayNutrition> {
  const { data: profile } = await supabase
    .from('profiles')
    .select('calorie_goal')
    .eq('id', userId)
    .maybeSingle();

  const start = new Date(`${date}T00:00:00`);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);

  const { data: meals, error } = await supabase
    .from('meals')
    .select(
      'id, meal_type, eaten_at, meal_items(id, food_id, name, servings, kcal, carb_g, protein_g, fat_g, grams, barcode)',
    )
    .eq('user_id', userId)
    .gte('eaten_at', start.toISOString())
    .lt('eaten_at', end.toISOString())
    .order('eaten_at', { ascending: true });
  if (error) throw error;

  const resultMeals: Record<MealType, LoggedItem[]> = {
    breakfast: [],
    lunch: [],
    dinner: [],
    snack: [],
  };
  let totalKcal = 0;
  let totalCarb = 0;
  let totalProtein = 0;
  let totalFat = 0;

  for (const m of meals ?? []) {
    const type = m.meal_type as MealType;
    if (!resultMeals[type]) continue;
    for (const it of m.meal_items ?? []) {
      const item: LoggedItem = {
        id: it.id,
        mealId: m.id,
        mealType: type,
        eatenAt: m.eaten_at,
        name: it.name,
        servings: toNum(it.servings, 1),
        kcal: toNum(it.kcal),
        carbG: toNum(it.carb_g),
        proteinG: toNum(it.protein_g),
        fatG: toNum(it.fat_g),
        grams: it.grams ?? null,
        barcode: it.barcode ?? null,
      };
      resultMeals[type].push(item);
      totalKcal += item.kcal;
      totalCarb += item.carbG;
      totalProtein += item.proteinG;
      totalFat += item.fatG;
    }
  }

  return {
    date,
    calorieGoal: toNum(profile?.calorie_goal, 0),
    totalKcal: round1(totalKcal),
    totalCarb: round1(totalCarb),
    totalProtein: round1(totalProtein),
    totalFat: round1(totalFat),
    meals: resultMeals,
  };
}

export async function fetchBarcodeProduct(
  barcode: string,
): Promise<BarcodeProduct> {
  const res = await fetch(
    `https://world.openfoodfacts.org/api/v2/product/${barcode}.json`,
  );
  const data = await res.json();
  if (data.status !== 1 || !data.product) {
    throw new Error('barcode_not_found');
  }
  const nutriments = data.product.nutriments ?? {};
  const kcalRaw =
    nutriments['energy-kcal_100g'] ??
    (nutriments['energy_100g'] != null
      ? nutriments['energy_100g'] / 4.184
      : null);
  const carbRaw = nutriments['carbohydrates_100g'];
  const proteinRaw = nutriments['proteins_100g'];
  const fatRaw = nutriments['fat_100g'];
  if (
    kcalRaw == null &&
    carbRaw == null &&
    proteinRaw == null &&
    fatRaw == null
  ) {
    throw new Error('barcode_no_nutrition');
  }
  return {
    barcode,
    name:
      data.product.product_name ||
      data.product.generic_name ||
      'Unknown product',
    kcal100: round1(toNum(kcalRaw)),
    carb100: round1(toNum(carbRaw)),
    protein100: round1(toNum(proteinRaw)),
    fat100: round1(toNum(fatRaw)),
  };
}

async function callGeminiVision(
  cleanBase64: string,
  apiKey: string,
): Promise<AiSuggestionItem[]> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;

  const prompt =
    'Bạn là chuyên gia dinh dưỡng và thị giác máy tính. Hãy phân tích hình ảnh đĩa ăn này và nhận diện các món ăn hoặc nguyên liệu chính.\n' +
    'Đối với mỗi món ăn, ước tính: tên món ăn tiếng Việt, khối lượng (estimatedGrams), calo (kcal), tinh bột (carbG), đạm (proteinG), chất béo (fatG).\n' +
    'BẮT BUỘC chỉ trả về duy nhất một mảng JSON hợp lệ, không bọc markdown ```json ```, không kèm bất kỳ văn bản giải thích nào khác. Cấu trúc:\n' +
    '[{"name": "Cơm trắng", "estimatedGrams": 150, "kcal": 195, "carbG": 43, "proteinG": 4, "fatG": 0.5}]';

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [
        {
          parts: [
            { text: prompt },
            {
              inline_data: {
                mime_type: 'image/jpeg',
                data: cleanBase64,
              },
            },
          ],
        },
      ],
      generationConfig: {
        temperature: 0.2,
        maxOutputTokens: 1000,
      },
    }),
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Gemini API error (${res.status}): ${errorText}`);
  }

  const json = await res.json();
  const text = json?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) return [];

  const cleaned = text
    .replace(/```(?:json)?/gi, '')
    .replace(/```/g, '')
    .trim();
  const parsed = JSON.parse(cleaned);
  if (!Array.isArray(parsed)) return [];

  return parsed.map((it: any) => ({
    name: String(it.name ?? it.food_name ?? 'Món ăn'),
    estimatedGrams: toNum(
      it.estimatedGrams ?? it.grams ?? it.estimated_grams,
      100,
    ),
    kcal: round1(toNum(it.kcal ?? it.calories, 150)),
    carbG: round1(toNum(it.carbG ?? it.carb_g ?? it.carbs, 20)),
    proteinG: round1(toNum(it.proteinG ?? it.protein_g ?? it.protein, 10)),
    fatG: round1(toNum(it.fatG ?? it.fat_g ?? it.fat, 5)),
  }));
}

export async function analyzeMealPhoto(
  base64: string,
): Promise<AiSuggestionItem[]> {
  const cleanBase64 = base64.replace(/^data:image\/[a-zA-Z]+;base64,/, '');

  let edgeFunctionError: unknown;
  try {
    const { data, error } = await supabase.functions.invoke('analyze-meal', {
      body: { imageBase64: cleanBase64 },
    });
    if (error) throw error;
    if (!error && data) {
      const rawItems: any[] = Array.isArray(data)
        ? data
        : (data?.items ?? data?.suggestions ?? []);
      return rawItems.map((it: any) => ({
        name: it.name ?? it.food_name ?? 'Món ăn nhận diện',
        estimatedGrams: toNum(
          it.estimated_grams ?? it.estimatedGrams ?? it.grams,
          100,
        ),
        kcal: round1(toNum(it.kcal ?? it.calories)),
        carbG: round1(
          toNum(it.carb_g ?? it.carbG ?? it.carbs ?? it.carbohydrates),
        ),
        proteinG: round1(toNum(it.protein_g ?? it.proteinG ?? it.protein)),
        fatG: round1(toNum(it.fat_g ?? it.fatG ?? it.fat)),
      }));
    }
  } catch (error) {
    edgeFunctionError = error;
  }

  const geminiKey = process.env.EXPO_PUBLIC_GEMINI_API_KEY;
  if (geminiKey) {
    return callGeminiVision(cleanBase64, geminiKey);
  }

  if (edgeFunctionError) {
    throw new Error('ai_not_configured');
  }
  throw new Error('ai_not_configured');
}

export function aiToDraft(item: AiSuggestionItem, index: number): DraftItem {
  return {
    key: `ai-${Date.now()}-${index}`,
    foodId: null,
    name: item.name,
    servingLabel: `${item.estimatedGrams} g`,
    servings: 1,
    kcalPerServing: item.kcal,
    carbPerServing: item.carbG,
    proteinPerServing: item.proteinG,
    fatPerServing: item.fatG,
    source: 'ai',
    grams: item.estimatedGrams,
  };
}

export async function uploadMealPhoto(
  userId: string,
  mealId: string,
  base64: string,
): Promise<string | null> {
  try {
    const path = `${userId}/${mealId}.jpg`;
    const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
    const { error } = await supabase.storage
      .from('meal-photos')
      .upload(path, bytes, { contentType: 'image/jpeg', upsert: true });
    if (error) return null;
    return path;
  } catch {
    return null;
  }
}

export function draftTotals(draft: DraftItem[]) {
  let kcal = 0;
  let carb = 0;
  let protein = 0;
  let fat = 0;
  for (const it of draft) {
    kcal += it.kcalPerServing * it.servings;
    carb += it.carbPerServing * it.servings;
    protein += it.proteinPerServing * it.servings;
    fat += it.fatPerServing * it.servings;
  }
  return {
    kcal: round1(kcal),
    carb: round1(carb),
    protein: round1(protein),
    fat: round1(fat),
  };
}

export async function saveMeal(
  userId: string,
  input: {
    mealId: string;
    mealType: MealType;
    eatenAtISO: string;
    photoPath: string | null;
    items: DraftItem[];
  },
) {
  // Nguồn của bữa: chỉ khi cả bữa cùng 1 nguồn thì mới ghi nguồn đó, còn lại là manual.
  const sources = new Set(input.items.map((it) => it.source));
  const mealSource = sources.size === 1 ? [...sources][0] : 'manual';
  // Mã vạch của bữa: chỉ khi bữa có đúng 1 món có mã vạch thì mới ghi mã đó.
  const barcoded = input.items.filter((it) => it.barcode);
  const mealBarcode =
    barcoded.length === 1 ? (barcoded[0].barcode ?? null) : null;

  const p_items = input.items.map((it) => ({
    food_id: it.foodId,
    name: it.name,
    servings: it.servings,
    // save_meal nhận tổng theo dòng, không phải giá trị / 1 suất.
    kcal: round1(it.kcalPerServing * it.servings),
    carb_g: round1(it.carbPerServing * it.servings),
    protein_g: round1(it.proteinPerServing * it.servings),
    fat_g: round1(it.fatPerServing * it.servings),
    grams: it.grams ?? (it.source === 'barcode' ? it.servings * 100 : null),
    barcode: it.barcode ?? null,
  }));

  const { error } = await supabase.rpc('save_meal', {
    p_meal_id: input.mealId,
    p_eaten_at: input.eatenAtISO,
    p_meal_type: input.mealType,
    p_photo_path: input.photoPath,
    p_items,
    p_source: mealSource,
    p_barcode: mealBarcode,
  });
  if (error) throw error;
}

export async function deleteMealItem(itemId: string) {
  const { data, error } = await supabase
    .from('meal_items')
    .select('meal_id')
    .eq('id', itemId)
    .single();
  if (error) throw error;

  const { error: delError } = await supabase
    .from('meal_items')
    .delete()
    .eq('id', itemId);
  if (delError) throw delError;

  // Xóa xong mà bữa đó hết món thì xóa luôn dòng meals đó,
  // để Tracker không còn thẻ bữa 0 kcal.
  if (data?.meal_id) {
    const { data: remaining } = await supabase
      .from('meal_items')
      .select('id')
      .eq('meal_id', data.meal_id)
      .limit(1);
    if (!remaining || remaining.length === 0) {
      await supabase.from('meals').delete().eq('id', data.meal_id);
    }
  }
}
