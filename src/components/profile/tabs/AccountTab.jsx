import { Link } from 'react-router-dom';

export default function AccountTab({
  accountBusy,
  accountError,
  accountNotice,
  computeFallbackPeriodEnd,
  contentSource,
  fmtShortDate,
  formatStripeStatus,
  hasStripeCustomer,
  isPaused,
  onDeleteAccount,
  onManageSubscription,
  onPauseAccount,
  onResumeAccount,
  planLabel,
  showSubscriptionBox,
  subError,
  subLoading,
  subStatus,
  tier,
  user,
}) {
  if (contentSource === 'local') return null;

  return (
    <>
      <div className="profile-section-header profile-section-header-spaced">
        <h2>Account</h2>
        <div className="profile-section-sub">Plan, billing, and account controls.</div>
      </div>

      <div className="profile-side-card">
        <div className="profile-side-kicker">Signed in</div>
        <div className="profile-email">{user?.email ?? '—'}</div>

        <div className="profile-plan-row" style={{ marginTop: 10 }}>
          <span>
            Plan: <strong>{planLabel}</strong>
          </span>
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

              const cancellationLabel = isCanceled ? 'Canceled' : isScheduledCancel ? 'Scheduled' : 'Not scheduled';

              return (
                <div className="profile-sub-grid">
                  <div className="profile-sub-item">
                    <span>Status</span>
                    <strong>{statusLabel}</strong>
                  </div>
                  <div className="profile-sub-item">
                    <span>{dateLabel}</span>
                    <strong>{fmtShortDate(dateValue)}</strong>
                  </div>
                  <div className="profile-sub-item">
                    <span>Started</span>
                    <strong>{fmtShortDate(subStatus.created)}</strong>
                  </div>
                  <div className="profile-sub-item">
                    <span>Cancellation</span>
                    <strong>{cancellationLabel}</strong>
                  </div>
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
          {isPaused ? <div className="profile-account-pill">Paused</div> : <div className="profile-account-pill active">Active</div>}
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
          {isPaused ? 'Paused accounts cannot start lessons.' : 'Pausing disables learning access without changing billing.'}
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
  );
}
