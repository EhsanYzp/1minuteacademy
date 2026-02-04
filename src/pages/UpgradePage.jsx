import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { useEffect, useMemo, useRef, useState } from 'react';
import Header from '../components/Header';
import { useAuth } from '../context/AuthContext';
import { formatTierLabel, getCurrentTier } from '../services/entitlements';
import { startProCheckout } from '../services/billing';
import './UpgradePage.css';

const DEFAULT_PRICE_MONTH = import.meta.env.VITE_PRICE_MONTH ?? '$7.99';
const DEFAULT_PRICE_YEAR = import.meta.env.VITE_PRICE_YEAR ?? '$59.99';

function parsePriceNumber(value) {
  if (typeof value !== 'string') return null;
  const normalized = value.replace(/[^0-9.]/g, '');
  if (!normalized) return null;
  const number = Number(normalized);
  return Number.isFinite(number) ? number : null;
}

function getCurrencySymbol(value) {
  if (typeof value !== 'string') return '';
  const match = value.trim().match(/[^0-9\s.,]/);
  return match ? match[0] : '';
}

function formatMoney(value, currencySymbol) {
  if (!Number.isFinite(value)) return null;
  const fixed = value.toFixed(2);
  return currencySymbol ? `${currencySymbol}${fixed}` : fixed;
}

function formatPercent(value) {
  if (!Number.isFinite(value)) return null;
  const rounded = Math.round(value);
  if (!Number.isFinite(rounded)) return null;
  return `${rounded}%`;
}

