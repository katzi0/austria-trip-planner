---
description: Validate the current trip data against the Zod schema
---

Validate the current trip JSON against `TripSchema` from `lib/trip-schema.ts` and report.

Resolve which file is the "current trip":
- If `.data/austria-2026.json` exists → use that (it's the live persisted trip).
- Else → use `SEED_TRIP` exported by `lib/seed.ts` (the baseline).

Use this `tsx` one-shot from the project root (adjust the import path between `.data` and `seed.ts` as needed):

```bash
npx tsx -e "
import { existsSync, readFileSync } from 'node:fs';
import { TripSchema } from './lib/trip-schema';
import { SEED_TRIP } from './lib/seed';
const path = '.data/austria-2026.json';
const trip = existsSync(path) ? JSON.parse(readFileSync(path,'utf8')) : SEED_TRIP;
const r = TripSchema.safeParse(trip);
if (!r.success) {
  const issues = r.error.issues.map(i => '  · ' + i.path.join('.') + ' — ' + i.message).join('\n');
  console.log('✗ INVALID:\n' + issues);
  process.exit(1);
}
const t = r.data;
const baseRefs = new Set(t.days.map(d => d.base));
const missing = [...baseRefs].filter(k => !(k in t.regions));
const orphans = Object.keys(t.regions).filter(k => !baseRefs.has(k));
const orderMatch = new Set(t.baseOrder).size === Object.keys(t.regions).length;
console.log('✓ valid · ' + t.days.length + ' days · ' + Object.keys(t.regions).length + ' regions · baseOrder: ' + t.baseOrder.join(', '));
if (missing.length) console.log('  ! days reference missing region(s): ' + missing.join(', '));
if (orphans.length) console.log('  ! region(s) with no day: ' + orphans.join(', '));
if (!orderMatch) console.log('  ! baseOrder length differs from regions');
"
```

Report only the script's output (one or a few lines). Don't modify files. If `npx tsx` is missing, instruct the user to run `npm install` first.
