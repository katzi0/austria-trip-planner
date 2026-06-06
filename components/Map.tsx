"use client";

import { useEffect, useRef } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import type { Feature, FeatureCollection } from "geojson";

import type { Trip, Region } from "@/lib/trip-schema";
import { iconSvg } from "@/components/icons";
import { nightsOfBase } from "@/lib/trip-utils";

export interface MapProps {
  trip: Trip;
  viewMode: "area" | "day";
  dayScope: string;
  activeIdx: number;
  onDayPinClick: (i: number) => void;
  onHotelClick: (regionKey: string) => void;
  onMiniPopupClick: (i: number) => void;
}

type LngLat = [number, number];

const MAP_STYLE =
  process.env.NEXT_PUBLIC_MAP_STYLE_URL ||
  "https://tiles.openfreemap.org/styles/liberty";
const INITIAL_CENTER: LngLat = [13.8, 47.7];
const INITIAL_ZOOM = 7;
const ROUTE_SOURCE = "day-route";
const ROUTE_GLOW_LAYER = "day-route-glow";
const ROUTE_LINE_LAYER = "day-route-line";
const BASE_ROUTE_SOURCE = "base-routes";
const BASE_ROUTE_LAYER = "base-routes-line";

function emptyLineFC(): FeatureCollection {
  return { type: "FeatureCollection", features: [] };
}

function padFor(map: maplibregl.Map): number {
  const c = map.getContainer();
  const w = c.clientWidth || 800;
  const h = c.clientHeight || 600;
  return Math.max(36, Math.min(90, Math.min(w, h) * 0.16));
}

function boundsOf(points: LngLat[]): maplibregl.LngLatBounds {
  const b = new maplibregl.LngLatBounds();
  points.forEach((p) => b.extend(p));
  return b;
}

function makePinElement(
  color: string,
  icon: string,
  dayN: number,
  date: string,
  dow: string,
  title: string,
): HTMLDivElement {
  const wrap = document.createElement("div");
  wrap.className = "pinwrap";
  wrap.title = title;
  wrap.innerHTML = `<div class="pin" style="background:${color}"><span>${iconSvg(icon, 16)}</span></div>`;
  const label = document.createElement("div");
  label.className = "pinlabel";
  const head = document.createElement("div");
  head.className = "pl-head";
  head.textContent = title;
  const sub = document.createElement("div");
  sub.className = "pl-sub";
  sub.textContent = `יום ${dayN} · ${date} · ${dow}`;
  label.appendChild(head);
  label.appendChild(sub);
  wrap.appendChild(label);
  return wrap;
}

function makeHotelElement(r: Region): HTMLDivElement {
  const wrap = document.createElement("div");
  wrap.className = "hotelwrap";
  wrap.style.setProperty("--hc", r.hex);
  wrap.title = r.hotel;
  const icon = document.createElement("div");
  icon.className = "hotel";
  icon.innerHTML = iconSvg("bed", 15);
  wrap.appendChild(icon);
  const label = document.createElement("div");
  label.className = "hotellabel";
  label.textContent = r.hotel;
  wrap.appendChild(label);
  return wrap;
}

