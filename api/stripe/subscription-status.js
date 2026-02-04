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
  const planInterval = user?.user_metadata?.plan_interval ?? null;

  if (!subscriptionId) {
    return json(res, 200, {
      active: false,
      status: null,
      current_period_end: null,
      cancel_at_period_end: null,
      cancel_at: null,
      created: null,
      plan_interval: planInterval,
    });
  }

  try {
    const sub = await stripe.subscriptions.retrieve(subscriptionId);

    return json(res, 200, {
      active: sub.status === 'active' || sub.status === 'trialing' || sub.status === 'past_due',
      status: sub.status,
      current_period_end: sub.current_period_end ? new Date(sub.current_period_end * 1000).toISOString() : null,
      cancel_at_period_end: Boolean(sub.cancel_at_period_end),
      cancel_at: sub.cancel_at ? new Date(sub.cancel_at * 1000).toISOString() : null,
      canceled_at: sub.canceled_at ? new Date(sub.canceled_at * 1000).toISOString() : null,
      ended_at: sub.ended_at ? new Date(sub.ended_at * 1000).toISOString() : null,
      created: sub.created ? new Date(sub.created * 1000).toISOString() : null,
      plan_interval: planInterval,
    });
  } catch (e) {
    return json(res, 500, { error: e?.message || 'Stripe error' });
  }
}
