import { getSupabaseClient, isSupabaseConfigured } from '../lib/supabaseClient';
import { makeCacheKey, withCache } from './cache';

function requireSupabase() {
  if (!isSupabaseConfigured) throw new Error('Supabase not configured');
  const supabase = getSupabaseClient();
  if (!supabase) throw new Error('Supabase not configured');
  return supabase;
}

export async function getHomeStats() {
  if (!isSupabaseConfigured) {
    return { categories: 0, courses: 0, topics: 0 };
  }

  const cacheKey = makeCacheKey(['stats', 'home', 'supabase']);
  return withCache(cacheKey, { ttlMs: 5 * 60 * 1000 }, async () => {
    const supabase = requireSupabase();

    const [categoriesRes, coursesRes, topicsRes] = await Promise.all([
      supabase.from('categories').select('id', { count: 'exact', head: true }).eq('published', true),
      supabase.from('courses').select('id', { count: 'exact', head: true }).eq('published', true),
      supabase.from('topics').select('id', { count: 'exact', head: true }).eq('published', true),
    ]);

    if (categoriesRes.error) throw categoriesRes.error;
    if (coursesRes.error) throw coursesRes.error;
    if (topicsRes.error) throw topicsRes.error;

    return {
      categories: typeof categoriesRes.count === 'number' ? categoriesRes.count : 0,
      courses: typeof coursesRes.count === 'number' ? coursesRes.count : 0,
      topics: typeof topicsRes.count === 'number' ? topicsRes.count : 0,
    };
  });
}