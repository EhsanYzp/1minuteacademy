import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import { ROOT } from './_contentPaths.mjs';

async function writePng({ svgBuffer, outPath, size, background = '#0b1020', contentScale = 0.86 }) {
  const contentSize = Math.max(1, Math.round(size * contentScale));

  const logoPng = await sharp(svgBuffer, { density: 700 })
    .resize(contentSize, contentSize, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png({ compressionLevel: 9 })
    .toBuffer();

  const out = await sharp({ create: { width: size, height: size, channels: 4, background } })
    .composite([{ input: logoPng, gravity: 'center' }])
    .png({ compressionLevel: 9 })
    .toBuffer();

  await fs.mkdir(path.dirname(outPath), { recursive: true });
  await fs.writeFile(outPath, out);
}

async function main() {
  const publicDir = path.join(ROOT, 'public');
  const svgPath = path.join(publicDir, 'logo-1ma.svg');
  const svgBuffer = await fs.readFile(svgPath);

  // X profile picture: square, high-res, dark background.
  await writePng({ svgBuffer, outPath: path.join(publicDir, 'logo-1ma-x.png'), size: 1024, contentScale: 0.88 });
  await writePng({ svgBuffer, outPath: path.join(publicDir, 'logo-1ma-x-400.png'), size: 400, contentScale: 0.88 });

  console.log('✅ Raster logos generated: public/logo-1ma-x.png, public/logo-1ma-x-400.png');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
