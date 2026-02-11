import { createSupabaseAdmin, enforceRateLimit, getBearerToken, getClientIp, getUserFromToken, json } from './_utils.js';
import { applyCors } from '../_cors.js';

export default async function handler(req, res) {
  if (applyCors(req, res)) return;
  if (req.method !== 'POST') return json(res, 405, { error: 'Method not allowed' });

  const token = getBearerToken(req);
  if (!token) return json(res, 401, { error: 'Missing Authorization bearer token' });

  let supabaseAdmin;
  try {
    supabaseAdmin = createSupabaseAdmin();
  } catch (e) {
    console.error('account:pause config error', e);
    return json(res, 500, { error: 'Server error' });
  }

  try {
    const user = await getUserFromToken(supabaseAdmin, token);

    const ip = getClientIp(req) || 'unknown';
    await enforceRateLimit({ supabaseAdmin, key: `account:pause:ip:${ip}`, windowSeconds: 60, maxCount: 20 });
    await enforceRateLimit({ supabaseAdmin, key: `account:pause:user:${user.id}`, windowSeconds: 300, maxCount: 10 });

    const { data: existing } = await supabaseAdmin.auth.admin.getUserById(user.id);
    const prevMeta = existing?.user?.user_metadata ?? user?.user_metadata ?? {};

    const nextMeta = {
      ...prevMeta,
      paused: true,
      paused_at: new Date().toISOString(),
    };

    await supabaseAdmin.auth.admin.updateUserById(user.id, { user_metadata: nextMeta });
    return json(res, 200, { ok: true });
  } catch (e) {
    const status = Number(e?.status) || 500;
    if (status >= 500) console.error('account:pause handler error', e);
    const safeError =
      status === 401 ? 'Unauthorized' :
      status === 403 ? 'Forbidden' :
      status === 404 ? 'Not found' :
      status === 429 ? 'Too many requests. Please wait and try again.' :
      status >= 500 ? 'Server error' :
      'Request failed';
    return json(res, status, { error: safeError });
  }
}
