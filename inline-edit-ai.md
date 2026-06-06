# In-panel day editing + AI day generation

## Context

Add editing **inside the day detail panel** (`components/DetailPanel.tsx`) so a day
can be edited in place, on the map, instead of only on the separate `/edit` screen.
Two paths, side by side:

1. **Manual** — edit each field, add/modify/delete activities, right there in the panel.
2. **AI** — a prompt (Hebrew) that uses the user's **OpenAI** key to draft content
   matching the schema, then a coordinate + routing pass that fills `lat`/`lng` and
   computes **driving time between activities**.

Decisions locked in:
- **Lives ALONGSIDE `/edit`.** `/edit` stays the full-document / power editor and the
  export source (`tripToEditorHtml`, xlsx). The panel gains an *edit mode* for the
  focused day only. We reuse the same `PATCH /api/trip` save path; no new persistence
  model.
- **Two AI buttons** (per the design image):
  - **"צור יום"** — whole-day from a free-text description → full `Day` draft.
  - **"הצע פעילויות"** — narrower; only fills/refines `acts[]` for the current day.
- **Distance = driving TIME in minutes, not km** (image shows `40 דק' · 15 דק' בין
  אטרקציות`). Straight-line haversine is NOT enough — use a routing provider that
  returns durations.

## What we already have (do not rebuild)

- `/edit` already does per-field + per-activity (`name`/`lat`/`lng`) add/edit/delete and
  attractions, via immutable `updateDay`/`updateActivity`/`updateRegion` helpers
  (`app/edit/page.tsx`). The panel editor should **reuse the same mutation shape**
  (clone → mutate → set) so logic stays consistent.
- `Map.tsx applyDayRoute()` (Map.tsx:428) already draws a line through the day's mapped
  activity coords, starting at the day pin `[day.lng, day.lat]`. This feature **adds
  numbers** (per-leg minutes + a pill) to that existing line — it does not add a new
  route concept.
- `ActivitySchema` already has optional `lat`/`lng`; the schema comment
  (trip-schema.ts:5) already anticipates an "AI coordinate step".

What we do NOT have today (so this is genuinely new): any numeric distance/time. `day.drive`
is freetext; nothing computes or stores durations.

## Architecture

### 1. OpenAI key is server-side, passphrase-gated

`DetailPanel` is a `"use client"` component — the key must never reach the browser.
New route: `app/api/ai/day/route.ts` (Node runtime, `force-dynamic`), holding
`OPENAI_API_KEY`. **Gate it with the same `EDIT_PASSPHRASE`** the PATCH endpoint uses —
otherwise the endpoint is a free way to burn the key. The client passes the passphrase
the user already typed for saving.

Request body: `{ passphrase, mode: "day" | "acts", prompt, dayContext }` where
`dayContext` carries the region key/name + center coords (for geocoding bias) and, for
`"acts"` mode, the existing day so the model refines rather than replaces.

### 2. Three-stage pipeline (never trust the LLM for coords or arithmetic)

1. **LLM draft.** OpenAI **Structured Outputs** (`response_format` json_schema). Derive
   the JSON Schema from `DaySchema` (e.g. `zod-to-json-schema`) so the model contract and
   the Zod gate can't drift; strip server-derived fields (coords, leg times) from what the
   model is asked to produce. `DaySchema.safeParse` (partial for `"acts"` mode) the result
   before it touches React state. On parse failure, return a Hebrew error; do not apply.
2. **Geocode.** Fill `lat`/`lng` per activity via **Mapbox Geocoding** (reuse
   `NEXT_PUBLIC_MAPBOX_TOKEN`), biased to the region center from `dayContext`. Do NOT ask
   the LLM for coordinates. Activities that don't geocode keep `lat`/`lng` unset (they just
   won't pin/route — same as today).
3. **Durations.** Call **Mapbox Directions** (driving) over the ordered waypoints
   `[day pin, act1, act2, …]`. Take per-leg `duration` → minutes. This is the
   `40 דק' / 15 דק'` data. Compute in code, never from the model.

Stages 2–3 also run on **manual** edits (when the user adds/reorders/edits an activity),
so distances aren't AI-only — they're a property of the day's mapped stops. A
"חשב מרחקים" / recompute affordance covers the case where the user typed coords by hand.

### 3. Where leg times live — this DOES get a schema field (reversal of earlier call)

