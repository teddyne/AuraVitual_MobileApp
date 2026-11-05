export function fmt(n: number): string {
  return n.toLocaleString('vi-VN');
}

export function fmtHoursMinutes(totalMinutes: number): string {
  const h = Math.floor(totalMinutes / 60);
  const m = Math.round(totalMinutes % 60);
  return h > 0 ? `${h}h ${m}ph` : `${m}ph`;
}

export function fmtSleepHours(totalHours: number): string {
  const h = Math.floor(totalHours);
  const m = Math.round((totalHours - h) * 60);
  return `${h}h ${m}m`; // đúng dạng thẻ Figma: "7h 31m"
}
