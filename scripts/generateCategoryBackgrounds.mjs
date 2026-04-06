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
  'accounting':                ['bar-chart',   '#93c5fd', '#bfdbfe', '#dbeafe'],
  'banking':                   ['building',    '#93c5fd', '#bfdbfe', '#e0e7ff'],
  'behavioral-economics':      ['brain',       '#a5b4fc', '#c7d2fe', '#e0e7ff'],
  'business':                  ['briefcase',   '#94a3b8', '#cbd5e1', '#e2e8f0'],
  'business-models':           ['layers',      '#a8a29e', '#d6d3d1', '#e7e5e4'],
  'e-commerce':                ['cart',        '#c4b5fd', '#ddd6fe', '#ede9fe'],
  'economics':                 ['trending-up', '#7dd3fc', '#bae6fd', '#e0f2fe'],
  'entrepreneurship':          ['rocket',      '#a5b4fc', '#c7d2fe', '#e0e7ff'],
  'insurance':                 ['shield',      '#93c5fd', '#bfdbfe', '#dbeafe'],
  'investing':                 ['trending-up', '#93c5fd', '#bfdbfe', '#dbeafe'],
  'money':                     ['dollar',      '#fcd34d', '#fde68a', '#fef9c3'],
  'personal-finance':          ['dollar',      '#93c5fd', '#bfdbfe', '#dbeafe'],
  'real-estate':               ['building',    '#fbbf24', '#fcd34d', '#fef3c7'],
  'startups':                  ['rocket',      '#c4b5fd', '#ddd6fe', '#ede9fe'],
  'taxes':                     ['percent',     '#93c5fd', '#bfdbfe', '#dbeafe'],
  'trading':                   ['trending-up', '#7dd3fc', '#bae6fd', '#e0f2fe'],
  'fraud-and-scams':           ['lock',        '#fca5a5', '#fecaca', '#fee2e2'],
  'risk-and-compliance':       ['shield',      '#94a3b8', '#cbd5e1', '#e2e8f0'],

  // ─── Professional & Career ───
  'career':                    ['compass',     '#a5b4fc', '#c7d2fe', '#e0e7ff'],
  'communication':             ['message',     '#67e8f9', '#a5f3fc', '#cffafe'],
  'copywriting':               ['pen',         '#fde047', '#fef08a', '#fef9c3'],
  'human-resources':           ['users',       '#67e8f9', '#a5f3fc', '#cffafe'],
  'leadership':                ['crown',       '#a5b4fc', '#c7d2fe', '#e0e7ff'],
  'management':                ['users',       '#94a3b8', '#cbd5e1', '#e2e8f0'],
  'marketing':                 ['target',      '#fda4af', '#fecdd3', '#ffe4e6'],
  'negotiation':               ['users',       '#93c5fd', '#bfdbfe', '#dbeafe'],
  'operations':                ['gear',        '#9ca3af', '#d1d5db', '#e5e7eb'],
  'product-management':        ['crown',       '#c4b5fd', '#ddd6fe', '#ede9fe'],
  'productivity':              ['clock',       '#5eead4', '#99f6e4', '#ccfbf1'],
  'project-management':        ['clock',       '#94a3b8', '#cbd5e1', '#e2e8f0'],
  'public-speaking':           ['message',     '#c4b5fd', '#ddd6fe', '#ede9fe'],
  'sales':                     ['target',      '#86efac', '#bbf7d0', '#dcfce7'],
  'workplace-skills':          ['briefcase',   '#93c5fd', '#bfdbfe', '#dbeafe'],

  // ─── Learning & Thinking ───
  'critical-thinking':         ['puzzle',      '#a5b4fc', '#c7d2fe', '#e0e7ff'],
  'creativity':                ['lightbulb',   '#fde047', '#fef08a', '#fef9c3'],
  'decision-making':           ['compass',     '#93c5fd', '#bfdbfe', '#dbeafe'],
  'education':                 ['book',        '#67e8f9', '#a5f3fc', '#cffafe'],
  'game-theory':               ['puzzle',      '#d6d3d1', '#e7e5e4', '#f5f5f4'],
  'information-theory':        ['network',     '#a5b4fc', '#c7d2fe', '#e0e7ff'],
  'learning':                  ['book',        '#5eead4', '#99f6e4', '#ccfbf1'],
  'learning-methods':          ['lightbulb',   '#5eead4', '#99f6e4', '#ccfbf1'],
  'life-skills':               ['compass',     '#93c5fd', '#bfdbfe', '#dbeafe'],
  'logic':                     ['puzzle',      '#93c5fd', '#bfdbfe', '#dbeafe'],
  'mental-models':             ['brain',       '#a5b4fc', '#c7d2fe', '#e0e7ff'],

  // ─── Psychology & Mind ───
  'cognitive-science':         ['brain',       '#c4b5fd', '#ddd6fe', '#ede9fe'],
  'emotions':                  ['heart',       '#f9a8d4', '#fbcfe8', '#fce7f3'],
  'mental-health':             ['heart',       '#5eead4', '#99f6e4', '#ccfbf1'],
  'neuroscience':              ['brain',       '#c4b5fd', '#ddd6fe', '#ede9fe'],
  'psychology':                ['brain',       '#c4b5fd', '#ddd6fe', '#ede9fe'],

  // ─── Health & Body ───
  'first-aid-safety':          ['shield',      '#fca5a5', '#fecaca', '#fee2e2'],
  'human-body':                ['stethoscope', '#c4b5fd', '#ddd6fe', '#ede9fe'],
  'human-evolution':           ['dna',         '#a5b4fc', '#c7d2fe', '#e0e7ff'],
  'medicine':                  ['stethoscope', '#5eead4', '#99f6e4', '#ccfbf1'],
  'nutrition':                 ['apple',       '#86efac', '#bbf7d0', '#dcfce7'],
  'physical-fitness':          ['dumbbell',    '#fca5a5', '#fecaca', '#fee2e2'],
  'public-health':             ['stethoscope', '#67e8f9', '#a5f3fc', '#cffafe'],
  'self-care':                 ['heart',       '#f9a8d4', '#fbcfe8', '#fce7f3'],
  'sexual-health':             ['heart',       '#fda4af', '#fecdd3', '#ffe4e6'],
  'sleep':                     ['moon',        '#a5b4fc', '#c7d2fe', '#e0e7ff'],

  // ─── Social & Relationships ───
  'parenting':                 ['users',       '#fdba74', '#fed7aa', '#ffedd5'],
  'relationships':             ['heart',       '#f9a8d4', '#fbcfe8', '#fce7f3'],
  'social-media':              ['network',     '#67e8f9', '#a5f3fc', '#cffafe'],
  'sociology':                 ['users',       '#93c5fd', '#bfdbfe', '#dbeafe'],

  // ─── Humanities & Culture ───
  'anthropology':              ['globe',       '#fde047', '#fef08a', '#fef9c3'],
  'archaeology':               ['shovel',      '#fcd34d', '#fde68a', '#fef9c3'],
  'culture':                   ['globe',       '#c4b5fd', '#ddd6fe', '#ede9fe'],
  'ethics':                    ['scale',       '#94a3b8', '#cbd5e1', '#e2e8f0'],
  'geopolitics':               ['globe',       '#93c5fd', '#bfdbfe', '#dbeafe'],
  'history':                   ['scroll',      '#fcd34d', '#fde68a', '#fef9c3'],
  'languages':                 ['message',     '#5eead4', '#99f6e4', '#ccfbf1'],
  'law':                       ['scale',       '#93c5fd', '#bfdbfe', '#dbeafe'],
  'linguistics':               ['message',     '#a5b4fc', '#c7d2fe', '#e0e7ff'],
  'literature':                ['book',        '#fde047', '#fef08a', '#fef9c3'],
  'media-literacy':            ['eye',         '#94a3b8', '#cbd5e1', '#e2e8f0'],
  'myth-symbolism':            ['scroll',      '#c4b5fd', '#ddd6fe', '#ede9fe'],
  'mythology':                 ['scroll',      '#c4b5fd', '#ddd6fe', '#ede9fe'],
  'philosophy':                ['lightbulb',   '#a5b4fc', '#c7d2fe', '#e0e7ff'],
  'politics':                  ['building',    '#94a3b8', '#cbd5e1', '#e2e8f0'],
  'religion':                  ['cross',       '#c4b5fd', '#ddd6fe', '#ede9fe'],
  'religion-and-spirituality': ['cross',       '#c4b5fd', '#ddd6fe', '#ede9fe'],
  'religion-spirituality':     ['cross',       '#c4b5fd', '#ddd6fe', '#ede9fe'],

  // ─── Arts & Creative ───
  'animation':                 ['film',        '#fda4af', '#fecdd3', '#ffe4e6'],
  'art':                       ['palette',     '#fda4af', '#fecdd3', '#ffe4e6'],
  'art-design':                ['palette',     '#fda4af', '#fecdd3', '#ffe4e6'],
  'design':                    ['palette',     '#c4b5fd', '#ddd6fe', '#ede9fe'],
  'fashion':                   ['shirt',       '#f9a8d4', '#fbcfe8', '#fce7f3'],
  'film-and-cinema':           ['film',        '#a8a29e', '#d6d3d1', '#e7e5e4'],
  'gaming':                    ['gamepad',     '#c4b5fd', '#ddd6fe', '#ede9fe'],
  'music':                     ['music',       '#d8b4fe', '#e9d5ff', '#f3e8ff'],
  'music-production':          ['music',       '#a5b4fc', '#c7d2fe', '#e0e7ff'],
  'photography':               ['camera',      '#9ca3af', '#d1d5db', '#e5e7eb'],
  'television-and-streaming':  ['film',        '#93c5fd', '#bfdbfe', '#dbeafe'],
  'writing':                   ['pen',         '#fde047', '#fef08a', '#fef9c3'],

  // ─── Science ───
  'astronomy-and-space':       ['moon',        '#a5b4fc', '#c7d2fe', '#e0e7ff'],
  'astronomy-space':           ['moon',        '#a5b4fc', '#c7d2fe', '#e0e7ff'],
  'biology':                   ['dna',         '#86efac', '#bbf7d0', '#dcfce7'],
  'biotechnology':             ['dna',         '#5eead4', '#99f6e4', '#ccfbf1'],
  'chemistry':                 ['atom',        '#67e8f9', '#a5f3fc', '#cffafe'],
  'ecology':                   ['leaf',        '#86efac', '#bbf7d0', '#dcfce7'],
  'food-science':              ['microscope',  '#fde047', '#fef08a', '#fef9c3'],
  'genetics':                  ['dna',         '#c4b5fd', '#ddd6fe', '#ede9fe'],
  'geography':                 ['globe',       '#86efac', '#bbf7d0', '#dcfce7'],
  'geology':                   ['mountain',    '#fcd34d', '#fde68a', '#fef9c3'],
  'mathematics':               ['sigma',       '#a5b4fc', '#c7d2fe', '#e0e7ff'],
  'meteorology':               ['cloud',       '#7dd3fc', '#bae6fd', '#e0f2fe'],
  'oceanography':              ['droplet',     '#7dd3fc', '#bae6fd', '#e0f2fe'],
  'physics':                   ['atom',        '#a5b4fc', '#c7d2fe', '#e0e7ff'],
  'science':                   ['atom',        '#93c5fd', '#bfdbfe', '#dbeafe'],
  'statistics':                ['bar-chart',   '#a5b4fc', '#c7d2fe', '#e0e7ff'],

  // ─── Nature & Environment ───
  'agriculture':               ['leaf',        '#86efac', '#bbf7d0', '#dcfce7'],
  'climate-and-environment':   ['leaf',        '#5eead4', '#99f6e4', '#ccfbf1'],
  'coffee-and-tea':            ['coffee',      '#d4a574', '#e8c9a0', '#f5e6d3'],
  'cooking':                   ['utensils',    '#fdba74', '#fed7aa', '#ffedd5'],
  'energy':                    ['zap',         '#fde047', '#fef08a', '#fef9c3'],
  'gardening':                 ['leaf',        '#86efac', '#bbf7d0', '#dcfce7'],

  // ─── Engineering ───
  'architecture':              ['building',    '#a8a29e', '#d6d3d1', '#e7e5e4'],
  'civil-engineering':         ['building',    '#94a3b8', '#cbd5e1', '#e2e8f0'],
  'electrical-engineering':    ['zap',         '#a5b4fc', '#c7d2fe', '#e0e7ff'],
  'engineering-fundamentals':  ['gear',        '#9ca3af', '#d1d5db', '#e5e7eb'],
  'materials-science':         ['layers',      '#94a3b8', '#cbd5e1', '#e2e8f0'],
  'mechanical-engineering':    ['gear',        '#a8a29e', '#d6d3d1', '#e7e5e4'],
  'nanotechnology':            ['microscope',  '#a5b4fc', '#c7d2fe', '#e0e7ff'],
  'transportation-systems':    ['plane',       '#7dd3fc', '#bae6fd', '#e0f2fe'],
  'urban-planning':            ['building',    '#5eead4', '#99f6e4', '#ccfbf1'],

  // ─── Technology ───
  'ai':                        ['cpu',         '#c4b5fd', '#ddd6fe', '#ede9fe'],
  'ai-agents':                 ['cpu',         '#c4b5fd', '#ddd6fe', '#ede9fe'],
  'cloud-computing':           ['cloud',       '#7dd3fc', '#bae6fd', '#e0f2fe'],
  'computer-networking':       ['network',     '#93c5fd', '#bfdbfe', '#dbeafe'],
  'cybersecurity':             ['shield',      '#5eead4', '#99f6e4', '#ccfbf1'],
  'data':                      ['database',    '#a5b4fc', '#c7d2fe', '#e0e7ff'],
  'data-engineering':          ['database',    '#93c5fd', '#bfdbfe', '#dbeafe'],
  'databases':                 ['database',    '#a5b4fc', '#c7d2fe', '#e0e7ff'],
  'devops':                    ['gear',        '#7dd3fc', '#bae6fd', '#e0f2fe'],
  'future-tech':               ['rocket',      '#a5b4fc', '#c7d2fe', '#e0e7ff'],
  'mobile-development':        ['smartphone',  '#93c5fd', '#bfdbfe', '#dbeafe'],
  'privacy-and-digital-rights':['lock',        '#93c5fd', '#bfdbfe', '#dbeafe'],
  'programming':               ['code',        '#a5b4fc', '#c7d2fe', '#e0e7ff'],
  'quality-assurance-testing': ['search',      '#94a3b8', '#cbd5e1', '#e2e8f0'],
  'supply-chain-logistics':    ['truck',       '#9ca3af', '#d1d5db', '#e5e7eb'],
  'system-design':             ['layers',      '#93c5fd', '#bfdbfe', '#dbeafe'],
  'technology':                ['cpu',         '#93c5fd', '#bfdbfe', '#dbeafe'],
  'ux-research':               ['eye',         '#c4b5fd', '#ddd6fe', '#ede9fe'],
  'web-development':           ['code',        '#67e8f9', '#a5f3fc', '#cffafe'],
  'web3':                      ['code',        '#a8a29e', '#d6d3d1', '#e7e5e4'],

  // ─── Lifestyle ───
  'automotive-and-evs':        ['car',         '#9ca3af', '#d1d5db', '#e5e7eb'],
  'home-diy':                  ['home',        '#fcd34d', '#fde68a', '#fef9c3'],
  'home-and-diy':              ['home',        '#fcd34d', '#fde68a', '#fef9c3'],
  'hospitality':               ['coffee',      '#fdba74', '#fed7aa', '#ffedd5'],
  'sports':                    ['dumbbell',    '#86efac', '#bbf7d0', '#dcfce7'],
  'travel':                    ['plane',       '#67e8f9', '#a5f3fc', '#cffafe'],
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
    const opacity = (0.04 + rng() * 0.06).toFixed(3);
    circles.push(`<circle cx="${cx}" cy="${cy}" r="${r}" fill="#fff" opacity="${opacity}"/>`);
  }

  // Generate small decorative dots
  const dots = [];
  const dotCount = 8 + Math.floor(rng() * 8);
  for (let i = 0; i < dotCount; i++) {
    const cx = Math.round(rng() * 800);
    const cy = Math.round(rng() * 400);
    const r = 1.5 + Math.round(rng() * 3);
    const opacity = (0.06 + rng() * 0.10).toFixed(2);
    dots.push(`<circle cx="${cx}" cy="${cy}" r="${r}" fill="#fff" opacity="${opacity}"/>`);
  }

  // Icon positioning: centered-right area with some variation
  const iconScale = 7 + rng() * 2;
  const iconX = 480 + Math.round(rng() * 80) - 40;
  const iconY = 80 + Math.round(rng() * 60) - 30;
  const iconOpacity = (0.12 + rng() * 0.08).toFixed(2);

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
      <stop offset="0" stop-color="${c3}" stop-opacity=".5"/>
      <stop offset="1" stop-color="${c3}" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="800" height="400" fill="url(#g)"/>
  <rect width="800" height="400" fill="url(#a)"/>
  ${circles.join('\n  ')}
  <g transform="translate(${iconX},${iconY}) scale(${iconScale.toFixed(1)})" fill="none" stroke="#000" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" opacity="${iconOpacity}">
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
