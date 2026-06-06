import { NextResponse } from "next/server";
import { readTrip, writeTrip } from "@/lib/db";
import { TripSchema } from "@/lib/trip-schema";
import { revalidatePath } from "next/cache";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(): Promise<NextResponse> {
  const trip = await readTrip();
  return NextResponse.json(trip);
}

export async function PATCH(req: Request): Promise<NextResponse> {
  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "bad body" }, { status: 400 });
  }
  const { passphrase, trip } = body as { passphrase?: string; trip?: unknown };
  const expected = process.env.EDIT_PASSPHRASE;
  const isDev = process.env.NODE_ENV !== "production";
  if (!expected) {
    if (!isDev) {
      return NextResponse.json(
        { error: "edit gate not configured (set EDIT_PASSPHRASE)" },
        { status: 503 },
      );
    }
    // Local dev with no passphrase configured — accept any value.
  } else if (passphrase !== expected) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const parsed = TripSchema.safeParse(trip);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid trip", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }
  await writeTrip("austria-2026", parsed.data);
  revalidatePath("/");
  return NextResponse.json({ ok: true });
}
