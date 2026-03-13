import { applyCors } from '../_cors.js';
import { json, createSupabaseAdmin, getBearerToken } from '../account/_utils.js';

/**
 * GET /api/admin/users?q=searchterm
 *
 * Search users by email. Returns matching users with metadata.
 * Auth: Bearer <ADMIN_SECRET>
 */
export default async function handler(req, res) {
  if (applyCors(req, res)) return;
  if (req.method !== 'GET') return json(res, 405, { error: 'Method not allowed' });

  const secret = process.env.ADMIN_SECRET;
  if (!secret) return json(res, 500, { error: 'ADMIN_SECRET not configured' });

  const token = getBearerToken(req);
  if (!token || token !== secret) return json(res, 401, { error: 'Unauthorized' });

  const url = new URL(req.url, `http://${req.headers.host}`);
  const q = (url.searchParams.get('q') || '').trim().toLowerCase();

  if (!q || q.length < 2) {
    return json(res, 200, { users: [], query: q });
  }

  try {
    const sb = createSupabaseAdmin();

    // Fetch users (up to 1000) and filter by email match
    const { data } = await sb.auth.admin.listUsers({ page: 1, perPage: 1000 });
    const allUsers = data?.users ?? [];

    const matched = allUsers
      .filter(u => {
        const email = (u.email || '').toLowerCase();
        const name = (u.user_metadata?.display_name || u.user_metadata?.full_name || '').toLowerCase();
        return email.includes(q) || name.includes(q);
      })
      .slice(0, 50)
      .map(u => ({
        id: u.id,
        email: u.email,
        created_at: u.created_at,
        email_confirmed_at: u.email_confirmed_at,
        last_sign_in_at: u.last_sign_in_at,
        provider: u.app_metadata?.provider ?? 'email',
        plan: u.user_metadata?.plan || u.app_metadata?.plan || 'free',
        display_name: u.user_metadata?.display_name || u.user_metadata?.full_name || null,
        avatar_url: u.user_metadata?.avatar_url || null,
      }));

    return json(res, 200, { users: matched, query: q });
  } catch (err) {
    console.error('[admin/users]', err);
    return json(res, err.status || 500, { error: err.message || 'Internal server error' });
  }
}
