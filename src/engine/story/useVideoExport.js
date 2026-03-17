import { useState, useCallback, useRef } from 'react';
// mp4-muxer is dynamically imported inside exportVideo() to avoid
// bundling it for users who never click the download button.

/* ── Constants ─────────────────────────────────────────────── */

const BEATS = ['hook', 'buildup', 'discovery', 'twist', 'climax', 'punchline'];
const BEAT_DURATION_S = 8;
const TOTAL_SECONDS = 60;
const INTRO_S = 4;   // 0‒4 s  – intro card
const OUTRO_S = 2;   // 58‒60 s – outro card
const QUIZ_S = 6;    // 52‒58 s – quiz
const BEATS_START_S = INTRO_S;                           // 4 s
const QUIZ_START_S = BEATS_START_S + BEATS.length * BEAT_DURATION_S; // 52 s
const OUTRO_START_S = QUIZ_START_S + QUIZ_S;             // 58 s
const W = 1920;
const H = 1080;
const IS_MOBILE = typeof navigator !== 'undefined' && /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
// Mobile uses 720p to avoid iOS Safari killing the tab for memory pressure
const EXPORT_W = IS_MOBILE ? 1280 : W;
const EXPORT_H = IS_MOBILE ? 720 : H;
const EXPORT_SCALE = EXPORT_W / W; // 1.0 on desktop, 0.667 on mobile
const FLOAT_CYCLE_S = 3; // matches CSS @keyframes float (3s ease-in-out infinite)
const FLOAT_AMPLITUDE = 10; // matches CSS translateY(-10px)

/* ── Font stacks (match index.css / story.css) ────────────── */
const FONT_DISPLAY = "'Fredoka', sans-serif";     // headings, buttons, timer, UI
const FONT_BODY    = "'Baloo 2', cursive";         // story text, quiz, body copy
const FONT_MONO    = "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace";
const FONT_SERIF   = "Georgia, 'Times New Roman', serif";

/* ── Logo loader ──────────────────────────────────────────── */
// Pre-loads the SVG logo as an Image so we can draw it on canvas.
let _logoImg = null;
let _logoPromise = null;
function loadLogo() {
  if (_logoImg) return Promise.resolve(_logoImg);
  if (_logoPromise) return _logoPromise;
  _logoPromise = new Promise((resolve) => {
    const img = new Image();
    img.onload = () => { _logoImg = img; resolve(img); };
    img.onerror = () => resolve(null);
    img.src = '/logo-1ma.svg';
  });
  return _logoPromise;
}

/* ── Annex B → AVC helpers (iOS Safari fallback) ─────────── */
// iOS Safari's VideoEncoder may ignore { avc: { format: 'avc' } } and
// output raw Annex B bitstream without decoderConfig metadata.
// mp4-muxer needs (a) length-prefixed AVC data and (b) an
// AVCDecoderConfigurationRecord (the "description").  These helpers
// parse the Annex B output and provide both.

/** Check whether the first bytes are an Annex B start code. */
function _isAnnexB(d) {
  return (d[0] === 0 && d[1] === 0 && d[2] === 1) ||
         (d[0] === 0 && d[1] === 0 && d[2] === 0 && d[3] === 1);
}

/** Split an Annex B bitstream into individual NAL units (start codes removed). */
function _splitNALUs(data) {
  const nalus = [];
  const len = data.length;
  let i = 0;
  while (i < len - 2) {
    if (data[i] !== 0 || data[i + 1] !== 0) { i++; continue; }
    let sc = 0;
    if (data[i + 2] === 1) sc = 3;
    else if (i + 3 < len && data[i + 2] === 0 && data[i + 3] === 1) sc = 4;
    if (!sc) { i++; continue; }
    const start = i + sc;
    let end = len;
    for (let j = start + 1; j < len - 2; j++) {
      if (data[j] === 0 && data[j + 1] === 0 &&
          (data[j + 2] === 1 || (j + 3 < len && data[j + 2] === 0 && data[j + 3] === 1))) {
        end = j;
        break;
      }
    }
    if (start < end) nalus.push(data.subarray(start, end));
    i = end;
  }
  return nalus;
}

/** Build an AVCDecoderConfigurationRecord from raw SPS & PPS NAL units. */
function _buildAVCDescription(sps, pps) {
  const buf = new Uint8Array(11 + sps.length + pps.length);
  let o = 0;
  buf[o++] = 1;                         // configurationVersion
  buf[o++] = sps[1];                    // AVCProfileIndication
  buf[o++] = sps[2];                    // profile_compatibility
  buf[o++] = sps[3];                    // AVCLevelIndication
  buf[o++] = 0xFF;                      // reserved(6) + lengthSizeMinusOne=3
  buf[o++] = 0xE1;                      // reserved(3) + numSPS=1
  buf[o++] = (sps.length >> 8) & 0xFF;  // SPS length (high)
  buf[o++] = sps.length & 0xFF;         // SPS length (low)
  buf.set(sps, o); o += sps.length;
  buf[o++] = 1;                         // numPPS
  buf[o++] = (pps.length >> 8) & 0xFF;  // PPS length (high)
  buf[o++] = pps.length & 0xFF;         // PPS length (low)
  buf.set(pps, o);
  return buf.buffer;                    // ArrayBuffer
}

/** Convert Annex B data → AVC (4-byte length-prefixed NALUs, SPS/PPS stripped). */
function _annexBToAVC(data) {
  const nalus = _splitNALUs(data)
    .filter(n => { const t = n[0] & 0x1F; return t !== 7 && t !== 8; }); // drop SPS/PPS
  let total = 0;
  for (const n of nalus) total += 4 + n.length;
  const out = new Uint8Array(total);
  let o = 0;
  for (const n of nalus) {
    out[o++] = (n.length >>> 24) & 0xFF;
    out[o++] = (n.length >>> 16) & 0xFF;
    out[o++] = (n.length >>> 8)  & 0xFF;
    out[o++] =  n.length         & 0xFF;
    out.set(n, o); o += n.length;
  }
  return out;
}

/* ── Per-style visual config (mirrors story.css) ──────────── */

