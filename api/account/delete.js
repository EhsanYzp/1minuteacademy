import {
  createStripeClient,
  createSupabaseAdmin,
  enforceRateLimit,
  getBearerToken,
  getClientIp,
  getUserFromToken,
  json,
  readJsonBody,
} from './_utils.js';
import { applyCors } from '../_cors.js';

function isActiveLikeStripeStatus(status) {
  const s = String(status ?? '').toLowerCase();
  return s === 'active' || s === 'trialing' || s === 'past_due' || s === 'unpaid' || s === 'incomplete';
}

async function cancelAnyActiveSubscriptions({ stripe, stripeCustomerId, stripeSubscriptionId }) {
  // Prefer explicit subscription id if present.
  if (stripeSubscriptionId) {
    const sub = await stripe.subscriptions.retrieve(stripeSubscriptionId);
    if (sub && isActiveLikeStripeStatus(sub.status)) {
      await stripe.subscriptions.cancel(sub.id);
      return { canceled: true, subscriptionId: sub.id };
    }
    return { canceled: false, subscriptionId: stripeSubscriptionId };
  }

  if (!stripeCustomerId) return { canceled: false, subscriptionId: null };

  const subs = await stripe.subscriptions.list({ customer: stripeCustomerId, status: 'all', limit: 10 });
  const items = Array.isArray(subs?.data) ? subs.data : [];

  // Cancel any active-like subscriptions (rare but can happen if metadata got out of sync).
  let canceledAny = false;
  for (const s of items) {
    if (isActiveLikeStripeStatus(s?.status)) {
      await stripe.subscriptions.cancel(s.id);
      canceledAny = true;
    }
  }

  return { canceled: canceledAny, subscriptionId: null };
}

export default async function handler(req, res) {
  if (applyCors(req, res)) return;
  if (req.method !== 'POST') return json(res, 405, { error: 'Method not allowed' });

  const token = getBearerToken(req);
  if (!token) return json(res, 401, { error: 'Missing Authorization bearer token' });

  let body = {};
  try {
    body = await readJsonBody(req);
  } catch {
    return json(res, 400, { error: 'Invalid JSON body' });
  }

  const confirmation = String(body?.confirmation ?? '').trim();
  if (confirmation !== 'DELETE') {
    return json(res, 400, { error: 'Confirmation required. Type DELETE to confirm.' });
  }

  let supabaseAdmin;
  try {
    supabaseAdmin = createSupabaseAdmin();
  } catch (e) {
    console.error('account:delete config error', e);
    return json(res, 500, { error: 'Server error' });
  }

  try {
    const authedUser = await getUserFromToken(supabaseAdmin, token);

    const ip = getClientIp(req) || 'unknown';
    await enforceRateLimit({ supabaseAdmin, key: `account:delete:ip:${ip}`, windowSeconds: 60, maxCount: 6 });
    await enforceRateLimit({ supabaseAdmin, key: `account:delete:user:${authedUser.id}`, windowSeconds: 3600, maxCount: 3 });

    // Get the authoritative metadata from the admin view.
    const { data: existing, error: existingErr } = await supabaseAdmin.auth.admin.getUserById(authedUser.id);
    if (existingErr || !existing?.user) return json(res, 500, { error: 'Could not load user profile' });

    const meta = existing.user.user_metadata ?? {};
    const stripeCustomerId = meta.stripe_customer_id ?? null;
    const stripeSubscriptionId = meta.stripe_subscription_id ?? null;

    // Safety rule: if billing exists, try to cancel first. If cancellation fails, do NOT delete.
    if (stripeCustomerId || stripeSubscriptionId) {
      let stripe;
      try {
        stripe = createStripeClient();
      } catch (e) {
        console.error('account:delete billing config error', e);
        return json(res, 500, { error: 'Server error' });
      }

      try {
        await cancelAnyActiveSubscriptions({ stripe, stripeCustomerId, stripeSubscriptionId });
      } catch (e) {
        console.error('account:delete stripe cancellation error', e);
        return json(res, 409, {
          error: 'Could not cancel your active subscription automatically. Please cancel it in the billing portal, then try deleting again.',
        });
      }
    }

    const { error: delErr } = await supabaseAdmin.auth.admin.deleteUser(authedUser.id);
    if (delErr) {
      console.error('account:delete supabase delete error', delErr);
      return json(res, 500, { error: 'Server error' });
    }

    return json(res, 200, { ok: true });
  } catch (e) {
    const status = Number(e?.status) || 500;
    if (status >= 500) console.error('account:delete handler error', e);
    const safeError =
      status === 401 ? 'Unauthorized' :
      status === 403 ? 'Forbidden' :
      status === 404 ? 'Not found' :
      status === 409 ? 'Conflict' :
      status === 429 ? 'Too many requests. Please wait and try again.' :
      status >= 500 ? 'Server error' :
      'Request failed';
    return json(res, status, { error: safeError });
  }
}
