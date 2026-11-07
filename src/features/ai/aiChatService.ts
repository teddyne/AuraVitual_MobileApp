// Trợ lý AI trong Cài đặt: trả lời từ dữ liệu thật của người dùng
// (profiles + health_metrics hôm nay), không tự bịa số liệu.
// - Có EXPO_PUBLIC_GEMINI_API_KEY: gọi Gemini qua src/lib/aiClient.ts.
// - Không có key: trả lời bằng luật (rule-based) ngay trên máy, vẫn
//   dùng đúng mục tiêu và chỉ số hôm nay đã tải được. Khi không có dữ
//   liệu thì nói rõ "chưa có dữ liệu", không đoán.

import AsyncStorage from '@react-native-async-storage/async-storage';
import { generateGeminiText } from '../../api/aiClient';
import type { Locale } from '../../i18n/translations';

export type AiChatMessage = { role: 'user' | 'assistant'; text: string };

export type AiChatContext = {
  displayName?: string | null;
  calorieGoal?: number | null;
  stepGoal?: number | null;
  waterGoalMl?: number | null;
  sleepGoalHours?: number | null;
  stepsToday?: number | null;
  sleepToday?: number | null;
  waterToday?: number | null;
  weightKg?: number | null;
};

export const FREE_CHAT_DAILY_LIMIT = 5;

const usageKey = (dateKey: string) => `auravital:aiChatUsage:${dateKey}`;

export function todayKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export async function loadChatUsage(): Promise<number> {
  const raw = await AsyncStorage.getItem(usageKey(todayKey()));
  return raw ? Number(raw) || 0 : 0;
}

export async function recordChatUsage(): Promise<number> {
  const next = (await loadChatUsage()) + 1;
  await AsyncStorage.setItem(usageKey(todayKey()), String(next));
  return next;
}

function fmt(n: number | null | undefined, unit: string): string {
  return n == null ? 'chưa có dữ liệu' : `${n.toLocaleString('vi-VN')} ${unit}`;
}

function buildSystemPrompt(ctx: AiChatContext, locale: Locale): string {
  const name = ctx.displayName || 'bạn';
  return (
    `Bạn là trợ lý sức khỏe AuraVital, trả lời ngắn gọn, thực tế bằng ` +
    `${locale === 'en' ? 'tiếng Anh' : 'tiếng Việt'} cho ${name}. ` +
    `Chỉ dùng các số liệu sau (lấy từ database thật của người dùng), ` +
    `không bịa thêm số liệu. Nếu một chỉ số chưa có thì nói rõ là chưa ` +
    `có dữ liệu và gợi ý cách ghi nhận, không đoán con số.\n` +
    `- Mục tiêu calo/ngày: ${fmt(ctx.calorieGoal, 'kcal')}\n` +
    `- Mục tiêu bước chân/ngày: ${fmt(ctx.stepGoal, 'bước')}\n` +
    `- Mục tiêu nước/ngày: ${fmt(ctx.waterGoalMl, 'ml')}\n` +
    `- Mục tiêu ngủ/ngày: ${ctx.sleepGoalHours ?? 'chưa có dữ liệu'} giờ\n` +
    `- Hôm nay: bước ${fmt(ctx.stepsToday, 'bước')}, ` +
    `ngủ ${ctx.sleepToday ?? 'chưa có dữ liệu'} giờ, ` +
    `nước ${fmt(ctx.waterToday, 'ml')}, cân nặng ${fmt(ctx.weightKg, 'kg')}.\n` +
    `Kết quả chỉ là gợi ý sức khỏe chung, không thay thế tư vấn y tế.`
  );
}