const STYLES = {
  focus: {
    name: 'focus',
    topbarBg: 'rgba(255,255,255,0.85)',
    topbarBorder: 'rgba(0,0,0,0.08)',
    topicColor: '#2d3436',
    bgColors: ['#FFF9F0', '#FFE8D6'],
    overlays: [],
    text: '#2d3436',
    subtext: 'rgba(45,52,54,0.60)',
    timerBg: '#e17055',
    timerText: '#ffffff',
    optBg: 'rgba(255,255,255,0.70)',
    optBorder: 'rgba(0,0,0,0.08)',
    optText: '#2d3436',
    correctBg: 'rgba(46,204,113,0.20)',
    correctBorder: '#2ecc71',
    feedbackColor: '#27ae60',
    font: FONT_BODY,
    displayFont: FONT_DISPLAY,
  },
  dark: {
    name: 'dark',
    topbarBg: 'rgba(10,16,28,0.70)',
    topbarBorder: 'rgba(255,255,255,0.10)',
    topicColor: 'rgba(255,255,255,0.92)',
    bgColors: ['#0b1220', '#070b14'],
    overlays: [
      { x: 0.25, y: 0.15, r: 500, color: 'rgba(78,205,196,0.18)' },
      { x: 0.80, y: 0.45, r: 500, color: 'rgba(225,112,85,0.14)' },
    ],
    text: 'rgba(255,255,255,0.92)',
    subtext: 'rgba(255,255,255,0.55)',
    timerBg: '#e17055',
    timerText: '#ffffff',
    optBg: 'rgba(255,255,255,0.08)',
    optBorder: 'rgba(255,255,255,0.12)',
    optText: 'rgba(255,255,255,0.92)',
    correctBg: 'rgba(46,204,113,0.20)',
    correctBorder: 'rgba(46,204,113,0.60)',
    feedbackColor: '#2ecc71',
    font: FONT_BODY,
    displayFont: FONT_DISPLAY,
  },
  terminal: {
    name: 'terminal',
    topbarBg: 'rgba(5,10,8,0.72)',
    topbarBorder: 'rgba(34,197,94,0.18)',
    topicColor: 'rgba(229,255,240,0.95)',
    bgColors: ['#050a08', '#040806'],
    overlays: [
      { x: 0.20, y: 0.15, r: 550, color: 'rgba(34,197,94,0.10)' },
      { x: 0.85, y: 0.45, r: 500, color: 'rgba(59,130,246,0.10)' },
    ],
    text: 'rgba(229,255,240,0.95)',
    subtext: 'rgba(229,255,240,0.55)',
    timerBg: '#22c55e',
    timerText: '#050a08',
    optBg: 'rgba(34,197,94,0.10)',
    optBorder: 'rgba(34,197,94,0.18)',
    optText: 'rgba(229,255,240,0.95)',
    correctBg: 'rgba(34,197,94,0.22)',
    correctBorder: 'rgba(34,197,94,0.65)',
    feedbackColor: '#22c55e',
    font: FONT_MONO,
    displayFont: FONT_DISPLAY,
  },
  glass: {
    name: 'glass',
    topbarBg: 'rgba(255,255,255,0.85)',
    topbarBorder: 'rgba(0,0,0,0.08)',
    topicColor: '#2d3436',
    bgColors: ['#f8fbff', '#eef6ff'],
    overlays: [
      { x: 0.20, y: 0.20, r: 650, color: 'rgba(99,102,241,0.18)' },
      { x: 0.80, y: 0.40, r: 500, color: 'rgba(236,72,153,0.14)' },
    ],
    text: '#2d3436',
    subtext: 'rgba(45,52,54,0.60)',
    timerBg: '#6366f1',
    timerText: '#ffffff',
    optBg: 'rgba(255,255,255,0.60)',
    optBorder: 'rgba(0,0,0,0.06)',
    optText: '#2d3436',
    correctBg: 'rgba(46,204,113,0.20)',
    correctBorder: '#2ecc71',
    feedbackColor: '#27ae60',
    font: FONT_BODY,
    displayFont: FONT_DISPLAY,
  },
  paper: {
    name: 'paper',
    topbarBg: 'rgba(255,255,255,0.85)',
    topbarBorder: 'rgba(0,0,0,0.08)',
    topicColor: '#2b2a28',
    bgColors: ['#fbf3e4', '#f7ead7'],
    overlays: [
      { x: 0.20, y: 0.20, r: 650, color: 'rgba(225,112,85,0.10)' },
      { x: 0.80, y: 0.35, r: 500, color: 'rgba(78,205,196,0.10)' },
    ],
    text: '#2b2a28',
    subtext: 'rgba(43,42,40,0.55)',
    timerBg: '#c87941',
    timerText: '#ffffff',
    optBg: 'rgba(255,255,255,0.50)',
    optBorder: 'rgba(43,42,40,0.12)',
    optText: '#2b2a28',
    correctBg: 'rgba(46,204,113,0.20)',
    correctBorder: '#2ecc71',
    feedbackColor: '#27ae60',
    font: FONT_SERIF,
    displayFont: FONT_DISPLAY,
  },
  bold: {
    name: 'bold',
    topbarBg: 'rgba(255,255,255,0.85)',
    topbarBorder: 'rgba(0,0,0,0.08)',
    topicColor: '#2d3436',
    bgColors: ['#FFF9F0', '#FFE8D6'],
    overlays: [
      { x: 0.20, y: 0.20, r: 650, color: 'rgba(78,205,196,0.22)' },
      { x: 0.80, y: 0.40, r: 500, color: 'rgba(225,112,85,0.25)' },
    ],
    text: '#2d3436',
    subtext: 'rgba(45,52,54,0.60)',
    timerBg: '#e17055',
    timerText: '#ffffff',
    optBg: 'rgba(255,255,255,0.70)',
    optBorder: 'rgba(0,0,0,0.08)',
    optText: '#2d3436',
    correctBg: 'rgba(46,204,113,0.20)',
    correctBorder: '#2ecc71',
    feedbackColor: '#27ae60',
    font: FONT_BODY,
    displayFont: FONT_DISPLAY,
    textScale: 1.15,
  },
  cards: {
    name: 'cards',
    topbarBg: 'rgba(255,255,255,0.85)',
    topbarBorder: 'rgba(0,0,0,0.08)',
    topicColor: '#2d3436',
    bgColors: ['#FFF9F0', '#FFE8D6'],
    overlays: [],
    text: '#2d3436',
    subtext: 'rgba(45,52,54,0.60)',
    timerBg: '#e17055',
    timerText: '#ffffff',
    optBg: 'rgba(255,255,255,0.70)',
    optBorder: 'rgba(0,0,0,0.08)',
    optText: '#2d3436',
    correctBg: 'rgba(46,204,113,0.20)',
    correctBorder: '#2ecc71',
    feedbackColor: '#27ae60',
    font: FONT_BODY,
    displayFont: FONT_DISPLAY,
  },
  split: {
    name: 'split',
    topbarBg: 'rgba(255,255,255,0.85)',
    topbarBorder: 'rgba(0,0,0,0.08)',
    topicColor: '#2d3436',
    bgColors: ['#FFF9F0', '#FFE8D6'],
    overlays: [],
    text: '#2d3436',
    subtext: 'rgba(45,52,54,0.60)',
    timerBg: '#e17055',
    timerText: '#ffffff',
    optBg: 'rgba(255,255,255,0.70)',
    optBorder: 'rgba(0,0,0,0.08)',
    optText: '#2d3436',
    correctBg: 'rgba(46,204,113,0.20)',
    correctBorder: '#2ecc71',
    feedbackColor: '#27ae60',
    font: FONT_BODY,
    displayFont: FONT_DISPLAY,
  },
  minimal: {
    name: 'minimal',
    topbarBg: 'rgba(255,255,255,0.85)',
    topbarBorder: 'rgba(0,0,0,0.08)',
    topicColor: '#2d3436',
    bgColors: ['#ffffff', '#f8f9fa'],
    overlays: [],
    text: '#2d3436',
    subtext: 'rgba(45,52,54,0.50)',
    timerBg: '#2d3436',
    timerText: '#ffffff',
    optBg: 'rgba(0,0,0,0.03)',
    optBorder: 'rgba(0,0,0,0.08)',
    optText: '#2d3436',
    correctBg: 'rgba(46,204,113,0.15)',
    correctBorder: '#2ecc71',
    feedbackColor: '#27ae60',
    font: FONT_BODY,
    displayFont: FONT_DISPLAY,
  },
};

