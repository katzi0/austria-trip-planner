"use client";

import { useEffect, useRef, type ReactNode } from "react";
import type { Trip } from "@/lib/trip-schema";
import { nightsOfBase, baseDateRange } from "@/lib/trip-utils";
import { Icon, Lat } from "./icons";

export interface RibbonProps {
  trip: Trip;
  viewMode: "area" | "day";
  dayScope: string;
  activeIdx: number;
  currentRegion: string;
  onAreaClick: (k: string) => void;
  onDayClick: (i: number) => void;
  onOverviewClick: () => void;
  onTypeOpen: () => void;
  onPrintClick: () => void;
  todayLabel: string;
  todayPulse?: boolean;
  typeMenuChildren?: ReactNode;
}

export default function Ribbon({
  trip,
  viewMode,
  dayScope,
  activeIdx,
  currentRegion,
  onAreaClick,
  onDayClick,
  onOverviewClick,
  onTypeOpen,
  onPrintClick,
  todayLabel,
  todayPulse = true,
  typeMenuChildren,
}: RibbonProps) {
  const ribbonRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const rb = ribbonRef.current;
    if (!rb) return;
    let chip: HTMLElement | null = null;
    if (viewMode === "area") {
      chip = rb.querySelector<HTMLElement>(".leg.on");
    } else {
      chip = rb.querySelector<HTMLElement>(".dayleg.on");
    }
    if (chip) {
      chip.scrollIntoView({ inline: "center", block: "nearest", behavior: "smooth" });
    }
  }, [viewMode, activeIdx, currentRegion, dayScope]);

  const dimming = viewMode === "area" && currentRegion !== "all";

  return (
    <nav
      className={`journey${dimming ? " dimming" : ""}`}
      aria-label="מסלול הטיול"
    >
      <button
        className={`overview-btn${viewMode === "area" ? " on" : ""}`}
        onClick={onOverviewClick}
        aria-label="מבט-על על כל האזורים"
      >
        <svg
          viewBox="0 0 24 24"
          width={18}
          height={18}
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M3 6l6-3 6 3 6-3v15l-6 3-6-3-6 3zM9 3v15M15 6v15" />
        </svg>
        <span>מבט-על</span>
      </button>

      <div className="ribbon" ref={ribbonRef}>
        {viewMode === "area"
          ? trip.baseOrder.map((k, idx) => {
              const r = trip.regions[k];
              if (!r) return null;
              const nights = nightsOfBase(trip, k);
              const on = currentRegion === k;
              return (
                <button
                  key={k}
                  className={`leg${on ? " on" : ""}`}
                  style={{
                    ["--lc" as string]: r.hex,
                    flexGrow: nights,
                  }}
                  data-k={k}
                  aria-label={`${r.name}, ${nights} ימים`}
                  onClick={() => onAreaClick(k)}
                >
                  <div className="lg-top">
                    <span className="step">{idx + 1}</span>
                    <span className="lg-name">{r.name}</span>
                  </div>
                  <div className="lg-meta">
                    <Lat>{baseDateRange(trip, k)}</Lat>
                    <span className="nights">
                      <Icon name="moon" size={12} />
                      {nights} ל&apos;
                    </span>
                  </div>
                  <div className="lg-hotel">
                    <Lat>{r.hotel}</Lat>
                  </div>
                </button>
              );
            })
          : trip.days.map((day, i) => {
              if (dayScope !== "all" && day.base !== dayScope) return null;
              const on = activeIdx === i;
              return (
                <button
                  key={i}
                  className={`dayleg${on ? " on" : ""}`}
                  style={{ ["--lc" as string]: day.color }}
                  data-i={i}
                  aria-label={`יום ${day.n}, ${day.d}`}
                  onClick={() => onDayClick(i)}
                >
                  <div className="dl-top">
                    <span className="dl-num">{day.n}</span>
                    <span className="dl-ico">
                      <Icon name={day.icon} size={15} />
                    </span>
                  </div>
                  <div className="dl-date">
                    <Lat>{day.d}</Lat>
                  </div>
                  <div className="dl-dow">{day.dow}</div>
                </button>
              );
            })}
      </div>

      <div className="maptools">
        <span className="today-pill" id="todayPill">
          <span
            className="dot"
            style={todayPulse ? undefined : { animation: "none" }}
          />
          <span>{todayLabel}</span>
        </span>
        <div className="menu">
          <button
            className="iconbtn aa"
            onClick={(e) => {
              e.stopPropagation();
              onTypeOpen();
            }}
            aria-haspopup="true"
            aria-label="סגנון טיפוגרפי"
          >
            Aa
          </button>
          {typeMenuChildren}
        </div>
        <button
          className="iconbtn"
          onClick={onPrintClick}
          aria-label="הדפסה / PDF"
          title="הדפסה"
        >
          <svg
            viewBox="0 0 24 24"
            width={17}
            height={17}
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M6 9V3h12v6M6 18H4a2 2 0 0 1-2-2v-4a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2h-2M6 14h12v7H6z" />
          </svg>
        </button>
      </div>
    </nav>
  );
}
