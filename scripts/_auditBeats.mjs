#!/usr/bin/env node
/**
 * _auditBeats.mjs
 *
 * Deep-audit every beat in every .topic.json file.
 * Flags beats that look corrupted, incomplete, or damaged.
 *
 * Outputs a Markdown report to docs/beat-audit-report.md
 */

import fs from 'node:fs/promises';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const TOPICS_DIR = path.join(ROOT, 'content', 'topics');
const AUDITS_DIR = path.join(ROOT, 'docs', 'content-audits');
const REPORT_PATH = path.join(AUDITS_DIR, `content-audit-${new Date().toISOString().slice(0, 10)}.md`);

const BEAT_NAMES = ['hook', 'buildup', 'discovery', 'twist', 'climax', 'punchline'];

const VALID_ENDINGS = new Set([
  '.', '!', '?', ')', "'", '"', ':', ';',
  '\u2019', // right single curly quote
  '\u201D', // right double curly quote
]);

/* ── Helpers ──────────────────────────────────────────────────────── */

async function listFiles(dir, predicate) {
  let entries;
  try { entries = await fs.readdir(dir, { withFileTypes: true }); } catch { return []; }
  const out = [];
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...(await listFiles(full, predicate)));
    else if (e.isFile() && predicate(e.name)) out.push(full);
  }
  return out;
}

/* ── Individual beat checks ──────────────────────────────────────── */

function auditBeat(beatName, node, topicTitle) {
  const issues = [];
  if (!node || typeof node !== 'object') {
    issues.push({ check: 'missing-beat', detail: `Beat "${beatName}" is missing or not an object.` });
    return issues;
  }

  const text = (node.text ?? '').trim();
  const visual = (node.visual ?? '').trim();

  // 1. Empty / missing text
  if (!text) {
    issues.push({ check: 'empty-text', detail: `Beat "${beatName}" has empty or missing text.` });
    return issues; // no point checking further
  }

  // 2. Missing visual
  if (!visual) {
    issues.push({ check: 'missing-visual', detail: `Beat "${beatName}" has no visual emoji.` });
  }

  // 3. Suspiciously short text (< 20 chars for a beat)
  if (text.length < 20) {
    issues.push({ check: 'too-short', detail: `Beat "${beatName}" is only ${text.length} chars: "${text}"` });
  }

  // 4. Doesn't end with valid punctuation
  const lastChar = text[text.length - 1];
  if (!VALID_ENDINGS.has(lastChar)) {
    issues.push({
      check: 'bad-ending',
      detail: `Beat "${beatName}" ends with "${lastChar}" (U+${lastChar.codePointAt(0).toString(16).toUpperCase().padStart(4, '0')}) — not valid punctuation. Tail: "…${text.slice(-30)}"`,
    });
  }

  // 5. Ends with ellipsis — classic truncation
  const tail = text.slice(-10);
  if (tail.includes('\u2026') || tail.includes('...')) {
    issues.push({
      check: 'ellipsis-ending',
      detail: `Beat "${beatName}" ends with ellipsis (truncation): "…${text.slice(-40)}"`,
    });
  }

  // 6. Space before final punctuation — "word ."
  if (text.length >= 2 && text[text.length - 2] === ' ' && VALID_ENDINGS.has(lastChar)) {
    issues.push({
      check: 'space-before-punct',
      detail: `Beat "${beatName}" has space before final punctuation: "…${text.slice(-15)}"`,
    });
  }

  // 7. Unbalanced smart quotes or parentheses
  const openQ  = (text.match(/[\u201C(]/g) || []).length;
  const closeQ = (text.match(/[\u201D)]/g) || []).length;
  if (openQ > closeQ) {
    issues.push({
      check: 'unbalanced-quotes',
      detail: `Beat "${beatName}" has ${openQ} open vs ${closeQ} close quotes/parens — possible truncation.`,
    });
  }

  // 8. Ends with a bare article (the, a, an) — these NEVER validly end a sentence.
  //    Or a preposition right after a comma — list was cut off.
  //    Stranded prepositions ("came from.", "live without.") are valid English, so
  //    we only flag prepositions when preceded by a comma (list context).
  if (/\b(the|a|an)\s*[.!?;:]+$/i.test(text)
      || /,\s*(of|with|from|between|about|into|through|within|among|beyond)\s*[.!?;:]+$/i.test(text)) {
    const ending = text.slice(-40);
    issues.push({
      check: 'dangling-preposition',
      detail: `Beat "${beatName}" ends with a bare preposition/article — likely truncated: "…${ending}"`,
    });
  }

  // 8b. Ends with ", and." / ", or." / ", but." — list or sentence clearly cut off.
  //     Only flag when preceded by a comma (list context).
  //     "yet" alone is a valid adverb ending, so excluded.
  if (/,\s*(and|or|nor|but|so)\s*[.!?;:]+$/i.test(text)) {
    const ending = text.slice(-40);
    issues.push({
      check: 'dangling-conjunction',
      detail: `Beat "${beatName}" ends with a list/sentence cut off at conjunction: "…${ending}"`,
    });
  }

  // 9. Contains raw JSON / markup artifacts
  if (/[{}\[\]<>]/.test(text) && !/\d+[%$]/.test(text)) {
    // Allow angle brackets only if they look like math ($2.13/hr < min wage)
    const stripped = text.replace(/\$[\d,.]+/g, '').replace(/\d+%/g, '');
    if (/[{}\[\]]/.test(stripped) || (/<[a-z/]/.test(stripped))) {
      issues.push({
        check: 'markup-artifacts',
        detail: `Beat "${beatName}" may contain JSON/HTML artifacts: "${text.slice(0, 60)}"`,
      });
    }
  }

  // 10. Repeated words at end — "the the." or "is is."
  if (/\b(\w+)\s+\1\s*[.!?;:]+$/i.test(text)) {
    issues.push({
      check: 'repeated-word',
      detail: `Beat "${beatName}" has a repeated word near the end: "…${text.slice(-30)}"`,
    });
  }

  // 11. Starts with lowercase (unexpected for a beat opener)
  if (/^[a-z]/.test(text)) {
    issues.push({
      check: 'lowercase-start',
      detail: `Beat "${beatName}" starts with lowercase: "${text.slice(0, 40)}…"`,
    });
  }

  // 12. Contains control characters or null bytes
  if (/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/.test(text)) {
    issues.push({
      check: 'control-chars',
      detail: `Beat "${beatName}" contains control characters.`,
    });
  }

  // 13. Cut mid-word — last "word" is a single consonant (not I/a) before punctuation
  //      e.g. "the solution i." but NOT "UI." "CI." "AI." "Y."
  // Skip this check — too many valid abbreviations create false positives.

  // 14. Identical text to topic title (placeholder not replaced)
  if (text === topicTitle) {
    issues.push({
      check: 'title-as-text',
      detail: `Beat "${beatName}" text is identical to the topic title — likely a placeholder.`,
    });
  }

  return issues;
}

