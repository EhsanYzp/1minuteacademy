import { isSupabaseConfigured, supabase } from '../lib/supabaseClient';
import { getContentSource } from './_contentSource';
import { completeLocalTopic, getLocalUserStats } from './progress.local';

export async function getUserStats() {
  if (getContentSource() === 'local') {
    return getLocalUserStats();
  }

  if (!isSupabaseConfigured) throw new Error('Supabase not configured');
  const { data, error } = await supabase
    .from('user_stats')
    .select('xp, streak, last_completed_date')
    .single();

  // When row doesn't exist yet, PostgREST can return 406; treat as empty
  if (error && error.code !== 'PGRST116') throw error;
  return data ?? { xp: 0, streak: 0, last_completed_date: null };
}

export async function completeTopic({ topicId, xp = 50, seconds = 60 }) {
  if (getContentSource() === 'local') {
    return completeLocalTopic({ topicId, xp, seconds });
  }

  if (!isSupabaseConfigured) throw new Error('Supabase not configured');
  const { data, error } = await supabase.rpc('complete_topic', {
    p_topic_id: topicId,
    p_xp: xp,
    p_seconds: seconds,
  });

  if (error) throw error;

  // Supabase returns an array for table returns
  const row = Array.isArray(data) ? data[0] : data;
  return row;
}
