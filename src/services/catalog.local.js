import { getContentSource } from './_contentSource';

const modules = import.meta.glob('../../content/catalog/*.json', { eager: true });
const topicModules = import.meta.glob('../../content/topics/**/*.topic.json', { eager: true });

function readCatalog() {
  const values = Object.values(modules)
    .map((m) => (m && typeof m === 'object' && 'default' in m ? m.default : m))
    .filter(Boolean);
  const first = values[0] ?? null;
  return first && typeof first === 'object' ? first : null;
}

export function isLocalCatalogMode() {
  return getContentSource() === 'local';
}

export function listLocalCategories() {
  const catalog = readCatalog();
  const rows = Array.isArray(catalog?.categories) ? catalog.categories : [];
  return rows.filter((c) => c?.published !== false);
}

export function listLocalCourses({ categoryId = null } = {}) {
  const catalog = readCatalog();
  const rows = Array.isArray(catalog?.courses) ? catalog.courses : [];
  const out = rows.filter((c) => c?.published !== false);
  const filterId = typeof categoryId === 'string' && categoryId.trim() ? categoryId.trim() : null;
  if (!filterId) return out;
  return out.filter((c) => String(c?.categoryId ?? '') === filterId);
}

export function getLocalCourse(courseId) {
  const catalog = readCatalog();
  const rows = Array.isArray(catalog?.courses) ? catalog.courses : [];
  const id = String(courseId ?? '').trim();
  return rows.find((c) => String(c?.id ?? '') === id) ?? null;
}

export function listLocalChapters({ courseId } = {}) {
  const catalog = readCatalog();
  const rows = Array.isArray(catalog?.chapters) ? catalog.chapters : [];
  const id = String(courseId ?? '').trim();
  return rows
    .filter((c) => c?.published !== false)
    .filter((c) => String(c?.courseId ?? '') === id)
    .slice()
    .sort((a, b) => (Number(a?.position ?? 0) || 0) - (Number(b?.position ?? 0) || 0));
}

export function listLocalTopicsForCourse({ courseId } = {}) {
  const catalog = readCatalog();
  const embedded = Array.isArray(catalog?.topics) ? catalog.topics : [];
  const fileTopics = Object.values(topicModules)
    .map((m) => (m && typeof m === 'object' && 'default' in m ? m.default : m))
    .filter(Boolean);
  const id = String(courseId ?? '').trim();

  const matchesCourse = (t) => {
    const v = t?.courseId ?? t?.course_id ?? t?.course ?? null;
    return String(v ?? '') === id;
  };

  return [...embedded, ...fileTopics]
    .filter((t) => t?.published !== false)
    .filter(matchesCourse);
}
