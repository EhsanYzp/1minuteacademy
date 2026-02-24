import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import useShowProgressVisuals from '../../../lib/useShowProgressVisuals';
import { setLocalShowProgressVisuals } from '../../../lib/progressVisuals';

export default function PreferencesTab({
  avatarInputRef,
  avatarUrl,
  canChoosePresentation,
  certBulkBusy,
  certBulkProgress,
  certBusyId,
  contentSource,
  displayName,
  hasProAccess,
  identityBusy,
  identityCertPrompt,
  identityError,
  identityLoaded,
  identityNotice,
  initialsFromName,
  isSupabaseConfigured,
  onChangePresentationStyle,
  onPickAvatar,
  onRegenerateAllCertificates,
  onSaveIdentity,
  presentationBusy,
  presentationError,
  presentationNotice,
  presentationStyle,
  presentationStyleOptions,
  setDisplayName,
  setIdentityCertPrompt,
  tier,
  user,
}) {
  const showProgressVisuals = useShowProgressVisuals();
  const progressVisualsLabel = useMemo(
    () => (showProgressVisuals ? 'On (recommended)' : 'Off'),
    [showProgressVisuals]
  );

  return (
    <>
      <div className="profile-section-header profile-section-header-spaced">
        <h2>Public profile</h2>
        <div className="profile-section-sub">Shown on your reviews.</div>
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

            {identityCertPrompt && hasProAccess ? (
              <div className="profile-cert-updatePrompt" role="status">
                <div className="profile-cert-updatePrompt-title">Update your certificates?</div>
                <div className="profile-cert-updatePrompt-sub">
                  You have {identityCertPrompt.count} certificate{identityCertPrompt.count === 1 ? '' : 's'}. Regenerate them to
                  reflect your new name/photo.
                </div>
                <div className="profile-cert-updatePrompt-actions">
                  <button
                    type="button"
                    className="profile-account-btn"
                    onClick={onRegenerateAllCertificates}
                    disabled={certBulkBusy || Boolean(certBusyId)}
                  >
                    {certBulkBusy
                      ? `Updating… (${certBulkProgress?.done ?? 0}/${certBulkProgress?.total ?? identityCertPrompt.count})`
                      : 'Update certificates now'}
                  </button>
                  <button
                    type="button"
                    className="profile-account-btn secondary"
                    onClick={() => setIdentityCertPrompt(null)}
                    disabled={certBulkBusy || Boolean(certBusyId)}
                  >
                    Later
                  </button>
                  <Link className="profile-upgrade-inline" to="/me?tab=certificates">
                    View certificates
                  </Link>
                </div>
              </div>
            ) : null}

            {identityError ? <div className="profile-preference-error">{identityError?.message ?? String(identityError)}</div> : null}
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
                <option key={s.id} value={s.id} disabled={Boolean(s.disabled)}>
                  {s.label}
                </option>
              ))}
            </select>
          </label>

          {tier !== 'pro' && tier !== 'paused' && contentSource !== 'local' ? (
            <Link className="profile-upgrade-btn" to="/upgrade">
              Upgrade
            </Link>
          ) : null}
        </div>

        <div className="profile-preference-help">
          {tier === 'pro' || tier === 'paused'
            ? 'Applies to lessons and review mode.'
            : tier === 'free'
              ? 'Free members can choose Focus or Dark. Other styles are Pro-only.'
              : 'Sign in to choose Focus or Dark. Other styles are Pro-only.'}
        </div>

        {presentationNotice ? <div className="profile-preference-note" aria-live="polite">{presentationNotice}</div> : null}

        {presentationError ? (
          <div className="profile-preference-error" aria-live="polite">
            {presentationError?.message ?? String(presentationError)}
          </div>
        ) : null}
      </div>

      <div className="profile-note" style={{ marginBottom: 12 }}>
        <strong>Progress visuals</strong>
        <div className="profile-preference-row">
          <label className="profile-preference-label" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <input
              type="checkbox"
              checked={Boolean(showProgressVisuals)}
              onChange={(e) => setLocalShowProgressVisuals(Boolean(e?.target?.checked))}
              aria-label="Show progress tracking visuals"
            />
            <span>Show progress bars and completion percentages</span>
          </label>

          <div className="profile-preference-help" style={{ marginLeft: 'auto' }} aria-label="Current setting">
            {progressVisualsLabel}
          </div>
        </div>

        <div className="profile-preference-help">
          Affects category, course, and chapter pages. This does not delete your progress.
        </div>
      </div>
    </>
  );
}
