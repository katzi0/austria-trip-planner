import { ensureSchema, writeTrip } from "../lib/db";
import { TRIPS } from "../lib/trips";

async function main(): Promise<void> {
  await ensureSchema();
  for (const t of TRIPS) {
    await writeTrip(t.slug, t.seed);
    console.log(`seeded ${t.slug} ✓`);
  }
}

await main();
