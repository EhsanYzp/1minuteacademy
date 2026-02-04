import { supabase, isSupabaseConfigured } from '../lib/supabaseClient';

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
    throw new Error(message);
  }

  return data;
}

async function getJson(url, accessToken) {
  const res = await fetch(url, {
    method: 'GET',
    headers: {
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    },
  });

  let data = null;
  try {
    data = await res.json();
  } catch {
    // ignore
  }

  if (!res.ok) {
    const message = data?.error || data?.message || `Request failed (${res.status})`;
    throw new Error(message);
  }

  return data;
}

export async function startProCheckout({ interval }) {
  if (!isSupabaseConfigured) throw new Error('Supabase is not configured');
  const { data } = await supabase.auth.getSession();
  const accessToken = data?.session?.access_token;
  if (!accessToken) throw new Error('Please sign in to upgrade');

  const payload = { interval };
  const dataJson = await postJson('/api/stripe/create-checkout-session', payload, accessToken);
  const url = dataJson?.url;
  if (!url) throw new Error('Stripe session URL missing');
  window.location.assign(url);
}

export async function openCustomerPortal({ returnPath = '/me' } = {}) {
  if (!isSupabaseConfigured) throw new Error('Supabase is not configured');
  const { data } = await supabase.auth.getSession();
  const accessToken = data?.session?.access_token;
  if (!accessToken) throw new Error('Please sign in first');

  const dataJson = await postJson('/api/stripe/create-portal-session', { returnPath }, accessToken);
  const url = dataJson?.url;
  if (!url) throw new Error('Stripe portal URL missing');
  window.location.assign(url);
}

export async function getSubscriptionStatus() {
  if (!isSupabaseConfigured) throw new Error('Supabase is not configured');
  const { data } = await supabase.auth.getSession();
  const accessToken = data?.session?.access_token;
  if (!accessToken) throw new Error('Please sign in first');

  return await getJson('/api/stripe/subscription-status', accessToken);
}
