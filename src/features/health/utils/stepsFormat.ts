// Ham thuan cho man hinh buoc chan — doi nguyen van tu
// StepsDetailScreen, chi doi cac ham ngay thang sang import tu
// src/utils/dates.ts.
import { pad, toKey } from '../../../utils/dates';
import { WD } from '../constants';

export type Range = 'today' | 'week' | 'month';

export const fmt = (n: number) =>
  Math.round(n)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, '.');

export const formatSyncTime = (iso: string) => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return `${pad(d.getHours())}:${pad(d.getMinutes())} ${pad(d.getDate())}/${pad(d.getMonth() + 1)}`;
};

export function buildDaily(displayMap: Map<string, number>, days: number) {
  const out: { label: string; steps: number }[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    out.push({ label: WD[d.getDay()], steps: displayMap.get(toKey(d)) || 0 });
  }
  return out;
}
