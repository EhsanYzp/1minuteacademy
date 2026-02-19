import { getSupabaseClient, isSupabaseConfigured } from '../lib/supabaseClient';
import { makeCacheKey, withCache } from './cache';

function requireSupabase() {
  if (!isSupabaseConfigured) throw new Error('Supabase not configured');
  const supabase = getSupabaseClient();
  if (!supabase) throw new Error('Supabase not configured');
  return supabase;
}

export async function listCategories() {
  if (!isSupabaseConfigured) throw new Error('Supabase not configured');

  const cacheKey = makeCacheKey(['catalog', 'categories', 'supabase']);
  return withCache(cacheKey, { ttlMs: 5 * 60 * 1000 }, async () => {
    const supabase = requireSupabase();
    const { data, error } = await supabase
      .from('categories')
      .select('id, title, emoji, color, description, published')
      .eq('published', true)
      .order('title', { ascending: true });
    if (error) throw error;

    return (data ?? []).map((c) => {
      const id = String(c?.id ?? '').trim().toLowerCase();
      if (id !== 'ai') return c;
      const title = String(c?.title ?? '').trim();
      if (title !== 'AI & Agents') return c;
      return { ...c, title: 'AI' };
    });
  });
}

export async function listCourses({ categoryId = null } = {}) {
  if (!isSupabaseConfigured) throw new Error('Supabase not configured');

  const cat = typeof categoryId === 'string' && categoryId.trim() ? categoryId.trim() : null;
  const cacheKey = makeCacheKey(['catalog', 'courses', 'supabase', cat ?? 'all']);
  return withCache(cacheKey, { ttlMs: 2 * 60 * 1000 }, async () => {
    const supabase = requireSupabase();
    let q = supabase
      .from('courses')
      .select('id, category_id, title, emoji, color, description, published')
      .eq('published', true)
      .order('title', { ascending: true });
    if (cat) q = q.eq('category_id', cat);
    const { data, error } = await q;
    if (error) throw error;
    return data ?? [];
  });
}

export async function getCourse(courseId) {
  const id = String(courseId ?? '').trim();
  if (!id) throw new Error('Course id missing');

  if (!isSupabaseConfigured) throw new Error('Supabase not configured');

  const cacheKey = makeCacheKey(['catalog', 'course', 'supabase', id]);
  return withCache(cacheKey, { ttlMs: 2 * 60 * 1000 }, async () => {
    const supabase = requireSupabase();
    const { data, error } = await supabase
      .from('courses')
      .select('id, category_id, title, emoji, color, description, published')
      .eq('id', id)
      .eq('published', true)
      .single();
    if (error) throw error;
    if (!data) throw new Error('Course not found');
    return data;
  });
}

export async function listChapters({ courseId } = {}) {
  const id = String(courseId ?? '').trim();
  if (!id) return [];

  if (!isSupabaseConfigured) throw new Error('Supabase not configured');

  const cacheKey = makeCacheKey(['catalog', 'chapters', 'supabase', id]);
  return withCache(cacheKey, { ttlMs: 2 * 60 * 1000 }, async () => {
    const supabase = requireSupabase();
    const { data, error } = await supabase
      .from('chapters')
      .select('id, course_id, title, position, description, published')
      .eq('published', true)
      .eq('course_id', id)
      .order('position', { ascending: true });
    if (error) throw error;
    return data ?? [];
  });
}

export async function listTopicsForCourse({ courseId } = {}) {
  const id = String(courseId ?? '').trim();
  if (!id) return [];

  if (!isSupabaseConfigured) throw new Error('Supabase not configured');

  const cacheKey = makeCacheKey(['catalog', 'courseTopics', 'supabase', id]);
  return withCache(cacheKey, { ttlMs: 60 * 1000 }, async () => {
    const supabase = requireSupabase();
    const { data, error } = await supabase
      .from('topics')
      .select('id, subject, subcategory, course_id, chapter_id, title, emoji, color, description, difficulty, published')
      .eq('published', true)
      .eq('course_id', id)
      .order('title', { ascending: true });
    if (error) throw error;
    return data ?? [];
  });
}

export async function listTopicsForChapter({ courseId, chapterId } = {}) {
  const course = String(courseId ?? '').trim();
  const chapter = String(chapterId ?? '').trim();
  if (!course || !chapter) return [];

  if (!isSupabaseConfigured) throw new Error('Supabase not configured');

  const cacheKey = makeCacheKey(['catalog', 'chapterTopics', 'supabase', course, chapter]);
  return withCache(cacheKey, { ttlMs: 60 * 1000 }, async () => {
    const supabase = requireSupabase();
    const { data, error } = await supabase
      .from('topics')
      .select('id, subject, subcategory, course_id, chapter_id, title, emoji, color, description, difficulty, published')
      .eq('published', true)
      .eq('course_id', course)
      .eq('chapter_id', chapter)
      .order('title', { ascending: true });
    if (error) throw error;
    return data ?? [];
  });
}

export async function getCourseCounts({ courseId } = {}) {
  const id = String(courseId ?? '').trim();
  if (!id) return { chapters: 0, topics: 0 };

  if (!isSupabaseConfigured) throw new Error('Supabase not configured');

  const cacheKey = makeCacheKey(['catalog', 'courseCounts', 'supabase', id]);
  return withCache(cacheKey, { ttlMs: 2 * 60 * 1000 }, async () => {
    const supabase = requireSupabase();

    const [{ count: chapterCount, error: chapterErr }, { count: topicCount, error: topicErr }] = await Promise.all([
      supabase
        .from('chapters')
        .select('id', { count: 'exact', head: true })
        .eq('published', true)
        .eq('course_id', id),
      supabase
        .from('topics')
        .select('id', { count: 'exact', head: true })
        .eq('published', true)
        .eq('course_id', id),
    ]);

    if (chapterErr) throw chapterErr;
    if (topicErr) throw topicErr;

    return {
      chapters: typeof chapterCount === 'number' ? chapterCount : 0,
      topics: typeof topicCount === 'number' ? topicCount : 0,
    };
  });
}

export async function getCourseOutline({ courseId } = {}) {
  const id = String(courseId ?? '').trim();
  if (!id) throw new Error('Course id missing');

  const [course, chapters, topics] = await Promise.all([
    getCourse(id),
    listChapters({ courseId: id }),
    listTopicsForCourse({ courseId: id }),
  ]);

  const topicsByChapter = new Map();
  for (const t of Array.isArray(topics) ? topics : []) {
    const chapterId = String(t?.chapter_id ?? t?.chapterId ?? '');
    if (!chapterId) continue;
    if (!topicsByChapter.has(chapterId)) topicsByChapter.set(chapterId, []);
    topicsByChapter.get(chapterId).push(t);
  }

  return {
    course,
    chapters: (Array.isArray(chapters) ? chapters : []).map((ch) => ({
      ...ch,
      topics: topicsByChapter.get(String(ch.id)) ?? [],
    })),
  };
}
