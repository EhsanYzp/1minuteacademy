import { getSupabaseClient, isSupabaseConfigured } from '../lib/supabaseClient';

function requireSupabase() {
  if (!isSupabaseConfigured) throw new Error('Supabase not configured');
  const supabase = getSupabaseClient();
  if (!supabase) throw new Error('Supabase not configured');
  return supabase;
}

function normalizeDisplayName(value) {
  const s = String(value ?? '').trim().replace(/\s+/g, ' ');
  if (!s) return null;
  return s.slice(0, 40);
}

export async function getMyProfile() {
  if (!isSupabaseConfigured) return null;
  const supabase = requireSupabase();

  const { data: userData, error: userErr } = await supabase.auth.getUser();
  if (userErr) throw userErr;
  const user = userData?.user;
  if (!user) throw new Error('Please sign in first');

  const userId = user.id;

  const { data, error } = await supabase
    .from('profiles')
    .select('user_id, display_name, avatar_url, updated_at')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) throw error;
  if (data) return data;

  const fallbackName =
    normalizeDisplayName(user?.user_metadata?.display_name) ||
    normalizeDisplayName(user?.user_metadata?.full_name) ||
    normalizeDisplayName(String(user?.email ?? '').split('@')[0]) ||
    'Member';

  const { data: inserted, error: insertErr } = await supabase
    .from('profiles')
    .insert({ user_id: userId, display_name: fallbackName })
    .select('user_id, display_name, avatar_url, updated_at')
    .single();

  if (insertErr) throw insertErr;
  return inserted;
}

export async function updateMyProfile({ displayName, avatarUrl } = {}) {
  const supabase = requireSupabase();

  const { data: userData, error: userErr } = await supabase.auth.getUser();
  if (userErr) throw userErr;
  const user = userData?.user;
  if (!user) throw new Error('Please sign in first');

  const payload = {};
  if (displayName !== undefined) payload.display_name = normalizeDisplayName(displayName);
  if (avatarUrl !== undefined) payload.avatar_url = avatarUrl ? String(avatarUrl) : null;

  const { data, error } = await supabase
    .from('profiles')
    .update(payload)
    .eq('user_id', user.id)
    .select('user_id, display_name, avatar_url, updated_at')
    .single();

  if (error) throw error;
  return data;
}

export async function uploadMyAvatar(file) {
  const supabase = requireSupabase();

  const { data: userData, error: userErr } = await supabase.auth.getUser();
  if (userErr) throw userErr;
  const user = userData?.user;
  if (!user) throw new Error('Please sign in first');

  const f = file;
  if (!f) throw new Error('No file selected');

  const mime = String(f.type ?? '');
  if (!mime.startsWith('image/')) throw new Error('Please upload an image');

  const maxBytes = 2 * 1024 * 1024;
  if (Number(f.size ?? 0) > maxBytes) throw new Error('Please upload an image under 2MB');

  const rawExt = String(f.name ?? '').split('.').pop() || '';
  const ext = rawExt.toLowerCase().replace(/[^a-z0-9]+/g, '').slice(0, 8);
  const safeExt = ext || (mime === 'image/png' ? 'png' : mime === 'image/webp' ? 'webp' : 'jpg');

  const objectPath = `${user.id}/avatar.${safeExt}`;

  const { error: uploadErr } = await supabase.storage.from('avatars').upload(objectPath, f, {
    upsert: true,
    cacheControl: '3600',
    contentType: mime || undefined,
  });

  if (uploadErr) throw uploadErr;

  const { data } = supabase.storage.from('avatars').getPublicUrl(objectPath);
  const publicUrl = data?.publicUrl;
  if (!publicUrl) throw new Error('Failed to resolve avatar URL');

  // Cache-bust so the new avatar shows immediately.
  return `${publicUrl}?v=${Date.now()}`;
}
