import { useState, useCallback, useRef } from 'react';

/* ── Constants ─────────────────────────────────────────────── */

const BEATS = ['hook', 'buildup', 'discovery', 'twist', 'climax', 'punchline'];
const BEAT_DURATION_S = 8;
const TOTAL_SECONDS = 60;
const W = 1920;
const H = 1080;
const FLOAT_CYCLE_S = 3; // matches CSS @keyframes float (3s ease-in-out infinite)
const FLOAT_AMPLITUDE = 14; // pixels up/down

/* ── Per-style visual config (mirrors story.css) ──────────── */

const STYLES = {
  focus: {
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
    font: 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
  },
  dark: {
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
    font: 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
  },
  terminal: {
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
    font: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
  },
  glass: {
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
    font: 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
  },
  paper: {
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
    font: 'Georgia, "Times New Roman", serif',
  },
  bold: {
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
    font: 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
    textScale: 1.15,
  },
  cards: {
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
    font: 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
  },
  split: {
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
    font: 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
  },
  minimal: {
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
    font: 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
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
  ctx.font = `bold 28px ${s.font}`;
  ctx.fillStyle = s.subtext;
  ctx.fillText('🎓  One Minute Academy', W / 2, 52);
  ctx.restore();
}

function drawTopicTitle(ctx, s, title, emoji) {
  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `bold 36px ${s.font}`;
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
  ctx.font = `800 30px ${s.font}`;
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
  ctx.font = `600 26px ${s.font}`;
  ctx.fillStyle = s.subtext;
  ctx.globalAlpha = 0.45;
  ctx.fillText('1minute.academy', W / 2, H - 50);
  ctx.globalAlpha = 1;
  ctx.restore();
}

/* ── Beat frame ───────────────────────────────────────────── */

function drawBeatFrame(ctx, { s, visual, text, topicTitle, topicEmoji, timeRemaining, fadeIn = 1, beatIdx = 0, elapsedS = 0 }) {
  drawBg(ctx, s);
  drawBranding(ctx, s);
  drawTopicTitle(ctx, s, topicTitle, topicEmoji);

  ctx.save();
  ctx.globalAlpha = Math.max(0, Math.min(1, fadeIn));

  // Floating emoji — sinusoidal bob matching the CSS animation
  const floatOffset = Math.sin((elapsedS / FLOAT_CYCLE_S) * Math.PI * 2) * FLOAT_AMPLITUDE;
  ctx.font = `120px ${s.font}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = s.text;
  ctx.fillText(visual || '📚', W / 2, 310 + floatOffset);

  // Beat text (word-wrapped, centered)
  const scale = s.textScale || 1;
  const fontSize = Math.round(52 * scale);
  ctx.font = `800 ${fontSize}px ${s.font}`;
  ctx.fillStyle = s.text;
  const lines = wrapText(ctx, text, W - 240);
  const lh = fontSize * 1.35;
  const totalHeight = lines.length * lh;
  const textCenterY = 600;
  const startY = textCenterY - totalHeight / 2 + lh / 2;
  for (let i = 0; i < lines.length; i++) {
    ctx.fillText(lines[i], W / 2, startY + i * lh, W - 160);
  }

  ctx.restore();

  drawBeatDots(ctx, s, beatIdx);
  drawTimer(ctx, s, timeRemaining);
  drawWatermark(ctx, s);
}

/* ── Quiz frame ───────────────────────────────────────────── */

function drawQuizFrame(ctx, { s, question, options, correct, topicTitle, topicEmoji, timeRemaining, showAnswer }) {
  drawBg(ctx, s);
  drawBranding(ctx, s);
  drawTopicTitle(ctx, s, topicTitle, topicEmoji);

  // "QUICK QUIZ" header
  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `900 22px ${s.font}`;
  ctx.fillStyle = s.subtext;
  ctx.fillText('QUICK QUIZ', W / 2, 175);
  ctx.restore();

  // Question
  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `800 42px ${s.font}`;
  ctx.fillStyle = s.text;
  const qLines = wrapText(ctx, question, W - 240);
  const qlh = 56;
  const qStartY = 260;
  for (let i = 0; i < qLines.length; i++) {
    ctx.fillText(qLines[i], W / 2, qStartY + i * qlh, W - 160);
  }
  ctx.restore();

  // Options — single column, centered
  const opts = Array.isArray(options) ? options : [];
  const optW = Math.min(800, W - 200);
  const optH = 76;
  const optGap = 16;
  const optStartX = (W - optW) / 2;
  const optStartY = qStartY + qLines.length * qlh + 50;

  for (let i = 0; i < opts.length; i++) {
    const x = optStartX;
    const y = optStartY + i * (optH + optGap);
    const isCorrect = i === correct;

    ctx.save();
    rrPath(ctx, x, y, optW, optH, 16);

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

    const dimmed = showAnswer && !isCorrect;
    ctx.globalAlpha = dimmed ? 0.35 : 1;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.font = `600 30px ${s.font}`;
    ctx.fillStyle = s.optText;
    ctx.fillText(String(opts[i] ?? ''), x + 24, y + optH / 2, optW - 48);

    ctx.restore();
  }

  // Feedback
  if (showAnswer) {
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = `800 40px ${s.font}`;
    ctx.fillStyle = s.feedbackColor;
    const fbY = optStartY + opts.length * (optH + optGap) + 24;
    ctx.fillText('✓ Correct!', W / 2, fbY);
    ctx.restore();
  }

  drawTimer(ctx, s, timeRemaining);
  drawWatermark(ctx, s);
}

/* ── API check ────────────────────────────────────────────── */

export function isVideoExportSupported() {
  try {
    return (
      typeof MediaRecorder !== 'undefined' &&
      typeof HTMLCanvasElement?.prototype?.captureStream === 'function'
    );
  } catch {
    return false;
  }
}

/* ── Hook ─────────────────────────────────────────────────── */

export default function useVideoExport() {
  const [isExporting, setIsExporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [phase, setPhase] = useState('');
  const cancelRef = useRef(false);

  const cancelExport = useCallback(() => {
    cancelRef.current = true;
  }, []);

  const exportVideo = useCallback(async ({ topicRow, presentationStyle = 'focus' }) => {
    if (!topicRow) return;
    cancelRef.current = false;
    setIsExporting(true);
    setProgress(0);
    setPhase('Starting…');

    const storyBeats = topicRow.story;
    const quiz = topicRow.quiz;
    const topicTitle = String(topicRow.title || 'Lesson');
    const topicEmoji = topicRow.emoji || '📚';
    const s = getStyle(presentationStyle);

    try {
      const canvas = document.createElement('canvas');
      canvas.width = W;
      canvas.height = H;
      const ctx = canvas.getContext('2d');

      // ── Virtual-time, frame-by-frame recording ──────────
      // Instead of tying to wall-clock via requestAnimationFrame (which
      // throttles / drifts), we step through virtual time at a fixed FPS.
      // This guarantees exactly 60 s of video with no lag or frame drops.

      const FPS = 30;
      const totalFrames = TOTAL_SECONDS * FPS;          // 1800 frames
      const frameDurationMs = 1000 / FPS;               // ~33.3 ms

      const stream = canvas.captureStream(FPS);

      // Pick best supported codec
      let mimeType = 'video/webm;codecs=vp9';
      if (typeof MediaRecorder.isTypeSupported !== 'function' || !MediaRecorder.isTypeSupported(mimeType)) {
        mimeType = 'video/webm;codecs=vp8';
        if (typeof MediaRecorder.isTypeSupported !== 'function' || !MediaRecorder.isTypeSupported(mimeType)) {
          mimeType = 'video/webm';
        }
      }

      const recorder = new MediaRecorder(stream, {
        mimeType,
        videoBitsPerSecond: 2_500_000,
      });

      const chunks = [];
      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) chunks.push(e.data);
      };

      recorder.start(500);

      // Small helper – awaitable delay
      const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

      let prevSecond = -1;

      for (let frame = 0; frame <= totalFrames; frame++) {
        if (cancelRef.current) break;

        const elapsedS = frame / FPS;
        const timeRemaining = Math.max(0, Math.ceil(TOTAL_SECONDS - elapsedS));
        const second = Math.floor(elapsedS);

        // Update React progress at most once per virtual second
        if (second !== prevSecond) {
          prevSecond = second;
          setProgress(frame / totalFrames);
        }

        const beatIdx = Math.min(BEATS.length, Math.floor(elapsedS / BEAT_DURATION_S));
        const inQuiz = beatIdx >= BEATS.length;

        if (inQuiz) {
          const quizElapsed = elapsedS - BEATS.length * BEAT_DURATION_S;
          setPhase('Quiz');
          drawQuizFrame(ctx, {
            s,
            question: quiz?.question || '',
            options: quiz?.options || [],
            correct: quiz?.correct ?? 0,
            topicTitle,
            topicEmoji,
            timeRemaining,
            showAnswer: quizElapsed >= 4,
          });
        } else {
          const beatKey = BEATS[beatIdx];
          const beatData = storyBeats?.[beatKey];
          const beatElapsed = elapsedS - beatIdx * BEAT_DURATION_S;
          const fadeIn = Math.min(1, beatElapsed / 0.5);

          setPhase(`Beat ${beatIdx + 1} of ${BEATS.length}`);
          drawBeatFrame(ctx, {
            s,
            visual: beatData?.visual,
            text: beatData?.text,
            topicTitle,
            topicEmoji,
            timeRemaining,
            fadeIn,
            beatIdx,
            elapsedS,
          });
        }

        // Yield to let the MediaRecorder capture this frame.
        // A short sleep keeps the browser responsive and gives
        // the encoder time to consume the canvas content.
        await sleep(frameDurationMs);
      }

      // Stop & wait for final data
      if (recorder.state !== 'inactive') {
        recorder.stop();
      }
      await new Promise((resolve) => {
        if (recorder.state === 'inactive') { resolve(); return; }
        recorder.onstop = resolve;
      });
      // Extra settle time for the encoder to flush
      await sleep(300);

      if (!cancelRef.current && chunks.length > 0) {
        setPhase('Downloading…');
        const blob = new Blob(chunks, { type: mimeType.split(';')[0] || 'video/webm' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        const safeName = topicTitle
          .replace(/[^a-zA-Z0-9 _-]/g, '')
          .replace(/\s+/g, '_')
          .slice(0, 60);
        a.download = `${safeName}_OneMinuteAcademy.webm`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(url), 10_000);
      }
    } catch (err) {
      console.error('[useVideoExport] export failed:', err);
    } finally {
      setIsExporting(false);
      setProgress(0);
      setPhase('');
    }
  }, []);

  return { exportVideo, isExporting, progress, phase, cancelExport };
}
