import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import Header from '../components/Header';
import { useAuth } from '../context/AuthContext';
import { formatTierLabel, getCurrentTier } from '../services/entitlements';
import './UpgradePage.css';

const DEFAULT_PRICE_MONTH = import.meta.env.VITE_PRICE_MONTH ?? '$7.99';
const DEFAULT_PRICE_YEAR = import.meta.env.VITE_PRICE_YEAR ?? '$59.99';

export default function UpgradePage() {
  const { user } = useAuth();
  const tier = getCurrentTier(user);

  return (
    <motion.div className="upgrade-page" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <Header />

      <main className="upgrade-main">
        <section className="upgrade-card">
          <div className="upgrade-hero">
            <div className="upgrade-emoji">⚡️</div>
            <div>
              <h1>Upgrade to Pro</h1>
              <p>Unlock all lessons, review mode, and saved takeaways.</p>
              <div className="upgrade-tier">Current: <strong>{formatTierLabel(tier)}</strong></div>
            </div>
          </div>

          <div className="upgrade-grid">
            <div className="plan">
              <div className="plan-title">Monthly</div>
              <div className="plan-price">{DEFAULT_PRICE_MONTH}<span className="plan-sub">/month</span></div>
              <ul className="plan-bullets">
                <li>All modules (not just Beginner)</li>
                <li>Review mode (no timer)</li>
                <li>Saved takeaways in your profile</li>
                <li>Progress tracking</li>
              </ul>
              <button className="plan-cta" type="button" disabled title="Payment integration coming next">
                Continue (coming soon)
              </button>
            </div>

            <div className="plan featured">
              <div className="plan-badge">Best value</div>
              <div className="plan-title">Yearly</div>
              <div className="plan-price">{DEFAULT_PRICE_YEAR}<span className="plan-sub">/year</span></div>
              <div className="plan-note">Save vs monthly</div>
              <ul className="plan-bullets">
                <li>Everything in Monthly</li>
                <li>Lower effective monthly cost</li>
              </ul>
              <button className="plan-cta" type="button" disabled title="Payment integration coming next">
                Continue (coming soon)
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
              <div className="upgrade-foot-text">Payment integration is next. For now, we can manually set your plan in Supabase user metadata.</div>
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
