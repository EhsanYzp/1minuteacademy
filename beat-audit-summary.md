# Beat Audit Summary

## Overview

| Metric | Value |
|--------|-------|
| Subjects audited | 144 |
| Total topics | 43,200 |
| Total beats checked | 259,200 |
| Issues found | 2,472 |
| Subjects with issues | 30 |
| Clean subjects | 114 |
| Issue rate | 0.95% |

**Beat limits:** 120 chars for hook/buildup/discovery/twist/climax (tolerance 130), 80 chars for punchline (tolerance 90).

**Primary issue type:** truncation — beats ending mid-sentence with missing nouns, objects, predicates, unclosed quotes, incomplete comparisons, or dangling modifiers.

---

## Subjects with Issues (sorted by issue count)

| # | Subject | Issues |
|---|---------|--------|
| 3 | Creativity | 259 |
| 4 | Critical Thinking | 206 |
| 5 | Behavioral Economics | 140 |
| 7 | Decision Making | 119 |
| 8 | Neuroscience | 117 |
| 9 | Economics | 103 |
| 10 | Learning Methods | 102 |
| 11 | Food Science | 99 |
| 12 | E-Commerce | 91 |
| 13 | Television & Streaming | 72 |
| 14 | Art & Design | 50 |
| 15 | Banking | 48 |
| 16 | Hospitality | 48 |
| 17 | Taxes | 46 |
| 18 | Public Health | 37 |
| 19 | Copywriting | 34 |
| 20 | Life Skills | 31 |
| 21 | Business | 27 |
| 22 | Data | 27 |
| 23 | Workplace Skills | 27 |
| 24 | Career | 24 |
| 25 | Genetics | 24 |
| 26 | Gardening | 15 |
| 27 | Cooking | 14 |
| 28 | Future Tech | 8 |
| 29 | Insurance | 2 |
| 30 | Startups | 2 |

**Total: 2,472 issues**

---

## Clean Subjects (114)

Accounting, Agriculture, AI & Agents, Animation, Anthropology, Architecture, Astronomy & Space, Automotive & EVs, Biology, Biotechnology, Business Models, Chemistry, Civil Engineering, Climate & Environment, Cloud Computing, Cognitive Science, Coffee & Tea, Computer Networking, Culture, Data Engineering, Databases, Design, DevOps, Ecology, Education, Electrical Engineering, Emotions, Energy, Engineering Fundamentals, Entrepreneurship, Ethics, Fashion, Film & Cinema, First Aid & Safety, Fraud & Scams, Game Theory, Gaming, Geography, Geology, Geopolitics, History, Home & DIY, Human Body, Human Evolution, Human Resources, Information Theory, Investing, Languages, Law, Leadership, Learning, Linguistics, Literature, Logic, Management, Marketing, Materials Science, Mathematics, Mechanical Engineering, Media Literacy, Medicine, Mental Health, Mental Models, Meteorology, Mobile Development, Money, Music Production, Music, Myth & Symbolism, Mythology, Nanotechnology, Negotiation, Nutrition, Oceanography, Operations, Parenting, Personal Finance, Philosophy, Photography, Physical Fitness, Physics, Politics, Privacy & Digital Rights, Product Management, Productivity, Programming, Project Management, Psychology, Public Speaking, Quality Assurance & Testing, Real Estate, Relationships, Religion & Spirituality, Risk & Compliance, Sales, Science, Self Care, Sexual Health, Sleep, Social Media, Sociology, Sports, Statistics, Supply Chain & Logistics, System Design, Technology, Trading, Transportation Systems, Travel, Urban Planning, UX & Research, Web Development, Web3, Writing

---

## Issue Type Breakdown

| Type | Description | Prevalence |
|------|-------------|------------|
| truncation | Beat text cuts off mid-sentence — missing nouns, objects, predicates, unclosed quotes, incomplete comparisons, dangling modifiers, subject-without-predicate fragments | ~98% of all issues |
| double_period | Beat ends with `..` instead of `.` | Rare (Cybersecurity) |
| grammatical_error | Typos or malformed text (e.g., "the'ssue") | Rare (Critical Thinking, Cybersecurity) |
| missing_closing_quote | Quote opened but never closed | Rare (Data, Economics) |
| wrong_emoji | Emoji doesn't match beat content | Rare (Cybersecurity) |

---

## Output Files

- **CSV:** `beat-audit-results.csv` — 2,473 lines (1 header + 2,472 issue rows)
  - Columns: `subject,course,topic_id,beat,issue_type,beat_text`
- **TSV source files:** `beat-audit-by-subject/<Subject Name>.tsv` — per-subject beat dumps used for manual inspection
- **This summary:** `beat-audit-summary.md`
