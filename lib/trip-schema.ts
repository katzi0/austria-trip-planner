import { z } from "zod";

export const RegionSchema = z.object({
  name: z.string(),
  short: z.string(),
  hex: z.string(),
  hotel: z.string(),
  town: z.string().optional(),
  lat: z.number(),
  lng: z.number(),
  icon: z.string(),
});

export const DaySchema = z.object({
  n: z.number().int().positive(),
  d: z.string(),
  dow: z.string(),
  base: z.string(),
  color: z.string(),
  intensity: z.number().int().min(1).max(5),
  icon: z.string(),
  lat: z.number(),
  lng: z.number(),
  title: z.string(),
  acts: z.array(z.string()),
  drive: z.string(),
  cardLabel: z.string(),
  cardClass: z.enum(["free", "discount", "none", "na"]),
  food: z.string(),
  rain: z.string(),
  tips: z.string(),
  star: z.boolean().optional(),
  outlier: z.boolean().optional(),
  overnight: z.string().optional(),
});

export const TripSchema = z.object({
  baseOrder: z.array(z.string()),
  regions: z.record(z.string(), RegionSchema),
  days: z.array(DaySchema),
});

export type Region = z.infer<typeof RegionSchema>;
export type Day = z.infer<typeof DaySchema>;
export type Trip = z.infer<typeof TripSchema>;

export const BUSY: Record<number, string> = {
  1: "רגוע",
  2: "נינוח",
  3: "פעיל",
  4: "עמוס",
  5: "אינטנסיבי",
};
