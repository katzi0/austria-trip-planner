import { readTrip } from "@/lib/db";
import TripView from "@/components/TripView";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const trip = await readTrip();
  return <TripView trip={trip} />;
}
