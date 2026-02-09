import { getSupabaseClient, isSupabaseConfigured } from '../lib/supabaseClient';

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function getAccessToken({ allowRefresh = true } = {}) {
  const supabase = getSupabaseClient();
  if (!supabase) return null;
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const { data } = await supabase.auth.getSession();
    const token = data?.session?.access_token;
    if (token) return token;

    if ((attempt === 1 || attempt === 4) && allowRefresh) {
      try {
        await supabase.auth.refreshSession();
      } catch {
        // ignore
      }
    }

    await sleep(Math.min(1000, 150 + attempt * 150));
  }

  return null;
}

async function postJson(url, body, accessToken) {
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    },
    body: JSON.stringify(body ?? {}),
  });

  let data = null;
  try {
    data = await res.json();
  } catch {
    // ignore
  }

  if (!res.ok) {
    const message = data?.error || data?.message || `Request failed (${res.status})`;
    const err = new Error(message);
    err.status = res.status;
    throw err;
  }

  return data;
}

export async function pauseAccount() {
  if (!isSupabaseConfigured) throw new Error('Supabase is not configured');
  const accessToken = await getAccessToken();
  if (!accessToken) throw new Error('Please sign in first');
  return await postJson('/api/account/pause', {}, accessToken);
}

export async function resumeAccount() {
  if (!isSupabaseConfigured) throw new Error('Supabase is not configured');
  const accessToken = await getAccessToken();
  if (!accessToken) throw new Error('Please sign in first');
  return await postJson('/api/account/resume', {}, accessToken);
}

export async function deleteAccount({ confirmation } = {}) {
  if (!isSupabaseConfigured) throw new Error('Supabase is not configured');
  const accessToken = await getAccessToken();
  if (!accessToken) throw new Error('Please sign in first');
  return await postJson('/api/account/delete', { confirmation }, accessToken);
}
