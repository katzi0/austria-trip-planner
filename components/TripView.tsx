"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { Trip } from "@/lib/trip-schema";
import { dateOf, todayIndex, visibleDayIndexes } from "@/lib/trip-utils";
import { useIsPhone } from "@/lib/use-is-phone";
import Map from "./Map";
import Ribbon from "./Ribbon";
import DayStrip from "./DayStrip";
import DetailPanel from "./DetailPanel";
import TimelinePanel from "./TimelinePanel";
import PrintView from "./PrintView";
import UploadDialog from "./UploadDialog";

type ViewMode = "area" | "day";
type Pairing = "alpine" | "booking" | "journal";

const PAIRINGS: ReadonlyArray<[Pairing, string]> = [
  ["alpine", "אלפיני"],
  ["booking", "בוקינג"],
  ["journal", "יומן מסע"],
];

export interface TripViewProps {
  trip: Trip;
  slug: string;
  tripList: { slug: string; label: string }[];
  activeSlug: string;
  onSwitchTrip: (slug: string) => void;
}

function computeTodayLabel(trip: Trip, now = new Date()): { label: string; pulse: boolean } {
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  const tIdx = todayIndex(trip, today);
  if (tIdx >= 0) {
    return { label: `היום · יום ${trip.days[tIdx].n}`, pulse: true };
  }
  const start = dateOf(trip.days[0]);
  const end = dateOf(trip.days[trip.days.length - 1]);
  if (today < start) {
    const days = Math.round((start.getTime() - today.getTime()) / 864e5);
    return { label: `עוד ${days} ימים ליציאה`, pulse: true };
  }
  if (today > end) {
    return { label: "הטיול הסתיים · נסיעה טובה הביתה", pulse: false };
  }
  return { label: "בדרך", pulse: true };
}

