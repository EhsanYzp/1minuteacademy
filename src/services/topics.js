import { isSupabaseConfigured, supabase } from '../lib/supabaseClient';
import { getContentSource } from './_contentSource';
import { getLocalTopic, listLocalTopics } from './topics.local';

export async function listTopics() {
  if (getContentSource() === 'local') {
    return listLocalTopics();
  }

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
