"use client";

import { useEffect, useMemo, useRef } from "react";
import type { Trip } from "@/lib/trip-schema";
import { todayIndex } from "@/lib/trip-utils";
import { Icon, Lat } from "./icons";

export interface TimelinePanelProps {
  trip: Trip;
  open: boolean;
  activeIdx: number;
  onClose: () => void;
  onDayClick: (idx: number) => void;
}

export default function TimelinePanel({
  trip,
  open,
  activeIdx,
  onClose,
  onDayClick,
}: TimelinePanelProps) {
  const listRef = useRef<HTMLOListElement>(null);
  const tIdx = useMemo(() => todayIndex(trip), [trip]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  useEffect(() => {
    if (!open) return;
    const list = listRef.current;
    if (!list) return;
    const target =
      list.querySelector<HTMLLIElement>("li.is-active") ||
      list.querySelector<HTMLLIElement>("li.is-today");
    if (target) {
      target.scrollIntoView({ block: "center", behavior: "smooth" });
    }
  }, [open, activeIdx, tIdx]);

  return (
    <>
      <div
        className={`scrim${open ? " show" : ""}`}
        onClick={onClose}
      />
      <aside
        className={`tlpanel${open ? " show" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-label="ציר הזמן של הטיול"
        aria-hidden={!open}
      >
        <div className="tl-hd">
          <span className="tl-gl">
            <Icon name="timeline" size={18} />
          </span>
          <div className="tl-ttl">
            <div className="tl-title">ציר הזמן</div>
            <div className="tl-sub">{trip.days.length} ימים</div>
          </div>
          <button
            className="tl-x"
            aria-label="סגירה"
            onClick={onClose}
          >
            ×
          </button>
        </div>
        <ol className="tl-list" ref={listRef}>
          {trip.days.map((day, i) => {
            const region = trip.regions[day.base];
            const isActive = i === activeIdx;
            const isToday = i === tIdx;
            const cls = [
              "tl-row",
              isActive ? "is-active" : "",
              isToday ? "is-today" : "",
            ]
              .filter(Boolean)
              .join(" ");
            return (
              <li
                key={i}
                className={cls}
                style={{ ["--tc" as string]: day.color }}
              >
                <button
                  type="button"
                  className="tl-btn"
                  onClick={() => onDayClick(i)}
                  aria-label={`יום ${day.n}, ${day.d} ${day.dow}, ${day.title}`}
                  aria-current={isActive ? "true" : undefined}
                >
                  <span className="tl-stripe" aria-hidden="true" />
                  <span className="tl-num">{day.n}</span>
                  <span className="tl-date">
                    <Lat>{day.d}</Lat>
                    <span className="tl-dow">{day.dow}</span>
                  </span>
                  <span className="tl-ico" aria-hidden="true">
                    <Icon name={day.icon} size={16} />
                  </span>
                  <span className="tl-meta">
                    <span className="tl-title-row">{day.title}</span>
                    {region && (
                      <span className="tl-region">{region.short}</span>
                    )}
                  </span>
                  {isToday && <span className="tl-today-pill">היום</span>}
                </button>
              </li>
            );
          })}
        </ol>
      </aside>
    </>
  );
}
