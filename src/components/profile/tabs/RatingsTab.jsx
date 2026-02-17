import { Link } from 'react-router-dom';
import StarRating from '../../StarRating';

export default function RatingsTab({
  contentSource,
  fmtShortDate,
  myRatingsEnriched,
  myRatingsFiltered,
  onUpdateRating,
  ratingBusyTopicId,
  ratingsError,
  ratingsLoading,
  ratingsQuery,
  setRatingsQuery,
  user,
}) {
  return (
    <>
      <div className="profile-section-header profile-section-header-spaced">
        <h2>Your ratings</h2>
        <div className="profile-section-sub">Change your stars anytime.</div>
      </div>

      {contentSource !== 'local' && !user ? (
        <div className="profile-empty">Sign in to see and edit your ratings.</div>
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
                <button type="button" className="ratings-clear" onClick={() => setRatingsQuery('')} aria-label="Clear ratings search">
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

          {ratingsError && <div className="ratings-error">{ratingsError?.message ?? String(ratingsError)}</div>}
        </>
      )}
    </>
  );
}