function getStyle(name) {
  return STYLES[name] || STYLES.focus;
}

/* ── Canvas drawing helpers ───────────────────────────────── */

/** Traces a rounded-rect sub-path (no fill/stroke — caller decides). */
function rrPath(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.arcTo(x + w, y, x + w, y + r, r);
  ctx.lineTo(x + w, y + h - r);
  ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
  ctx.lineTo(x + r, y + h);
  ctx.arcTo(x, y + h, x, y + h - r, r);
  ctx.lineTo(x, y + r);
  ctx.arcTo(x, y, x + r, y, r);
  ctx.closePath();
}

function drawBg(ctx, s) {
  const lg = ctx.createLinearGradient(0, 0, W, H);
  lg.addColorStop(0, s.bgColors[0]);
  lg.addColorStop(1, s.bgColors[1]);
  ctx.fillStyle = lg;
  ctx.fillRect(0, 0, W, H);

  for (const o of s.overlays) {
    const rg = ctx.createRadialGradient(
      W * o.x, H * o.y, 0,
      W * o.x, H * o.y, o.r,
    );
    rg.addColorStop(0, o.color);
    rg.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = rg;
    ctx.fillRect(0, 0, W, H);
  }
}

function wrapText(ctx, text, maxWidth) {
  if (!text) return [];
  const words = String(text).split(/\s+/);
  const lines = [];
  let line = '';
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line);
      line = word;
    } else {
      line = test;
    }
  }
  if (line) lines.push(line);
  return lines;
}

/* ── Shared decorations ───────────────────────────────────── */

function drawBranding(ctx, s) {
  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `700 28px ${s.displayFont}`;
  ctx.fillStyle = s.subtext;
  ctx.fillText('🎓  One Minute Academy', W / 2, 52);
  ctx.restore();
}

function drawTopicTitle(ctx, s, title, emoji) {
  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `700 36px ${s.displayFont}`;
  ctx.fillStyle = s.text;
  ctx.globalAlpha = 0.75;
  const str = emoji ? `${emoji}  ${title}` : title;
  ctx.fillText(str, W / 2, 110, W - 120);
  ctx.globalAlpha = 1;
  ctx.restore();
}

function drawBeatDots(ctx, s, currentBeat) {
  const total = BEATS.length;
  const dotR = 7;
  const gap = 20;
  const totalW = total * dotR * 2 + (total - 1) * gap;
  const startX = (W - totalW) / 2 + dotR;
  const y = H - 100;

  for (let i = 0; i < total; i++) {
    const x = startX + i * (dotR * 2 + gap);
    ctx.beginPath();
    ctx.arc(x, y, dotR, 0, Math.PI * 2);
    if (i === currentBeat) {
      ctx.fillStyle = s.timerBg;
    } else if (i < currentBeat) {
      ctx.fillStyle = s.subtext;
      ctx.globalAlpha = 0.55;
    } else {
      ctx.fillStyle = s.subtext;
      ctx.globalAlpha = 0.22;
    }
    ctx.fill();
    ctx.globalAlpha = 1;
  }
}

function drawTimer(ctx, s, timeRemaining) {
  const cy = 52;
  const pillW = 160;
  const pillH = 56;

  const pillX = W - pillW - 40;
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.22)';
  ctx.shadowBlur = 14;
  ctx.shadowOffsetY = 4;
  rrPath(ctx, pillX, cy - pillH / 2, pillW, pillH, 16);
  ctx.fillStyle = s.timerBg;
  ctx.fill();
  ctx.shadowColor = 'transparent';

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `800 30px ${s.displayFont}`;
  ctx.fillStyle = s.timerText;
  const mins = Math.floor(timeRemaining / 60);
  const secs = String(timeRemaining % 60).padStart(2, '0');
  ctx.fillText(`${mins}:${secs}`, pillX + pillW / 2, cy);
  ctx.restore();
}

