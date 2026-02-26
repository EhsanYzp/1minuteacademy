import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getCurrentTier } from '../services/entitlements';
import './Footer.css';

const SUPPORT_EMAIL = import.meta.env.VITE_SUPPORT_EMAIL || 'support@1minute.academy';

export default function Footer() {
  const location = useLocation();
  const { user } = useAuth();
  const tier = getCurrentTier(user);
  const isSignedIn = Boolean(user);
  const showPricingLink = tier === 'guest' || tier === 'free';
  const showLandingFineprint = location?.pathname === '/';
  const year = new Date().getFullYear();

  return (
    <footer className="footer" role="contentinfo">
      <div className="footer-inner">
        <div className="footer-brand">
          <div className="footer-logo">⏱️ 1 Minute Academy</div>
          <div className="footer-tagline">One minute. One idea.</div>
        </div>

        <nav className="footer-nav" aria-label="Footer navigation">
          <div className="footer-col">
            <div className="footer-colTitle">Explore</div>
            <div className="footer-colLinks">
              <Link className="footer-colLink" to="/categories">Categories</Link>
              <Link className="footer-colLink" to="/reviews">Reviews</Link>
            </div>
          </div>

          <div className="footer-col">
            <div className="footer-colTitle">Product</div>
            <div className="footer-colLinks">
              {showPricingLink ? <Link className="footer-colLink" to="/pricing">Pricing</Link> : null}
              <Link className="footer-colLink" to="/faq">FAQ</Link>
            </div>
          </div>

          <div className="footer-col">
            <div className="footer-colTitle">Support</div>
            <div className="footer-colLinks">
              {isSignedIn ? <Link className="footer-colLink" to="/me">Profile</Link> : null}
              <a className="footer-colLink" href={`mailto:${SUPPORT_EMAIL}`}>Contact</a>
            </div>
          </div>

          <div className="footer-col">
            <div className="footer-colTitle">Legal</div>
            <div className="footer-colLinks">
              <Link className="footer-colLink" to="/terms">Terms</Link>
              <Link className="footer-colLink" to="/privacy">Privacy</Link>
              <Link className="footer-colLink" to="/cookies">Cookies</Link>
            </div>
          </div>
        </nav>

        <div className="footer-meta">
          <div className="footer-copy">© {year} One Minute Academy</div>
          {showLandingFineprint ? (
            <div className="footer-fineprint">Made for people who hate long landing pages.</div>
          ) : null}
        </div>
      </div>
    </footer>
  );
}
