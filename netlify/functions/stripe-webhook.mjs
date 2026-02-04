import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

export async function handler(event) {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method not allowed' };

  const stripeKey = process.env.STRIPE_SECRET_KEY;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!stripeKey) return { statusCode: 500, body: 'Missing STRIPE_SECRET_KEY' };
  if (!webhookSecret) return { statusCode: 500, body: 'Missing STRIPE_WEBHOOK_SECRET' };
  if (!supabaseUrl || !serviceRoleKey) return { statusCode: 500, body: 'Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY' };

  const stripe = process.env.STRIPE_API_VERSION
    ? new Stripe(stripeKey, { apiVersion: process.env.STRIPE_API_VERSION })
    : new Stripe(stripeKey);
  const signature = event.headers?.['stripe-signature'];
  if (!signature) return { statusCode: 400, body: 'Missing stripe-signature' };

  let stripeEvent;
  try {
    stripeEvent = stripe.webhooks.constructEvent(event.body, signature, webhookSecret);
  } catch (err) {
    return { statusCode: 400, body: `Webhook Error: ${err?.message || 'Invalid signature'}` };
  }

  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

  try {
    if (stripeEvent.type === 'checkout.session.completed') {
      const session = stripeEvent.data.object;
      const userId = session?.client_reference_id || session?.metadata?.user_id;
      const subscriptionId = session?.subscription;
      const customerId = session?.customer;

      if (userId) {
        await supabaseAdmin.auth.admin.updateUserById(userId, {
          user_metadata: {
            plan: 'pro',
            stripe_customer_id: customerId || undefined,
            stripe_subscription_id: subscriptionId || undefined,
          },
        });
      }
    }

    if (stripeEvent.type === 'customer.subscription.deleted') {
      const subscription = stripeEvent.data.object;
      const userId = subscription?.metadata?.user_id;
      if (userId) {
        await supabaseAdmin.auth.admin.updateUserById(userId, {
          user_metadata: {
            plan: 'free',
            stripe_subscription_id: null,
          },
        });
      }
    }

    return { statusCode: 200, body: 'ok' };
  } catch (e) {
    return { statusCode: 500, body: e?.message || 'Server error' };
  }
}
