import { applyCors } from '../_cors.js';
import { json, createSupabaseAdmin, getBearerToken } from '../account/_utils.js';

/**
 * GET /api/admin/stats
 *
 * Returns aggregated admin dashboard data:
 *  - total users, recent signups
 *  - paying / active / paused subscribers
 *  - testimonials (total, approved, average rating)
 *  - topic ratings (total, average)
 *  - content counts (categories, courses, chapters, topics)
 *  - recent signups list
 *  - recent payments list
 *
 * Authenticated via ADMIN_SECRET header — no Supabase user session required.
 */
export default async function handler(req, res) {
  if (applyCors(req, res)) return;

  if (req.method !== 'GET') {
    return json(res, 405, { error: 'Method not allowed' });
  }

  /* ── Auth: require ADMIN_SECRET ── */
  const secret = process.env.ADMIN_SECRET;
  if (!secret) return json(res, 500, { error: 'ADMIN_SECRET not configured on server' });

  const token = getBearerToken(req);
  if (!token || token !== secret) {
    return json(res, 401, { error: 'Unauthorized' });
  }

  try {
    const sb = createSupabaseAdmin();

    /* ── Run all queries in parallel ── */
    const [
      usersRes,
      recentUsersRes,
      stripeCustomersRes,
      testimonialsRes,
      ratingSummaryRes,
      categoriesRes,
      coursesRes,
      chaptersRes,
      topicsRes,
      progressRes,
      recentTestimonialsRes,
    ] = await Promise.all([
      // Total auth users (Supabase admin API)
      sb.auth.admin.listUsers({ page: 1, perPage: 1 }),

      // Recent signups (last 50)
      sb.auth.admin.listUsers({ page: 1, perPage: 50 }),

      // Stripe customers
      sb.from('stripe_customers').select('*'),

      // Testimonials
      sb.from('testimonials').select('id, rating, approved, author_name, quote, created_at'),

      // Rating summaries
      sb.from('topic_rating_summaries').select('avg_rating, ratings_count'),

      // Content counts
      sb.from('categories').select('id', { count: 'exact', head: true }).eq('published', true),
      sb.from('courses').select('id', { count: 'exact', head: true }).eq('published', true),
      sb.from('chapters').select('id', { count: 'exact', head: true }).eq('published', true),
      sb.from('topics').select('id', { count: 'exact', head: true }).eq('published', true),

      // Unique users who completed at least one topic
      sb.from('user_topic_progress').select('user_id'),

      // Recent testimonials (last 20)
      sb.from('testimonials')
        .select('id, author_name, author_avatar_url, quote, rating, platform, approved, created_at')
        .order('created_at', { ascending: false })
        .limit(20),
    ]);

    /* ── Process users ── */
    const allUsers = recentUsersRes?.data?.users ?? [];
    const totalUsers = usersRes?.data?.users
      ? (recentUsersRes?.data?.total ?? allUsers.length)
      : 0;

    // Users who signed up in last 24h / 7d / 30d
    const now = Date.now();
    const d24h = now - 24 * 60 * 60 * 1000;
    const d7d = now - 7 * 24 * 60 * 60 * 1000;
    const d30d = now - 30 * 24 * 60 * 60 * 1000;

    const signupsLast24h = allUsers.filter(u => new Date(u.created_at).getTime() > d24h).length;
    const signupsLast7d = allUsers.filter(u => new Date(u.created_at).getTime() > d7d).length;
    const signupsLast30d = allUsers.filter(u => new Date(u.created_at).getTime() > d30d).length;

    const recentSignups = allUsers
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
      .slice(0, 20)
      .map(u => ({
        id: u.id,
        email: u.email,
        created_at: u.created_at,
        email_confirmed_at: u.email_confirmed_at,
        last_sign_in_at: u.last_sign_in_at,
        provider: u.app_metadata?.provider ?? 'email',
      }));

    /* ── Process stripe customers ── */
    const customers = stripeCustomersRes?.data ?? [];
    const activeSubscribers = customers.filter(c => c.plan && !c.paused);
    const pausedSubscribers = customers.filter(c => c.paused);
    const monthlySubscribers = activeSubscribers.filter(c => c.plan === 'month' || c.interval === 'month');
    const yearlySubscribers = activeSubscribers.filter(c => c.plan === 'year' || c.interval === 'year');

    const recentPayments = customers
      .filter(c => c.plan)
      .sort((a, b) => new Date(b.updated_at || b.created_at || 0) - new Date(a.updated_at || a.created_at || 0))
      .slice(0, 20)
      .map(c => ({
        user_id: c.user_id,
        stripe_customer_id: c.stripe_customer_id,
        plan: c.plan,
        paused: c.paused ?? false,
        updated_at: c.updated_at,
      }));

    /* ── Process testimonials ── */
    const testimonials = testimonialsRes?.data ?? [];
    const approvedTestimonials = testimonials.filter(t => t.approved !== false);
    const testimonialRatings = approvedTestimonials.map(t => t.rating).filter(r => r != null);
    const avgTestimonialRating = testimonialRatings.length
      ? testimonialRatings.reduce((s, r) => s + r, 0) / testimonialRatings.length
      : 0;

    /* ── Process ratings ── */
    const ratingSummaries = ratingSummaryRes?.data ?? [];
    const totalRatings = ratingSummaries.reduce((s, r) => s + (r.ratings_count || 0), 0);
    const weightedSum = ratingSummaries.reduce((s, r) => s + (r.avg_rating || 0) * (r.ratings_count || 0), 0);
    const avgTopicRating = totalRatings > 0 ? weightedSum / totalRatings : 0;
    const topicsRated = ratingSummaries.filter(r => r.ratings_count > 0).length;

    /* ── Unique active learners ── */
    const progressRows = progressRes?.data ?? [];
    const uniqueLearners = new Set(progressRows.map(r => r.user_id)).size;

    /* ── Build response ── */
    return json(res, 200, {
      users: {
        total: totalUsers,
        signups_last_24h: signupsLast24h,
        signups_last_7d: signupsLast7d,
        signups_last_30d: signupsLast30d,
        recent: recentSignups,
      },
      billing: {
        total_subscribers: activeSubscribers.length + pausedSubscribers.length,
        active_subscribers: activeSubscribers.length,
        paused_subscribers: pausedSubscribers.length,
        monthly: monthlySubscribers.length,
        yearly: yearlySubscribers.length,
        recent_payments: recentPayments,
      },
      testimonials: {
        total: testimonials.length,
        approved: approvedTestimonials.length,
        avg_rating: Math.round(avgTestimonialRating * 100) / 100,
        recent: (recentTestimonialsRes?.data ?? []),
      },
      ratings: {
        total_ratings: totalRatings,
        avg_rating: Math.round(avgTopicRating * 100) / 100,
        topics_rated: topicsRated,
      },
      content: {
        categories: categoriesRes?.count ?? 0,
        courses: coursesRes?.count ?? 0,
        chapters: chaptersRes?.count ?? 0,
        topics: topicsRes?.count ?? 0,
      },
      engagement: {
        unique_learners: uniqueLearners,
      },
      generated_at: new Date().toISOString(),
    });
  } catch (err) {
    console.error('[admin/stats]', err);
    return json(res, err.status || 500, { error: err.message || 'Internal server error' });
  }
}
