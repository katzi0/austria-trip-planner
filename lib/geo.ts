// POC-grade geocoding + driving-time helpers, keyless.
// Geocode: Nominatim (OpenStreetMap). Driving legs: OSRM public demo server.
// Both are free, rate-limited, and best-effort — swap for a keyed provider for prod.
// Server-only (called from the /api/ai/day route).

export interface LatLng {
  lat: number;
  lng: number;
}

const NOMINATIM = "https://nominatim.openstreetmap.org/search";
const OSRM = "https://router.project-osrm.org/route/v1/driving";
// Nominatim policy requires an identifying UA. Keep it honest.
const UA = "austria-planner/poc (trip planner; contact: shai@vastdata.com)";

/**
 * Geocode a place name to coordinates, biased toward `near` (the day's region
 * center). Returns null when nothing is found — the caller leaves the activity
 * uncoordinated (it just won't pin/route), matching current behavior.
 */
export async function geocodeName(name: string, near?: LatLng): Promise<LatLng | null> {
  const q = name.trim();
  if (!q) return null;
  const url = new URL(NOMINATIM);
  url.searchParams.set("format", "json");
  url.searchParams.set("limit", "1");
  url.searchParams.set("q", q);
  if (near) {
    // A ~0.7° box around the region center nudges results to the right area.
    const d = 0.7;
    url.searchParams.set(
      "viewbox",
      `${near.lng - d},${near.lat + d},${near.lng + d},${near.lat - d}`,
    );
  }
  try {
    const res = await fetch(url, { headers: { "User-Agent": UA } });
    if (!res.ok) return null;
    const rows = (await res.json()) as Array<{ lat: string; lon: string }>;
    const hit = rows[0];
    if (!hit) return null;
    return { lat: Number(hit.lat), lng: Number(hit.lon) };
  } catch {
    return null;
  }
}

/**
 * Driving minutes for each leg along an ordered list of coordinates.
 * Returns an array of length `points.length - 1` (minutes between consecutive
 * points), or null if the route can't be computed. Values are rounded minutes.
 */
export async function drivingLegMinutes(points: LatLng[]): Promise<number[] | null> {
  if (points.length < 2) return [];
  const coords = points.map((p) => `${p.lng},${p.lat}`).join(";");
  const url = `${OSRM}/${coords}?overview=false&annotations=duration`;
  try {
    const res = await fetch(url, { headers: { "User-Agent": UA } });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      code?: string;
      routes?: Array<{ legs?: Array<{ duration?: number }> }>;
    };
    const legs = data.routes?.[0]?.legs;
    if (data.code !== "Ok" || !legs) return null;
    return legs.map((l) => Math.round((l.duration ?? 0) / 60));
  } catch {
    return null;
  }
}
