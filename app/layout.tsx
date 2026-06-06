import type { Metadata, Viewport } from "next";
import "./globals.css";
import "maplibre-gl/dist/maplibre-gl.css";

export const metadata: Metadata = {
  title: "אוסטריה · 2026 — מתכנן הטיול",
  description: "מתכנן הטיול המשפחתי לאוסטריה — קיץ 2026",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, statusBarStyle: "default", title: "אוסטריה 2026" },
};

export const viewport: Viewport = {
  themeColor: "#1C7A52",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="he" dir="rtl" className="type-alpine">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          href="https://fonts.googleapis.com/css2?family=Assistant:wght@400;500;600;700;800&family=Frank+Ruhl+Libre:wght@500;700;900&family=Heebo:wght@400;500;600;700;800&family=Noto+Serif+Hebrew:wght@500;700&family=Rubik:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
