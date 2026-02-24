import { getSupabaseClient, isSupabaseConfigured } from '../lib/supabaseClient';
import { clearCache, makeCacheKey, withCache } from './cache';

function requireSupabase() {
  if (!isSupabaseConfigured) throw new Error('Supabase not configured');
  const supabase = getSupabaseClient();
  if (!supabase) throw new Error('Supabase not configured');
  return supabase;
}

export async function getUserStats() {
  const supabase = requireSupabase();

  const { data: sessionData } = await supabase.auth.getSession();
  if (!sessionData?.session) {
    return { expert_minutes: 0, streak: 0, last_completed_date: null };
  }

  const { data, error } = await supabase
    .from('user_stats')
    .select('one_ma_balance, streak, last_completed_date')
    .single();

  // When row doesn't exist yet, PostgREST can return 406; treat as empty
  if (error && error.code !== 'PGRST116') throw error;
  const row = data ?? { one_ma_balance: 0, streak: 0, last_completed_date: null };
  return {
    expert_minutes: Number(row?.one_ma_balance ?? 0) || 0,
    streak: Number(row?.streak ?? 0) || 0,
    last_completed_date: row?.last_completed_date ?? null,
  };
}

export async function completeTopic({ topicId, seconds = 60 }) {
  const supabase = requireSupabase();

  const { data: sessionData } = await supabase.auth.getSession();
  if (!sessionData?.session) {
    throw new Error('Please sign in to track progress');
  }

  const { data, error } = await supabase.rpc('complete_topic', {
    p_topic_id: topicId,
    p_seconds: seconds,
  });

  if (error) throw error;

  // Supabase returns an array for table returns
  const row = Array.isArray(data) ? data[0] : data;

  // Invalidate user progress caches so UI updates quickly.
  try {
    const userId = sessionData?.session?.user?.id;
    if (userId) clearCache({ prefix: makeCacheKey(['progress', userId]) });
  } catch {
    // ignore
  }

  return {
    expert_minutes: Number(row?.one_ma_balance ?? 0) || 0,
    streak: Number(row?.streak ?? 0) || 0,
    awarded_minutes: Number(row?.awarded_one_ma ?? 0) || 0,
  };
}

async function getSignedInUserId(supabase) {
  const { data: sessionData } = await supabase.auth.getSession();
  const userId = sessionData?.session?.user?.id;
  return userId ? String(userId) : null;
}

export async function listUserTopicProgressForCourse({ courseId } = {}) {
  const course = String(courseId ?? '').trim();
  if (!course) return [];

  const supabase = requireSupabase();
  const userId = await getSignedInUserId(supabase);
  if (!userId) return [];

  const cacheKey = makeCacheKey(['progress', userId, 'course', course]);
  return withCache(cacheKey, { ttlMs: 20 * 1000 }, async () => {
    const { data, error } = await supabase
      .from('user_topic_progress')
      .select('topic_id, best_seconds, completed_count, last_completed_at, topics!inner ( id, course_id, chapter_id )')
      .eq('topics.course_id', course)
      .order('last_completed_at', { ascending: false });

    if (error) throw error;
    return data ?? [];
  });
}

export async function listUserTopicProgressForChapter({ courseId, chapterId } = {}) {
  const course = String(courseId ?? '').trim();
  const chapter = String(chapterId ?? '').trim();
  if (!course || !chapter) return [];

  const supabase = requireSupabase();
  const userId = await getSignedInUserId(supabase);
  if (!userId) return [];

  const cacheKey = makeCacheKey(['progress', userId, 'chapter', course, chapter]);
  return withCache(cacheKey, { ttlMs: 20 * 1000 }, async () => {
    const { data, error } = await supabase
      .from('user_topic_progress')
      .select('topic_id, best_seconds, completed_count, last_completed_at, topics!inner ( id, course_id, chapter_id )')
      .eq('topics.course_id', course)
      .eq('topics.chapter_id', chapter)
      .order('last_completed_at', { ascending: false });

    if (error) throw error;
    return data ?? [];
  });
}