function drawWatermark(ctx, s) {
  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `600 26px ${s.displayFont}`;
  ctx.fillStyle = s.subtext;
  ctx.globalAlpha = 0.45;
  ctx.fillText('1minute.academy', W / 2, H - 50);
  ctx.globalAlpha = 1;
  ctx.restore();
}

/* ── Layout constants (match story.css at 1920 × 1080) ───── */

const TOPBAR_H = 76;
const CONTENT_MAX_W = 920;          // .story-beat-inner { max-width: 920px }
const CONTENT_TOP = TOPBAR_H + 16;  // padding-top: calc(topbar + 16px)
const CONTENT_CENTER_Y = CONTENT_TOP + (H - CONTENT_TOP) / 2;
const BEAT_FONT_SIZE = 56;          // clamp(2rem, 6vw, 3.5rem) at 1920px
const BEAT_LINE_H = 1.2;            // line-height: 1.2
const BEAT_TEXT_MAX_W = Math.round(CONTENT_MAX_W * 0.85); // .story-text max-width: 85%
const BEAT_EMOJI_SIZE = 80;         // .story-visual font-size: 5rem
const BEAT_GAP = 24;                // gap: 1.5rem
const QUIZ_Q_SIZE = 44;             // clamp(1.75rem, 5vw, 2.75rem)
const QUIZ_Q_LINE_H = 1.25;        // line-height: 1.25
const QUIZ_OPT_MAX_W = 500;        // .quiz-options max-width: 500px
const QUIZ_OPT_PAD_Y = 20;         // padding: 1.25rem
const QUIZ_OPT_PAD_X = 24;         // padding: 1.5rem
const QUIZ_OPT_GAP = 14;           // gap: 0.875rem
const QUIZ_OPT_FONT = 18;          // font-size: 1.1rem
const QUIZ_FB_SIZE = 24;            // font-size: 1.5rem
const QUIZ_INNER_GAP = 32;         // gap: 2rem

/* ── Topbar (matches .story-topbar) ──────────────────────── */

function drawTopbar(ctx, s, topicTitle, topicEmoji, timeRemaining) {
  ctx.save();

  // Background bar
  ctx.fillStyle = s.topbarBg;
  ctx.fillRect(0, 0, W, TOPBAR_H);

  // Bottom border
  ctx.strokeStyle = s.topbarBorder;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, TOPBAR_H - 0.5);
  ctx.lineTo(W, TOPBAR_H - 0.5);
  ctx.stroke();

  const midY = TOPBAR_H / 2;

  // Centered topic title: emoji + name
  const emojiStr = topicEmoji || '';
  const nameStr = topicTitle || 'Learning...';
  ctx.textBaseline = 'middle';

  ctx.font = `24px ${s.displayFont}`;
  const emojiW = emojiStr ? ctx.measureText(emojiStr).width : 0;
  ctx.font = `700 18px ${s.displayFont}`;
  const nameW = ctx.measureText(nameStr).width;
  const titleGap = emojiStr ? 10 : 0;
  const totalTitleW = emojiW + titleGap + nameW;
  const titleStartX = (W - totalTitleW) / 2;

  if (emojiStr) {
    ctx.font = `24px ${s.displayFont}`;
    ctx.textAlign = 'left';
    ctx.fillStyle = s.topicColor;
    ctx.fillText(emojiStr, titleStartX, midY);
  }
  ctx.font = `700 18px ${s.displayFont}`;
  ctx.textAlign = 'left';
  ctx.fillStyle = s.topicColor;
  ctx.fillText(nameStr, titleStartX + emojiW + titleGap, midY);

  // Timer pill (right side — gradient matches .story-timer-large)
  const pillW = 90;
  const pillH = 44;
  const pillX = W - pillW - 24;
  const pillY = midY - pillH / 2;

  ctx.shadowColor = 'rgba(214,48,49,0.30)';
  ctx.shadowBlur = 15;
  ctx.shadowOffsetY = 4;
  rrPath(ctx, pillX, pillY, pillW, pillH, 12);
  const tg = ctx.createLinearGradient(pillX, pillY, pillX + pillW, pillY + pillH);
  tg.addColorStop(0, '#e17055');
  tg.addColorStop(1, '#d63031');
  ctx.fillStyle = tg;
  ctx.fill();
  ctx.shadowColor = 'transparent';

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `800 22px ${s.displayFont}`;
  ctx.fillStyle = '#ffffff';
  const mins = Math.floor(timeRemaining / 60);
  const secs = String(timeRemaining % 60).padStart(2, '0');
  ctx.fillText(`${mins}:${secs}`, pillX + pillW / 2, midY);

  ctx.restore();
}

/* ── Panel for cards / glass styles ──────────────────────── */

function drawPanel(ctx, styleName, x, y, w, h) {
  ctx.save();
  if (styleName === 'cards') {
    ctx.shadowColor = 'rgba(0,0,0,0.12)';
    ctx.shadowBlur = 60;
    ctx.shadowOffsetY = 18;
    rrPath(ctx, x, y, w, h, 28);
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.08)';
    ctx.lineWidth = 1;
    ctx.stroke();
  } else if (styleName === 'glass') {
    ctx.shadowColor = 'rgba(0,0,0,0.08)';
    ctx.shadowBlur = 60;
    ctx.shadowOffsetY = 18;
    rrPath(ctx, x, y, w, h, 24);
    ctx.fillStyle = 'rgba(255,255,255,0.60)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.06)';
    ctx.lineWidth = 1;
    ctx.stroke();
  }
  ctx.shadowColor = 'transparent';
  ctx.restore();
}

/* ── Beat frame ───────────────────────────────────────────── */

