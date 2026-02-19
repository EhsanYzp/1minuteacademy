# Requirements: Creating Chapters + Topics for a New Course

This document defines the **non-negotiable requirements** for generating a new course (Course → Chapters → Topics) and producing the corresponding `.topic.json` files.

The app consumes topics from Supabase at runtime, but the recommended workflow is:
1) **Generate `.topic.json` files** under `content/topics/…`
2) Run `npm run content:validate`
3) Sync to Supabase with `npm run content:sync:staging` (then `:prod`)

---

## 1) Course shape rules

### Chapters
- Each course must have **5 to 10 chapters**.
- Chapter sizes should be **content-driven**, not uniform.
- Chapters must have clear boundaries (no “misc dump” chapters).

### Topics (1-minute lessons)
- Each course must have **30 to 60 topics**.
- Topic count must be **dynamic** per course, based on what the course actually needs.
- Avoid making every course the same length.

### Choosing chapter/topic counts (dynamic)
When creating a new course, you must choose a structure that matches the content:
- If the course is a **broad survey**, prefer more chapters with fewer topics per chapter.
- If the course is a **deep skill**, prefer fewer chapters with more topics per chapter.
- If the course has **distinct phases** (setup → core → advanced → troubleshooting), mirror those phases as chapters.

Recommended heuristics (flexible, not hard rules):
- Average topics per chapter typically lands around **4–8**.
- Ensure every chapter has at least **3 topics** unless there’s a strong reason.

---

## 2) Difficulty distribution rules (per course)

Across all topics in the course, target this distribution:
- **~15%** Beginner
- **~5%** Premium
- **~40%** Intermediate
- **~40%** Advanced

Flexibility:
- The distribution can vary slightly, but:
  - Never produce **too many Beginner** topics.
  - Never produce **too many Premium** topics.
  - Premium should stay a **small minority**.

### Practical allocation method (deterministic)
Given `N` topics (30–60):
- Beginner: `round(0.15 * N)`
- Premium: `round(0.05 * N)`
- Intermediate: `floor((N - beginner - premium) / 2)`
- Advanced: remainder

Then adjust by at most ±1–2 topics to keep totals exact and keep Premium small.

Allowed difficulty values in topic JSON:
- `Beginner`
- `Intermediate`
- `Advanced`
- `Premium`

---

## 3) Topic content requirements

Every topic must be:
- **Unique**: no duplicate titles, no duplicate story beats, no recycled quiz questions.
- **Specific**: tightly focused on the topic title (no generic filler).
- **Coherent in 1 minute**: the story beats should fit the 60-second format.
- **Correct**: no contradictions across topics in the same course.

Minimum lesson payload per topic:
- A 6-beat story: `hook`, `buildup`, `discovery`, `twist`, `climax`, `punchline`
- A quiz with 2–4 options and one correct answer.

---

## 4) File output requirements (`.topic.json` files)

You must create the topic JSON files in the repo.

### Location (preferred)
Write files under a stable hierarchical path:

- `content/topics/<categoryId>/<courseId>/<chapterId>/<topicId>.topic.json`

This is compatible with the existing sync script, as long as the JSON shape matches the schema.

### ID rules (stability)
- `id` must be **stable and deterministic** (never random).
- IDs should be globally unique.
- Suggested pattern:
  - `courseId--tNN-<slug>`

### Version rules
- Every topic must include `version` (integer ≥ 1).
- Increment `version` when the lesson meaningfully changes.

### Required fields per file
Each `.topic.json` must include (at minimum):
- `id` (string)
- `version` (int)
- `subject` (category display title)
- `subcategory` (course display title)
- `course_id` (course id)
- `chapter_id` (chapter id)
- `title` (string)
- `emoji` (string)
- `color` (hex string)
- `description` (string)
- `difficulty` (`Beginner` | `Intermediate` | `Advanced` | `Premium`)
- `published` (boolean)
- `story` (object with 6 beats)
- `quiz` (question/options/correct)

Note:
- The sync pipeline can derive `lesson` from `story` + `quiz`.

---

## 5) Quality checklist (must pass)

Before syncing:
- `npm run content:validate` passes.
- Topic titles are all distinct within the course.
- Difficulty distribution roughly matches targets.
- No chapter is empty; chapter flow makes sense.
- Topics are correctly linked via `course_id` and `chapter_id`.

After syncing to staging:
- The course appears under its category.
- Chapters render in order.
- Topics load and lessons are playable.
- Premium topics are correctly gated (Pro-only).
