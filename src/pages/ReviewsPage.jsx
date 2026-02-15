import { motion } from 'framer-motion';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useEffect, useMemo, useRef, useState } from 'react';
import Header from '../components/Header';
import Seo from '../components/Seo';
import StarRating from '../components/StarRating';
import { useAuth } from '../context/AuthContext';
import { isSupabaseConfigured } from '../lib/supabaseClient';
import { getReviewSummary, getMyLatestReview, listApprovedReviews, submitReview } from '../services/reviews';
import { getMyProfile, updateMyProfile, uploadMyAvatar } from '../services/profiles';
import './ReviewsPage.css';

function initialsFromName(name) {
  const s = String(name ?? '').trim();
  if (!s) return '?';
  const parts = s.split(/\s+/).filter(Boolean);
  const first = parts[0]?.[0] ?? '';
  const last = parts.length > 1 ? parts[parts.length - 1]?.[0] ?? '' : '';
  return (first + last).toUpperCase() || '?';
}

function clampPage(n) {
  const v = Math.floor(Number(n));
  if (!Number.isFinite(v) || v < 1) return 1;
  return v;
}

export default function ReviewsPage() {
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const isAuthed = Boolean(user);

  const wantsNew = useMemo(() => {
    try {
      const sp = new URLSearchParams(location.search);
      return sp.get('new') === '1';
    } catch {
      return false;
    }
  }, [location.search]);

  const page = useMemo(() => {
    try {
      const p = new URLSearchParams(location.search).get('page');
      return clampPage(p);
    } catch {
      return 1;
    }
  }, [location.search]);

  const PAGE_SIZE = 12;

  const [summary, setSummary] = useState({ avgRating: 0, count: 0 });
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [mine, setMine] = useState(null);
  const [mineError, setMineError] = useState(null);

  const [myProfile, setMyProfile] = useState(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileError, setProfileError] = useState(null);

  const [showForm, setShowForm] = useState(false);
  const [rating, setRating] = useState(5);
  const [quote, setQuote] = useState('');
  const [authorTitle, setAuthorTitle] = useState('');
  const [platform, setPlatform] = useState('');
  const [platformUrl, setPlatformUrl] = useState('');

  const [submitBusy, setSubmitBusy] = useState(false);
  const [submitError, setSubmitError] = useState(null);
  const [submitNotice, setSubmitNotice] = useState('');

  const [avatarBusy, setAvatarBusy] = useState(false);
  const [avatarError, setAvatarError] = useState(null);
  const [avatarNotice, setAvatarNotice] = useState('');
  const avatarInputRef = useRef(null);
  const formRef = useRef(null);

  const myAvatarUrl = String(myProfile?.avatar_url ?? '').trim();
  const needsAvatar = Boolean(isAuthed && isSupabaseConfigured && !myAvatarUrl);

  const quoteTrimmed = String(quote ?? '').trim();
  const quoteLen = quoteTrimmed.length;

  const canSubmit = useMemo(() => {
    if (!isAuthed) return false;
    if (needsAvatar) return false;
    if (quoteLen < 20 || quoteLen > 420) return false;
    const r = Number(rating);
    if (!Number.isFinite(r) || r < 1 || r > 5) return false;
    return true;
  }, [isAuthed, needsAvatar, quoteLen, rating]);

  const submitDisabledReason = useMemo(() => {
    if (!isAuthed) return 'Sign in to leave a review.';
    if (needsAvatar) return 'Upload a photo to submit.';
    if (quoteLen < 20) return 'Add at least 20 characters.';
    if (quoteLen > 420) return 'Keep it under 420 characters.';
    const r = Number(rating);
    if (!Number.isFinite(r) || r < 1 || r > 5) return 'Select a star rating.';
    return '';
  }, [isAuthed, needsAvatar, quoteLen, rating]);

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      setLoading(true);
      setError(null);
      try {
        const [s, list] = await Promise.all([
          getReviewSummary().catch(() => ({ avgRating: 0, count: 0 })),
          listApprovedReviews({ page, pageSize: PAGE_SIZE }),
        ]);
        if (cancelled) return;
        setSummary(s);
        setItems(list.items);
        setTotal(list.total);
      } catch (e) {
        if (cancelled) return;
        setError(e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    run();
    return () => {
      cancelled = true;
    };
  }, [page]);

  useEffect(() => {
    let cancelled = false;
    if (!isAuthed) {
      setMine(null);
      setMineError(null);
      return () => {
        cancelled = true;
      };
    }

    const run = async () => {
      try {
        setMineError(null);
        const latest = await getMyLatestReview();
        if (cancelled) return;
        setMine(latest);
      } catch (e) {
        if (cancelled) return;
        setMineError(e);
      }
    };

    run();
    return () => {
      cancelled = true;
    };
  }, [isAuthed]);

  useEffect(() => {
    if (!isAuthed) return;
    if (!wantsNew) return;
    setShowForm(true);
    setTimeout(() => formRef.current?.scrollIntoView?.({ behavior: 'smooth', block: 'start' }), 0);
  }, [isAuthed, wantsNew]);

  useEffect(() => {
    let cancelled = false;
    if (!isAuthed || !isSupabaseConfigured) {
      setMyProfile(null);
      setProfileError(null);
      setProfileLoading(false);
      return () => {
        cancelled = true;
      };
    }

    const run = async () => {
      setProfileLoading(true);
      setProfileError(null);
      try {
        const p = await getMyProfile();
        if (cancelled) return;
        setMyProfile(p);
      } catch (e) {
        if (cancelled) return;
        setProfileError(e);
      } finally {
        if (!cancelled) setProfileLoading(false);
      }
    };

    run();
    return () => {
      cancelled = true;
    };
  }, [isAuthed]);

  function goToPage(nextPage) {
    const p = Math.max(1, clampPage(nextPage));
    const params = new URLSearchParams(location.search);
    params.set('page', String(p));
    navigate({ pathname: location.pathname, search: `?${params.toString()}` });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function openForm() {
    setSubmitError(null);
    setSubmitNotice('');
    setAvatarError(null);
    setAvatarNotice('');
    setShowForm(true);
    setTimeout(() => formRef.current?.scrollIntoView?.({ behavior: 'smooth', block: 'start' }), 0);
  }

  async function onPickAvatar(e) {
    const f = e?.target?.files?.[0] ?? null;
    if (!f) return;
    if (!isAuthed || !isSupabaseConfigured) return;
    if (avatarBusy || submitBusy) return;

    setAvatarBusy(true);
    setAvatarError(null);
    setAvatarNotice('');

    try {
      const url = await uploadMyAvatar(f);
      const updated = await updateMyProfile({ avatarUrl: url });
      setMyProfile(updated);
      setAvatarNotice('Photo uploaded.');
    } catch (e2) {
      setAvatarError(e2);
    } finally {
      setAvatarBusy(false);
      try {
        if (avatarInputRef.current) avatarInputRef.current.value = '';
      } catch {
        // ignore
      }
    }
  }

  async function onSubmit(e) {
    e.preventDefault();
    if (submitBusy) return;

    setSubmitError(null);
    setSubmitNotice('');

    if (!canSubmit) {
      setSubmitError(new Error(submitDisabledReason || 'Please complete the form.'));
      return;
    }

    setSubmitBusy(true);
    try {
      await submitReview({ rating, quote, authorTitle, platform, platformUrl });
      // Per request: reload so the new review shows up in the list.
      // Force page 1 and remove any ?new=1 auto-open state.
      try {
        const params = new URLSearchParams(location.search);
        params.set('page', '1');
        params.delete('new');
        window.location.assign(`${location.pathname}?${params.toString()}`);
        return;
      } catch {
        window.location.assign(location.pathname);
        return;
      }
    } catch (e2) {
      setSubmitError(e2);
    } finally {
      setSubmitBusy(false);
    }
  }

  const totalPages = Math.max(1, Math.ceil((Number(total) || 0) / PAGE_SIZE));

  return (
    <motion.div className="reviews-page" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <Seo title="Reviews" description="Platform reviews for 1 Minute Academy." path="/reviews" canonicalPath="/reviews" />
      <Header />

      <main className="reviews-main">
        <div className="reviews-top">
          <Link className="reviews-back" to="/">
            ← Back to home
          </Link>
        </div>

        <section className="reviews-hero">
          <h1>Reviews</h1>
          <p>Real people. Real reviews.</p>

          <div className="reviews-summary">
            <StarRating value={Number(summary?.avgRating ?? 0) || 0} readOnly size="lg" label="Average rating" showValue countText={`${Number(summary?.count ?? 0) || 0} review${Number(summary?.count ?? 0) === 1 ? '' : 's'}`} />
          </div>

          <div className="reviews-cta">
            {!isAuthed ? (
              <Link className="reviews-btn" to="/login" state={{ reason: 'reviews' }}>
                Sign in to leave a review
              </Link>
            ) : (
              <button type="button" className="reviews-btn" onClick={openForm}>
                Leave a review
              </button>
            )}
          </div>

          {mineError ? <div className="reviews-status reviews-status--error">{mineError.message ?? 'Failed to load your review.'}</div> : null}
        </section>

        {isAuthed && showForm && (
          <section ref={formRef} className="reviews-formWrap" aria-label="Leave a review">
            <form className="reviews-form" onSubmit={onSubmit}>
              {isSupabaseConfigured && (
                <div className={needsAvatar ? 'reviews-photo reviews-photo--hard' : 'reviews-photo'}>
                  <div className="reviews-photoTitle">Profile photo</div>
                  <div className="reviews-photoSub">
                    {needsAvatar ? 'Required to keep reviews real.' : 'Looks good. You can change it anytime.'}
                  </div>

                  <div className="reviews-photoRow">
                    {myAvatarUrl ? (
                      <img className="reviews-avatar" src={myAvatarUrl} alt="" loading="lazy" />
                    ) : (
                      <div className="reviews-avatar reviews-avatar--fallback" aria-hidden="true">
                        {initialsFromName(myProfile?.display_name || user?.email || 'You')}
                      </div>
                    )}

                    <input ref={avatarInputRef} type="file" accept="image/*" onChange={onPickAvatar} disabled={avatarBusy || submitBusy} className="reviews-fileInput" />

                    <button type="button" className="reviews-btn" onClick={() => avatarInputRef.current?.click?.()} disabled={avatarBusy || submitBusy || profileLoading}>
                      {avatarBusy ? 'Uploading…' : myAvatarUrl ? 'Change photo' : 'Upload photo'}
                    </button>

                    {profileLoading ? <span className="reviews-inlineNote">Loading profile…</span> : null}
                  </div>

                  {avatarNotice ? <div className="reviews-status reviews-status--ok">{avatarNotice}</div> : null}
                  {profileError ? <div className="reviews-status reviews-status--error">{profileError.message ?? 'Failed to load profile.'}</div> : null}
                  {avatarError ? <div className="reviews-status reviews-status--error">{avatarError.message ?? 'Failed to upload photo.'}</div> : null}
                </div>
              )}

              <div className="reviews-rating">
                <div className="reviews-ratingLabel">Your rating</div>
                <StarRating value={rating} onChange={setRating} size="lg" label="Select a star rating" />
              </div>

              <label className="reviews-label">
                Your review
                <textarea value={quote} onChange={(e) => setQuote(e.target.value)} rows={4} placeholder="What did 1 Minute Academy help you with?" maxLength={420} required />
                <div className="reviews-hint">
                  <span>{quoteLen}/420</span>
                  <span>Write at least 20 characters.</span>
                </div>
              </label>

              <div className="reviews-row">
                <label className="reviews-label">
                  Title (optional)
                  <input value={authorTitle} onChange={(e) => setAuthorTitle(e.target.value)} placeholder="e.g. Founder" maxLength={80} />
                </label>
                <label className="reviews-label">
                  Platform (optional)
                  <input value={platform} onChange={(e) => setPlatform(e.target.value)} placeholder="e.g. X" maxLength={40} />
                </label>
              </div>

              <label className="reviews-label">
                Link (optional)
                <input value={platformUrl} onChange={(e) => setPlatformUrl(e.target.value)} placeholder="https://…" />
              </label>

              {submitError ? <div className="reviews-status reviews-status--error">{submitError.message ?? 'Failed to submit.'}</div> : null}
              {submitNotice ? <div className="reviews-status reviews-status--ok">{submitNotice}</div> : null}

              <div className="reviews-actions">
                <button type="button" className="reviews-btn reviews-btn--ghost" onClick={() => setShowForm(false)} disabled={submitBusy}>
                  Cancel
                </button>
                <button type="submit" className="reviews-btn" disabled={submitBusy || !canSubmit}>
                  {submitBusy ? 'Sending…' : 'Submit review'}
                </button>
              </div>

              {!canSubmit && submitDisabledReason ? <div className="reviews-status reviews-status--warn">{submitDisabledReason}</div> : null}
            </form>
          </section>
        )}

        <section className="reviews-list" aria-label="Approved reviews">
          {loading ? <div className="reviews-status">Loading reviews…</div> : null}
          {!loading && error ? <div className="reviews-status reviews-status--error">{error.message ?? 'Failed to load reviews.'}</div> : null}

          {!loading && !error && (
            <>
              <div className="reviews-grid">
                {(Array.isArray(items) ? items : []).map((r) => (
                  <figure key={r.id} className="reviews-card">
                    <div className="reviews-cardHeader">
                      <div className="reviews-person">
                        {r.author_avatar_url ? (
                          <img className="reviews-avatar reviews-cardAvatar" src={String(r.author_avatar_url)} alt="" loading="lazy" />
                        ) : (
                          <div className="reviews-avatar reviews-avatar--fallback reviews-cardAvatar" aria-hidden="true">
                            {initialsFromName(r.author_name)}
                          </div>
                        )}
                        <div className="reviews-personMeta">
                          <div className="reviews-name">{String(r.author_name ?? 'Member')}</div>
                          {r.author_title ? <div className="reviews-titleLine">{String(r.author_title)}</div> : null}
                        </div>
                      </div>

                      {r.platform ? (
                        <div className="reviews-badge">
                          {r.platform_url ? (
                            <a className="reviews-badgeLink" href={String(r.platform_url)} target="_blank" rel="noreferrer">
                              {String(r.platform)}
                            </a>
                          ) : (
                            String(r.platform)
                          )}
                        </div>
                      ) : null}
                    </div>

                    <blockquote className="reviews-quote">{String(r.quote ?? '')}</blockquote>

                    <div className="reviews-cardFooter">
                      <StarRating value={Number(r.rating ?? 0) || 0} readOnly size="md" label="Review rating" />
                      <div className="reviews-ratingPill" aria-hidden="true">
                        {Number(r.rating ?? 0) || 0}/5
                      </div>
                    </div>
                  </figure>
                ))}
              </div>

              {items.length === 0 ? (
                <div className="reviews-empty">
                  <div className="reviews-emptyTitle">No reviews yet.</div>
                  <div className="reviews-emptySub">Be the first to leave one.</div>
                </div>
              ) : null}

              <div className="reviews-pager" aria-label="Pagination">
                <button type="button" className="reviews-btn reviews-btn--ghost" onClick={() => goToPage(page - 1)} disabled={page <= 1}>
                  Previous
                </button>
                <div className="reviews-pageMeta">
                  Page {page} of {totalPages}
                </div>
                <button type="button" className="reviews-btn" onClick={() => goToPage(page + 1)} disabled={page >= totalPages}>
                  Next
                </button>
              </div>
            </>
          )}
        </section>
      </main>
    </motion.div>
  );
}