Coordinates alone determine a straight line, but **driving time depends on the road
network**, so it can't be recomputed for free on every render without hitting Directions.
Cache it. Additive + back-compat:

```ts
// ActivitySchema
legMin: z.number().optional(),   // driving minutes from the previous stop
                                 // (the day pin for the first activity)
```

- Day total = sum of `legMin` across mapped acts (derived, not stored).
- **Invalidation:** clear/recompute `legMin` whenever an activity is added, deleted,
  reordered, or its coords change. Stale `legMin` is the main correctness risk — wire it
  into the same mutation helpers.
- Editor/export round-trip: `legMin` is server-derived, so the xlsx/HTML editors should
  **ignore it on import** (recompute), not let the family hand-edit it. Note in
  `trip-xlsx.ts` / `trip-html-editor.ts` so it isn't surfaced as an editable column.

### 4. Display — the pill (per the image)

- A floating pill above the day pin in `Map.tsx`: total drive on one side
  (`🚗 40 דק'`), the focused leg on the other (`15 דק' בין אטרקציות`), **‹ › chevrons**
  to step through legs. Follow the imperative ref-driven Map pattern (markers/popups in
  refs, re-applied by `forceUpdate()`), not React-managed DOM.
- Mirror a compact version in `DetailPanel`: show `legMin` between consecutive items in
  the existing `<ol className="pnl-acts">` list (trip-schema/DetailPanel.tsx:103).

## Gotchas (from prior notes)

- **Concurrent-edit collision** (see `export-import-feature` memory): panel saves PATCH
  the *whole* trip doc → last-write-wins. Editing from the main view widens the window vs.
  the dedicated `/edit` screen. Keep panel save passphrase-gated; consider re-reading the
  trip just before PATCH and warning on a detected drift. Coordinate with the wife's
  upload flow (`import-flow.md`) — same write path.
- **Graceful degrade** (match the Mapbox inline-error precedent): without
  `OPENAI_API_KEY`, the AI buttons show a Hebrew "AI לא מוגדר" note and stay disabled;
  without `POSTGRES_URL`+`EDIT_PASSPHRASE`, saves are a no-op locally (`lib/db.ts`).
- **Directions cost/limits:** debounce recompute; only call when the ordered mapped-act set
  actually changes; cache via `legMin`.

## Files touched

- `lib/trip-schema.ts` — add optional `legMin` to `ActivitySchema`.
- `app/api/ai/day/route.ts` — NEW. OpenAI structured-output draft, passphrase-gated.
- `lib/ai-day.ts` (or similar) — NEW. Prompt builders + `zod-to-json-schema` contract.
- `lib/geo.ts` — NEW. Mapbox geocode + Directions helpers (minutes per leg).
- `components/DetailPanel.tsx` — edit mode (manual fields + 2 AI buttons + status), reusing
  the `/edit` mutation shape; needs to call back up to `TripView`.
- `components/TripView.tsx` — owns trip state; add the panel-edit save (`PATCH /api/trip`)
  and recompute orchestration. (SHARED file — re-read latest before editing.)
- `components/Map.tsx` — the leg-time pill + chevron stepper on the day route.
- `lib/trip-xlsx.ts`, `lib/trip-html-editor.ts` — ignore `legMin` on import.
- `.env.local.example` — document `OPENAI_API_KEY`.

## Verification

1. `npm run typecheck`.
2. `npm run dev` with `OPENAI_API_KEY`, `NEXT_PUBLIC_MAPBOX_TOKEN`, `EDIT_PASSPHRASE`,
   `POSTGRES_URL` set:
   - Focus a day → open panel edit mode → **"צור יום"** with a Hebrew prompt → draft
     populates fields, activities geocode and pin, pill shows minutes → Save → reload `/`
     → persisted.
   - **"הצע פעילויות"** only touches `acts[]`, leaves other fields.
   - Manually reorder/delete an activity → `legMin` recomputes; pill + panel update.
   - Wrong passphrase → Hebrew error, nothing changes.
3. Degrade: unset `OPENAI_API_KEY` → buttons disabled with the Hebrew note; manual editing
   still works.
4. Back-compat: a legacy day with string `acts` and no `legMin` still loads/renders; no pill
   until coords exist.

See `attractions.md` (area attractions) and `import-flow.md` (offline round-trip) for the
adjacent data model and the shared write path.
