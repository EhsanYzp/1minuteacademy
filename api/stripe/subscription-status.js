import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

function json(res, statusCode, body) {
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(body));
}

export default async function handler(req, res) {
  if (req.method !== 'GET') return json(res, 405, { error: 'Method not allowed' });

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

  const stripe = process.env.STRIPE_API_VERSION
    ? new Stripe(stripeKey, { apiVersion: process.env.STRIPE_API_VERSION })
    : new Stripe(stripeKey);
  const supabase = createClient(supabaseUrl, supabaseAnonKey);

  const { data: userData, error: userErr } = await supabase.auth.getUser(token);
  if (userErr || !userData?.user) return json(res, 401, { error: 'Invalid Supabase session' });

  const user = userData.user;
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

    return {
      subscription_id: sub?.id ?? null,
      active: sub?.status === 'active' || sub?.status === 'trialing' || sub?.status === 'past_due',
      status: sub?.status ?? null,
      current_period_end: epochPeriodEnd ? new Date(epochPeriodEnd * 1000).toISOString() : null,
      cancel_at_period_end: Boolean(sub?.cancel_at_period_end),
      cancel_at: sub?.cancel_at ? new Date(sub.cancel_at * 1000).toISOString() : null,
      canceled_at: sub?.canceled_at ? new Date(sub.canceled_at * 1000).toISOString() : null,
      ended_at: sub?.ended_at ? new Date(sub.ended_at * 1000).toISOString() : null,
      created: sub?.created ? new Date(sub.created * 1000).toISOString() : null,
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