export async function listUserTopicProgress() {
  const supabase = requireSupabase();

  const { data: sessionData } = await supabase.auth.getSession();
  if (!sessionData?.session) return [];

  const { data, error } = await supabase
    .from('user_topic_progress')
    .select(
      'topic_id, best_seconds, completed_count, last_completed_at, topics ( id, title, emoji, color, subject )'
    )
    .order('last_completed_at', { ascending: false });

  if (error) throw error;
  return data ?? [];
}

export async function listUserCompletedTopicProgressWithCourseIds({ courseIds = null } = {}) {
  const supabase = requireSupabase();

  const userId = await getSignedInUserId(supabase);
  if (!userId) return [];

  const ids = Array.isArray(courseIds) ? courseIds.map((c) => String(c ?? '').trim()).filter(Boolean) : null;
  const cacheKey = makeCacheKey(['progress', userId, 'completedTopicsWithCourseIds', ids ? ids.join(',') : 'all']);

  return withCache(cacheKey, { ttlMs: 20 * 1000 }, async () => {
    let q = supabase
      .from('user_topic_progress')
      .select('topic_id, completed_count, topics!inner ( course_id )')
      .gt('completed_count', 0);

    if (ids && ids.length > 0) {
      q = q.in('topics.course_id', ids);
    }

    const { data, error } = await q;
    if (error) throw error;
    return data ?? [];
  });
}

export async function getUserCompletedTopicsByCourse({ courseIds = null } = {}) {
  const supabase = requireSupabase();

  const userId = await getSignedInUserId(supabase);
  if (!userId) return new Map();

  const ids = Array.isArray(courseIds) ? courseIds.map((c) => String(c ?? '').trim()).filter(Boolean) : null;
  const cacheKey = makeCacheKey(['progress', userId, 'completedTopicsByCourse', ids ? ids.join(',') : 'all']);

  return withCache(cacheKey, { ttlMs: 20 * 1000 }, async () => {
    // Preferred: small aggregated payload from RPC.
    try {
      const { data, error } = await supabase.rpc('get_user_completed_topics_by_course', {
        p_course_ids: ids && ids.length > 0 ? ids : null,
      });
      if (error) throw error;

      const out = new Map();
      for (const r of Array.isArray(data) ? data : []) {
        const courseId = String(r?.course_id ?? '').trim();
        if (!courseId) continue;
        out.set(courseId, Number(r?.completed_topics ?? 0) || 0);
      }
      return out;
    } catch {
      // Fallback: row-level query + client aggregation.
      const rows = await listUserCompletedTopicProgressWithCourseIds({ courseIds: ids });
      const out = new Map();
      for (const r of Array.isArray(rows) ? rows : []) {
        const courseId = String(r?.topics?.course_id ?? '').trim();
        if (!courseId) continue;
        out.set(courseId, (out.get(courseId) ?? 0) + 1);
      }
      return out;
    }
  });
}

export async function getUserCompletedTopicsByCategory({ categoryIds = null } = {}) {
  const supabase = requireSupabase();

  const userId = await getSignedInUserId(supabase);
  if (!userId) return new Map();

  const ids = Array.isArray(categoryIds)
    ? categoryIds.map((c) => String(c ?? '').trim()).filter(Boolean)
    : null;

  const cacheKey = makeCacheKey(['progress', userId, 'completedTopicsByCategory', ids ? ids.join(',') : 'all']);
  return withCache(cacheKey, { ttlMs: 20 * 1000 }, async () => {
    try {
      const { data, error } = await supabase.rpc('get_user_completed_topics_by_category', {
        p_category_ids: ids && ids.length > 0 ? ids : null,
      });
      if (error) throw error;

      const out = new Map();
      for (const r of Array.isArray(data) ? data : []) {
        const categoryId = String(r?.category_id ?? '').trim();
        if (!categoryId) continue;
        out.set(categoryId, Number(r?.completed_topics ?? 0) || 0);
      }
      return out;
    } catch {
      // If RPC isn't deployed yet, fail closed (no progress bars) rather than
      // downloading all courses/topics which would be expensive at scale.
      return new Map();
    }
  });
}
