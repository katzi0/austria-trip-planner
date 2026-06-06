// Excel round-trip for a Trip document.
//
// Export: two sheets — "ימים" (days) and "בסיסים" (bases). Bases row order
// defines baseOrder. Import parses the workbook back into a Trip and validates
// it against TripSchema, returning human-readable errors instead of throwing.
//
// SheetJS is heavy; import this module lazily (await import("@/lib/trip-xlsx")).
import * as XLSX from "xlsx";
import type { Trip, Day, Region } from "./trip-schema";
import { TripSchema } from "./trip-schema";

const DAYS_SHEET = "ימים";
const BASES_SHEET = "בסיסים";

// [field key, Hebrew column header]. Order here = column order in the sheet.
const DAY_COLS: ReadonlyArray<readonly [keyof Day, string]> = [
  ["n", "יום (מס')"],
  ["d", "תאריך (כטקסט, למשל 14.7)"],
  ["dow", "יום בשבוע"],
  ["base", "בסיס (מפתח)"],
  ["title", "כותרת"],
  ["acts", "פעילויות (שורה לכל פעילות)"],
  ["drive", "נסיעה"],
  ["intensity", "עומס (1-5)"],
  ["icon", "אייקון"],
  ["lat", "קו רוחב"],
  ["lng", "קו אורך"],
  ["color", "צבע (hex)"],
  ["cardLabel", "תווית כרטיס"],
  ["cardClass", "סוג כרטיס (free/discount/none/na)"],
  ["food", "אוכל"],
  ["rain", "תוכנית גשם"],
  ["tips", "טיפים"],
  ["star", "כוכב (כן/ריק)"],
  ["outlier", "חריג (כן/ריק)"],
  ["overnight", "לינה (אופציונלי)"],
];

const BASE_COLS: ReadonlyArray<readonly [keyof Region | "key", string]> = [
  ["key", "מפתח (לא לשנות)"],
  ["name", "שם"],
  ["short", "שם קצר"],
  ["hotel", "מלון"],
  ["town", "עיר"],
  ["hex", "צבע (hex)"],
  ["lat", "קו רוחב"],
  ["lng", "קו אורך"],
  ["icon", "אייקון"],
];

function boolOut(v: boolean | undefined): string {
  return v ? "כן" : "";
}
function boolIn(v: unknown): boolean {
  const s = String(v ?? "").trim().toLowerCase();
  return s === "כן" || s === "yes" || s === "true" || s === "1" || s === "v" || s === "✓";
}
function numIn(v: unknown): number {
  const n = Number(String(v ?? "").trim());
  return Number.isFinite(n) ? n : NaN;
}
function strIn(v: unknown): string {
  return String(v ?? "").trim();
}

// ---- Export ------------------------------------------------------------

export function tripToWorkbook(trip: Trip): XLSX.WorkBook {
  const dayHeaders = DAY_COLS.map(([, h]) => h);
  const dayRows = trip.days.map((d) => {
    const row: Record<string, string | number> = {};
    for (const [key, header] of DAY_COLS) {
      if (key === "acts") row[header] = d.acts.join("\n");
      else if (key === "star") row[header] = boolOut(d.star);
      else if (key === "outlier") row[header] = boolOut(d.outlier);
      else if (key === "overnight") row[header] = d.overnight ?? "";
      else row[header] = d[key] as string | number;
    }
    return row;
  });
  const daysWs = XLSX.utils.json_to_sheet(dayRows, { header: dayHeaders });

  const baseHeaders = BASE_COLS.map(([, h]) => h);
  const baseRows = trip.baseOrder.map((key) => {
    const r = trip.regions[key];
    const row: Record<string, string | number> = {};
    for (const [field, header] of BASE_COLS) {
      row[header] = field === "key" ? key : ((r?.[field as keyof Region] ?? "") as string | number);
    }
    return row;
  });
  const basesWs = XLSX.utils.json_to_sheet(baseRows, { header: baseHeaders });

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, daysWs, DAYS_SHEET);
  XLSX.utils.book_append_sheet(wb, basesWs, BASES_SHEET);
  return wb;
}

