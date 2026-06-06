"use client";

import { useEffect, useState } from "react";
import type { Trip, Activity } from "@/lib/trip-schema";
import { BUSY } from "@/lib/trip-schema";
import { useIsPhone } from "@/lib/use-is-phone";
import { Icon, Lat } from "./icons";

export interface DetailPanelProps {
  trip: Trip;
  activeIdx: number;
  open: boolean;
  onClose: () => void;
  slug: string;
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

// Shape returned by POST /api/ai/day.
interface AiResult {
  title?: string;
  intensity?: number;
  drive?: string;
  food?: string;
  tips?: string;
  rain?: string;
  acts: Activity[];
}

export default function DetailPanel({
  trip,
  activeIdx,
  open,
  onClose,
  slug,
}: DetailPanelProps) {
  const isPhone = useIsPhone();

  // --- POC: in-panel AI editing ---
  const [editOpen, setEditOpen] = useState(false);
  const [passphrase, setPassphrase] = useState("");
  const [prompt, setPrompt] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [result, setResult] = useState<AiResult | null>(null);

  // Reset the edit panel whenever the focused day changes.
  useEffect(() => {
    setEditOpen(false);
    setPrompt("");
    setMsg(null);
    setResult(null);
  }, [activeIdx]);

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

  async function runAi(mode: "day" | "acts") {
    if (!d || !r || !prompt.trim()) return;
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/ai/day", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          passphrase,
          mode,
          prompt,
          regionName: r.name,
          near: { lat: r.lat, lng: r.lng },
          // Send the current day so the model edits it instead of inventing one.
          day: {
            title: d.title,
            intensity: d.intensity,
            drive: d.drive,
            food: d.food,
            tips: d.tips,
            rain: d.rain,
            acts: d.acts.map((a) => ({ name: a.name, lat: a.lat, lng: a.lng })),
          },
        }),
      });
      const data = (await res.json().catch(() => ({}))) as AiResult & { error?: string };
      if (!res.ok) {
        setMsg(data.error ?? `שגיאה (${res.status})`);
        return;
      }
      setResult(data);
      setMsg("טיוטה מוכנה — בדקו ושִמרו");
    } catch (e) {
      setMsg(String(e));
    } finally {
      setBusy(false);
    }
  }

  async function saveDraft() {
    if (!d || !result) return;
    setBusy(true);
    setMsg(null);
    try {
      const next = structuredClone(trip);
      const day = next.days[activeIdx];
      if (result.title != null) day.title = result.title;
      if (result.intensity != null) day.intensity = result.intensity;
      if (result.drive != null) day.drive = result.drive;
      if (result.food != null) day.food = result.food;
      if (result.tips != null) day.tips = result.tips;
      if (result.rain != null) day.rain = result.rain;
      day.acts = result.acts;
      // If the day had no pin yet, anchor it on the first mapped activity.
      if (!day.lat || day.lat === 0) {
        const first = result.acts.find((a) => typeof a.lat === "number" && a.lat !== 0);
        if (first) {
          day.lat = first.lat!;
          day.lng = first.lng!;
        }
      }
      const res = await fetch("/api/trip", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ passphrase, trip: next, slug }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setMsg(data.error ?? `שמירה נכשלה (${res.status})`);
        return;
      }
      // Simplest POC refresh: reload so the server-rendered trip updates everywhere.
      window.location.reload();
    } catch (e) {
      setMsg(String(e));
    } finally {
      setBusy(false);
    }
  }

  // Activities to show: the AI draft if present, else the saved day's.
  const shownActs = result?.acts ?? d?.acts ?? [];

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
          <h4>תוכנית היום{result ? " (טיוטה)" : ""}</h4>
          <ol className="pnl-acts">
            {shownActs.map((a, i) => (
              <li key={i}>
                <span className="pnl-step">{i + 1}</span>
                <span className="pnl-step-text">{a.name}</span>
                {typeof a.legMin === "number" && (
                  <span className="pnl-step-pin" title="זמן נסיעה מהעצירה הקודמת">
                    <Icon name="car" size={11} /> {a.legMin} דק׳
                  </span>
                )}
                {typeof a.legMin !== "number" &&
                  typeof a.lat === "number" &&
                  a.lat !== 0 && (
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
          <p>{result?.food ?? d.food}</p>
        </section>
        <section className="pnl-sec">
          <h4>טיפ</h4>
          <p>{result?.tips ?? d.tips}</p>
        </section>
        {(result?.rain ?? d.rain) && (result?.rain ?? d.rain) !== "—" && (
          <section className="pnl-sec">
            <div className="planb">
              <Icon name="rain" size={16} />
              <div>
                <b>תוכנית גשם</b>
                {result?.rain ?? d.rain}
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

        {/* --- POC: AI editing --- */}
        <section className="pnl-sec pnl-edit">
          <button
            className="edit-btn secondary"
            onClick={() => setEditOpen((v) => !v)}
          >
            {editOpen ? "סגור עריכה" : "✨ עריכה עם AI"}
          </button>
          {editOpen && (
            <div className="pnl-edit-box">
              <input
                type="password"
                placeholder="סיסמת עריכה"
                value={passphrase}
                onChange={(e) => setPassphrase(e.target.value)}
                autoComplete="off"
              />
              <textarea
                placeholder="תארו את היום הרצוי (למשל: יום רגוע באגם עם הילדים, ארוחת צהריים בחוץ)"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                rows={3}
              />
              <div className="pnl-edit-row">
                <button
                  className="edit-btn"
                  disabled={busy || !prompt.trim()}
                  onClick={() => runAi("day")}
                >
                  {busy ? "…" : "צור יום"}
                </button>
                <button
                  className="edit-btn secondary"
                  disabled={busy || !prompt.trim()}
                  onClick={() => runAi("acts")}
                >
                  {busy ? "…" : "הצע פעילויות"}
                </button>
                {result && (
                  <button className="edit-btn" disabled={busy} onClick={saveDraft}>
                    שמור
                  </button>
                )}
                {result && (
                  <button
                    className="edit-btn secondary"
                    disabled={busy}
                    onClick={() => {
                      setResult(null);
                      setMsg(null);
                    }}
                  >
                    בטל טיוטה
                  </button>
                )}
              </div>
              {msg && <div className="pnl-edit-msg">{msg}</div>}
            </div>
          )}
        </section>
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
