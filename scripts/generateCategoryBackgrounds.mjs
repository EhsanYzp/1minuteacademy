#!/usr/bin/env node
/**
 * Generates professional SVG background images for all category cards.
 * Each SVG features a rich gradient, decorative geometric elements,
 * and a subtle thematic icon watermark.
 *
 * Usage: node scripts/generateCategoryBackgrounds.mjs
 * Output: public/catalog-icons/categories/<id>.svg
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = join(__dirname, '..', 'public', 'catalog-icons', 'categories');

// ── Deterministic PRNG (seeded by category id) ────────────────────

function hashCode(str) {
  let h = 5381;
  for (let i = 0; i < str.length; i++) {
    h = ((h << 5) + h + str.charCodeAt(i)) >>> 0;
  }
  return h;
}

function createRng(seed) {
  let s = seed;
  return () => {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    return s / 0x7fffffff;
  };
}

// ── Icon definitions (24×24 viewBox, stroke-based) ─────────────────
// Each icon is a single string of SVG elements for compositing.

const ICONS = {
  'trending-up':
    '<polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/>' +
    '<polyline points="17 6 23 6 23 12"/>',

  'dollar':
    '<line x1="12" y1="1" x2="12" y2="23"/>' +
    '<path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>',

  'bar-chart':
    '<rect x="4" y="14" width="4" height="8" rx="1"/>' +
    '<rect x="10" y="8" width="4" height="14" rx="1"/>' +
    '<rect x="16" y="4" width="4" height="18" rx="1"/>',

  'briefcase':
    '<rect x="2" y="7" width="20" height="14" rx="2"/>' +
    '<path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/>' +
    '<line x1="2" y1="13" x2="22" y2="13"/>',

  'building':
    '<rect x="4" y="2" width="16" height="20" rx="2"/>' +
    '<rect x="8" y="6" width="3" height="3" rx=".5"/>' +
    '<rect x="13" y="6" width="3" height="3" rx=".5"/>' +
    '<rect x="8" y="12" width="3" height="3" rx=".5"/>' +
    '<rect x="13" y="12" width="3" height="3" rx=".5"/>' +
    '<rect x="10" y="18" width="4" height="4"/>',

  'users':
    '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>' +
    '<circle cx="9" cy="7" r="4"/>' +
    '<path d="M23 21v-2a4 4 0 0 0-3-3.87"/>' +
    '<path d="M16 3.13a4 4 0 0 1 0 7.75"/>',

  'target':
    '<circle cx="12" cy="12" r="10"/>' +
    '<circle cx="12" cy="12" r="6"/>' +
    '<circle cx="12" cy="12" r="2"/>',

  'message':
    '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>',

  'clock':
    '<circle cx="12" cy="12" r="10"/>' +
    '<polyline points="12 6 12 12 16 14"/>',

  'book':
    '<path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/>' +
    '<path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>',

  'pen':
    '<path d="M12 20h9"/>' +
    '<path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/>',

  'lightbulb':
    '<path d="M9 18h6"/>' +
    '<path d="M10 22h4"/>' +
    '<path d="M12 2a7 7 0 0 0-4 12.7V17h8v-2.3A7 7 0 0 0 12 2z"/>',

  'brain':
    '<path d="M12 2C8.5 2 6 4.5 6 7c0 1.5.5 2.8 1.4 3.8C6.5 12 6 13.5 6 15c0 3 2.5 5 5 5"/>' +
    '<path d="M12 2c3.5 0 6 2.5 6 5 0 1.5-.5 2.8-1.4 3.8.9 1.2 1.4 2.7 1.4 4.2 0 3-2.5 5-5 5"/>' +
    '<path d="M12 2v20"/>' +
    '<path d="M6 9h4"/><path d="M14 9h4"/>' +
    '<path d="M7 15h3"/><path d="M14 15h3"/>',

  'heart':
    '<path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>',

  'scale':
    '<line x1="12" y1="3" x2="12" y2="21"/>' +
    '<polyline points="1 12 5 7 9 12"/>' +
    '<polyline points="15 12 19 7 23 12"/>' +
    '<line x1="5" y1="7" x2="19" y2="7"/>' +
    '<path d="M1 12a4 4 0 0 0 8 0"/>' +
    '<path d="M15 12a4 4 0 0 0 8 0"/>',

  'globe':
    '<circle cx="12" cy="12" r="10"/>' +
    '<line x1="2" y1="12" x2="22" y2="12"/>' +
    '<path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>',

  'dumbbell':
    '<line x1="5" y1="12" x2="19" y2="12"/>' +
    '<rect x="1" y="8" width="4" height="8" rx="1"/>' +
    '<rect x="19" y="8" width="4" height="8" rx="1"/>' +
    '<rect x="5" y="10" width="2" height="4" rx=".5"/>' +
    '<rect x="17" y="10" width="2" height="4" rx=".5"/>',

  'apple':
    '<path d="M12 3c-1.5 0-3 .8-4 2.2C6 7.5 5 9.5 5 11.5c0 4 2.5 8 5 9.5.8.5 1.3.7 2 .7s1.2-.2 2-.7c2.5-1.5 5-5.5 5-9.5 0-2-1-4-3-6.3C15 3.8 13.5 3 12 3z"/>' +
    '<path d="M12 3c1-1.5 3-2.5 5-2.5"/>',

  'moon':
    '<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>',

  'stethoscope':
    '<path d="M4.8 2.65A.5.5 0 0 0 4 3v2a5 5 0 0 0 5 5h2a5 5 0 0 0 5-5V3a.5.5 0 0 0-.8-.35"/>' +
    '<path d="M8 15a6 6 0 1 0 12 0v-3"/>' +
    '<circle cx="20" cy="10" r="2"/>',

  'shield':
    '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>',

  'palette':
    '<circle cx="13.5" cy="6.5" r="1.5"/><circle cx="17.5" cy="10.5" r="1.5"/>' +
    '<circle cx="8.5" cy="7.5" r="1.5"/><circle cx="6.5" cy="12.5" r="1.5"/>' +
    '<path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.93 0 1.65-.75 1.65-1.69 0-.44-.18-.84-.44-1.13-.29-.29-.44-.65-.44-1.12a1.64 1.64 0 0 1 1.67-1.67h2c3.05 0 5.56-2.5 5.56-5.56C22 6 17.5 2 12 2z"/>',

  'music':
    '<path d="M9 18V5l12-2v13"/>' +
    '<circle cx="6" cy="18" r="3"/>' +
    '<circle cx="18" cy="16" r="3"/>',

  'camera':
    '<path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>' +
    '<circle cx="12" cy="13" r="4"/>',

  'film':
    '<rect x="2" y="2" width="20" height="20" rx="2.18"/>' +
    '<line x1="7" y1="2" x2="7" y2="22"/><line x1="17" y1="2" x2="17" y2="22"/>' +
    '<line x1="2" y1="12" x2="22" y2="12"/>' +
    '<line x1="2" y1="7" x2="7" y2="7"/><line x1="2" y1="17" x2="7" y2="17"/>' +
    '<line x1="17" y1="7" x2="22" y2="7"/><line x1="17" y1="17" x2="22" y2="17"/>',

  'atom':
    '<circle cx="12" cy="12" r="2"/>' +
    '<ellipse cx="12" cy="12" rx="10" ry="4"/>' +
    '<ellipse cx="12" cy="12" rx="10" ry="4" transform="rotate(60 12 12)"/>' +
    '<ellipse cx="12" cy="12" rx="10" ry="4" transform="rotate(120 12 12)"/>',

  'dna':
    '<path d="M2 15c6.667-6 13.333 0 20-6"/>' +
    '<path d="M2 9c6.667 6 13.333 0 20 6"/>' +
    '<line x1="5" y1="9" x2="5" y2="15"/>' +
    '<line x1="10" y1="11" x2="10" y2="13"/>' +
    '<line x1="14" y1="9" x2="14" y2="15"/>' +
    '<line x1="19" y1="11" x2="19" y2="13"/>',

  'cpu':
    '<rect x="4" y="4" width="16" height="16" rx="2"/>' +
    '<rect x="9" y="9" width="6" height="6"/>' +
    '<line x1="9" y1="1" x2="9" y2="4"/><line x1="15" y1="1" x2="15" y2="4"/>' +
    '<line x1="9" y1="20" x2="9" y2="23"/><line x1="15" y1="20" x2="15" y2="23"/>' +
    '<line x1="20" y1="9" x2="23" y2="9"/><line x1="20" y1="14" x2="23" y2="14"/>' +
    '<line x1="1" y1="9" x2="4" y2="9"/><line x1="1" y1="14" x2="4" y2="14"/>',

  'code':
    '<polyline points="16 18 22 12 16 6"/>' +
    '<polyline points="8 6 2 12 8 18"/>' +
    '<line x1="14" y1="4" x2="10" y2="20"/>',

  'database':
    '<ellipse cx="12" cy="5" rx="9" ry="3"/>' +
    '<path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/>' +
    '<path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/>',

  'cloud':
    '<path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z"/>',

  'network':
    '<circle cx="12" cy="5" r="3"/>' +
    '<circle cx="5" cy="19" r="3"/><circle cx="19" cy="19" r="3"/>' +
    '<line x1="12" y1="8" x2="5" y2="16"/><line x1="12" y1="8" x2="19" y2="16"/>',

  'leaf':
    '<path d="M11 20A7 7 0 0 1 4 13C4 6 11 2 18 2a7 7 0 0 1 0 14c-3 0-6-2-7-5"/>' +
    '<path d="M4 20l7-7"/>',

  'home':
    '<path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>' +
    '<polyline points="9 22 9 12 15 12 15 22"/>',

  'rocket':
    '<path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z"/>' +
    '<path d="M12 15l-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z"/>' +
    '<path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0"/>' +
    '<path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5"/>',

  'puzzle':
    '<path d="M20 14a2 2 0 1 0 0-4V6h-6a2 2 0 1 0-4 0H4v8a2 2 0 1 0 0 4v4h6a2 2 0 1 0 4 0h6Z"/>',

  'coffee':
    '<path d="M17 8h1a4 4 0 1 1 0 8h-1"/>' +
    '<path d="M3 8h14v9a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4V8z"/>' +
    '<line x1="6" y1="2" x2="6" y2="4"/><line x1="10" y1="2" x2="10" y2="4"/><line x1="14" y1="2" x2="14" y2="4"/>',

  'utensils':
    '<path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2"/><path d="M7 2v20"/>' +
    '<path d="M21 15V2a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3zm0 0v7"/>',

  'plane':
    '<path d="M17.8 19.2L16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z"/>',

  'gear':
    '<circle cx="12" cy="12" r="3"/>' +
    '<path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09a1.65 1.65 0 0 0-1.08-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09a1.65 1.65 0 0 0 1.51-1.08 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9c.26.604.852.997 1.51 1H21a2 2 0 0 1 0 4h-.09c-.658.003-1.25.396-1.51 1z"/>',

  'zap':
    '<polygon points="13 2 3 14 12 14 11 22 21 10 12 10"/>',

  'droplet':
    '<path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z"/>',

  'mountain':
    '<path d="M8 3l4 8 5-5 7 14H0z"/>',

  'scroll':
    '<path d="M8 21h12a2 2 0 0 0 2-2v-2H10v2a2 2 0 1 1-4 0V5a2 2 0 1 0-4 0v3h4"/>' +
    '<path d="M19 17V5a2 2 0 0 0-2-2H4"/>',

  'gamepad':
    '<line x1="6" y1="12" x2="10" y2="12"/><line x1="8" y1="10" x2="8" y2="14"/>' +
    '<line x1="15" y1="13" x2="15.01" y2="13"/><line x1="18" y1="11" x2="18.01" y2="11"/>' +
    '<path d="M17.32 5H6.68a4 4 0 0 0-3.98 3.59c-.01.05-.01.1-.02.15C2.6 9.42 2 14.46 2 16a3 3 0 0 0 3 3c1 0 1.5-.5 2-1l1.41-1.41A2 2 0 0 1 9.83 16h4.34a2 2 0 0 1 1.41.59L17 18c.5.5 1 1 2 1a3 3 0 0 0 3-3c0-1.54-.6-6.58-.69-7.26l-.02-.15A4 4 0 0 0 17.32 5z"/>',

  'microscope':
    '<path d="M6 18h8"/><path d="M3 22h18"/>' +
    '<path d="M14 22a7 7 0 1 0 0-14"/><path d="M9 14h2"/>' +
    '<path d="M9 12a2 2 0 0 1-2-2V6h6v4a2 2 0 0 1-2 2Z"/>' +
    '<path d="M12 6V3a1 1 0 0 0-1-1H9a1 1 0 0 0-1 1v3"/>',

  'car':
    '<path d="M14 16H9m10 0h3v-3.15a1 1 0 0 0-.84-.99L16 11l-2.7-3.6a1 1 0 0 0-.8-.4H5.24a2 2 0 0 0-1.8 1.1l-.8 1.63A6 6 0 0 0 2 12.42V16h2"/>' +
    '<circle cx="6.5" cy="16.5" r="2.5"/><circle cx="16.5" cy="16.5" r="2.5"/>',

  'shirt':
    '<path d="M20.38 3.46L16 2 12 5 8 2l-4.38 1.46a2 2 0 0 0-1.34 1.68l-.58 3.47 3.97.66.33-2V21h12V7.27l.33 2 3.97-.66-.58-3.47a2 2 0 0 0-1.34-1.68z"/>',

  'shovel':
    '<path d="M2 22v-5l5-5 5 5-5 5z"/>' +
    '<line x1="9.5" y1="14.5" x2="16" y2="8"/>' +
    '<path d="M17 2l5 5-.5.5a3.53 3.53 0 0 1-5 0 3.53 3.53 0 0 1 0-5z"/>',

  'sigma':
    '<path d="M18 6H7.5l5.25 6L7.5 18H18"/>',

  'cart':
    '<circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/>' +
    '<path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/>',

  'search':
    '<circle cx="11" cy="11" r="8"/>' +
    '<line x1="21" y1="21" x2="16.65" y2="16.65"/>',

  'compass':
    '<circle cx="12" cy="12" r="10"/>' +
    '<polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88"/>',

  'sun':
    '<circle cx="12" cy="12" r="5"/>' +
    '<line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/>' +
    '<line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>' +
    '<line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/>' +
    '<line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>',

  'layers':
    '<polygon points="12 2 2 7 12 12 22 7"/>' +
    '<polyline points="2 17 12 22 22 17"/>' +
    '<polyline points="2 12 12 17 22 12"/>',

  'lock':
    '<rect x="3" y="11" width="18" height="11" rx="2"/>' +
    '<path d="M7 11V7a5 5 0 0 1 10 0v4"/>',

  'smartphone':
    '<rect x="5" y="2" width="14" height="20" rx="2"/>' +
    '<line x1="12" y1="18" x2="12.01" y2="18"/>',

  'crown':
    '<path d="M2 20h20L18 8l-4 5-2-7-2 7-4-5z"/><line x1="2" y1="20" x2="22" y2="20"/>',

  'truck':
    '<rect x="1" y="3" width="15" height="13"/>' +
    '<polygon points="16 8 20 8 23 11 23 16 16 16"/>' +
    '<circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/>',

  'cross':
    '<line x1="12" y1="2" x2="12" y2="22"/>' +
    '<line x1="4" y1="8" x2="20" y2="8"/>',

  'percent':
    '<line x1="19" y1="5" x2="5" y2="19"/>' +
    '<circle cx="6.5" cy="6.5" r="2.5"/><circle cx="17.5" cy="17.5" r="2.5"/>',

  'eye':
    '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>' +
    '<circle cx="12" cy="12" r="3"/>',

  'award':
    '<circle cx="12" cy="8" r="7"/>' +
    '<polyline points="8.21 13.89 7 23 12 20 17 23 15.79 13.88"/>',
};

// ── Category configuration ────────────────────────────────────────
// [iconKey, gradientStart, gradientEnd, glowAccent]

const CATEGORIES = {
  // ─── Finance & Money ───
  'accounting':                ['bar-chart',   '#0f172a', '#1e3a5f', '#3b82f6'],
  'banking':                   ['building',    '#172554', '#1e40af', '#60a5fa'],
  'behavioral-economics':      ['brain',       '#312e81', '#4338ca', '#818cf8'],
  'business':                  ['briefcase',   '#1e293b', '#334155', '#64748b'],
  'business-models':           ['layers',      '#1c1917', '#44403c', '#a8a29e'],
  'e-commerce':                ['cart',        '#2e1065', '#6d28d9', '#a78bfa'],
  'economics':                 ['trending-up', '#0c4a6e', '#0369a1', '#38bdf8'],
  'entrepreneurship':          ['rocket',      '#1e1b4b', '#3730a3', '#818cf8'],
  'insurance':                 ['shield',      '#0f172a', '#1e40af', '#60a5fa'],
  'investing':                 ['trending-up', '#0f172a', '#1d4ed8', '#60a5fa'],
  'money':                     ['dollar',      '#1c1917', '#78350f', '#fbbf24'],
  'personal-finance':          ['dollar',      '#0f172a', '#1e3a5f', '#3b82f6'],
  'real-estate':               ['building',    '#292524', '#78350f', '#f59e0b'],
  'startups':                  ['rocket',      '#2e1065', '#7c3aed', '#a78bfa'],
  'taxes':                     ['percent',     '#1e3a5f', '#1e40af', '#60a5fa'],
  'trading':                   ['trending-up', '#0c4a6e', '#0284c7', '#38bdf8'],
  'fraud-and-scams':           ['lock',        '#450a0a', '#991b1b', '#fca5a5'],
  'risk-and-compliance':       ['shield',      '#1e293b', '#475569', '#94a3b8'],

  // ─── Professional & Career ───
  'career':                    ['compass',     '#1e1b4b', '#3730a3', '#818cf8'],
  'communication':             ['message',     '#0e7490', '#06b6d4', '#67e8f9'],
  'copywriting':               ['pen',         '#713f12', '#a16207', '#fde047'],
  'human-resources':           ['users',       '#0f4c5c', '#0e7490', '#22d3ee'],
  'leadership':                ['crown',       '#1e1b4b', '#4338ca', '#a5b4fc'],
  'management':                ['users',       '#1e293b', '#334155', '#94a3b8'],
  'marketing':                 ['target',      '#9f1239', '#e11d48', '#fda4af'],
  'negotiation':               ['users',       '#1e3a5f', '#1d4ed8', '#93c5fd'],
  'operations':                ['gear',        '#1e293b', '#374151', '#9ca3af'],
  'product-management':        ['crown',       '#2e1065', '#7c3aed', '#c4b5fd'],
  'productivity':              ['clock',       '#134e4a', '#0d9488', '#5eead4'],
  'project-management':        ['clock',       '#1e293b', '#475569', '#cbd5e1'],
  'public-speaking':           ['message',     '#4c1d95', '#7c3aed', '#c4b5fd'],
  'sales':                     ['target',      '#14532d', '#15803d', '#86efac'],
  'workplace-skills':          ['briefcase',   '#1e3a5f', '#2563eb', '#93c5fd'],

  // ─── Learning & Thinking ───
  'critical-thinking':         ['puzzle',      '#312e81', '#4f46e5', '#a5b4fc'],
  'creativity':                ['lightbulb',   '#713f12', '#ca8a04', '#fde047'],
  'decision-making':           ['compass',     '#1e3a5f', '#2563eb', '#93c5fd'],
  'education':                 ['book',        '#0f4c5c', '#0e7490', '#67e8f9'],
  'game-theory':               ['puzzle',      '#1c1917', '#57534e', '#d6d3d1'],
  'information-theory':        ['network',     '#1e1b4b', '#4338ca', '#a5b4fc'],
  'learning':                  ['book',        '#134e4a', '#0f766e', '#5eead4'],
  'learning-methods':          ['lightbulb',   '#134e4a', '#0d9488', '#99f6e4'],
  'life-skills':               ['compass',     '#1e3a5f', '#1d4ed8', '#93c5fd'],
  'logic':                     ['puzzle',      '#0f172a', '#1e40af', '#60a5fa'],
  'mental-models':             ['brain',       '#312e81', '#4f46e5', '#c7d2fe'],

  // ─── Psychology & Mind ───
  'cognitive-science':         ['brain',       '#312e81', '#6d28d9', '#c4b5fd'],
  'emotions':                  ['heart',       '#831843', '#be185d', '#f9a8d4'],
  'mental-health':             ['heart',       '#134e4a', '#0d9488', '#99f6e4'],
  'neuroscience':              ['brain',       '#2e1065', '#7c3aed', '#c4b5fd'],
  'psychology':                ['brain',       '#4c1d95', '#7c3aed', '#a78bfa'],

  // ─── Health & Body ───
  'first-aid-safety':          ['shield',      '#7f1d1d', '#dc2626', '#fca5a5'],
  'human-body':                ['stethoscope', '#4c1d95', '#7c3aed', '#c4b5fd'],
  'human-evolution':           ['dna',         '#1e3a5f', '#4338ca', '#818cf8'],
  'medicine':                  ['stethoscope', '#042f2e', '#0d9488', '#5eead4'],
  'nutrition':                 ['apple',       '#14532d', '#16a34a', '#86efac'],
  'physical-fitness':          ['dumbbell',    '#7f1d1d', '#dc2626', '#fca5a5'],
  'public-health':             ['stethoscope', '#0e7490', '#06b6d4', '#67e8f9'],
  'self-care':                 ['heart',       '#831843', '#db2777', '#f9a8d4'],
  'sexual-health':             ['heart',       '#9f1239', '#e11d48', '#fda4af'],
  'sleep':                     ['moon',        '#1e1b4b', '#312e81', '#818cf8'],

  // ─── Social & Relationships ───
  'parenting':                 ['users',       '#7c2d12', '#ea580c', '#fdba74'],
  'relationships':             ['heart',       '#831843', '#be185d', '#fbcfe8'],
  'social-media':              ['network',     '#0e7490', '#06b6d4', '#67e8f9'],
  'sociology':                 ['users',       '#1e3a5f', '#3b82f6', '#93c5fd'],

  // ─── Humanities & Culture ───
  'anthropology':              ['globe',       '#713f12', '#a16207', '#fde047'],
  'archaeology':               ['shovel',      '#78350f', '#a16207', '#fcd34d'],
  'culture':                   ['globe',       '#4c1d95', '#7c3aed', '#c4b5fd'],
  'ethics':                    ['scale',       '#1e293b', '#475569', '#94a3b8'],
  'geopolitics':               ['globe',       '#1e3a5f', '#1d4ed8', '#93c5fd'],
  'history':                   ['scroll',      '#78350f', '#92400e', '#fcd34d'],
  'languages':                 ['message',     '#134e4a', '#0f766e', '#5eead4'],
  'law':                       ['scale',       '#1e293b', '#1e40af', '#60a5fa'],
  'linguistics':               ['message',     '#312e81', '#4f46e5', '#a5b4fc'],
  'literature':                ['book',        '#78350f', '#a16207', '#fde047'],
  'media-literacy':            ['eye',         '#1e293b', '#475569', '#94a3b8'],
  'myth-symbolism':            ['scroll',      '#4c1d95', '#6d28d9', '#c4b5fd'],
  'mythology':                 ['scroll',      '#2e1065', '#7c3aed', '#a78bfa'],
  'philosophy':                ['lightbulb',   '#1e1b4b', '#312e81', '#a5b4fc'],
  'politics':                  ['building',    '#1e293b', '#475569', '#94a3b8'],
  'religion':                  ['cross',       '#2e1065', '#6d28d9', '#c4b5fd'],
  'religion-and-spirituality': ['cross',       '#2e1065', '#6d28d9', '#c4b5fd'],
  'religion-spirituality':     ['cross',       '#2e1065', '#6d28d9', '#c4b5fd'],

  // ─── Arts & Creative ───
  'animation':                 ['film',        '#9f1239', '#e11d48', '#fda4af'],
  'art':                       ['palette',     '#9f1239', '#be123c', '#fda4af'],
  'art-design':                ['palette',     '#9f1239', '#be123c', '#fda4af'],
  'design':                    ['palette',     '#4c1d95', '#7c3aed', '#c4b5fd'],
  'fashion':                   ['shirt',       '#831843', '#be185d', '#f9a8d4'],
  'film-and-cinema':           ['film',        '#1c1917', '#44403c', '#a8a29e'],
  'gaming':                    ['gamepad',     '#4c1d95', '#7c3aed', '#a78bfa'],
  'music':                     ['music',       '#2e1065', '#9333ea', '#d8b4fe'],
  'music-production':          ['music',       '#1e1b4b', '#4338ca', '#a5b4fc'],
  'photography':               ['camera',      '#1c1917', '#374151', '#9ca3af'],
  'television-and-streaming':  ['film',        '#0f172a', '#1e40af', '#60a5fa'],
  'writing':                   ['pen',         '#78350f', '#a16207', '#fde047'],

  // ─── Science ───
  'astronomy-and-space':       ['moon',        '#0f172a', '#1e1b4b', '#818cf8'],
  'astronomy-space':           ['moon',        '#0f172a', '#1e1b4b', '#818cf8'],
  'biology':                   ['dna',         '#14532d', '#15803d', '#86efac'],
  'biotechnology':             ['dna',         '#134e4a', '#0d9488', '#5eead4'],
  'chemistry':                 ['atom',        '#0e7490', '#0891b2', '#67e8f9'],
  'ecology':                   ['leaf',        '#14532d', '#16a34a', '#4ade80'],
  'food-science':              ['microscope',  '#713f12', '#a16207', '#fde047'],
  'genetics':                  ['dna',         '#2e1065', '#7c3aed', '#c4b5fd'],
  'geography':                 ['globe',       '#14532d', '#15803d', '#86efac'],
  'geology':                   ['mountain',    '#78350f', '#92400e', '#fcd34d'],
  'mathematics':               ['sigma',       '#1e1b4b', '#3730a3', '#a5b4fc'],
  'meteorology':               ['cloud',       '#0c4a6e', '#0369a1', '#7dd3fc'],
  'oceanography':              ['droplet',     '#0c4a6e', '#0284c7', '#38bdf8'],
  'physics':                   ['atom',        '#1e1b4b', '#4338ca', '#818cf8'],
  'science':                   ['atom',        '#0f172a', '#1e40af', '#60a5fa'],
  'statistics':                ['bar-chart',   '#1e3a5f', '#4338ca', '#818cf8'],

  // ─── Nature & Environment ───
  'agriculture':               ['leaf',        '#14532d', '#166534', '#4ade80'],
  'climate-and-environment':   ['leaf',        '#134e4a', '#047857', '#34d399'],
  'coffee-and-tea':            ['coffee',      '#3b0764', '#78350f', '#d4a574'],
  'cooking':                   ['utensils',    '#7c2d12', '#c2410c', '#fdba74'],
  'energy':                    ['zap',         '#713f12', '#ca8a04', '#fde047'],
  'gardening':                 ['leaf',        '#14532d', '#15803d', '#86efac'],

  // ─── Engineering ───
  'architecture':              ['building',    '#1c1917', '#44403c', '#a8a29e'],
  'civil-engineering':         ['building',    '#1e293b', '#475569', '#94a3b8'],
  'electrical-engineering':    ['zap',         '#1e1b4b', '#4338ca', '#818cf8'],
  'engineering-fundamentals':  ['gear',        '#1e293b', '#374151', '#9ca3af'],
  'materials-science':         ['layers',      '#0f172a', '#334155', '#94a3b8'],
  'mechanical-engineering':    ['gear',        '#1c1917', '#44403c', '#a8a29e'],
  'nanotechnology':            ['microscope',  '#1e1b4b', '#4338ca', '#a5b4fc'],
  'transportation-systems':    ['plane',       '#0c4a6e', '#0369a1', '#38bdf8'],
  'urban-planning':            ['building',    '#134e4a', '#0f766e', '#5eead4'],

  // ─── Technology ───
  'ai':                        ['cpu',         '#2e1065', '#7c3aed', '#a78bfa'],
  'ai-agents':                 ['cpu',         '#2e1065', '#7c3aed', '#a78bfa'],
  'cloud-computing':           ['cloud',       '#0c4a6e', '#0284c7', '#7dd3fc'],
  'computer-networking':       ['network',     '#0f172a', '#1e40af', '#60a5fa'],
  'cybersecurity':             ['shield',      '#042f2e', '#065f46', '#34d399'],
  'data':                      ['database',    '#1e1b4b', '#4338ca', '#818cf8'],
  'data-engineering':          ['database',    '#0f172a', '#1e40af', '#60a5fa'],
  'databases':                 ['database',    '#312e81', '#4f46e5', '#a5b4fc'],
  'devops':                    ['gear',        '#0c4a6e', '#0284c7', '#7dd3fc'],
  'future-tech':               ['rocket',      '#1e1b4b', '#3730a3', '#818cf8'],
  'mobile-development':        ['smartphone',  '#1e293b', '#3b82f6', '#93c5fd'],
  'privacy-and-digital-rights':['lock',        '#0f172a', '#1e40af', '#60a5fa'],
  'programming':               ['code',        '#1e1b4b', '#4338ca', '#818cf8'],
  'quality-assurance-testing': ['search',      '#1e293b', '#475569', '#94a3b8'],
  'supply-chain-logistics':    ['truck',       '#1e293b', '#374151', '#9ca3af'],
  'system-design':             ['layers',      '#0f172a', '#1d4ed8', '#60a5fa'],
  'technology':                ['cpu',         '#0f172a', '#1e40af', '#60a5fa'],
  'ux-research':               ['eye',         '#4c1d95', '#7c3aed', '#c4b5fd'],
  'web-development':           ['code',        '#0e7490', '#06b6d4', '#67e8f9'],
  'web3':                      ['code',        '#1c1917', '#44403c', '#a8a29e'],

  // ─── Lifestyle ───
  'automotive-and-evs':        ['car',         '#1e293b', '#374151', '#9ca3af'],
  'home-diy':                  ['home',        '#713f12', '#a16207', '#fcd34d'],
  'home-and-diy':              ['home',        '#713f12', '#a16207', '#fcd34d'],
  'hospitality':               ['coffee',      '#7c2d12', '#c2410c', '#fdba74'],
  'sports':                    ['dumbbell',    '#14532d', '#15803d', '#86efac'],
  'travel':                    ['plane',       '#0e7490', '#0891b2', '#67e8f9'],
};

// ── SVG Generation ────────────────────────────────────────────────

function generateSvg(categoryId, config) {
  const [iconKey, c1, c2, c3] = config;
  const iconContent = ICONS[iconKey] || ICONS['atom'];
  const rng = createRng(hashCode(categoryId));

  // Generate decorative circles
  const circles = [];
  const circleCount = 5 + Math.floor(rng() * 4);
  for (let i = 0; i < circleCount; i++) {
    const cx = Math.round(rng() * 800);
    const cy = Math.round(rng() * 400);
    const r = 30 + Math.round(rng() * 120);
    const opacity = (0.03 + rng() * 0.05).toFixed(3);
    circles.push(`<circle cx="${cx}" cy="${cy}" r="${r}" fill="#fff" opacity="${opacity}"/>`);
  }

  // Generate small decorative dots
  const dots = [];
  const dotCount = 8 + Math.floor(rng() * 8);
  for (let i = 0; i < dotCount; i++) {
    const cx = Math.round(rng() * 800);
    const cy = Math.round(rng() * 400);
    const r = 1.5 + Math.round(rng() * 3);
    const opacity = (0.08 + rng() * 0.14).toFixed(2);
    dots.push(`<circle cx="${cx}" cy="${cy}" r="${r}" fill="#fff" opacity="${opacity}"/>`);
  }

  // Icon positioning: centered-right area with some variation
  const iconScale = 7 + rng() * 2;
  const iconX = 480 + Math.round(rng() * 80) - 40;
  const iconY = 80 + Math.round(rng() * 60) - 30;
  const iconOpacity = (0.08 + rng() * 0.06).toFixed(2);

  // Glow position variation
  const glowCx = (0.55 + rng() * 0.3).toFixed(2);
  const glowCy = (0.15 + rng() * 0.3).toFixed(2);

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 400" width="800" height="400">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${c1}"/>
      <stop offset="1" stop-color="${c2}"/>
    </linearGradient>
    <radialGradient id="a" cx="${glowCx}" cy="${glowCy}" r=".65">
      <stop offset="0" stop-color="${c3}" stop-opacity=".35"/>
      <stop offset="1" stop-color="${c3}" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="800" height="400" fill="url(#g)"/>
  <rect width="800" height="400" fill="url(#a)"/>
  ${circles.join('\n  ')}
  <g transform="translate(${iconX},${iconY}) scale(${iconScale.toFixed(1)})" fill="none" stroke="#fff" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" opacity="${iconOpacity}">
    ${iconContent}
  </g>
  ${dots.join('\n  ')}
</svg>`;
}

// ── Main ───────────────────────────────────────────────────────────

function main() {
  mkdirSync(OUT_DIR, { recursive: true });

  const ids = Object.keys(CATEGORIES);
  let written = 0;

  for (const id of ids) {
    const config = CATEGORIES[id];
    const svg = generateSvg(id, config);
    const filePath = join(OUT_DIR, `${id}.svg`);
    writeFileSync(filePath, svg, 'utf8');
    written++;
  }

  console.log(`✅ Generated ${written} category background SVGs in public/catalog-icons/categories/`);
}

main();
