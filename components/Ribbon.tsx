"use client";

import { Fragment, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { Trip } from "@/lib/trip-schema";
import { nightsOfBase, baseDateRange } from "@/lib/trip-utils";
import { Icon, Lat } from "./icons";

export interface RibbonProps {
  trip: Trip;
  viewMode: "area" | "day";
  dayScope: string;
  activeIdx: number;
  currentRegion: string;
  open: boolean;
  onToggle: () => void;
  onAreaClick: (k: string) => void;
  onDayClick: (i: number) => void;
  onOverviewClick: () => void;
  onTypeOpen: () => void;
  onPrintClick: () => void;
  onTimelineClick: () => void;
  todayLabel: string;
  todayPulse?: boolean;
  typeMenuChildren?: ReactNode;
  tripList: { slug: string; label: string }[];
  activeSlug: string;
  onSwitchTrip: (slug: string) => void;
}

export default function Ribbon({
  trip,
  viewMode,
  dayScope,
  activeIdx,
  currentRegion,
  open,
  onToggle,
  onAreaClick,
  onDayClick,
  onOverviewClick,
  onTypeOpen,
  onPrintClick,
  onTimelineClick,
  todayLabel,
  todayPulse = true,
  typeMenuChildren,
  tripList,
  activeSlug,
  onSwitchTrip,
}: RibbonProps) {
  const ribbonRef = useRef<HTMLDivElement>(null);
  const searchBoxRef = useRef<HTMLDivElement>(null);

  function highlight(text: string, query: string): ReactNode {
    const q = query.trim();
    if (!q) return text;
    const lower = text.toLowerCase();
    const needle = q.toLowerCase();
    const parts: ReactNode[] = [];
    let i = 0;
    let k = 0;
    while (i < text.length) {
      const found = lower.indexOf(needle, i);
      if (found === -1) {
        parts.push(<Fragment key={k++}>{text.slice(i)}</Fragment>);
        break;
      }
      if (found > i) parts.push(<Fragment key={k++}>{text.slice(i, found)}</Fragment>);
      parts.push(<mark key={k++}>{text.slice(found, found + needle.length)}</mark>);
      i = found + needle.length;
    }
    return parts;
  }
  const [searchQuery, setSearchQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);

  const searchResults = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (q.length < 2) return [];
    const out: { idx: number; snippet: string }[] = [];
    trip.days.forEach((d, idx) => {
      const region = trip.regions[d.base];
      const fields: string[] = [
        d.title,
        ...d.acts,
        d.food,
        d.tips,
        d.rain,
        d.drive,
        d.cardLabel,
        region?.name ?? "",
      ];
      for (const text of fields) {
        if (text && text.toLowerCase().includes(q)) {
          out.push({ idx, snippet: text });
          break;
        }
      }
    });
    return out;
  }, [searchQuery, trip]);

  useEffect(() => {
    if (!searchOpen) return;
    const onDocClick = (e: MouseEvent) => {
      if (!searchBoxRef.current?.contains(e.target as Node)) {
        setSearchOpen(false);
      }
    };
    document.addEventListener("click", onDocClick);
    return () => document.removeEventListener("click", onDocClick);
  }, [searchOpen]);

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
    <>
      <button
        className={`ribbon-toggle${open ? " open" : ""}`}
        onClick={onToggle}
        aria-expanded={open}
        aria-label={open ? "הסתרת תפריט" : "פתיחת תפריט"}
        title={open ? "הסתרה" : "תפריט"}
      >
        {open ? (
          <svg viewBox="0 0 24 24" width={18} height={18} fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
            <path d="M6 6l12 12M6 18L18 6" />
          </svg>
        ) : (
          <svg viewBox="0 0 24 24" width={18} height={18} fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 6h18M3 12h18M3 18h18" />
          </svg>
        )}
      </button>
    <nav
      className={`journey${dimming ? " dimming" : ""}${open ? " open" : " closed"}`}
      aria-label="מסלול הטיול"
      aria-hidden={!open}
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
                    {k.startsWith("transfer-") && (
                      <span className="lg-tran-ico">
                        <Icon name={r.icon} size={14} />
                      </span>
                    )}
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
        <div className="search-box" ref={searchBoxRef}>
          <input
            type="search"
            className="search-input"
            value={searchQuery}
            placeholder="חיפוש פעילות…"
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setSearchOpen(true);
            }}
            onFocus={() => setSearchOpen(true)}
          />
          {searchOpen && searchQuery.trim().length >= 2 && (
            <div className="search-results" role="listbox">
              {searchResults.length === 0 ? (
                <div className="search-empty">אין תוצאות</div>
              ) : (
                searchResults.map((r) => {
                  const day = trip.days[r.idx];
                  return (
                    <button
                      key={`${r.idx}-${r.snippet}`}
                      role="option"
                      className="search-item"
                      onClick={() => {
                        onDayClick(r.idx);
                        setSearchQuery("");
                        setSearchOpen(false);
                      }}
                    >
                      <span className="search-day" style={{ color: day.color }}>
                        יום {day.n} · <Lat>{day.d}</Lat>
                      </span>
                      <span className="search-snippet">
                        {highlight(r.snippet, searchQuery)}
                      </span>
                    </button>
                  );
                })
              )}
            </div>
          )}
        </div>
        {tripList.length > 1 && (
          <div className="trip-switch" role="tablist" aria-label="בחירת טיול">
            {tripList.map((t) => (
              <button
                key={t.slug}
                role="tab"
                aria-selected={t.slug === activeSlug}
                className={`trip-switch-pill${t.slug === activeSlug ? " on" : ""}`}
                onClick={() => onSwitchTrip(t.slug)}
              >
                {t.label}
              </button>
            ))}
          </div>
        )}
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
          onClick={onTimelineClick}
          aria-label="ציר זמן"
          title="ציר זמן"
        >
          <Icon name="timeline" size={17} />
        </button>
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
    </>
  );
}
