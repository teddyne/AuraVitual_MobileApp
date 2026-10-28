export type ActivityId =
  'sedentary' | 'light' | 'moderate' | 'high' | 'veryHigh';
export type DurationUnit = 'day' | 'week' | 'month';

export const ACTIVITY_LEVELS: {
  id: ActivityId;
  factor: number;
  title: string;
  desc: string;
  sessions: number;
  waterExtra: number;
}[] = [
  {
    id: 'sedentary',
    factor: 1.2,
    title: 'Rất ít',
    desc: 'Ít hoạt động, chỉ đi làm (đi học)',
    sessions: 0,
    waterExtra: 0,
  },
  {
    id: 'light',
    factor: 1.375,
    title: 'Ít',
    desc: 'Có tập nhẹ nhàng, tuần 1-3 buổi',
    sessions: 2,
    waterExtra: 250,
  },
  {
    id: 'moderate',
    factor: 1.55,
    title: 'Trung bình',
    desc: 'Có vận động vừa, 4-5 buổi/tuần',
    sessions: 4,
    waterExtra: 500,
  },
  {
    id: 'high',
    factor: 1.725,
    title: 'Cao',
    desc: 'Vận động nhiều, 6-7 buổi/tuần',
    sessions: 6,
    waterExtra: 750,
  },
  {
    id: 'veryHigh',
    factor: 1.9,
    title: 'Rất cao',
    desc: 'Vận động rất nhiều, ngày tập 2 lần',
    sessions: 7,
    waterExtra: 1000,
  },
];

