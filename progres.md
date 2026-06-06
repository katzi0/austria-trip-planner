# Progress: high-level map view, cleaner detail panel, isolate transfer days

## Context

Today the trip viewer has five issues to fix together:

1. The map doesn't take all available vertical space — there's a visible empty strip below it.
2. When a day is selected, the camera zooms tightly to **hotel + that one day pin**, losing the "high-level area" view of where the day sits inside the current region.
3. The translucent region polygon (convex-hull + buffer) is no longer wanted at all.
4. The detail panel's heading is the raw `day.title` string, which today is "Activity A + Activity B + Activity C" — not a chronological day plan.
5. "מעבר" (transit) days inherit their destination's `base`, so their distant coordinates stretch that region's polygon. Each מעבר day should be its **own** area.

Intended outcome: a calmer, higher-altitude overview map; a detail panel that reads like a chronological day planner; and a data model that doesn't merge transfer days into a settled region.

---

## Root causes (verified)

### Issue 1 — empty space under the map (nested `.mapwrap`)

`components/TripView.tsx:292`

```tsx
<div className="mapwrap" style={{ flex: "1 1 auto", position: "relative" }}>
  <Ribbon ... />
  <Map ... />
</div>
```

`components/Map.tsx:607-613`

```tsx
return (
  <div className="mapwrap">
    <div className="mapcanvas" ref={containerRef} />
    ...
  </div>
);
```

`app/globals.css:78-79`

```css
.mapwrap{position:relative;flex:1 1 auto;min-height:300px}
.mapwrap > .mapcanvas{position:absolute;inset:0}
```

The outer `.mapwrap` is **not** a flex container, so the inner `.mapwrap`'s `flex:1 1 auto` is ignored. It falls back to its content height (`.mapcanvas` is absolutely positioned → contributes 0) and `min-height:300px` kicks in. **The map is fixed at 300px and the rest of the column is empty.**

### Issue 2 — camera in day mode

`components/Map.tsx:498-513` — when `activeIdx >= 0` the camera fits `[hotel, activeDay]`, which over-zooms. Should fit the **whole current region** (hotel + all of its days), keeping day selection a soft highlight rather than a focus.

### Issue 3 — polygons

`components/Map.tsx:53-84` (`buildRegionShape`) and `:338-396` (`applyPolygons`) draw the translucent fill + dashed line per region. Remove the rendering; data builders aren't used elsewhere (verified — only callers are `applyPolygons` itself).

### Issue 4 — title concatenation in `DetailPanel`

`components/DetailPanel.tsx:88` renders `<h2 className="pnl-title">{d.title}</h2>`. In `lib/seed.ts` most `title` values are literal activity concatenations: `"Traunfall + Grünberg + שביל צמרות"` (day 2), `"Hellbrunn Palace + Salzburg"` (day 6), `"Spiegelsee (אגם המראה) + חוף רמסאו"` (day 12). The `acts[]` array already holds the same items in chronological order. Drop the joined title as the headline and present `acts[]` as the chronological agenda.

### Issue 5 — transfer days bloating region polygons

`lib/seed.ts:16` — day 2 is `base:"wagrain"` but sits at `(48.057, 13.851)` — way north of Wagrain `(47.334, 13.299)`. Drags the Wagrain convex hull ~80km north.

Transit-flavoured days:
- Day 2 — Traunfall + Grünberg (currently `base:"wagrain"`, far north of hotel).
- Day 8 — `"מעבר + Rittisberg Adventure Park"` (`base:"ramsau"`, `47.413, 13.659`) — close to hotel, minor impact, but still semantically a transfer.
- Day 14 — `"יום מעבר · Ars Electronica (לינץ)"` (`base:"ramsau"`, `outlier:true`) — already excluded from polygon math.

Today only `outlier:true` excludes a day from the polygon; there's no first-class transit concept.

---

## Tasks

### [ ] 1. Fix the map layout (Issue 1)

**`components/TripView.tsx:292`** — change wrapping div so it's no longer `.mapwrap`-classed and *is* a flex column so the inner Map fills it:

```tsx
<div
  style={{
    flex: "1 1 auto",
    position: "relative",
    display: "flex",
    minHeight: 0,   // critical: lets the flex child shrink/grow inside 100dvh
  }}
>
  <Ribbon ... />
  <Map ... />
</div>
```

Ribbon is `position:absolute` (`globals.css:44`) and unaffected. Map's own `.mapwrap` becomes the lone flex child and `flex:1 1 auto` finally applies. `min-height:0` is required because flex items default to `min-height:auto`.

