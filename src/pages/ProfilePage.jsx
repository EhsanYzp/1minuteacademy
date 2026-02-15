import { motion } from 'framer-motion';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useEffect, useMemo, useRef, useState } from 'react';
import Header from '../components/Header';
import Seo from '../components/Seo';
import { useAuth } from '../context/AuthContext';
import { isSupabaseConfigured } from '../lib/supabaseClient';
import { getTopicCategoryCounts, listTopicsByIds } from '../services/topics';
import { getContentSource } from '../services/_contentSource';
import { getUserStats, listUserTopicProgress } from '../services/progress';
import { canReview, canStartTopic, formatTierLabel, getCurrentTier } from '../services/entitlements';
import { getSubscriptionStatus, openCustomerPortal } from '../services/billing';
import { deleteAccount, pauseAccount, resumeAccount } from '../services/account';
import { getMyProfile, updateMyProfile, uploadMyAvatar } from '../services/profiles';
import StarRating from '../components/StarRating';
import { listMyTopicRatings, setMyTopicRating } from '../services/ratings';
import OneMAIcon from '../components/OneMAIcon';
import {
  buildPresentationStyleOptions,
  canChoosePresentationStyle,
  normalizePresentationStyle,
  resolveStoryPresentationStyle,
  saveStoryPresentationStyle,
} from '../services/presentationStyle';
import './ProfilePage.css';

function fmtDate(iso) {
  if (!iso) return '—';
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '—';
    return d.toLocaleString();
  } catch {
    return '—';
  }
}

function fmtSeconds(s) {
  const n = Number(s);
  if (!Number.isFinite(n)) return '—';
  return `${Math.max(0, Math.round(n))}s`;
}

function formatPlanForProfile(user, tier) {
  if (tier === 'paused') return 'Paused';
  if (tier === 'pro') {
    const interval = String(user?.user_metadata?.plan_interval ?? '').toLowerCase();
    if (interval === 'year' || interval === 'yearly' || interval === 'annual') return 'Pro (Yearly)';
    if (interval === 'month' || interval === 'monthly') return 'Pro (Monthly)';
    return 'Pro';
  }
  if (tier === 'free') return 'Free (Account)';
  return 'Free (Guest)';
}

function fmtShortDate(iso) {
  if (!iso) return '—';
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '—';
    return d.toLocaleDateString();
  } catch {
    return '—';
  }
}

function initialsFromName(name) {
  const s = String(name ?? '').trim();
  if (!s) return '?';
  const parts = s.split(/\s+/).filter(Boolean);
  const first = parts[0]?.[0] ?? '';
  const last = parts.length > 1 ? parts[parts.length - 1]?.[0] ?? '' : '';
  return (first + last).toUpperCase() || '?';
}

function formatStripeStatus(status) {
  const s = String(status ?? '').toLowerCase();
  if (!s) return '—';
  if (s === 'trialing') return 'Trial';
  if (s === 'active') return 'Active';
  if (s === 'past_due') return 'Past due';
  if (s === 'unpaid') return 'Unpaid';
  if (s === 'canceled') return 'Canceled';
  if (s === 'incomplete') return 'Incomplete';
  if (s === 'incomplete_expired') return 'Expired';
  return s;
}

function computeFallbackPeriodEnd(createdIso, planInterval) {
  if (!createdIso) return null;
  const interval = String(planInterval ?? '').toLowerCase();
  if (interval !== 'month' && interval !== 'monthly' && interval !== 'year' && interval !== 'yearly' && interval !== 'annual') return null;

  const created = new Date(createdIso);
  if (Number.isNaN(created.getTime())) return null;

  const now = new Date();
  const d = new Date(created);

  // Advance periods until we land in the future.
  // Cap iterations to avoid infinite loops if the date is weird.
  for (let i = 0; i < 36; i += 1) {
    if (interval === 'month' || interval === 'monthly') d.setMonth(d.getMonth() + 1);
    else d.setFullYear(d.getFullYear() + 1);
    if (d.getTime() > now.getTime()) return d.toISOString();
  }

  return null;
}

