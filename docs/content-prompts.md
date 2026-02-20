# Content Creation Prompts

Reusable commands you can paste into Copilot to generate course content.
Always make sure you're in the **oneminuteacademy** workspace when using these.

---

## Command 1 — Create a Single Full Course

Copy-paste the block below and replace the placeholder values.

```
Create a complete course for 1MinuteAcademy.

Category: <CATEGORY>          (e.g. "AI & Agents", "Art & Design")
Course title: <COURSE TITLE>  (e.g. "Prompt Engineering")
Audience level: <LEVEL>       (e.g. "beginner-friendly", "intermediate practitioners")

Steps — do ALL of them in order:

1. **Course plan** — Create `content/course-plans/<category-slug>--<course-slug>.json`
   following the schema and rules in docs/course-chapters-topics-requirements.md.
   - 5–10 chapters, 30–60 topics total (choose dynamically based on content).
   - Difficulty distribution: ~15% Beginner, ~5% Premium, ~40% Intermediate, ~40% Advanced.
   - Every topic must have a fully authored `story` (all 6 beats) and a `quiz`.
   - Set `requireAuthoredStory: true`.

2. **Beat text limits** — STRICT, non-negotiable:
   - hook / buildup / discovery / twist / climax: max 120 characters each.
   - punchline: max 80 characters.
   - One idea per beat. Concrete > abstract. Punchline = mic-drop.
   - If a beat is over the limit, rewrite it shorter — never truncate.

3. **Generate topic JSON files** — Run:
   ```
   node scripts/generateCourseTopicJsons.mjs --plan content/course-plans/<filename>.json
   ```

4. **Validate** — Run:
   ```
   npm run content:validate
   ```
   Fix any errors before proceeding.

5. **Generate SEO assets** — Run:
   ```
   node scripts/generateSeoAssets.mjs
   ```

6. **Build** — Run:
   ```
   npm run build
   ```
   Confirm zero errors.

7. **Commit** — Stage everything and commit with message:
   `feat(content): add <Course Title> course (<N> topics)`

Reference docs (read these before starting):
- docs/course-chapters-topics-requirements.md
- docs/content-generation.md
- content/schema/story.schema.json
- content/schema/topic.schema.json
```

---

## Command 2 — Create Multiple Courses in Bulk

Copy-paste the block below and fill in the course list.

```
Create the following courses in bulk for 1MinuteAcademy.
Process them ONE AT A TIME — finish each course fully before starting the next.

Category: <CATEGORY>

Courses to create:
1. <COURSE TITLE 1>
2. <COURSE TITLE 2>
3. <COURSE TITLE 3>
... (add as many as needed)

For EACH course, follow this exact sequence:

a) Create the course plan JSON in `content/course-plans/`.
   - 5–10 chapters, 30–60 topics (dynamic per course).
   - Difficulty distribution: ~15% Beginner, ~5% Premium, ~40% Intermediate, ~40% Advanced.
   - Every topic needs a fully authored `story` (6 beats) + `quiz`.
   - `requireAuthoredStory: true`.

b) STRICT beat text limits (enforced — the generator will reject violations):
   - hook / buildup / discovery / twist / climax: ≤120 characters.
   - punchline: ≤80 characters.
   - Write concretely. One idea per beat. Punchline = mic-drop.

c) Generate topic JSONs:
   ```
   node scripts/generateCourseTopicJsons.mjs --plan content/course-plans/<file>.json
   ```

d) Validate:
   ```
   npm run content:validate
   ```
   Fix any failures before moving to the next course.

e) After ALL courses pass validation, run:
   ```
   node scripts/generateSeoAssets.mjs
   npm run build
   ```

f) Commit everything:
   `feat(content): add <N> <Category> courses (<total topics> topics)`

Quality rules (non-negotiable):
- No duplicate titles across courses.
- No recycled story beats or quiz questions.
- No templated/formulaic beat phrasing — each topic must read like a unique micro-lesson.
- Write like a great teacher: plain language, concrete examples, no corporate tone.
- Chapters must have clear boundaries and human-friendly titles.

Reference docs (read before starting):
- docs/course-chapters-topics-requirements.md
- docs/content-generation.md
- content/schema/story.schema.json
- content/schema/topic.schema.json
```

---

## Tips

- **Story-teachable content only (STRICT).** Every course must teach knowledge that works as short text stories. No hands-on skills that require visual demonstration (e.g. "Drawing Basics" is a bad fit — you can't teach someone to draw with text). Good fits: history, theory, principles, psychology, cultural context. Litmus test: *Can a learner walk away smarter after reading six short sentences, without seeing or doing anything?*
- **Always validate before committing.** `npm run content:validate` catches schema violations, beat length overages, and structural issues.
- **Beat length is the #1 rejection reason.** If the generator throws, the fix is always to shorten the beat text — never to raise the limit.
- **Punchline ≤ 80 chars** — this is the mic-drop line. If it's longer than 80 characters, it's not punchy enough.
- **One course at a time in bulk mode.** This prevents cascading errors and makes it easy to isolate issues.
- **Read the requirements doc first** if it's been a while — the rules are all in `docs/course-chapters-topics-requirements.md`.