function drawBeatFrame(ctx, { s, visual, text, topicTitle, topicEmoji, timeRemaining, fadeIn = 1, beatIdx = 0, elapsedS = 0 }) {
  drawBg(ctx, s);
  drawTopbar(ctx, s, topicTitle, topicEmoji, timeRemaining);

  ctx.save();
  ctx.globalAlpha = Math.max(0, Math.min(1, fadeIn));

  const styleName = s.name || 'focus';
  const isSplit = styleName === 'split';
  const isBold = styleName === 'bold';
  const isMinimal = styleName === 'minimal';

  // Font sizes matching story.css at 1920px viewport
  const fontSize = isBold ? 64 : BEAT_FONT_SIZE;
  const fontWeight = isMinimal ? '750' : '800';
  const textMaxW = isMinimal ? 900 : BEAT_TEXT_MAX_W;

  if (isSplit) {
    // Split layout: emoji left (320px col), text right (matches .style-split grid)
    const gridW = CONTENT_MAX_W;
    const gridX = (W - gridW) / 2;
    const emojiColW = 320;
    const textColX = gridX + emojiColW + 32;
    const textColW = gridW - emojiColW - 32;

    const floatOffset = Math.sin((elapsedS / FLOAT_CYCLE_S) * Math.PI * 2) * FLOAT_AMPLITUDE;
    ctx.font = `${BEAT_EMOJI_SIZE}px ${s.font}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = s.text;
    ctx.shadowColor = 'rgba(0,0,0,0.15)';
    ctx.shadowBlur = 20;
    ctx.shadowOffsetY = 4;
    ctx.fillText(visual || '\ud83d\udcda', gridX + emojiColW / 2, CONTENT_CENTER_Y + floatOffset);
    ctx.shadowColor = 'transparent';

    const splitFontSize = 51; // clamp(1.75rem,4.6vw,3.2rem)=~51px
    ctx.font = `${fontWeight} ${splitFontSize}px ${s.font}`;
    const splitLines = wrapText(ctx, text, textColW);
    const splitLineH = splitFontSize * BEAT_LINE_H;
    const splitTextH = splitLines.length * splitLineH;
    const splitStartY = CONTENT_CENTER_Y - splitTextH / 2 + splitLineH / 2;

    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = s.text;
    for (let i = 0; i < splitLines.length; i++) {
      ctx.fillText(splitLines[i], textColX, splitStartY + i * splitLineH, textColW);
    }
  } else {
    // Standard centered column layout (focus, dark, terminal, glass, paper, bold, cards, minimal)
    ctx.font = `${fontWeight} ${fontSize}px ${s.font}`;
    const lines = wrapText(ctx, text, textMaxW);
    const lineH = fontSize * BEAT_LINE_H;
    const textBlockH = lines.length * lineH;
    const totalContentH = BEAT_EMOJI_SIZE + BEAT_GAP + textBlockH;
    const contentStartY = CONTENT_CENTER_Y - totalContentH / 2;

    // Panel for cards / glass styles
    if (styleName === 'cards' || styleName === 'glass') {
      const panelPad = styleName === 'cards' ? 36 : 24;
      const panelW = Math.min(styleName === 'cards' ? 980 : CONTENT_MAX_W, textMaxW + panelPad * 2 + 80);
      const panelH = totalContentH + panelPad * 2;
      drawPanel(ctx, styleName, (W - panelW) / 2, contentStartY - panelPad, panelW, panelH);
    }

    // Floating emoji — sinusoidal bob matching CSS @keyframes float
    const floatOffset = Math.sin((elapsedS / FLOAT_CYCLE_S) * Math.PI * 2) * FLOAT_AMPLITUDE;
    ctx.font = `${BEAT_EMOJI_SIZE}px ${s.font}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = s.text;
    if (!isMinimal) {
      ctx.shadowColor = 'rgba(0,0,0,0.15)';
      ctx.shadowBlur = 20;
      ctx.shadowOffsetY = 4;
    }
    ctx.globalAlpha = isMinimal ? 0.9 * fadeIn : fadeIn;
    ctx.fillText(visual || '\ud83d\udcda', W / 2, contentStartY + BEAT_EMOJI_SIZE / 2 + floatOffset);
    ctx.shadowColor = 'transparent';
    ctx.globalAlpha = Math.max(0, Math.min(1, fadeIn));

    // Beat text (word-wrapped, constrained to ≤920px × 85% zone)
    ctx.font = `${fontWeight} ${fontSize}px ${s.font}`;
    ctx.fillStyle = s.text;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    if (isBold) {
      ctx.shadowColor = 'rgba(0,0,0,0.10)';
      ctx.shadowBlur = 40;
      ctx.shadowOffsetY = 10;
    }
    const textStartY = contentStartY + BEAT_EMOJI_SIZE + BEAT_GAP + lineH / 2;
    for (let i = 0; i < lines.length; i++) {
      ctx.fillText(lines[i], W / 2, textStartY + i * lineH, textMaxW);
    }
    ctx.shadowColor = 'transparent';
  }

  ctx.restore();
}

/* ── Quiz frame ───────────────────────────────────────────── */

