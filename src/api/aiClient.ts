// Client Gemini dung chung cho ca AI Camera (quét đĩa ăn) va AI Chat.
// Dat o src/lib/ vi ca features/nutrition va features/ai deu dung.
//
// Lỗi trong ảnh chụp (404, "models/gemini-1.5-flash is not found for API
// version v1beta"): model Flash 1.5 đã bị Google gỡ khỏi v1beta, nên mọi
// API key đều trả 404 — không phải key sai, không phải hết quota.
// Sửa: model chính gemini-2.5-flash, dự phòng gemini-2.0-flash; chỉ khi
// gặp 404 mới tự đổi model, các lỗi khác (key sai, hết quota) thì báo
// ngay chứ không thử lại vô ích.
//
// Hai lỗi phụ khác cũng sửa ở đây:
// - Bản cũ gửi trường snake_case (inline_data / mime_type). Gemini REST
//   yêu cầu camelCase: inlineData / mimeType.
// - Bản cũ ném nguyên chuỗi JSON lỗi của Gemini ra Alert. Ở đây mọi lỗi
//   HTTP chỉ còn lại một mã ngắn (AiErrorCode); màn hình tự dịch mã đó
//   thành câu tiếng Việt/Anh ngắn qua aiErrorMessageKey().

export type AiErrorCode =
  | 'ai_not_configured'
  | 'ai_model_not_found'
  | 'ai_key_invalid'
  | 'ai_quota'
  | 'ai_bad_request'
  | 'ai_failed';

export type AiVisionItem = {
  name: string;
  estimatedGrams: number;
  kcal: number;
  carbG: number;
  proteinG: number;
  fatG: number;
};

/** Model thử theo thứ tự: chính trước, dự phòng sau. */
export const GEMINI_MODELS = ['gemini-2.5-flash', 'gemini-2.0-flash'] as const;

const GENERATE_URL = (model: string, apiKey: string) =>
  `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

function toNum(v: unknown, fallback = 0): number {
  const n = typeof v === 'string' ? Number(v) : (v as number);
  return Number.isFinite(n) ? n : fallback;
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

function mapHttpStatus(status: number): AiErrorCode {
  if (status === 401 || status === 403) return 'ai_key_invalid';
  if (status === 429) return 'ai_quota';
  if (status === 400) return 'ai_bad_request';
  if (status === 404) return 'ai_model_not_found';
  return 'ai_failed';
}

/** Mã lỗi -> key i18n trong nutrition.* (dùng chung cho cả AI Camera). */
export function aiErrorMessageKey(code: string): string {
  switch (code) {
    case 'ai_not_configured':
      return 'nutrition.aiNotInstalled';
    case 'ai_model_not_found':
      return 'nutrition.aiModelUnavailable';
    case 'ai_key_invalid':
      return 'nutrition.aiKeyInvalid';
    case 'ai_quota':
      return 'nutrition.aiQuota';
    case 'ai_bad_request':
      return 'nutrition.aiFailed';
    default:
      return 'nutrition.aiFailed';
  }
}

function extractText(json: any): string {
  return (
    json?.candidates?.[0]?.content?.parts
      ?.map((p: any) => p?.text ?? '')
      .join('') ?? ''
  );
}

/** Cắt mảng JSON [...] đầu tiên trong câu trả lời (model hay kèm chữ). */
function extractJsonArray(text: string): unknown {
  const start = text.indexOf('[');
  const end = text.lastIndexOf(']');
  if (start === -1 || end === -1 || end <= start) {
    throw new Error('ai_failed');
  }
  return JSON.parse(text.slice(start, end + 1));
}

async function callGenerateContent(
  apiKey: string,
  body: Record<string, unknown>,
): Promise<string> {
  let lastError: AiErrorCode = 'ai_failed';
  for (const model of GEMINI_MODELS) {
    let res: Response;
    try {
      res = await fetch(GENERATE_URL(model, apiKey), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
    } catch {
      throw new Error('ai_failed');
    }
    if (res.ok) {
      const json = await res.json();
      return extractText(json);
    }
    const code = mapHttpStatus(res.status);
    // Chỉ 404 (model không còn tồn tại) mới đáng thử model dự phòng.
    if (code === 'ai_model_not_found') {
      lastError = code;
      continue;
    }
    throw new Error(code);
  }
  throw new Error(lastError);
}

/** Gọi Gemini dạng text — dùng cho AI Chat. */
export async function generateGeminiText(
  apiKey: string,
  prompt: string,
  systemInstruction?: string,
): Promise<string> {
  const parts: Record<string, unknown>[] = [{ text: prompt }];
  const body: Record<string, unknown> = {
    contents: [{ parts }],
    generationConfig: { temperature: 0.3, maxOutputTokens: 800 },
  };
  if (systemInstruction) {
    body.systemInstruction = { parts: [{ text: systemInstruction }] };
  }
  const text = await callGenerateContent(apiKey, body);
  if (!text.trim()) throw new Error('ai_failed');
  return text.trim();
}

/** Nhận diện đĩa ăn từ ảnh base64 (không kèm prefix data:image/...). */
export async function analyzeMealPhotoWithGemini(
  cleanBase64: string,
  apiKey: string,
): Promise<AiVisionItem[]> {
  const prompt =
    'Bạn là chuyên gia dinh dưỡng và thị giác máy tính. Hãy phân tích hình ảnh đĩa ăn này và nhận diện các món ăn hoặc nguyên liệu chính.\n' +
    'Đối với mỗi món ăn, ước tính: tên món ăn tiếng Việt, khối lượng (estimatedGrams), calo (kcal), tinh bột (carbG), đạm (proteinG), chất béo (fatG).\n' +
    'BẮT BUỘC chỉ trả về duy nhất một mảng JSON hợp lệ, không bọc markdown ```json ```, không kèm bất kỳ văn bản giải thích nào khác. Cấu trúc:\n' +
    '[{"name": "Cơm trắng", "estimatedGrams": 150, "kcal": 195, "carbG": 43, "proteinG": 4, "fatG": 0.5}]';

  const text = await callGenerateContent(apiKey, {
    contents: [
      {
        parts: [
          { text: prompt },
          {
            inlineData: {
              mimeType: 'image/jpeg',
              data: cleanBase64,
            },
          },
        ],
      },
    ],
    generationConfig: { temperature: 0.2, maxOutputTokens: 1000 },
  });
  if (!text.trim()) return [];

  let parsed: unknown;
  try {
    parsed = extractJsonArray(text);
  } catch {
    return [];
  }
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
