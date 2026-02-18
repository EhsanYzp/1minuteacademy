import { getContentSource } from './_contentSource';

// Local preview: catalog + topics are bundled by Vite at dev/build time.
// New architecture stores seed content under content/catalog/catalog.json.
// (content/topics/** is legacy and may be empty.)
const topicModules = import.meta.glob('../../content/topics/**/*.topic.json', { eager: true });
const catalogModules = import.meta.glob('../../content/catalog/*.json', { eager: true });

function readCatalogTopics() {
  const values = Object.values(catalogModules)
    .map((m) => (m && typeof m === 'object' && 'default' in m ? m.default : m))
    .filter(Boolean);
  const catalog = values[0] ?? null;
  const rows = Array.isArray(catalog?.topics) ? catalog.topics : [];
  return rows;
}

function normalizeTopic(t) {
  return {
    id: t.id,
    // Map new names (categoryTitle/courseTitle) into the legacy-friendly fields.
    subject: t.subject ?? t.categoryTitle ?? t.category ?? t.subjectTitle,
    subcategory: t.subcategory ?? t.courseTitle ?? t.course ?? t.subcategoryTitle,
    title: t.title,
    emoji: t.emoji,
    color: t.color,
    description: t.description,
    difficulty: t.difficulty,
    published: Boolean(t.published),
    story: t.story,
    quiz: t.quiz,
    journey: t.journey,
    course_id: t.courseId ?? t.course_id ?? null,
    chapter_id: t.chapterId ?? t.chapter_id ?? null,
  };
}

export function isLocalContentMode() {
  return getContentSource() === 'local';
}

export function listLocalTopics() {
  const legacy = Object.values(topicModules)
    .map((m) => (m && typeof m === 'object' && 'default' in m ? m.default : m))
    .filter(Boolean);

  const catalogTopics = readCatalogTopics();

  const topics = [...legacy, ...(Array.isArray(catalogTopics) ? catalogTopics : [])]
    .filter(Boolean)
    .map(normalizeTopic)
    .filter((t) => t.published);

  topics.sort((a, b) => String(a.title).localeCompare(String(b.title)));
  return topics;
}

export function getLocalTopic(topicId) {
  const topics = listLocalTopics();
  return topics.find((t) => t.id === topicId) ?? null;
}