export default function TripView({
  trip,
  slug,
  tripList,
  activeSlug,
  onSwitchTrip,
}: TripViewProps) {
  const router = useRouter();
  const isPhone = useIsPhone();
  const viewKey = `austria_view_${slug}`;
  const typeKey = `austria_type_${slug}`;
  const tripLabel = tripList.find((t) => t.slug === slug)?.label;
  // SSR-safe initial state — read storage and today after mount.
  const [viewMode, setViewMode] = useState<ViewMode>("area");
  const [dayScope, setDayScope] = useState<string>("all");
  const [currentRegion, setCurrentRegion] = useState<string>("all");
  const [activeIdx, setActiveIdx] = useState<number>(-1);
  const [panelOpen, setPanelOpen] = useState<boolean>(false);
  const [timelineOpen, setTimelineOpen] = useState<boolean>(false);
  const [typeMenuOpen, setTypeMenuOpen] = useState<boolean>(false);
  const [ribbonOpen, setRibbonOpen] = useState<boolean>(false);
  const [curPairing, setCurPairing] = useState<Pairing>("alpine");
  const [hydrated, setHydrated] = useState<boolean>(false);
  const [uploadOpen, setUploadOpen] = useState<boolean>(false);

  const { label: todayLabel, pulse: todayPulse } = useMemo(
    () => computeTodayLabel(trip),
    [trip]
  );

  // On mount: read localStorage + decide landing mode.
  useEffect(() => {
    const storedView = (typeof window !== "undefined"
      ? localStorage.getItem(viewKey)
      : null) as ViewMode | null;
    const storedType = (typeof window !== "undefined"
      ? localStorage.getItem(typeKey)
      : null) as Pairing | null;

    if (tripLabel && typeof document !== "undefined") {
      document.title = tripLabel;
    }

    if (storedType && PAIRINGS.some(([id]) => id === storedType)) {
      setCurPairing(storedType);
    }

    const tIdx = todayIndex(trip);
    if (tIdx >= 0) {
      setViewMode("day");
      setDayScope("all");
      setActiveIdx(tIdx);
      setCurrentRegion(trip.days[tIdx].base);
      setPanelOpen(false);
    } else if (storedView === "day" || storedView === "area") {
      setViewMode(storedView);
      setDayScope("all");
      setActiveIdx(-1);
      setCurrentRegion("all");
    }
    setHydrated(true);
  }, [trip, viewKey, typeKey, tripLabel]);

  // Persist viewMode.
  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(viewKey, viewMode);
    } catch {
      /* noop */
    }
  }, [viewMode, hydrated, viewKey]);

  // Apply typography pairing class on <html>.
  useEffect(() => {
    document.documentElement.className = "type-" + curPairing;
    if (hydrated) {
      try {
        localStorage.setItem(typeKey, curPairing);
      } catch {
        /* noop */
      }
    }
  }, [curPairing, hydrated, typeKey]);

  // Close type menu on outside click.
  useEffect(() => {
    if (!typeMenuOpen) return;
    const onDocClick = () => setTypeMenuOpen(false);
    document.addEventListener("click", onDocClick);
    return () => document.removeEventListener("click", onDocClick);
  }, [typeMenuOpen]);

  const visible = useMemo(
    () => visibleDayIndexes(trip, dayScope),
    [trip, dayScope]
  );

  // focusDay — implements prototype behaviour
  const focusDay = useCallback(
    (i: number) => {
      const day = trip.days[i];
      if (!day) return;
      setViewMode("day");
      setActiveIdx(i);
      setCurrentRegion(day.base);
      // Panel: if it's already open, keep it open and update.
      // (panelOpen stays as-is; activeIdx change drives the body)
    },
    [trip]
  );

  // Step prev/next within currently-visible days.
  const step = useCallback(
    (delta: number) => {
      const list = visible;
      const pos = list.indexOf(activeIdx);
      const n = pos + delta;
      if (n < 0 || n >= list.length) return;
      focusDay(list[n]);
    },
    [visible, activeIdx, focusDay]
  );

  // Mode setters
  const setAreaMode = useCallback(() => {
    setViewMode("area");
    setDayScope("all");
    setCurrentRegion("all");
    setActiveIdx(-1);
    setPanelOpen(false);
  }, []);

  const setDayMode = useCallback(
    (scope: string, focus?: number) => {
      setViewMode("day");
      setDayScope(scope);
      if (typeof focus === "number") {
        focusDay(focus);
      } else {
        setActiveIdx(-1);
        setCurrentRegion(scope);
        setPanelOpen(false);
      }
    },
    [focusDay]
  );

  // Ribbon area-click → drill to base (day mode scoped to that base).
  const onAreaClick = useCallback(
    (k: string) => {
      setDayMode(k);
    },
    [setDayMode]
  );

  const onDayClick = useCallback(
    (i: number) => {
      focusDay(i);
    },
    [focusDay]
  );

  const onOverviewClick = useCallback(() => {
    setAreaMode();
  }, [setAreaMode]);

  const onTypeOpen = useCallback(() => {
    setTypeMenuOpen((v) => !v);
  }, []);

  const onRibbonToggle = useCallback(() => {
    setRibbonOpen((v) => !v);
  }, []);

  // Print: render the print div (always rendered, hidden by CSS) and call print.
  const onPrintClick = useCallback(() => {
    window.print();
  }, []);

  const onTimelineClick = useCallback(() => {
    setTimelineOpen((v) => !v);
  }, []);

  const onUploadClick = useCallback(() => {
    setUploadOpen(true);
  }, []);

  const closeTimeline = useCallback(() => {
    setTimelineOpen(false);
  }, []);

  const onTimelineDayClick = useCallback(
    (i: number) => {
      focusDay(i);
      setPanelOpen(true);
    },
    [focusDay]
  );

  // Toggle handlers (DayStrip)
  const onToggleArea = useCallback(() => {
    setAreaMode();
  }, [setAreaMode]);
  const onToggleDay = useCallback(() => {
    setDayMode("all");
  }, [setDayMode]);

  // Ticket click
  const onTicketClick = useCallback(
    (i: number) => {
      if (viewMode === "day" && activeIdx === i) {
        setPanelOpen(true);
      } else {
        focusDay(i);
      }
    },
    [viewMode, activeIdx, focusDay]
  );

  // Map callbacks
  const onDayPinClick = useCallback(
    (i: number) => {
      if (viewMode === "day" && activeIdx === i) {
        setPanelOpen(true);
      } else {
        focusDay(i);
      }
    },
    [viewMode, activeIdx, focusDay]
  );
  const onHotelClick = useCallback(
    (regionKey: string) => {
      setDayMode(regionKey);
    },
    [setDayMode]
  );
  const onMiniPopupClick = useCallback((_i: number) => {
    setPanelOpen(true);
  }, []);

  // Close panel
  const closePanel = useCallback(() => {
    setPanelOpen(false);
  }, []);

  // Keyboard: ESC close, arrows step in day mode.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setPanelOpen(false);
        return;
      }
      if (viewMode === "day") {
        // RTL: ArrowRight goes to previous day; ArrowLeft goes to next.
        if (e.key === "ArrowRight") step(-1);
        else if (e.key === "ArrowLeft") step(1);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [viewMode, step]);

  // Apply pairing class to a chosen pairing
  const applyPairing = useCallback((id: Pairing) => {
    setCurPairing(id);
    setTypeMenuOpen(false);
  }, []);

  const typeMenu = (
    <div
      className={`menu-pop${typeMenuOpen ? " open" : ""}`}
      role="menu"
      onClick={(e) => e.stopPropagation()}
    >
      {PAIRINGS.map(([id, lbl]) => (
        <button
          key={id}
          className={curPairing === id ? "on" : ""}
          data-p={id}
          onClick={() => applyPairing(id)}
        >
          <span>{lbl}</span>
        </button>
      ))}
    </div>
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100dvh" }}>
      <div
        style={{
          flex: "1 1 auto",
          position: "relative",
          display: "flex",
          minHeight: 0,
        }}
      >
        {!isPhone && (
          <Ribbon
            trip={trip}
            viewMode={viewMode}
            dayScope={dayScope}
            activeIdx={activeIdx}
            currentRegion={currentRegion}
            open={ribbonOpen}
            onToggle={onRibbonToggle}
            onAreaClick={onAreaClick}
            onDayClick={onDayClick}
            onOverviewClick={onOverviewClick}
            onTypeOpen={onTypeOpen}
            onPrintClick={onPrintClick}
            onTimelineClick={onTimelineClick}
            onUploadClick={onUploadClick}
            todayLabel={todayLabel}
            todayPulse={todayPulse}
            typeMenuChildren={typeMenu}
            tripList={tripList}
            activeSlug={activeSlug}
            onSwitchTrip={onSwitchTrip}
          />
        )}
        <Map
          trip={trip}
          viewMode={viewMode}
          dayScope={dayScope}
          activeIdx={activeIdx}
          onDayPinClick={onDayPinClick}
          onHotelClick={onHotelClick}
          onMiniPopupClick={onMiniPopupClick}
        />
      </div>
      <DayStrip
        trip={trip}
        viewMode={viewMode}
        dayScope={dayScope}
        activeIdx={activeIdx}
        onTicketClick={onTicketClick}
        onPrev={() => step(-1)}
        onNext={() => step(1)}
        onToggleArea={onToggleArea}
        onToggleDay={onToggleDay}
        tripList={tripList}
        activeSlug={activeSlug}
        onSwitchTrip={onSwitchTrip}
      />
      <DetailPanel
        trip={trip}
        activeIdx={activeIdx}
        open={panelOpen}
        onClose={closePanel}
      />
      {!isPhone && (
        <TimelinePanel
          trip={trip}
          open={timelineOpen}
          activeIdx={activeIdx}
          onClose={closeTimeline}
          onDayClick={onTimelineDayClick}
        />
      )}
      <PrintView trip={trip} />
      {!isPhone && (
        <UploadDialog
          open={uploadOpen}
          slug={slug}
          onClose={() => setUploadOpen(false)}
          onUpdated={() => router.refresh()}
        />
      )}
    </div>
  );
}
