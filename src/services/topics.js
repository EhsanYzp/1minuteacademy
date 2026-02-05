import { isSupabaseConfigured, supabase } from '../lib/supabaseClient';
import { getContentSource } from './_contentSource';
import { getLocalTopic, listLocalTopics } from './topics.local';

function includesQueryLocal(topic, q) {
  const query = String(q ?? '').trim().toLowerCase();
  if (!query) return true;
  const hay = `${topic?.title ?? ''} ${topic?.description ?? ''} ${topic?.subject ?? ''}`.toLowerCase();
  return hay.includes(query);
}

export async function getTopicCategoryCounts() {
  const counts = new Map();

  if (getContentSource() === 'local') {
    const all = listLocalTopics();
    for (const t of all) {
      const subject = String(t?.subject ?? '').trim() || 'General';
      counts.set(subject, (counts.get(subject) ?? 0) + 1);
    }
    return {
      counts,
      total: all.length,
    };
  }

  if (!isSupabaseConfigured) throw new Error('Supabase not configured');

  const { data, error } = await supabase.rpc('get_topic_category_counts');
  if (error) throw error;

  let total = 0;
  for (const row of Array.isArray(data) ? data : []) {
    const subject = String(row?.subject ?? '').trim() || 'General';
    const n = Number(row?.topic_count ?? 0) || 0;
    counts.set(subject, n);
    total += n;
  }

  return { counts, total };
}

export async function listTopicsPage({ limit = 30, offset = 0, subject = null } = {}) {
  const safeLimit = Math.min(200, Math.max(1, Number(limit) || 30));
  const safeOffset = Math.max(0, Number(offset) || 0);
  const subjectFilter = typeof subject === 'string' && subject.trim() ? subject.trim() : null;

  if (getContentSource() === 'local') {
    let all = listLocalTopics();
    if (subjectFilter && subjectFilter !== 'All') {
      all = all.filter((t) => (String(t?.subject ?? '').trim() || 'General') === subjectFilter);
    }
    const items = all.slice(safeOffset, safeOffset + safeLimit);
    const nextOffset = safeOffset + items.length;
    return {
      items,
      total: all.length,
      nextOffset,
      hasMore: nextOffset < all.length,
    };
  }

  if (!isSupabaseConfigured) throw new Error('Supabase not configured');

  // The topics browser needs `subject` for categories.
  // Keep this resilient: if an older schema lacks a column, retry with a minimal select.
  const fullSelect = 'id, subject, title, emoji, color, description, difficulty';
  const minimalSelect = 'id, title, emoji, color, description, difficulty';

  const run = async (columns) => {
    let q = supabase
      .from('topics')
      .select(columns, { count: 'exact' })
      .eq('published', true)
      .order('title', { ascending: true });

    if (subjectFilter && subjectFilter !== 'All') q = q.eq('subject', subjectFilter);

    return q.range(safeOffset, safeOffset + safeLimit - 1);
  };

  const first = await run(fullSelect);
  if (!first.error) {
    const items = first.data ?? [];
    const total = typeof first.count === 'number' ? first.count : null;
    const nextOffset = safeOffset + items.length;
    return {
      items,
      total,
      nextOffset,
      hasMore: total == null ? items.length === safeLimit : nextOffset < total,
    };
  }

  const msg = String(first.error?.message ?? '').toLowerCase();
  const looksLikeMissingColumn = msg.includes('column') && msg.includes('does not exist');
  if (!looksLikeMissingColumn) throw first.error;

  const second = await run(minimalSelect);
  if (second.error) throw second.error;
  const items = second.data ?? [];
  const total = typeof second.count === 'number' ? second.count : null;
  const nextOffset = safeOffset + items.length;
  return {
    items,
    total,
    nextOffset,
    hasMore: total == null ? items.length === safeLimit : nextOffset < total,
  };
}

export async function searchTopicsPage({ query = '', limit = 30, offset = 0, subject = null } = {}) {
  const safeLimit = Math.min(200, Math.max(1, Number(limit) || 30));
  const safeOffset = Math.max(0, Number(offset) || 0);
  const subjectFilter = typeof subject === 'string' && subject.trim() ? subject.trim() : null;
  const q = typeof query === 'string' ? query.trim() : String(query ?? '').trim();

  if (getContentSource() === 'local') {
    let all = listLocalTopics();
    if (subjectFilter && subjectFilter !== 'All') {
      all = all.filter((t) => (String(t?.subject ?? '').trim() || 'General') === subjectFilter);
    }
    if (q) all = all.filter((t) => includesQueryLocal(t, q));

    const items = all.slice(safeOffset, safeOffset + safeLimit);
    const nextOffset = safeOffset + items.length;
    return {
      items,
      total: all.length,
      nextOffset,
      hasMore: nextOffset < all.length,
    };
  }

  if (!isSupabaseConfigured) throw new Error('Supabase not configured');

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

export async function listTopics() {
  if (getContentSource() === 'local') {
    return listLocalTopics();
  }

  if (!isSupabaseConfigured) throw new Error('Supabase not configured');

  // The topics browser needs `subject` for categories.
  // Keep this resilient: if an older schema lacks a column, retry with a minimal select.
  const fullSelect = 'id, subject, title, emoji, color, description, difficulty';
  const minimalSelect = 'id, title, emoji, color, description, difficulty';

  const run = async (columns) => {
    return supabase
      .from('topics')
      .select(columns)
      .eq('published', true)
      .order('title', { ascending: true });
  };

  const first = await run(fullSelect);
  if (!first.error) return first.data ?? [];

  // Only fall back for schema-ish errors; otherwise surface the real error.
  const msg = String(first.error?.message ?? '').toLowerCase();
  const looksLikeMissingColumn = msg.includes('column') && msg.includes('does not exist');
  if (!looksLikeMissingColumn) throw first.error;

  const second = await run(minimalSelect);
  if (second.error) throw second.error;
  return second.data ?? [];
}

export async function getTopic(topicId) {
  if (getContentSource() === 'local') {
    const local = getLocalTopic(topicId);
    if (!local) throw new Error('Topic not found');
    return local;
  }

  if (!isSupabaseConfigured) throw new Error('Supabase not configured');
  const { data, error } = await supabase
    .from('topics')
    .select('*')
    .eq('id', topicId)
    .eq('published', true)
    .single();

  if (error) throw error;
  return data;
}

export async function listTopicsByIds(topicIds, { includeLesson = false } = {}) {
  const ids = Array.isArray(topicIds) ? topicIds.filter(Boolean) : [];
  const uniq = Array.from(new Set(ids.map(String)));
  if (uniq.length === 0) return [];

  if (getContentSource() === 'local') {
    const topics = listLocalTopics();
    const byId = new Map(topics.map((t) => [t.id, t]));
    const out = uniq.map((id) => byId.get(id)).filter(Boolean);
    if (!includeLesson) return out.map(({ lesson, ...rest }) => rest);
    return out;
  }

  if (!isSupabaseConfigured) throw new Error('Supabase not configured');

  const columns = includeLesson
    ? 'id, subject, title, emoji, color, description, difficulty, lesson'
    : 'id, subject, title, emoji, color, description, difficulty';

  const { data, error } = await supabase
    .from('topics')
    .select(columns)
    .in('id', uniq);

  if (error) throw error;
  return data ?? [];
}
