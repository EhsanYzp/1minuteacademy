# Audit & Re-Audit Instructions

Standard operating procedure for running product audits on 1 Minute Academy.  
Follow these steps so you (or an AI agent) can reproduce the process consistently.

---

## 1 · Fresh Audit (new findings)

> **When:** periodically (every 1–2 weeks), after a batch of feature work, or before a release.

### Steps

1. **Create the audit file**  
   `docs/product-audits/product-audit-YYYY-MM-DD.md`

2. **Set the scope** — review the entire codebase for:
   - 🔒 Security
   - 🛡️ Reliability
   - ⚡ Performance
   - ♿ Accessibility
   - 🎨 UX
   - 📈 Scalability
   - 🧹 Code Quality
   - 🧪 Testing

3. **For each finding:**
   - Assign a unique ID using the category prefix + sequential number  
     (e.g. `SEC-01`, `PERF-12`, `CQ-08`).
   - Set a priority: **P0** (critical), **P1** (high impact), **P2** (strategic).
   - State **Where** (file paths as relative links).
   - Describe the issue and why it matters.
   - Propose a concrete **Fix**.
   - Carry forward any unresolved items from the previous audit and note  
     *(Unchanged)*, *(Worse)*, *(Partial)*, or *(Escalated from PX)*.

4. **Re-verify all items marked "Implemented" in the previous audit.**  
   Confirm each fix is still solid. Note any regressions.

5. **Add a Summary matrix** at the bottom (P0 / P1 / P2 columns by category).

6. **Commit** the audit file.

---

## 2 · Implementation Phase

> **When:** after a fresh audit produces a list of open items.

### Per-item workflow

1. Implement the fix in code.
2. **In the audit file**, directly below the item's `**Fix:**` section, add:

   ```
   **Status:** Implemented (YYYY-MM-DD)

   **Summary:** <one or two sentences describing what you did>
   ```

   ⚠️ Do **not** remove or rewrite the original finding — keep it intact for historical context.

3. Add a matching bullet to `CHANGELOG.md` under the appropriate section  
   (`### Changed`, `### Fixed`, or `### Added`).

4. Run `npm run build` (production build) to validate — must pass with exit 0.

5. Repeat for the next item.

### Grouping

- You may implement multiple items in one pass (e.g. `cq-08, cq-09, cq-10`).
- After the batch, update all audit entries, changelog, and run one build.

---

## 3 · Re-Audit (verify implemented fixes + find new issues)

> **When:** after all items from an audit have been implemented (or as many as planned).

### Steps

1. **Create a new audit file** for today's date:  
   `docs/product-audits/product-audit-YYYY-MM-DD.md`

2. **Re-verify every "Implemented" item** from the previous audit:
   - Read the actual code (not just the summary).
   - Confirm the fix is present and correct.
   - Add a **Re-audit** verdict directly to each item in the *previous* audit file:

     ```
     **Re-audit (YYYY-MM-DD):** ✅ Confirmed. <one-line evidence>
     ```

     or

     ```
     **Re-audit (YYYY-MM-DD):** ❌ Issue. <what's wrong>
     ```

3. **Look for NEW issues introduced by the fixes.** Check for:
   - Logic bugs in new code (off-by-one, race conditions, missing edge cases).
   - Missing error handling (e.g. lazy-loaded components without error boundaries).
   - Config leaks (e.g. lint rules applying to wrong file sets).
   - Memory / performance regressions (unbounded caches, leaked timers).
   - Stale or inconsistent patterns left after refactoring.

4. **Write the new audit document** with:
   - All carried-forward unresolved items (with updated status labels).
   - All newly discovered items.
   - Summary matrix and recommended execution order.

5. **Update `CHANGELOG.md`** if the re-audit itself caused any fixes.

6. **Run `npm run build`** to confirm the project is clean.

---

## 4 · Quick Reference — Priority Levels

| Level | Meaning | Action |
|-------|---------|--------|
| **P0** | Must fix. Blocks launch quality, user safety, or measurable harm. | Fix immediately. |
| **P1** | High impact. Prevents real pain at scale or for specific user groups. | Next sprint. |
| **P2** | Strategic. Improves long-term quality and developer velocity. | Schedule soon. |

---

## 5 · Quick Reference — Status Labels

| Label | Meaning |
|-------|---------|
| *(Unchanged)* | Carried from previous audit, no progress. |
| *(Worse)* | Regression — the metric got worse since last audit. |
| *(Partial)* | Some progress, but not fully resolved. |
| *(Escalated from PX)* | Priority increased from a lower level. |
| *(New)* | First time this issue appears. |

---

## 6 · File Conventions

- Audit files live in `docs/product-audits/`.
- Filename: `product-audit-YYYY-MM-DD.md`.
- Instructions file: `docs/product-audits/AUDIT_INSTRUCTIONS.md` (this file).
- Item IDs are global and sequential within their category prefix across all audits  
  (e.g. if the last security item was SEC-10, the next one is SEC-11).

---

## 7 · Prompt for AI Agent

If you want an AI agent to perform any of the above, copy the relevant prompt:

### Fresh audit prompt
```
Run a fresh product audit on the codebase. Scope: security, reliability, performance, accessibility, UX, scalability, code quality, testing. Follow the instructions in docs/product-audits/AUDIT_INSTRUCTIONS.md. Re-verify all previously implemented items from the latest audit. Create the new audit file as docs/product-audits/product-audit-YYYY-MM-DD.md.
```

### Implementation prompt
```
Continue with <ITEM-IDs>. For each: implement the fix, add "Status: Implemented" + summary to the audit file, add a CHANGELOG.md entry, and run npm run build. Follow docs/product-audits/AUDIT_INSTRUCTIONS.md.
```

### Re-audit prompt
```
Re-audit the implemented changes from docs/product-audits/product-audit-YYYY-MM-DD.md. Verify each fix in the actual code, look for new issues introduced by the fixes, and create a new audit file. Follow docs/product-audits/AUDIT_INSTRUCTIONS.md.
```
