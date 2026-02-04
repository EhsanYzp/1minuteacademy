import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

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

async function readJsonBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const raw = Buffer.concat(chunks).toString('utf8');
  if (!raw) return {};
  return JSON.parse(raw);
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

  try {
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
    });

    return json(res, 200, { url: session.url });
  } catch (e) {
    return json(res, 500, { error: e?.message || 'Stripe error' });
  }
}
