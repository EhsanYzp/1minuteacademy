import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';
import { applyCors } from '../_cors.js';

function json(res, statusCode, body) {
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(body));
}

function normalizeSiteUrl(input) {
  let raw = String(input ?? '').trim();
  if (!raw) return null;

  // Fix common env-var typos like `https;//example.com` or `https:;//example.com`
  raw = raw.replace(/^https?;\/\//i, 'https://');
  raw = raw.replace(/^https?:;\/\//i, 'https://');
  raw = raw.replace(/^http;\/\//i, 'http://');
  raw = raw.replace(/^https?:\/\/\//i, (m) => m.slice(0, 8)); // collapse `https:////` -> `https://`

  const hasScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(raw);
  const withScheme = hasScheme ? raw : `https://${raw}`;
  return withScheme.replace(/\/+$/, '');
}

function getClientIp(req) {
  const xff = req.headers['x-forwarded-for'];
  if (typeof xff === 'string' && xff.trim()) return xff.split(',')[0].trim();
  return req.socket?.remoteAddress || null;
}

async function enforceRateLimit({ supabaseAdmin, key, windowSeconds, maxCount }) {
  const { data, error } = await supabaseAdmin.rpc('rate_limit_check', {
    key,
    window_seconds: windowSeconds,
    max_count: maxCount,
  });
  if (error) return; // fail-open (don't block checkout if limiter is misconfigured)
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

async function readJsonBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const raw = Buffer.concat(chunks).toString('utf8');
  if (!raw) return {};
  return JSON.parse(raw);
}

export default async function handler(req, res) {
  if (applyCors(req, res)) return;
  if (req.method !== 'POST') return json(res, 405, { error: 'Method not allowed' });

  const stripeKey = process.env.STRIPE_SECRET_KEY;
  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!stripeKey) return json(res, 500, { error: 'Missing STRIPE_SECRET_KEY' });
  if (!supabaseUrl || !serviceRoleKey) return json(res, 500, { error: 'Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY' });

  const authHeader = req.headers.authorization || req.headers.Authorization;
  const token = typeof authHeader === 'string' && authHeader.startsWith('Bearer ')
    ? authHeader.slice('Bearer '.length)
    : null;

  if (!token) return json(res, 401, { error: 'Missing Authorization bearer token' });

  let body;
  try {
    body = await readJsonBody(req);
  } catch {
    return json(res, 400, { error: 'Invalid JSON body' });
  }

  const interval = String(body?.interval ?? 'month').toLowerCase();
  if (interval !== 'month' && interval !== 'year') return json(res, 400, { error: 'Invalid interval' });

  const monthlyPriceId = process.env.STRIPE_PRICE_ID_MONTHLY;
  const yearlyPriceId = process.env.STRIPE_PRICE_ID_YEARLY;
  const priceId = interval === 'year' ? yearlyPriceId : monthlyPriceId;

  if (!priceId) {
    return json(res, 500, {
      error: interval === 'year'
        ? 'Missing STRIPE_PRICE_ID_YEARLY'
        : 'Missing STRIPE_PRICE_ID_MONTHLY',
    });
  }

  // SECURITY: redirect targets must be based on a trusted, configured origin.
  // Never fall back to request headers (Origin / Host) which can be forged.
  const siteUrl = normalizeSiteUrl(process.env.SITE_URL);
  if (!siteUrl) return json(res, 500, { error: 'Missing SITE_URL' });

  const stripe = process.env.STRIPE_API_VERSION
    ? new Stripe(stripeKey, { apiVersion: process.env.STRIPE_API_VERSION })
    : new Stripe(stripeKey);
  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

  const { data: userData, error: userErr } = await supabaseAdmin.auth.getUser(token);
  if (userErr || !userData?.user) return json(res, 401, { error: 'Invalid Supabase session' });

  const user = userData.user;

  // Basic abuse controls.
  const ip = getClientIp(req) || 'unknown';
  try {
    await enforceRateLimit({ supabaseAdmin, key: `stripe:checkout:ip:${ip}`, windowSeconds: 60, maxCount: 12 });
    await enforceRateLimit({ supabaseAdmin, key: `stripe:checkout:user:${user.id}`, windowSeconds: 600, maxCount: 4 });
  } catch (e) {
    const status = Number(e?.statusCode) || 429;
    if (status >= 500) console.error('stripe:create-checkout-session rate-limit error', e);
    return json(res, status, {
      error: status === 429 ? 'Too many requests. Please wait and try again.' : 'Server error',
      reset_at: e?.resetAt || null,
    });
  }

  // Idempotency: reuse an existing open Checkout session for this user+plan.
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
            return json(res, 200, { url: existingSession.url, reused: true });
          }
        } catch {
          // fall through to create a new session
        }

        // If Stripe retrieval fails, still allow returning cached URL if it hasn't expired locally.
        return json(res, 200, { url: cached.checkout_url, reused: true });
      }
    }
  } catch {
    // fail-open
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
      // ignore cache failures
    }

    return json(res, 200, { url: session.url });
  } catch (e) {
    console.error('stripe:create-checkout-session error', e);
    return json(res, 500, { error: 'Server error' });
  }
}
