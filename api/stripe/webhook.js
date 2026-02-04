import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

function text(res, statusCode, body) {
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'text/plain');
  res.end(body);
}

async function readRawBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  return Buffer.concat(chunks);
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return text(res, 405, 'Method not allowed');

  const stripeKey = process.env.STRIPE_SECRET_KEY;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!stripeKey) return text(res, 500, 'Missing STRIPE_SECRET_KEY');
  if (!webhookSecret) return text(res, 500, 'Missing STRIPE_WEBHOOK_SECRET');
  if (!supabaseUrl || !serviceRoleKey) return text(res, 500, 'Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');

  const stripe = process.env.STRIPE_API_VERSION
    ? new Stripe(stripeKey, { apiVersion: process.env.STRIPE_API_VERSION })
    : new Stripe(stripeKey);

  const signature = req.headers['stripe-signature'];
  if (!signature) return text(res, 400, 'Missing stripe-signature');

  const rawBody = await readRawBody(req);

  let event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
  } catch (err) {
    return text(res, 400, `Webhook Error: ${err?.message || 'Invalid signature'}`);
  }

  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

  try {
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object;
      const userId = session?.client_reference_id || session?.metadata?.user_id;
      const subscriptionId = session?.subscription;
      const customerId = session?.customer;
      const interval = session?.metadata?.interval;
      const priceId = session?.metadata?.price_id;

      if (userId) {
        await supabaseAdmin.auth.admin.updateUserById(userId, {
          user_metadata: {
            plan: 'pro',
            stripe_customer_id: customerId || undefined,
            stripe_subscription_id: subscriptionId || undefined,
            plan_interval: typeof interval === 'string' ? interval : undefined,
            stripe_price_id: typeof priceId === 'string' ? priceId : undefined,
          },
        });
      }
    }

    if (event.type === 'customer.subscription.deleted') {
      const subscription = event.data.object;
      const userId = subscription?.metadata?.user_id;
      if (userId) {
        await supabaseAdmin.auth.admin.updateUserById(userId, {
          user_metadata: {
            plan: 'free',
            stripe_subscription_id: null,
            plan_interval: null,
            stripe_price_id: null,
          },
        });
      }
    }

    return text(res, 200, 'ok');
  } catch (e) {
    return text(res, 500, e?.message || 'Server error');
  }
}
