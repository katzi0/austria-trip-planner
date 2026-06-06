# Data model

The whole trip is a single JSON document. Zod schemas in [`lib/trip-schema.ts`](../lib/trip-schema.ts) are the contract — parsed on every DB read and PATCH write. The canonical example is [`SEED_TRIP`](../lib/seed.ts).

## `Trip`

```ts
{
  baseOrder: string[]            // ordered region keys, drives the Areas ribbon
  regions:   Record<string, Region>
  days:      Day[]               // expected to be sorted by date
}
```

## `Region`

A base — a hotel/area the family stays at for several nights.

| Field   | Type   | Notes |
|---------|--------|-------|
| `name`  | string | Hebrew display name shown in the ribbon (`וינה · הגעה`) |
| `short` | string | Short Hebrew label (rarely used; keep for parity with the prototype) |
| `hex`   | string | Hex color (`#1F86AE`) used for hotel markers + dashed routes |
| `hotel` | string | Hotel name — may mix Latin + Hebrew (`Alpina Wagrain`) |
| `lat`   | number | Latitude (WGS84) of the hotel |
| `lng`   | number | Longitude (WGS84) of the hotel |
| `icon`  | string | Must be a key in [`ICON_PATHS`](../components/icons.tsx) |

The map key (`"moxy"`, `"wagrain"`, …) is what `Day.base` references.

## `Day`

One day in the itinerary.

| Field        | Type                                           | Notes |
|--------------|------------------------------------------------|-------|
| `n`          | int ≥ 1                                        | 1-based day number, unique |
| `d`          | string `"d.m"`                                 | e.g. `"14.7"`. Year 2026 is implicit ([`lib/trip-utils.ts`](../lib/trip-utils.ts) `dateOf`). |
| `dow`        | Hebrew DOW                                     | `ראשון \| שני \| שלישי \| רביעי \| חמישי \| שישי \| שבת` |
| `base`       | string                                         | Must be a key in `regions` |
| `color`      | string                                         | Hex color for the pin + ticket. Often inherits the base's color. |
| `intensity`  | 1 \| 2 \| 3 \| 4 \| 5                          | Maps to `BUSY` Hebrew label (`רגוע \| נינוח \| פעיל \| עמוס \| אינטנסיבי`) |
| `icon`       | string                                         | Must be a key in `ICON_PATHS` |
| `lat`, `lng` | number                                         | The day's main attraction location |
| `title`      | string                                         | Hebrew title shown on the ticket + panel header |
| `acts`       | string[]                                       | Bullet activities for the day |
| `drive`      | string                                         | Free-text drive time (`~2 שעות מוינה`) |
| `cardLabel`  | string                                         | Free-text label for the discount-card chip |
| `cardClass`  | `"free" \| "discount" \| "none" \| "na"`       | Drives the card chip color: green / yellow / brown / gray |
| `food`       | string                                         | Restaurant / café recommendation |
| `rain`       | string                                         | Plan B for rain (use `"—"` for "no plan needed") |
| `tips`       | string                                         | Practical advice |
| `star`       | boolean?                                       | `true` for highlight days (weekends, wow moments) |
| `outlier`    | boolean?                                       | `true` when the day is geographically far from its base → excluded from the region polygon |
| `overnight`  | string?                                        | Set on the day you switch hotels: `"הלילה: <hotel> (<city>)"` |

## Cross-field invariants

The schema doesn't enforce these — the data should:

1. Every `day.base` is a key in `regions`.
2. `baseOrder` contains every key in `regions` exactly once, no extras.
3. `days[]` is sorted by date (`d`).
4. Each `n` is unique and ideally matches the day's position in `days[]`.

`/check-data` (see [`.claude/commands/check-data.md`](../.claude/commands/check-data.md)) warns on (1) and (2).

## Icon catalog

From [`components/icons.tsx`](../components/icons.tsx) `ICON_PATHS`. All icons are stroke-only, 24×24 viewBox.

| Key | Suggested use |
|---|---|
| `ferris` | Amusement park / Prater |
| `cablecar` | Cable car, gondola |
| `coaster` | Roller coaster, summer toboggan |
| `gem` | Mines, caves, salt mines |
| `castle` | Medieval castle, fortress |
| `palace` | Palace, mansion |
| `spa` | Thermal baths, wellness |
| `peak` | Mountain peak, hiking |
| `kart` | Go-karts, alpine carts |
| `lake` | Lakes, swimming |
| `museum` | Museums, science centres |
| `zoo` | Zoo, aquarium |
| `church` | Cathedral, basilica |
| `plane` | Travel day / airport |
| `car` | Drive / road (used in chips, not pins) |
| `bed` | Hotel marker (used by Region, not Day) |
| `moon` | Nights counter |
| `rain` | Rain plan |
| `arrow` | Generic |
| `star` | Wow day |

To add a new icon: edit `ICON_PATHS` in `components/icons.tsx` and document it here.

## Storage

| Env | Backend | File / table |
|---|---|---|
| local dev (no `POSTGRES_URL`) | local JSON file | `.data/austria-2026.json` |
| Vercel / prod | Vercel Postgres | `trips.data` (JSONB), `slug = "austria-2026"` |

The switch is in [`lib/db.ts`](../lib/db.ts) and is keyed on `process.env.POSTGRES_URL`. The schema is the same on both sides — only the persistence differs.