function drawQuizFrame(ctx, { s, question, options, correct, topicTitle, topicEmoji, timeRemaining, showAnswer }) {
  drawBg(ctx, s);
  drawTopbar(ctx, s, topicTitle, topicEmoji, timeRemaining);

  const opts = Array.isArray(options) ? options : [];
  const optH = QUIZ_OPT_PAD_Y * 2 + QUIZ_OPT_FONT; // ~58px

  // Measure content for vertical centering
  ctx.font = `800 ${QUIZ_Q_SIZE}px ${s.font}`;
  const qMaxW = BEAT_TEXT_MAX_W; // 85% of 920 = 782px
  const qLines = wrapText(ctx, question, qMaxW);
  const qLineH = Math.round(QUIZ_Q_SIZE * QUIZ_Q_LINE_H);
  const qBlockH = qLines.length * qLineH;

  const optsBlockH = opts.length * optH + Math.max(0, opts.length - 1) * QUIZ_OPT_GAP;
  const fbH = showAnswer ? QUIZ_FB_SIZE + 16 : 0;
  const totalH = qBlockH + QUIZ_INNER_GAP + optsBlockH + (fbH ? QUIZ_INNER_GAP + fbH : 0);
  const startY = CONTENT_CENTER_Y - totalH / 2;

  const styleName = s.name || 'focus';

  // Panel for cards / glass
  if (styleName === 'cards' || styleName === 'glass') {
    const panelPad = styleName === 'cards' ? 36 : 24;
    const panelW = Math.min(styleName === 'cards' ? 980 : CONTENT_MAX_W, Math.max(qMaxW, QUIZ_OPT_MAX_W) + panelPad * 2 + 80);
    const panelH = totalH + panelPad * 2;
    drawPanel(ctx, styleName, (W - panelW) / 2, startY - panelPad, panelW, panelH);
  }

  // Question
  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `800 ${QUIZ_Q_SIZE}px ${s.font}`;
  ctx.fillStyle = s.text;
  const qStartY = startY + qLineH / 2;
  for (let i = 0; i < qLines.length; i++) {
    ctx.fillText(qLines[i], W / 2, qStartY + i * qLineH, qMaxW);
  }
  ctx.restore();

  // Options — single column, 500px wide, centered (matches .quiz-options)
  const optStartY = startY + qBlockH + QUIZ_INNER_GAP;
  const optStartX = (W - QUIZ_OPT_MAX_W) / 2;

  for (let i = 0; i < opts.length; i++) {
    const x = optStartX;
    const y = optStartY + i * (optH + QUIZ_OPT_GAP);
    const isCorrect = i === correct;

    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.05)';
    ctx.shadowBlur = 15;
    ctx.shadowOffsetY = 4;
    if (showAnswer && isCorrect) {
      ctx.shadowColor = 'rgba(46,204,113,0.30)';
      ctx.shadowBlur = 20;
    }
    rrPath(ctx, x, y, QUIZ_OPT_MAX_W, optH, 16);

    if (showAnswer && isCorrect) {
      ctx.fillStyle = s.correctBg;
      ctx.fill();
      ctx.strokeStyle = s.correctBorder;
      ctx.lineWidth = 3;
      ctx.stroke();
    } else {
      ctx.fillStyle = s.optBg;
      ctx.fill();
      ctx.strokeStyle = s.optBorder;
      ctx.lineWidth = 2;
      ctx.stroke();
    }
    ctx.shadowColor = 'transparent';

    const dimmed = showAnswer && !isCorrect;
    ctx.globalAlpha = dimmed ? 0.35 : 1;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.font = `600 ${QUIZ_OPT_FONT}px ${s.font}`;
    ctx.fillStyle = s.optText;
    ctx.fillText(String(opts[i] ?? ''), x + QUIZ_OPT_PAD_X, y + optH / 2, QUIZ_OPT_MAX_W - QUIZ_OPT_PAD_X * 2);

    ctx.restore();
  }

  // Feedback
  if (showAnswer) {
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = `700 ${QUIZ_FB_SIZE}px ${s.displayFont}`;
    ctx.fillStyle = s.feedbackColor;
    const fbY = optStartY + optsBlockH + QUIZ_INNER_GAP + QUIZ_FB_SIZE / 2;
    ctx.fillText('✓ Correct!', W / 2, fbY);
    ctx.restore();
  }
}

/* ── Intro card (0‒2 s) ─────────────────────────────────── */
// Shows: category → course → topic with emoji, fading in nicely.

function drawIntroFrame(ctx, { s, topicTitle, topicEmoji, category, course, elapsed, logoImg }) {
  drawBg(ctx, s);

  const cx = W / 2;
  const fade = Math.min(1, elapsed / 0.4); // fade in over 0.4s
  ctx.save();
  ctx.globalAlpha = fade;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  // Logo icon at top
  if (logoImg) {
    const logoSize = 72;
    ctx.drawImage(logoImg, cx - logoSize / 2, 80, logoSize, logoSize);
  }

  // Category (small caps style) — display font
  ctx.font = `600 24px ${s.displayFont}`;
  ctx.fillStyle = s.subtext;
  ctx.fillText((category || '').toUpperCase(), cx, H / 2 - 120);

  // Course name — display font (heading)
  ctx.font = `700 40px ${s.displayFont}`;
  ctx.fillStyle = s.text;
  ctx.globalAlpha = fade;
  const courseLines = wrapText(ctx, course || '', BEAT_TEXT_MAX_W);
  const courseLH = 52;
  const courseStartY = H / 2 - 60;
  for (let i = 0; i < courseLines.length; i++) {
    ctx.fillText(courseLines[i], cx, courseStartY + i * courseLH, BEAT_TEXT_MAX_W);
  }

  // Divider line
  const divY = courseStartY + courseLines.length * courseLH + 24;
  ctx.strokeStyle = s.subtext;
  ctx.globalAlpha = fade * 0.3;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(cx - 80, divY);
  ctx.lineTo(cx + 80, divY);
  ctx.stroke();
  ctx.globalAlpha = fade;

  // Topic emoji + title
  const topicY = divY + 48;
  const emojiStr = topicEmoji || '';
  ctx.font = `${BEAT_EMOJI_SIZE}px ${s.displayFont}`;
  ctx.fillStyle = s.text;
  ctx.fillText(emojiStr, cx, topicY);

  ctx.font = `700 ${BEAT_FONT_SIZE}px ${s.displayFont}`;
  ctx.fillStyle = s.text;
  const titleLines = wrapText(ctx, topicTitle || '', BEAT_TEXT_MAX_W);
  const titleLH = BEAT_FONT_SIZE * BEAT_LINE_H;
  const titleStartY = topicY + BEAT_EMOJI_SIZE / 2 + 32;
  for (let i = 0; i < titleLines.length; i++) {
    ctx.fillText(titleLines[i], cx, titleStartY + i * titleLH, BEAT_TEXT_MAX_W);
  }

  // Watermark at bottom — display font
  ctx.font = `600 24px ${s.displayFont}`;
  ctx.fillStyle = s.subtext;
  ctx.globalAlpha = fade * 0.45;
  ctx.fillText('1minute.academy', cx, H - 60);

  ctx.restore();
}

/* ── Outro card (58‒60 s) ────────────────────────────────── */
// Shows: motivational tagline + URL + branding.

