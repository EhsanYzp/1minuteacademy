import { motion } from 'framer-motion';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Suspense, lazy, useEffect, useMemo, useRef, useState } from 'react';
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
import { listMyTopicRatings, setMyTopicRating } from '../services/ratings';
import ToastStack from '../components/ToastStack';
import { EXPERT_BADGES } from '../services/badges';
import Skeleton from '../components/Skeleton';
import { ProfileTabsSkeleton } from '../components/SkeletonBlocks';
import {
  generateAndUploadMyCertificate,
  getCertificatePublicUrlFromPathWithOptions,
  listMyCertificates,
  updateMyCertificateRecipient,
} from '../services/certificates';
import {
  buildPresentationStyleOptions,
  canChoosePresentationStyle,
  normalizePresentationStyle,
  resolveStoryPresentationStyle,
  saveStoryPresentationStyle,
} from '../services/presentationStyle';
import './ProfilePage.css';

const OverviewTab = lazy(() => import('../components/profile/tabs/OverviewTab'));
const PreferencesTab = lazy(() => import('../components/profile/tabs/PreferencesTab'));
const ProgressTab = lazy(() => import('../components/profile/tabs/ProgressTab'));
const BadgesTab = lazy(() => import('../components/profile/tabs/BadgesTab'));
const CertificatesTab = lazy(() => import('../components/profile/tabs/CertificatesTab'));
const RatingsTab = lazy(() => import('../components/profile/tabs/RatingsTab'));
const AccountTab = lazy(() => import('../components/profile/tabs/AccountTab'));

function getBadgeRarity(minutesRequired) {
  const n = Number(minutesRequired) || 0;
  if (n >= 1000) return 'legendary';
  if (n >= 200) return 'epic';
  if (n >= 50) return 'rare';
  return 'common';
}

function formatMinuteExpert(minutes) {
  const n = Math.max(0, Math.floor(Number(minutes) || 0));
  return `${n}-minute Expert`;
}


