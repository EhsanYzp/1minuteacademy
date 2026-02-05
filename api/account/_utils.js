import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

export function json(res, statusCode, body) {
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(body));
}

export async function readJsonBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const raw = Buffer.concat(chunks).toString('utf8');
  if (!raw) return {};
  return JSON.parse(raw);
}

export function getBearerToken(req) {
  const authHeader = req.headers.authorization || req.headers.Authorization;
  if (typeof authHeader !== 'string') return null;
  if (!authHeader.startsWith('Bearer ')) return null;
  return authHeader.slice('Bearer '.length);
}

export function createSupabaseAdmin() {
  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    const err = new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    err.code = 'config';
    throw err;
  }
  return createClient(supabaseUrl, serviceRoleKey);
}

export function createStripeClient() {
  const stripeKey = process.env.STRIPE_SECRET_KEY;
  if (!stripeKey) {
    const err = new Error('Missing STRIPE_SECRET_KEY');
    err.code = 'config';
    throw err;
  }

  return process.env.STRIPE_API_VERSION
    ? new Stripe(stripeKey, { apiVersion: process.env.STRIPE_API_VERSION })
    : new Stripe(stripeKey);
}

export function getClientIp(req) {
  const xff = req.headers['x-forwarded-for'];
  if (typeof xff === 'string' && xff.trim()) return xff.split(',')[0].trim();
  return req.socket?.remoteAddress || null;
}

export async function enforceRateLimit({ supabaseAdmin, key, windowSeconds, maxCount }) {
  const { data, error } = await supabaseAdmin.rpc('rate_limit_check', {
    key,
    window_seconds: windowSeconds,
    max_count: maxCount,
  });

  // If rate limiting is not set up yet, fail-open so critical account actions still work.
  if (error) return;

  const row = Array.isArray(data) ? data[0] : data;
  if (row && row.allowed === false) {
    const err = new Error('Too many requests. Please wait and try again.');
    err.status = 429;
    err.resetAt = row.reset_at || null;
    throw err;
  }
}

export async function getUserFromToken(supabaseAdmin, token) {
  const { data, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !data?.user) {
    const err = new Error('Invalid Supabase session');
    err.status = 401;
    throw err;
  }
  return data.user;
}
