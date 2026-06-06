// Generates a single self-contained HTML file that lets a non-technical editor
// (e.g. a family member, offline) edit the trip in a browser and download a
// valid TripSchema JSON. That JSON is re-imported on /edit. No network, no deps.
import type { Trip } from "./trip-schema";

const ICONS = [
  "ferris", "cablecar", "coaster", "gem", "castle", "palace", "spa", "peak",
  "kart", "lake", "museum", "zoo", "church", "plane", "car", "bed",
];
const CARD_CLASSES = ["free", "discount", "none", "na"];

export function tripToEditorHtml(
  trip: Trip,
  title = "אוסטריה 2026 — עורך הטיול",
  downloadName = "trip.json",
): string {
  // Escape "<" so an embedded "</script>" can't break out of the data island.
  const dataJson = JSON.stringify(trip).replace(/</g, "\\u003c");
  const iconsJson = JSON.stringify(ICONS);
  const cardsJson = JSON.stringify(CARD_CLASSES);
  const nameJson = JSON.stringify(downloadName);

  return `<!doctype html>
<html lang="he" dir="rtl">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title}</title>
<style>
  :root { --bg:#f5f3ee; --card:#fff; --line:#dcd6ca; --ink:#2a2722; --accent:#1C7A52; --danger:#b3331f; }
  * { box-sizing: border-box; }
  body { margin:0; font-family: system-ui, "Segoe UI", Arial, sans-serif; background:var(--bg); color:var(--ink); }
  header { position:sticky; top:0; z-index:5; background:var(--accent); color:#fff; padding:12px 16px;
    display:flex; gap:10px; align-items:center; flex-wrap:wrap; box-shadow:0 2px 8px rgba(0,0,0,.15); }
  header h1 { font-size:18px; margin:0 8px 0 0; }
  .wrap { max-width:1000px; margin:0 auto; padding:16px; }
  h2 { font-size:20px; margin:24px 0 10px; }
  .card { background:var(--card); border:1px solid var(--line); border-radius:10px; padding:14px; margin-bottom:12px; }
  .card-head { display:flex; justify-content:space-between; align-items:center; margin-bottom:10px; }
  .card-head h3 { margin:0; font-size:15px; }
  .grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(200px,1fr)); gap:10px; }
  label { display:flex; flex-direction:column; font-size:12px; gap:4px; color:#5a554c; }
  label.full { grid-column:1 / -1; }
  label.row { flex-direction:row; align-items:center; gap:8px; }
  input, select, textarea { font:inherit; font-size:14px; padding:7px 9px; border:1px solid var(--line);
    border-radius:7px; background:#fff; color:var(--ink); width:100%; }
  textarea { min-height:64px; resize:vertical; }
  input[type=color] { padding:2px; height:34px; }
  input[type=checkbox] { width:auto; }
  button { font:inherit; font-weight:600; padding:8px 14px; border-radius:8px; border:1px solid transparent; cursor:pointer; }
  .btn { background:#fff; color:var(--accent); border-color:#fff; }
  .btn.add { background:rgba(255,255,255,.15); color:#fff; border:1px solid rgba(255,255,255,.5); }
  .btn.del { background:transparent; color:var(--danger); border-color:var(--danger); padding:5px 10px; font-size:12px; }
  .btn.add-inline { background:#eef5f0; color:var(--accent); border:1px dashed var(--accent); }
  .note { font-size:13px; opacity:.9; }
  .spacer { flex:1; }
  #status { font-size:13px; }
  .attr-block { grid-column:1 / -1; margin-top:6px; border-top:1px dashed var(--line); padding-top:10px; }
  .attr-block > .attr-lbl { display:flex; justify-content:space-between; align-items:center;
    font-weight:700; font-size:13px; color:var(--ink); margin-bottom:8px; }
  .attr-item { border:1px solid var(--line); border-radius:10px; padding:11px; margin-bottom:9px; background:#fbfaf6; }
  .attr-item .card-head { margin-bottom:8px; }
  .attr-item .card-head b { font-size:13px; }
  .btn.add-sm { background:#eef5f0; color:var(--accent); border:1px dashed var(--accent); font-size:12px; padding:5px 11px; }
</style>
</head>
<body>
<header>
  <h1>${title}</h1>
  <span class="note">עריכה מקומית · ללא חיבור לאינטרנט</span>
  <span class="spacer"></span>
  <span id="status"></span>
  <button class="btn" id="download">⬇ הורד טיול מעודכן (JSON)</button>
</header>
<div class="wrap">
  <p class="note">ערכו את השדות, ואז לחצו "הורד טיול מעודכן". שלחו את קובץ ה-JSON חזרה — הוא נטען חזרה במסך העריכה (/edit) דרך כפתור "ייבוא".</p>

  <h2>בסיסים (מלונות/אזורים)</h2>
  <div id="bases"></div>
  <button class="btn add-inline" id="add-base">+ הוסף בסיס</button>

  <h2>ימים</h2>
  <div id="days"></div>
  <button class="btn add-inline" id="add-day">+ הוסף יום</button>
</div>

<script>
const DATA = ${dataJson};
const ICONS = ${iconsJson};
const CARD_CLASSES = ${cardsJson};
const DOWNLOAD_NAME = ${nameJson};

function el(tag, attrs={}, children=[]) {
  const n = document.createElement(tag);
  for (const k in attrs) {
    if (k === "class") n.className = attrs[k];
    else if (k === "value") n.value = attrs[k];
    else if (k === "checked") n.checked = !!attrs[k];
    else if (k === "text") n.textContent = attrs[k];
    else n.setAttribute(k, attrs[k]);
  }
  for (const c of [].concat(children)) if (c) n.appendChild(c);
  return n;
}
function field(labelText, control, opts={}) {
  const l = el("label", { class: opts.full ? "full" : (opts.row ? "row" : "") });
  if (opts.row) { l.appendChild(control); l.appendChild(document.createTextNode(" " + labelText)); }
  else { l.appendChild(document.createTextNode(labelText)); l.appendChild(control); }
  return l;
}
function input(f, value, type="text") {
  const i = el("input", { type, value: value ?? "" }); i.dataset.f = f; return i;
}
function selectFrom(f, value, options, labeler) {
  const s = el("select"); s.dataset.f = f;
  for (const o of options) {
    const opt = el("option", { value: o, text: labeler ? labeler(o) : o });
    if (o === value) opt.selected = true;
    s.appendChild(opt);
  }
  return s;
}
function textarea(f, value) {
  const t = el("textarea"); t.dataset.f = f; t.value = value ?? ""; return t;
}
function checkbox(f, checked) {
  const c = el("input", { type:"checkbox", checked }); c.dataset.f = f; return c;
}

function baseKeys() {
  return [...document.querySelectorAll("[data-base-card]")].map(c => c.dataset.bk);
}

function renderAttraction(a) {
  a = a || { name:"", desc:"", tips:"", parking:"", card:false };
  const item = el("div", { class:"attr-item" }); item.dataset.attrCard = "1";
  const head = el("div", { class:"card-head" }, [
    el("b", { text: "אטרקציה" }),
    el("button", { class:"btn del", text:"מחק" }),
  ]);
  head.querySelector("button").onclick = () => item.remove();
  const grid = el("div", { class:"grid" }, [
    field("שם", input("name", a.name), { full:true }),
    field("תיאור", textarea("desc", a.desc), { full:true }),
    field("טיפים", textarea("tips", a.tips), { full:true }),
    field("חניה", input("parking", a.parking)),
    field("כלול בכרטיס הקיץ", checkbox("card", a.card), { row:true }),
  ]);
  item.appendChild(head); item.appendChild(grid);
  return item;
}

function renderBase(key, r) {
  r = r || { name:"", short:"", hotel:"", town:"", hex:"#1C7A52", lat:0, lng:0, icon:"bed", attractions:[] };
  const card = el("div", { class:"card" }); card.dataset.baseCard = "1"; card.dataset.bk = key;
  const head = el("div", { class:"card-head" }, [
    el("h3", { text: "מפתח: " + key }),
    el("button", { class:"btn del", text:"מחק בסיס" }),
  ]);
  head.querySelector("button").onclick = () => { card.remove(); refreshDayBaseSelects(); };
  const grid = el("div", { class:"grid" }, [
    field("שם", input("name", r.name)),
    field("שם קצר", input("short", r.short)),
    field("מלון", input("hotel", r.hotel)),
    field("עיר", input("town", r.town || "")),
    field("צבע", input("hex", r.hex, "color")),
    field("קו רוחב", input("lat", r.lat, "number")),
    field("קו אורך", input("lng", r.lng, "number")),
    field("אייקון", selectFrom("icon", r.icon, ICONS)),
  ]);

  // Area attractions (nested → area is implicit)
  const attrBlock = el("div", { class:"attr-block" });
  const attrList = el("div", {}); attrList.dataset.attrList = "1";
  for (const a of (r.attractions || [])) attrList.appendChild(renderAttraction(a));
  const addBtn = el("button", { class:"btn add-sm", text:"+ הוסף אטרקציה" });
  addBtn.onclick = () => attrList.appendChild(renderAttraction(null));
  attrBlock.appendChild(el("div", { class:"attr-lbl" }, [
    el("span", { text:"אטרקציות באזור" }), addBtn,
  ]));
  attrBlock.appendChild(attrList);
  grid.appendChild(attrBlock);

  card.appendChild(head); card.appendChild(grid);
  return card;
}

function renderDay(d) {
  d = d || { n:0, d:"", dow:"", base:baseKeys()[0]||"", color:"#1C7A52", intensity:3, icon:"bed",
    lat:0, lng:0, title:"", acts:[], drive:"", cardLabel:"", cardClass:"na", food:"", rain:"", tips:"" };
  const card = el("div", { class:"card" }); card.dataset.dayCard = "1";
  const head = el("div", { class:"card-head" }, [
    el("h3", { text: "יום " + (d.n||"") + " · " + (d.d||"") }),
    el("button", { class:"btn del", text:"מחק יום" }),
  ]);
  head.querySelector("button").onclick = () => card.remove();
  const grid = el("div", { class:"grid" }, [
    field("מספר יום", input("n", d.n, "number")),
    field("תאריך (כטקסט, 14.7)", input("d", d.d)),
    field("יום בשבוע", input("dow", d.dow)),
    field("בסיס", selectFrom("base", d.base, baseKeys())),
    field("צבע", input("color", d.color, "color")),
    field("עומס (1-5)", input("intensity", d.intensity, "number")),
    field("אייקון", selectFrom("icon", d.icon, ICONS)),
    field("קו רוחב", input("lat", d.lat, "number")),
    field("קו אורך", input("lng", d.lng, "number")),
    field("כותרת", input("title", d.title), { full:true }),
    field("פעילויות (שורה לכל פעילות)", textarea("acts", (d.acts||[]).join("\\n")), { full:true }),
    field("נסיעה", input("drive", d.drive)),
    field("תווית כרטיס", input("cardLabel", d.cardLabel)),
    field("סוג כרטיס", selectFrom("cardClass", d.cardClass, CARD_CLASSES)),
    field("אוכל", input("food", d.food)),
    field("תוכנית גשם", input("rain", d.rain)),
    field("טיפים", textarea("tips", d.tips), { full:true }),
    field("לינה (אופציונלי)", input("overnight", d.overnight || "")),
    field("כוכב (יום מיוחד)", checkbox("star", d.star), { row:true }),
    field("חריג", checkbox("outlier", d.outlier), { row:true }),
  ]);
  card.appendChild(head); card.appendChild(grid);
  return card;
}

function refreshDayBaseSelects() {
  const keys = baseKeys();
  document.querySelectorAll("[data-day-card] select[data-f='base']").forEach(sel => {
    const cur = sel.value;
    sel.innerHTML = "";
    for (const k of keys) {
      const o = el("option", { value:k, text:k });
      if (k === cur) o.selected = true;
      sel.appendChild(o);
    }
  });
}

// Initial render
const basesEl = document.getElementById("bases");
for (const k of DATA.baseOrder) basesEl.appendChild(renderBase(k, DATA.regions[k]));
const daysEl = document.getElementById("days");
for (const d of DATA.days) daysEl.appendChild(renderDay(d));

document.getElementById("add-base").onclick = () => {
  const key = prompt("מפתח לבסיס החדש (אנגלית, ללא רווחים):", "base" + (baseKeys().length + 1));
  if (!key) return;
  basesEl.appendChild(renderBase(key.trim(), null));
  refreshDayBaseSelects();
};
document.getElementById("add-day").onclick = () => {
  daysEl.appendChild(renderDay(null));
};

function setVal(obj, elm) {
  const f = elm.dataset.f;
  if (elm.type === "checkbox") obj[f] = elm.checked;
  else if (elm.type === "number") obj[f] = elm.value === "" ? 0 : Number(elm.value);
  else obj[f] = elm.value;
}
function readCard(card) {
  const obj = {};
  card.querySelectorAll("[data-f]").forEach(elm => setVal(obj, elm));
  return obj;
}

function collect() {
  const regions = {}, baseOrder = [];
  document.querySelectorAll("[data-base-card]").forEach(card => {
    const key = card.dataset.bk;
    // Base's own fields — skip those inside nested attraction cards.
    const r = {};
    card.querySelectorAll("[data-f]").forEach(elm => {
      if (elm.closest("[data-attr-card]")) return;
      setVal(r, elm);
    });
    baseOrder.push(key);
    regions[key] = { name:r.name||"", short:r.short||"", hotel:r.hotel||"",
      hex:r.hex||"#000000", lat:Number(r.lat)||0, lng:Number(r.lng)||0, icon:r.icon||"bed" };
    if (r.town) regions[key].town = r.town;
    // Area attractions.
    const attractions = [];
    card.querySelectorAll("[data-attr-card]").forEach(ai => {
      const a = {};
      ai.querySelectorAll("[data-f]").forEach(elm => setVal(a, elm));
      const name = (a.name || "").trim();
      if (!name) return;
      const obj = { name };
      if (a.desc && a.desc.trim()) obj.desc = a.desc.trim();
      if (a.tips && a.tips.trim()) obj.tips = a.tips.trim();
      if (a.parking && a.parking.trim()) obj.parking = a.parking.trim();
      if (a.card) obj.card = true;
      attractions.push(obj);
    });
    if (attractions.length) regions[key].attractions = attractions;
  });
  const days = [];
  document.querySelectorAll("[data-day-card]").forEach(card => {
    const r = readCard(card);
    const day = { n:Number(r.n)||0, d:String(r.d||""), dow:r.dow||"", base:r.base||"",
      color:r.color||"#000000", intensity:Number(r.intensity)||1, icon:r.icon||"bed",
      lat:Number(r.lat)||0, lng:Number(r.lng)||0, title:r.title||"",
      acts:String(r.acts||"").split(/\\r?\\n/).map(s=>s.trim()).filter(Boolean),
      drive:r.drive||"", cardLabel:r.cardLabel||"", cardClass:r.cardClass||"na",
      food:r.food||"", rain:r.rain||"", tips:r.tips||"" };
    if (r.star) day.star = true;
    if (r.outlier) day.outlier = true;
    if (r.overnight) day.overnight = r.overnight;
    days.push(day);
  });
  return { baseOrder, regions, days };
}

document.getElementById("download").onclick = () => {
  const trip = collect();
  const blob = new Blob([JSON.stringify(trip, null, 2)], { type:"application/json" });
  const url = URL.createObjectURL(blob);
  const a = el("a", { href:url, download:DOWNLOAD_NAME });
  document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(url);
  const s = document.getElementById("status");
  s.textContent = "נשמר קובץ ✓ (" + trip.days.length + " ימים)";
  setTimeout(() => { s.textContent = ""; }, 4000);
};
</script>
</body>
</html>`;
}
