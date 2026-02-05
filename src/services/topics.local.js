import { getContentSource } from './_contentSource';

// Local preview topics are bundled by Vite at dev/build time.
// This lets you iterate on content without pushing to Supabase.
const topicModules = import.meta.glob('../../content/topics/**/*.topic.json', { eager: true });

function normalizeTopic(t) {
  return {
    id: t.id,
    subject: t.subject,
    subcategory: t.subcategory,
    title: t.title,
    emoji: t.emoji,
    color: t.color,
    description: t.description,
    difficulty: t.difficulty,
    published: Boolean(t.published),
    story: t.story,
    quiz: t.quiz,
    journey: t.journey,
  };
}

export function isLocalContentMode() {
  return getContentSource() === 'local';
}

export function listLocalTopics() {
  const topics = Object.values(topicModules)
    .map((m) => (m && typeof m === 'object' && 'default' in m ? m.default : m))
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
