# אוסטריה 2026 · מתכנן הטיול

A single-trip planner for a family Austria trip, summer 2026. Hebrew RTL, map-driven, edit-in-browser. Started from a self-contained HTML prototype; rebuilt as a Next.js app so the family can see the same itinerary from any device and edit it without redeploying.

**Stack:** Next.js 16 (App Router) · React 19 · TypeScript · MapLibre GL JS + free [OpenFreeMap](https://openfreemap.org) tiles · Vercel Postgres (with a local-JSON fallback) · Serwist PWA · zod.

## Quick start

```bash
npm install
npm run dev
```

Open http://localhost:3000 for the map view, http://localhost:3000/edit for the editor. No accounts, no tokens — the default map tiles are free and require no signup.

## What's where

```
app/
  api/trip/route.ts      GET (public) + PATCH (passphrase-gated) for the whole trip
  edit/page.tsx          Browser editor — days, regions, save back to the API
  layout.tsx             RTL Hebrew shell, font imports, MapLibre + PWA meta
  page.tsx               Main view (server component → TripView)
  sw.ts                  Serwist service worker source
components/
  Map.tsx                MapLibre GL: pins, hotel markers, region polygons, animated route
  TripView.tsx           View-state owner (view mode, day scope, active day, panel, fonts)
  Ribbon.tsx             Top journey ribbon (Areas / Days toggle + maptools)
  DayStrip.tsx           Bottom day-ticket cards + prev/next stepper
  DetailPanel.tsx        Side panel (desktop) / bottom sheet (phone)
  PrintView.tsx          Hidden printable summary
  icons.tsx              SVG icon catalog (ICON_PATHS)
lib/
  trip-schema.ts         Zod schemas — the data contract
  seed.ts                SEED_TRIP — the in-code baseline (17 days, 4 bases)
  trip-utils.ts          nightsOfBase, baseDateRange, todayIndex, dateOf
  db.ts                  Local file ↔ Postgres switch keyed on POSTGRES_URL
scripts/
  seed.ts                CLI: insert SEED_TRIP into Postgres
  gen-icons.ts           Generate placeholder PWA icons
public/
  manifest.webmanifest   PWA manifest (Hebrew, RTL, brand theme)
  icons/                 PWA icons (placeholders — replace with real art)
docs/
  data-model.md          Schema field-by-field
  workflows.md           How to add a day, deploy, change the schema, etc.
CLAUDE.md                Architecture orientation for Claude Code
```

## Editing the trip

Visit `/edit`. In local dev any passphrase works (or leave it blank — the gate is relaxed when `EDIT_PASSPHRASE` isn't set and `NODE_ENV !== "production"`).

Saved trips persist to:

- **Local dev (no `POSTGRES_URL`):** `.data/austria-2026.json` on disk (gitignored). Edit there directly if you prefer.
- **Production (with `POSTGRES_URL`):** Vercel Postgres `trips.data` JSONB, `slug = "austria-2026"`.

To reset to the in-code baseline, delete `.data/austria-2026.json` (or truncate the DB row) — the next read re-seeds from `lib/seed.ts`.

For schema-aware edits via Claude, run `/add-day` or use the `trip-editor` sub-agent (see `.claude/`).

## Environment

Copy `.env.local.example` → `.env.local`. Everything is optional in dev:

| Var | What it does | Missing → |
|---|---|---|
| `NEXT_PUBLIC_MAP_STYLE_URL` | Override the MapLibre style | Falls back to OpenFreeMap "liberty" |
| `POSTGRES_URL` (+ siblings) | Vercel Postgres connection | Reads/writes go to `.data/austria-2026.json` |
| `EDIT_PASSPHRASE` | Required passphrase for the `/edit` save | In dev: gate relaxed (any value works). In prod: returns 503. |

Free MapLibre styles you can drop into `NEXT_PUBLIC_MAP_STYLE_URL` — see [`docs/workflows.md#switch-map-style`](docs/workflows.md#switch-map-style).

## Scripts

```bash
npm run dev          # dev server (Turbopack; SW disabled in dev)
npm run build        # production build (compiles public/sw.js)
npm run start        # serve the production build
npm run typecheck    # tsc --noEmit — the only static check
npm run seed         # tsx scripts/seed.ts — push SEED_TRIP to Postgres
```

No tests, no lint — `typecheck` is the gate. The `/verify` Claude slash-command bundles typecheck + dev-server smoke.

## Deploy to Vercel

See [`docs/workflows.md#deploy-to-vercel`](docs/workflows.md#deploy-to-vercel). Short version: link the project → create a Postgres → `vercel env pull` → set `EDIT_PASSPHRASE` → `npm run seed` → `git push`.

## More

- Architecture & gotchas for Claude Code: [`CLAUDE.md`](CLAUDE.md)
- Data model: [`docs/data-model.md`](docs/data-model.md)
- Operational recipes: [`docs/workflows.md`](docs/workflows.md)
- Next.js 16 caveats: [`AGENTS.md`](AGENTS.md)

## License

Personal / family use. No license declared.
