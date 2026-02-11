# Product audits

This folder stores point-in-time product audits so we can run them regularly and track progress over time.

## Naming convention

Use a date-only stamp in the filename:

- `product-audit-YYYY-MM-DD.md`

Example:

- `product-audit-2026-02-11.md`

## Workflow

1. Copy the most recent audit file.
2. Update the generated date and make new findings.
3. Implement fixes incrementally and keep the audit + `CHANGELOG.md` in sync.
