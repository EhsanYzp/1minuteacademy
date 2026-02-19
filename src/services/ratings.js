import { getSupabaseClient, isSupabaseConfigured } from '../lib/supabaseClient';

function clampRating(n) {
  const v = Number(n);
  if (!Number.isFinite(v)) return null;
  const i = Math.round(v);
  if (i < 1 || i > 5) return null;
  return i;
}

function requireSupabase() {
  if (!isSupabaseConfigured) throw new Error('Supabase not configured');
  const supabase = getSupabaseClient();
  if (!supabase) throw new Error('Supabase not configured');
  return supabase;
}

export async function getTopicRatingSummaries(topicIds) {
  const ids = Array.isArray(topicIds) ? topicIds.map(String).filter(Boolean) : [];
  const uniq = Array.from(new Set(ids));
  if (uniq.length === 0) return new Map();

  if (!isSupabaseConfigured) return new Map();

  const supabase = requireSupabase();

  const CHUNK = 75;
  const map = new Map();

  for (let i = 0; i < uniq.length; i += CHUNK) {
    const slice = uniq.slice(i, i + CHUNK);
    // eslint-disable-next-line no-await-in-loop
    const { data, error } = await supabase.rpc('get_topic_rating_summaries', { topic_ids: slice });
    if (error) throw error;

    for (const row of Array.isArray(data) ? data : []) {
      map.set(String(row.topic_id), {
        avg_rating: row.avg_rating,
        ratings_count: row.ratings_count,
      });
    }
  }

  return map;
}

export async function getMyTopicRating(topicId) {
  const id = String(topicId ?? '').trim();
  if (!id) return null;

  if (!isSupabaseConfigured) return null;

  const supabase = requireSupabase();

  const { data: sessionData } = await supabase.auth.getSession();
  if (!sessionData?.session) return null;

  const { data, error } = await supabase
    .from('topic_ratings')
    .select('rating')
    .eq('topic_id', id)
    .maybeSingle();

  if (error) throw error;
  return clampRating(data?.rating);
}

export async function listMyTopicRatings() {
  if (!isSupabaseConfigured) return [];

  const supabase = requireSupabase();

  const { data: sessionData } = await supabase.auth.getSession();
  if (!sessionData?.session) return [];

  const { data, error } = await supabase
    .from('topic_ratings')
    .select('topic_id, rating, updated_at')
    .order('updated_at', { ascending: false });

  if (error) throw error;

  return (Array.isArray(data) ? data : [])
    .map((row) => ({
      topic_id: String(row.topic_id),
      rating: clampRating(row.rating),
      updated_at: row.updated_at ?? null,
    }))
    .filter((r) => Boolean(r.topic_id) && Boolean(r.rating));
}

export async function setMyTopicRating(topicId, rating) {
  const id = String(topicId ?? '').trim();
  const r = clampRating(rating);
  if (!id) throw new Error('Topic id missing');
  if (!r) throw new Error('Rating must be 1 to 5');

  if (!isSupabaseConfigured) throw new Error('Supabase not configured');

  const supabase = requireSupabase();

  // Avoid relying on auth.uid() defaults; explicitly validate we have a real user.
  const { data: sessionData } = await supabase.auth.getSession();
  if (!sessionData?.session) throw new Error('Please sign in to rate');

  const { data: userData, error: userErr } = await supabase.auth.getUser();
  if (userErr || !userData?.user?.id) throw new Error('Please sign in to rate');
  const userId = userData.user.id;

  const { data, error } = await supabase
    .from('topic_ratings')
    .upsert({ user_id: userId, topic_id: id, rating: r }, { onConflict: 'user_id,topic_id' })
    .select('rating')
    .single();

  if (error) {
    // Common case after account deletion or invalid session: auth.uid() / FK mismatch.
    if (String(error?.code ?? '') === '23503' || /foreign key/i.test(String(error?.message ?? ''))) {
      throw new Error('Please sign in again to rate');
    }
    throw error;
  }
  return { rating: clampRating(data?.rating) };
}
