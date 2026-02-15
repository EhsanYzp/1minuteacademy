import { motion } from 'framer-motion';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useEffect, useMemo, useRef, useState } from 'react';
import Header from '../components/Header';
import Seo from '../components/Seo';
import { useAuth } from '../context/AuthContext';
import { formatTierLabel, getCurrentTier } from '../services/entitlements';
import { openCustomerPortal, startProCheckout } from '../services/billing';
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
  const { user, refreshSession, reloadUser, loading } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const tier = getCurrentTier(user);
  const planInterval = String(user?.user_metadata?.plan_interval ?? '').toLowerCase();
  const proInterval = (planInterval === 'year' || planInterval === 'yearly' || planInterval === 'annual')
    ? 'year'
    : (planInterval === 'month' || planInterval === 'monthly')
      ? 'month'
      : null;

  const currentTierKey = !user ? 'guest' : tier === 'pro' ? 'pro' : 'free';
  const planLabel = tier === 'pro'
    ? (planInterval === 'year' || planInterval === 'yearly' || planInterval === 'annual')
      ? 'Pro (Yearly)'
      : (planInterval === 'month' || planInterval === 'monthly')
        ? 'Pro (Monthly)'
        : 'Pro'
    : formatTierLabel(tier);
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
      if (loading) return;
      if (activationStartedRef.current) return;
      activationStartedRef.current = true;

      setBanner('success');

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
            const nextUser = await reloadUser();
          const nextTier = getCurrentTier(nextUser);
          if (!canceled && nextTier === 'pro') {
            setBannerText('Pro is active. Enjoy!');
            setTimeout(() => {
              if (!canceled) navigate('/me', { replace: true });
            }, 900);
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
  }, [checkoutState, reloadUser, user, loading, navigate]);

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

  async function onManageSubscription() {
    if (!user) {
      setBanner('error');
      setBannerText('Please sign in to manage your subscription.');
      return;
    }
    try {
      await openCustomerPortal({ returnPath: '/me?portal=return' });
    } catch (e) {
      setBanner('error');
      setBannerText(e?.message || 'Could not open Stripe portal');
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
      <Seo
        title="Pricing"
        description="Guest and Free let you start. Pro unlocks all topics (including Premium), review mode, Minute Expert + badges, and more lesson styles."
        path={location?.pathname || '/pricing'}
        canonicalPath="/pricing"
      />
      <Header />

      <main className="upgrade-main">
        <section className="upgrade-card">
          <Link className="page-back" to="/">← Home</Link>
          <div className="upgrade-hero">
            <div className="upgrade-emoji">💳</div>
            <div>
              <h1>Pricing</h1>
              <p>Three tiers: Guest, Free account, and Pro.</p>
              <div className="upgrade-tier">Your current plan: <strong>{planLabel}</strong></div>
              {tier === 'pro' && (
                <div className="upgrade-tier-actions">
                  <button className="upgrade-manage-btn" type="button" onClick={onManageSubscription}>
                    Manage subscription
                  </button>
                </div>
              )}
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
              {banner === 'success' && tier === 'pro' && (
                <Link className="upgrade-banner-btn" to="/me">
                  Go to profile
                </Link>
              )}
            </div>
          )}

          <div className="upgrade-section">
            <div className="upgrade-section-title">What you get</div>
            <div className="tier-grid">
              <div className={`tier-card ${currentTierKey === 'guest' ? 'current' : ''}`}>
                <div className="tier-name">Guest</div>
                <div className="tier-price">$0</div>
                <div className="tier-note">No account required</div>
                <ul className="tier-bullets">
                  <li><span className="mark yes bullet-mark" aria-label="Available" title="Available">✓</span><span>Beginner topics</span></li>
                  <li><span className="mark yes bullet-mark" aria-label="Available" title="Available">✓</span><span>Surprise shuffle (Beginner only)</span></li>
                  <li><span className="mark yes bullet-mark" aria-label="Available" title="Available">✓</span><span>Lesson styles: Focus + Dark</span></li>
                </ul>
                <div className="tier-actions">
                  <Link className="upgrade-link secondary" to="/topics">Browse free topics</Link>
                </div>
              </div>

              <div className={`tier-card ${currentTierKey === 'free' ? 'current' : ''}`}>
                <div className="tier-name">Free account</div>
                <div className="tier-price">$0</div>
                <div className="tier-note">Sign in to save progress</div>
                <ul className="tier-bullets">
                  <li><span className="mark yes bullet-mark" aria-label="Available" title="Available">✓</span><span>Beginner topics</span></li>
                  <li><span className="mark yes bullet-mark" aria-label="Available" title="Available">✓</span><span>Surprise shuffle (Beginner only)</span></li>
                  <li><span className="mark yes bullet-mark" aria-label="Available" title="Available">✓</span><span>Progress tracking</span></li>
                  <li><span className="mark yes bullet-mark" aria-label="Available" title="Available">✓</span><span>Rate modules with stars</span></li>
                  <li><span className="mark yes bullet-mark" aria-label="Available" title="Available">✓</span><span>Lesson styles: Focus + Dark</span></li>
                </ul>
                <div className="tier-actions">
                  {!user ? (
                    <Link className="upgrade-link" to="/login">Sign in</Link>
                  ) : (
                    <Link className="upgrade-link" to="/me">Go to profile</Link>
                  )}
                </div>
              </div>

              <div className={`tier-card featured ${currentTierKey === 'pro' ? 'current' : ''}`}>
                <div className="tier-badge">Best for serious learners</div>
                <div className="tier-name">Pro</div>
                <div className="tier-price">All access</div>
                <div className="tier-note">Beginner → Advanced</div>
                <ul className="tier-bullets">
                  <li><span className="mark yes bullet-mark" aria-label="Available" title="Available">✓</span><span>All modules (not just Beginner)</span></li>
                  <li><span className="mark yes bullet-mark" aria-label="Available" title="Available">✓</span><span>Surprise shuffle across all modules</span></li>
                  <li><span className="mark yes bullet-mark" aria-label="Available" title="Available">✓</span><span>Premium topics</span></li>
                  <li><span className="mark yes bullet-mark" aria-label="Available" title="Available">✓</span><span>Review mode (no timer)</span></li>
                  <li><span className="mark yes bullet-mark" aria-label="Available" title="Available">✓</span><span>Minute Expert + badges</span></li>
                  <li><span className="mark yes bullet-mark" aria-label="Available" title="Available">✓</span><span>All lesson presentation styles</span></li>
                  <li><span className="mark yes bullet-mark" aria-label="Available" title="Available">✓</span><span>Progress tracking</span></li>
                  <li><span className="mark yes bullet-mark" aria-label="Available" title="Available">✓</span><span>Rate modules with stars</span></li>
                </ul>
                <div className="tier-actions">
                  {tier === 'pro' ? (
                    <button className="upgrade-link" type="button" onClick={onManageSubscription}>Manage subscription</button>
                  ) : (
                    <a className="upgrade-link" href="#pro-plans">See Pro plans</a>
                  )}
                </div>
              </div>
            </div>

            <div className="compare">
              <table className="compare-table">
                <caption className="sr-only">Plan feature comparison</caption>
                <colgroup>
                  <col style={{ width: '43.75%' }} />
                  <col style={{ width: '18.75%' }} />
                  <col style={{ width: '18.75%' }} />
                  <col style={{ width: '18.75%' }} />
                </colgroup>
                <thead>
                  <tr className="compare-head">
                    <th scope="col" className="compare-feature">Feature</th>
                    <th scope="col" className="compare-tier">Guest</th>
                    <th scope="col" className="compare-tier">Free</th>
                    <th scope="col" className="compare-tier">Pro</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <th scope="row" className="compare-feature">Surprise shuffle</th>
                    <td className="compare-cell"><span className="mark yes" aria-label="Available" title="Available">✓</span></td>
                    <td className="compare-cell"><span className="mark yes" aria-label="Available" title="Available">✓</span></td>
                    <td className="compare-cell"><span className="mark yes" aria-label="Available" title="Available">✓</span></td>
                  </tr>

                  <tr>
                    <th scope="row" className="compare-feature">Beginner topics</th>
                    <td className="compare-cell"><span className="mark yes" aria-label="Available" title="Available">✓</span></td>
                    <td className="compare-cell"><span className="mark yes" aria-label="Available" title="Available">✓</span></td>
                    <td className="compare-cell"><span className="mark yes" aria-label="Available" title="Available">✓</span></td>
                  </tr>

                  <tr>
                    <th scope="row" className="compare-feature">Intermediate/Advanced topics</th>
                    <td className="compare-cell"><span className="mark no" aria-label="Locked" title="Locked">✕</span></td>
                    <td className="compare-cell"><span className="mark no" aria-label="Locked" title="Locked">✕</span></td>
                    <td className="compare-cell"><span className="mark yes" aria-label="Available" title="Available">✓</span></td>
                  </tr>

                  <tr>
                    <th scope="row" className="compare-feature">Progress tracking</th>
                    <td className="compare-cell"><span className="mark no" aria-label="Locked" title="Locked">✕</span></td>
                    <td className="compare-cell"><span className="mark yes" aria-label="Available" title="Available">✓</span></td>
                    <td className="compare-cell"><span className="mark yes" aria-label="Available" title="Available">✓</span></td>
                  </tr>

                  <tr>
                    <th scope="row" className="compare-feature">Minute Expert + badges</th>
                    <td className="compare-cell"><span className="mark no" aria-label="Locked" title="Locked">✕</span></td>
                    <td className="compare-cell"><span className="mark no" aria-label="Locked" title="Locked">✕</span></td>
                    <td className="compare-cell"><span className="mark yes" aria-label="Available" title="Available">✓</span></td>
                  </tr>

                  <tr>
                    <th scope="row" className="compare-feature">Premium topics</th>
                    <td className="compare-cell"><span className="mark no" aria-label="Locked" title="Locked">✕</span></td>
                    <td className="compare-cell"><span className="mark no" aria-label="Locked" title="Locked">✕</span></td>
                    <td className="compare-cell"><span className="mark yes" aria-label="Available" title="Available">✓</span></td>
                  </tr>

                  <tr>
                    <th scope="row" className="compare-feature">Review mode</th>
                    <td className="compare-cell"><span className="mark no" aria-label="Locked" title="Locked">✕</span></td>
                    <td className="compare-cell"><span className="mark no" aria-label="Locked" title="Locked">✕</span></td>
                    <td className="compare-cell"><span className="mark yes" aria-label="Available" title="Available">✓</span></td>
                  </tr>

                  <tr>
                    <th scope="row" className="compare-feature">Lesson presentation styles</th>
                    <td className="compare-cell"><span className="mark yes" aria-label="Available" title="Available">✓</span></td>
                    <td className="compare-cell"><span className="mark yes" aria-label="Available" title="Available">✓</span></td>
                    <td className="compare-cell"><span className="mark yes" aria-label="Available" title="Available">✓</span></td>
                  </tr>

                  <tr>
                    <th scope="row" className="compare-feature">Rate modules with stars</th>
                    <td className="compare-cell"><span className="mark no" aria-label="Locked" title="Locked">✕</span></td>
                    <td className="compare-cell"><span className="mark yes" aria-label="Available" title="Available">✓</span></td>
                    <td className="compare-cell"><span className="mark yes" aria-label="Available" title="Available">✓</span></td>
                  </tr>
                </tbody>
              </table>
            </div>
            <div className="compare-notes" aria-label="Plan notes">
              Note: Guest/Free shuffle from Beginner modules and include Focus + Dark styles. Pro shuffles across all modules and unlocks all styles.
            </div>
            <div className="tier-rule">Rule of thumb: only <strong>Beginner</strong> topics are available without Pro.</div>
          </div>

          <div className="upgrade-section upgrade-section-spaced">
            <div className="upgrade-section-title">Pick a Pro plan</div>
            <div className="upgrade-section-sub">Cancel anytime in Stripe Portal. Pro unlocks Premium + advanced modules, Minute Expert + badges, review mode, ratings, and extra lesson presentation styles.</div>
          </div>

          <div className="upgrade-grid" id="pro-plans">
            <div className={`plan ${tier === 'pro' && proInterval === 'month' ? 'current' : ''}`}>
              <div className="plan-title">Monthly</div>
              <div className="plan-price">{DEFAULT_PRICE_MONTH}<span className="plan-sub">/month</span></div>
              <ul className="plan-bullets">
                <li>All modules (not just Beginner)</li>
                <li>Premium topics</li>
                <li>Minute Expert + badges</li>
                <li>Review mode (no timer)</li>
                <li>Progress tracking</li>
                <li>Rate modules with stars</li>
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

            <div className={`plan featured ${tier === 'pro' && proInterval === 'year' ? 'current' : ''}`}>
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
