import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { isSupabaseConfigured } from '../lib/supabaseClient';
import { getMyLatestTestimonial, listApprovedTestimonials, submitTestimonial } from '../services/testimonials';
import { getMyProfile, uploadMyAvatar, updateMyProfile } from '../services/profiles';

function initialsFromName(name) {
  const s = String(name ?? '').trim();
  if (!s) return '?';
  const parts = s.split(/\s+/).filter(Boolean);
  const first = parts[0]?.[0] ?? '';
  const last = parts.length > 1 ? parts[parts.length - 1]?.[0] ?? '' : '';
  return (first + last).toUpperCase() || '?';
}

export default function TestimonialsSection() {
  const { user } = useAuth();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [myLatest, setMyLatest] = useState(null);
  const [myError, setMyError] = useState(null);

  const [myProfile, setMyProfile] = useState(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileError, setProfileError] = useState(null);

  const [showForm, setShowForm] = useState(false);
  const [quote, setQuote] = useState('');
  const [authorTitle, setAuthorTitle] = useState('');
  const [platform, setPlatform] = useState('');
  const [platformUrl, setPlatformUrl] = useState('');
  const [submitBusy, setSubmitBusy] = useState(false);
  const [submitNotice, setSubmitNotice] = useState('');
  const [submitError, setSubmitError] = useState(null);

  const [avatarBusy, setAvatarBusy] = useState(false);
  const [avatarError, setAvatarError] = useState(null);
  const [avatarNotice, setAvatarNotice] = useState('');
  const avatarInputRef = useRef(null);

  const isAuthed = Boolean(user);
  const formRef = useRef(null);

  const myAvatarUrl = String(myProfile?.avatar_url ?? '').trim();
  const needsAvatar = Boolean(isAuthed && isSupabaseConfigured && !myAvatarUrl);

  const quoteTrimmed = String(quote ?? '').trim();
  const quoteLen = quoteTrimmed.length;

  const submitDisabledReason = useMemo(() => {
    if (!isAuthed) return 'Sign in to submit.';
    if (needsAvatar) return 'Upload a photo to submit.';
    if (quoteLen < 20) return 'Add at least 20 characters.';
    if (quoteLen > 420) return 'Keep it under 420 characters.';
    return '';
  }, [isAuthed, needsAvatar, quoteLen]);

  const canSubmit = useMemo(() => {
    const quoteOk = quoteLen >= 20 && quoteLen <= 420;
    if (!quoteOk) return false;
    if (needsAvatar) return false;
    return true;
  }, [quoteLen, needsAvatar]);

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await listApprovedTestimonials({ limit: 6 });
        if (cancelled) return;
        setItems(data);
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
  }, []);

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

    const runProfile = async () => {
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

    runProfile();
    return () => {
      cancelled = true;
    };
  }, [isAuthed]);

  useEffect(() => {
    let cancelled = false;
    if (!isAuthed) {
      setMyLatest(null);
      setMyError(null);
      return () => {
        cancelled = true;
      };
    }

    const runMine = async () => {
      setMyError(null);
      try {
        const mine = await getMyLatestTestimonial();
        if (cancelled) return;
        setMyLatest(mine);
      } catch (e) {
        if (cancelled) return;
        setMyError(e);
      }
    };

    runMine();
    return () => {
      cancelled = true;
    };
  }, [isAuthed]);

  async function onSubmit(e) {
    e.preventDefault();
    if (!isAuthed || submitBusy) return;
    if (needsAvatar) {
      setSubmitError(new Error('Please upload a profile photo before submitting.'));
      return;
    }

    setSubmitBusy(true);
    setSubmitError(null);
    setSubmitNotice('');

    try {
      await submitTestimonial({ quote, authorTitle, platform, platformUrl });
      setSubmitNotice('Thanks — received. We only publish testimonials after manual approval.');
      try {
        const mine = await getMyLatestTestimonial();
        setMyLatest(mine);
      } catch {
        // ignore
      }
      setQuote('');
      setAuthorTitle('');
      setPlatform('');
      setPlatformUrl('');
      setShowForm(false);
    } catch (e2) {
      setSubmitError(e2);
    } finally {
      setSubmitBusy(false);
    }
  }

  function openForm() {
    setSubmitNotice('');
    setSubmitError(null);
    setAvatarError(null);
    setAvatarNotice('');
    setShowForm(true);
    setTimeout(() => formRef.current?.scrollIntoView?.({ behavior: 'smooth', block: 'center' }), 0);
  }

  async function onPickAvatar(e) {
    const f = e?.target?.files?.[0] ?? null;
    if (!f) return;
    if (!isAuthed) return;
    if (!isSupabaseConfigured) return;
    if (avatarBusy || submitBusy) return;

    setAvatarBusy(true);
    setAvatarError(null);
    setAvatarNotice('');
    setSubmitError(null);
    setSubmitNotice('');

    try {
      const url = await uploadMyAvatar(f);
      const updated = await updateMyProfile({ avatarUrl: url });
      setMyProfile(updated);
      setAvatarNotice('Photo uploaded. You can submit now.');
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

  return (
    <section className="testimonials" aria-label="Testimonials">
      <div className="testimonials-head">
        <h2 className="testimonials-title">What learners say</h2>
        <p className="testimonials-sub">No fake quotes. Only humans. Only approved testimonials go public.</p>
      </div>

      {!isSupabaseConfigured && (
        <div className="testimonials-status testimonials-status--error">
          Testimonials are disabled here. Add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` to enable them.
        </div>
      )}

      {loading && <div className="testimonials-status">Loading testimonials…</div>}
      {!loading && error && <div className="testimonials-status testimonials-status--error">{error.message ?? 'Failed to load testimonials.'}</div>}

      {!loading && !error && (
        <div className="testimonials-grid">
          {isAuthed && myLatest && myLatest.approved === false && (
            <figure key={myLatest.id} className="testimonials-card testimonials-card--pending">
              <div className="testimonials-badge" aria-label="Pending approval">
                Pending approval
              </div>

              <blockquote className="testimonials-quote">{String(myLatest.quote ?? '')}</blockquote>
              <figcaption className="testimonials-who">
                {myLatest.author_avatar_url ? (
                  <img className="testimonials-avatar" src={String(myLatest.author_avatar_url)} alt="" loading="lazy" />
                ) : (
                  <div className="testimonials-avatar testimonials-avatar--fallback" aria-hidden="true">
                    {initialsFromName(myLatest.author_name)}
                  </div>
                )}
                <div className="testimonials-meta">
                  <div className="testimonials-name">{String(myLatest.author_name ?? 'You')}</div>
                  {(myLatest.author_title || myLatest.platform) && (
                    <div className="testimonials-titleLine">
                      {myLatest.author_title ? String(myLatest.author_title) : null}
                      {myLatest.author_title && myLatest.platform ? ' · ' : null}
                      {myLatest.platform ? String(myLatest.platform) : null}
                    </div>
                  )}
                </div>
              </figcaption>
            </figure>
          )}

          {(Array.isArray(items) ? items : []).slice(0, 6).map((t) => (
            <figure key={t.id} className="testimonials-card">
              {t.platform && (
                <div className="testimonials-badge" aria-label="Source">
                  {t.platform_url ? (
                    <a className="testimonials-badgeLink" href={String(t.platform_url)} target="_blank" rel="noreferrer">
                      {String(t.platform)}
                    </a>
                  ) : (
                    String(t.platform)
                  )}
                </div>
              )}
              <blockquote className="testimonials-quote">{String(t.quote ?? '')}</blockquote>
              <figcaption className="testimonials-who">
                {t.author_avatar_url ? (
                  <img className="testimonials-avatar" src={String(t.author_avatar_url)} alt="" loading="lazy" />
                ) : (
                  <div className="testimonials-avatar testimonials-avatar--fallback" aria-hidden="true">
                    {initialsFromName(t.author_name)}
                  </div>
                )}
                <div className="testimonials-meta">
                  <div className="testimonials-name">{String(t.author_name ?? 'Member')}</div>
                  {(t.author_title || t.platform) && (
                    <div className="testimonials-titleLine">
                      {t.author_title ? String(t.author_title) : null}
                      {t.author_title && t.platform ? ' · ' : null}
                      {t.platform ? String(t.platform) : null}
                    </div>
                  )}
                </div>
              </figcaption>
            </figure>
          ))}

          {items.length === 0 && (
            <div className="testimonials-empty">
              <div className="testimonials-emptyTitle">No testimonials yet.</div>
              <div className="testimonials-emptySub">If you like 1 Minute Academy, you can be the first.</div>
            </div>
          )}
        </div>
      )}

      {!loading && !error && isAuthed && myError && (
        <div className="testimonials-status testimonials-status--error">{myError.message ?? 'Failed to load your testimonial.'}</div>
      )}

      <div className="testimonials-cta">
        {!isAuthed ? (
          <Link className="testimonials-btn" to="/login" state={{ reason: 'testimonials' }}>
            Sign in to leave a testimonial
          </Link>
        ) : (
          <button type="button" className="testimonials-btn" onClick={openForm}>
            Leave a testimonial
          </button>
        )}
        <div className="testimonials-ctaHint">Tip: mention what you learned in your last minute.</div>
      </div>

      {isAuthed && showForm && (
        <form ref={formRef} className="testimonials-form" onSubmit={onSubmit}>
          {isSupabaseConfigured && (
            <div className={needsAvatar ? 'testimonials-required testimonials-required--hard' : 'testimonials-required'}>
              <div className="testimonials-requiredTitle">Profile photo</div>
              <div className="testimonials-requiredSub">
                {needsAvatar
                  ? 'Required to keep testimonials real.'
                  : 'Looks good. You can change it anytime.'}
              </div>

              <div className="testimonials-requiredRow">
                {myAvatarUrl ? (
                  <img className="testimonials-avatar" src={myAvatarUrl} alt="" loading="lazy" />
                ) : (
                  <div className="testimonials-avatar testimonials-avatar--fallback" aria-hidden="true">
                    {initialsFromName(myProfile?.display_name || user?.email || 'You')}
                  </div>
                )}

                <input
                  ref={avatarInputRef}
                  type="file"
                  accept="image/*"
                  onChange={onPickAvatar}
                  disabled={avatarBusy || submitBusy}
                  className="testimonials-fileInput"
                  aria-label="Upload profile photo"
                />

                <button
                  type="button"
                  className="testimonials-btn"
                  onClick={() => avatarInputRef.current?.click?.()}
                  disabled={avatarBusy || submitBusy || profileLoading}
                >
                  {avatarBusy ? 'Uploading…' : myAvatarUrl ? 'Change photo' : 'Upload photo'}
                </button>

                {profileLoading ? <span className="testimonials-inlineNote">Loading profile…</span> : null}
              </div>

              {avatarNotice ? <div className="testimonials-status testimonials-status--ok">{avatarNotice}</div> : null}
              {profileError ? <div className="testimonials-status testimonials-status--error">{profileError.message ?? 'Failed to load profile.'}</div> : null}
              {avatarError ? <div className="testimonials-status testimonials-status--error">{avatarError.message ?? 'Failed to upload photo.'}</div> : null}
            </div>
          )}

          <label>
            Your testimonial
            <textarea
              value={quote}
              onChange={(e) => setQuote(e.target.value)}
              rows={4}
              placeholder="What did 1 Minute Academy help you understand?"
              maxLength={420}
              required
            />
            <div className="testimonials-hint">
              <span>{quoteLen}/420</span>
              <span>Write at least 20 characters.</span>
            </div>
          </label>

          <div className="testimonials-formRow">
            <label>
              Title (optional)
              <input value={authorTitle} onChange={(e) => setAuthorTitle(e.target.value)} placeholder="e.g. Software Engineer" maxLength={80} />
            </label>
            <label>
              Platform (optional)
              <input value={platform} onChange={(e) => setPlatform(e.target.value)} placeholder="e.g. Product Hunt" maxLength={40} />
            </label>
          </div>

          <label>
            Link (optional)
            <input value={platformUrl} onChange={(e) => setPlatformUrl(e.target.value)} placeholder="https://…" />
          </label>

          {submitError && <div className="testimonials-status testimonials-status--error">{submitError.message ?? 'Failed to submit.'}</div>}
          {submitNotice && <div className="testimonials-status testimonials-status--ok">{submitNotice}</div>}

          <div className="testimonials-formActions">
            <button type="button" className="testimonials-btn testimonials-btn--ghost" onClick={() => setShowForm(false)} disabled={submitBusy}>
              Cancel
            </button>
            <button type="submit" className="testimonials-btn" disabled={submitBusy || !canSubmit}>
              {submitBusy ? 'Sending…' : 'Submit'}
            </button>
          </div>

          {!canSubmit && submitDisabledReason ? <div className="testimonials-hint testimonials-hint--warn">{submitDisabledReason}</div> : null}
        </form>
      )}
    </section>
  );
}
