import { ensureSchema, writeTrip } from "../lib/db";
import { TRIPS } from "../lib/trips";
import { TripSchema } from "../lib/trip-schema";

async function main(): Promise<void> {
  await ensureSchema();
  for (const t of TRIPS) {
    await writeTrip(t.slug, TripSchema.parse(t.seed));
    console.log(`seeded ${t.slug} ✓`);
  }
}

await main();
