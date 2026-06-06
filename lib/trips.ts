import type { TripInput } from "./trip-schema";
import { SEED_TRIP } from "./seed";
import { NEVELOT_TRIP } from "./seed-nevelot";

export const TRIPS = [
  { slug: "austria-2026", label: "טיול משפחתי", seed: SEED_TRIP },
  { slug: "nevelot-2026", label: "נבלות 40", seed: NEVELOT_TRIP },
] as const;

export const DEFAULT_SLUG = "austria-2026";

export type TripSlug = (typeof TRIPS)[number]["slug"];

export const isKnownSlug = (s: string): s is TripSlug =>
  TRIPS.some((t) => t.slug === s);

export const seedFor = (slug: string): TripInput =>
  TRIPS.find((t) => t.slug === slug)?.seed ?? SEED_TRIP;
