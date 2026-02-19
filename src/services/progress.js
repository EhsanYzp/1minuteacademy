import { getSupabaseClient, isSupabaseConfigured } from '../lib/supabaseClient';

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
  return {
    expert_minutes: Number(row?.one_ma_balance ?? 0) || 0,
    streak: Number(row?.streak ?? 0) || 0,
    awarded_minutes: Number(row?.awarded_one_ma ?? 0) || 0,
  };
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
