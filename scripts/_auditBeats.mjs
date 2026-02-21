#!/usr/bin/env node
/**
 * _auditBeats.mjs
 *
 * Deep-audit every beat in every .topic.json file.
 * Flags beats that look corrupted, incomplete, or damaged.
 *
 * Outputs a timestamped Markdown report to docs/content-audits/
 */

import fs from 'node:fs/promises';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const TOPICS_DIR = path.join(ROOT, 'content', 'topics');
const AUDITS_DIR = path.join(ROOT, 'docs', 'content-audits');

function localDateYYYYMMDD(d = new Date()) {
  const yyyy = String(d.getFullYear());
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

const DEFAULT_REPORT_PATH = path.join(AUDITS_DIR, `content-audit-${localDateYYYYMMDD()}.md`);

const BEAT_NAMES = ['hook', 'buildup', 'discovery', 'twist', 'climax', 'punchline'];

// Validation tolerances (generation targets are stricter elsewhere)
const MAX_LEN = { hook: 130, buildup: 130, discovery: 130, twist: 130, climax: 130, punchline: 90 };

const VALID_ENDINGS = new Set([
  '.', '!', '?', ')', "'", '"', ':', ';',
  '\u2019', // right single curly quote
  '\u201D', // right double curly quote
]);

const SEVERITY = {
  high: 'high',
  medium: 'medium',
  low: 'low',
};

const CHECK_SEVERITY = {
  // High signal / likely broken
  'bad-json': SEVERITY.high,
  'missing-story': SEVERITY.high,
  'missing-beat': SEVERITY.high,
  'empty-text': SEVERITY.high,
  'bad-ending': SEVERITY.high,
  'ellipsis-ending': SEVERITY.high,
  'dangling-preposition': SEVERITY.high,
  'dangling-conjunction': SEVERITY.high,
  'unbalanced-quotes': SEVERITY.high,
  'unbalanced-parens': SEVERITY.high,
  'unbalanced-ascii-quotes': SEVERITY.high,
  'over-limit': SEVERITY.high,

  // Medium signal
  'missing-visual': SEVERITY.medium,
  'markup-artifacts': SEVERITY.medium,
  'control-chars': SEVERITY.medium,
  'replacement-char': SEVERITY.medium,
  'duplicate-beat': SEVERITY.medium,
  'near-duplicate': SEVERITY.medium,
  'template-placeholders': SEVERITY.medium,
  'contains-url': SEVERITY.medium,

  // Low signal / style issues
  'too-short': SEVERITY.low,
  'lowercase-start': SEVERITY.low,
  'space-before-punct': SEVERITY.low,
  'repeated-word': SEVERITY.low,
  'double-space': SEVERITY.low,
  'contains-newline': SEVERITY.low,
  'repeated-punct': SEVERITY.low,
  'title-as-text': SEVERITY.low,
};

function severityForCheck(check) {
  return CHECK_SEVERITY[check] ?? SEVERITY.medium;
}

function countMatches(str, re) {
  const m = str.match(re);
  return m ? m.length : 0;
}

async function fileExists(fp) {
  try {
    await fs.access(fp);
    return true;
  } catch {
    return false;
  }
}

async function chooseNonCollidingPath(basePath) {
  if (!(await fileExists(basePath))) return basePath;
  const ext = path.extname(basePath);
  const stem = basePath.slice(0, -ext.length);
  for (let i = 2; i < 1000; i++) {
    const candidate = `${stem}-${i}${ext}`;
    if (!(await fileExists(candidate))) return candidate;
  }
  return basePath;
}

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

  // 3b. Over length limit (validation tolerance)
  const maxLen = MAX_LEN[beatName];
  if (typeof maxLen === 'number' && text.length > maxLen) {
    issues.push({
      check: 'over-limit',
      detail: `Beat "${beatName}" is ${text.length} chars (max ${maxLen}). Tail: "…${text.slice(-30)}"`,
    });
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

  // 7b. Unbalanced ASCII parentheses
  const openParens = countMatches(text, /\(/g);
  const closeParens = countMatches(text, /\)/g);
  if (openParens !== closeParens) {
    issues.push({
      check: 'unbalanced-parens',
      detail: `Beat "${beatName}" has ${openParens} "(" vs ${closeParens} ")" — possible truncation.`,
    });
  }

  // 7c. Unbalanced ASCII double-quotes
  const asciiQuotes = countMatches(text, /"/g);
  if (asciiQuotes % 2 === 1) {
    issues.push({
      check: 'unbalanced-ascii-quotes',
      detail: `Beat "${beatName}" has an odd number of ASCII quotes (\").`,
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

  // 9b. Template placeholders (common content-gen artifacts)
  // Examples: "I help [audience] achieve [outcome]" or "{verb} {object}" or "{{name}}"
  if (/\[[^\]]{2,}\]/.test(text) || /\{\{[^}]+\}\}/.test(text) || /\{[a-z_][a-z0-9_]*\}/i.test(text)) {
    issues.push({
      check: 'template-placeholders',
      detail: `Beat "${beatName}" may contain template placeholders: "${text.slice(0, 80)}"`,
    });
  }

  // 9c. URLs inside beats (often unintended)
  if (/\bhttps?:\/\//i.test(text)) {
    issues.push({
      check: 'contains-url',
      detail: `Beat "${beatName}" contains a URL — verify it's intended.`,
    });
  }

  // 9d. Replacement character (usually decoding/copy-paste damage)
  if (text.includes('\uFFFD')) {
    issues.push({
      check: 'replacement-char',
      detail: `Beat "${beatName}" contains the Unicode replacement character (\uFFFD).`,
    });
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

  // 12b. Newlines/tabs inside the beat text (formatting damage)
  if (/[\r\n\t]/.test(node.text ?? '')) {
    issues.push({
      check: 'contains-newline',
      detail: `Beat "${beatName}" contains newline/tab characters.`,
    });
  }

  // 12c. Double spaces (often a minor formatting artifact)
  if (/\s{2,}/.test(text)) {
    issues.push({
      check: 'double-space',
      detail: `Beat "${beatName}" contains repeated whitespace.`,
    });
  }

  // 12d. Repeated punctuation at end ("??" / "!!" / "..")
  if (/[!?]{2,}$/.test(text) || /\.{2,}$/.test(text)) {
    issues.push({
      check: 'repeated-punct',
      detail: `Beat "${beatName}" ends with repeated punctuation: "…${text.slice(-10)}"`,
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
  const outArg = process.argv.find(a => a.startsWith('--out='));
  const requestedPath = outArg ? path.resolve(ROOT, outArg.slice('--out='.length)) : DEFAULT_REPORT_PATH;
  const reportPath = outArg ? requestedPath : await chooseNonCollidingPath(requestedPath);

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

  await fs.mkdir(path.dirname(reportPath), { recursive: true });

  const lines = [
    '# Beat Audit Report',
    '',
    `> Generated ${new Date().toISOString()}`,
    `> Scanned **${files.length}** topic files — found **${totalIssues}** issues across **${findings.length}** files.`,
    `> Output: \`${path.relative(ROOT, reportPath)}\``,
    '',
  ];

  if (findings.length === 0) {
    lines.push('✅ No issues found — all beats look healthy.');
  } else {
    // Summary by check type
    const byCat = {};
    const bySeverity = { [SEVERITY.high]: 0, [SEVERITY.medium]: 0, [SEVERITY.low]: 0 };
    for (const f of findings) for (const i of f.issues) {
      byCat[i.check] = (byCat[i.check] || 0) + 1;
      bySeverity[severityForCheck(i.check)]++;
    }

    lines.push('## Summary by severity', '');
    lines.push('| Severity | Count |', '|----------|------:|');
    lines.push(`| high | ${bySeverity[SEVERITY.high]} |`);
    lines.push(`| medium | ${bySeverity[SEVERITY.medium]} |`);
    lines.push(`| low | ${bySeverity[SEVERITY.low]} |`);
    lines.push('');

    lines.push('## Summary by issue type', '');
    lines.push('| Check | Severity | Count |', '|-------|----------|------:|');
    for (const [k, v] of Object.entries(byCat).sort((a, b) => b[1] - a[1])) {
      lines.push(`| ${k} | ${severityForCheck(k)} | ${v} |`);
    }
    lines.push('');

    // Detailed findings
    lines.push('## Detailed findings', '');
    for (const f of findings) {
      lines.push(`### ${f.title}`, '');
      lines.push(`**File:** \`${f.file}\``, '');
      for (const i of f.issues) {
        lines.push(`- **${severityForCheck(i.check)} / ${i.check}** — ${i.detail}`);
      }
      lines.push('');
    }
  }

  await fs.writeFile(reportPath, lines.join('\n'), 'utf8');
  console.log(`\nWrote report to ${path.relative(ROOT, reportPath)}`);
  console.log(`  ${files.length} files scanned, ${totalIssues} issues in ${findings.length} files.`);
}

main().catch(e => { console.error(e); process.exit(1); });
