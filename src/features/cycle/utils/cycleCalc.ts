// Ham thuan tinh toan chu ky — doi nguyen van tu CycleTrackingScreen,
// chi doi cac ham ngay thang sang import tu src/utils/dates.ts.
import { addDaysKey, diffDays, keyToDisplay, pad } from '../../../utils/dates';
import { translate } from '../../../i18n/locale';
import type { Cycle } from '../types';

export function predictedPeriod(cycle: Cycle | null, key: string) {
  if (!cycle) return false;
  const diff = diffDays(cycle.start_date, key);
  if (diff < 0) return false;
  return (diff % cycle.cycle_length_days) + 1 <= cycle.period_length_days;
}

export type CycleStatus = {
  dayInCycle: number | null;
  daysUntilNext: number | null;
  phase: string;
  fertility: string;
  progress: number;
};

// Vong tron: tinh theo chu ky lap lai.
export function computeCycleStatus(
  cycle: Cycle | null,
  todayKey: string,
): CycleStatus {
  let dayInCycle: number | null = null;
  let daysUntilNext: number | null = null;
  let phase = '';
  let fertility = '';
  let progress = 0;
  if (cycle) {
    const diff = diffDays(cycle.start_date, todayKey);
    if (diff < 0) {
      daysUntilNext = -diff;
      phase = translate('cycle.phase.notStarted');
      fertility = translate('cycle.fertility.unknown');
    } else {
      const idx = Math.floor(diff / cycle.cycle_length_days);
      dayInCycle = (diff % cycle.cycle_length_days) + 1;
      daysUntilNext = diffDays(
        todayKey,
        addDaysKey(cycle.start_date, (idx + 1) * cycle.cycle_length_days),
      );
      progress = dayInCycle / cycle.cycle_length_days;
      const ovulation = Math.max(
        cycle.period_length_days + 1,
        cycle.cycle_length_days - 14,
      );
      if (dayInCycle <= cycle.period_length_days) {
        phase = translate('cycle.phase.period');
        fertility = translate('cycle.fertility.low');
      } else if (dayInCycle < ovulation - 5) {
        phase = translate('cycle.phase.follicular');
        fertility = translate('cycle.fertility.low');
      } else if (dayInCycle <= ovulation + 1) {
        phase = translate('cycle.phase.ovulation');
        fertility = translate('cycle.fertility.high');
      } else {
        phase = translate('cycle.phase.luteal');
        fertility = translate('cycle.fertility.low');
      }
    }
  }
  return { dayInCycle, daysUntilNext, phase, fertility, progress };
}

export type ActualLength = {
  start: string;
  expected: number;
  actual: number;
};

// Sai lech chu ky: thuc te cua mot ky = ngay bat dau ky sau tru ngay bat
// dau ky do.
export function computeActualLengths(cycles: Cycle[]): ActualLength[] {
  const actualLengths: ActualLength[] = [];
  for (let i = 0; i < cycles.length - 1; i++) {
    actualLengths.push({
      start: cycles[i].start_date,
      expected: cycles[i].cycle_length_days,
      actual: diffDays(cycles[i].start_date, cycles[i + 1]!.start_date),
    });
  }
  return actualLengths;
}

export function computeDeviations(
  cycle: Cycle | null,
  actualLengths: ActualLength[],
  todayKey: string,
): string[] {
  const deviations: string[] = [];
  if (cycle) {
    const predictedNext = addDaysKey(cycle.start_date, cycle.cycle_length_days);
    const lateDays = diffDays(predictedNext, todayKey);
    if (lateDays > 0) {
      deviations.push(
        translate('cycle.devLate', {
          late: lateDays,
          date: keyToDisplay(predictedNext),
        }),
      );
    }
  }
  if (actualLengths.length >= 2) {
    const latest = actualLengths[actualLengths.length - 1]!;
    const prevAvg =
      actualLengths.slice(0, -1).reduce((s, x) => s + x.actual, 0) /
      (actualLengths.length - 1);
    const dev = latest.actual - prevAvg;
    if (Math.abs(dev) >= 7) {
      deviations.push(
        translate(dev > 0 ? 'cycle.devLonger' : 'cycle.devShorter', {
          actual: latest.actual,
          avg: prevAvg.toFixed(1),
          diff: Math.abs(dev).toFixed(0),
        }),
      );
    }
  }
  if (actualLengths.length >= 3) {
    const vals = actualLengths.map((x) => x.actual);
    const range = Math.max(...vals) - Math.min(...vals);
    if (range >= 10) {
      deviations.push(
        translate('cycle.devIrregular', {
          range,
          min: Math.min(...vals),
          max: Math.max(...vals),
        }),
      );
    }
  }
  return deviations;
}

export function countPeriodDaysInMonth(
  year: number,
  month: number,
  isPeriodDay: (key: string) => boolean,
) {
  const n = new Date(year, month + 1, 0).getDate();
  let count = 0;
  for (let d = 1; d <= n; d++) {
    if (isPeriodDay(`${year}-${pad(month + 1)}-${pad(d)}`)) count++;
  }
  return count;
}
