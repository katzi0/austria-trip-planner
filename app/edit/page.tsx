"use client";

import { useEffect, useState } from "react";
import type { Trip, Day, Region } from "@/lib/trip-schema";
import { TRIPS, DEFAULT_SLUG, isKnownSlug } from "@/lib/trips";

const ICON_OPTIONS = [
  "ferris",
  "cablecar",
  "coaster",
  "gem",
  "castle",
  "palace",
  "spa",
  "peak",
  "kart",
  "lake",
  "museum",
  "zoo",
  "church",
  "plane",
  "bed",
] as const;

const CARD_CLASS_OPTIONS: Day["cardClass"][] = ["free", "discount", "none", "na"];

type Status = { kind: "idle" } | { kind: "loading" } | { kind: "ok"; msg: string } | { kind: "err"; msg: string };

function emptyDay(nextN: number, baseKey: string, color: string): Day {
  return {
    n: nextN,
    d: "1.1",
    dow: "",
    base: baseKey,
    color,
    intensity: 3,
    icon: "bed",
    lat: 0,
    lng: 0,
    title: "",
    acts: [],
    drive: "",
    cardLabel: "",
    cardClass: "na",
    food: "",
    rain: "",
    tips: "",
  };
}

function emptyRegion(): Region {
  return {
    name: "בסיס חדש",
    short: "חדש",
    hex: "#1C7A52",
    hotel: "",
    lat: 0,
    lng: 0,
    icon: "bed",
  };
}

function newRegionKey(existing: string[]): string {
  let i = 1;
  while (existing.includes(`region${i}`)) i++;
  return `region${i}`;
}

function initialSlug(): string {
  if (typeof window === "undefined") return DEFAULT_SLUG;
  const q = new URLSearchParams(window.location.search).get("slug");
  return q && isKnownSlug(q) ? q : DEFAULT_SLUG;
}

