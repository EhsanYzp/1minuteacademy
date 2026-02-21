# Content Audit Instructions

## Purpose

This folder holds timestamped beat-audit reports for every content quality sweep
across all `.topic.json` files.

## How to run an audit

1. From the project root, run:

   ```bash
   node scripts/_auditBeats.mjs
   ```

   Optional: write to a specific path:

   ```bash
   node scripts/_auditBeats.mjs --out=docs/content-audits/content-audit-YYYY-MM-DD.md
   ```

2. The script scans **every** `.topic.json` in `content/topics/` and writes a
   timestamped Markdown report directly into this folder:

   - `docs/content-audits/content-audit-YYYY-MM-DD.md`

   If a report for that date already exists, the script auto-suffixes:

   - `content-audit-YYYY-MM-DD-2.md`, `content-audit-YYYY-MM-DD-3.md`, etc.

> **Copilot / AI assistant rule:** whenever the user asks for a content audit,
> run the script above, then save the resulting report in this folder using the
> timestamped naming convention.

## Naming convention

```
content-audit-YYYY-MM-DD.md
```

If multiple audits happen on the same day, append a suffix:

```
content-audit-YYYY-MM-DD-2.md
```

## What the audit checks

| # | Check | Description |
|---|-------|-------------|
| 1 | empty-text | Beat has no text |
| 2 | missing-visual | Beat has no emoji visual |
| 3 | too-short | Beat text < 20 chars |
| 4 | bad-ending | Doesn't end with valid punctuation |
| 5 | ellipsis-ending | Ends with `…` or `...` (truncation) |
| 6 | space-before-punct | Space before final punctuation |
| 7 | unbalanced-quotes | Mismatched smart quotes / parens |
| 8 | dangling-preposition | Bare article/preposition at end of list |
| 8b | dangling-conjunction | List cut off at `, and.` / `, or.` |
| 9 | markup-artifacts | Contains `{}`, `[]`, `<>` (JSON/HTML) |
| 10 | repeated-word | Same word repeated at end |
| 11 | lowercase-start | Beat starts with lowercase |
| 12 | control-chars | Contains control characters |
| 13 | title-as-text | Beat text = topic title (placeholder) |
| 14 | duplicate-beat | Two beats have identical text |
| 15 | near-duplicate | Two beats share first 40 chars |
| 16 | over-limit | Beat exceeds max length (130 beats / 90 punchline) |
| 17 | unbalanced-parens | Mismatched `(` and `)` |
| 18 | unbalanced-ascii-quotes | Odd number of `"` characters |
| 19 | template-placeholders | Contains `[audience]`, `{verb}`, `{{name}}` placeholders |
| 20 | contains-url | Beat contains `http(s)://` |
| 21 | replacement-char | Contains `\uFFFD` (encoding damage) |
| 22 | contains-newline | Beat contains newline/tab characters |
| 23 | double-space | Beat contains repeated whitespace |
| 24 | repeated-punct | Beat ends with `??` / `!!` / `..` |
