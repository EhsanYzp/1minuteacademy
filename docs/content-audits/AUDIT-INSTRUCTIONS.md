# Content Audit Instructions

## Purpose

This folder holds timestamped beat-audit reports for every content quality sweep
across all `.topic.json` files.

## How to run an audit

1. From the project root, run:

   ```bash
   node scripts/_auditBeats.mjs
   ```

2. The script scans **every** `.topic.json` in `content/topics/`, runs 15+
   heuristic checks on each beat, and writes a Markdown report to
   `docs/beat-audit-report.md`.

3. **Rename** (or copy) the generated report into this folder with a timestamp:

   ```
   content-audit-YYYY-MM-DD.md
   ```

   For example: `content-audit-2026-02-22.md`

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
