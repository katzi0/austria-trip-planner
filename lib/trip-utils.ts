import type { Trip, Day } from "./trip-schema";

export function nightsOfBase(trip: Trip, k: string): number {
  return trip.days.filter((d) => d.base === k).length;
}

export function baseDateRange(trip: Trip, k: string): string {
  const ds = trip.days.filter((d) => d.base === k);
  if (!ds.length) return "";
  return `${ds[0].d}–${ds[ds.length - 1].d}`;
}

export function visibleDayIndexes(trip: Trip, dayScope: string): number[] {
  return trip.days.map((_, i) => i).filter((i) => dayScope === "all" || trip.days[i].base === dayScope);
}

export function todayIndex(trip: Trip, now = new Date()): number {
  const t = new Date(now);
  t.setHours(0, 0, 0, 0);
  return trip.days.findIndex((d) => {
    const [day, mon] = d.d.split(".").map(Number);
    const dt = new Date(2026, mon - 1, day);
    return dt.getTime() === t.getTime();
  });
}

export function dateOf(d: Day, year = 2026): Date {
  const [day, mon] = d.d.split(".").map(Number);
  return new Date(year, mon - 1, day);
}
