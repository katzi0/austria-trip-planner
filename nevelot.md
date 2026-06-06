# Two trips in one planner: family + "נבלות 40"

## Context

Today the app is hardwired to a single trip (`slug = "austria-2026"`, the family
summer-2026 trip). The user wants a **second trip** — a 7-day men's "נבלות 40"
camping road-trip (June 11–17, 2026), sourced from a Google My Maps + a Hebrew
spreadsheet — and an **in-app toggle** to switch between the two.

Good news from exploration: the data model already supports N trips. The Postgres
`trips` table keys on `slug` (UNIQUE), `readTrip(slug)`/`writeTrip(slug, …)` already
take a slug, `TripView` is fully props-driven, and `Map`/`DayStrip`/`DetailPanel`
re-render correctly when the `trip` prop changes. The single-trip assumption only
lives in: the **default/hardcoded slug** (db default param, API route, seed script),
the **always-`SEED_TRIP` fallback** in `db.ts`, **localStorage keys** in `TripView`,
and the lack of a **second dataset** and a **switcher UI**.

Decisions already made: **in-app toggle** (no per-trip URLs), and the second trip is
a **full itinerary** built from the provided spreadsheet (dates + drive
times/distances + campsite notes + per-area attractions all present).

## The second dataset (from the spreadsheet)

7 days, 11–17.6.2026. Weekdays computed: 11.6=חמישי, 12.6=שישי, 13.6=שבת,
14.6=ראשון, 15.6=שני, 16.6=שלישי, 17.6=רביעי.

5 bases (`baseOrder`):

| key | name | hotel | lat, lng | nights |
|-----|------|-------|----------|--------|
| `grubhof` | לופר · Grubhof | Camping Grubhof | 47.574, 12.706 | 1 (11.6) |
| `zugspitz` | ארוואלד · Zugspitz | Zugspitz Resort Camping | 47.426, 10.942 | 2 (12–13.6) |
| `solden` | זלדן · Ötztal | Camping Sölden | 46.968, 11.007 | 2 (14–15.6) |
| `mondsee` | מונדזee · MondSeeLand | Camp MondSeeLand | 47.858, 13.351 | 1 (16.6) |
| `vienna` | וינה · סיום | דירה במרכז וינה | 48.208, 16.372 | 1 (17.6) |

Day→base mapping (drive segments from the sheet): d1 וינה→Grubhof (~300ק"מ,
3:15–3:30); d2 Grubhof→Zugspitz (~150, 1:45–2:00); d3 Zugspitz area; d4
Zugspitz→Sölden (~115, 1:30–1:45); d5 Sölden area; d6 Sölden→MondSeeLand (270,
3:00–3:15); d7 Mondsee→וינה (270, 2:45–3:00) + departure.

Attractions/notes are transcribed verbatim from the sheet into each day's `acts`,
`drive`, `food`, `tips` (e.g. Loferer Alm רכבל, Seisenbergklamm, Zugspitze 2962מ',
Eibsee, Seebensee hike, Gaislachkogelbahn, Bike Republic, Ötztal Glacier Road, Aqua
Dome, Top Mountain Motorcycle Museum, Mondsee SUP, Hofburg, Figlmüller, Café
Central). Campsite "על המתקנים" notes go into `tips`/`food`.

**Icon constraint:** day/region `icon` must be a key in `ICON_PATHS`
(`components/icons.tsx`): `ferris, cablecar, coaster, gem, castle, palace, spa, peak,
kart, lake, museum, zoo, church, plane, car, bed, moon, rain, arrow, star, timeline`.
Map sights to the nearest: cable cars→`cablecar`, summits/hikes→`peak`, lakes/SUP→
`lake`, spa/Aqua Dome→`spa`, glacier-road/transfers→`car`, museum→`museum`,
Vienna→`palace`. There is **no** gorge/bike/raft/food icon — pick the closest.
`cardClass` has no real meaning for this trip → use `"na"` with an empty/short
`cardLabel`. Every day still needs all required fields populated.

## Implementation

### 1. Trip registry — new `lib/trips.ts`
Single source of truth so nothing else hardcodes slugs:
```ts
import { SEED_TRIP } from "./seed";
import { NEVELOT_TRIP } from "./seed-nevelot";
export const TRIPS = [
  { slug: "austria-2026", label: "טיול משפחתי", seed: SEED_TRIP },
  { slug: "nevelot-2026", label: "נבלות 40",   seed: NEVELOT_TRIP },
] as const;
export const DEFAULT_SLUG = "austria-2026";
export type TripSlug = (typeof TRIPS)[number]["slug"];
export const isKnownSlug = (s: string): s is TripSlug => TRIPS.some(t => t.slug === s);
export const seedFor = (slug: string) => TRIPS.find(t => t.slug === slug)?.seed ?? SEED_TRIP;
```

### 2. Second dataset — new `lib/seed-nevelot.ts`
`export const NEVELOT_TRIP: Trip = { baseOrder, regions, days }` per the table above,
built to pass `TripSchema` (run `npm run typecheck`).

