import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

function getClientIp(event) {
  const xff = event.headers?.['x-forwarded-for'] || event.headers?.['X-Forwarded-For'];
  if (typeof xff === 'string' && xff.trim()) return xff.split(',')[0].trim();
  return null;
}

async function enforceRateLimit({ supabaseAdmin, key, windowSeconds, maxCount }) {
  const { data, error } = await supabaseAdmin.rpc('rate_limit_check', {
    key,
    window_seconds: windowSeconds,
    max_count: maxCount,
  });
  if (error) return;
  const row = Array.isArray(data) ? data[0] : data;
  if (row && row.allowed === false) {
    const err = new Error('Too many requests. Please wait and try again.');
    err.statusCode = 429;
    err.resetAt = row.reset_at || null;
    throw err;
  }
}

async function getCachedCheckout({ supabaseAdmin, cacheKey }) {
  const { data } = await supabaseAdmin
    .from('stripe_checkout_session_cache')
    .select('checkout_session_id, checkout_url, expires_at')
    .eq('cache_key', cacheKey)
    .maybeSingle();
  return data || null;
}

async function setCachedCheckout({ supabaseAdmin, cacheKey, userId, priceId, interval, session }) {
  const expiresAt = session?.expires_at
    ? new Date(session.expires_at * 1000).toISOString()
    : null;
  await supabaseAdmin
    .from('stripe_checkout_session_cache')
    .upsert({
      cache_key: cacheKey,
      user_id: userId,
      price_id: priceId,
      interval,
      checkout_session_id: session?.id || null,
      checkout_url: session?.url || null,
      expires_at: expiresAt,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'cache_key' });
}

export async function handler(event) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  const stripeKey = process.env.STRIPE_SECRET_KEY;
  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!stripeKey) return { statusCode: 500, body: JSON.stringify({ error: 'Missing STRIPE_SECRET_KEY' }) };
  if (!supabaseUrl || !serviceRoleKey) {
    return { statusCode: 500, body: JSON.stringify({ error: 'Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY' }) };
  }

  const authHeader = event.headers?.authorization || event.headers?.Authorization;
  const token = typeof authHeader === 'string' && authHeader.startsWith('Bearer ')
    ? authHeader.slice('Bearer '.length)
    : null;

  if (!token) return { statusCode: 401, body: JSON.stringify({ error: 'Missing Authorization bearer token' }) };

  let body;
  try {
    body = JSON.parse(event.body || '{}');
  } catch {
    return { statusCode: 400, body: JSON.stringify({ error: 'Invalid JSON body' }) };
  }

  const interval = String(body?.interval ?? 'month').toLowerCase();
  if (interval !== 'month' && interval !== 'year') {
    return { statusCode: 400, body: JSON.stringify({ error: 'Invalid interval' }) };
  }

  const monthlyPriceId = process.env.STRIPE_PRICE_ID_MONTHLY;
  const yearlyPriceId = process.env.STRIPE_PRICE_ID_YEARLY;
  const priceId = interval === 'year' ? yearlyPriceId : monthlyPriceId;

  if (!priceId) {
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: interval === 'year' ? 'Missing STRIPE_PRICE_ID_YEARLY' : 'Missing STRIPE_PRICE_ID_MONTHLY',
      }),
    };
  }

  const normalizeSiteUrl = (input) => {
    let raw = String(input || '').trim();
    if (!raw) return null;

    raw = raw.replace(/^https?;\/\//i, 'https://');
    raw = raw.replace(/^https?:;\/\//i, 'https://');
    raw = raw.replace(/^http;\/\//i, 'http://');
    raw = raw.replace(/^https?:\/\/\//i, (m) => m.slice(0, 8));

    const hasScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(raw);
    const withScheme = hasScheme ? raw : `https://${raw}`;
    return withScheme.replace(/\/+$/, '');
  };

    const siteUrl = normalizeSiteUrl(event.headers?.origin) || normalizeSiteUrl(process.env.SITE_URL);
  if (!siteUrl) return { statusCode: 500, body: JSON.stringify({ error: 'Missing SITE_URL' }) };

  const stripe = process.env.STRIPE_API_VERSION
    ? new Stripe(stripeKey, { apiVersion: process.env.STRIPE_API_VERSION })
    : new Stripe(stripeKey);
  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

  const { data: userData, error: userErr } = await supabaseAdmin.auth.getUser(token);
  if (userErr || !userData?.user) return { statusCode: 401, body: JSON.stringify({ error: 'Invalid Supabase session' }) };

  const user = userData.user;

  const ip = getClientIp(event) || 'unknown';
  try {
    await enforceRateLimit({ supabaseAdmin, key: `stripe:checkout:ip:${ip}`, windowSeconds: 60, maxCount: 12 });
    await enforceRateLimit({ supabaseAdmin, key: `stripe:checkout:user:${user.id}`, windowSeconds: 600, maxCount: 4 });
  } catch (e) {
    return {
      statusCode: e?.statusCode || 429,
      body: JSON.stringify({ error: e?.message || 'Too many requests', reset_at: e?.resetAt || null }),
    };
  }

  const cacheKey = `v1:${user.id}:${priceId}:${interval}`;
  try {
    const cached = await getCachedCheckout({ supabaseAdmin, cacheKey });
    if (cached?.checkout_session_id && cached?.checkout_url) {
      const exp = cached.expires_at ? new Date(cached.expires_at).getTime() : null;
      if (!exp || exp > Date.now() + 5000) {
        try {
          const existingSession = await stripe.checkout.sessions.retrieve(String(cached.checkout_session_id));
          const existingExp = existingSession?.expires_at ? existingSession.expires_at * 1000 : null;
          if (existingSession?.status === 'open' && (!existingExp || existingExp > Date.now() + 5000) && existingSession?.url) {
            return { statusCode: 200, body: JSON.stringify({ url: existingSession.url, reused: true }) };
          }
        } catch {
          // fall through
        }
        return { statusCode: 200, body: JSON.stringify({ url: cached.checkout_url, reused: true }) };
      }
    }
  } catch {
    // ignore
  }

  try {
    const stripeIdempotencyKey = `checkout:${user.id}:${priceId}:${interval}:${Math.floor(Date.now() / 600000)}`;
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      allow_promotion_codes: true,
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: new URL('/me?checkout=success', siteUrl).toString(),
      cancel_url: new URL('/pricing?checkout=cancel', siteUrl).toString(),
      client_reference_id: user.id,
      customer_email: user.email || undefined,
      metadata: {
        user_id: user.id,
        interval,
        price_id: priceId,
      },
      subscription_data: {
        metadata: {
          user_id: user.id,
          interval,
          price_id: priceId,
        },
      },
    }, { idempotencyKey: stripeIdempotencyKey });

    try {
      await setCachedCheckout({ supabaseAdmin, cacheKey, userId: user.id, priceId, interval, session });
    } catch {
      // ignore
    }

    return { statusCode: 200, body: JSON.stringify({ url: session.url }) };
  } catch (e) {
    return { statusCode: 500, body: JSON.stringify({ error: e?.message || 'Stripe error' }) };
  }
}
