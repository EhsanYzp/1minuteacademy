import { getSupabaseClient, isSupabaseConfigured } from '../lib/supabaseClient';
import { getContentSource } from './_contentSource';
import { completeLocalTopic, getLocalTopicProgress, getLocalUserStats } from './progress.local';

function requireSupabase() {
  if (!isSupabaseConfigured) throw new Error('Supabase not configured');
  const supabase = getSupabaseClient();
  if (!supabase) throw new Error('Supabase not configured');
  return supabase;
}

export async function getUserStats() {
  if (getContentSource() === 'local') {
    return getLocalUserStats();
  }

  const supabase = requireSupabase();
  const { data, error } = await supabase
    .from('user_stats')
    .select('one_ma_balance, streak, last_completed_date')
    .single();

  // When row doesn't exist yet, PostgREST can return 406; treat as empty
  if (error && error.code !== 'PGRST116') throw error;
  return data ?? { one_ma_balance: 0, streak: 0, last_completed_date: null };
}

export async function completeTopic({ topicId, seconds = 60 }) {
  if (getContentSource() === 'local') {
    return completeLocalTopic({ topicId, seconds });
  }

  const supabase = requireSupabase();
  const { data, error } = await supabase.rpc('complete_topic', {
    p_topic_id: topicId,
    p_seconds: seconds,
  });

  if (error) throw error;

  // Supabase returns an array for table returns
  const row = Array.isArray(data) ? data[0] : data;
  return row;
}

export async function listUserTopicProgress() {
  if (getContentSource() === 'local') {
    return getLocalTopicProgress();
  }

  const supabase = requireSupabase();
  const { data, error } = await supabase
    .from('user_topic_progress')
    .select(
      'topic_id, best_seconds, completed_count, last_completed_at, topics ( id, title, emoji, color, subject )'
    )
    .order('last_completed_at', { ascending: false });

  if (error) throw error;
  return data ?? [];
}
