import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

function json(res, statusCode, body) {
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(body));
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
  if (req.method !== 'GET') return json(res, 405, { error: 'Method not allowed' });

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

  const stripe = process.env.STRIPE_API_VERSION
    ? new Stripe(stripeKey, { apiVersion: process.env.STRIPE_API_VERSION })
    : new Stripe(stripeKey);
  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

  const { data: userData, error: userErr } = await supabaseAdmin.auth.getUser(token);
  if (userErr || !userData?.user) return json(res, 401, { error: 'Invalid Supabase session' });

  const user = userData.user;

  const ip = getClientIp(req) || 'unknown';
  try {
    await enforceRateLimit({ supabaseAdmin, key: `stripe:substatus:ip:${ip}`, windowSeconds: 60, maxCount: 60 });
    await enforceRateLimit({ supabaseAdmin, key: `stripe:substatus:user:${user.id}`, windowSeconds: 60, maxCount: 20 });
  } catch (e) {
    return json(res, e?.statusCode || 429, { error: e?.message || 'Too many requests', reset_at: e?.resetAt || null });
  }
  const subscriptionId = user?.user_metadata?.stripe_subscription_id;
  const customerId = user?.user_metadata?.stripe_customer_id;
  const planInterval = user?.user_metadata?.plan_interval ?? null;

  async function shape(sub) {
    const epochPeriodEnd =
      sub?.current_period_end ??
      // Some portal flows set a specific cancellation time (cancel_at)
      // while current_period_end can be absent in some edge cases.
      sub?.cancel_at ??
      null;

    const epochPeriodStart = sub?.current_period_start ?? null;
    const epochBillingAnchor = sub?.billing_cycle_anchor ?? null;
    const epochTrialEnd = sub?.trial_end ?? null;

    return {
      subscription_id: sub?.id ?? null,
      active: sub?.status === 'active' || sub?.status === 'trialing' || sub?.status === 'past_due',
      status: sub?.status ?? null,
      current_period_start: epochPeriodStart != null ? new Date(epochPeriodStart * 1000).toISOString() : null,
      current_period_end: epochPeriodEnd != null ? new Date(epochPeriodEnd * 1000).toISOString() : null,
      cancel_at_period_end: Boolean(sub?.cancel_at_period_end),
      cancel_at: sub?.cancel_at != null ? new Date(sub.cancel_at * 1000).toISOString() : null,
      canceled_at: sub?.canceled_at != null ? new Date(sub.canceled_at * 1000).toISOString() : null,
      ended_at: sub?.ended_at != null ? new Date(sub.ended_at * 1000).toISOString() : null,
      billing_cycle_anchor: epochBillingAnchor != null ? new Date(epochBillingAnchor * 1000).toISOString() : null,
      trial_end: epochTrialEnd != null ? new Date(epochTrialEnd * 1000).toISOString() : null,
      created: sub?.created != null ? new Date(sub.created * 1000).toISOString() : null,
      plan_interval: planInterval,
    };
  }

  if (!subscriptionId) {
    // Some users may have stripe_customer_id but not stripe_subscription_id
    // (e.g. if metadata propagation was delayed). Infer the latest subscription.
    if (customerId) {
      try {
        const list = await stripe.subscriptions.list({ customer: customerId, status: 'all', limit: 1 });
        const sub = Array.isArray(list?.data) && list.data.length > 0 ? list.data[0] : null;
        if (sub) return json(res, 200, await shape(sub));
      } catch {
        // fall through
      }
    }

    return json(res, 200, {
      subscription_id: null,
      active: false,
      status: null,
      current_period_end: null,
      cancel_at_period_end: null,
      cancel_at: null,
      canceled_at: null,
      ended_at: null,
      created: null,
      plan_interval: planInterval,
    });
  }

  try {
    const sub = await stripe.subscriptions.retrieve(subscriptionId);

    return json(res, 200, await shape(sub));
  } catch (e) {
    return json(res, 500, { error: e?.message || 'Stripe error' });
  }
}
