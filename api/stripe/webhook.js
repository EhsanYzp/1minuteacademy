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

function isProSubscriptionStatus(status) {
  return status === 'active' || status === 'trialing' || status === 'past_due';
}

async function updateUserMetadataMerged(supabaseAdmin, userId, patch) {
  const safePatch = patch && typeof patch === 'object' ? patch : {};
  try {
    const { data } = await supabaseAdmin.auth.admin.getUserById(userId);
    const existing = data?.user?.user_metadata && typeof data.user.user_metadata === 'object'
      ? data.user.user_metadata
      : {};
    await supabaseAdmin.auth.admin.updateUserById(userId, {
      user_metadata: { ...existing, ...safePatch },
    });
  } catch {
    // Fall back to a direct update if the read fails.
    await supabaseAdmin.auth.admin.updateUserById(userId, {
      user_metadata: safePatch,
    });
  }
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

  // Webhook idempotency: claim event id before processing.
  try {
    const { data, error } = await supabaseAdmin.rpc('claim_stripe_webhook_event', {
      event_id: event.id,
      event_type: event.type,
    });
    if (!error && data === false) {
      return text(res, 200, 'ok');
    }
  } catch {
    // If idempotency storage is down, fail-open.
  }

  try {
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object;
      const userId = session?.client_reference_id || session?.metadata?.user_id;
      const subscriptionId = session?.subscription;
      const customerId = session?.customer;
      const metaInterval = session?.metadata?.interval;
      const metaPriceId = session?.metadata?.price_id;

      let sub = null;
      if (subscriptionId) {
        try {
          sub = await stripe.subscriptions.retrieve(String(subscriptionId));
        } catch {
          sub = null;
        }
      }

      const subStatus = sub?.status ?? 'checkout_completed';
      const priceId = sub?.items?.data?.[0]?.price?.id ?? metaPriceId ?? null;
      const interval = sub?.items?.data?.[0]?.price?.recurring?.interval ?? metaInterval ?? null;
      const cpe = sub?.current_period_end
        ? new Date(sub.current_period_end * 1000).toISOString()
        : null;

      await upsertStripeCustomerMapping({
        supabaseAdmin,
        customerId,
        userId: typeof userId === 'string' ? userId : null,
        subscriptionId,
        status: subStatus,
        priceId,
        interval,
        currentPeriodEnd: cpe,
      });

      if (userId) {
        const isPro = isProSubscriptionStatus(String(sub?.status ?? 'active'));
        await updateUserMetadataMerged(supabaseAdmin, userId, {
          plan: isPro ? 'pro' : 'free',
          stripe_customer_id: customerId || undefined,
          stripe_subscription_id: subscriptionId || undefined,
          plan_interval: typeof interval === 'string' ? interval : undefined,
          stripe_price_id: typeof priceId === 'string' ? priceId : undefined,
        });
      }
    }

    if (event.type === 'customer.subscription.updated') {
      const subscription = event.data.object;
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
        await updateUserMetadataMerged(supabaseAdmin, userId, {
          plan: isPro ? 'pro' : 'free',
          stripe_customer_id: customerId || undefined,
          stripe_subscription_id: subscriptionId || undefined,
          plan_interval: interval || null,
          stripe_price_id: priceId || null,
        });
      }
    }

    if (event.type === 'customer.subscription.deleted') {
      const subscription = event.data.object;
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
        await updateUserMetadataMerged(supabaseAdmin, userId, {
          plan: 'free',
          // Keep the subscription id so the app can still show status/history.
          stripe_subscription_id: subscription?.id || null,
          plan_interval: null,
          stripe_price_id: null,
        });
      }
    }

    try {
      await supabaseAdmin
        .from('stripe_webhook_events')
        .update({ status: 'succeeded', processed_at: new Date().toISOString(), last_seen_at: new Date().toISOString() })
        .eq('event_id', event.id);
    } catch {
      // ignore
    }

    return text(res, 200, 'ok');
  } catch (e) {
    try {
      await supabaseAdmin
        .from('stripe_webhook_events')
        .update({ status: 'failed', last_error: String(e?.message || e || 'Server error'), last_seen_at: new Date().toISOString() })
        .eq('event_id', event.id);
    } catch {
      // ignore
    }
    return text(res, 500, e?.message || 'Server error');
  }
}