/** Trả lời offline bằng luật, dùng đúng số liệu đã có. */
export function answerOffline(
  message: string,
  ctx: AiChatContext,
  locale: Locale,
): string {
  const en = locale === 'en';
  const m = message.toLowerCase();
  const name = ctx.displayName ? ` ${ctx.displayName}` : '';

  if (/(calo|kcal|ăn|dinh dưỡng|nutrition|calori)/.test(m)) {
    return en
      ? `Your calorie goal is ${ctx.calorieGoal ?? 'not set yet'} kcal/day. Log meals in Nutrition Tracker so I can compare what you ate today with your goal.`
      : `Mục tiêu calo của${name} là ${ctx.calorieGoal ?? 'chưa đặt'} kcal/ngày. Bạn ghi bữa ăn ở mục Theo dõi dinh dưỡng thì mình mới so được hôm nay đã nạp bao nhiêu với mục tiêu.`;
  }
  if (/(bước|step|đi bộ|walking)/.test(m)) {
    return en
      ? `Today: ${ctx.stepsToday ?? 'no data'} steps / goal ${ctx.stepGoal ?? 'not set'} steps.`
      : `Hôm nay${name} đi được ${ctx.stepsToday ?? 'chưa có dữ liệu'} bước / mục tiêu ${ctx.stepGoal ?? 'chưa đặt'} bước.`;
  }
  if (/(ngủ|sleep|giấc)/.test(m)) {
    return en
      ? `Sleep today: ${ctx.sleepToday ?? 'no data'}h / goal ${ctx.sleepGoalHours ?? 'not set'}h. Try to keep a regular bedtime.`
      : `Giấc ngủ hôm nay: ${ctx.sleepToday ?? 'chưa có dữ liệu'} giờ / mục tiêu ${ctx.sleepGoalHours ?? 'chưa đặt'} giờ. Bạn cố giữ giờ ngủ đều mỗi ngày nhé.`;
  }
  if (/(nước|water|uống)/.test(m)) {
    return en
      ? `Water today: ${ctx.waterToday ?? 'no data'} ml / goal ${ctx.waterGoalMl ?? 'not set'} ml.`
      : `Nước hôm nay: ${ctx.waterToday ?? 'chưa có dữ liệu'} ml / mục tiêu ${ctx.waterGoalMl ?? 'chưa đặt'} ml.`;
  }
  if (/(bài tập|tập|workout|exercise|yoga)/.test(m)) {
    return en
      ? `Open Explore to pick a workout that fits your level. The Family plan adds personal plans and full video lessons.`
      : `Bạn mở mục Khám phá để chọn bài tập theo cấp độ nhé. Gói Family sẽ có thêm giáo án riêng và video đầy đủ.`;
  }
  if (/(chu kỳ|cycle|kinh nguyệt|period)/.test(m)) {
    return en
      ? `Cycle tracking is in the Cycle tab, based on the dates you logged in the cycles table.`
      : `Theo dõi chu kỳ nằm ở tab Chu kỳ, tính theo ngày bạn đã ghi trong bảng cycles.`;
  }
  if (/(chào|hello|hi\b)/.test(m)) {
    return en
      ? `Hello${name}! Ask me about calories, steps, sleep, water or workouts — I answer from your real data.`
      : `Chào${name}! Bạn hỏi mình về calo, bước chân, giấc ngủ, nước uống hay bài tập nhé — mình trả lời theo dữ liệu thật của bạn.`;
  }
  return en
    ? `I can help with calories, steps, sleep, water, cycles and workouts, based on your goals and today's data. What do you want to check?`
    : `Mình giúp được về calo, bước chân, giấc ngủ, nước uống, chu kỳ và bài tập — theo mục tiêu và dữ liệu hôm nay của bạn. Bạn muốn xem gì?`;
}

export async function sendAiChat(
  history: AiChatMessage[],
  ctx: AiChatContext,
  locale: Locale,
): Promise<{ text: string; online: boolean }> {
  const apiKey = process.env.EXPO_PUBLIC_GEMINI_API_KEY;
  const lastUser = [...history].reverse().find((m) => m.role === 'user');
  if (!apiKey || !lastUser) {
    return { text: answerOffline(lastUser?.text ?? '', ctx, locale), online: false };
  }
  const transcript = history
    .slice(-8)
    .map((m) => `${m.role === 'user' ? 'Người dùng' : 'Trợ lý'}: ${m.text}`)
    .join('\n');
  const text = await generateGeminiText(
    apiKey,
    `${transcript}\nTrợ lý:`,
    buildSystemPrompt(ctx, locale),
  );
  return { text, online: true };
}
