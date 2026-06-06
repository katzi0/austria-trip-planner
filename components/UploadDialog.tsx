"use client";

import { useState } from "react";
import { TripSchema } from "@/lib/trip-schema";

export interface UploadDialogProps {
  open: boolean;
  slug: string;
  onClose: () => void;
  onUpdated: () => void;
}

type State =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "ok"; msg: string }
  | { kind: "err"; msg: string };

export default function UploadDialog({ open, slug, onClose, onUpdated }: UploadDialogProps) {
  const [passphrase, setPassphrase] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [state, setState] = useState<State>({ kind: "idle" });

  if (!open) return null;

  async function submit() {
    if (!file) {
      setState({ kind: "err", msg: "בחרו קובץ JSON" });
      return;
    }
    setState({ kind: "loading" });

    // Parse + validate the file before sending.
    let trip;
    try {
      const json = JSON.parse(await file.text());
      const result = TripSchema.safeParse(json);
      if (!result.success) {
        const detail = result.error.issues
          .slice(0, 3)
          .map((i) => `${i.path.join(".") || "(שורש)"}: ${i.message}`)
          .join("; ");
        setState({ kind: "err", msg: "הקובץ אינו תואם למבנה התוכנית — " + detail });
        return;
      }
      trip = result.data;
    } catch {
      setState({ kind: "err", msg: "קובץ JSON לא תקין" });
      return;
    }

    try {
      const res = await fetch("/api/trip", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ passphrase, trip, slug }),
      });
      if (res.status === 401) {
        setState({ kind: "err", msg: "סיסמה שגויה" });
        return;
      }
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        setState({ kind: "err", msg: data.error ?? `שגיאה (${res.status})` });
        return;
      }
      setState({ kind: "ok", msg: "התוכנית עודכנה ✓" });
      onUpdated();
      setTimeout(() => {
        onClose();
        setState({ kind: "idle" });
        setFile(null);
        setPassphrase("");
      }, 1200);
    } catch (e) {
      setState({ kind: "err", msg: String(e) });
    }
  }

  return (
    <div className="upload-scrim" onClick={onClose}>
      <div
        className="upload-modal"
        role="dialog"
        aria-modal="true"
        aria-label="עדכון התוכנית מקובץ"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="upload-head">
          <h3>עדכון התוכנית מקובץ</h3>
          <button className="upload-x" onClick={onClose} aria-label="סגירה">
            ×
          </button>
        </div>
        <p className="upload-note">
          בחרו את קובץ ה-JSON שירד מעורך ה-HTML, הזינו את הסיסמה ולחצו &quot;העלה ושמור&quot;.
        </p>
        <label className="upload-field">
          קובץ (JSON)
          <input
            type="file"
            accept=".json,application/json"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />
        </label>
        <label className="upload-field">
          סיסמה
          <input
            type="password"
            value={passphrase}
            onChange={(e) => setPassphrase(e.target.value)}
            autoComplete="off"
          />
        </label>
        {state.kind === "err" && <div className="upload-msg error">{state.msg}</div>}
        {state.kind === "ok" && <div className="upload-msg">{state.msg}</div>}
        <div className="upload-actions">
          <button className="edit-btn" onClick={submit} disabled={state.kind === "loading"}>
            {state.kind === "loading" ? "מעלה…" : "העלה ושמור"}
          </button>
          <button className="edit-btn secondary" onClick={onClose}>
            ביטול
          </button>
        </div>
      </div>
    </div>
  );
}