/* ── Cross-beat checks (within one story) ────────────────────────── */

function auditStory(story, topicTitle) {
  const issues = [];
  if (!story || typeof story !== 'object') {
    issues.push({ check: 'missing-story', detail: 'The "story" object is missing entirely.' });
    return issues;
  }

  // Per-beat checks
  for (const beat of BEAT_NAMES) {
    issues.push(...auditBeat(beat, story[beat], topicTitle));
  }

  // Cross-beat: duplicate text across beats
  const texts = BEAT_NAMES.map(b => (story[b]?.text ?? '').trim()).filter(Boolean);
  const seen = new Map();
  for (let i = 0; i < texts.length; i++) {
    const t = texts[i];
    if (seen.has(t)) {
      issues.push({
        check: 'duplicate-beat',
        detail: `Beats "${BEAT_NAMES[seen.get(t)]}" and "${BEAT_NAMES[i]}" have identical text.`,
      });
    }
    seen.set(t, i);
  }

  // Cross-beat: very high textual similarity (first 40 chars match)
  for (let i = 0; i < texts.length; i++) {
    for (let j = i + 1; j < texts.length; j++) {
      if (texts[i].slice(0, 40) === texts[j].slice(0, 40) && texts[i] !== texts[j]) {
        issues.push({
          check: 'near-duplicate',
          detail: `Beats "${BEAT_NAMES[i]}" and "${BEAT_NAMES[j]}" start with the same 40 chars — possible copy-paste.`,
        });
      }
    }
  }

  return issues;
}

/* ── Main ────────────────────────────────────────────────────────── */

async function main() {
  const files = await listFiles(TOPICS_DIR, n => n.endsWith('.topic.json'));
  files.sort();

  console.log(`Auditing ${files.length} topic files…`);

  const findings = []; // { file, title, issues[] }
  let totalIssues = 0;

  for (const file of files) {
    let data;
    try {
      data = JSON.parse(await fs.readFile(file, 'utf8'));
    } catch (e) {
      findings.push({ file, title: '(parse error)', issues: [{ check: 'bad-json', detail: e.message }] });
      totalIssues++;
      continue;
    }

    const title = data.title ?? '(untitled)';
    const issues = auditStory(data.story, title);

    if (issues.length > 0) {
      findings.push({ file: path.relative(ROOT, file), title, issues });
      totalIssues += issues.length;
    }
  }

  /* ── Build report ──────────────────────────────────────────────── */

  const lines = [
    '# Beat Audit Report',
    '',
    `> Generated ${new Date().toISOString().slice(0, 10)}`,
    `> Scanned **${files.length}** topic files — found **${totalIssues}** issues across **${findings.length}** files.`,
    '',
  ];

  if (findings.length === 0) {
    lines.push('✅ No issues found — all beats look healthy.');
  } else {
    // Summary by check type
    const byCat = {};
    for (const f of findings) for (const i of f.issues) {
      byCat[i.check] = (byCat[i.check] || 0) + 1;
    }
    lines.push('## Summary by issue type', '');
    lines.push('| Check | Count |', '|-------|------:|');
    for (const [k, v] of Object.entries(byCat).sort((a, b) => b[1] - a[1])) {
      lines.push(`| ${k} | ${v} |`);
    }
    lines.push('');

    // Detailed findings
    lines.push('## Detailed findings', '');
    for (const f of findings) {
      lines.push(`### ${f.title}`, '');
      lines.push(`**File:** \`${f.file}\``, '');
      for (const i of f.issues) {
        lines.push(`- **${i.check}** — ${i.detail}`);
      }
      lines.push('');
    }
  }

  await fs.writeFile(REPORT_PATH, lines.join('\n'), 'utf8');
  console.log(`\nWrote report to ${path.relative(ROOT, REPORT_PATH)}`);
  console.log(`  ${files.length} files scanned, ${totalIssues} issues in ${findings.length} files.`);
}

main().catch(e => { console.error(e); process.exit(1); });