function durationUnitWord(u: DurationUnit) {
  return u === 'day' ? 'ngày' : u === 'month' ? 'tháng' : 'tuần';
}
export function calcBmi(w: number, h: number) {
  return h > 0 ? w / Math.pow(h / 100, 2) : 0;
}
export function asiaCategory(bmi: number) {
  if (bmi < 18.5)
    return { label: 'Thiếu cân', risk: 'Suy nhược, thiếu chất, loãng xương' };
  if (bmi < 23)
    return { label: 'Bình thường', risk: 'Lý tưởng, nguy cơ bệnh lý thấp' };
  if (bmi < 25)
    return { label: 'Thừa cân', risk: 'Tiền béo phì, cần chỉnh lối sống' };
  if (bmi < 30)
    return { label: 'Béo phì độ I', risk: 'Tăng nguy cơ tim mạch, tiểu đường' };
  return { label: 'Béo phì độ II', risk: 'Nguy cơ bệnh tật rất cao' };
}
export function calcBmr(w: number, h: number, age: number, gender: string) {
  const base = 10 * w + 6.25 * h - 5 * age;
  return gender === 'Nam' ? base + 5 : gender === 'Nữ' ? base - 161 : base - 78;
}
export function parseTimeMinutes(t: string): number | null {
  const m = /^([01]\d|2[0-3]):[0-5]\d$/.exec(t.trim());
  return m ? parseInt(m[1], 10) * 60 + parseInt(t.slice(3, 5), 10) : null;
}
export function sleepHoursFromTimes(bed: string, wake: string): number | null {
  const b = parseTimeMinutes(bed),
    w = parseTimeMinutes(wake);
  if (b === null || w === null) return null;
  const mins = (w - b + 1440) % 1440;
  return mins === 0 ? 24 : +(mins / 60).toFixed(2);
}
export function addDaysISO(iso: string, days: number): string | null {
  const d = new Date(iso + 'T00:00:00');
  if (isNaN(d.getTime())) return null;
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}
export function isoToLabel(iso: string | null): string {
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}
export function exercisePlan(
  goal: string,
  activityId: ActivityId | null,
  weightKg: number,
  userSessions?: number | null,
  userMinutes?: number | null,
) {
  const cfg: Record<
    string,
    { minSessions: number; duration: number; met: number }
  > = {
    maintain: { minSessions: 3, duration: 30, met: 4 },
    lose: { minSessions: 5, duration: 45, met: 4.5 },
    gain: { minSessions: 4, duration: 45, met: 5 },
    sleep: { minSessions: 3, duration: 30, met: 3.5 },
    cycle: { minSessions: 3, duration: 30, met: 4 },
  };
  const c = cfg[goal] ?? cfg.maintain;
  const level = ACTIVITY_LEVELS.find((a) => a.id === activityId);
  const userChosen = !!(userSessions && userMinutes);
  const sessions = userChosen
    ? userSessions!
    : Math.max(level?.sessions ?? 0, c.minSessions);
  const duration = userChosen ? userMinutes! : c.duration;
  const minutes = sessions * duration;
  return {
    minutes,
    sessions,
    duration,
    met: c.met,
    kcalPerWeek: Math.round(minutes * ((c.met * weightKg * 3.5) / 200)),
    desc: `${duration} phút x ${sessions} buổi/tuần${userChosen ? ' (bạn chọn)' : ''}`,
  };
}
export function calcRecommendation(input: {
  weightKg: number;
  heightCm: number;
  age: number | null;
  gender: string;
  goal: string;
  activityId: ActivityId | null;
  targetWeightKg: number | null;
  targetDurationDays?: number | null;
  targetDurationWeeks?: number | null;
  durationValue?: number | null;
  durationUnit?: DurationUnit | null;
  exerciseSessions?: number | null;
  exerciseMinutesPerSession?: number | null;
  sleepBedtime?: string | null;
  sleepWakeTime?: string | null;
  cycleStartDate?: string | null;
  cycleLengthDays?: number | null;
  periodLengthDays?: number | null;
}) {
  const { weightKg, heightCm, goal, targetWeightKg } = input;
  const bmi = calcBmi(weightKg, heightCm);
  const ageUsed = input.age ?? 25;
  const bmr = Math.round(calcBmr(weightKg, heightCm, ageUsed, input.gender));
  const level = ACTIVITY_LEVELS.find((a) => a.id === input.activityId);
  const factor = level ? level.factor : 1.55;
  const tdee = Math.round(bmr * factor);
  const durationDays =
    input.targetDurationDays ??
    (input.targetDurationWeeks ? input.targetDurationWeeks * 7 : null);
  const durationWeeks = durationDays ? durationDays / 7 : null;
  const durationLabel =
    input.durationValue && input.durationUnit
      ? `${input.durationValue} ${durationUnitWord(input.durationUnit)}`
      : durationWeeks
        ? `${durationWeeks} tuần`
        : '';
  const targetDiff =
    targetWeightKg !== null ? +(targetWeightKg - weightKg).toFixed(1) : null;
  let calorieTarget = tdee,
    deficit = 0,
    surplus = 0,
    deficitRate = 0,
    surplusRate = 0,
    weeklyChangeKg = 0;
  let actualWeeks: number | null = null,
    isTooFast = false,
    recommendedCalorie: number | null = null,
    recommendedWeeks: number | null = null,
    adviceText: string | null = null;
  if (goal === 'lose' && targetWeightKg !== null && targetDiff !== null) {
    if (durationWeeks && durationWeeks > 0) {
      weeklyChangeKg = Math.abs(targetDiff) / durationWeeks;
      deficit = Math.round((weeklyChangeKg * 7700) / 7);
      calorieTarget = tdee - deficit;
      deficitRate = tdee > 0 ? deficit / tdee : 0;
      actualWeeks = durationWeeks;
      isTooFast = weeklyChangeKg > 0.5 || deficit > 750 || calorieTarget < bmr;
      if (isTooFast) {
        recommendedWeeks = Math.ceil(Math.abs(targetDiff) / 0.5);
        recommendedCalorie = tdee - Math.min(550, Math.max(0, tdee - bmr));
        adviceText = `Lời khuyên: ${weeklyChangeKg.toFixed(2)} kg/tuần là nhanh hơn mức an toàn khoảng 0,5 kg/tuần${calorieTarget < bmr ? ' và tổng calo dưới BMR' : ''}. Nếu theo mức an toàn, bạn nên ăn khoảng ${recommendedCalorie.toLocaleString('vi-VN')} kcal/ngày trong khoảng ${recommendedWeeks} tuần.`;
      }
    } else {
      const rate = bmi >= 30 ? 0.2 : bmi >= 25 ? 0.15 : 0.1;
      calorieTarget = Math.max(
        tdee - Math.min(Math.round(tdee * rate), 750),
        bmr,
      );
      deficit = tdee - calorieTarget;
      deficitRate = tdee > 0 ? deficit / tdee : 0;
      const w = (deficit * 7) / 7700;
      actualWeeks = w > 0 ? Math.ceil(Math.abs(targetDiff) / w) : null;
    }
  } else if (
    goal === 'gain' &&
    targetWeightKg !== null &&
    targetDiff !== null
  ) {
    if (durationWeeks && durationWeeks > 0) {
      weeklyChangeKg = Math.abs(targetDiff) / durationWeeks;
      surplus = Math.round((weeklyChangeKg * 7700) / 7);
      calorieTarget = tdee + surplus;
      surplusRate = tdee > 0 ? surplus / tdee : 0;
      actualWeeks = durationWeeks;
      isTooFast = weeklyChangeKg > 0.25 || surplus > 500;
      if (isTooFast) {
        recommendedWeeks = Math.ceil(Math.abs(targetDiff) / 0.25);
        recommendedCalorie = tdee + 275;
        adviceText = `Lời khuyên: ${weeklyChangeKg.toFixed(2)} kg/tuần là nhanh hơn mức an toàn khoảng 0,25 kg/tuần. Nếu theo mức an toàn, bạn nên ăn khoảng ${recommendedCalorie.toLocaleString('vi-VN')} kcal/ngày trong khoảng ${recommendedWeeks} tuần.`;
      }
    } else {
      surplus = Math.min(Math.round(tdee * 0.1), 500);
      calorieTarget = tdee + surplus;
      const w = (surplus * 7) / 7700;
      actualWeeks = w > 0 ? Math.ceil(Math.abs(targetDiff) / w) : null;
    }
  } else if (goal === 'maintain') actualWeeks = durationWeeks;
  const recommendedSleepHours =
    input.age === null ? 8 : input.age < 18 ? 9 : input.age >= 65 ? 7.5 : 8;
  const recommendedSleepRange =
    input.age !== null && input.age < 18
      ? '8–10 giờ'
      : input.age !== null && input.age >= 65
        ? '7–8 giờ'
        : '7–9 giờ';
  const habitualSleepHours =
    input.sleepBedtime && input.sleepWakeTime
      ? sleepHoursFromTimes(input.sleepBedtime, input.sleepWakeTime)
      : null;
  const cycleNextPeriodISO =
    input.cycleStartDate && input.cycleLengthDays
      ? addDaysISO(input.cycleStartDate, input.cycleLengthDays)
      : null;
  const cycleOvulationISO =
    input.cycleStartDate && input.cycleLengthDays
      ? addDaysISO(input.cycleStartDate, input.cycleLengthDays - 14)
      : null;
  const waterBase = weightKg * 35,
    waterExtra = level?.waterExtra ?? 0;
  const waterMl = Math.round((waterBase + waterExtra) / 10) * 10;
  const heightM = heightCm / 100;
  return {
    weightKg,
    heightCm,
    age: input.age,
    ageEstimated: input.age === null,
    gender: input.gender,
    goal,
    activityId: input.activityId,
    activityLabel: level ? level.title : 'Trung bình (mặc định)',
    targetWeightKg,
    bmi,
    asia: asiaCategory(bmi),
    bmr,
    factor,
    tdee,
    calorieTarget,
    calorieDiff: calorieTarget - tdee,
    deficit,
    surplus,
    deficitRate,
    surplusRate,
    durationValue: input.durationValue ?? null,
    durationUnit: input.durationUnit ?? null,
    durationDays,
    durationWeeks,
    durationLabel,
    weeklyChangeKg: +weeklyChangeKg.toFixed(2),
    actualWeeks,
    targetWeeks: actualWeeks,
    isTooFast,
    recommendedCalorie,
    recommendedWeeks,
    adviceText,
    durationTooShort: isTooFast,
    waterMl,
    waterBase,
    waterExtra,
    waterCups: Math.ceil(waterMl / 250),
    exercise: exercisePlan(
      goal,
      input.activityId,
      weightKg,
      input.exerciseSessions,
      input.exerciseMinutesPerSession,
    ),
    healthyMinKg: +(18.5 * heightM * heightM).toFixed(1),
    healthyMaxKg: +(22.9 * heightM * heightM).toFixed(1),
    targetDiff,
    sleepBedtime: input.sleepBedtime ?? null,
    sleepWakeTime: input.sleepWakeTime ?? null,
    recommendedSleepHours,
    recommendedSleepRange,
    habitualSleepHours,
    cycleStartDate: input.cycleStartDate ?? null,
    cycleLengthDays: input.cycleLengthDays ?? null,
    periodLengthDays: input.periodLengthDays ?? null,
    cycleNextPeriodISO,
    cycleNextPeriodLabel: isoToLabel(cycleNextPeriodISO),
    cycleOvulationISO,
    cycleOvulationLabel: isoToLabel(cycleOvulationISO),
  };
}
