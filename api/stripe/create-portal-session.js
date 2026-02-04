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

export default async function handler(req, res) {
  if (req.method !== 'POST') return json(res, 405, { error: 'Method not allowed' });

  const stripeKey = process.env.STRIPE_SECRET_KEY;
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

  if (!stripeKey) return json(res, 500, { error: 'Missing STRIPE_SECRET_KEY' });
  if (!supabaseUrl || !supabaseAnonKey) return json(res, 500, { error: 'Missing SUPABASE_URL or SUPABASE_ANON_KEY' });

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

  const forwardedProto = req.headers['x-forwarded-proto'];
  const forwardedHost = req.headers['x-forwarded-host'] || req.headers.host;
  const inferredSiteUrl = forwardedHost
    ? `${forwardedProto || 'https'}://${forwardedHost}`
    : req.headers.origin;
  // Prefer the configured canonical origin so users don't bounce between apex/www
  // (which would lose Supabase session stored per-origin).
  const siteUrl = normalizeSiteUrl(process.env.SITE_URL) || normalizeSiteUrl(inferredSiteUrl);
  if (!siteUrl) return json(res, 500, { error: 'Missing SITE_URL' });

  const stripe = process.env.STRIPE_API_VERSION
    ? new Stripe(stripeKey, { apiVersion: process.env.STRIPE_API_VERSION })
    : new Stripe(stripeKey);
  const supabase = createClient(supabaseUrl, supabaseAnonKey);

  const { data: userData, error: userErr } = await supabase.auth.getUser(token);
  if (userErr || !userData?.user) return json(res, 401, { error: 'Invalid Supabase session' });

  const user = userData.user;
  const customerId = user?.user_metadata?.stripe_customer_id;

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
