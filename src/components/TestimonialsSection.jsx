import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { isSupabaseConfigured } from '../lib/supabaseClient';
import { getMyLatestTestimonial, listApprovedTestimonials, submitTestimonial } from '../services/testimonials';

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

  const [showForm, setShowForm] = useState(false);
  const [quote, setQuote] = useState('');
  const [authorTitle, setAuthorTitle] = useState('');
  const [platform, setPlatform] = useState('');
  const [platformUrl, setPlatformUrl] = useState('');
  const [submitBusy, setSubmitBusy] = useState(false);
  const [submitNotice, setSubmitNotice] = useState('');
  const [submitError, setSubmitError] = useState(null);

  const isAuthed = Boolean(user);
  const formRef = useRef(null);

  const canSubmit = useMemo(() => {
    const q = String(quote ?? '').trim();
    return q.length >= 20 && q.length <= 420;
  }, [quote]);

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
    setShowForm(true);
    setTimeout(() => formRef.current?.scrollIntoView?.({ behavior: 'smooth', block: 'center' }), 0);
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
            <figure key={myLatest.id} className="testimonials-card" style={{ gridColumn: '1 / -1' }}>
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
                  <div className="testimonials-name">
                    {String(myLatest.author_name ?? 'You')} <span style={{ opacity: 0.7, fontWeight: 900 }}>(pending approval)</span>
                  </div>
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
        </form>
      )}
    </section>
  );
}
