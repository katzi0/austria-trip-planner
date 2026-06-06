"use client";

import { useEffect, useRef } from "react";
import type { Trip } from "@/lib/trip-schema";
import { visibleDayIndexes } from "@/lib/trip-utils";
import { Icon, Lat } from "./icons";

export interface DayStripProps {
  trip: Trip;
  viewMode: "area" | "day";
  dayScope: string;
  activeIdx: number;
  onTicketClick: (i: number) => void;
  onPrev: () => void;
  onNext: () => void;
  onToggleArea: () => void;
  onToggleDay: () => void;
}

function Ridge({ intensity }: { intensity: number }) {
  const heights = [7, 10, 13, 16, 19];
  return (
    <span className="ridge" style={{ ["--rc" as string]: "var(--tc)" }}>
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

export default function DayStrip({
  trip,
  viewMode,
  dayScope,
  activeIdx,
  onTicketClick,
  onPrev,
  onNext,
  onToggleArea,
  onToggleDay,
}: DayStripProps) {
  const stripRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const strip = stripRef.current;
    if (!strip) return;
    const tk = strip.querySelector<HTMLElement>(".ticket.active");
    if (tk) {
      tk.scrollIntoView({ inline: "center", block: "nearest", behavior: "smooth" });
    }
  }, [activeIdx, viewMode, dayScope]);

  const visible = visibleDayIndexes(trip, dayScope);
  const visibleCount = visible.length;
  const pos = visible.indexOf(activeIdx);

  // Strip title
  let stripTitle = "";
  if (viewMode === "area") {
    const nDays = trip.days.length;
    const nBases = trip.baseOrder.length;
    stripTitle = `כל הטיול · ${nDays} ימים · ${nBases} בסיסים`;
  } else if (activeIdx < 0 && dayScope === "all") {
    stripTitle = "כל הימים · בחרו יום";
  } else if (activeIdx < 0 && dayScope !== "all") {
    stripTitle = `${trip.regions[dayScope]?.name ?? ""} · בחרו יום`;
  } else if (activeIdx >= 0 && dayScope === "all") {
    stripTitle = "כל הימים";
  } else {
    stripTitle = trip.regions[dayScope]?.name ?? "";
  }

  // Stepper
  const stepperText =
    pos >= 0 ? `יום ${pos + 1} / ${visibleCount}` : `${visibleCount} ימים`;
  const prevDisabled = pos <= 0;
  const nextDisabled = pos >= 0 ? pos >= visibleCount - 1 : false;

  return (
    <section className="stripwrap" aria-label="ימי הטיול">
      <div className="strip-hd">
        <div className="lead">
          <div className="toggle" role="tablist" aria-label="מצב תצוגה">
            <button
              className={viewMode === "area" ? "on" : ""}
              role="tab"
              onClick={onToggleArea}
            >
              אזורים
            </button>
            <button
              className={viewMode === "day" ? "on" : ""}
              role="tab"
              onClick={onToggleDay}
            >
              ימים
            </button>
          </div>
          <span className="strip-title">{stripTitle}</span>
        </div>
        <div className="tail">
          <div className={`stepper${viewMode === "day" ? " show" : ""}`}>
            <button onClick={onPrev} disabled={prevDisabled} aria-label="יום קודם">
              ‹
            </button>
            <span className="ct">{stepperText}</span>
            <button onClick={onNext} disabled={nextDisabled} aria-label="יום הבא">
              ›
            </button>
          </div>
          <span className="scrollhint">↔ גלילה</span>
        </div>
      </div>
      <div className="strip" ref={stripRef}>
        {trip.days.map((day, i) => {
          const hidden =
            viewMode === "day" && dayScope !== "all" && day.base !== dayScope;
          const active = activeIdx === i;
          return (
            <article
              key={i}
              className={`ticket${active ? " active" : ""}`}
              style={{
                ["--tc" as string]: day.color,
                display: hidden ? "none" : undefined,
              }}
              data-i={i}
              role="button"
              tabIndex={0}
              aria-label={`יום ${day.n} · ${day.title}`}
              onClick={() => onTicketClick(i)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onTicketClick(i);
                }
              }}
            >
              <div className="tk-stub">
                <span className="num">{day.n}</span>
                <Icon name={day.icon} size={16} />
              </div>
              <div className="tk-body">
                <div className="tk-date">
                  <Lat>{day.d}</Lat>
                  <span className="tk-dow">{day.dow}</span>
                  {day.star && (
                    <span className="star">
                      <Icon name="star" size={12} />
                    </span>
                  )}
                </div>
                <div className="tk-title">{day.title}</div>
                <div className="tk-foot">
                  <span className="drive">
                    <Icon name="car" size={13} />
                    <span>{day.drive}</span>
                  </span>
                  <span
                    className={`cov ${day.cardClass}`}
                    title={day.cardLabel}
                  />
                  <Ridge intensity={day.intensity} />
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
