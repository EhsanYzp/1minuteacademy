import { getSupabaseClient, isSupabaseConfigured } from '../lib/supabaseClient';

function requireSupabase() {
  if (!isSupabaseConfigured) throw new Error('Supabase not configured');
  const supabase = getSupabaseClient();
  if (!supabase) throw new Error('Supabase not configured');
  return supabase;
}

export async function listApprovedTestimonials({ limit = 6 } = {}) {
  if (!isSupabaseConfigured) return [];
  const supabase = requireSupabase();

  const { data, error } = await supabase
    .from('testimonials')
    .select('id, author_name, author_avatar_url, author_title, quote, platform, platform_url, created_at')
    .eq('approved', true)
    .order('created_at', { ascending: false })
    .limit(Math.max(1, Math.min(24, Number(limit) || 6)));

  if (error) throw error;
  return Array.isArray(data) ? data : [];
}

export async function submitTestimonial({ quote, authorTitle, platform, platformUrl }) {
  const supabase = requireSupabase();

  const { data: userData, error: userErr } = await supabase.auth.getUser();
  if (userErr) throw userErr;
  if (!userData?.user) throw new Error('Please sign in first');

  const payload = {
    quote: String(quote ?? '').trim(),
    author_title: String(authorTitle ?? '').trim() || null,
    platform: String(platform ?? '').trim() || null,
    platform_url: String(platformUrl ?? '').trim() || null,
  };

  const { data, error } = await supabase.from('testimonials').insert(payload).select('id').single();
  if (error) throw error;
  return data;
}

export async function getMyLatestTestimonial() {
  if (!isSupabaseConfigured) return null;
  const supabase = requireSupabase();

  const { data: userData, error: userErr } = await supabase.auth.getUser();
  if (userErr) throw userErr;
  const userId = userData?.user?.id;
  if (!userId) return null;

  const { data, error } = await supabase
    .from('testimonials')
    .select('id, author_name, author_avatar_url, author_title, quote, platform, platform_url, approved, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return data ?? null;
}