**Verify:** `npm run dev`, open `/`, map reaches the top of `DayStrip` with no blank gap; resize window. `ResizeObserver` in `Map.tsx:221` already calls `map.resize()`.

### [ ] 2. Stop zooming in past the area (Issue 2)

**`components/Map.tsx:498-513`** — replace the day-focus camera block. When `viewMode === "day"` and `activeIdx >= 0`, fit to the region of the focused day's `base` (hotel + all its non-outlier days), exactly like the existing "specific base" branch at `:532-543`:

```ts
if (activeIdx >= 0) {
  const day = trip.days[activeIdx];
  const baseKey = day?.base;
  const r = baseKey ? trip.regions[baseKey] : undefined;
  if (!day || !r) return;
  const pts: LngLat[] = [[r.lng, r.lat]];
  trip.days.forEach((d) => {
    if (d.base === baseKey && !d.outlier) pts.push([d.lng, d.lat]);
  });
  map.fitBounds(boundsOf(pts), {
    padding: { top: Math.max(pad, 170), right: pad, bottom: pad, left: pad },
    maxZoom: 10.5,
    duration: 780,
  });
  return;
}
```

Keep `applyDayRoute` (`:427-474`) and `applyMiniPopup` (`:546-576`) — the day-pin animation + drive-time popup still anchor the selection visually without zooming in.

**Verify:** click each day in the strip; camera pans but doesn't zoom past the area overview for that base.

### [ ] 3. Remove region polygons (Issue 3)

**`components/Map.tsx`**:
- Delete `buildRegionShape` (`:53-84`).
- Delete `@turf/convex`/`@turf/buffer`/`@turf/union` imports (`:6-9`).
- Delete `polygonSourceIds` (`:45-51`).
- Delete `applyPolygons` (`:338-396`).
- Delete `polygonKeysRef` (`:132`).
- Remove the call to `applyPolygons()` inside `forceUpdate()` (`:303`).
- Remove polygon cleanup in unmount handler (`:249`).
- Leave `ROUTE_GLOW_LAYER`/`ROUTE_LINE_LAYER`/`BASE_ROUTE_LAYER` alone — active-day route + dashed hotel→day spokes still wanted.

Optional: `@turf/convex`, `@turf/buffer`, `@turf/union` can be removed from `package.json` later.

**Verify:** typecheck passes; map shows pins, hotel markers, dashed spokes, animated active-day line — no shaded blobs.

### [ ] 4. Chronological detail panel (Issue 4)

**`components/DetailPanel.tsx:87-120`** — replace heading + activities section:

```tsx
<div className="pnl-body">
  <div className="pnl-area">
    <Icon name={r.icon} size={14} />
    <span>{r.name} · <Lat>{r.hotel}</Lat></span>
  </div>
  <div className="pnl-facts">
    {/* unchanged: intensity / card / drive chips */}
  </div>
  <section className="pnl-sec pnl-agenda">
    <h4>תוכנית היום</h4>
    <ol className="pnl-acts">
      {d.acts.map((a, i) => (
        <li key={i}>
          <span className="pnl-step">{i + 1}</span>
          <span className="pnl-step-text">{a}</span>
        </li>
      ))}
    </ol>
  </section>
  <section className="pnl-sec"><h4>אוכל</h4><p>{d.food}</p></section>
  <section className="pnl-sec"><h4>טיפ</h4><p>{d.tips}</p></section>
  {/* rain + overnight blocks unchanged */}
</div>
```

Changes:
- Drop the `<h2 className="pnl-title">{d.title}</h2>` line — the colored band already shows "יום N · date · dow", so the headline was redundant *and* misleading.
- `<ul>` → `<ol>` with a numbered step chip — reads as a sequence rather than a bulleted set.
- Section header "מסלול היום" → "תוכנית היום".

**`app/globals.css:104-113`** — add step styles; remove the now-unused `.pnl-title` rule (`:105`):

```css
.pnl-acts{margin:0;padding:0;list-style:none;display:flex;flex-direction:column;gap:9px}
.pnl-acts li{display:flex;gap:10px;align-items:flex-start;font-size:14px;color:var(--ink2);line-height:1.45}
.pnl-step{flex:0 0 auto;width:22px;height:22px;border-radius:7px;background:var(--dcc);color:#fff;
  font-size:12px;font-weight:700;display:inline-flex;align-items:center;justify-content:center;font-family:var(--sans)}
.pnl-step-text{flex:1;padding-top:2px}
```

Schema unchanged — `acts[]` is already chronological in `lib/seed.ts`. No data migration needed. `PrintView.tsx` already joins `acts` chronologically with `·` — leave it.

