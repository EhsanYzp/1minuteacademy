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

## 2) Access model rules (STRICT: `is_free`, no `difficulty`)

The platform no longer uses difficulty levels.

**Non-negotiable rules:**
- Do **not** add a `difficulty` field anywhere (course plan JSON, topic JSON, UI copy, etc.).
- Every topic must have `is_free: boolean`.
- For course topics (topics with `course_id` + `chapter_id`):
  - Each chapter must have **exactly 1** free topic: `is_free: true`.
  - Every other topic in that chapter must be `is_free: false`.

**Practical authoring rule (recommended):**
- Make the **first topic** listed in each chapter the free one.

**Sanity target:**
- This typically yields ~20% free topics across a course, but the strict invariant is **1 free per chapter** (not a global percentage).

---

## 3) Topic content requirements

Every topic must be:
- **Unique**: no duplicate titles, no duplicate story beats, no recycled quiz questions.
- **Non-templated** (STRICT): do **not** reuse the same beat phrasing pattern across topics (e.g. avoid repeating identical lead-ins like “Aim for: … / Key move: … / Common trap: … / If you remember one thing: …” in every topic). Each beat must be written with **fresh wording** that still fits the 60-second format.
- **Human + clear (STRICT)**: write like a great teacher, not like a model output.
  - Use plain language; avoid “meta” phrasing like “today’s micro-lesson”, “target condition”, “print this on the wall”, “the shortest useful explanation”, etc.
  - Prefer a concrete moment or scenario in the hook (what the learner is doing / what goes wrong / what they want).
  - Keep beats short and conversational (1–2 sentences each). No corporate/robot tone.
  - Avoid jargon unless it’s immediately explained with a simple example.
- **Specific**: tightly focused on the topic title (no generic filler).
- **Coherent in 1 minute**: the story beats should fit the 60-second format.
- **Correct**: no contradictions across topics in the same course.

Minimum lesson payload per topic:
- A 6-beat story: `hook`, `buildup`, `discovery`, `twist`, `climax`, `punchline`
- A quiz with 2–4 options and one correct answer.

### Story beat text length limits (STRICT — enforced at 3 layers)

Each topic has a 6-beat story. Every beat displays for **8 seconds**.
At comfortable reading speed (~2.5 words/sec) that's ~20 words / ~120 characters.
Punchline is the mic-drop and must be even shorter.

| Beat       | Max chars | ~Max words | Role |
|------------|-----------|-----------|------|
| hook       | 120       | ~20       | Grab attention — a moment or question |
| buildup    | 120       | ~20       | Build context / tension |
| discovery  | 120       | ~20       | Introduce the core insight |
| twist      | 120       | ~20       | Complicate or reframe |
| climax     | 120       | ~20       | Resolve or crystallize |
| punchline  | **80**    | ~13       | Mic-drop — punchy, memorable |

**Where enforced (all three must pass):**
1. `content/schema/story.schema.json` → `maxLength` on beat `text` property
2. `scripts/generateCourseTopicJsons.mjs` → `BEAT_TEXT_MAX = 120`, `PUNCHLINE_TEXT_MAX = 80`
3. `scripts/validateContent.mjs` → uses the schema via AJV, catches violations automatically
4. CI → runs `content:validate` on every push

**Writing tips:**
- One idea per beat. If you need a comma, you probably need two beats.
- Prefer concrete over abstract ("predicts the next word" > "uses statistical methods").
- Use the visual emoji to carry context so text doesn't have to repeat it.
- Punchline = mic-drop. Short, punchy, memorable.
- If a beat is over 120 chars, split the idea across two beats or simplify.

**What happens when violated:**
- Generation script throws immediately and names the offending beat + topic.
- Validation script reports schema errors with the exact path.
- CI blocks the push.

### Authored mode (STRICT requirement)
For new courses, topics must be created in **authored mode**:
- Every topic must include a fully written `story` object (all 6 beats, each with its own unique wording).
- The generator must act as a **compiler/packager** only (validate, normalize, write files) and must **not** auto-write story prose from templates.
- The course plan must set `requireAuthoredStory: true` so generation fails fast if any topic is missing a story.

Enforcement notes:
- The generator enforces authored-only. If `requireAuthoredStory` is missing, it is treated as `true`.
- Template-based story generation is not allowed.

### Story-teachable content (STRICT requirement)
Every course must teach **knowledge that can be meaningfully conveyed through short text stories**.
Lessons are 6-beat text narratives read in 60 seconds — there is no video, no images, no hands-on demo.

**Good fits** (knowledge/concept-driven):
- History, theory, principles, psychology, cultural context, famous works/people.
- Example: "Art History Highlights" — learners absorb stories about movements, artists, and masterpieces.

**Bad fits** (require visual/physical demonstration):
- Step-by-step motor skills, spatial techniques, tool-specific tutorials.
- Example: "Drawing Basics" — you cannot teach someone to draw with 120-character text beats.

**Litmus test:** *Can a learner walk away smarter after reading six short sentences, without needing to see or do anything?*
If the answer is no, the course does not belong on this platform.

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
- `is_free` (boolean)
- `published` (boolean)
- `story` (object with 6 beats)
- `quiz` (question/options/correct)

Note:
- The sync pipeline can derive `lesson` from `story` + `quiz`.

---

## 6) Chapters page readability (STRICT)

The chapter cards shown on the Chapters page must be readable and well-ordered:
- Chapter `title` must be short and human-friendly (e.g. “Prompts & Tools”), never a slug/id like `ai--agent-builder-lab--ch02-prompts-and-tools`.
- Chapter ordering must be correct via `position` (1..N).
- Avoid putting the course id/name inside the chapter title (it makes cards ugly and gets cropped).

Operational note:
- Chapters must be synced to Supabase (title + position). The topic sync script upserts chapters from `content/course-plans/*.json` so the UI stays clean.

---

## 5) Quality checklist (must pass)

Before syncing:
- `npm run content:validate` passes.
- Topic titles are all distinct within the course.
- Each chapter has exactly **1** `is_free: true` topic.
- No chapter is empty; chapter flow makes sense.
- Topics are correctly linked via `course_id` and `chapter_id`.

After syncing to staging:
- The course appears under its category.
- Chapters render in order.
- Topics load and lessons are playable.
- Pro-only topics are correctly gated (everything except `is_free: true`).