export default function ProfilePage() {
  const { user, signOut, reloadUser, refreshSession, loading: authLoading } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const contentSource = getContentSource();
  const tier = getCurrentTier(user);
  const isPaused = tier === 'paused';
  const planLabel = formatPlanForProfile(user, tier);
  const showReview = canReview(tier);

  const hasStripeCustomer = Boolean(user?.user_metadata?.stripe_customer_id);
  const hasStripeSubscription = Boolean(user?.user_metadata?.stripe_subscription_id);
  const showSubscriptionBox = contentSource !== 'local' && Boolean(user) && (hasStripeCustomer || hasStripeSubscription);

  const stripeCustomerId = user?.user_metadata?.stripe_customer_id ?? null;
  const stripeSubscriptionId = user?.user_metadata?.stripe_subscription_id ?? null;

  const checkoutState = useMemo(() => {
    try {
      return new URLSearchParams(location.search).get('checkout');
    } catch {
      return null;
    }
  }, [location.search]);

  const portalReturn = useMemo(() => {
    try {
      return new URLSearchParams(location.search).get('portal');
    } catch {
      return null;
    }
  }, [location.search]);

  const [checkoutBanner, setCheckoutBanner] = useState(null); // 'success' | 'error' | null
  const [checkoutBannerText, setCheckoutBannerText] = useState('');
  const [checkoutProgress, setCheckoutProgress] = useState(null); // { elapsedMs: number, maxMs: number } | null

  const [stats, setStats] = useState({ one_ma_balance: 0, streak: 0, last_completed_date: null });
  const [progressRows, setProgressRows] = useState([]);
  const [topics, setTopics] = useState([]);
  const [topicCategoryCounts, setTopicCategoryCounts] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [progressView, setProgressView] = useState('subjects'); // subjects | recent
  const [progressQuery, setProgressQuery] = useState('');
  const [subStatus, setSubStatus] = useState(null);
  const [subLoading, setSubLoading] = useState(false);
  const [subError, setSubError] = useState(null);

  const [accountBusy, setAccountBusy] = useState(null); // 'pause' | 'resume' | 'delete' | null
  const [accountError, setAccountError] = useState(null);
  const [accountNotice, setAccountNotice] = useState('');

  const canChoosePresentation = canChoosePresentationStyle(tier);
  const presentationStyleOptions = useMemo(
    () => buildPresentationStyleOptions({ tier }),
    [tier]
  );
  const presentationStyleOptionById = useMemo(() => {
    const m = new Map();
    for (const opt of presentationStyleOptions) m.set(String(opt.id), opt);
    return m;
  }, [presentationStyleOptions]);

  const initialPresentationStyle = useMemo(
    () => resolveStoryPresentationStyle({ user, tier, journey: null }),
    [user, tier]
  );

  const [presentationStyle, setPresentationStyle] = useState(initialPresentationStyle);
  const [presentationBusy, setPresentationBusy] = useState(false);
  const [presentationError, setPresentationError] = useState(null);
  const [presentationNotice, setPresentationNotice] = useState('');

  const [identityLoaded, setIdentityLoaded] = useState(false);
  const [identityBusy, setIdentityBusy] = useState(false);
  const [identityError, setIdentityError] = useState(null);
  const [identityNotice, setIdentityNotice] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const avatarInputRef = useRef(null);

  useEffect(() => {
    setPresentationStyle(initialPresentationStyle);
  }, [initialPresentationStyle]);

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      if (!user) return;
      if (contentSource === 'local') return;
      if (!isSupabaseConfigured) return;

      setIdentityError(null);
      setIdentityNotice('');

      try {
        const p = await getMyProfile();
        if (cancelled) return;
        setDisplayName(String(p?.display_name ?? ''));
        setAvatarUrl(String(p?.avatar_url ?? ''));
        setIdentityLoaded(true);
      } catch (e) {
        if (cancelled) return;
        setIdentityError(e);
      }
    };

    run();
    return () => {
      cancelled = true;
    };
  }, [contentSource, user]);

  async function onSaveIdentity() {
    if (identityBusy) return;
    setIdentityBusy(true);
    setIdentityError(null);
    setIdentityNotice('');

    try {
      const next = await updateMyProfile({ displayName, avatarUrl });
      setDisplayName(String(next?.display_name ?? ''));
      setAvatarUrl(String(next?.avatar_url ?? ''));
      setIdentityLoaded(true);
      setIdentityNotice('Saved. New reviews will use this name/photo.');
    } catch (e) {
      setIdentityError(e);
    } finally {
      setIdentityBusy(false);
    }
  }

  async function onPickAvatar(e) {
    const f = e?.target?.files?.[0] ?? null;
    if (!f) return;
    if (identityBusy) return;

    setIdentityBusy(true);
    setIdentityError(null);
    setIdentityNotice('');

    try {
      const url = await uploadMyAvatar(f);
      setAvatarUrl(String(url ?? ''));
      const next = await updateMyProfile({ avatarUrl: url });
      setAvatarUrl(String(next?.avatar_url ?? url ?? ''));
      setIdentityLoaded(true);
      setIdentityNotice('Photo updated.');
    } catch (e2) {
      setIdentityError(e2);
    } finally {
      setIdentityBusy(false);
      try {
        if (avatarInputRef.current) avatarInputRef.current.value = '';
      } catch {
        // ignore
      }
    }
  }

  async function onChangePresentationStyle(e) {
    const next = normalizePresentationStyle(e?.target?.value) ?? initialPresentationStyle;
    setPresentationNotice('');
    setPresentationError(null);

    if (!canChoosePresentation) {
      setPresentationStyle(initialPresentationStyle);
      setPresentationNotice('Sign in to choose your lesson style.');
      return;
    }

    if (presentationStyleOptionById.get(String(next))?.disabled) {
      setPresentationNotice('That style is a Pro feature.');
      setPresentationStyle(initialPresentationStyle);
      return;
    }

    setPresentationStyle(next);
    setPresentationBusy(true);
    try {
      const res = await saveStoryPresentationStyle({ user, style: next, tier });
      if (res?.saved === 'remote') {
        try {
          await reloadUser();
        } catch {
          // ignore
        }
      }
      setPresentationNotice('Saved.');
    } catch (e2) {
      setPresentationError(e2);
    } finally {
      setPresentationBusy(false);
    }
  }

  const [myRatings, setMyRatings] = useState([]);
  const [ratingsLoading, setRatingsLoading] = useState(false);
  const [ratingsError, setRatingsError] = useState(null);
  const [ratingBusyTopicId, setRatingBusyTopicId] = useState(null);
  const [ratingsQuery, setRatingsQuery] = useState('');

  const subReqIdRef = useRef(0);
  const subRetryRef = useRef({ tries: 0 });
  const subInFlightRef = useRef(null);

  function isTransientAuthError(e) {
    const msg = String(e?.message ?? e ?? '').toLowerCase();
    return msg.includes('please sign in first') || msg.includes('missing authorization') || msg.includes('invalid supabase session');
  }

  function sleep(ms) {
    return new Promise((r) => setTimeout(r, ms));
  }

  async function reloadSubscription() {
    if (contentSource === 'local') return;
    if (!showSubscriptionBox) return;

    // Dedupe concurrent calls (portal return + metadata change effects can overlap)
    if (subInFlightRef.current) return subInFlightRef.current;

    subRetryRef.current.tries = 0;
    const reqId = (subReqIdRef.current += 1);

    const work = (async () => {
      setSubLoading(true);
      setSubError(null);

      // Up to ~6 seconds total, aimed at post-portal-return session hydration.
      while (subRetryRef.current.tries < 8) {
        try {
          try {
            if (user) await reloadUser();
          } catch {
            // ignore
          }

          const data = await getSubscriptionStatus();
          if (subReqIdRef.current === reqId) setSubStatus(data);
          return;
        } catch (e) {
          if (user && isTransientAuthError(e)) {
            subRetryRef.current.tries += 1;
            // backoff: 250ms, 350ms, 500ms, ...
            // eslint-disable-next-line no-await-in-loop
            await sleep(200 + subRetryRef.current.tries * 150);
            continue;
          }
          if (subReqIdRef.current === reqId) setSubError(e);
          return;
        }
      }

      // If we timed out, keep the last known status and show a softer message.
      if (subReqIdRef.current === reqId) {
        setSubError(new Error('Refreshing your session… please wait a moment and refresh.'));
      }
    })();

    subInFlightRef.current = work;
    try {
      await work;
    } finally {
      if (subReqIdRef.current === reqId) setSubLoading(false);
      subInFlightRef.current = null;
    }
  }

  useEffect(() => {
    let mounted = true;

    async function load() {
      try {
        setLoading(true);
        setError(null);

        const [s, p, counts] = await Promise.all([getUserStats(), listUserTopicProgress(), getTopicCategoryCounts()]);
        if (!mounted) return;

        setStats(s);

        const rows = Array.isArray(p) ? p : [];
        setProgressRows(rows);

        const nextCounts = (() => {
          const m = counts?.counts;
          if (m instanceof Map) return Object.fromEntries(m.entries());
          if (m && typeof m === 'object') return m;
          return {};
        })();
        setTopicCategoryCounts(nextCounts);

        // Enrich topic metadata without downloading the full catalog.
        // Remote progress rows already include a `topics (...)` join.
        const fromJoin = [];
        const missingIds = [];
        for (const r of rows) {
          const join = r?.topics && typeof r.topics === 'object' ? r.topics : null;
          if (join?.id) fromJoin.push(join);
          else if (r?.topic_id) missingIds.push(r.topic_id);
        }

        const fetched = missingIds.length > 0
          ? await listTopicsByIds(missingIds)
          : [];

        const map = new Map();
        for (const t of [...fromJoin, ...(Array.isArray(fetched) ? fetched : [])]) {
          if (!t?.id) continue;
          map.set(String(t.id), t);
        }
        setTopics(Array.from(map.values()));
      } catch (e) {
        if (!mounted) return;
        setError(e);
      } finally {
        if (mounted) setLoading(false);
      }
    }

    load();
    return () => {
      mounted = false;
    };
  }, [contentSource]);

  useEffect(() => {
    let mounted = true;

    async function loadRatings() {
      setRatingsError(null);

      const canReadRatings = contentSource === 'local' || Boolean(user);
      if (!canReadRatings) {
        setMyRatings([]);
        return;
      }

      try {
        setRatingsLoading(true);
        const rows = await listMyTopicRatings();
        if (!mounted) return;
        setMyRatings(Array.isArray(rows) ? rows : []);

        // Enrich ratings list titles/emojis without pulling the full catalog.
        const ids = (Array.isArray(rows) ? rows : [])
          .map((r) => String(r?.topic_id ?? '').trim())
          .filter(Boolean);
        const uniq = Array.from(new Set(ids));

        if (uniq.length > 0) {
          const extra = await listTopicsByIds(uniq);
          if (!mounted) return;
          setTopics((prev) => {
            const m = new Map();
            for (const t of Array.isArray(prev) ? prev : []) {
              if (t?.id) m.set(String(t.id), t);
            }
            for (const t of Array.isArray(extra) ? extra : []) {
              if (t?.id) m.set(String(t.id), t);
            }
            return Array.from(m.values());
          });
        }
      } catch (e) {
        if (!mounted) return;
        setRatingsError(e);
        setMyRatings([]);
      } finally {
        if (mounted) setRatingsLoading(false);
      }
    }

    loadRatings();
    return () => {
      mounted = false;
    };
  }, [contentSource, user]);

  async function onUpdateRating(topicId, nextRating) {
    const canEdit = contentSource === 'local' || Boolean(user);
    if (!canEdit) return;
    if (!topicId) return;
    if (ratingBusyTopicId) return;

    const id = String(topicId);
    const prev = myRatings;

    setRatingBusyTopicId(id);
    setRatingsError(null);

    const optimistic = (() => {
      const nowIso = new Date().toISOString();
      const next = Array.isArray(prev) ? [...prev] : [];
      const idx = next.findIndex((r) => String(r?.topic_id) === id);
      if (idx >= 0) next[idx] = { ...next[idx], rating: nextRating, updated_at: nowIso };
      else next.unshift({ topic_id: id, rating: nextRating, updated_at: nowIso });

      next.sort((a, b) => String(b?.updated_at ?? '').localeCompare(String(a?.updated_at ?? '')));
      return next;
    })();

    setMyRatings(optimistic);

    try {
      await setMyTopicRating(id, nextRating);
      // Refresh from source to keep ordering and timestamps correct.
      const rows = await listMyTopicRatings();
      setMyRatings(Array.isArray(rows) ? rows : optimistic);
    } catch (e) {
      setRatingsError(e);
      setMyRatings(prev);
    } finally {
      setRatingBusyTopicId(null);
    }
  }

  useEffect(() => {
    let mounted = true;
    async function loadSub() {
      if (contentSource === 'local') return;
      if (!showSubscriptionBox) return;
      try {
        await reloadSubscription();
      } catch (e) {
        if (!mounted) return;
        setSubError(e);
      }
    }
    loadSub();
    return () => {
      mounted = false;
    };
  }, [contentSource, showSubscriptionBox, stripeCustomerId, stripeSubscriptionId]);

  useEffect(() => {
    if (portalReturn !== 'return') return;
    if (authLoading) return;

    // Returning from Stripe portal: refresh auth + re-fetch Stripe status.
    // Then clean the URL.
    (async () => {
      try {
        if (user) await reloadUser();
      } catch {
        // ignore
      }
      await reloadSubscription();
      navigate('/me', { replace: true });
    })();
  }, [portalReturn, authLoading, user, reloadUser, navigate]);

  async function onManageSubscription() {
    try {
      await openCustomerPortal({ returnPath: '/me?portal=return' });
    } catch (e) {
      setSubError(e);
    }
  }

  async function onPauseAccount() {
    if (contentSource === 'local') return;
    const ok = window.confirm('Pause your account? You will not be able to start lessons until you resume. (Billing is not changed by pausing.)');
    if (!ok) return;

    setAccountBusy('pause');
    setAccountError(null);
    setAccountNotice('');
    try {
      await pauseAccount();
      await reloadUser();
      setAccountNotice('Your account is paused.');
    } catch (e) {
      setAccountError(e);
    } finally {
      setAccountBusy(null);
    }
  }

  async function onResumeAccount() {
    if (contentSource === 'local') return;
    setAccountBusy('resume');
    setAccountError(null);
    setAccountNotice('');
    try {
      await resumeAccount();
      await reloadUser();
      setAccountNotice('Your account is active again.');
    } catch (e) {
      setAccountError(e);
    } finally {
      setAccountBusy(null);
    }
  }

  async function onDeleteAccount() {
    if (contentSource === 'local') return;

    const typed = window.prompt(
      'This permanently deletes your account and progress.\n\nIf you have an active subscription, we will attempt to cancel it first.\n\nType DELETE to confirm.'
    );
    if (String(typed ?? '').trim() !== 'DELETE') return;

    setAccountBusy('delete');
    setAccountError(null);
    setAccountNotice('');
    try {
      await deleteAccount({ confirmation: 'DELETE' });
      try {
        await signOut();
      } catch {
        // ignore
      }
      navigate('/?account=deleted', { replace: true });
    } catch (e) {
      setAccountError(e);
    } finally {
      setAccountBusy(null);
    }
  }

  useEffect(() => {
    if (checkoutState !== 'success') return;
    if (authLoading) return;
    let canceled = false;

    async function run() {
      if (!user) {
        setCheckoutBanner('error');
        setCheckoutBannerText('Payment received. Please sign in again to activate Pro on your account.');
        return;
      }

      setCheckoutBanner('success');
      const startedAt = Date.now();
      const maxMs = 30_000;
      setCheckoutProgress({ elapsedMs: 0, maxMs });

      while (!canceled && Date.now() - startedAt < maxMs) {
        const elapsedMs = Date.now() - startedAt;
        const remaining = Math.max(0, Math.ceil((maxMs - elapsedMs) / 1000));
        setCheckoutProgress({ elapsedMs, maxMs });
        setCheckoutBannerText(`Payment received — activating Pro… (${remaining}s)`);
        try {
          // Stripe webhooks update user_metadata server-side. The client may need a token refresh
          // to see updated claims immediately (otherwise it can look like Pro isn't active until re-login).
          try {
            await refreshSession();
          } catch {
            // ignore
          }

          const nextUser = await reloadUser();
          if (getCurrentTier(nextUser) === 'pro') {
            setCheckoutBannerText('Pro is active. Enjoy!');
            setCheckoutProgress(null);
            // Clear ?checkout=success from the URL.
            navigate('/me', { replace: true });
            return;
          }
        } catch {
          // ignore
        }
        // eslint-disable-next-line no-await-in-loop
        await new Promise((r) => setTimeout(r, 2500));
      }

      if (!canceled) {
        setCheckoutBanner('error');
        setCheckoutBannerText('Payment received. Pro may still be activating — check Stripe webhook delivery and try refreshing.');
        setCheckoutProgress(null);
      }
    }

    run();
    return () => {
      canceled = true;
    };
  }, [checkoutState, authLoading, user, reloadUser, refreshSession, navigate]);

  useEffect(() => {
    if (checkoutState === 'success') return;
    setCheckoutBanner(null);
    setCheckoutBannerText('');
    setCheckoutProgress(null);
  }, [checkoutState]);

  const topicById = useMemo(() => {
    const map = new Map();
    for (const t of topics) map.set(t.id, t);
    return map;
  }, [topics]);

  const progress = useMemo(() => {
    const rows = Array.isArray(progressRows) ? progressRows : [];
    return rows
      .map((r) => {
        const topicId = r.topic_id;
        const fromJoin = r.topics && typeof r.topics === 'object' ? r.topics : null;
        const fromList = topicById.get(topicId) ?? null;
        const topic = fromJoin ?? fromList;
        return {
          topicId,
          title: topic?.title ?? topicId,
          emoji: topic?.emoji ?? '🎯',
          color: topic?.color ?? '#4ECDC4',
          subject: topic?.subject ?? 'General',
          completed: Number(r.completed_count ?? 0),
          bestSeconds: r.best_seconds,
          lastCompletedAt: r.last_completed_at,
        };
      })
      .sort((a, b) => String(b.lastCompletedAt ?? '').localeCompare(String(a.lastCompletedAt ?? '')));
  }, [progressRows, topicById]);

  const progressFiltered = useMemo(() => {
    const q = progressQuery.trim().toLowerCase();
    if (!q) return progress;
    return progress.filter((p) => {
      const hay = `${p.title ?? ''} ${p.subject ?? ''}`.toLowerCase();
      return hay.includes(q);
    });
  }, [progress, progressQuery]);

  const subjectTotals = useMemo(() => {
    const obj = topicCategoryCounts && typeof topicCategoryCounts === 'object' ? topicCategoryCounts : {};
    const totals = new Map();
    for (const [subjectRaw, nRaw] of Object.entries(obj)) {
      const subject = String(subjectRaw ?? '').trim() || 'General';
      const n = Number(nRaw ?? 0) || 0;
      totals.set(subject, n);
    }
    return totals;
  }, [topicCategoryCounts]);

  const progressBySubject = useMemo(() => {
    const buckets = new Map();
    for (const p of progressFiltered) {
      const subject = p.subject ?? 'General';
      const arr = buckets.get(subject) ?? [];
      arr.push(p);
      buckets.set(subject, arr);
    }

    // Sort each bucket: most recently completed first.
    for (const [subject, arr] of buckets) {
      arr.sort((a, b) => String(b.lastCompletedAt ?? '').localeCompare(String(a.lastCompletedAt ?? '')));
      buckets.set(subject, arr);
    }

    const subjects = Array.from(buckets.keys()).sort((a, b) => String(a).localeCompare(String(b)));
    return subjects.map((subject) => {
      const rows = buckets.get(subject) ?? [];
      const completedTopics = rows.filter((r) => Number(r.completed ?? 0) > 0).length;
      const total = subjectTotals.get(subject) ?? rows.length;
      return { subject, rows, completedTopics, total };
    });
  }, [progressFiltered, subjectTotals]);

  const myRatingsEnriched = useMemo(() => {
    const rows = Array.isArray(myRatings) ? myRatings : [];
    return rows
      .map((r) => {
        const id = String(r?.topic_id ?? '').trim();
        const topic = topicById.get(id) ?? null;
        return {
          topicId: id,
          rating: Number(r?.rating ?? 0),
          updatedAt: r?.updated_at ?? null,
          title: topic?.title ?? id,
          emoji: topic?.emoji ?? '🎯',
          subject: topic?.subject ?? 'General',
        };
      })
      .filter((r) => r.topicId);
  }, [myRatings, topicById]);

  const myRatingsFiltered = useMemo(() => {
    const q = String(ratingsQuery ?? '').trim().toLowerCase();
    if (!q) return myRatingsEnriched;
    return myRatingsEnriched.filter((r) => {
      const hay = `${r.title ?? ''} ${r.subject ?? ''}`.toLowerCase();
      return hay.includes(q);
    });
  }, [myRatingsEnriched, ratingsQuery]);

  const visibleTabs = useMemo(() => {
    const base = [
      { id: 'overview', label: 'Overview' },
      { id: 'preferences', label: 'Preferences' },
      { id: 'progress', label: 'Progress' },
      { id: 'ratings', label: 'Ratings' },
    ];
    if (contentSource !== 'local') base.push({ id: 'account', label: 'Account' });
    return base;
  }, [contentSource]);

  const activeTab = useMemo(() => {
    const allowed = new Set(visibleTabs.map((t) => t.id));
    let raw = 'overview';
    try {
      raw = new URLSearchParams(location.search).get('tab') || 'overview';
    } catch {
      raw = 'overview';
    }
    const normalized = String(raw).trim().toLowerCase();
    return allowed.has(normalized) ? normalized : 'overview';
  }, [location.search, visibleTabs]);

  const profileSubtitle = useMemo(() => {
    switch (activeTab) {
      case 'preferences':
        return 'Personalize how lesson pages look.';
      case 'progress':
        return 'See your progress and completed topics.';
      case 'ratings':
        return 'View and update your module ratings.';
      case 'account':
        return 'Manage your plan, billing, and account.';
      case 'overview':
      default:
        return 'Track your 1MA minutes (minutes completed), streak, and completed topics.';
    }
  }, [activeTab]);

  function setActiveTab(next) {
    const wanted = String(next ?? '').trim().toLowerCase();
    const allowed = new Set(visibleTabs.map((t) => t.id));
    const safe = allowed.has(wanted) ? wanted : 'overview';
    const params = new URLSearchParams(location.search);
    params.set('tab', safe);
    navigate({ pathname: location.pathname, search: `?${params.toString()}` }, { replace: true });
  }

  useEffect(() => {
    try {
      const params = new URLSearchParams(location.search);
      const hasTab = params.has('tab');
      if (!hasTab && contentSource !== 'local' && (checkoutState || portalReturn)) {
        params.set('tab', 'account');
        navigate({ pathname: location.pathname, search: `?${params.toString()}` }, { replace: true });
      }
    } catch {
      // ignore
    }
  }, [checkoutState, portalReturn, contentSource, location.pathname, location.search, navigate]);

  return (
    <motion.div className="profile-page" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <Seo title="Your profile" description="Manage your account and preferences." path="/me" canonicalPath="/me" noindex />
      <Header />

      <main className="profile-main">
        <div className="profile-top">
          <Link className="profile-back" to="/topics">
            ← Back to topics
          </Link>
        </div>

        <motion.section className="profile-card" initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }}>
          <div className="profile-title">
            <div className="profile-emoji">🧑‍🚀</div>
            <div>
              <h1>Your profile</h1>
              <p>{profileSubtitle}</p>
            </div>
          </div>

          <div className="profile-layout profile-layout--single">
            <div className="profile-left">
              {checkoutBanner && (
                <div className={`profile-note ${checkoutBanner === 'error' ? 'profile-checkout-error' : 'profile-checkout-success'}`} style={{ marginBottom: 12 }}>
                  <strong>{checkoutBanner === 'error' ? 'Checkout' : 'Checkout success'}</strong>
                  <div>{checkoutBannerText}</div>
                  {checkoutProgress && (
                    <>
                      <div className="profile-checkout-progressTrack" aria-hidden="true">
                        <div
                          className="profile-checkout-progressBar"
                          style={{ width: `${Math.min(100, Math.max(6, Math.round((checkoutProgress.elapsedMs / checkoutProgress.maxMs) * 100)))}%` }}
                        />
                      </div>
                      {checkoutProgress.elapsedMs >= 10_000 && (
                        <div className="profile-checkout-slow">It’s taking longer than expected — you can refresh this page.</div>
                      )}
                    </>
                  )}
                </div>
              )}

              {contentSource === 'local' && (
                <div className="profile-note" style={{ marginBottom: 12 }}>
                  <strong>Local Preview mode</strong>
                  <div>Progress is stored in your browser (localStorage).</div>
                </div>
              )}

              {error && <div className="profile-error">{error.message ?? 'Failed to load profile.'}</div>}

              <div className="profile-tabs" role="tablist" aria-label="Profile sections">
                {visibleTabs.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    role="tab"
                    className={activeTab === t.id ? 'profile-tab active' : 'profile-tab'}
                    aria-selected={activeTab === t.id}
                    onClick={() => setActiveTab(t.id)}
                  >
                    {t.label}
                  </button>
                ))}
              </div>

              {activeTab === 'overview' && (
                <>
                  <div className="profile-stats">
                    <div className="profile-stat">
                      <div className="profile-stat-label">
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                          <OneMAIcon size={16} />
                          1MA minutes
                        </span>
                      </div>
                      <div className="profile-stat-value">{Number(stats?.one_ma_balance ?? 0)}</div>
                    </div>
                    <div className="profile-stat">
                      <div className="profile-stat-label">🔥 Streak</div>
                      <div className="profile-stat-value">{Number(stats?.streak ?? 0)} days</div>
                    </div>
                    <div className="profile-stat">
                      <div className="profile-stat-label">📅 Last completion</div>
                      <div className="profile-stat-value small">{stats?.last_completed_date ?? '—'}</div>
                    </div>
                  </div>

                  {tier !== 'pro' && contentSource !== 'local' && (
                    <div className="profile-note" style={{ margin: '12px 0 0' }}>
                      <strong>Unlock 1MA minutes with Pro</strong>
                      <div className="profile-note-row">
                        <div>
                          Pro members earn <strong>+1</strong> to their <strong>1MA minutes</strong> each time they complete a module.
                        </div>
                        <Link className="profile-upgrade-btn" to="/upgrade">Upgrade</Link>
                      </div>
                    </div>
                  )}
                </>
              )}

              {activeTab === 'preferences' && (
                <>
                  <div className="profile-section-header profile-section-header-spaced">
                    <h2>Public profile</h2>
                    <div className="profile-section-sub">Shown on your reviews (after approval).</div>
                  </div>

                  <div className="profile-note" style={{ marginBottom: 12 }}>
                    <strong>Display name & photo</strong>
                    {contentSource === 'local' ? (
                      <div style={{ marginTop: 8 }}>Disabled in Local Preview mode.</div>
                    ) : !isSupabaseConfigured ? (
                      <div style={{ marginTop: 8 }}>Supabase is not configured for this environment.</div>
                    ) : (
                      <div className="profile-identity">
                        <div className="profile-identity-avatar">
                          {avatarUrl ? (
                            <img className="profile-avatar" src={String(avatarUrl)} alt="" loading="lazy" />
                          ) : (
                            <div className="profile-avatar profile-avatar--fallback" aria-hidden="true">
                              {initialsFromName(displayName || user?.email || 'You')}
                            </div>
                          )}

                          <input
                            ref={avatarInputRef}
                            type="file"
                            accept="image/*"
                            onChange={onPickAvatar}
                            disabled={identityBusy}
                            className="profile-avatarInput"
                            aria-label="Upload profile photo"
                          />

                          <button
                            type="button"
                            className="profile-account-btn secondary"
                            onClick={() => avatarInputRef.current?.click?.()}
                            disabled={identityBusy}
                          >
                            {avatarUrl ? 'Change photo' : 'Upload photo'}
                          </button>
                        </div>

                        <label className="profile-preference-label" style={{ marginTop: 10 }}>
                          Display name
                          <input
                            className="profile-identity-input"
                            value={displayName}
                            onChange={(e) => setDisplayName(e.target.value)}
                            placeholder="e.g. Zeinab"
                            maxLength={40}
                            disabled={identityBusy}
                          />
                        </label>

                        <div className="profile-identity-actions">
                          <button
                            type="button"
                            className="profile-account-btn"
                            onClick={onSaveIdentity}
                            disabled={identityBusy || !identityLoaded}
                          >
                            {identityBusy ? 'Saving…' : 'Save'}
                          </button>
                        </div>

                        {identityNotice ? <div className="profile-preference-note">{identityNotice}</div> : null}
                        {identityError ? (
                          <div className="profile-preference-error">{identityError?.message ?? String(identityError)}</div>
                        ) : null}
                      </div>
                    )}
                  </div>

                  <div className="profile-section-header profile-section-header-spaced">
                    <h2>Experience</h2>
                    <div className="profile-section-sub">Personalize how lesson pages look.</div>
                  </div>

                  <div className="profile-note" style={{ marginBottom: 12 }}>
                    <strong>Lesson presentation</strong>
                    <div className="profile-preference-row">
                      <label className="profile-preference-label">
                        Style
                        <select
                          className="profile-preference-select"
                          value={presentationStyle}
                          onChange={onChangePresentationStyle}
                          disabled={!canChoosePresentation || presentationBusy}
                          aria-label="Lesson presentation style"
                        >
                          {presentationStyleOptions.map((s) => (
                            <option key={s.id} value={s.id} disabled={Boolean(s.disabled)}>{s.label}</option>
                          ))}
                        </select>
                      </label>

                      {tier !== 'pro' && tier !== 'paused' && contentSource !== 'local' ? (
                        <Link className="profile-upgrade-btn" to="/upgrade">Upgrade</Link>
                      ) : null}
                    </div>

                    <div className="profile-preference-help">
                      {tier === 'pro' || tier === 'paused'
                        ? 'Applies to lessons and review mode.'
                        : tier === 'free'
                          ? 'Free members can choose Focus or Dark. Other styles are Pro-only.'
                          : 'Sign in to choose Focus or Dark. Other styles are Pro-only.'}
                    </div>

                    {presentationNotice ? (
                      <div className="profile-preference-note" aria-live="polite">{presentationNotice}</div>
                    ) : null}

                    {presentationError ? (
                      <div className="profile-preference-error" aria-live="polite">
                        {presentationError?.message ?? String(presentationError)}
                      </div>
                    ) : null}
                  </div>
                </>
              )}

              {activeTab === 'progress' && (
                <>
                  <div className="profile-section-header">
                    <h2>Your learning</h2>
                    <div className="profile-section-sub">Your progress in one place.</div>
                  </div>

                  {contentSource !== 'local' && !showReview && (
                    <div className="profile-note" style={{ marginBottom: 12 }}>
                      <strong>Free plan</strong>
                      <div className="profile-note-row">
                        <div>
                          Your current plan is <strong>{planLabel}</strong>. Upgrade to unlock review mode.
                        </div>
                        <Link className="profile-upgrade-btn" to="/upgrade">Upgrade</Link>
                      </div>
                    </div>
                  )}

                  <div className="profile-progress-toolbar">
                    <div className="profile-toggle">
                      <button
                        type="button"
                        className={progressView === 'subjects' ? 'pt active' : 'pt'}
                        onClick={() => setProgressView('subjects')}
                      >
                        By subject
                      </button>
                      <button
                        type="button"
                        className={progressView === 'recent' ? 'pt active' : 'pt'}
                        onClick={() => setProgressView('recent')}
                      >
                        Recent
                      </button>
                    </div>

                    <label className="profile-search">
                      <span className="profile-search-icon">🔎</span>
                      <input
                        value={progressQuery}
                        onChange={(e) => setProgressQuery(e.target.value)}
                        placeholder="Search your progress…"
                        aria-label="Search progress"
                      />
                      {progressQuery && (
                        <button type="button" className="profile-clear" onClick={() => setProgressQuery('')} aria-label="Clear search">
                          ✕
                        </button>
                      )}
                    </label>
                  </div>

                  {loading ? (
            <div className="profile-loading">Loading…</div>
          ) : progress.length === 0 ? (
            <div className="profile-empty">No activity yet. Finish a topic to see your progress.</div>
          ) : progressView === 'subjects' ? (
            <div className="subject-progress">
              {progressBySubject.map((group) => {
                const pct = group.total > 0 ? Math.round((group.completedTopics / group.total) * 100) : 0;
                return (
                  <details key={group.subject} className="subject-group">
                    <summary className="subject-summary">
                      <div className="subject-left">
                        <div className="subject-name">{group.subject}</div>
                        <div className="subject-sub">✅ {group.completedTopics}/{group.total} topics</div>
                      </div>
                      <div className="subject-right">
                        <div className="subject-bar" aria-label="subject completion">
                          <div className="subject-fill" style={{ width: `${pct}%` }} />
                        </div>
                        <div className="subject-pct">{pct}%</div>
                      </div>
                    </summary>

                    <div className="progress-list" style={{ marginTop: 10 }}>
                      {group.rows.map((p) => {
                        const completed = Number(p.completed ?? 0) > 0;

                        return (
                          <details key={p.topicId} className="progress-details">
                            <summary className="progress-row" style={{ '--row-color': p.color }}>
                              <div className="progress-left">
                                <div className="progress-emoji">{p.emoji}</div>
                                <div className="progress-meta">
                                  <Link className="progress-title-link" to={`/topic/${p.topicId}`}>
                                    <div className="progress-title">{p.title}</div>
                                  </Link>
                                  <div className="progress-sub">{p.subject}</div>
                                </div>
                              </div>

                              <div className="progress-right">
                                <div className="pill">✅ {p.completed}</div>
                                <div className="pill faint">🕒 {fmtDate(p.lastCompletedAt)}</div>
                              </div>
                            </summary>

                            <div className="progress-expand">
                              {completed && (
                                <div className="progress-actions">
                                  {showReview ? (
                                    <Link className="action-pill" to={`/review/${p.topicId}`}>
                                      📚 Review
                                    </Link>
                                  ) : (
                                    <Link className="action-pill" to="/upgrade">
                                      🔒 Unlock review
                                    </Link>
                                  )}
                                  <Link className="action-pill secondary" to={`/lesson/${p.topicId}`}>
                                    🔄 Restart
                                  </Link>
                                </div>
                              )}
                            </div>
                          </details>
                        );
                      })}
                    </div>
                  </details>
                );
              })}
            </div>
          ) : (
            <div className="progress-list">
              {progressFiltered.map((p) => {
                const completed = Number(p.completed ?? 0) > 0;

                return (
                  <details key={p.topicId} className="progress-details">
                    <summary className="progress-row" style={{ '--row-color': p.color }}>
                      <div className="progress-left">
                        <div className="progress-emoji">{p.emoji}</div>
                        <div className="progress-meta">
                          <Link className="progress-title-link" to={`/topic/${p.topicId}`}>
                            <div className="progress-title">{p.title}</div>
                          </Link>
                          <div className="progress-sub">{p.subject}</div>
                        </div>
                      </div>

                      <div className="progress-right">
                        <div className="pill">✅ {p.completed}</div>
                        <div className="pill faint">🕒 {fmtDate(p.lastCompletedAt)}</div>
                      </div>
                    </summary>

                    <div className="progress-expand">
                      {completed && (
                        <div className="progress-actions">
                          {showReview ? (
                            <Link className="action-pill" to={`/review/${p.topicId}`}>
                              📚 Review
                            </Link>
                          ) : (
                            <Link className="action-pill" to="/upgrade">
                              🔒 Unlock review
                            </Link>
                          )}
                          <Link className="action-pill secondary" to={`/lesson/${p.topicId}`}>
                            🔄 Restart
                          </Link>
                        </div>
                      )}
                    </div>
                  </details>
                );
              })}
            </div>
          )}
                </>
              )}

              {activeTab === 'ratings' && (
                <>
                  <div className="profile-section-header profile-section-header-spaced">
                    <h2>Your ratings</h2>
                    <div className="profile-section-sub">Change your stars anytime.</div>
                  </div>

                  {contentSource !== 'local' && !user ? (
                    <div className="profile-empty">
                      Sign in to see and edit your ratings.
                    </div>
                  ) : ratingsLoading ? (
                    <div className="profile-loading">Loading your ratings…</div>
                  ) : myRatingsEnriched.length === 0 ? (
                    <div className="profile-empty">No ratings yet. Finish a module and rate it.</div>
                  ) : (
                    <>
                      <div className="ratings-toolbar">
                        <div className="ratings-count">
                          {myRatingsFiltered.length} of {myRatingsEnriched.length}
                        </div>

                        <label className="ratings-search">
                          <span className="ratings-search-icon">🔎</span>
                          <input
                            value={ratingsQuery}
                            onChange={(e) => setRatingsQuery(e.target.value)}
                            placeholder="Search your ratings…"
                            aria-label="Search your ratings"
                          />
                          {ratingsQuery && (
                            <button
                              type="button"
                              className="ratings-clear"
                              onClick={() => setRatingsQuery('')}
                              aria-label="Clear ratings search"
                            >
                              ✕
                            </button>
                          )}
                        </label>
                      </div>

                      {myRatingsFiltered.length === 0 ? (
                        <div className="profile-empty">No matches.</div>
                      ) : (
                        <div className="ratings-list" aria-label="Your module ratings">
                          {myRatingsFiltered.map((r) => {
                            const canEdit = contentSource === 'local' || Boolean(user);
                            const busy = ratingBusyTopicId === r.topicId;
                            return (
                              <div key={r.topicId} className="rating-row">
                                <Link className="rating-title-link" to={`/topic/${r.topicId}`}>
                                  <div className="rating-emoji" aria-hidden="true">
                                    {r.emoji}
                                  </div>
                                  <div className="rating-meta">
                                    <div className="rating-title">{r.title}</div>
                                    <div className="rating-sub">
                                      {r.subject}
                                      {r.updatedAt ? ` • updated ${fmtShortDate(r.updatedAt)}` : ''}
                                    </div>
                                  </div>
                                </Link>

                                <div className="rating-actions">
                                  <StarRating
                                    value={Number(r.rating ?? 0)}
                                    onChange={canEdit ? (next) => onUpdateRating(r.topicId, next) : undefined}
                                    readOnly={!canEdit || busy}
                                    size="md"
                                    label={`Your rating for ${r.title}`}
                                  />
                                  {busy && <span className="rating-saving">Saving…</span>}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}

                      {ratingsError && (
                        <div className="ratings-error">{ratingsError?.message ?? String(ratingsError)}</div>
                      )}
                    </>
                  )}
                </>
              )}

              {activeTab === 'account' && contentSource !== 'local' && (
                <>
                  <div className="profile-section-header profile-section-header-spaced">
                    <h2>Account</h2>
                    <div className="profile-section-sub">Plan, billing, and account controls.</div>
                  </div>

                  <div className="profile-side-card">
                    <div className="profile-side-kicker">Signed in</div>
                    <div className="profile-email">{user?.email ?? '—'}</div>

                    <div className="profile-plan-row" style={{ marginTop: 10 }}>
                      <span>Plan: <strong>{planLabel}</strong></span>
                      {tier !== 'pro' && (
                        <Link className="profile-upgrade-btn" to="/upgrade">
                          Upgrade
                        </Link>
                      )}
                    </div>

                    {isPaused && (
                      <div className="profile-paused-note">
                        <strong>Paused</strong>
                        <div>You can’t start lessons until you resume.</div>
                      </div>
                    )}
                  </div>

                  {showSubscriptionBox && (
                    <div className="profile-sub-box">
                      <div className="profile-sub-head">
                        <div className="profile-sub-title">Subscription</div>
                        {hasStripeCustomer && (
                          <button className="profile-sub-btn" type="button" onClick={onManageSubscription}>
                            Manage
                          </button>
                        )}
                      </div>

                      {subLoading ? (
                        <div className="profile-sub-row">Loading subscription details…</div>
                      ) : subError ? (
                        <div className="profile-sub-row profile-sub-error">{subError.message ?? 'Could not load subscription details.'}</div>
                      ) : subStatus ? (
                        (() => {
                          const statusLabel = formatStripeStatus(subStatus.status);
                          const rawStatus = String(subStatus.status ?? '').toLowerCase();
                          const isCanceled = rawStatus === 'canceled';
                          const hasCancelAt = Boolean(subStatus.cancel_at);
                          const isScheduledCancel = Boolean(subStatus.cancel_at_period_end) || (!isCanceled && hasCancelAt);

                          const fallbackPeriodEnd = computeFallbackPeriodEnd(subStatus.created, subStatus.plan_interval);
                          const periodDate = subStatus.current_period_end || fallbackPeriodEnd;
                          const scheduledEndDate = subStatus.cancel_at || subStatus.current_period_end || fallbackPeriodEnd;
                          const endedDate = subStatus.ended_at || subStatus.canceled_at || subStatus.cancel_at || subStatus.current_period_end;

                          const dateLabel = isCanceled ? 'Ended' : isScheduledCancel ? 'Ends' : 'Renews';
                          const dateValue = isCanceled ? endedDate : isScheduledCancel ? scheduledEndDate : periodDate;

                          const cancellationLabel = isCanceled
                            ? 'Canceled'
                            : isScheduledCancel
                              ? 'Scheduled'
                              : 'Not scheduled';

                          return (
                            <div className="profile-sub-grid">
                              <div className="profile-sub-item"><span>Status</span><strong>{statusLabel}</strong></div>
                              <div className="profile-sub-item"><span>{dateLabel}</span><strong>{fmtShortDate(dateValue)}</strong></div>
                              <div className="profile-sub-item"><span>Started</span><strong>{fmtShortDate(subStatus.created)}</strong></div>
                              <div className="profile-sub-item"><span>Cancellation</span><strong>{cancellationLabel}</strong></div>
                            </div>
                          );
                        })()
                      ) : (
                        <div className="profile-sub-row">No subscription details found yet.</div>
                      )}

                      <div className="profile-sub-foot">Invoices and cancellation are in Stripe Portal.</div>
                    </div>
                  )}

                  <div className="profile-account-box">
                    <div className="profile-account-head">
                      <div className="profile-account-title">Account status</div>
                      {isPaused ? (
                        <div className="profile-account-pill">Paused</div>
                      ) : (
                        <div className="profile-account-pill active">Active</div>
                      )}
                    </div>

                    {accountNotice && <div className="profile-account-row profile-account-notice">{accountNotice}</div>}
                    {accountError && <div className="profile-account-row profile-account-error">{accountError.message ?? String(accountError)}</div>}

                    <div className="profile-account-actions">
                      {isPaused ? (
                        <button
                          className="profile-account-btn"
                          type="button"
                          onClick={onResumeAccount}
                          disabled={accountBusy !== null}
                          title="Resume your account"
                        >
                          {accountBusy === 'resume' ? 'Resuming…' : 'Resume'}
                        </button>
                      ) : (
                        <button
                          className="profile-account-btn secondary"
                          type="button"
                          onClick={onPauseAccount}
                          disabled={accountBusy !== null}
                          title="Pause your account"
                        >
                          {accountBusy === 'pause' ? 'Pausing…' : 'Pause'}
                        </button>
                      )}
                    </div>

                    <div className="profile-account-foot">
                      {isPaused
                        ? 'Paused accounts cannot start lessons.'
                        : 'Pausing disables learning access without changing billing.'}
                    </div>

                    <details className="profile-danger">
                      <summary className="profile-danger-summary">Danger zone</summary>
                      <div className="profile-danger-body">
                        <div className="profile-danger-text">
                          Permanently deletes your account and progress. If you have an active subscription, we’ll attempt to cancel it first.
                        </div>
                        <button
                          className="profile-account-btn danger"
                          type="button"
                          onClick={onDeleteAccount}
                          disabled={accountBusy !== null}
                        >
                          {accountBusy === 'delete' ? 'Deleting…' : 'Delete account'}
                        </button>
                      </div>
                    </details>
                  </div>
                </>
              )}

            </div>
          </div>
        </motion.section>
      </main>
    </motion.div>
  );
}
