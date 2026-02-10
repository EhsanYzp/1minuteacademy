import fs from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';
import { ROOT } from './_contentPaths.mjs';

const require = createRequire(import.meta.url);
const { PNG } = require('pngjs');
const toIco = require('to-ico');

function hexToRgba(hex, a = 255) {
  const h = String(hex).replace('#', '').trim();
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  const n = Number.parseInt(full, 16);
  return {
    r: (n >> 16) & 255,
    g: (n >> 8) & 255,
    b: n & 255,
    a,
  };
}

function setPixel(png, x, y, { r, g, b, a }) {
  if (x < 0 || y < 0 || x >= png.width || y >= png.height) return;
  const idx = (png.width * y + x) << 2;
  png.data[idx] = r;
  png.data[idx + 1] = g;
  png.data[idx + 2] = b;
  png.data[idx + 3] = a;
}

function drawFilledCircle(png, cx, cy, radius, color) {
  const r2 = radius * radius;
  const minX = Math.floor(cx - radius);
  const maxX = Math.ceil(cx + radius);
  const minY = Math.floor(cy - radius);
  const maxY = Math.ceil(cy + radius);

  for (let y = minY; y <= maxY; y += 1) {
    for (let x = minX; x <= maxX; x += 1) {
      const dx = x - cx;
      const dy = y - cy;
      if (dx * dx + dy * dy <= r2) setPixel(png, x, y, color);
    }
  }
}

function drawRing(png, cx, cy, outerRadius, innerRadius, color) {
  const out2 = outerRadius * outerRadius;
  const in2 = innerRadius * innerRadius;
  const minX = Math.floor(cx - outerRadius);
  const maxX = Math.ceil(cx + outerRadius);
  const minY = Math.floor(cy - outerRadius);
  const maxY = Math.ceil(cy + outerRadius);

  for (let y = minY; y <= maxY; y += 1) {
    for (let x = minX; x <= maxX; x += 1) {
      const dx = x - cx;
      const dy = y - cy;
      const d2 = dx * dx + dy * dy;
      if (d2 <= out2 && d2 >= in2) setPixel(png, x, y, color);
    }
  }
}

function drawLine(png, x0, y0, x1, y1, thickness, color) {
  const dx = x1 - x0;
  const dy = y1 - y0;
  const steps = Math.max(Math.abs(dx), Math.abs(dy));
  if (steps === 0) return;

  for (let i = 0; i <= steps; i += 1) {
    const t = i / steps;
    const x = Math.round(x0 + dx * t);
    const y = Math.round(y0 + dy * t);

    for (let oy = -thickness; oy <= thickness; oy += 1) {
      for (let ox = -thickness; ox <= thickness; ox += 1) {
        setPixel(png, x + ox, y + oy, color);
      }
    }
  }
}

async function pngToBuffer(png) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    png
      .pack()
      .on('data', (c) => chunks.push(c))
      .on('end', () => resolve(Buffer.concat(chunks)))
      .on('error', reject);
  });
}

function renderIcon(size) {
  const png = new PNG({ width: size, height: size });
  const bg = hexToRgba('#0b1020');
  const ring = hexToRgba('#60a5fa');
  const hand = hexToRgba('#e5e7eb');

  // Solid background
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      setPixel(png, x, y, bg);
    }
  }

  const cx = (size - 1) / 2;
  const cy = (size - 1) / 2;

  const outer = Math.round(size * 0.36);
  const inner = Math.round(size * 0.28);
  drawRing(png, cx, cy, outer, inner, ring);

  // clock hands
  const handThickness = Math.max(1, Math.round(size * 0.02));
  drawLine(png, cx, cy, cx, cy - Math.round(size * 0.18), handThickness, hand);
  drawLine(png, cx, cy, cx + Math.round(size * 0.14), cy + Math.round(size * 0.08), handThickness, hand);

  // center dot
  drawFilledCircle(png, cx, cy, Math.max(1, Math.round(size * 0.03)), hand);

  return png;
}

async function writeFileEnsuringDir(filePath, data) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, data);
}

async function main() {
  const publicDir = path.join(ROOT, 'public');
  const iconsDir = path.join(publicDir, 'icons');

  const png180 = await pngToBuffer(renderIcon(180));
  const png192 = await pngToBuffer(renderIcon(192));
  const png512 = await pngToBuffer(renderIcon(512));

  await writeFileEnsuringDir(path.join(publicDir, 'apple-touch-icon.png'), png180);
  await writeFileEnsuringDir(path.join(iconsDir, 'icon-192.png'), png192);
  await writeFileEnsuringDir(path.join(iconsDir, 'icon-512.png'), png512);

  // favicon.ico from multiple sizes
  const png16 = await pngToBuffer(renderIcon(16));
  const png32 = await pngToBuffer(renderIcon(32));
  const png48 = await pngToBuffer(renderIcon(48));
  const ico = await toIco([png16, png32, png48]);
  await writeFileEnsuringDir(path.join(publicDir, 'favicon.ico'), ico);

  console.log('✅ Icons generated: public/favicon.ico, public/apple-touch-icon.png, public/icons/icon-192.png, public/icons/icon-512.png');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
