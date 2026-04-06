import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { chromium } from 'playwright';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');

const DEFAULT_URL = 'https://www.1minute.academy/';
const DEFAULT_OUTPUT = path.join(ROOT, 'public', 'og', 'og-image.png');
const VIEWPORT = { width: 1600, height: 1400 };

async function main() {
  const url = String(process.argv[2] ?? DEFAULT_URL).trim() || DEFAULT_URL;
  const outputPath = path.resolve(String(process.argv[3] ?? DEFAULT_OUTPUT).trim() || DEFAULT_OUTPUT);
  const tempPath = `${outputPath}.tmp.png`;

  const browser = await chromium.launch({ headless: true });

  try {
    const context = await browser.newContext({
      colorScheme: 'light',
      deviceScaleFactor: 2,
      locale: 'en-US',
      viewport: VIEWPORT,
    });

    const page = await context.newPage();
    await page.goto(url, { waitUntil: 'networkidle', timeout: 120000 });
    await page.waitForSelector('.hero');
    await page.waitForSelector('.home-stats');
    await page.evaluate(async () => {
      if (document.fonts?.ready) await document.fonts.ready;
    });
    await page.waitForTimeout(1800);

    const hero = page.locator('.hero');
    await hero.scrollIntoViewIfNeeded();
    await hero.screenshot({ path: tempPath });

    const image = sharp(tempPath);
    const metadata = await image.metadata();
    await image.png({ compressionLevel: 9 }).toFile(outputPath);
    await fs.rm(tempPath, { force: true });

    console.log(
      JSON.stringify(
        {
          outputPath,
          sourceUrl: url,
          width: metadata.width ?? null,
          height: metadata.height ?? null,
        },
        null,
        2,
      ),
    );
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
