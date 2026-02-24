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

  const DUPLICATE_CATEGORY_IDS = new Map([
    // Hide legacy/alias ids when the canonical category exists.
    ['home-and-diy', 'home-diy'],
  ]);

  const DUPLICATE_CATEGORY_TITLES = new Map([
    // Only hide these legacy/alias category titles when a canonical category exists.
    ['AI & Agents', 'AI'],
    ['Art & Design', 'Art'],
  ]);

  const cacheKey = makeCacheKey(['catalog', 'categories', 'supabase']);
  return withCache(cacheKey, { ttlMs: 5 * 60 * 1000 }, async () => {
    const supabase = requireSupabase();
    const { data, error } = await supabase
      .from('categories')
      .select('id, title, emoji, color, description, published')
      .eq('published', true)
      .order('title', { ascending: true });
    if (error) throw error;

    const normalized = (data ?? []).map((c) => {
      const rawId = String(c?.id ?? '').trim();
      const id = rawId.toLowerCase();
      const title = String(c?.title ?? '').trim();

      // Canonical display labels (do NOT rewrite all rows; only the canonical ids).
      if (id === 'ai' && title === 'AI & Agents') return { ...c, id: rawId, title: 'AI' };
      if (id === 'art' && title === 'Art & Design') return { ...c, id: rawId, title: 'Art' };
      return { ...c, id: rawId };
    });

    const ids = new Set(normalized.map((c) => String(c?.id ?? '').trim().toLowerCase()).filter(Boolean));
    const titles = new Set(normalized.map((c) => String(c?.title ?? '').trim()).filter(Boolean));

    // Hide only known duplicate alias categories (keep other 0-course categories).
    return normalized.filter((c) => {
      const id = String(c?.id ?? '').trim().toLowerCase();
      const canonicalId = DUPLICATE_CATEGORY_IDS.get(id);
      if (canonicalId && ids.has(String(canonicalId).toLowerCase())) return false;

      const title = String(c?.title ?? '').trim();
      const canonicalTitle = DUPLICATE_CATEGORY_TITLES.get(title);
      if (!canonicalTitle) return true;
      const canonicalTitleId = canonicalTitle.toLowerCase();
      const hasCanonical = titles.has(canonicalTitle) || ids.has(canonicalTitleId);
      return !hasCanonical;
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
      .select('id, subject, subcategory, course_id, chapter_id, title, emoji, color, description, is_free, published')
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
      .select('id, subject, subcategory, course_id, chapter_id, title, emoji, color, description, is_free, published')
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

export async function getCourseCountsBatch({ courseIds } = {}) {
  const ids = Array.isArray(courseIds)
    ? courseIds.map((c) => String(c ?? '').trim()).filter(Boolean)
    : [];

  if (ids.length === 0) return new Map();
  if (!isSupabaseConfigured) throw new Error('Supabase not configured');

  const cacheKey = makeCacheKey(['catalog', 'courseCountsBatch', 'supabase', ids.join(',')]);
  return withCache(cacheKey, { ttlMs: 2 * 60 * 1000 }, async () => {
    const supabase = requireSupabase();
    const { data, error } = await supabase.rpc('get_course_counts_batch', { p_course_ids: ids });
    if (error) throw error;

    const out = new Map();
    for (const r of Array.isArray(data) ? data : []) {
      const courseId = String(r?.course_id ?? '').trim();
      if (!courseId) continue;
      out.set(courseId, {
        chapters: typeof r?.chapters === 'number' ? r.chapters : Number(r?.chapters ?? 0) || 0,
        topics: typeof r?.topics === 'number' ? r.topics : Number(r?.topics ?? 0) || 0,
      });
    }
    return out;
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

export async function getCategoryCourseCounts() {
  if (!isSupabaseConfigured) throw new Error('Supabase not configured');

  const cacheKey = makeCacheKey(['catalog', 'categoryCourseCounts', 'supabase']);
  return withCache(cacheKey, { ttlMs: 5 * 60 * 1000 }, async () => {
    const supabase = requireSupabase();
    const { data, error } = await supabase.rpc('get_category_course_counts');
    if (error) throw error;

    const out = new Map();
    for (const r of Array.isArray(data) ? data : []) {
      const categoryId = String(r?.category_id ?? '').trim();
      if (!categoryId) continue;
      out.set(categoryId, Number(r?.course_count ?? 0) || 0);
    }
    return out;
  });
}

export async function getCategoryTopicCounts() {
  if (!isSupabaseConfigured) throw new Error('Supabase not configured');

  const cacheKey = makeCacheKey(['catalog', 'categoryTopicCounts', 'supabase']);
  return withCache(cacheKey, { ttlMs: 5 * 60 * 1000 }, async () => {
    const supabase = requireSupabase();
    const { data, error } = await supabase.rpc('get_category_topic_counts');
    if (error) throw error;

    const out = new Map();
    for (const r of Array.isArray(data) ? data : []) {
      const categoryId = String(r?.category_id ?? '').trim();
      if (!categoryId) continue;
      out.set(categoryId, Number(r?.topic_count ?? 0) || 0);
    }
    return out;
  });
}
