import { Link } from 'react-router-dom';

export default function CertificatesTab({
  certificates,
  certLoading,
  certError,
  certBusyId,
  certBulkBusy,
  certBulkProgress,
  contentSource,
  canManageCertificates,
  fmtShortDate,
  getCertificatePublicUrlFromPathWithOptions,
  onGenerateCertificate,
  onRegenerateAllCertificates,
  onRegenerateCertificate,
  onShareCertificate,
  resolveCurrentRecipientName,
}) {
  return (
    <>
      <div className="profile-section-header profile-section-header-spaced">
        <h2>Certificates</h2>
        <div className="profile-section-sub">Earn a certificate for each category after you complete 60 topics in it.</div>
      </div>

      {canManageCertificates && certificates.length > 0 ? (
        <div className="profile-certificates-toolbar">
          <button
            type="button"
            className="profile-certificate-btn primary"
            onClick={onRegenerateAllCertificates}
            disabled={certBulkBusy || Boolean(certBusyId)}
            title="Regenerate all certificates using your current display name and photo"
          >
            {certBulkBusy
              ? `Regenerating… (${certBulkProgress?.done ?? 0}/${certBulkProgress?.total ?? certificates.length})`
              : 'Regenerate all (current name + photo)'}
          </button>
          <div className="profile-certificates-toolbarNote">
            Uses your current profile identity: <strong>{resolveCurrentRecipientName()}</strong>
          </div>
        </div>
      ) : null}

      {!canManageCertificates && contentSource !== 'local' ? (
        <div className="profile-note" style={{ marginBottom: 12 }}>
          <strong>Pro feature</strong>
          <div>Upgrade to Pro to start earning category certificates.</div>
          <div style={{ marginTop: 10 }}>
            <Link className="profile-upgrade-btn" to="/upgrade">
              Upgrade
            </Link>
          </div>
        </div>
      ) : null}

      {contentSource === 'local' ? (
        <div className="profile-note" style={{ marginBottom: 12 }}>
          <strong>Local Preview mode</strong>
          <div>Certificates require Supabase (Storage + DB).</div>
        </div>
      ) : null}

      {certError ? <div className="profile-error">{certError?.message ?? 'Failed to load certificates.'}</div> : null}

      <div className="profile-certificates" aria-label="Certificates">
        {certLoading ? (
          <div className="profile-certificates-empty">Loading certificates…</div>
        ) : certificates.length === 0 ? (
          <div className="profile-certificates-empty">
            {'No certificates yet. Complete 60 topics in a category to earn one.'}
          </div>
        ) : (
          <div className="profile-certificates-grid">
            {certificates.map((c) => {
              const cacheBuster = c?.updated_at ?? c?.awarded_at ?? null;
              const pngUrl = getCertificatePublicUrlFromPathWithOptions(c?.png_path, { cacheBuster });
              const svgUrl = getCertificatePublicUrlFromPathWithOptions(c?.svg_path, { cacheBuster });
              const viewUrl = pngUrl || svgUrl;
              const ready = Boolean(viewUrl);
              const busy = certBusyId && String(certBusyId) === String(c?.id);
              const subtitle = c?.awarded_at ? `Awarded ${fmtShortDate(c.awarded_at)}` : 'Awarded';
              const progressNote = Number(c?.total_topics ?? 0) > 0 ? `${Number(c?.completed_topics ?? 0)}/${Number(c?.total_topics ?? 0)} topics` : null;

              return (
                <div key={c.id} className="profile-certificate-card">
                  <div className="profile-certificate-preview" aria-label="Certificate preview">
                    {ready ? (
                      <img src={viewUrl} alt={c?.title ?? 'Certificate'} loading="lazy" />
                    ) : (
                      <div className="profile-certificate-placeholder">
                        <div className="profile-certificate-placeholderIcon">📜</div>
                        <div className="profile-certificate-placeholderText">Generate to preview</div>
                      </div>
                    )}
                  </div>

                  <div className="profile-certificate-meta">
                    <div className="profile-certificate-title">{c?.title ?? 'Certificate'}</div>
                    <div className="profile-certificate-sub">
                      {subtitle}
                      {progressNote ? ` • ${progressNote}` : ''}
                    </div>
                  </div>

                  <div className="profile-certificate-actions">
                    {!ready ? (
                      <button
                        type="button"
                        className="profile-certificate-btn primary"
                        onClick={() => onGenerateCertificate(c)}
                        disabled={!canManageCertificates || busy}
                        title={!canManageCertificates ? 'Sign in required' : 'Generate certificate assets'}
                      >
                        {busy ? 'Generating…' : 'Generate'}
                      </button>
                    ) : (
                      <>
                        <a className="profile-certificate-btn primary" href={viewUrl} target="_blank" rel="noreferrer">
                          View
                        </a>
                        <a className="profile-certificate-btn" href={viewUrl} download>
                          Download
                        </a>
                      </>
                    )}

                    <button
                      type="button"
                      className="profile-certificate-btn"
                      onClick={() => onRegenerateCertificate(c)}
                      disabled={!canManageCertificates || busy}
                      title={!canManageCertificates ? 'Sign in required' : 'Regenerate using your current display name and photo'}
                    >
                      Regenerate
                    </button>

                    <button
                      type="button"
                      className="profile-certificate-btn"
                      onClick={() => onShareCertificate(c)}
                      disabled={!canManageCertificates}
                      title={!canManageCertificates ? 'Sign in required' : 'Copy a share link'}
                    >
                      Share
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}
