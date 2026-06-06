# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

> The Next.js version here (16.2.7) has breaking changes vs. older releases. Before writing framework code, read the relevant guide under `node_modules/next/dist/docs/`.

## What this is

A single-trip planner for a family trip to Austria (summer 2026). The entire UI is in **Hebrew, RTL** (`<html lang="he" dir="rtl">`) — keep new copy in Hebrew and remember that left/right are mirrored (e.g. in `TripView`, `ArrowRight` steps to the *previous* day).

## Commands

```bash
npm run dev        # dev server (Turbopack; service worker disabled in dev)
npm run build      # production build (generates public/sw.js via Serwist)
npm run start      # serve the production build
npm run typecheck  # tsc --noEmit — the only static check; run this to validate changes
npm run seed       # tsx scripts/seed.ts — write SEED_TRIP into Postgres (needs POSTGRES_URL)
```

There is **no test runner and no lint script**. `npm run typecheck` is the verification step.

`tsx scripts/gen-icons.ts` regenerates the placeholder PWA icons in `public/icons/` (solid brand-color PNGs; meant to be replaced with real art).

## Environment

Copy `.env.local.example` → `.env.local`. Three things are read at runtime, and the app degrades gracefully when each is missing:

- `NEXT_PUBLIC_MAPBOX_TOKEN` — without it the map renders an inline Hebrew error note instead of tiles (`components/Map.tsx`).
- `POSTGRES_URL` (+ the other Vercel Postgres vars) — without it `lib/db.ts` serves the in-code `SEED_TRIP` for reads and makes writes a **no-op**. So edits appear to "work" locally but never persist unless Postgres is configured.
- `EDIT_PASSPHRASE` — gates the PATCH endpoint. If unset, saving returns 503.

## Architecture

**One trip, one document.** All trip content is a single JSON object matching `TripSchema` in `lib/trip-schema.ts` (`{ baseOrder, regions, days }`). A "base" is a hotel/region the family stays at; each "day" references a base by key. This Zod schema is the contract — it is parsed on every DB read and write, so schema changes ripple to the seed data, the editor, and the renderers.

**Data flow:**
- `lib/db.ts` — `readTrip`/`writeTrip` against the Postgres `trips` table (one row, `slug = "austria-2026"`, `data` JSONB). Auto-creates the table and self-seeds from `SEED_TRIP` (`lib/seed.ts`) on first read. Falls back to `SEED_TRIP` entirely when Postgres is absent.
- `app/api/trip/route.ts` — `GET` returns the trip; `PATCH` checks the passphrase, `safeParse`s the body, writes, and calls `revalidatePath("/")`. `force-dynamic`, Node runtime.
- `app/page.tsx` — server component, `force-dynamic`, reads the trip and hands it to `TripView`. `app/edit/page.tsx` — client-side editor that fetches `/api/trip`, mutates a local clone, and PATCHes it back with the passphrase.

**View layer — `components/TripView.tsx` is the state hub.** It is the only stateful container; every other component is presentational and driven by props/callbacks. Core state: `viewMode` (`"area"` overview vs. `"day"` focused), `dayScope` (`"all"` or a base key), `activeIdx` (focused day), `panelOpen`, and the typography "pairing" applied as a `type-*` class on `<html>`. It persists `viewMode`/pairing to `localStorage` and auto-jumps to "today" on mount via `lib/trip-utils.todayIndex`. Children: `Ribbon` (top breadcrumb/controls), `Map`, `DayStrip` (bottom day tickets + prev/next), `DetailPanel` (slide-up day detail), `PrintView` (always rendered, shown only by print CSS).

**`components/Map.tsx` is imperative, not declarative.** Mapbox state (markers, sources, layers, popups) lives in `useRef`s, never React state. A single `forceUpdate()` re-applies everything (`applyPinStates`, `applyPolygons`, `applyBaseRoutes`, `applyDayRoute`, `applyCamera`, …) and is called on any view-input change. Prop callbacks are mirrored into a ref so map event listeners always see the latest closures. Region "blobs" are computed at render time from member-day coordinates with `@turf` (convex hull + buffer, or buffered points when <3). When touching the map, follow this ref-driven pattern rather than adding React-managed DOM.

**Icons** (`components/icons.tsx`) are raw SVG path strings; `iconSvg(name, size)` returns a markup **string** that gets injected via `innerHTML` (into Mapbox markers and elsewhere). Day/region `icon` fields must be keys that exist in `ICON_PATHS`.

**PWA:** `app/sw.ts` is the Serwist service-worker source, compiled to `public/sw.js` by the `@serwist/next` wrapper in `next.config.ts` (disabled in development).

## Conventions / gotchas

- Dates live as `"d.m"` strings (e.g. `"14.7"`) and the **year 2026 is hardcoded** in `lib/trip-utils.ts`. Date math goes through helpers there, not inline parsing.
- Path alias `@/` maps to the repo root (`@/lib/...`, `@/components/...`).
- The editor builds new days/regions via `emptyDay`/`emptyRegion` factories — extend those when you add required schema fields, or the editor will produce objects that fail validation on save.
