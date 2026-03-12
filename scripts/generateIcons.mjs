import fs from 'node:fs/promises';
import path from 'node:path';
import { ROOT } from './_contentPaths.mjs';
import sharp from 'sharp';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const toIco = require('to-ico');

async function renderBrandedPng({ svgBuffer, size, background = '#0b1020', contentScale = 0.78 }) {
  const contentSize = Math.max(1, Math.round(size * contentScale));
  const svgPng = await sharp(svgBuffer, { density: 600 })
    .resize(contentSize, contentSize, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png({ compressionLevel: 9 })
    .toBuffer();

  return sharp({ create: { width: size, height: size, channels: 4, background } })
    .composite([{ input: svgPng, gravity: 'center' }])
    .png({ compressionLevel: 9 })
    .toBuffer();
}

async function writeFileEnsuringDir(filePath, data) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, data);
}

async function main() {
  const publicDir = path.join(ROOT, 'public');
  const iconsDir = path.join(publicDir, 'icons');

  const logoPath = path.join(publicDir, 'logo-1ma.svg');
  const svgBuffer = await fs.readFile(logoPath);

  const png180 = await renderBrandedPng({ svgBuffer, size: 180, contentScale: 0.80 });
  const png192 = await renderBrandedPng({ svgBuffer, size: 192, contentScale: 0.80 });
  const png512 = await renderBrandedPng({ svgBuffer, size: 512, contentScale: 0.82 });

  await writeFileEnsuringDir(path.join(publicDir, 'apple-touch-icon.png'), png180);
  await writeFileEnsuringDir(path.join(iconsDir, 'icon-192.png'), png192);
  await writeFileEnsuringDir(path.join(iconsDir, 'icon-512.png'), png512);

  // favicon.ico from multiple sizes
  const png16 = await renderBrandedPng({ svgBuffer, size: 16, contentScale: 0.88 });
  const png32 = await renderBrandedPng({ svgBuffer, size: 32, contentScale: 0.86 });
  const png48 = await renderBrandedPng({ svgBuffer, size: 48, contentScale: 0.84 });
  const ico = await toIco([png16, png32, png48]);
  await writeFileEnsuringDir(path.join(publicDir, 'favicon.ico'), ico);

  console.log('✅ Icons generated: public/favicon.ico, public/apple-touch-icon.png, public/icons/icon-192.png, public/icons/icon-512.png');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