export default function EditPage() {
  const [passphrase, setPassphrase] = useState("");
  const [editSlug, setEditSlug] = useState<string>(DEFAULT_SLUG);
  const [trip, setTrip] = useState<Trip | null>(null);
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const [loadErr, setLoadErr] = useState<string | null>(null);

  useEffect(() => {
    setEditSlug(initialSlug());
  }, []);

  useEffect(() => {
    let cancelled = false;
    setTrip(null);
    setLoadErr(null);
    (async () => {
      try {
        const res = await fetch(`/api/trip?slug=${encodeURIComponent(editSlug)}`, {
          cache: "no-store",
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = (await res.json()) as Trip;
        if (!cancelled) setTrip(data);
      } catch (e) {
        if (!cancelled) setLoadErr(String(e));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [editSlug]);

  function updateTrip(mut: (t: Trip) => Trip) {
    setTrip((prev) => (prev ? mut(structuredClone(prev)) : prev));
  }

  function updateRegion(key: string, mut: (r: Region) => Region) {
    updateTrip((t) => {
      const r = t.regions[key];
      if (!r) return t;
      t.regions[key] = mut(r);
      return t;
    });
  }

  function updateDay(idx: number, mut: (d: Day) => Day) {
    updateTrip((t) => {
      const d = t.days[idx];
      if (!d) return t;
      t.days[idx] = mut(d);
      return t;
    });
  }

  function addDay() {
    updateTrip((t) => {
      const nextN = t.days.length ? Math.max(...t.days.map((d) => d.n)) + 1 : 1;
      const firstBase = t.baseOrder[0] ?? "moxy";
      const color = t.regions[firstBase]?.hex ?? "#1C7A52";
      t.days.push(emptyDay(nextN, firstBase, color));
      return t;
    });
  }

  function deleteDay(idx: number) {
    updateTrip((t) => {
      t.days.splice(idx, 1);
      return t;
    });
  }

  function addRegion() {
    updateTrip((t) => {
      const key = newRegionKey(Object.keys(t.regions));
      t.regions[key] = emptyRegion();
      t.baseOrder.push(key);
      return t;
    });
  }

  function deleteRegion(key: string) {
    if (!trip) return;
    const usedBy = trip.days.filter((d) => d.base === key).length;
    if (usedBy > 0) {
      const ok = confirm(`הבסיס "${trip.regions[key]?.name ?? key}" משמש ב-${usedBy} ימים. למחוק בכל זאת?`);
      if (!ok) return;
    }
    updateTrip((t) => {
      delete t.regions[key];
      t.baseOrder = t.baseOrder.filter((k) => k !== key);
      return t;
    });
  }

  async function save() {
    if (!trip) return;
    setStatus({ kind: "loading" });
    try {
      const res = await fetch("/api/trip", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ passphrase, trip, slug: editSlug }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string; ok?: boolean };
      if (!res.ok) {
        setStatus({ kind: "err", msg: data.error ?? `שגיאה (${res.status})` });
        return;
      }
      setStatus({ kind: "ok", msg: "נשמר ✓" });
    } catch (e) {
      setStatus({ kind: "err", msg: String(e) });
    }
  }

  if (loadErr) {
    return (
      <div className="edit-wrap">
        <h1>עריכת הטיול</h1>
        <div className="edit-msg error">שגיאה בטעינה: {loadErr}</div>
      </div>
    );
  }

  if (!trip) {
    return (
      <div className="edit-wrap">
        <h1>עריכת הטיול</h1>
        <div className="edit-msg">טוען…</div>
      </div>
    );
  }

  const regionKeys = Object.keys(trip.regions);

  return (
    <div className="edit-wrap">
      <h1>עריכת הטיול</h1>

      <div className="edit-card">
        <div className="edit-row">
          <div className="edit-field" style={{ minWidth: 200 }}>
            <label htmlFor="trip-select">טיול</label>
            <select
              id="trip-select"
              value={editSlug}
              onChange={(e) => setEditSlug(e.target.value)}
            >
              {TRIPS.map((t) => (
                <option key={t.slug} value={t.slug}>{t.label}</option>
              ))}
            </select>
          </div>
          <div className="edit-field" style={{ flex: 1, minWidth: 240 }}>
            <label htmlFor="passphrase">סיסמת עריכה</label>
            <input
              id="passphrase"
              type="password"
              value={passphrase}
              onChange={(e) => setPassphrase(e.target.value)}
              placeholder="EDIT_PASSPHRASE"
              autoComplete="off"
            />
          </div>
          <button className="edit-btn" onClick={save} disabled={status.kind === "loading"}>
            {status.kind === "loading" ? "שומר…" : "שמור"}
          </button>
          {status.kind === "ok" && <span className="edit-msg">{status.msg}</span>}
          {status.kind === "err" && <span className="edit-msg error">{status.msg}</span>}
        </div>
      </div>

      <section>
        <div className="edit-row" style={{ marginBottom: 10 }}>
          <h2 style={{ fontFamily: "var(--serif)", margin: 0, fontSize: 20 }}>בסיסים</h2>
          <button className="edit-btn secondary" onClick={addRegion}>+ הוסף בסיס</button>
        </div>
        {regionKeys.map((key) => {
          const r = trip.regions[key];
          return (
            <div className="edit-card" key={key} style={{ marginBottom: 12 }}>
              <div className="edit-row" style={{ justifyContent: "space-between", marginBottom: 8 }}>
                <h3>בסיס: {key}</h3>
                <button className="edit-btn danger" onClick={() => deleteRegion(key)}>מחק</button>
              </div>
              <div className="edit-grid">
                <label className="edit-field">
                  שם מלא
                  <input
                    type="text"
                    value={r.name}
                    onChange={(e) => updateRegion(key, (x) => ({ ...x, name: e.target.value }))}
                  />
                </label>
                <label className="edit-field">
                  שם קצר
                  <input
                    type="text"
                    value={r.short}
                    onChange={(e) => updateRegion(key, (x) => ({ ...x, short: e.target.value }))}
                  />
                </label>
                <label className="edit-field">
                  מלון
                  <input
                    type="text"
                    value={r.hotel}
                    onChange={(e) => updateRegion(key, (x) => ({ ...x, hotel: e.target.value }))}
                  />
                </label>
                <label className="edit-field">
                  עיר
                  <input
                    type="text"
                    value={r.town ?? ""}
                    onChange={(e) =>
                      updateRegion(key, (x) => ({
                        ...x,
                        town: e.target.value === "" ? undefined : e.target.value,
                      }))
                    }
                  />
                </label>
                <label className="edit-field">
                  צבע (hex)
                  <input
                    type="color"
                    value={r.hex}
                    onChange={(e) => updateRegion(key, (x) => ({ ...x, hex: e.target.value }))}
                  />
                </label>
                <label className="edit-field">
                  קו רוחב (lat)
                  <input
                    type="number"
                    step="0.0001"
                    value={r.lat}
                    onChange={(e) => updateRegion(key, (x) => ({ ...x, lat: Number(e.target.value) }))}
                  />
                </label>
                <label className="edit-field">
                  קו אורך (lng)
                  <input
                    type="number"
                    step="0.0001"
                    value={r.lng}
                    onChange={(e) => updateRegion(key, (x) => ({ ...x, lng: Number(e.target.value) }))}
                  />
                </label>
                <label className="edit-field">
                  אייקון
                  <select
                    value={r.icon}
                    onChange={(e) => updateRegion(key, (x) => ({ ...x, icon: e.target.value }))}
                  >
                    {ICON_OPTIONS.map((ic) => (
                      <option key={ic} value={ic}>{ic}</option>
                    ))}
                  </select>
                </label>
              </div>
            </div>
          );
        })}
      </section>

      <section>
        <div className="edit-row" style={{ marginBottom: 10 }}>
          <h2 style={{ fontFamily: "var(--serif)", margin: 0, fontSize: 20 }}>ימים</h2>
          <button className="edit-btn secondary" onClick={addDay}>+ הוסף יום</button>
        </div>
        {trip.days.map((d, idx) => (
          <div className="edit-card" key={idx} style={{ marginBottom: 12 }}>
            <div className="edit-row" style={{ justifyContent: "space-between", marginBottom: 8 }}>
              <h3>יום {d.n} · {d.d} ({d.dow})</h3>
              <button className="edit-btn danger" onClick={() => deleteDay(idx)}>מחק</button>
            </div>
            <div className="edit-grid">
              <label className="edit-field">
                מספר יום (n)
                <input
                  type="number"
                  value={d.n}
                  onChange={(e) => updateDay(idx, (x) => ({ ...x, n: Number(e.target.value) }))}
                />
              </label>
              <label className="edit-field">
                תאריך (dd.m)
                <input
                  type="text"
                  value={d.d}
                  onChange={(e) => updateDay(idx, (x) => ({ ...x, d: e.target.value }))}
                />
              </label>
              <label className="edit-field">
                יום בשבוע
                <input
                  type="text"
                  value={d.dow}
                  onChange={(e) => updateDay(idx, (x) => ({ ...x, dow: e.target.value }))}
                />
              </label>
              <label className="edit-field">
                בסיס
                <select
                  value={d.base}
                  onChange={(e) => updateDay(idx, (x) => ({ ...x, base: e.target.value }))}
                >
                  {regionKeys.map((rk) => (
                    <option key={rk} value={rk}>{rk}</option>
                  ))}
                </select>
              </label>
              <label className="edit-field">
                צבע
                <input
                  type="color"
                  value={d.color}
                  onChange={(e) => updateDay(idx, (x) => ({ ...x, color: e.target.value }))}
                />
              </label>
              <label className="edit-field">
                עומס (1–5): {d.intensity}
                <input
                  type="range"
                  min={1}
                  max={5}
                  value={d.intensity}
                  onChange={(e) => updateDay(idx, (x) => ({ ...x, intensity: Number(e.target.value) }))}
                />
              </label>
              <label className="edit-field">
                אייקון
                <select
                  value={d.icon}
                  onChange={(e) => updateDay(idx, (x) => ({ ...x, icon: e.target.value }))}
                >
                  {ICON_OPTIONS.map((ic) => (
                    <option key={ic} value={ic}>{ic}</option>
                  ))}
                </select>
              </label>
              <label className="edit-field">
                קו רוחב (lat)
                <input
                  type="number"
                  step="0.0001"
                  value={d.lat}
                  onChange={(e) => updateDay(idx, (x) => ({ ...x, lat: Number(e.target.value) }))}
                />
              </label>
              <label className="edit-field">
                קו אורך (lng)
                <input
                  type="number"
                  step="0.0001"
                  value={d.lng}
                  onChange={(e) => updateDay(idx, (x) => ({ ...x, lng: Number(e.target.value) }))}
                />
              </label>
              <label className="edit-field" style={{ gridColumn: "1 / -1" }}>
                כותרת
                <input
                  type="text"
                  value={d.title}
                  onChange={(e) => updateDay(idx, (x) => ({ ...x, title: e.target.value }))}
                />
              </label>
              <label className="edit-field" style={{ gridColumn: "1 / -1" }}>
                פעילויות (שורה לכל פעילות)
                <textarea
                  value={d.acts.join("\n")}
                  onChange={(e) =>
                    updateDay(idx, (x) => ({
                      ...x,
                      acts: e.target.value.split("\n").map((s) => s.trim()).filter(Boolean),
                    }))
                  }
                />
              </label>
              <label className="edit-field">
                נסיעה
                <input
                  type="text"
                  value={d.drive}
                  onChange={(e) => updateDay(idx, (x) => ({ ...x, drive: e.target.value }))}
                />
              </label>
              <label className="edit-field">
                תווית כרטיס
                <input
                  type="text"
                  value={d.cardLabel}
                  onChange={(e) => updateDay(idx, (x) => ({ ...x, cardLabel: e.target.value }))}
                />
              </label>
              <label className="edit-field">
                סוג כרטיס
                <select
                  value={d.cardClass}
                  onChange={(e) =>
                    updateDay(idx, (x) => ({ ...x, cardClass: e.target.value as Day["cardClass"] }))
                  }
                >
                  {CARD_CLASS_OPTIONS.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </label>
              <label className="edit-field">
                אוכל
                <input
                  type="text"
                  value={d.food}
                  onChange={(e) => updateDay(idx, (x) => ({ ...x, food: e.target.value }))}
                />
              </label>
              <label className="edit-field">
                גשם (תוכנית גיבוי)
                <input
                  type="text"
                  value={d.rain}
                  onChange={(e) => updateDay(idx, (x) => ({ ...x, rain: e.target.value }))}
                />
              </label>
              <label className="edit-field" style={{ gridColumn: "1 / -1" }}>
                טיפים
                <textarea
                  value={d.tips}
                  onChange={(e) => updateDay(idx, (x) => ({ ...x, tips: e.target.value }))}
                />
              </label>
              <label className="edit-field">
                לינה (אופציונלי)
                <input
                  type="text"
                  value={d.overnight ?? ""}
                  onChange={(e) =>
                    updateDay(idx, (x) => ({
                      ...x,
                      overnight: e.target.value === "" ? undefined : e.target.value,
                    }))
                  }
                />
              </label>
              <label className="edit-field" style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <input
                  type="checkbox"
                  checked={d.star ?? false}
                  onChange={(e) =>
                    updateDay(idx, (x) => ({ ...x, star: e.target.checked || undefined }))
                  }
                />
                כוכב (יום מיוחד)
              </label>
              <label className="edit-field" style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <input
                  type="checkbox"
                  checked={d.outlier ?? false}
                  onChange={(e) =>
                    updateDay(idx, (x) => ({ ...x, outlier: e.target.checked || undefined }))
                  }
                />
                outlier (יום חריג)
              </label>
            </div>
          </div>
        ))}
      </section>

      <div className="edit-row">
        <button className="edit-btn" onClick={save} disabled={status.kind === "loading"}>
          {status.kind === "loading" ? "שומר…" : "שמור"}
        </button>
        {status.kind === "ok" && <span className="edit-msg">{status.msg}</span>}
        {status.kind === "err" && <span className="edit-msg error">{status.msg}</span>}
      </div>
    </div>
  );
}
