/**
 * Generates placeholder PNG icons (solid brand color) for the PWA manifest.
 * Real icons should replace these. Run via: `tsx scripts/gen-icons.ts`.
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { deflateSync } from "node:zlib";

// Brand color
const BRAND = { r: 0x1c, g: 0x7a, b: 0x52 };

function crc32(buf: Uint8Array): number {
  let c: number;
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) crc = (table[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8)) >>> 0;
  return (crc ^ 0xffffffff) >>> 0;
}

function u32(n: number): Uint8Array {
  const b = new Uint8Array(4);
  b[0] = (n >>> 24) & 0xff;
  b[1] = (n >>> 16) & 0xff;
  b[2] = (n >>> 8) & 0xff;
  b[3] = n & 0xff;
  return b;
}

function concat(...arrs: Uint8Array[]): Uint8Array {
  const total = arrs.reduce((s, a) => s + a.length, 0);
  const out = new Uint8Array(total);
  let off = 0;
  for (const a of arrs) {
    out.set(a, off);
    off += a.length;
  }
  return out;
}

function chunk(type: string, data: Uint8Array): Uint8Array {
  const typeBytes = new Uint8Array(4);
  for (let i = 0; i < 4; i++) typeBytes[i] = type.charCodeAt(i);
  const len = u32(data.length);
  const crc = u32(crc32(concat(typeBytes, data)));
  return concat(len, typeBytes, data, crc);
}

function makeSolidPng(size: number): Uint8Array {
  // 8-bit RGB, no alpha
  const signature = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = concat(
    u32(size),
    u32(size),
    new Uint8Array([8, 2, 0, 0, 0]), // bit depth 8, color type 2 (RGB)
  );
  // Raw image data: each scanline starts with filter byte 0, then RGB triplets
  const row = new Uint8Array(1 + size * 3);
  row[0] = 0;
  for (let x = 0; x < size; x++) {
    row[1 + x * 3] = BRAND.r;
    row[1 + x * 3 + 1] = BRAND.g;
    row[1 + x * 3 + 2] = BRAND.b;
  }
  const rawParts: Uint8Array[] = [];
  for (let y = 0; y < size; y++) rawParts.push(row);
  const raw = concat(...rawParts);
  const idatData = new Uint8Array(deflateSync(raw));
  return concat(signature, chunk("IHDR", ihdr), chunk("IDAT", idatData), chunk("IEND", new Uint8Array(0)));
}

const root = process.cwd();
const targets: Array<{ path: string; size: number }> = [
  { path: join(root, "public", "icons", "icon-192.png"), size: 192 },
  { path: join(root, "public", "icons", "icon-512.png"), size: 512 },
  { path: join(root, "public", "icons", "icon-maskable-512.png"), size: 512 },
];

for (const t of targets) {
  mkdirSync(dirname(t.path), { recursive: true });
  writeFileSync(t.path, makeSolidPng(t.size));
  console.log(`wrote ${t.path} (${t.size}x${t.size})`);
}
