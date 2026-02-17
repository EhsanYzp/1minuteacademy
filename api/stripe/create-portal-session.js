import { applyCors } from '../_cors.js';
import {
  createStripeClient,
  createSupabaseAdmin,
  enforceRateLimit,
  getBearerToken,
  getClientIp,
  getUserFromToken,
  json,
  normalizeSiteUrl,
  readJsonBody,
} from '../account/_utils.js';

function safeReturnPath(raw) {
  if (typeof raw !== 'string') return null;
  const s = raw.split('#')[0].replace(/\s/g, '').trim();
  if (!s) return null;
  if (!s.startsWith('/')) return null;
  if (s.startsWith('//')) return null;
  if (s.includes('://')) return null;
  return s.slice(0, 1024);
}

export default async function handler(req, res) {
  if (applyCors(req, res)) return;
  if (req.method !== 'POST') return json(res, 405, { error: 'Method not allowed' });

  const token = getBearerToken(req);

  if (!token) return json(res, 401, { error: 'Missing Authorization bearer token' });

  let body;
  try {
    body = await readJsonBody(req);
  } catch {
    return json(res, 400, { error: 'Invalid JSON body' });
  }

  const returnPath = safeReturnPath(body?.returnPath) ?? '/me';

  // SECURITY: redirect targets must be based on a trusted, configured origin.
  // Never fall back to request headers (Origin / Host) which can be forged.
  const siteUrl = normalizeSiteUrl(process.env.SITE_URL);
  if (!siteUrl) return json(res, 500, { error: 'Missing SITE_URL' });

  let stripe;
  let supabaseAdmin;
  try {
    stripe = createStripeClient();
    supabaseAdmin = createSupabaseAdmin();
  } catch (e) {
    return json(res, 500, { error: e?.message || 'Server error' });
  }

  let user;
  try {
    user = await getUserFromToken(supabaseAdmin, token);
  } catch (e) {
    return json(res, Number(e?.status) || 401, { error: e?.message || 'Unauthorized' });
  }
  const customerId = user?.user_metadata?.stripe_customer_id;

  const ip = getClientIp(req) || 'unknown';
  try {
    await enforceRateLimit({ supabaseAdmin, key: `stripe:portal:ip:${ip}`, windowSeconds: 60, maxCount: 30 });
    await enforceRateLimit({ supabaseAdmin, key: `stripe:portal:user:${user.id}`, windowSeconds: 300, maxCount: 10 });
  } catch (e) {
    const status = Number(e?.statusCode) || 429;
    if (status >= 500) console.error('stripe:create-portal-session rate-limit error', e);
    return json(res, status, {
      error: status === 429 ? 'Too many requests. Please wait and try again.' : 'Server error',
      reset_at: e?.resetAt || null,
    });
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
    console.error('stripe:create-portal-session error', e);
    return json(res, 500, { error: 'Server error' });
  }
}
