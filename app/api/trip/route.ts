import { NextResponse } from "next/server";
import { readTrip, writeTrip } from "@/lib/db";
import { TripSchema } from "@/lib/trip-schema";
import { DEFAULT_SLUG, isKnownSlug } from "@/lib/trips";
import { revalidatePath } from "next/cache";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// CORS: lets the standalone offline HTML editor (a file:// page → "null" origin)
// post directly to this endpoint. Writes stay passphrase-gated, so this does not
// weaken protection.
const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, PATCH, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

function json(data: unknown, status = 200): NextResponse {
  return NextResponse.json(data, { status, headers: CORS_HEADERS });
}

export async function OPTIONS(): Promise<NextResponse> {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

export async function GET(req: Request): Promise<NextResponse> {
  const slug = new URL(req.url).searchParams.get("slug") ?? DEFAULT_SLUG;
  if (!isKnownSlug(slug)) {
    return json({ error: "unknown slug" }, 400);
  }
  const trip = await readTrip(slug);
  return json(trip);
}

export async function PATCH(req: Request): Promise<NextResponse> {
  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return json({ error: "bad body" }, 400);
  }
  const { passphrase, trip, slug } = body as {
    passphrase?: string;
    trip?: unknown;
    slug?: string;
  };
  const expected = process.env.EDIT_PASSPHRASE;
  const isDev = process.env.NODE_ENV !== "production";
  if (!expected) {
    if (!isDev) {
      return json({ error: "edit gate not configured (set EDIT_PASSPHRASE)" }, 503);
    }
    // Local dev with no passphrase configured — accept any value.
  } else if (passphrase !== expected) {
    return json({ error: "unauthorized" }, 401);
  }
  const targetSlug = slug ?? DEFAULT_SLUG;
  if (!isKnownSlug(targetSlug)) {
    return json({ error: "unknown slug" }, 400);
  }
  const parsed = TripSchema.safeParse(trip);
  if (!parsed.success) {
    return json({ error: "invalid trip", issues: parsed.error.flatten() }, 400);
  }
  await writeTrip(targetSlug, parsed.data);
  revalidatePath("/");
  return json({ ok: true });
}