function drawOutroFrame(ctx, { s, elapsed, logoImg }) {
  drawBg(ctx, s);

  const cx = W / 2;
  const fade = Math.min(1, elapsed / 0.4);
  ctx.save();
  ctx.globalAlpha = fade;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  // Official logo
  if (logoImg) {
    const logoSize = 120;
    ctx.drawImage(logoImg, cx - logoSize / 2, H / 2 - 190, logoSize, logoSize);
  }

  // Tagline — display font
  ctx.font = `700 52px ${s.displayFont}`;
  ctx.fillStyle = s.text;
  ctx.fillText('One Minute. One Idea.', cx, H / 2 - 20);

  // Sub-tagline — body font
  ctx.font = `600 30px ${s.font}`;
  ctx.fillStyle = s.subtext;
  ctx.fillText('Micro-lessons that stick.', cx, H / 2 + 40);

  // URL — display font, accent color
  ctx.font = `700 36px ${s.displayFont}`;
  ctx.fillStyle = s.timerBg;
  ctx.fillText('1minute.academy', cx, H / 2 + 120);

  // Bottom credit — display font
  ctx.font = `500 22px ${s.displayFont}`;
  ctx.fillStyle = s.subtext;
  ctx.globalAlpha = fade * 0.55;
  ctx.fillText('© One Minute Academy', cx, H - 60);

  ctx.restore();
}

/* ── API check ────────────────────────────────────────────── */

export function isVideoExportSupported() {
  try {
    return (
      typeof VideoEncoder !== 'undefined' &&
      typeof VideoFrame !== 'undefined'
    );
  } catch {
    return false;
  }
}

/* ── Hook ─────────────────────────────────────────────────── */

