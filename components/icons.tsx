import type { CSSProperties } from "react";

export const ICON_PATHS: Record<string, string> = {
  ferris: '<circle cx="12" cy="11" r="8"/><path d="M12 3v16M4.7 7l14.6 8M19.3 7 4.7 15"/><path d="M9 21h6"/>',
  cablecar: '<path d="M3 5h18M12 5v3"/><rect x="7" y="8" width="10" height="7" rx="1.5"/><path d="M7 11h10"/>',
  coaster: '<path d="M3 18V9a3 3 0 0 1 6 0v6a3 3 0 0 0 6 0V9"/><path d="M3 18h18"/>',
  gem: '<path d="M6 4h12l3 5-9 11L3 9z"/><path d="M3 9h18M9 4l-1.5 5L12 20M15 4l1.5 5L12 20"/>',
  castle: '<path d="M4 21V9l2 1V7l2 1V6l2 1V6l2-1v2l2-1v3l2-1v2l2-1v12z"/><path d="M10 21v-4h4v4"/>',
  palace: '<path d="M3 21h18M5 21V10l7-5 7 5v11M9 21v-6h6v6"/><circle cx="12" cy="8" r="1"/>',
  spa: '<path d="M12 3c2 3 4 5 4 8a4 4 0 0 1-8 0c0-3 2-5 4-8Z"/><path d="M4 21c2-1.5 4-1.5 6 0M14 21c2-1.5 4-1.5 6 0"/>',
  peak: '<path d="M3 20h18L14 6l-3.5 6L8 8z"/><path d="m10.5 12 1.5 2 2-2"/>',
  kart: '<circle cx="6.5" cy="17" r="2"/><circle cx="17" cy="17" r="2"/><path d="M8.5 17h6.5M4 17v-3h9l3 3M9 14v-3h4"/>',
  lake: '<path d="M3 9c2.5-2 4.5 2 7 0s4.5-2 7 0M3 14c2.5-2 4.5 2 7 0s4.5-2 7 0M3 19c2.5-2 4.5 2 7 0s4.5-2 7 0"/>',
  museum: '<path d="M3 21h18M4 21V10M20 21V10M8 21V11M12 21V11M16 21V11M3 10h18L12 4z"/>',
  zoo: '<circle cx="6" cy="11" r="1.6"/><circle cx="10" cy="7" r="1.6"/><circle cx="14" cy="7" r="1.6"/><circle cx="18" cy="11" r="1.6"/><path d="M12 13c-3 0-5 2-5 4.5 0 1.5 2 2.5 5 2.5s5-1 5-2.5C17 15 15 13 12 13Z"/>',
  church: '<path d="M12 2v4M10 4h4"/><path d="M6 21V11l6-4 6 4v10M10 21v-5h4v5"/>',
  plane: '<path d="M21 15.5 13 11V4.5a1.5 1.5 0 0 0-3 0V11l-8 4.5V17l8-2v3l-2 1.5V21l3.5-1 3.5 1v-1.5L13 18v-3l8 2z"/>',
  car: '<path d="M5 17h14M5 17a2 2 0 1 1-4 0 2 2 0 0 1 4 0Zm18 0a2 2 0 1 1-4 0 2 2 0 0 1 4 0ZM3 17v-5l2-5h10l3 5h1a2 2 0 0 1 2 2v3"/>',
  suitcase: '<rect x="3" y="8" width="18" height="12" rx="1.5"/><path d="M9 8V6a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2"/><path d="M3 13h18"/>',
  bed: '<path d="M3 18V8m0 6h18m0 4v-6a2 2 0 0 0-2-2H7a2 2 0 0 0-2 2"/>',
  moon: '<path d="M20 14a8 8 0 1 1-9-11 6 6 0 0 0 9 11Z"/>',
  rain: '<path d="M7 16a4 4 0 0 1-1-7.9 5 5 0 0 1 9.6-1.3A3.5 3.5 0 0 1 18 16"/><path d="m8 19-1 2M12 19l-1 2M16 19l-1 2"/>',
  arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
  star: '<path d="m12 3 2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.4 6.8 19.1l1-5.8L3.5 9.2l5.9-.9z"/>',
  timeline: '<circle cx="6" cy="6" r="1.6"/><circle cx="6" cy="12" r="1.6"/><circle cx="6" cy="18" r="1.6"/><path d="M11 6h10M11 12h10M11 18h10"/>',
  settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1A1.7 1.7 0 0 0 4.6 9a1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
};

export function iconSvg(name: string, size = 18): string {
  const inner = ICON_PATHS[name] || "";
  return `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${inner}</svg>`;
}

export function Icon({ name, size = 18, style }: { name: string; size?: number; style?: CSSProperties }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      style={style}
      dangerouslySetInnerHTML={{ __html: ICON_PATHS[name] || "" }}
    />
  );
}

export function Lat({ children }: { children: React.ReactNode }) {
  return <span className="lat">{children}</span>;
}