export default function Map(props: MapProps): React.JSX.Element {
  const { trip, viewMode, dayScope, activeIdx, onDayPinClick, onHotelClick, onMiniPopupClick } = props;

  const containerRef = useRef<HTMLDivElement | null>(null);
  const labelRef = useRef<HTMLDivElement | null>(null);
  const noteRef = useRef<HTMLDivElement | null>(null);

  const mapRef = useRef<maplibregl.Map | null>(null);
  const readyRef = useRef(false);
  const dayMarkersRef = useRef<maplibregl.Marker[]>([]);
  const hotelMarkersRef = useRef<Record<string, maplibregl.Marker>>({});
  const popupRef = useRef<maplibregl.Popup | null>(null);
  const rafRef = useRef<number | null>(null);
  const resizeObsRef = useRef<ResizeObserver | null>(null);
  const tilesOkRef = useRef(false);
  const tileTimerRef = useRef<number | null>(null);

  // Latest prop callbacks via refs (so listeners always see the latest).
  const cbRef = useRef({ onDayPinClick, onHotelClick, onMiniPopupClick });
  cbRef.current = { onDayPinClick, onHotelClick, onMiniPopupClick };

  // Init map once.
  useEffect(() => {
    if (!containerRef.current) return;
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: MAP_STYLE,
      center: INITIAL_CENTER,
      zoom: INITIAL_ZOOM,
    });
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "bottom-left");
    mapRef.current = map;

    const onLoad = () => {
      readyRef.current = true;
      // Day route layers
      map.addSource(ROUTE_SOURCE, { type: "geojson", data: emptyLineFC() });
      map.addLayer({
        id: ROUTE_GLOW_LAYER,
        type: "line",
        source: ROUTE_SOURCE,
        layout: { "line-cap": "round", "line-join": "round" },
        paint: {
          "line-color": ["coalesce", ["get", "color"], "#888"],
          "line-width": 12,
          "line-opacity": 0.16,
        },
      });
      map.addLayer({
        id: ROUTE_LINE_LAYER,
        type: "line",
        source: ROUTE_SOURCE,
        layout: { "line-cap": "round", "line-join": "round" },
        paint: {
          "line-color": ["coalesce", ["get", "color"], "#888"],
          "line-width": 4.5,
          "line-opacity": 0.95,
        },
      });
      // Base hotel→day dashed routes
      map.addSource(BASE_ROUTE_SOURCE, { type: "geojson", data: emptyLineFC() });
      map.addLayer({
        id: BASE_ROUTE_LAYER,
        type: "line",
        source: BASE_ROUTE_SOURCE,
        layout: { "line-cap": "round", "line-join": "round" },
        paint: {
          "line-color": ["coalesce", ["get", "color"], "#888"],
          "line-width": 3,
          "line-opacity": 0.78,
        },
      });
      map.resize();
      // Trigger initial render.
      forceUpdate();
      // Best-effort tile load watch.
      tileTimerRef.current = window.setTimeout(() => {
        if (!tilesOkRef.current && noteRef.current) {
          noteRef.current.innerHTML = "<b>בעיית טעינה</b>לא ניתן לטעון את המפה — בדקו חיבור או הטוקן";
          noteRef.current.classList.add("show");
        }
      }, 6000);
    };

    map.on("load", onLoad);
    map.on("idle", () => {
      tilesOkRef.current = true;
      if (tileTimerRef.current !== null) {
        window.clearTimeout(tileTimerRef.current);
        tileTimerRef.current = null;
      }
    });
    map.on("error", () => {
      // Silent; the timer above handles the no-tiles fallback.
    });

    // Resize observer
    try {
      const ro = new ResizeObserver(() => {
        if (mapRef.current) mapRef.current.resize();
      });
      ro.observe(containerRef.current);
      resizeObsRef.current = ro;
    } catch {
      // ignore
    }

    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
      if (resizeObsRef.current) {
        resizeObsRef.current.disconnect();
        resizeObsRef.current = null;
      }
      if (tileTimerRef.current !== null) {
        window.clearTimeout(tileTimerRef.current);
        tileTimerRef.current = null;
      }
      if (popupRef.current) {
        popupRef.current.remove();
        popupRef.current = null;
      }
      dayMarkersRef.current.forEach((m) => m.remove());
      dayMarkersRef.current = [];
      Object.values(hotelMarkersRef.current).forEach((m) => m.remove());
      hotelMarkersRef.current = {};
      readyRef.current = false;
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // (Re)build markers whenever trip changes.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    // Clear existing markers
    dayMarkersRef.current.forEach((m) => m.remove());
    dayMarkersRef.current = [];
    Object.values(hotelMarkersRef.current).forEach((m) => m.remove());
    hotelMarkersRef.current = {};

    trip.days.forEach((day, i) => {
      const el = makePinElement(day.color, day.icon, day.n, day.d, day.dow, day.title);
      el.addEventListener("click", (e) => {
        e.stopPropagation();
        cbRef.current.onDayPinClick(i);
      });
      const marker = new maplibregl.Marker({ element: el, anchor: "bottom" })
        .setLngLat([day.lng, day.lat])
        .addTo(map);
      dayMarkersRef.current.push(marker);
    });

    Object.entries(trip.regions).forEach(([key, r]) => {
      const el = makeHotelElement(r);
      el.addEventListener("click", (e) => {
        e.stopPropagation();
        cbRef.current.onHotelClick(key);
      });
      const marker = new maplibregl.Marker({ element: el, anchor: "center" })
        .setLngLat([r.lng, r.lat])
        .addTo(map);
      hotelMarkersRef.current[key] = marker;
    });

    if (readyRef.current) forceUpdate();
  }, [trip]);

  // Force an update whenever view inputs change.
  useEffect(() => {
    forceUpdate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewMode, dayScope, activeIdx, trip]);

  function forceUpdate() {
    applyPinStates();
    applyBaseRoutes();
    applyDayRoute();
    applyCamera();
    applyMiniPopup();
    applyLabel();
  }

  function applyPinStates() {
    trip.days.forEach((day, i) => {
      const m = dayMarkersRef.current[i];
      if (!m) return;
      const el = m.getElement();
      el.style.display = viewMode === "area" ? "none" : "";
      const pin = el.querySelector(".pin");
      if (!pin) return;
      pin.classList.remove("dim", "dim2", "active");
      if (viewMode !== "area") {
        const inScope = dayScope === "all" || day.base === dayScope;
        if (!inScope) pin.classList.add("dim");
        else if (i !== activeIdx) pin.classList.add("dim2");
        if (i === activeIdx) pin.classList.add("active");
      }
    });
    Object.entries(hotelMarkersRef.current).forEach(([key, m]) => {
      const el = m.getElement();
      el.classList.remove("dim", "dim2", "cur");
      if (viewMode === "day") {
        if (dayScope !== "all" && key !== dayScope) el.classList.add("dim2");
        if (activeIdx >= 0 && trip.days[activeIdx] && trip.days[activeIdx].base === key)
          el.classList.add("cur");
      }
    });
  }

  function applyBaseRoutes() {
    const map = mapRef.current;
    if (!map || !readyRef.current) return;
    const src = map.getSource(BASE_ROUTE_SOURCE) as maplibregl.GeoJSONSource | undefined;
    if (!src) return;
    const features: Feature[] = [];
    if (viewMode === "area") {
      for (let i = 0; i < trip.baseOrder.length - 1; i++) {
        const from = trip.regions[trip.baseOrder[i]];
        const to = trip.regions[trip.baseOrder[i + 1]];
        if (!from || !to) continue;
        features.push({
          type: "Feature",
          properties: { color: to.hex },
          geometry: {
            type: "LineString",
            coordinates: [
              [from.lng, from.lat],
              [to.lng, to.lat],
            ],
          },
        });
      }
    } else if (viewMode === "day") {
      trip.days.forEach((d) => {
        if (dayScope !== "all" && d.base !== dayScope) return;
        const r = trip.regions[d.base];
        if (!r) return;
        features.push({
          type: "Feature",
          properties: { color: d.color },
          geometry: {
            type: "LineString",
            coordinates: [
              [r.lng, r.lat],
              [d.lng, d.lat],
            ],
          },
        });
      });
    }
    src.setData({ type: "FeatureCollection", features });
  }

  function applyDayRoute() {
    const map = mapRef.current;
    if (!map || !readyRef.current) return;
    const src = map.getSource(ROUTE_SOURCE) as maplibregl.GeoJSONSource | undefined;
    if (!src) return;
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    if (viewMode !== "day" || activeIdx < 0) {
      src.setData(emptyLineFC());
      return;
    }
    const day = trip.days[activeIdx];
    if (!day) {
      src.setData(emptyLineFC());
      return;
    }
    const r = trip.regions[day.base];
    if (!r) {
      src.setData(emptyLineFC());
      return;
    }
    const a: LngLat = [r.lng, r.lat];
    const z: LngLat = [day.lng, day.lat];
    const D = 620;
    const t0 = performance.now();
    const ease = (t: number) => 1 - Math.pow(1 - t, 3);
    const step = (now: number) => {
      const t = Math.min(1, (now - t0) / D);
      const e = ease(t);
      const pt: LngLat = [a[0] + (z[0] - a[0]) * e, a[1] + (z[1] - a[1]) * e];
      const data: FeatureCollection = {
        type: "FeatureCollection",
        features: [
          {
            type: "Feature",
            properties: { color: day.color },
            geometry: { type: "LineString", coordinates: [a, pt] },
          },
        ],
      };
      src.setData(data);
      if (t < 1) rafRef.current = requestAnimationFrame(step);
      else rafRef.current = null;
    };
    rafRef.current = requestAnimationFrame(step);
  }

  function applyCamera() {
    const map = mapRef.current;
    if (!map || !readyRef.current) return;
    const pad = padFor(map);

    if (viewMode === "area") {
      const pts: LngLat[] = [];
      trip.baseOrder.forEach((k) => {
        const r = trip.regions[k];
        if (!r) return;
        pts.push([r.lng, r.lat]);
        trip.days.forEach((d) => {
          if (d.base === k && !d.outlier) pts.push([d.lng, d.lat]);
        });
      });
      if (pts.length) {
        map.fitBounds(boundsOf(pts), { padding: pad, maxZoom: 8, duration: 850 });
      }
      return;
    }

    // day view
    if (activeIdx >= 0) {
      const day = trip.days[activeIdx];
      const baseKey = day?.base;
      const r = baseKey ? trip.regions[baseKey] : undefined;
      if (!day || !r) return;
      const pts: LngLat[] = [[r.lng, r.lat]];
      trip.days.forEach((d) => {
        if (d.base === baseKey && !d.outlier) pts.push([d.lng, d.lat]);
      });
      map.fitBounds(boundsOf(pts), {
        padding: { top: Math.max(pad, 170), right: pad, bottom: pad, left: pad },
        maxZoom: 10.5,
        duration: 780,
      });
      return;
    }

    if (dayScope === "all") {
      const pts: LngLat[] = [];
      trip.baseOrder.forEach((k) => {
        const r = trip.regions[k];
        if (!r) return;
        pts.push([r.lng, r.lat]);
        trip.days.forEach((d) => {
          if (d.base === k && !d.outlier) pts.push([d.lng, d.lat]);
        });
      });
      if (pts.length) {
        map.fitBounds(boundsOf(pts), { padding: pad, maxZoom: 8, duration: 850 });
      }
      return;
    }

    // specific base
    const r = trip.regions[dayScope];
    if (!r) return;
    const pts: LngLat[] = [[r.lng, r.lat]];
    trip.days.forEach((d) => {
      if (d.base === dayScope) pts.push([d.lng, d.lat]);
    });
    map.fitBounds(boundsOf(pts), {
      padding: { top: Math.max(pad, 170), right: pad, bottom: pad, left: pad },
      maxZoom: 10.5,
      duration: 800,
    });
  }

  function applyMiniPopup() {
    const map = mapRef.current;
    if (!map || !readyRef.current) return;
    if (popupRef.current) {
      popupRef.current.remove();
      popupRef.current = null;
    }
    if (viewMode !== "day" || activeIdx < 0) return;
    const day = trip.days[activeIdx];
    if (!day) return;
    const html = `<button class="minipop" data-i="${activeIdx}"><span class="mi" style="color:${day.color}">${iconSvg("car", 13)}</span><b>${day.drive}</b><span class="mp-go">›</span></button>`;
    const popup = new maplibregl.Popup({
      className: "minipop-pop",
      closeButton: false,
      closeOnClick: false,
      offset: 36,
      anchor: "bottom",
    })
      .setLngLat([day.lng, day.lat])
      .setHTML(html)
      .addTo(map);
    const popEl = popup.getElement();
    const elBtn = popEl?.querySelector<HTMLButtonElement>(".minipop");
    if (elBtn) {
      elBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        cbRef.current.onMiniPopupClick(activeIdx);
      });
    }
    popupRef.current = popup;
  }

  function applyLabel() {
    const lab = labelRef.current;
    if (!lab) return;
    let regionKey: string | null = null;
    if (viewMode === "day") {
      if (activeIdx >= 0) {
        const day = trip.days[activeIdx];
        if (day) regionKey = day.base;
      } else if (dayScope !== "all") {
        regionKey = dayScope;
      }
    }
    if (!regionKey) {
      lab.classList.remove("show");
      lab.innerHTML = "";
      return;
    }
    const r = trip.regions[regionKey];
    if (!r) {
      lab.classList.remove("show");
      lab.innerHTML = "";
      return;
    }
    const nights = nightsOfBase(trip, regionKey);
    lab.style.setProperty("--mlc", r.hex);
    lab.innerHTML = `<span class="ml-sw" style="background:${r.hex}">${iconSvg(r.icon, 15)}</span><div><div class="ml-name">${r.name}</div><div class="ml-sub"><span class="lat">${r.hotel} · ${nights} ל'</span></div></div>`;
    lab.classList.add("show");
  }

  return (
    <div className="mapwrap">
      <div className="mapcanvas" ref={containerRef} />
      <div className="maplabel" ref={labelRef} />
      <div className="mapnote" ref={noteRef} />
    </div>
  );
}
