import { getSupabaseClient, isSupabaseConfigured } from '../lib/supabaseClient';

function requireSupabase() {
  if (!isSupabaseConfigured) throw new Error('Supabase not configured');
  const supabase = getSupabaseClient();
  if (!supabase) throw new Error('Supabase not configured');
  return supabase;
}

function clampRating(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  const i = Math.round(n);
  if (i < 1 || i > 5) return null;
  return i;
}

export async function getReviewSummary() {
  if (!isSupabaseConfigured) return { avgRating: 0, count: 0 };
  const supabase = requireSupabase();

  const { data, error } = await supabase.rpc('get_review_summary');
  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : data;
  const avg = Number(row?.avg_rating ?? 0) || 0;
  const count = Number(row?.reviews_count ?? 0) || 0;
  return { avgRating: avg, count };
}

export async function listApprovedReviews({ page = 1, pageSize = 12 } = {}) {
  if (!isSupabaseConfigured) return { items: [], total: 0 };
  const supabase = requireSupabase();

  const p = Math.max(1, Number(page) || 1);
  const size = Math.max(3, Math.min(24, Number(pageSize) || 12));
  const from = (p - 1) * size;
  const to = from + size - 1;

  const { data, error, count } = await supabase
    .from('testimonials')
    .select('id, author_name, author_avatar_url, author_title, quote, rating, platform, platform_url, created_at', { count: 'exact' })
    .eq('approved', true)
    .order('created_at', { ascending: false })
    .range(from, to);

  if (error) throw error;
  return { items: Array.isArray(data) ? data : [], total: Number(count ?? 0) || 0 };
}

export async function getMyLatestReview() {
  if (!isSupabaseConfigured) return null;
  const supabase = requireSupabase();

  const { data: userData, error: userErr } = await supabase.auth.getUser();
  if (userErr) throw userErr;
  const userId = userData?.user?.id;
  if (!userId) return null;

  const { data, error } = await supabase
    .from('testimonials')
    .select('id, author_name, author_avatar_url, author_title, quote, rating, platform, platform_url, approved, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return data ?? null;
}

export async function submitReview({ rating, quote, authorTitle, platform, platformUrl } = {}) {
  const supabase = requireSupabase();

  const { data: userData, error: userErr } = await supabase.auth.getUser();
  if (userErr) throw userErr;
  if (!userData?.user) throw new Error('Please sign in first');

  const payload = {
    rating: clampRating(rating),
    quote: String(quote ?? '').trim(),
    author_title: String(authorTitle ?? '').trim() || null,
    platform: String(platform ?? '').trim() || null,
    platform_url: String(platformUrl ?? '').trim() || null,
  };

  if (!payload.rating) throw new Error('Please select a rating');

  const { data, error } = await supabase.from('testimonials').insert(payload).select('id').single();
  if (error) throw error;
  return data;
}
