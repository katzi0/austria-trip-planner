import { NextResponse } from "next/server";
import { z } from "zod";
import { geocodeName, drivingLegMinutes, type LatLng } from "@/lib/geo";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// POC: draft a day's content with OpenAI, then fill coordinates (Nominatim) and
// driving minutes per leg (OSRM) in code — the model never produces coords or
// numbers. Returns a partial Day the client merges into the focused day and saves
// through the existing passphrase-gated PATCH /api/trip.

// The current day, sent so the model MODIFIES it rather than inventing from scratch.
const CurrentDaySchema = z.object({
  title: z.string().optional(),
  desc: z.string().optional(),
  intensity: z.number().optional(),
  drive: z.string().optional(),
  food: z.string().optional(),
  tips: z.string().optional(),
  rain: z.string().optional(),
  acts: z
    .array(z.object({ name: z.string(), lat: z.number().optional(), lng: z.number().optional() }))
    .optional(),
});

const ReqSchema = z.object({
  passphrase: z.string().optional(),
  mode: z.enum(["day", "acts", "geo"]),
  prompt: z.string().optional(),
  regionName: z.string().optional(),
  // Region center — biases geocoding and is the route start when the day has no pin yet.
  near: z.object({ lat: z.number(), lng: z.number() }).optional(),
  // Current day plan to edit.
  day: CurrentDaySchema.optional(),
});

// Each activity: Hebrew display `name` + `q`, a German/English search string the
// model supplies for geocoding (OSM data for Austria is in German; Hebrew names
// don't resolve). Accept a bare string too and fall back to the name as the query.
const ActDraft = z
  .union([z.string(), z.object({ name: z.string(), q: z.string().optional() })])
  .transform((v) => (typeof v === "string" ? { name: v } : v));

// What we ask the model for (text only; no coords, no minutes).
const DraftSchema = z.object({
  title: z.string().optional(),
  desc: z.string().optional(),
  intensity: z.number().int().min(1).max(5).optional(),
  drive: z.string().optional(),
  food: z.string().optional(),
  tips: z.string().optional(),
  rain: z.string().optional(),
  acts: z.array(ActDraft),
});

function err(msg: string, status: number) {
  return NextResponse.json({ error: msg }, { status });
}

