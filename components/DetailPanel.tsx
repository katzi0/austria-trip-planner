"use client";

import { useEffect, useState } from "react";
import type { Trip } from "@/lib/trip-schema";
import { BUSY } from "@/lib/trip-schema";
import { Icon, Lat } from "./icons";

export interface DetailPanelProps {
  trip: Trip;
  activeIdx: number;
  open: boolean;
  onClose: () => void;
}

function Ridge({ intensity }: { intensity: number }) {
  const heights = [7, 10, 13, 16, 19];
  return (
    <span className="ridge" style={{ ["--rc" as string]: "var(--dcc)" }}>
      {heights.map((h, i) => (
        <i
          key={i}
          className={i < intensity ? "f" : ""}
          style={{ height: `${h}px` }}
        />
      ))}
    </span>
  );
}

function useIsPhone(): boolean {
  const [isPhone, setIsPhone] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(max-width:720px)");
    const apply = () => setIsPhone(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);
  return isPhone;
}

export default function DetailPanel({
  trip,
  activeIdx,
  open,
  onClose,
}: DetailPanelProps) {
  const isPhone = useIsPhone();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const d = activeIdx >= 0 ? trip.days[activeIdx] : null;
  const r = d ? trip.regions[d.base] : null;
  const showOpen = open && d && r;

  // Body shared between panel and sheet
  const body = d && r ? (
    <>
      <div className="pnl-band">
        <span className="pnl-gl">
          <Icon name={d.icon} size={20} />
        </span>
        <div className="pnl-when">
          <div className="pnl-day">
            יום {d.n}
            {d.star ? " ★" : ""}
          </div>
          <div className="pnl-date">
            <Lat>{d.d}</Lat> · {d.dow}
          </div>
        </div>
        <button
          className="pnl-x"
          aria-label="סגירה"
          onClick={onClose}
        >
          ×
        </button>
      </div>
      <div className="pnl-body">
        <h2 className="pnl-title">{d.title}</h2>
        <div className="pnl-area">
          <Icon name={r.icon} size={14} />
          <span>
            {r.name} · <Lat>{r.hotel}</Lat>
          </span>
        </div>
        <div className="pnl-facts">
          <span className="chip busylab">
            <Ridge intensity={d.intensity} />
            {BUSY[d.intensity]}
          </span>
          <span className={`chip ${d.cardClass}`}>
            {d.cardClass === "free" ? (
              <Icon name="star" size={13} />
            ) : (
              <Icon name="car" size={13} />
            )}
            {d.cardLabel}
          </span>
          <span className="chip">
            <Icon name="car" size={13} />
            {d.drive}
          </span>
        </div>
        <section className="pnl-sec">
          <h4>מסלול היום</h4>
          <ul className="pnl-acts">
            {d.acts.map((a, i) => (
              <li key={i}>{a}</li>
            ))}
          </ul>
        </section>
        <section className="pnl-sec">
          <h4>אוכל</h4>
          <p>{d.food}</p>
        </section>
        <section className="pnl-sec">
          <h4>טיפ</h4>
          <p>{d.tips}</p>
        </section>
        {d.rain && d.rain !== "—" && (
          <section className="pnl-sec">
            <div className="planb">
              <Icon name="rain" size={16} />
              <div>
                <b>תוכנית גשם</b>
                {d.rain}
              </div>
            </div>
          </section>
        )}
        {d.overnight && (
          <section className="pnl-sec">
            <div className="overnote">
              <Icon name="bed" size={14} />
              {d.overnight}
            </div>
          </section>
        )}
      </div>
    </>
  ) : null;

  const dccStyle = d ? ({ ["--dcc" as string]: d.color } as React.CSSProperties) : undefined;

  return (
    <>
      <div
        className={`scrim${showOpen ? " show" : ""}`}
        onClick={onClose}
      />
      {isPhone ? (
        <div
          className={`sheet${showOpen ? " show" : ""}`}
          role="dialog"
          aria-modal="true"
          style={dccStyle}
        >
          {body}
        </div>
      ) : (
        <aside
          className={`panel${showOpen ? " show" : ""}`}
          role="dialog"
          aria-modal="true"
          aria-label="פרטי היום"
          style={dccStyle}
        >
          {body}
        </aside>
      )}
    </>
  );
}
