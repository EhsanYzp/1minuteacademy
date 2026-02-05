import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

function isProSubscriptionStatus(status) {
  return status === 'active' || status === 'trialing' || status === 'past_due';
}

async function resolveUserIdFromStripe({ supabaseAdmin, metadataUserId, customerId, subscriptionId }) {
  const direct = typeof metadataUserId === 'string' && metadataUserId.trim() ? metadataUserId.trim() : null;
  if (direct) return direct;

  if (customerId) {
    const { data, error } = await supabaseAdmin
      .from('stripe_customers')
      .select('user_id')
      .eq('customer_id', String(customerId))
      .maybeSingle();
    if (!error && data?.user_id) return String(data.user_id);
  }

  if (subscriptionId) {
    const { data, error } = await supabaseAdmin
      .from('stripe_customers')
      .select('user_id')
      .eq('subscription_id', String(subscriptionId))
      .maybeSingle();
    if (!error && data?.user_id) return String(data.user_id);
  }

  return null;
}

async function upsertStripeCustomerMapping({
  supabaseAdmin,
  customerId,
  userId,
  subscriptionId,
  status,
  priceId,
  interval,
  currentPeriodEnd,
}) {
  const cid = typeof customerId === 'string' || typeof customerId === 'number' ? String(customerId) : null;
  if (!cid) return;

  const payload = { customer_id: cid };
  if (userId) payload.user_id = userId;
  if (subscriptionId) payload.subscription_id = String(subscriptionId);
  if (status) payload.status = String(status);
  if (priceId) payload.price_id = String(priceId);
  if (interval) payload.interval = String(interval);
  if (currentPeriodEnd) payload.current_period_end = currentPeriodEnd;

  await supabaseAdmin
    .from('stripe_customers')
    .upsert(payload, { onConflict: 'customer_id' });
}

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
      const interval = session?.metadata?.interval;
      const priceId = session?.metadata?.price_id;

      await upsertStripeCustomerMapping({
        supabaseAdmin,
        customerId,
        userId: typeof userId === 'string' ? userId : null,
        subscriptionId,
        status: 'checkout_completed',
        priceId,
        interval,
      });

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

    if (stripeEvent.type === 'customer.subscription.updated') {
      const subscription = stripeEvent.data.object;
      const subscriptionId = subscription?.id;
      const customerId = subscription?.customer;
      const status = subscription?.status;
      const metadataUserId = subscription?.metadata?.user_id;

      const priceId = subscription?.items?.data?.[0]?.price?.id ?? null;
      const interval = subscription?.items?.data?.[0]?.price?.recurring?.interval ?? null;
      const cpe = subscription?.current_period_end
        ? new Date(subscription.current_period_end * 1000).toISOString()
        : null;

      const userId = await resolveUserIdFromStripe({
        supabaseAdmin,
        metadataUserId,
        customerId,
        subscriptionId,
      });

      await upsertStripeCustomerMapping({
        supabaseAdmin,
        customerId,
        userId,
        subscriptionId,
        status,
        priceId,
        interval,
        currentPeriodEnd: cpe,
      });

      if (userId) {
        const isPro = isProSubscriptionStatus(String(status ?? ''));
        await supabaseAdmin.auth.admin.updateUserById(userId, {
          user_metadata: {
            plan: isPro ? 'pro' : 'free',
            stripe_customer_id: customerId || undefined,
            stripe_subscription_id: subscriptionId || undefined,
            plan_interval: interval || null,
            stripe_price_id: priceId || null,
          },
        });
      }
    }

    if (stripeEvent.type === 'customer.subscription.deleted') {
      const subscription = stripeEvent.data.object;
      const subscriptionId = subscription?.id;
      const customerId = subscription?.customer;
      const metadataUserId = subscription?.metadata?.user_id;

      const userId = await resolveUserIdFromStripe({
        supabaseAdmin,
        metadataUserId,
        customerId,
        subscriptionId,
      });

      await upsertStripeCustomerMapping({
        supabaseAdmin,
        customerId,
        userId,
        subscriptionId,
        status: subscription?.status || 'deleted',
      });

      if (userId) {
        await supabaseAdmin.auth.admin.updateUserById(userId, {
          user_metadata: {
            plan: 'free',
            stripe_subscription_id: subscription?.id || null,
            plan_interval: null,
            stripe_price_id: null,
          },
        });
      }
    }

    return { statusCode: 200, body: 'ok' };
  } catch (e) {
    return { statusCode: 500, body: e?.message || 'Server error' };
  }
}
