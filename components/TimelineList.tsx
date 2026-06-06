"use client";

import { useEffect, useMemo, useRef } from "react";
import type { Trip } from "@/lib/trip-schema";
import { todayIndex } from "@/lib/trip-utils";
import { Icon, Lat } from "./icons";

export interface TimelineListProps {
  trip: Trip;
  activeIdx: number;
  onDayClick: (idx: number) => void;
}

export default function TimelineList({
  trip,
  activeIdx,
  onDayClick,
}: TimelineListProps) {
  const listRef = useRef<HTMLOListElement>(null);
  const tIdx = useMemo(() => todayIndex(trip), [trip]);

  useEffect(() => {
    const list = listRef.current;
    if (!list) return;
    const target =
      list.querySelector<HTMLLIElement>("li.is-active") ||
      list.querySelector<HTMLLIElement>("li.is-today");
    if (target) {
      target.scrollIntoView({ block: "center", behavior: "smooth" });
    }
  }, [activeIdx, tIdx]);

  return (
    <div className="tl-listwrap">
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
                  {region && <span className="tl-region">{region.short}</span>}
                </span>
                {isToday && <span className="tl-today-pill">היום</span>}
              </button>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