export async function POST(req: Request): Promise<NextResponse> {
  const body = await req.json().catch(() => null);
  const parsed = ReqSchema.safeParse(body);
  if (!parsed.success) return err("bad request", 400);
  const { passphrase, mode, prompt, regionName, near, day } = parsed.data;
  // "geo" needs no prompt (it only re-derives coords/distances); the others do.
  if (mode !== "geo" && !prompt?.trim()) return err("bad request", 400);

  // Same gate as PATCH /api/trip.
  const expected = process.env.EDIT_PASSPHRASE;
  const isDev = process.env.NODE_ENV !== "production";
  if (expected) {
    if (passphrase !== expected) return err("unauthorized", 401);
  } else if (!isDev) {
    return err("edit gate not configured (set EDIT_PASSPHRASE)", 503);
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return err("AI not configured (set OPENAI_API_KEY)", 503);
  const model = process.env.OPENAI_MODEL || "gpt-4o-mini";

  const sys =
    mode === "geo"
      ? "אתה עוזר גאוקודינג לטיול באוסטריה. אל תשנה את התוכנית. " +
        "החזר JSON בלבד עם השדה acts בלבד: בדיוק אותן פעילויות, אותם שמות בעברית, אותו סדר. " +
        "לכל פריט החזר name (כפי שהוא, ללא שינוי) ו-q = שם המקום לחיפוש במפה באנגלית/גרמנית " +
        "(השם הרשמי/המקומי, למשל 'Zeller See', 'Kitzsteinhorn Kaprun'). אל תוסיף, אל תסיר ואל תשנה שמות."
      : "אתה עוזר לערוך תוכנית של יום בטיול משפחתי באוסטריה (קיץ 2026), עם ילדים. " +
        "המטרה: לְשַׁנּוֹת את היום הקיים לפי הבקשה — שמור על מה שלא התבקש לשינוי. " +
        "החזר JSON בלבד התואם למבנה המבוקש, בעברית. " +
        "acts = רשימת פעילויות בסדר ביצוע ביום. כל פריט הוא אובייקט עם שני שדות: " +
        "name = השם בעברית להצגה (קצר וברור), " +
        "q = שם המקום לחיפוש במפה באנגלית או גרמנית (השם הרשמי/המקומי, למשל " +
        "'Zeller See', 'Kitzsteinhorn Kaprun'). q חיוני כדי למצוא קואורדינטות. " +
        "אם הוספת פעילות חדשה, ספק לה גם name וגם q. " +
        (mode === "acts"
          ? "החזר רק את השדה acts (כל רשימת הפעילויות המעודכנת)."
          : "החזר title, desc (תיאור קצר של היום), intensity (1-5), drive, food, tips, rain, acts.");
  const ctx = regionName ? `האזור/בסיס: ${regionName}.\n` : "";
  const current = day
    ? `היום הנוכחי (לעריכה):\n${JSON.stringify(
        { ...day, acts: (day.acts ?? []).map((a) => a.name) },
        null,
        0,
      )}\n`
    : "";

  let draft;
  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        temperature: 0.7,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: sys },
          {
            role: "user",
            content: mode === "geo" ? `${ctx}${current}` : `${ctx}${current}בקשת השינוי: ${prompt}`,
          },
        ],
      }),
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      return err(`OpenAI error ${res.status}: ${detail.slice(0, 200)}`, 502);
    }
    const data = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const content = data.choices?.[0]?.message?.content ?? "{}";
    draft = DraftSchema.parse(JSON.parse(content));
  } catch (e) {
    return err(`AI draft failed: ${String(e).slice(0, 200)}`, 502);
  }

  // Reuse coordinates for activities whose name is unchanged; geocode only the
  // genuinely new ones. Keeps the modify-a-day goal cheap and stable.
  const prevCoords = new Map<string, { lat: number; lng: number }>();
  for (const a of day?.acts ?? []) {
    if (typeof a.lat === "number" && typeof a.lng === "number") {
      prevCoords.set(a.name.trim(), { lat: a.lat, lng: a.lng });
    }
  }
  const acts = await Promise.all(
    draft.acts
      .map((a) => ({ name: a.name.trim(), q: a.q?.trim() }))
      .filter((a) => a.name)
      .map(async ({ name, q }) => {
        const kept = prevCoords.get(name);
        if (kept) return { name, lat: kept.lat, lng: kept.lng };
        // Geocode by the model's German/English query, falling back to the name.
        const c = await geocodeName(q || name, near);
        return c ? { name, lat: c.lat, lng: c.lng } : { name };
      }),
  );

  // Driving minutes per leg: start at the region center (or first mapped act),
  // then through the mapped activities in order.
  const mappedIdx: number[] = [];
  const points: LatLng[] = [];
  if (near) points.push(near);
  acts.forEach((a, i) => {
    if (typeof a.lat === "number" && typeof a.lng === "number") {
      points.push({ lat: a.lat, lng: a.lng });
      mappedIdx.push(i);
    }
  });
  const legs = points.length >= 2 ? await drivingLegMinutes(points) : null;
  if (legs) {
    // legs[k] = minutes from points[k] to points[k+1]. With `near` prepended, the
    // leg arriving at mapped act k is legs[k]; without it, the first mapped act has
    // no inbound leg, so it's legs[k-1].
    mappedIdx.forEach((actIndex, k) => {
      const legIndex = near ? k : k - 1;
      if (legIndex >= 0 && legIndex < legs.length) {
        (acts[actIndex] as { legMin?: number }).legMin = legs[legIndex];
      }
    });
  }

  if (mode === "acts" || mode === "geo") {
    return NextResponse.json({ acts });
  }
  return NextResponse.json({
    title: draft.title,
    desc: draft.desc,
    intensity: draft.intensity,
    drive: draft.drive,
    food: draft.food,
    tips: draft.tips,
    rain: draft.rain,
    acts,
  });
}
