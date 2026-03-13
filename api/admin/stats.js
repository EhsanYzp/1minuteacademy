import { applyCors } from '../_cors.js';
import { json, createSupabaseAdmin, getBearerToken } from '../account/_utils.js';

/**
 * GET /api/admin/stats
 *
 * Comprehensive admin dashboard data — one call powers all tabs.
 * Auth: Bearer <ADMIN_SECRET>
 */
export default async function handler(req, res) {
  if (applyCors(req, res)) return;
  if (req.method !== 'GET') return json(res, 405, { error: 'Method not allowed' });

  const secret = process.env.ADMIN_SECRET;
  if (!secret) return json(res, 500, { error: 'ADMIN_SECRET not configured' });

  const token = getBearerToken(req);
  if (!token || token !== secret) return json(res, 401, { error: 'Unauthorized' });

  try {
    const sb = createSupabaseAdmin();

    /* ── Parallel queries ── */
    const [
      usersRes,
      stripeRes,
      testimonialsRes,
      ratingsRes,
      catCountRes,
      courseCountRes,
      chapCountRes,
      topicCountRes,
      catsRes,
      coursesRes,
      topicsRes,
      progressRes,
      statsRes,
      webhooksRes,
      rateRes,
    ] = await Promise.all([
      sb.auth.admin.listUsers({ page: 1, perPage: 1000 }),
      sb.from('stripe_customers').select('*'),
      sb.from('testimonials').select('*').order('created_at', { ascending: false }),
      sb.from('topic_rating_summaries').select('topic_id, avg_rating, ratings_count'),
      sb.from('categories').select('id', { count: 'exact', head: true }).eq('published', true),
      sb.from('courses').select('id', { count: 'exact', head: true }).eq('published', true),
      sb.from('chapters').select('id', { count: 'exact', head: true }).eq('published', true),
      sb.from('topics').select('id', { count: 'exact', head: true }).eq('published', true),
      sb.from('categories').select('id, name, emoji').eq('published', true).order('name'),
      sb.from('courses').select('id, title, category_id').eq('published', true),
      sb.from('topics').select('id, title, emoji, subject, course_id').eq('published', true),
      sb.from('user_topic_progress')
        .select('user_id, topic_id, best_seconds, completed_count, last_completed_at')
        .limit(50000),
      sb.from('user_stats').select('user_id, streak, one_ma_balance, last_completed_date'),
      sb.from('stripe_webhook_events')
        .select('event_id, type, status, first_seen_at, last_seen_at, processed_at, last_error')
        .order('first_seen_at', { ascending: false })
        .limit(100),
      sb.from('api_rate_limits')
        .select('key, window_start, count')
        .order('window_start', { ascending: false })
        .limit(200),
    ]);

    /* ═══════════ USERS ═══════════ */
    const allUsers = usersRes?.data?.users ?? [];
    const totalUsers = usersRes?.data?.total ?? allUsers.length;
    const now = Date.now();
    const d1h = now - 3_600_000;
    const d24h = now - 86_400_000;
    const d7d = now - 604_800_000;
    const d30d = now - 2_592_000_000;

    const signups1h = allUsers.filter(u => new Date(u.created_at).getTime() > d1h).length;
    const signups24h = allUsers.filter(u => new Date(u.created_at).getTime() > d24h).length;
    const signups7d = allUsers.filter(u => new Date(u.created_at).getTime() > d7d).length;
    const signups30d = allUsers.filter(u => new Date(u.created_at).getTime() > d30d).length;
    const verified = allUsers.filter(u => u.email_confirmed_at).length;

    const providers = {};
    for (const u of allUsers) {
      const p = u.app_metadata?.provider ?? 'email';
      providers[p] = (providers[p] || 0) + 1;
    }

    const recentSignups = allUsers
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
      .slice(0, 30)
      .map(u => ({
        id: u.id,
        email: u.email,
        created_at: u.created_at,
        email_confirmed_at: u.email_confirmed_at,
        last_sign_in_at: u.last_sign_in_at,
        provider: u.app_metadata?.provider ?? 'email',
        plan: u.user_metadata?.plan || u.app_metadata?.plan || 'free',
      }));

    /* ═══════════ BILLING ═══════════ */
    const customers = stripeRes?.data ?? [];
    const activeSubs = customers.filter(c => c.status === 'active' || c.status === 'trialing');
    const cancelingSubs = customers.filter(c => c.status === 'canceling' || (c.cancel_at_period_end === true && (c.status === 'active' || c.status === 'trialing')));
    const canceledSubs = customers.filter(c => c.status === 'canceled' || c.status === 'deleted');
    const pastDueSubs = customers.filter(c => c.status === 'past_due');
    // For monthly/yearly counts, include canceling subs (still paying until period end)
    const paidSubs = [...activeSubs, ...cancelingSubs.filter(c => !activeSubs.includes(c))];
    const monthlySubs = paidSubs.filter(c => c.interval === 'month');
    const yearlySubs = paidSubs.filter(c => c.interval === 'year');

    const customersList = customers
      .sort((a, b) => new Date(b.updated_at || b.created_at || 0) - new Date(a.updated_at || a.created_at || 0))
      .map(c => ({
        user_id: c.user_id,
        customer_id: c.customer_id,
        subscription_id: c.subscription_id,
        status: c.status,
        interval: c.interval,
        current_period_end: c.current_period_end,
        cancel_at_period_end: c.cancel_at_period_end ?? false,
        canceled_at: c.canceled_at ?? null,
        created_at: c.created_at,
        updated_at: c.updated_at,
      }));

    /* ═══════════ TESTIMONIALS ═══════════ */
    const testimonials = testimonialsRes?.data ?? [];
    const approvedCount = testimonials.filter(t => t.approved !== false).length;
    const tRatings = testimonials.filter(t => t.rating != null && t.approved !== false).map(t => t.rating);
    const avgTestimonialRating = tRatings.length
      ? tRatings.reduce((s, r) => s + r, 0) / tRatings.length
      : 0;

    /* ═══════════ RATINGS ═══════════ */
    const ratingRows = ratingsRes?.data ?? [];
    const totalRatings = ratingRows.reduce((s, r) => s + (r.ratings_count || 0), 0);
    const wSum = ratingRows.reduce((s, r) => s + (r.avg_rating || 0) * (r.ratings_count || 0), 0);
    const avgTopicRating = totalRatings > 0 ? wSum / totalRatings : 0;
    const topicsRated = ratingRows.filter(r => r.ratings_count > 0).length;

    // Topic lookup for joining
    const topicList = topicsRes?.data ?? [];
    const topicMap = Object.fromEntries(topicList.map(t => [t.id, t]));

    const topRated = ratingRows
      .filter(r => r.ratings_count >= 2)
      .sort((a, b) => b.avg_rating - a.avg_rating)
      .slice(0, 15)
      .map(r => ({ ...r, ...(topicMap[r.topic_id] || {}) }));

    const lowestRated = ratingRows
      .filter(r => r.ratings_count >= 2)
      .sort((a, b) => a.avg_rating - b.avg_rating)
      .slice(0, 15)
      .map(r => ({ ...r, ...(topicMap[r.topic_id] || {}) }));

    /* ═══════════ CONTENT ═══════════ */
    const catsList = catsRes?.data ?? [];
    const coursesList = coursesRes?.data ?? [];
    const coursesByCategory = {};
    for (const c of coursesList) {
      if (c.category_id) coursesByCategory[c.category_id] = (coursesByCategory[c.category_id] || 0) + 1;
    }
    const topicsByCourse = {};
    for (const t of topicList) {
      if (t.course_id) topicsByCourse[t.course_id] = (topicsByCourse[t.course_id] || 0) + 1;
    }

    /* ═══════════ LEARNING ═══════════ */
    const progressRows = progressRes?.data ?? [];
    const uniqueLearners = new Set(progressRows.map(r => r.user_id)).size;
    const totalCompletions = progressRows.reduce((s, r) => s + (r.completed_count || 0), 0);

    // Aggregate by topic
    const topicAgg = {};
    for (const r of progressRows) {
      if (!topicAgg[r.topic_id]) topicAgg[r.topic_id] = { completions: 0, users: 0, totalSec: 0, secN: 0 };
      topicAgg[r.topic_id].completions += r.completed_count || 0;
      topicAgg[r.topic_id].users += 1;
      if (r.best_seconds != null) {
        topicAgg[r.topic_id].totalSec += r.best_seconds;
        topicAgg[r.topic_id].secN += 1;
      }
    }

    const topTopics = Object.entries(topicAgg)
      .map(([topic_id, a]) => ({
        topic_id,
        total_completions: a.completions,
        unique_users: a.users,
        avg_seconds: a.secN > 0 ? Math.round(a.totalSec / a.secN) : null,
        ...(topicMap[topic_id] || {}),
      }))
      .sort((a, b) => b.total_completions - a.total_completions)
      .slice(0, 20);

    // Unrated popular
    const ratedIds = new Set(ratingRows.map(r => r.topic_id));
    const unratedPopular = Object.entries(topicAgg)
      .filter(([id]) => !ratedIds.has(id))
      .map(([topic_id, a]) => ({
        topic_id,
        total_completions: a.completions,
        unique_users: a.users,
        ...(topicMap[topic_id] || {}),
      }))
      .sort((a, b) => b.total_completions - a.total_completions)
      .slice(0, 10);

    // Streaks
    const streakRows = statsRes?.data ?? [];
    const streakDist = { '0': 0, '1-3': 0, '4-7': 0, '8-14': 0, '15-30': 0, '30+': 0 };
    let totalStreak = 0;
    let maxStreak = 0;
    let totalBalance = 0;

    for (const r of streakRows) {
      const s = r.streak || 0;
      totalStreak += s;
      if (s > maxStreak) maxStreak = s;
      totalBalance += r.one_ma_balance || 0;

      if (s === 0) streakDist['0']++;
      else if (s <= 3) streakDist['1-3']++;
      else if (s <= 7) streakDist['4-7']++;
      else if (s <= 14) streakDist['8-14']++;
      else if (s <= 30) streakDist['15-30']++;
      else streakDist['30+']++;
    }

    const avgStreak = streakRows.length > 0 ? totalStreak / streakRows.length : 0;
    const today = new Date().toISOString().slice(0, 10);
    const activeToday = streakRows.filter(r => r.last_completed_date === today).length;

    const topStreakers = [...streakRows]
      .sort((a, b) => b.streak - a.streak)
      .slice(0, 10)
      .map(r => ({ user_id: r.user_id, streak: r.streak, one_ma_balance: r.one_ma_balance }));

    // Recent completions
    const recentCompletions = progressRows
      .filter(r => r.last_completed_at)
      .sort((a, b) => new Date(b.last_completed_at) - new Date(a.last_completed_at))
      .slice(0, 20)
      .map(r => ({
        user_id: r.user_id,
        topic_id: r.topic_id,
        topic_title: topicMap[r.topic_id]?.title || r.topic_id,
        topic_emoji: topicMap[r.topic_id]?.emoji || '📄',
        completed_at: r.last_completed_at,
        best_seconds: r.best_seconds,
      }));

    /* ═══════════ OPERATIONS ═══════════ */
    const webhookRows = webhooksRes?.data ?? [];
    const whSucceeded = webhookRows.filter(w => w.status === 'succeeded').length;
    const whFailed = webhookRows.filter(w => w.status === 'failed' || w.last_error).length;
    const whProcessing = webhookRows.filter(w => w.status === 'processing').length;
    const rateLimitRows = rateRes?.data ?? [];

    /* ═══════════ RESPONSE ═══════════ */
    return json(res, 200, {
      users: {
        total: totalUsers,
        verified,
        signups_1h: signups1h,
        signups_24h: signups24h,
        signups_7d: signups7d,
        signups_30d: signups30d,
        providers,
        recent: recentSignups,
      },
      billing: {
        total_customers: customers.length,
        active: activeSubs.length,
        canceling: cancelingSubs.length,
        canceled: canceledSubs.length,
        past_due: pastDueSubs.length,
        monthly: monthlySubs.length,
        yearly: yearlySubs.length,
        customers: customersList,
      },
      testimonials: {
        total: testimonials.length,
        approved: approvedCount,
        hidden: testimonials.length - approvedCount,
        avg_rating: Math.round(avgTestimonialRating * 100) / 100,
        list: testimonials.map(t => ({
          id: t.id,
          author_name: t.author_name,
          author_avatar_url: t.author_avatar_url,
          author_title: t.author_title,
          quote: t.quote,
          rating: t.rating,
          platform: t.platform,
          platform_url: t.platform_url,
          approved: t.approved,
          created_at: t.created_at,
        })),
      },
      ratings: {
        total_ratings: totalRatings,
        avg_rating: Math.round(avgTopicRating * 100) / 100,
        topics_rated: topicsRated,
        top_rated: topRated,
        lowest_rated: lowestRated,
        unrated_popular: unratedPopular,
      },
      content: {
        categories: catCountRes?.count ?? 0,
        courses: courseCountRes?.count ?? 0,
        chapters: chapCountRes?.count ?? 0,
        topics: topicCountRes?.count ?? 0,
        categories_list: catsList.map(c => ({
          ...c,
          courses_count: coursesByCategory[c.id] || 0,
        })),
        courses_by_category: coursesByCategory,
        topics_by_course: topicsByCourse,
      },
      learning: {
        unique_learners: uniqueLearners,
        total_completions: totalCompletions,
        avg_completions_per_user: uniqueLearners > 0
          ? Math.round((totalCompletions / uniqueLearners) * 10) / 10
          : 0,
        active_today: activeToday,
        top_topics: topTopics,
        streak_distribution: streakDist,
        avg_streak: Math.round(avgStreak * 10) / 10,
        max_streak: maxStreak,
        top_streakers: topStreakers,
        one_ma_total: totalBalance,
        recent_completions: recentCompletions,
      },
      operations: {
        webhooks: {
          total: webhookRows.length,
          succeeded: whSucceeded,
          failed: whFailed,
          processing: whProcessing,
          recent: webhookRows.slice(0, 50),
        },
        rate_limits: {
          recent: rateLimitRows.slice(0, 50),
        },
      },
      generated_at: new Date().toISOString(),
    });
  } catch (err) {
    console.error('[admin/stats]', err);
    return json(res, err.status || 500, { error: err.message || 'Internal server error' });
  }
}