export default function UpgradePage() {
  const { user, refreshSession } = useAuth();
  const tier = getCurrentTier(user);
  const [busy, setBusy] = useState(null); // 'month' | 'year' | null
  const [banner, setBanner] = useState(null); // 'success' | 'cancel' | 'error' | null
  const [bannerText, setBannerText] = useState('');
  const activationStartedRef = useRef(false);

  const checkoutState = useMemo(() => {
    try {
      return new URLSearchParams(window.location.search).get('checkout');
    } catch {
      return null;
    }
  }, []);

  useEffect(() => {
    if (checkoutState === 'success') {
      if (activationStartedRef.current) return;
      activationStartedRef.current = true;

      setBanner('success');

      // If the user was redirected to a different origin (or storage was cleared),
      // they’ll appear logged out. In that case, we can’t refresh the session.
      if (!user) {
        setBannerText('Payment received. Please sign in again to activate Pro on your account.');
        return;
      }

      let canceled = false;
      const startedAt = Date.now();
      const maxMs = 30_000;

      async function poll() {
        const elapsed = Date.now() - startedAt;
        const remaining = Math.max(0, Math.ceil((maxMs - elapsed) / 1000));
        if (!canceled) setBannerText(`Payment received — activating Pro… (${remaining}s)`);

        try {
          const data = await refreshSession();
          const nextUser = data?.session?.user;
          const nextTier = getCurrentTier(nextUser);
          if (!canceled && nextTier === 'pro') {
            setBannerText('Pro is active. Enjoy!');
            return;
          }
        } catch {
          // Ignore and keep polling; user can always sign back in.
        }

        if (Date.now() - startedAt >= maxMs) {
          if (!canceled) setBannerText('Payment received. Pro may still be activating — try Refresh, or check that the Stripe webhook is configured.');
          return;
        }

        setTimeout(poll, 2500);
      }

      poll();
      return () => {
        canceled = true;
      };
    } else if (checkoutState === 'cancel') {
      setBanner('cancel');
      setBannerText('Checkout canceled. No charge was made.');
    }
  }, [checkoutState, refreshSession, user]);

  async function onCheckout(interval) {
    if (!user) {
      setBanner('error');
      setBannerText('Please sign in to upgrade.');
      return;
    }
    if (tier === 'pro') return;

    setBanner(null);
    setBannerText('');
    setBusy(interval);
    try {
      await startProCheckout({ interval });
    } catch (e) {
      setBanner('error');
      setBannerText(e?.message || 'Could not start checkout');
      setBusy(null);
    }
  }

  const monthPriceNumber = parsePriceNumber(DEFAULT_PRICE_MONTH);
  const yearPriceNumber = parsePriceNumber(DEFAULT_PRICE_YEAR);
  const currencySymbol = getCurrencySymbol(DEFAULT_PRICE_MONTH) || getCurrencySymbol(DEFAULT_PRICE_YEAR);
  const yearlyDiscountPercent =
    monthPriceNumber && yearPriceNumber
      ? ((1 - (yearPriceNumber / 12) / monthPriceNumber) * 100)
      : null;
  const yearlyDiscountLabel = yearlyDiscountPercent && yearlyDiscountPercent > 0
    ? formatPercent(yearlyDiscountPercent)
    : null;

  const yearlyOriginalNumber = monthPriceNumber ? monthPriceNumber * 12 : null;
  const yearlyOriginalLabel = yearlyOriginalNumber
    ? formatMoney(yearlyOriginalNumber, currencySymbol)
    : null;

  return (
    <motion.div className="upgrade-page" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <Header />

      <main className="upgrade-main">
        <section className="upgrade-card">
          <div className="upgrade-hero">
            <div className="upgrade-emoji">💳</div>
            <div>
              <h1>Pricing</h1>
              <p>Three tiers: Guest, Free account, and Pro.</p>
              <div className="upgrade-tier">Current: <strong>{formatTierLabel(tier)}</strong></div>
            </div>
          </div>

          <div className="upgrade-section">
            <div className="upgrade-section-title">What you get</div>
            <div className="tier-grid">
              <div className="tier-card">
                <div className="tier-name">Guest</div>
                <div className="tier-price">$0</div>
                <div className="tier-note">No account required</div>
                <ul className="tier-bullets">
                  <li>Beginner topics only</li>
                  <li>No progress tracking</li>
                  <li>No Review mode</li>
                  <li>No saved takeaways</li>
                </ul>
                <div className="tier-actions">
                  <Link className="upgrade-link secondary" to="/topics">Browse free topics</Link>
                </div>
              </div>

              <div className="tier-card">
                <div className="tier-name">Free account</div>
                <div className="tier-price">$0</div>
                <div className="tier-note">Sign in to save progress</div>
                <ul className="tier-bullets">
                  <li>Beginner topics only</li>
                  <li>Progress tracking</li>
                  <li>Review mode (locked)</li>
                  <li>Saved takeaways (locked)</li>
                </ul>
                <div className="tier-actions">
                  {!user ? (
                    <Link className="upgrade-link" to="/login">Sign in</Link>
                  ) : (
                    <Link className="upgrade-link" to="/me">Go to profile</Link>
                  )}
                </div>
              </div>

              <div className="tier-card featured">
                <div className="tier-badge">Best for serious learners</div>
                <div className="tier-name">Pro</div>
                <div className="tier-price">All access</div>
                <div className="tier-note">Beginner → Advanced</div>
                <ul className="tier-bullets">
                  <li>All modules (not just Beginner)</li>
                  <li>Review mode (no timer)</li>
                  <li>Saved takeaways in your profile</li>
                  <li>Progress tracking</li>
                </ul>
                <div className="tier-actions">
                  <a className="upgrade-link" href="#pro-plans">See Pro plans</a>
                </div>
              </div>
            </div>

            <div className="compare">
              <div className="compare-row compare-head">
                <div className="compare-feature">Feature</div>
                <div className="compare-tier">Guest</div>
                <div className="compare-tier">Free</div>
                <div className="compare-tier">Pro</div>
              </div>

              <div className="compare-row">
                <div className="compare-feature">Beginner topics</div>
                <div className="compare-cell"><span className="mark yes" aria-label="Available" title="Available">✓</span></div>
                <div className="compare-cell"><span className="mark yes" aria-label="Available" title="Available">✓</span></div>
                <div className="compare-cell"><span className="mark yes" aria-label="Available" title="Available">✓</span></div>
              </div>

              <div className="compare-row">
                <div className="compare-feature">Intermediate/Advanced topics</div>
                <div className="compare-cell"><span className="mark no" aria-label="Locked" title="Locked">✕</span></div>
                <div className="compare-cell"><span className="mark no" aria-label="Locked" title="Locked">✕</span></div>
                <div className="compare-cell"><span className="mark yes" aria-label="Available" title="Available">✓</span></div>
              </div>

              <div className="compare-row">
                <div className="compare-feature">Progress tracking</div>
                <div className="compare-cell"><span className="mark no" aria-label="Locked" title="Locked">✕</span></div>
                <div className="compare-cell"><span className="mark yes" aria-label="Available" title="Available">✓</span></div>
                <div className="compare-cell"><span className="mark yes" aria-label="Available" title="Available">✓</span></div>
              </div>

              <div className="compare-row">
                <div className="compare-feature">Review mode</div>
                <div className="compare-cell"><span className="mark no" aria-label="Locked" title="Locked">✕</span></div>
                <div className="compare-cell"><span className="mark no" aria-label="Locked" title="Locked">✕</span></div>
                <div className="compare-cell"><span className="mark yes" aria-label="Available" title="Available">✓</span></div>
              </div>

              <div className="compare-row">
                <div className="compare-feature">Saved takeaways</div>
                <div className="compare-cell"><span className="mark no" aria-label="Locked" title="Locked">✕</span></div>
                <div className="compare-cell"><span className="mark no" aria-label="Locked" title="Locked">✕</span></div>
                <div className="compare-cell"><span className="mark yes" aria-label="Available" title="Available">✓</span></div>
              </div>
            </div>
            <div className="tier-rule">Rule of thumb: only <strong>Beginner</strong> topics are available without Pro.</div>
          </div>

          <div className="upgrade-grid" id="pro-plans">
            <div className="plan">
              <div className="plan-title">Monthly</div>
              <div className="plan-price">{DEFAULT_PRICE_MONTH}<span className="plan-sub">/month</span></div>
              <ul className="plan-bullets">
                <li>All modules (not just Beginner)</li>
                <li>Review mode (no timer)</li>
                <li>Saved takeaways in your profile</li>
                <li>Progress tracking</li>
              </ul>
              <button
                className="plan-cta"
                type="button"
                onClick={() => onCheckout('month')}
                disabled={!user || tier === 'pro' || busy !== null}
                title={!user ? 'Sign in to upgrade' : tier === 'pro' ? 'You are already Pro' : 'Start Stripe checkout'}
              >
                {tier === 'pro' ? 'You’re Pro' : busy === 'month' ? 'Redirecting…' : 'Continue'}
              </button>
            </div>

            <div className="plan featured">
              <div className="plan-badge">Best value</div>
              <div className="plan-title">Yearly</div>
              <div className="plan-price">{DEFAULT_PRICE_YEAR}<span className="plan-sub">/year</span></div>
              <div className="plan-note">
                {yearlyOriginalLabel && yearlyDiscountLabel ? (
                  <div className="plan-savings" aria-label="Yearly savings">
                    <span className="plan-was">Was {yearlyOriginalLabel}</span>
                    <span className="plan-discount-pill">{yearlyDiscountLabel} off</span>
                  </div>
                ) : (
                  <span>{yearlyDiscountLabel ? `Save ${yearlyDiscountLabel} vs monthly` : 'Save vs monthly'}</span>
                )}
              </div>
              <ul className="plan-bullets">
                <li>Everything in Monthly</li>
                <li>Lower effective monthly cost</li>
              </ul>
              <button
                className="plan-cta"
                type="button"
                onClick={() => onCheckout('year')}
                disabled={!user || tier === 'pro' || busy !== null}
                title={!user ? 'Sign in to upgrade' : tier === 'pro' ? 'You are already Pro' : 'Start Stripe checkout'}
              >
                {tier === 'pro' ? 'You’re Pro' : busy === 'year' ? 'Redirecting…' : 'Continue'}
              </button>
            </div>
          </div>

          {banner && (
            <div className={`upgrade-banner ${banner}`} role="status">
              <div className="upgrade-banner-text">{bannerText}</div>
              {banner === 'success' && !user && (
                <Link className="upgrade-banner-btn" to="/login">
                  Sign in
                </Link>
              )}
              {banner === 'success' && user && tier !== 'pro' && (
                <button className="upgrade-banner-btn" type="button" onClick={() => refreshSession()}>
                  Refresh
                </button>
              )}
            </div>
          )}

          {!user ? (
            <div className="upgrade-foot">
              <div className="upgrade-foot-text">Pro requires an account (so we can sync access + progress).</div>
              <Link className="upgrade-link" to="/login">Sign in / create free account</Link>
            </div>
          ) : (
            <div className="upgrade-foot">
              <div className="upgrade-foot-text">Your plan is tied to your account. After checkout, we’ll activate Pro automatically.</div>
              <div className="upgrade-foot-actions">
                <Link className="upgrade-link" to="/topics">Back to topics</Link>
                <Link className="upgrade-link secondary" to="/me">Go to profile</Link>
              </div>
            </div>
          )}
        </section>
      </main>
    </motion.div>
  );
}