function makeToastId() {
  try {
    return `${Date.now()}_${Math.random().toString(16).slice(2)}`;
  } catch {
    return String(Date.now());
  }
}

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
  const hasProAccess = tier === 'pro' || tier === 'paused';
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

  const [stats, setStats] = useState({ expert_minutes: 0, streak: 0, last_completed_date: null });
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
  const [identityCertPrompt, setIdentityCertPrompt] = useState(null); // { count: number } | null

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
    setIdentityCertPrompt(null);

    try {
      const next = await updateMyProfile({ displayName, avatarUrl });
      setDisplayName(String(next?.display_name ?? ''));
      setAvatarUrl(String(next?.avatar_url ?? ''));
      setIdentityLoaded(true);
      setIdentityNotice('Saved. New reviews will use this name/photo.');

      if (hasProAccess && contentSource !== 'local' && isSupabaseConfigured) {
        try {
          const rows = await listMyCertificates();
          const count = Array.isArray(rows) ? rows.length : 0;
          if (count > 0) setIdentityCertPrompt({ count });
        } catch {
          // ignore
        }
      }
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
    setIdentityCertPrompt(null);

    try {
      const url = await uploadMyAvatar(f);
      setAvatarUrl(String(url ?? ''));
      const next = await updateMyProfile({ avatarUrl: url });
      setAvatarUrl(String(next?.avatar_url ?? url ?? ''));
      setIdentityLoaded(true);
      setIdentityNotice('Photo updated.');

      if (hasProAccess && contentSource !== 'local' && isSupabaseConfigured) {
        try {
          const rows = await listMyCertificates();
          const count = Array.isArray(rows) ? rows.length : 0;
          if (count > 0) setIdentityCertPrompt({ count });
        } catch {
          // ignore
        }
      }
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
      { id: 'badges', label: 'Badges' },
      { id: 'certificates', label: 'Certificates' },
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
      case 'badges':
        return 'Track your Minute Expert badges and milestones.';
      case 'certificates':
        return 'Earn shareable certificates by completing entire categories.';
      case 'ratings':
        return 'View and update your module ratings.';
      case 'account':
        return 'Manage your plan, billing, and account.';
      case 'overview':
      default:
        return 'Track your Minute Expert level, streak, and completed topics.';
    }
  }, [activeTab]);

  const [toasts, setToasts] = useState([]);

  const [certificates, setCertificates] = useState([]);
  const [certLoading, setCertLoading] = useState(false);
  const [certError, setCertError] = useState(null);
  const [certBusyId, setCertBusyId] = useState(null);
  const [certBulkBusy, setCertBulkBusy] = useState(false);
  const [certBulkProgress, setCertBulkProgress] = useState(null); // { done: number, total: number } | null
  const certAutoAttemptedRef = useRef(new Set());

  function dismissToast(id) {
    setToasts((prev) => (Array.isArray(prev) ? prev.filter((t) => t.id !== id) : []));
  }

  function pushToast(toast) {
    const t = { id: makeToastId(), ...toast };
    setToasts((prev) => {
      const arr = Array.isArray(prev) ? prev : [];
      // Keep the stack compact.
      const next = [t, ...arr].slice(0, 4);
      return next;
    });
    // Auto-dismiss.
    setTimeout(() => dismissToast(t.id), 5200);
  }

  // Celebration toasts for newly-unlocked badges.
  useEffect(() => {
    if (!stats) return;
    if (tier !== 'pro') return;

    const currentMinutes = Math.max(0, Math.floor(Number(stats?.expert_minutes ?? 0) || 0));
    const userId = String(user?.id ?? 'local');
    const key = `oma_badges_last_minutes_${userId}`;

    let prevMinutes = null;
    try {
      const raw = window?.localStorage?.getItem(key);
      const n = raw == null ? null : Number(raw);
      prevMinutes = Number.isFinite(n) ? Math.max(0, Math.floor(n)) : null;
    } catch {
      prevMinutes = null;
    }

    // First time (or storage cleared): record baseline without spamming the user.
    if (prevMinutes == null) {
      try {
        window?.localStorage?.setItem(key, String(currentMinutes));
      } catch {
        // ignore
      }
      return;
    }

    if (currentMinutes <= prevMinutes) return;

    const newlyUnlocked = EXPERT_BADGES.filter((b) => prevMinutes < b.minutes && currentMinutes >= b.minutes);
    if (newlyUnlocked.length === 0) {
      try {
        window?.localStorage?.setItem(key, String(currentMinutes));
      } catch {
        // ignore
      }
      return;
    }

    // Show up to 3 badge toasts; summarize the rest.
    const top = newlyUnlocked.slice(0, 3);
    for (const b of top) {
      pushToast({
        variant: 'celebration',
        emoji: b.emoji,
        title: 'Badge unlocked',
        message: `${b.name} — unlocked at ${b.minutes} min`,
      });
    }
    if (newlyUnlocked.length > 3) {
      pushToast({
        variant: 'celebration',
        emoji: '🎉',
        title: 'More badges unlocked',
        message: `+${newlyUnlocked.length - 3} more`,
      });
    }

    try {
      window?.localStorage?.setItem(key, String(currentMinutes));
    } catch {
      // ignore
    }
  }, [stats, tier, user]);

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      if (activeTab !== 'certificates') return;
      if (!user) return;
      if (contentSource === 'local') return;
      if (!isSupabaseConfigured) return;

      setCertError(null);
      setCertLoading(true);
      try {
        const rows = await listMyCertificates();
        if (cancelled) return;
        setCertificates(Array.isArray(rows) ? rows : []);
      } catch (e) {
        if (cancelled) return;
        setCertError(e);
      } finally {
        if (!cancelled) setCertLoading(false);
      }
    };

    run();
    return () => {
      cancelled = true;
    };
  }, [activeTab, contentSource, user, isSupabaseConfigured]);

  useEffect(() => {
    if (activeTab !== 'certificates') return;
    if (!hasProAccess) return;
    if (contentSource === 'local') return;
    if (!isSupabaseConfigured) return;
    if (certLoading) return;
    if (certBusyId) return;

    const next = (Array.isArray(certificates) ? certificates : []).find((c) =>
      c?.id && !c?.png_path && !c?.svg_path && !certAutoAttemptedRef.current.has(String(c.id))
    );
    if (!next) return;

    certAutoAttemptedRef.current.add(String(next.id));
    void onGenerateCertificate(next);
  }, [activeTab, certBusyId, certLoading, certificates, contentSource, hasProAccess, isSupabaseConfigured]);

  async function onGenerateCertificate(row) {
    if (!row?.id) return;
    if (certBusyId || certBulkBusy) return;
    setCertBusyId(String(row.id));
    try {
      const updated = await generateAndUploadMyCertificate({ certificateRow: row });
      setCertificates((prev) => (Array.isArray(prev)
        ? prev.map((c) => (String(c?.id) === String(updated?.id) ? updated : c))
        : [updated]));
      pushToast({
        variant: 'celebration',
        emoji: '📜',
        title: 'Certificate generated',
        message: `${String(updated?.subject ?? 'Category')} certificate is ready.`,
      });
    } catch (e) {
      pushToast({
        variant: 'error',
        emoji: '⚠️',
        title: 'Certificate failed',
        message: e?.message || 'Could not generate certificate',
      });
    } finally {
      setCertBusyId(null);
    }
  }

  function resolveCurrentRecipientName() {
    const trimmed = String(displayName ?? '').trim();
    if (trimmed) return trimmed;
    const email = String(user?.email ?? '').trim();
    return email || 'Member';
  }

  async function onRegenerateCertificate(row) {
    if (!row?.id) return;
    if (!hasProAccess) return;
    if (certBusyId || certBulkBusy) return;

    setCertBusyId(String(row.id));
    try {
      const updatedRecipientRow = await updateMyCertificateRecipient({
        certificateId: row.id,
        recipientName: resolveCurrentRecipientName(),
        recipientAvatarUrl: String(avatarUrl ?? '') || null,
      });

      const updated = await generateAndUploadMyCertificate({ certificateRow: updatedRecipientRow });
      setCertificates((prev) => (Array.isArray(prev)
        ? prev.map((c) => (String(c?.id) === String(updated?.id) ? updated : c))
        : [updated]));

      pushToast({
        variant: 'success',
        emoji: '♻️',
        title: 'Certificate regenerated',
        message: `${String(updated?.subject ?? 'Category')} now uses your current name.`,
      });
    } catch (e) {
      pushToast({
        variant: 'error',
        emoji: '⚠️',
        title: 'Regeneration failed',
        message: e?.message || 'Could not regenerate certificate',
      });
    } finally {
      setCertBusyId(null);
    }
  }

  async function onRegenerateAllCertificates() {
    if (!hasProAccess) return;
    if (certBusyId || certBulkBusy) return;

    let rows = Array.isArray(certificates) ? certificates : [];
    if (rows.length === 0) {
      try {
        rows = await listMyCertificates();
        setCertificates(Array.isArray(rows) ? rows : []);
      } catch (e) {
        pushToast({
          variant: 'error',
          emoji: '⚠️',
          title: 'Could not load certificates',
          message: e?.message || 'Try again in a moment.',
        });
        return;
      }
    }

    if (!Array.isArray(rows) || rows.length === 0) {
      pushToast({ variant: 'success', emoji: '✅', title: 'No certificates to update', message: 'Earn one by completing a category.' });
      return;
    }

    setCertBulkBusy(true);
    setCertBulkProgress({ done: 0, total: rows.length });
    setCertError(null);

    try {
      const ordered = [...rows].sort((a, b) => {
        const ax = String(a?.awarded_at ?? a?.created_at ?? '');
        const bx = String(b?.awarded_at ?? b?.created_at ?? '');
        return bx.localeCompare(ax);
      });

      let done = 0;
      for (const row of ordered) {
        const updatedRecipientRow = await updateMyCertificateRecipient({
          certificateId: row.id,
          recipientName: resolveCurrentRecipientName(),
          recipientAvatarUrl: String(avatarUrl ?? '') || null,
        });

        const updated = await generateAndUploadMyCertificate({ certificateRow: updatedRecipientRow });
        setCertificates((prev) => (Array.isArray(prev)
          ? prev.map((c) => (String(c?.id) === String(updated?.id) ? updated : c))
          : [updated]));

        done += 1;
        setCertBulkProgress({ done, total: ordered.length });
      }

      pushToast({
        variant: 'success',
        emoji: '✅',
        title: 'All certificates updated',
        message: 'Regenerated using your current display name.',
      });

      setIdentityCertPrompt(null);
    } catch (e) {
      pushToast({
        variant: 'error',
        emoji: '⚠️',
        title: 'Bulk regeneration failed',
        message: e?.message || 'Could not regenerate all certificates',
      });
    } finally {
      setCertBulkBusy(false);
      setCertBulkProgress(null);
    }
  }

  async function onShareCertificate(row) {
    const cacheBuster = row?.updated_at ?? row?.awarded_at ?? null;
    const url =
      getCertificatePublicUrlFromPathWithOptions(row?.png_path, { cacheBuster }) ||
      getCertificatePublicUrlFromPathWithOptions(row?.svg_path, { cacheBuster });
    if (!url) {
      pushToast({ variant: 'error', emoji: '⚠️', title: 'Not ready', message: 'Generate the certificate first.' });
      return;
    }

    try {
      if (navigator?.share) {
        await navigator.share({
          title: row?.title ?? 'Certificate',
          text: row?.title ?? '1 Minute Academy certificate',
          url,
        });
        return;
      }

      await navigator?.clipboard?.writeText(url);
      pushToast({ variant: 'success', emoji: '🔗', title: 'Link copied', message: 'Share link copied to clipboard.' });
    } catch {
      // Fallback: open in a new tab.
      try {
        window?.open(url, '_blank', 'noopener,noreferrer');
      } catch {
        // ignore
      }
    }
  }

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

      <ToastStack toasts={toasts} onDismiss={dismissToast} />

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

              <Suspense
                fallback={
                  <div className="profile-loading">
                    <ProfileTabsSkeleton />
                    <div style={{ marginTop: 14 }} aria-hidden="true">
                      <Skeleton width={'62%'} height={22} radius={12} style={{ marginBottom: 10 }} />
                      <Skeleton width={'92%'} height={14} radius={10} style={{ marginBottom: 8 }} />
                      <Skeleton width={'88%'} height={14} radius={10} style={{ marginBottom: 14 }} />
                      <Skeleton width={'80%'} height={14} radius={10} style={{ marginBottom: 8 }} />
                      <Skeleton width={'76%'} height={14} radius={10} style={{ marginBottom: 8 }} />
                    </div>
                  </div>
                }
              >
                {activeTab === 'overview' && (
                  <OverviewTab stats={stats} tier={tier} formatMinuteExpert={formatMinuteExpert} />
                )}

                {activeTab === 'badges' && (
                  <BadgesTab stats={stats} tier={tier} contentSource={contentSource} getBadgeRarity={getBadgeRarity} />
                )}

                {activeTab === 'certificates' && (
                  <CertificatesTab
                    certificates={certificates}
                    certLoading={certLoading}
                    certError={certError}
                    certBusyId={certBusyId}
                    certBulkBusy={certBulkBusy}
                    certBulkProgress={certBulkProgress}
                    contentSource={contentSource}
                    hasProAccess={hasProAccess}
                    fmtShortDate={fmtShortDate}
                    getCertificatePublicUrlFromPathWithOptions={getCertificatePublicUrlFromPathWithOptions}
                    onGenerateCertificate={onGenerateCertificate}
                    onRegenerateAllCertificates={onRegenerateAllCertificates}
                    onRegenerateCertificate={onRegenerateCertificate}
                    onShareCertificate={onShareCertificate}
                    resolveCurrentRecipientName={resolveCurrentRecipientName}
                  />
                )}

                {activeTab === 'preferences' && (
                  <PreferencesTab
                    avatarInputRef={avatarInputRef}
                    avatarUrl={avatarUrl}
                    canChoosePresentation={canChoosePresentation}
                    certBulkBusy={certBulkBusy}
                    certBulkProgress={certBulkProgress}
                    certBusyId={certBusyId}
                    contentSource={contentSource}
                    displayName={displayName}
                    hasProAccess={hasProAccess}
                    identityBusy={identityBusy}
                    identityCertPrompt={identityCertPrompt}
                    identityError={identityError}
                    identityLoaded={identityLoaded}
                    identityNotice={identityNotice}
                    initialsFromName={initialsFromName}
                    isSupabaseConfigured={isSupabaseConfigured}
                    onChangePresentationStyle={onChangePresentationStyle}
                    onPickAvatar={onPickAvatar}
                    onRegenerateAllCertificates={onRegenerateAllCertificates}
                    onSaveIdentity={onSaveIdentity}
                    presentationBusy={presentationBusy}
                    presentationError={presentationError}
                    presentationNotice={presentationNotice}
                    presentationStyle={presentationStyle}
                    presentationStyleOptions={presentationStyleOptions}
                    setDisplayName={setDisplayName}
                    setIdentityCertPrompt={setIdentityCertPrompt}
                    tier={tier}
                    user={user}
                  />
                )}

                {activeTab === 'progress' && (
                  <ProgressTab
                    contentSource={contentSource}
                    fmtDate={fmtDate}
                    loading={loading}
                    planLabel={planLabel}
                    progress={progress}
                    progressBySubject={progressBySubject}
                    progressFiltered={progressFiltered}
                    progressQuery={progressQuery}
                    progressView={progressView}
                    setProgressQuery={setProgressQuery}
                    setProgressView={setProgressView}
                    showReview={showReview}
                  />
                )}

                {activeTab === 'ratings' && (
                  <RatingsTab
                    contentSource={contentSource}
                    fmtShortDate={fmtShortDate}
                    myRatingsEnriched={myRatingsEnriched}
                    myRatingsFiltered={myRatingsFiltered}
                    onUpdateRating={onUpdateRating}
                    ratingBusyTopicId={ratingBusyTopicId}
                    ratingsError={ratingsError}
                    ratingsLoading={ratingsLoading}
                    ratingsQuery={ratingsQuery}
                    setRatingsQuery={setRatingsQuery}
                    user={user}
                  />
                )}

                {activeTab === 'account' && contentSource !== 'local' && (
                  <AccountTab
                    accountBusy={accountBusy}
                    accountError={accountError}
                    accountNotice={accountNotice}
                    computeFallbackPeriodEnd={computeFallbackPeriodEnd}
                    contentSource={contentSource}
                    fmtShortDate={fmtShortDate}
                    formatStripeStatus={formatStripeStatus}
                    hasStripeCustomer={hasStripeCustomer}
                    isPaused={isPaused}
                    onDeleteAccount={onDeleteAccount}
                    onManageSubscription={onManageSubscription}
                    onPauseAccount={onPauseAccount}
                    onResumeAccount={onResumeAccount}
                    planLabel={planLabel}
                    showSubscriptionBox={showSubscriptionBox}
                    subError={subError}
                    subLoading={subLoading}
                    subStatus={subStatus}
                    tier={tier}
                    user={user}
                  />
                )}
              </Suspense>

            </div>
          </div>
        </motion.section>
      </main>
    </motion.div>
  );
}
