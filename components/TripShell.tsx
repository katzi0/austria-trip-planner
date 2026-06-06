"use client";

import { useEffect, useState } from "react";
import type { Trip } from "@/lib/trip-schema";
import TripView from "./TripView";

export interface TripShellEntry {
  slug: string;
  label: string;
  trip: Trip;
}

export interface TripShellProps {
  trips: TripShellEntry[];
  defaultSlug: string;
}

const STORAGE_KEY = "austria_trip";

export default function TripShell({ trips, defaultSlug }: TripShellProps) {
  const [activeSlug, setActiveSlug] = useState<string>(defaultSlug);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored && trips.some((t) => t.slug === stored)) {
        setActiveSlug(stored);
      }
    } catch {
      /* noop */
    }
    setHydrated(true);
  }, [trips]);

  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(STORAGE_KEY, activeSlug);
    } catch {
      /* noop */
    }
  }, [activeSlug, hydrated]);

  const active = trips.find((t) => t.slug === activeSlug) ?? trips[0];
  const tripList = trips.map((t) => ({ slug: t.slug, label: t.label }));

  return (
    <TripView
      key={active.slug}
      slug={active.slug}
      trip={active.trip}
      tripList={tripList}
      activeSlug={active.slug}
      onSwitchTrip={setActiveSlug}
    />
  );
}
