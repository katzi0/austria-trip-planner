import type { Trip } from "@/lib/trip-schema";
import { BUSY } from "@/lib/trip-schema";
import { baseDateRange } from "@/lib/trip-utils";

export interface PrintViewProps {
  trip: Trip;
  id?: string;
}

export default function PrintView({ trip, id = "print" }: PrintViewProps) {
  return (
    <div id={id}>
      <h1 style={{ fontFamily: "serif" }}>
        אוסטריה 2026 · יומן הטיול (14–30.7)
      </h1>
      {trip.baseOrder.map((k) => {
        const r = trip.regions[k];
        if (!r) return null;
        const daysInBase = trip.days.filter((d) => d.base === k);
        return (
          <div key={k}>
            <h2>
              {r.name} · {r.hotel} ({baseDateRange(trip, k)})
            </h2>
            {daysInBase.map((d) => (
              <div key={d.n} className="pd">
                <b>
                  יום {d.n} · {d.d} {d.dow} — {d.title}
                </b>
                <br />
                {d.acts.join(" · ")}
                <br />
                נסיעה: {d.drive} · כרטיס: {d.cardLabel} · עומס:{" "}
                {BUSY[d.intensity]}
                {d.rain && d.rain !== "—" && (
                  <>
                    <br />
                    גשם: {d.rain}
                  </>
                )}
                {d.tips && (
                  <>
                    <br />
                    טיפ: {d.tips}
                  </>
                )}
              </div>
            ))}
          </div>
        );
      })}
    </div>
  );
}
