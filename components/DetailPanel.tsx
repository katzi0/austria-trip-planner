"use client";

import { useEffect, useState } from "react";
import type { Trip, Day, Activity } from "@/lib/trip-schema";
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

// Local copies (kept in sync with app/edit/page.tsx; small enough not to share for a POC).
const ICON_OPTIONS = [
  "ferris", "cablecar", "coaster", "gem", "castle", "palace", "spa", "peak",
  "kart", "lake", "museum", "zoo", "church", "plane", "bed",
];
const CARD_CLASS_OPTIONS: Day["cardClass"][] = ["free", "discount", "none", "na"];

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
  slug,
}: DetailPanelProps) {
  const isPhone = useIsPhone();

  // --- edit mode: one editable `draft` Day shared by manual edits and the AI ---
  const [editOpen, setEditOpen] = useState(false);
  const [passphrase, setPassphrase] = useState("");
  const [prompt, setPrompt] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [draft, setDraft] = useState<Day | null>(null);

  const d = activeIdx >= 0 ? trip.days[activeIdx] : null;
  const r = d ? trip.regions[d.base] : null;
  const showOpen = open && d && r;
  const editing = editOpen && !!draft;

  // Switching days discards any unsaved draft (activeIdx is parent-driven).
  useEffect(() => {
    setEditOpen(false);
    setPrompt("");
    setMsg(null);
    setDraft(null);
  }, [activeIdx]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  function toggleEdit() {
    if (editOpen) {
      setDraft(null);
      setEditOpen(false);
      setMsg(null);
    } else {
      if (d) setDraft(structuredClone(d));
      setEditOpen(true);
      setMsg(null);
    }
  }

  function updateDraft(mut: (d: Day) => Day) {
    setDraft((prev) => (prev ? mut(structuredClone(prev)) : prev));
  }
  function updateAct(ai: number, mut: (a: Activity) => Activity) {
    updateDraft((dd) => {
      const acts = dd.acts.slice();
      if (!acts[ai]) return dd;
      acts[ai] = mut({ ...acts[ai] });
      return { ...dd, acts };
    });
  }
  function addAct() {
    updateDraft((dd) => ({ ...dd, acts: [...dd.acts, { name: "" } as Activity] }));
  }
  function deleteAct(ai: number) {
    updateDraft((dd) => ({ ...dd, acts: dd.acts.filter((_, i) => i !== ai) }));
  }
  // Reorder an activity. Order drives leg distances, so legMin is left stale until
  // "חשב מחדש" is pressed (the hint covers it).
  function moveAct(ai: number, dir: -1 | 1) {
    updateDraft((dd) => {
      const j = ai + dir;
      if (j < 0 || j >= dd.acts.length) return dd;
      const acts = dd.acts.slice();
      [acts[ai], acts[j]] = [acts[j], acts[ai]];
      return { ...dd, acts };
    });
  }

  async function runAi(mode: "day" | "acts") {
    if (!d || !r || !draft || !prompt.trim()) return;
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
          // Send the live draft so the model sees pending manual edits.
          day: {
            title: draft.title,
            desc: draft.desc,
            intensity: draft.intensity,
            drive: draft.drive,
            cardClass: draft.cardClass,
            cardLabel: draft.cardLabel,
            food: draft.food,
            tips: draft.tips,
            rain: draft.rain,
            overnight: draft.overnight,
            icon: draft.icon,
            star: draft.star,
            acts: draft.acts.map((a) => ({ name: a.name, lat: a.lat, lng: a.lng })),
          },
        }),
      });
      const data = (await res.json().catch(() => ({}))) as Partial<Day> & {
        acts?: Activity[];
        error?: string;
      };
      if (!res.ok) {
        setMsg(data.error ?? `שגיאה (${res.status})`);
        return;
      }
      updateDraft((cur) => {
        const next = { ...cur };
        if (mode === "day") {
          if (data.title != null) next.title = data.title;
          if (data.desc != null) next.desc = data.desc;
          if (data.intensity != null) next.intensity = data.intensity;
          if (data.drive != null) next.drive = data.drive;
          if (data.cardLabel != null) next.cardLabel = data.cardLabel;
          if (data.food != null) next.food = data.food;
          if (data.tips != null) next.tips = data.tips;
          if (data.rain != null) next.rain = data.rain;
          if (data.overnight != null) next.overnight = data.overnight;
          if (data.star != null) next.star = data.star;
          // Clamp model-provided enum/icon values to known options.
          if (data.cardClass && CARD_CLASS_OPTIONS.includes(data.cardClass as Day["cardClass"])) {
            next.cardClass = data.cardClass as Day["cardClass"];
          }
          if (data.icon && ICON_OPTIONS.includes(data.icon)) next.icon = data.icon;
        }
        if (Array.isArray(data.acts)) next.acts = data.acts;
        return next;
      });
      setMsg("הטיוטה עודכנה לפי ה-AI — בדקו ושִמרו");
    } catch (e) {
      setMsg(String(e));
    } finally {
      setBusy(false);
    }
  }

  // Recompute activity coordinates + driving minutes for the current draft (geo mode,
  // no plan change). The LLM only adds a German/English search string so geocoding works.
  async function recompute() {
    if (!r || !draft) return;
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/ai/day", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          passphrase,
          mode: "geo",
          regionName: r.name,
          near: { lat: r.lat, lng: r.lng },
          day: { acts: draft.acts.map((a) => ({ name: a.name, lat: a.lat, lng: a.lng })) },
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { acts?: Activity[]; error?: string };
      if (!res.ok) {
        setMsg(data.error ?? `שגיאה (${res.status})`);
        return;
      }
      if (Array.isArray(data.acts)) {
        const newActs = data.acts;
        updateDraft((cur) => ({ ...cur, acts: newActs }));
        const missing = newActs.filter((a) => typeof a.lat !== "number").length;
        setMsg(missing ? `עודכן. ${missing} מקומות לא אותרו` : "קואורדינטות וזמני נסיעה עודכנו");
      }
    } catch (e) {
      setMsg(String(e));
    } finally {
      setBusy(false);
    }
  }

  async function saveDraft() {
    if (!d || !draft) return;
    // Required non-empty strings (DaySchema requires them).
    const required: [keyof Day, string][] = [
      ["title", "כותרת"],
      ["drive", "נסיעה"],
      ["cardLabel", "תווית כרטיס"],
      ["food", "אוכל"],
      ["tips", "טיפ"],
    ];
    for (const [key, label] of required) {
      if (!String(draft[key] ?? "").trim()) {
        setMsg(`יש למלא: ${label}`);
        return;
      }
    }
    setBusy(true);
    setMsg(null);
    try {
      const cleaned: Day = {
        ...draft,
        rain: draft.rain?.trim() ? draft.rain : "—",
        acts: draft.acts.filter((a) => a.name.trim()),
      };
      const next = structuredClone(trip);
      next.days[activeIdx] = cleaned;
      // Anchor the day pin on the first mapped activity if it has none yet.
      if (!cleaned.lat || cleaned.lat === 0) {
        const first = cleaned.acts.find((a) => typeof a.lat === "number" && a.lat !== 0);
        if (first) {
          next.days[activeIdx].lat = first.lat!;
          next.days[activeIdx].lng = first.lng!;
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

  // Body shared between panel and sheet. View = the draft while editing, else the day.
  const body = (() => {
    if (!d || !r) return null;
    const view: Day = editing && draft ? draft : d;
    return (
      <>
        <div className="pnl-band">
          <span className="pnl-gl">
            <Icon name={view.icon} size={20} />
          </span>
          <div className="pnl-when">
            <div className="pnl-day">
              יום {d.n}
              {view.star ? " ★" : ""}
            </div>
            <div className="pnl-date">
              <Lat>{d.d}</Lat> · {d.dow}
            </div>
          </div>
          <button className="pnl-x" aria-label="סגירה" onClick={onClose}>
            ×
          </button>
        </div>
        <div className="pnl-body">
          {!editing && (
            <button
              className="edit-btn secondary"
              style={{ marginBottom: 12 }}
              onClick={toggleEdit}
            >
              ✨ ערוך יום
            </button>
          )}

          {editing && (
            <label className="edit-field" style={{ marginBottom: 10 }}>
              כותרת
              <input
                type="text"
                value={view.title}
                onChange={(e) => updateDraft((x) => ({ ...x, title: e.target.value }))}
              />
            </label>
          )}

          <div className="pnl-area">
            <Icon name={r.icon} size={14} />
            <span>
              {r.name} · <Lat>{r.hotel}</Lat>
            </span>
          </div>

          {editing ? (
            <div className="pnl-edit-acts" style={{ marginBottom: 4 }}>
              <label className="edit-field">
                עומס (1–5): {BUSY[view.intensity]}
                <input
                  type="range"
                  min={1}
                  max={5}
                  value={view.intensity}
                  onChange={(e) => updateDraft((x) => ({ ...x, intensity: Number(e.target.value) }))}
                />
              </label>
              <label className="edit-field">
                נסיעה
                <input
                  type="text"
                  value={view.drive}
                  onChange={(e) => updateDraft((x) => ({ ...x, drive: e.target.value }))}
                />
              </label>
              <label className="edit-field">
                סוג כרטיס
                <select
                  value={view.cardClass}
                  onChange={(e) =>
                    updateDraft((x) => ({ ...x, cardClass: e.target.value as Day["cardClass"] }))
                  }
                >
                  {CARD_CLASS_OPTIONS.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </label>
              <label className="edit-field">
                תווית כרטיס
                <input
                  type="text"
                  value={view.cardLabel}
                  onChange={(e) => updateDraft((x) => ({ ...x, cardLabel: e.target.value }))}
                />
              </label>
              <label className="edit-field">
                אייקון
                <select
                  value={view.icon}
                  onChange={(e) => updateDraft((x) => ({ ...x, icon: e.target.value }))}
                >
                  {ICON_OPTIONS.map((ic) => (
                    <option key={ic} value={ic}>
                      {ic}
                    </option>
                  ))}
                </select>
              </label>
              <label
                className="edit-field"
                style={{ flexDirection: "row", alignItems: "center", gap: 8 }}
              >
                <input
                  type="checkbox"
                  checked={view.star ?? false}
                  onChange={(e) => updateDraft((x) => ({ ...x, star: e.target.checked || undefined }))}
                />
                כוכב (יום מיוחד)
              </label>
            </div>
          ) : (
            <div className="pnl-facts">
              <span className="chip busylab">
                <Ridge intensity={view.intensity} />
                {BUSY[view.intensity]}
              </span>
              <span className={`chip ${view.cardClass}`}>
                {view.cardClass === "free" ? (
                  <Icon name="star" size={13} />
                ) : (
                  <Icon name="car" size={13} />
                )}
                {view.cardLabel}
              </span>
              <span className="chip">
                <Icon name="car" size={13} />
                {view.drive}
              </span>
            </div>
          )}

          {editing ? (
            <section className="pnl-sec">
              <h4>תיאור</h4>
              <label className="edit-field">
                <textarea
                  value={view.desc ?? ""}
                  rows={3}
                  placeholder="תיאור חופשי של היום"
                  onChange={(e) => updateDraft((x) => ({ ...x, desc: e.target.value || undefined }))}
                />
              </label>
            </section>
          ) : (
            view.desc && (
              <section className="pnl-sec">
                <h4>תיאור</h4>
                <p>{view.desc}</p>
              </section>
            )
          )}

          <section className="pnl-sec pnl-agenda">
            <h4>תוכנית היום</h4>
            {editing ? (
              <>
                <div className="pnl-edit-acts">
                  {view.acts.map((a, i) => (
                    <div className="pnl-edit-act" key={i}>
                      <label className="edit-field">
                        פעילות {i + 1}
                        <input
                          type="text"
                          value={a.name}
                          onChange={(e) => updateAct(i, (x) => ({ ...x, name: e.target.value }))}
                        />
                      </label>
                      <div className="pnl-edit-act-ctrls">
                        {typeof a.legMin === "number" && (
                          <span className="pnl-step-pin" title="זמן נסיעה מהעצירה הקודמת">
                            <Icon name="car" size={11} /> {a.legMin} דק׳
                          </span>
                        )}
                        <button
                          className="edit-btn secondary"
                          onClick={() => moveAct(i, -1)}
                          disabled={i === 0}
                          aria-label="הזז למעלה"
                          title="הזז למעלה"
                        >
                          ↑
                        </button>
                        <button
                          className="edit-btn secondary"
                          onClick={() => moveAct(i, 1)}
                          disabled={i === view.acts.length - 1}
                          aria-label="הזז למטה"
                          title="הזז למטה"
                        >
                          ↓
                        </button>
                        <button className="edit-btn danger" onClick={() => deleteAct(i)}>
                          מחק
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="pnl-edit-actions">
                  <button className="edit-btn secondary" onClick={addAct} disabled={busy}>
                    + הוסף פעילות
                  </button>
                  <button
                    className="edit-btn"
                    onClick={recompute}
                    disabled={busy || !view.acts.length}
                  >
                    {busy ? "…" : "חשב מחדש"}
                  </button>
                </div>
                <div className="pnl-edit-hint">
                  לחצו &quot;חשב מחדש&quot; לעדכון קואורדינטות וזמני הנסיעה בין הפעילויות
                </div>
              </>
            ) : (
              <ol className="pnl-acts">
                {view.acts.map((a, i) => (
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
            )}
          </section>

          {/* Region attractions are region-scoped — read-only here; edit in /edit. */}
          {r.attractions && r.attractions.length > 0 && (
            <section className="pnl-sec">
              <h4>אטרקציות באזור</h4>
              <div className="pnl-attractions">
                {r.attractions.map((a, i) => (
                  <div className="attr" key={i}>
                    <div className="attr-top">
                      <span className="attr-name">{a.name}</span>
                      {typeof a.legMin === "number" && (
                        <span className="pnl-step-pin" title="זמן נסיעה מהאטרקציה הקודמת">
                          <Icon name="car" size={11} /> {a.legMin} דק׳
                        </span>
                      )}
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
            {editing ? (
              <label className="edit-field">
                <input
                  type="text"
                  value={view.food}
                  onChange={(e) => updateDraft((x) => ({ ...x, food: e.target.value }))}
                />
              </label>
            ) : (
              <p>{view.food}</p>
            )}
          </section>

          <section className="pnl-sec">
            <h4>טיפ</h4>
            {editing ? (
              <label className="edit-field">
                <textarea
                  value={view.tips}
                  rows={3}
                  onChange={(e) => updateDraft((x) => ({ ...x, tips: e.target.value }))}
                />
              </label>
            ) : (
              <p>{view.tips}</p>
            )}
          </section>

          {editing ? (
            <section className="pnl-sec">
              <h4>תוכנית גשם</h4>
              <label className="edit-field">
                <input
                  type="text"
                  value={view.rain}
                  onChange={(e) => updateDraft((x) => ({ ...x, rain: e.target.value }))}
                />
              </label>
            </section>
          ) : (
            view.rain &&
            view.rain !== "—" && (
              <section className="pnl-sec">
                <div className="planb">
                  <Icon name="rain" size={16} />
                  <div>
                    <b>תוכנית גשם</b>
                    {view.rain}
                  </div>
                </div>
              </section>
            )
          )}

          {editing ? (
            <section className="pnl-sec">
              <h4>לינה</h4>
              <label className="edit-field">
                <input
                  type="text"
                  value={view.overnight ?? ""}
                  onChange={(e) =>
                    updateDraft((x) => ({ ...x, overnight: e.target.value || undefined }))
                  }
                />
              </label>
            </section>
          ) : (
            view.overnight && (
              <section className="pnl-sec">
                <div className="overnote">
                  <Icon name="bed" size={14} />
                  {view.overnight}
                </div>
              </section>
            )
          )}

          {editing && (
            <section className="pnl-sec pnl-edit">
              <div className="pnl-edit-hint" style={{ marginBottom: 8 }}>
                ערכו שדות ישירות למעלה, או בקשו מ-AI לשנות את היום:
              </div>
              <div className="pnl-edit-box">
                <input
                  type="password"
                  placeholder="סיסמת עריכה"
                  value={passphrase}
                  onChange={(e) => setPassphrase(e.target.value)}
                  autoComplete="off"
                />
                <textarea
                  placeholder="בקשת שינוי ל-AI (למשל: הוסיפי ארוחת צהריים ליד האגם)"
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  rows={2}
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
                </div>
                <div className="pnl-edit-row">
                  <button className="edit-btn" disabled={busy} onClick={saveDraft}>
                    {busy ? "שומר…" : "שמור"}
                  </button>
                  <button className="edit-btn secondary" disabled={busy} onClick={toggleEdit}>
                    בטל
                  </button>
                </div>
                {msg && <div className="pnl-edit-msg">{msg}</div>}
              </div>
            </section>
          )}
        </div>
      </>
    );
  })();

  const dccStyle = d ? ({ ["--dcc" as string]: d.color } as React.CSSProperties) : undefined;

  return (
    <>
      <div className={`scrim${showOpen ? " show" : ""}`} onClick={onClose} />
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
