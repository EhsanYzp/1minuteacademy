import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

function json(res, statusCode, body) {
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(body));
}

async function readJsonBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const raw = Buffer.concat(chunks).toString('utf8');
  if (!raw) return {};
  return JSON.parse(raw);
}

function normalizeSiteUrl(input) {
  let raw = String(input ?? '').trim();
  if (!raw) return null;
  raw = raw.replace(/^https?;\/\//i, 'https://');
  raw = raw.replace(/^https?:;\/\//i, 'https://');
  raw = raw.replace(/^http;\/\//i, 'http://');
  raw = raw.replace(/^https?:\/\/\//i, (m) => m.slice(0, 8));
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
  if (error) return;
  const row = Array.isArray(data) ? data[0] : data;
  if (row && row.allowed === false) {
    const err = new Error('Too many requests. Please wait and try again.');
    err.statusCode = 429;
    err.resetAt = row.reset_at || null;
    throw err;
  }
}

export default async function handler(req, res) {
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

  const returnPath = typeof body?.returnPath === 'string' ? body.returnPath : '/me';

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
  const customerId = user?.user_metadata?.stripe_customer_id;

  const ip = getClientIp(req) || 'unknown';
  try {
    await enforceRateLimit({ supabaseAdmin, key: `stripe:portal:ip:${ip}`, windowSeconds: 60, maxCount: 30 });
    await enforceRateLimit({ supabaseAdmin, key: `stripe:portal:user:${user.id}`, windowSeconds: 300, maxCount: 10 });
  } catch (e) {
    return json(res, e?.statusCode || 429, { error: e?.message || 'Too many requests', reset_at: e?.resetAt || null });
  }

  if (!customerId) {
    return json(res, 400, {
      error: 'No Stripe customer found for this user yet. If you just upgraded, wait a few seconds and refresh.',
    });
  }

  try {
    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: new URL(returnPath, siteUrl).toString(),
    });

    return json(res, 200, { url: session.url });
  } catch (e) {
    return json(res, 500, { error: e?.message || 'Stripe error' });
  }
}
