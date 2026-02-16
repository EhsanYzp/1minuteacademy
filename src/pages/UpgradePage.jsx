import { motion } from 'framer-motion';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useEffect, useMemo, useRef, useState } from 'react';
import Header from '../components/Header';
import Seo from '../components/Seo';
import { useAuth } from '../context/AuthContext';
import { formatTierLabel, getCurrentTier } from '../services/entitlements';
import { openCustomerPortal, startProCheckout } from '../services/billing';
import { PRESENTATION_STYLES } from '../services/presentationStyle';
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
  const proLessonStyleCount = PRESENTATION_STYLES.length;
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

  const [selectedInterval, setSelectedInterval] = useState(() => proInterval ?? 'year');

  useEffect(() => {
    if (tier === 'pro' && proInterval && (proInterval === 'month' || proInterval === 'year')) {
      setSelectedInterval(proInterval);
    }
  }, [tier, proInterval]);

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
        description="Start free. Upgrade to Pro to unlock all topics (including Premium), certificates, Minute Expert + badges, and review mode."
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
              <h1>Simple pricing</h1>
              <p>Free to start. Pro unlocks the full library.</p>
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
            <div className="upgrade-section-title">Choose your plan</div>
            <div className="pricing-grid" aria-label="Plans">
              <div className={`pricing-plan ${currentTierKey === 'guest' ? 'current' : ''}`}>
                <div className="pricing-plan-head">
                  <div className="pricing-plan-name">Guest</div>
                  <div className="pricing-plan-price">$0</div>
                  <div className="pricing-plan-sub">Start instantly. No account.</div>
                </div>

                <ul className="pricing-feature-list" aria-label="Guest features">
                  <li><span className="pricing-check" aria-hidden="true">✓</span>Beginner topics</li>
                  <li><span className="pricing-check" aria-hidden="true">✓</span>Surprise shuffle (Beginner)</li>
                  <li><span className="pricing-check" aria-hidden="true">✓</span>2 lesson styles (Focus + Dark)</li>
                </ul>

                <div className="pricing-plan-actions">
                  <Link className="upgrade-link secondary" to="/topics">Start learning</Link>
                  <div className="pricing-small">Tip: create a free account to save progress.</div>
                </div>
              </div>

              <div className={`pricing-plan ${currentTierKey === 'free' ? 'current' : ''}`}>
                <div className="pricing-plan-head">
                  <div className="pricing-plan-name">Free</div>
                  <div className="pricing-plan-price">$0</div>
                  <div className="pricing-plan-sub">Save progress and ratings.</div>
                </div>

                <ul className="pricing-feature-list" aria-label="Free features">
                  <li><span className="pricing-check" aria-hidden="true">✓</span>Beginner topics</li>
                  <li><span className="pricing-check" aria-hidden="true">✓</span>Surprise shuffle (Beginner)</li>
                  <li><span className="pricing-check" aria-hidden="true">✓</span>2 lesson styles (Focus + Dark)</li>
                  <li><span className="pricing-check" aria-hidden="true">✓</span>Progress tracking</li>
                  <li><span className="pricing-check" aria-hidden="true">✓</span>Rate modules with stars</li>
                </ul>

                <div className="pricing-plan-actions">
                  {!user ? (
                    <Link className="upgrade-link" to="/login">Create free account</Link>
                  ) : (
                    <Link className="upgrade-link secondary" to="/me">Go to profile</Link>
                  )}
                </div>
              </div>

              <div className={`pricing-plan pro featured ${currentTierKey === 'pro' ? 'current' : ''}`}>
                <div className="pricing-plan-badge">Most people upgrade here</div>
                <div className="pricing-plan-head">
                  <div className="pricing-plan-name">Pro</div>
                  <div className="pricing-plan-price">All access</div>
                  <div className="pricing-plan-sub">Unlock everything (Premium + advanced).</div>
                </div>

                <div className="pricing-toggle" role="group" aria-label="Billing interval">
                  <button
                    type="button"
                    className={`pricing-toggle-btn ${selectedInterval === 'month' ? 'active' : ''}`}
                    onClick={() => setSelectedInterval('month')}
                    disabled={tier === 'pro' || busy !== null}
                  >
                    <span className="pricing-toggle-label">Monthly</span>
                    <span className="pricing-toggle-price">{DEFAULT_PRICE_MONTH}</span>
                  </button>
                  <button
                    type="button"
                    className={`pricing-toggle-btn ${selectedInterval === 'year' ? 'active' : ''}`}
                    onClick={() => setSelectedInterval('year')}
                    disabled={tier === 'pro' || busy !== null}
                  >
                    <span className="pricing-toggle-label">Yearly</span>
                    <span className="pricing-toggle-price">{DEFAULT_PRICE_YEAR}</span>
                    {yearlyDiscountLabel ? <span className="pricing-save">Save {yearlyDiscountLabel}</span> : null}
                  </button>
                </div>

                <ul className="pricing-feature-list" aria-label="Pro features">
                  <li><span className="pricing-check" aria-hidden="true">✓</span>All topics (Intermediate + Advanced)</li>
                  <li><span className="pricing-check" aria-hidden="true">✓</span>Premium topics</li>
                  <li><span className="pricing-check" aria-hidden="true">✓</span>Certificates (complete a category)</li>
                  <li><span className="pricing-check" aria-hidden="true">✓</span>Minute Expert + badges</li>
                  <li><span className="pricing-check" aria-hidden="true">✓</span>Review mode (no timer)</li>
                  <li><span className="pricing-check" aria-hidden="true">✓</span>Surprise shuffle across all modules</li>
                  <li><span className="pricing-check" aria-hidden="true">✓</span>{proLessonStyleCount} lesson styles</li>
                </ul>

                <div className="pricing-pro-cta">
                  {tier === 'pro' ? (
                    <button className="plan-cta" type="button" onClick={onManageSubscription}>
                      Manage subscription
                    </button>
                  ) : (
                    <button
                      className="plan-cta"
                      type="button"
                      onClick={() => onCheckout(selectedInterval)}
                      disabled={!user || busy !== null}
                      title={!user ? 'Sign in to upgrade' : 'Start Stripe checkout'}
                    >
                      {busy ? 'Redirecting…' : 'Upgrade to Pro'}
                    </button>
                  )}
                  <div className="pricing-small">
                    Cancel anytime in Stripe Portal. Pro activates automatically after checkout.
                  </div>
                </div>
              </div>
            </div>

            <details className="pricing-details">
              <summary>What do these words mean?</summary>
              <div className="pricing-glossary" aria-label="Glossary">
                <div className="pricing-glossary-item">
                  <div className="pricing-glossary-term">Minute Expert</div>
                  <div className="pricing-glossary-def">A Pro-only progress reward + badge milestones for completing topics.</div>
                </div>
                <div className="pricing-glossary-item">
                  <div className="pricing-glossary-term">Certificates</div>
                  <div className="pricing-glossary-def">Pro-only shareable certificates you earn when you complete every module in a category.</div>
                </div>
                <div className="pricing-glossary-item">
                  <div className="pricing-glossary-term">Premium topics</div>
                  <div className="pricing-glossary-def">Higher-difficulty topics reserved for Pro.</div>
                </div>
                <div className="pricing-glossary-item">
                  <div className="pricing-glossary-term">Surprise shuffle</div>
                  <div className="pricing-glossary-def">The “Surprise me” button that picks a topic for you. Free shuffles Beginner only; Pro shuffles everything.</div>
                </div>
                <div className="pricing-glossary-item">
                  <div className="pricing-glossary-term">Lesson styles</div>
                  <div className="pricing-glossary-def">Different visual reading modes for the same lesson (e.g., Focus, Dark, Cards, Terminal). Guest/Free get 2 styles; Pro unlocks all {proLessonStyleCount}.</div>
                </div>
              </div>
            </details>

            <div className="upgrade-section upgrade-section-spaced">
              <div className="upgrade-section-title">Compare all 3 tiers</div>
              <div className="compare" aria-label="Plan comparison">
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
                      <th scope="row" className="compare-feature">Beginner topics</th>
                      <td className="compare-cell"><span className="mark yes" aria-label="Available" title="Available">✓</span></td>
                      <td className="compare-cell"><span className="mark yes" aria-label="Available" title="Available">✓</span></td>
                      <td className="compare-cell"><span className="mark yes" aria-label="Available" title="Available">✓</span></td>
                    </tr>

                    <tr>
                      <th scope="row" className="compare-feature">Intermediate + Advanced topics</th>
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
                      <th scope="row" className="compare-feature">Surprise shuffle</th>
                      <td className="compare-cell">
                        <div className="compare-cell-stack">
                          <span className="mark yes" aria-label="Available" title="Available">✓</span>
                          <span className="compare-cell-note">Beginner</span>
                        </div>
                      </td>
                      <td className="compare-cell">
                        <div className="compare-cell-stack">
                          <span className="mark yes" aria-label="Available" title="Available">✓</span>
                          <span className="compare-cell-note">Beginner</span>
                        </div>
                      </td>
                      <td className="compare-cell">
                        <div className="compare-cell-stack">
                          <span className="mark yes" aria-label="Available" title="Available">✓</span>
                          <span className="compare-cell-note">All modules</span>
                        </div>
                      </td>
                    </tr>

                    <tr>
                      <th scope="row" className="compare-feature">Progress tracking</th>
                      <td className="compare-cell"><span className="mark no" aria-label="Locked" title="Locked">✕</span></td>
                      <td className="compare-cell"><span className="mark yes" aria-label="Available" title="Available">✓</span></td>
                      <td className="compare-cell"><span className="mark yes" aria-label="Available" title="Available">✓</span></td>
                    </tr>

                    <tr>
                      <th scope="row" className="compare-feature">Rate modules with stars</th>
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
                      <th scope="row" className="compare-feature">Certificates (complete a category)</th>
                      <td className="compare-cell"><span className="mark no" aria-label="Locked" title="Locked">✕</span></td>
                      <td className="compare-cell"><span className="mark no" aria-label="Locked" title="Locked">✕</span></td>
                      <td className="compare-cell"><span className="mark yes" aria-label="Available" title="Available">✓</span></td>
                    </tr>

                    <tr>
                      <th scope="row" className="compare-feature">Review mode (no timer)</th>
                      <td className="compare-cell"><span className="mark no" aria-label="Locked" title="Locked">✕</span></td>
                      <td className="compare-cell"><span className="mark no" aria-label="Locked" title="Locked">✕</span></td>
                      <td className="compare-cell"><span className="mark yes" aria-label="Available" title="Available">✓</span></td>
                    </tr>

                    <tr>
                      <th scope="row" className="compare-feature">Lesson styles</th>
                      <td className="compare-cell">
                        <div className="compare-cell-stack">
                          <span className="mark yes" aria-label="Available" title="Available">✓</span>
                          <span className="compare-cell-note">Focus + Dark</span>
                        </div>
                      </td>
                      <td className="compare-cell">
                        <div className="compare-cell-stack">
                          <span className="mark yes" aria-label="Available" title="Available">✓</span>
                          <span className="compare-cell-note">Focus + Dark</span>
                        </div>
                      </td>
                      <td className="compare-cell">
                        <div className="compare-cell-stack">
                          <span className="mark yes" aria-label="Available" title="Available">✓</span>
                          <span className="compare-cell-note">{proLessonStyleCount} styles</span>
                        </div>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <div className="compare-notes" aria-label="Plan notes">
                Guest is for trying instantly. Free requires an account (to save progress). Pro unlocks everything.
              </div>
            </div>

            <div className="tier-rule">Rule of thumb: without Pro you’ll see <strong>Beginner</strong> topics only.</div>
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
