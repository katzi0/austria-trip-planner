import { ensureSchema, writeTrip } from "../lib/db";
import { SEED_TRIP } from "../lib/seed";

async function main(): Promise<void> {
  await ensureSchema();
  await writeTrip("austria-2026", SEED_TRIP);
  console.log("seeded ✓");
}

await main();