**Verify:** open panel for days 2, 6, 12, 14; numbered list reads naturally (morning → afternoon → evening); no "A + B + C" heading.

### [ ] 5. Each "מעבר" day as its own area (Issue 5)

In `lib/seed.ts`, give each transit day its own region key.

**`baseOrder`** — interleave transfer regions between settled stays:

```ts
baseOrder: ["moxy", "transfer-traunfall", "wagrain", "transfer-rittisberg", "ramsau", "transfer-linz", "henriette"],
```

**`regions`** — add three transfer regions. They use the destination hotel as the overnight (the family actually sleeps there that night), but `lat`/`lng` sits at the transit-day activity. Muted hex so they read as connecting tissue, not destinations:

```ts
"transfer-traunfall": {
  name: "מעבר · Traunfall + Grünberg",
  short: "מעבר",
  hex: "#7B8C7A",
  hotel: "Alpina Wagrain",          // sleeping there that night
  lat: 48.0573, lng: 13.8512,        // the day's actual activity
  icon: "car",
},
"transfer-rittisberg": {
  name: "מעבר · Rittisberg",
  short: "מעבר",
  hex: "#7B8C7A",
  hotel: "Landhaus Birgbichler",
  lat: 47.4130, lng: 13.6590,
  icon: "car",
},
"transfer-linz": {
  name: "מעבר · Ars Electronica (לינץ)",
  short: "מעבר",
  hex: "#7B8C7A",
  hotel: "Henriette",
  lat: 48.3100, lng: 14.2840,
  icon: "car",
},
```

**`days`** — reassign three `base` fields:
- Day 2 (`n:2, d:"15.7"`): `base:"wagrain"` → `base:"transfer-traunfall"`.
- Day 8 (`n:8, d:"21.7"`): `base:"ramsau"` → `base:"transfer-rittisberg"`.
- Day 14 (`n:14, d:"27.7"`): `base:"ramsau"` → `base:"transfer-linz"`. Also **remove** its `outlier:true` flag — no longer needed.

Call sites affected (all already key off `trip.baseOrder` / `day.base`):
- `components/Ribbon.tsx` (region legs from `trip.baseOrder`).
- `components/Map.tsx:280-290` (hotel markers, one per `trip.regions` entry — verify new entries get markers).
- `components/Map.tsx:115-119` (`regionsInScope`) — fine.
- `lib/trip-utils.ts` `nightsOfBase` — fine; transfer regions report 1 day each.

**Note on `outlier`:** with the polygon gone (Issue 3), `outlier` no longer affects polygon math but it *does* still gate the `applyCamera` area loop (`Map.tsx:488, 523`). Day 17 (departure) remains `outlier:true`; day 14 no longer is. Day 14 now participates in the new "transfer-linz" region's camera fit, which is correct.

**Seed/DB:** if Postgres is configured, run `npm run seed` after editing to push the new shape; otherwise local reads fall back to `SEED_TRIP` automatically (`lib/db.ts`).

**Verify:** load the page; ribbon shows 7 legs; map area view fits cleanly; no region bulges toward Traunfall, Rittisberg, or Linz.

---

## Files to modify

- `components/TripView.tsx` — layout wrapper (Issue 1).
- `components/Map.tsx` — camera fit + remove polygon code (Issues 2, 3).
- `components/DetailPanel.tsx` — chronological agenda (Issue 4).
- `app/globals.css` — `.pnl-acts` step styles, drop `.pnl-title` (Issue 4).
- `lib/seed.ts` — transfer regions + day base reassignments (Issue 5).

## End-to-end verification

1. `npm run typecheck` — must pass.
2. `npm run dev` — open `http://localhost:3000`:
   - Map fills all space between Ribbon and DayStrip; no blank strip.
   - Area view: no polygons; only pins, hotels, ribbon legs.
   - Click each day ticket: camera pans within the current area, never zooms tighter than area overview.
   - Open detail panel for days 2, 6, 12, 14: numbered chronological "תוכנית היום"; no joined-activity headline.
   - Ribbon shows 7 legs including 3 "מעבר" legs; clicking a transfer leg focuses just that single day.
3. Print view (`Cmd+P`): unchanged — `PrintView.tsx` not touched.
4. If `POSTGRES_URL` is configured, run `npm run seed`; otherwise in-code seed is served.

## Out of scope / follow-ups

- Removing `@turf/*` dependencies from `package.json`.
- Hiding hotel markers for transfer regions (they currently borrow the destination hotel coords-of-record but place the marker at the activity).
- Adding a `transfer:true` schema flag instead of using a naming convention — only worth doing if more transit days are added later.