export default function useVideoExport() {
  const [isExporting, setIsExporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [exportError, setExportError] = useState(null);
  // After encoding completes, store the blob so the UI can offer a real
  // user-gesture-driven save/share button (required on iOS Safari).
  const [readyBlob, setReadyBlob] = useState(null);   // { blob, fileName }
  const cancelRef = useRef(false);

  const cancelExport = useCallback(() => {
    cancelRef.current = true;
  }, []);

  const dismissVideo = useCallback(() => {
    setReadyBlob(null);
  }, []);

  /** Trigger the native share-sheet (mobile) or <a download> (desktop).
   *  MUST be called from a direct user-gesture handler so iOS Safari trusts it. */
  const saveVideo = useCallback(async () => {
    if (!readyBlob) return;
    const { blob, fileName } = readyBlob;

    // iOS / Android: prefer native share-sheet
    if (navigator.canShare) {
      try {
        const file = new File([blob], fileName, { type: 'video/mp4' });
        if (navigator.canShare({ files: [file] })) {
          await navigator.share({ files: [file], title: fileName });
          setReadyBlob(null);
          return;
        }
      } catch (shareErr) {
        if (shareErr?.name === 'AbortError') {
          // User dismissed share-sheet — keep readyBlob so they can retry
          return;
        }
        console.warn('[useVideoExport] share failed, falling back:', shareErr);
      }
    }

    // Desktop (or fallback): programmatic <a download>
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 30_000);
    setReadyBlob(null);
  }, [readyBlob]);

  const exportVideo = useCallback(async ({ topicRow, presentationStyle = 'focus' }) => {
    if (!topicRow) return;
    cancelRef.current = false;
    setIsExporting(true);
    setProgress(0);
    setExportError(null);

    const storyBeats = topicRow.story;
    const quiz = topicRow.quiz;
    const topicTitle = String(topicRow.title || 'Lesson');
    const topicEmoji = topicRow.emoji || '\ud83d\udcda';
    const category = topicRow.subject || '';
    const course = topicRow.subcategory || '';
    const s = getStyle(presentationStyle);

    try {
      // Pre-load logo image + dynamic import muxer in parallel
      const [logoImg, { Muxer, ArrayBufferTarget }] = await Promise.all([
        loadLogo(),
        import('mp4-muxer'),
      ]);

      const canvas = document.createElement('canvas');
      canvas.width = EXPORT_W;
      canvas.height = EXPORT_H;
      const ctx = canvas.getContext('2d');

      // On mobile (720p) scale down all drawing ops so the 1920×1080
      // coordinate system used by draw* functions maps to the smaller canvas.
      if (EXPORT_SCALE !== 1) {
        ctx.scale(EXPORT_SCALE, EXPORT_SCALE);
      }

      // ── Fast offline encoding via WebCodecs + mp4-muxer ──
      // All frames are rendered as fast as the CPU can draw them,
      // completely independent of wall-clock time.
      // Output is MP4 (H.264) — compatible with TikTok, Instagram, X, etc.

      const FPS = 30;
      const totalFrames = TOTAL_SECONDS * FPS; // 1800 frames

      // H.264 Baseline profile, level 4.0 (1080p30) / 3.1 (720p30)
      const codec = EXPORT_W > 1280 ? 'avc1.42002A' : 'avc1.42001F';

      const target = new ArrayBufferTarget();
      const muxer = new Muxer({
        target,
        video: { codec: 'avc', width: EXPORT_W, height: EXPORT_H },
        fastStart: 'in-memory',
      });

      let encoderError = null;
      let _annexBMode = false;   // true once we detect Annex B output
      let _gotDescription = false;

      const encoder = new VideoEncoder({
        output: (chunk, meta) => {
          // ── Happy path: encoder provided real decoderConfig ──
          // (Chrome, desktop Safari with avc format support)
          if (meta?.decoderConfig?.description) {
            muxer.addVideoChunk(chunk, meta);
            _gotDescription = true;
            return;
          }

          // ── iOS Safari fallback: Annex B without decoderConfig ──
          // Copy the raw encoded bytes so we can inspect / convert them.
          const raw = new Uint8Array(chunk.byteLength);
          chunk.copyTo(raw);

          // On the first keyframe, check if data is Annex B and extract
          // SPS + PPS to build the AVCDecoderConfigurationRecord that
          // mp4-muxer requires for the avcC box.
          if (chunk.type === 'key' && !_gotDescription && _isAnnexB(raw)) {
            _annexBMode = true;
            const nalus = _splitNALUs(raw);
            let sps = null, pps = null;
            for (const nalu of nalus) {
              const type = nalu[0] & 0x1F;
              if (type === 7 && !sps) sps = nalu;
              if (type === 8 && !pps) pps = nalu;
            }
            if (sps && pps) {
              const description = _buildAVCDescription(sps, pps);
              const syntheticMeta = {
                decoderConfig: {
                  codec,
                  description,
                  colorSpace: { primaries: 'bt709', transfer: 'bt709',
                                matrix: 'bt709', fullRange: false },
                },
              };
              const avcData = _annexBToAVC(raw);
              muxer.addVideoChunkRaw(
                avcData, chunk.type, chunk.timestamp, chunk.duration, syntheticMeta,
              );
              _gotDescription = true;
              return;
            }
          }

          // Subsequent frames in Annex B mode → convert data format
          if (_annexBMode) {
            const avcData = _annexBToAVC(raw);
            muxer.addVideoChunkRaw(
              avcData, chunk.type, chunk.timestamp, chunk.duration,
            );
            return;
          }

          // Fallback: pass through (shouldn't normally reach here)
          muxer.addVideoChunk(chunk, meta ?? undefined);
        },
        error: (e) => { encoderError = e; },
      });

      encoder.configure({
        codec,
        width: EXPORT_W,
        height: EXPORT_H,
        bitrate: EXPORT_W > 1280 ? 2_500_000 : 1_800_000,
        framerate: FPS,
        // Request AVC (length-prefixed NALU) output format.
        // Without this, some browsers (iOS Safari) default to Annex B,
        // which does NOT provide decoderConfig.description in output
        // metadata — mp4-muxer needs that for the avcC box.
        avc: { format: 'avc' },
      });

      const usPerFrame = Math.round(1_000_000 / FPS);
      // On mobile yield every 5 frames (~167ms of video) to let GC breathe;
      // on desktop yield every 30 frames (1 second of video).
      const yieldInterval = IS_MOBILE ? 5 : FPS;

      for (let frame = 0; frame <= totalFrames; frame++) {
        if (cancelRef.current || encoderError) break;

        const elapsedS = frame / FPS;
        const timeRemaining = Math.max(0, Math.ceil(TOTAL_SECONDS - elapsedS));

        // ── Segment dispatch ──
        // 0‒2 s  : intro card
        // 2‒50 s : 6 beats × 8 s
        // 50‒58 s: quiz (8 s)
        // 58‒60 s: outro card

        if (elapsedS < INTRO_S) {
          // ── Intro ──
          drawIntroFrame(ctx, {
            s,
            topicTitle,
            topicEmoji,
            category,
            course,
            elapsed: elapsedS,
            logoImg,
          });

        } else if (elapsedS < QUIZ_START_S) {
          // ── Story beats ──
          const beatTime = elapsedS - BEATS_START_S;
          const beatIdx = Math.min(BEATS.length - 1, Math.floor(beatTime / BEAT_DURATION_S));
          const beatKey = BEATS[beatIdx];
          const beatData = storyBeats?.[beatKey];
          const beatElapsed = beatTime - beatIdx * BEAT_DURATION_S;
          drawBeatFrame(ctx, {
            s,
            visual: beatData?.visual,
            text: beatData?.text,
            topicTitle,
            topicEmoji,
            timeRemaining,
            fadeIn: Math.min(1, beatElapsed / 0.5),
            beatIdx,
            elapsedS,
          });

        } else if (elapsedS < OUTRO_START_S) {
          // ── Quiz ──
          const quizElapsed = elapsedS - QUIZ_START_S;
          drawQuizFrame(ctx, {
            s,
            question: quiz?.question || '',
            options: quiz?.options || [],
            correct: quiz?.correct ?? 0,
            topicTitle,
            topicEmoji,
            timeRemaining,
            showAnswer: quizElapsed >= 3,
          });

        } else {
          // ── Outro ──
          drawOutroFrame(ctx, {
            s,
            elapsed: elapsedS - OUTRO_START_S,
            logoImg,
          });
        }

        // Encode the frame with proper timestamp
        const videoFrame = new VideoFrame(canvas, {
          timestamp: frame * usPerFrame,
        });
        encoder.encode(videoFrame, { keyFrame: frame % (FPS * 2) === 0 });
        videoFrame.close();

        // Backpressure: if the encoder queue is deep, wait for it to drain
        // so we don't pile up uncompressed frames in memory (critical on iOS).
        while (encoder.encodeQueueSize > 5) {
          await new Promise((r) => setTimeout(r, 1));
        }

        // Yield periodically to keep UI responsive and let GC reclaim memory
        if (frame % yieldInterval === 0) {
          setProgress(frame / totalFrames);
          await new Promise((r) => setTimeout(r, 0));
        }
      }

      if (encoderError) throw encoderError;

      // Flush remaining encoded frames and finalize container
      await encoder.flush();
      encoder.close();
      muxer.finalize();

      if (!cancelRef.current) {
        setProgress(1);
        const blob = new Blob([target.buffer], { type: 'video/mp4' });
        const safeName = topicTitle
          .replace(/[^a-zA-Z0-9 _-]/g, '')
          .replace(/\s+/g, '_')
          .slice(0, 60);
        const fileName = `${safeName}_OneMinuteAcademy.mp4`;

        // Store the blob so the UI can present a user-gesture-driven
        // save/share button (required on iOS Safari).
        // On desktop, auto-download immediately (programmatic a.click works fine).
        const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
        if (isMobile) {
          setReadyBlob({ blob, fileName });
        } else {
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = fileName;
          a.style.display = 'none';
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          setTimeout(() => URL.revokeObjectURL(url), 30_000);
        }
      }
    } catch (err) {
      console.error('[useVideoExport] export failed:', err);
      setExportError(err?.message || 'Video export failed. Your browser may not support this feature.');
    } finally {
      setIsExporting(false);
      setProgress(0);
    }
  }, []);

  return { exportVideo, isExporting, progress, cancelExport, readyBlob, saveVideo, dismissVideo, exportError };
}
