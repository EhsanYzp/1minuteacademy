import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

export async function handler(event) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  const stripeKey = process.env.STRIPE_SECRET_KEY;
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

  if (!stripeKey) return { statusCode: 500, body: JSON.stringify({ error: 'Missing STRIPE_SECRET_KEY' }) };
  if (!supabaseUrl || !supabaseAnonKey) {
    return { statusCode: 500, body: JSON.stringify({ error: 'Missing SUPABASE_URL or SUPABASE_ANON_KEY' }) };
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

  const siteUrl = process.env.SITE_URL || event.headers?.origin;
  if (!siteUrl) return { statusCode: 500, body: JSON.stringify({ error: 'Missing SITE_URL' }) };

  const stripe = process.env.STRIPE_API_VERSION
    ? new Stripe(stripeKey, { apiVersion: process.env.STRIPE_API_VERSION })
    : new Stripe(stripeKey);
  const supabase = createClient(supabaseUrl, supabaseAnonKey);

  const { data: userData, error: userErr } = await supabase.auth.getUser(token);
  if (userErr || !userData?.user) return { statusCode: 401, body: JSON.stringify({ error: 'Invalid Supabase session' }) };

  const user = userData.user;

  try {
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      allow_promotion_codes: true,
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${siteUrl}/pricing?checkout=success`,
      cancel_url: `${siteUrl}/pricing?checkout=cancel`,
      client_reference_id: user.id,
      customer_email: user.email || undefined,
      metadata: { user_id: user.id },
      subscription_data: { metadata: { user_id: user.id } },
    });

    return { statusCode: 200, body: JSON.stringify({ url: session.url }) };
  } catch (e) {
    return { statusCode: 500, body: JSON.stringify({ error: e?.message || 'Stripe error' }) };
  }
}
