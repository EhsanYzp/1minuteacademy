import { isSupabaseConfigured, supabase } from '../lib/supabaseClient';
import { getContentSource } from './_contentSource';
import { getLocalTopic, listLocalTopics } from './topics.local';

export async function listTopicsPage({ limit = 30, offset = 0 } = {}) {
  const safeLimit = Math.min(200, Math.max(1, Number(limit) || 30));
  const safeOffset = Math.max(0, Number(offset) || 0);

  if (getContentSource() === 'local') {
    const all = listLocalTopics();
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
    return supabase
      .from('topics')
      .select(columns, { count: 'exact' })
      .eq('published', true)
      .order('title', { ascending: true })
      .range(safeOffset, safeOffset + safeLimit - 1);
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
