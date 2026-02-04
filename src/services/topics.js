import { isSupabaseConfigured, supabase } from '../lib/supabaseClient';

export async function listTopics() {
  if (!isSupabaseConfigured) throw new Error('Supabase not configured');
  const { data, error } = await supabase
    .from('topics')
    .select('id, subject, title, emoji, color, description, difficulty')
    .eq('published', true)
    .order('title', { ascending: true });

  if (error) throw error;
  return data ?? [];
}

export async function getTopic(topicId) {
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