### 3. `lib/db.ts` — seed per-slug instead of always `SEED_TRIP`
- `readLocal(slug)` fallback: `TripSchema.parse(seedFor(slug))` instead of `SEED_TRIP`
  (`db.ts:21`).
- Postgres no-row branch: `seeded = TripSchema.parse(seedFor(slug))` (`db.ts:48`).
- Keep `readTrip(slug = "austria-2026")` default. Import `seedFor` from `./trips`.

### 4. `app/api/trip/route.ts` — slug-aware GET & PATCH (allowlisted)
- `GET(req)`: read `slug` from `new URL(req.url).searchParams`, default `DEFAULT_SLUG`;
  `if (!isKnownSlug(slug)) 400`; `readTrip(slug)`.
- `PATCH`: pull `slug` from body alongside `passphrase`/`trip`; validate with
  `isKnownSlug`; `writeTrip(slug, parsed.data)` (replaces hardcoded `"austria-2026"`
  at `route.ts:40`). Keep `revalidatePath("/")`.

### 5. `app/page.tsx` — load both trips, hand to a client shell
```tsx
const trips = await Promise.all(TRIPS.map(async t =>
  ({ slug: t.slug, label: t.label, trip: await readTrip(t.slug) })));
return <TripShell trips={trips} defaultSlug={DEFAULT_SLUG} />;
```
(Both trips are small JSON; loading both server-side makes switching instant with no
fetch/loading state.)

### 6. New `components/TripShell.tsx` (client) — owns active-trip state
- Props: `trips: {slug,label,trip}[]`, `defaultSlug`.
- State `activeSlug`, initialized to `defaultSlug`, then overridden from
  `localStorage["austria_trip"]` after mount; persisted on change.
- Renders `<TripView key={activeSlug} slug={activeSlug} trip={active.trip}
  tripList={trips.map(t=>({slug,label}))} activeSlug={activeSlug}
  onSwitchTrip={setActiveSlug} />`. The `key` forces a clean remount per trip
  (re-runs the today-jump/localStorage mount effect).

### 7. `components/TripView.tsx` — slug-namespaced state + forward switcher props
- Add props `slug`, `tripList`, `activeSlug`, `onSwitchTrip`.
- localStorage keys become per-trip: `austria_view_${slug}`, `austria_type_${slug}`
  (`TripView.tsx:66,67,96,107`). Default typography stays `alpine`.
- Optional polish: set `document.title` to the active trip label in the mount effect.
- Forward `tripList`/`activeSlug`/`onSwitchTrip` to `<Ribbon>`.

### 8. `components/Ribbon.tsx` — switcher control in `.maptools`
Add a compact segmented toggle (one pill per trip, active highlighted) at the start of
the `maptools` div (`Ribbon.tsx:170`), calling `onSwitchTrip(slug)`. New props:
`tripList`, `activeSlug`, `onSwitchTrip`. Hebrew labels from the registry. Minimal CSS
in `globals.css` reusing existing pill/`iconbtn` styling.

### 9. Editor — `app/edit/page.tsx` slug-aware
- Add a trip `<select>` at the top (options from a small inline list or fetched
  labels) bound to `editSlug` state; initialize from `?slug=` query param, default
  `DEFAULT_SLUG`.
- Fetch `/api/trip?slug=${editSlug}` (`edit/page.tsx:78`), refetch when `editSlug`
  changes. Include `slug: editSlug` in the PATCH body (`edit/page.tsx:160`).
- `emptyDay`/`emptyRegion` factories unchanged.

### 10. `scripts/seed.ts` — seed both
Loop `TRIPS` and `writeTrip(t.slug, t.seed)` so a fresh Postgres gets both rows
(currently seeds only `austria-2026`). Self-seeding via step 3 also covers nevelot on
first read, so this is belt-and-suspenders.

### Out of scope / notes
- `app/layout.tsx` `<title>` stays the family default (static metadata on a single
  route); per-trip title handled client-side in step 7 if desired.
- No routing changes, no `[slug]` routes (toggle is in-app per the decision).
- PWA/service worker, print view, timeline all consume `trip` props unchanged.

## Verification
1. `npm run typecheck` — the only static check; must pass (validates both datasets
   against `TripSchema` and all prop changes).
2. `npm run dev`, open `/`:
   - Switcher shows two pills; default is the family trip.
   - Toggle to "נבלות 40": map re-centers on the Austria camping loop, Ribbon shows 5
     bases / 7 days, DayStrip + DetailPanel reflect the new days. Today-pill (today is
     2026-06-06) reads "עוד N ימים ליציאה" (nevelot starts 11.6 → 5 days; family 14.7).
   - Reload → last-selected trip persists (localStorage `austria_trip`); typography
     choice persists per-trip.
3. Editing: open `/edit`, pick "נבלות 40" in the selector → fields load that trip;
   change something, Save → reopen `/` on that trip and confirm the change (persists
   only when `POSTGRES_URL` + `EDIT_PASSPHRASE` are set; no-op locally otherwise, per
   `db.ts`/`route.ts`).
