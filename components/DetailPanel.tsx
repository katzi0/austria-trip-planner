"use client";

import { useEffect } from "react";
import type { Trip } from "@/lib/trip-schema";
import { BUSY } from "@/lib/trip-schema";
import { useIsPhone } from "@/lib/use-is-phone";
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
        <section className="pnl-sec pnl-agenda">
          <h4>תוכנית היום</h4>
          <ol className="pnl-acts">
            {d.acts.map((a, i) => (
              <li key={i}>
                <span className="pnl-step">{i + 1}</span>
                <span className="pnl-step-text">{a.name}</span>
                {typeof a.lat === "number" && a.lat !== 0 && (
                  <span className="pnl-step-pin" title="מסומן על המפה">
                    <Icon name="car" size={11} />
                  </span>
                )}
              </li>
            ))}
          </ol>
        </section>
        {r.attractions && r.attractions.length > 0 && (
          <section className="pnl-sec">
            <h4>אטרקציות באזור</h4>
            <div className="pnl-attractions">
              {r.attractions.map((a, i) => (
                <div className="attr" key={i}>
                  <div className="attr-top">
                    <span className="attr-name">{a.name}</span>
                    {a.card && <span className="attr-card">כלול בכרטיס הקיץ</span>}
                  </div>
                  {a.desc && <p className="attr-desc">{a.desc}</p>}
                  {a.parking && (
                    <div className="attr-row">
                      <Icon name="car" size={13} />
                      <span>
                        <b>חניה:</b> {a.parking}
                      </span>
                    </div>
                  )}
                  {a.tips && (
                    <div className="attr-row">
                      <Icon name="star" size={13} />
                      <span>
                        <b>טיפ:</b> {a.tips}
                      </span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}
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
