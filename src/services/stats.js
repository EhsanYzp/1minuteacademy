import { getSupabaseClient, isSupabaseConfigured } from '../lib/supabaseClient';
import { makeCacheKey, withCache } from './cache';
import { listCategories } from './catalog';

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

    const [cats, coursesRes, topicsRes] = await Promise.all([
      // Use the same category logic as /categories (hides known alias duplicates).
      listCategories().catch(() => []),
      supabase.from('courses').select('id', { count: 'exact', head: true }).eq('published', true),
      supabase.from('topics').select('id', { count: 'exact', head: true }).eq('published', true),
    ]);

    if (coursesRes.error) throw coursesRes.error;
    if (topicsRes.error) throw topicsRes.error;

    return {
      categories: Array.isArray(cats) ? cats.length : 0,
      courses: typeof coursesRes.count === 'number' ? coursesRes.count : 0,
      topics: typeof topicsRes.count === 'number' ? topicsRes.count : 0,
    };
  });
}