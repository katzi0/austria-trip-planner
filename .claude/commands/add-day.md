---
description: Guided add-a-day flow that respects the schema
---

Add a new day to the current trip. Use the `trip-editor` sub-agent when the edit itself runs — it knows the schema. This command is the intake form.

## Intake

Ask the user for these (one AskUserQuestion call, batched):
- **Date** — `d.m` format, e.g. `15.7`. Validate it's a real 2026 date and that no existing day already has that date.
- **Title** — Hebrew, e.g. `Salzburg cafés ובית הקפה זאכר`.
- **Base** — show the existing keys from `lib/seed.ts` `REGIONS` (read it to enumerate): `moxy`, `wagrain`, `ramsau`, `henriette`.
- **Coords** — `lat`, `lng`. Suggest looking up on https://www.google.com/maps if unknown.
- **Icon** — show the catalog from `components/icons.tsx` `ICON_PATHS`. Common picks: `castle`, `palace`, `lake`, `peak`, `church`, `museum`, `spa`, `cablecar`, `coaster`, `kart`, `gem`, `zoo`, `ferris`, `plane`, `car`.
- **Intensity** — 1 (`רגוע`) … 5 (`אינטנסיבי`).
- **Card class** — `free` / `discount` / `none` / `na`.

Defaults for the rest (the user can edit later via `/edit`):
- `acts: []`
- `drive: ""`
- `cardLabel: ""` (set a sensible Hebrew default based on cardClass: free→`חינם בכרטיס`, discount→`הנחה בכרטיס`, none→`לא בכרטיס`, na→`ללא כרטיס`)
- `food: ""`
- `rain: "—"`
- `tips: ""`
- `color` — copy the chosen base region's `hex` as a starting point.

Compute:
- `n` — next integer after the largest existing `n`.
- `dow` — Hebrew day-of-week for the date (Sunday=`ראשון`, Monday=`שני`, Tuesday=`שלישי`, Wednesday=`רביעי`, Thursday=`חמישי`, Friday=`שישי`, Saturday=`שבת`).

## Insertion

Build the Day object. Then hand off to the `trip-editor` sub-agent with the constructed object and these instructions:

> Insert this Day into `.data/austria-2026.json` (or `lib/seed.ts` if that file doesn't exist) at the position that keeps `days[]` ordered by date. Save through the API (PATCH `/api/trip` with `passphrase: "dev"`) if the dev server is reachable, otherwise edit the file directly. Then run `/check-data` and report.

## Confirm

After the sub-agent reports, run `/verify` and print its result. If anything failed, leave a clear failure line and stop — do **not** retry blindly.
