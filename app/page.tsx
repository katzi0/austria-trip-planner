import { readTrip } from "@/lib/db";
import { TRIPS, DEFAULT_SLUG } from "@/lib/trips";
import TripShell from "@/components/TripShell";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const trips = await Promise.all(
    TRIPS.map(async (t) => ({
      slug: t.slug,
      label: t.label,
      trip: await readTrip(t.slug),
    })),
  );
  return <TripShell trips={trips} defaultSlug={DEFAULT_SLUG} />;
}