export function tripToXlsxBlob(trip: Trip): Blob {
  const wb = tripToWorkbook(trip);
  const out = XLSX.write(wb, { type: "array", bookType: "xlsx" }) as ArrayBuffer;
  return new Blob([out], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
}

// ---- Import ------------------------------------------------------------

export interface ImportResult {
  trip?: Trip;
  errors: string[];
}

function sheetByName(wb: XLSX.WorkBook, name: string, fallbackIdx: number): XLSX.WorkSheet | null {
  if (wb.Sheets[name]) return wb.Sheets[name];
  const byIdx = wb.SheetNames[fallbackIdx];
  return byIdx ? wb.Sheets[byIdx] : null;
}

// Map a sheet row (keyed by Hebrew headers) back to field keys.
function remap<T extends string>(
  row: Record<string, unknown>,
  cols: ReadonlyArray<readonly [T, string]>,
): Record<T, unknown> {
  const out = {} as Record<T, unknown>;
  for (const [key, header] of cols) out[key] = row[header];
  return out;
}

export function workbookToTrip(wb: XLSX.WorkBook): ImportResult {
  const daysWs = sheetByName(wb, DAYS_SHEET, 0);
  const basesWs = sheetByName(wb, BASES_SHEET, 1);
  if (!daysWs || !basesWs) {
    return { errors: [`לא נמצאו גליונות "${DAYS_SHEET}" ו-"${BASES_SHEET}" בקובץ.`] };
  }

  const dayRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(daysWs, { defval: "" });
  const baseRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(basesWs, { defval: "" });

  const baseOrder: string[] = [];
  const regions: Record<string, Region> = {};
  for (const raw of baseRows) {
    const r = remap(raw, BASE_COLS);
    const key = strIn(r.key);
    if (!key) continue;
    baseOrder.push(key);
    const town = strIn(r.town);
    regions[key] = {
      name: strIn(r.name),
      short: strIn(r.short),
      hotel: strIn(r.hotel),
      hex: strIn(r.hex),
      lat: numIn(r.lat),
      lng: numIn(r.lng),
      icon: strIn(r.icon),
      ...(town ? { town } : {}),
    };
  }

  const days: Day[] = [];
  for (const raw of dayRows) {
    const r = remap(raw, DAY_COLS);
    // Skip blank rows (no date and no title).
    if (!strIn(r.d) && !strIn(r.title)) continue;
    const day: Day = {
      n: numIn(r.n),
      d: strIn(r.d),
      dow: strIn(r.dow),
      base: strIn(r.base),
      color: strIn(r.color),
      intensity: numIn(r.intensity),
      icon: strIn(r.icon),
      lat: numIn(r.lat),
      lng: numIn(r.lng),
      title: strIn(r.title),
      acts: strIn(r.acts)
        .split(/\r?\n/)
        .map((s) => s.trim())
        .filter(Boolean),
      drive: strIn(r.drive),
      cardLabel: strIn(r.cardLabel),
      cardClass: strIn(r.cardClass) as Day["cardClass"],
      food: strIn(r.food),
      rain: strIn(r.rain),
      tips: strIn(r.tips),
    };
    if (boolIn(r.star)) day.star = true;
    if (boolIn(r.outlier)) day.outlier = true;
    const overnight = strIn(r.overnight);
    if (overnight) day.overnight = overnight;
    days.push(day);
  }

  const parsed = TripSchema.safeParse({ baseOrder, regions, days });
  if (!parsed.success) {
    const errors = parsed.error.issues.slice(0, 30).map((i) => {
      const path = i.path.join(" › ") || "(שורש)";
      return `${path}: ${i.message}`;
    });
    return { errors };
  }

  // Cross-check: every day.base must reference an existing base.
  const orphan = parsed.data.days.find((d) => !parsed.data.regions[d.base]);
  if (orphan) {
    return {
      errors: [`יום ${orphan.n} (${orphan.d}) מפנה לבסיס "${orphan.base}" שלא קיים בגליון הבסיסים.`],
    };
  }

  return { trip: parsed.data, errors: [] };
}

export async function fileToTrip(file: File): Promise<ImportResult> {
  const buf = await file.arrayBuffer();
  try {
    const wb = XLSX.read(buf, { type: "array" });
    return workbookToTrip(wb);
  } catch (e) {
    return { errors: [`כשל בקריאת קובץ האקסל: ${String(e)}`] };
  }
}
