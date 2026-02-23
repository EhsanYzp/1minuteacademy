import { getSupabaseClient, isSupabaseConfigured } from '../lib/supabaseClient';
import { makeCacheKey, withCache } from './cache';

function requireSupabase() {
  if (!isSupabaseConfigured) throw new Error('Supabase not configured');
  const supabase = getSupabaseClient();
  if (!supabase) throw new Error('Supabase not configured');
  return supabase;
}

export async function getTopicCategoryCounts() {
  if (!isSupabaseConfigured) throw new Error('Supabase not configured');

  const cacheKey = makeCacheKey(['topics', 'categoryCounts', 'supabase']);
  return withCache(
    cacheKey,
    { ttlMs: 5 * 60 * 1000 },
    async () => {
      const supabase = requireSupabase();

      const { data, error } = await supabase.rpc('get_topic_category_counts');
      if (error) throw error;

      const cachedCounts = new Map();
      let total = 0;
      for (const row of Array.isArray(data) ? data : []) {
        const subject = String(row?.subject ?? '').trim() || 'General';
        const n = Number(row?.topic_count ?? 0) || 0;
        cachedCounts.set(subject, n);
        total += n;
      }

      return { counts: cachedCounts, total };
    }
  );
}

export async function listTopicsPage({ limit = 30, offset = 0, subject = null } = {}) {
  const safeLimit = Math.min(200, Math.max(1, Number(limit) || 30));
  const safeOffset = Math.max(0, Number(offset) || 0);
  const subjectFilter = typeof subject === 'string' && subject.trim() ? subject.trim() : null;

  if (!isSupabaseConfigured) throw new Error('Supabase not configured');

  const cacheKey = makeCacheKey(['topics', 'page', 'supabase', subjectFilter ?? 'all', safeLimit, safeOffset]);
  return withCache(
    cacheKey,
    { ttlMs: 60 * 1000 },
    async () => {
      const supabase = requireSupabase();

      const columns = 'id, subject, subcategory, title, emoji, color, description, is_free';
      let q = supabase
        .from('topics')
        .select(columns, { count: 'exact' })
        .eq('published', true)
        .order('title', { ascending: true });

      if (subjectFilter && subjectFilter !== 'All') q = q.eq('subject', subjectFilter);

      const { data, error, count } = await q.range(safeOffset, safeOffset + safeLimit - 1);
      if (error) throw error;

      const items = data ?? [];
      const total = typeof count === 'number' ? count : null;
      const nextOffset = safeOffset + items.length;
      return {
        items,
        total,
        nextOffset,
        hasMore: total == null ? items.length === safeLimit : nextOffset < total,
      };
    }
  );
}

export async function searchTopicsPage({ query = '', limit = 30, offset = 0, subject = null } = {}) {
  const safeLimit = Math.min(200, Math.max(1, Number(limit) || 30));
  const safeOffset = Math.max(0, Number(offset) || 0);
  const subjectFilter = typeof subject === 'string' && subject.trim() ? subject.trim() : null;
  const q = typeof query === 'string' ? query.trim() : String(query ?? '').trim();

  if (!isSupabaseConfigured) throw new Error('Supabase not configured');

  const cacheKey = makeCacheKey(['topics', 'searchPage', 'supabase', subjectFilter ?? 'all', q, safeLimit, safeOffset]);
  return withCache(
    cacheKey,
    { ttlMs: 60 * 1000 },
    async () => {
      const supabase = requireSupabase();

      const { data, error } = await supabase.rpc('search_topics_page', {
        p_query: q,
        p_subject: subjectFilter,
        p_limit: safeLimit,
        p_offset: safeOffset,
      });
      if (error) throw error;

      const rows = Array.isArray(data) ? data : [];
      const total = rows.length > 0 ? Number(rows[0]?.total_count ?? 0) : 0;
      const items = rows.map(({ total_count, ...rest }) => rest);

      const nextOffset = safeOffset + items.length;
      return {
        items,
        total,
        nextOffset,
        hasMore: nextOffset < total,
      };
    }
  );
}

export async function listTopics({ pageSize = 500 } = {}) {
  if (!isSupabaseConfigured) throw new Error('Supabase not configured');

  const supabase = requireSupabase();

  const safePageSize = Math.min(1000, Math.max(1, Number(pageSize) || 500));
  const columns = 'id, subject, subcategory, title, emoji, color, description, is_free';

  const out = [];
  let offset = 0;
  const MAX_ROWS = 50000;

  while (true) {
    const { data, error } = await supabase
      .from('topics')
      .select(columns)
      .eq('published', true)
      .order('title', { ascending: true })
      .range(offset, offset + safePageSize - 1);

    if (error) throw error;

    const rows = data ?? [];
    out.push(...rows);
    if (rows.length < safePageSize) break;

    offset += rows.length;
    if (offset >= MAX_ROWS) throw new Error('Too many topics to load');
  }

  return out;
}

export async function listRelatedTopics({
  topicId,
  subject,
  subcategory = null,
  limit = 6,
} = {}) {
  const safeLimit = Math.min(24, Math.max(1, Number(limit) || 6));
  const subjectFilter = typeof subject === 'string' && subject.trim() ? subject.trim() : null;
  const subcategoryFilter = typeof subcategory === 'string' && subcategory.trim() ? subcategory.trim() : null;
  const excludeId = topicId != null ? String(topicId) : null;

  if (!subjectFilter) return [];

  if (!isSupabaseConfigured) throw new Error('Supabase not configured');
  const supabase = requireSupabase();

  const columns = 'id, subject, subcategory, title, emoji, color, description, is_free';

  const run = async ({ includeSubcategory }) => {
    let q = supabase
      .from('topics')
      .select(columns)
      .eq('published', true)
      .eq('subject', subjectFilter)
      .order('title', { ascending: true })
      .limit(safeLimit);

    if (excludeId) q = q.neq('id', excludeId);
    if (includeSubcategory && subcategoryFilter) q = q.eq('subcategory', subcategoryFilter);

    const { data, error } = await q;
    if (error) throw error;
    return data ?? [];
  };

  if (subcategoryFilter) {
    const same = await run({ includeSubcategory: true });
    if (same.length > 0) return same;
  }

  return run({ includeSubcategory: false });
}

export async function getTopic(topicId) {
  if (!isSupabaseConfigured) throw new Error('Supabase not configured');
  const supabase = requireSupabase();
  const { data, error } = await supabase
    .from('topics')
    .select('*')
    .eq('id', topicId)
    .eq('published', true)
    .single();

  if (error) throw error;
  
  // Normalize: extract story/quiz from lesson if not at top level
  if (data && data.lesson && !data.story) {
    data.story = data.lesson.story;
    data.quiz = data.lesson.quiz;
  }
  
  return data;
}

export async function listTopicsByIds(topicIds, { includeLesson = false } = {}) {
  const ids = Array.isArray(topicIds) ? topicIds.filter(Boolean) : [];
  const uniq = Array.from(new Set(ids.map(String)));
  if (uniq.length === 0) return [];

  if (!isSupabaseConfigured) throw new Error('Supabase not configured');

  const supabase = requireSupabase();

  const columns = includeLesson
    ? 'id, subject, title, emoji, color, description, is_free, lesson'
    : 'id, subject, title, emoji, color, description, is_free';

  const { data, error } = await supabase
    .from('topics')
    .select(columns)
    .in('id', uniq)
    .eq('published', true);

  if (error) throw error;
  return data ?? [];
}
