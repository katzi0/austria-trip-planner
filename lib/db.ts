import { sql } from "@vercel/postgres";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import type { Trip } from "./trip-schema";
import { TripSchema } from "./trip-schema";
import { SEED_TRIP } from "./seed";

function hasPostgres(): boolean {
  return Boolean(process.env.POSTGRES_URL && process.env.POSTGRES_URL.length > 0);
}

function localPath(slug: string): string {
  return path.join(process.cwd(), ".data", `${slug}.json`);
}

async function readLocal(slug: string): Promise<Trip> {
  try {
    const raw = await readFile(localPath(slug), "utf8");
    return TripSchema.parse(JSON.parse(raw));
  } catch {
    return TripSchema.parse(SEED_TRIP);
  }
}

async function writeLocal(slug: string, trip: Trip): Promise<void> {
  const file = localPath(slug);
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, JSON.stringify(trip, null, 2), "utf8");
}

export async function ensureSchema(): Promise<void> {
  if (!hasPostgres()) return;
  await sql`
    CREATE TABLE IF NOT EXISTS trips (
      id SERIAL PRIMARY KEY,
      slug TEXT UNIQUE NOT NULL,
      data JSONB NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `;
}

export async function readTrip(slug = "austria-2026"): Promise<Trip> {
  if (!hasPostgres()) return readLocal(slug);
  await ensureSchema();
  const result = await sql<{ data: unknown }>`SELECT data FROM trips WHERE slug = ${slug} LIMIT 1`;
  if (result.rows.length === 0) {
    const seeded = TripSchema.parse(SEED_TRIP);
    await sql`
      INSERT INTO trips (slug, data)
      VALUES (${slug}, ${JSON.stringify(seeded)}::jsonb)
      ON CONFLICT (slug) DO NOTHING
    `;
    return seeded;
  }
  return TripSchema.parse(result.rows[0].data);
}

export async function writeTrip(slug: string, trip: Trip): Promise<void> {
  const valid = TripSchema.parse(trip);
  if (!hasPostgres()) {
    await writeLocal(slug, valid);
    return;
  }
  await ensureSchema();
  await sql`
    INSERT INTO trips (slug, data, updated_at)
    VALUES (${slug}, ${JSON.stringify(valid)}::jsonb, now())
    ON CONFLICT (slug) DO UPDATE
      SET data = EXCLUDED.data, updated_at = now()
  `;
}
