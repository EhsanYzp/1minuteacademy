import { applyCors } from '../_cors.js';
import { json, createSupabaseAdmin, getBearerToken, readJsonBody } from '../account/_utils.js';

/**
 * POST /api/admin/moderate
 *
 * Toggle testimonial approval.
 * Body: { id: string, approved: boolean }
 * Auth: Bearer <ADMIN_SECRET>
 */
export default async function handler(req, res) {
  if (applyCors(req, res)) return;
  if (req.method !== 'POST') return json(res, 405, { error: 'Method not allowed' });

  const secret = process.env.ADMIN_SECRET;
  if (!secret) return json(res, 500, { error: 'ADMIN_SECRET not configured' });

  const token = getBearerToken(req);
  if (!token || token !== secret) return json(res, 401, { error: 'Unauthorized' });

  try {
    const body = await readJsonBody(req);
    const { id, approved } = body || {};

    if (!id) return json(res, 400, { error: 'Missing testimonial id' });
    if (typeof approved !== 'boolean') return json(res, 400, { error: 'approved must be a boolean' });

    const sb = createSupabaseAdmin();

    const { error } = await sb
      .from('testimonials')
      .update({ approved })
      .eq('id', id);

    if (error) throw error;

    return json(res, 200, { success: true, id, approved });
  } catch (err) {
    console.error('[admin/moderate]', err);
    return json(res, err.status || 500, { error: err.message || 'Internal server error' });
  }
}
