import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getCurrentTier } from '../services/entitlements';
import './Footer.css';

const SUPPORT_EMAIL = import.meta.env.VITE_SUPPORT_EMAIL || 'support@1minute.academy';
const X_URL = 'https://x.com/1MinuteAcademy';

function EmailIcon(props) {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" focusable="false" {...props}>
      <path
        fill="currentColor"
        d="M20 4H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2Zm0 4.2-8 5.1-8-5.1V6l8 5.1L20 6v2.2Z"
      />
    </svg>
  );
}

function XIcon(props) {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" focusable="false" {...props}>
      <path
        fill="currentColor"
        d="M18.9 2H22l-6.8 7.8L23 22h-6.7l-5.3-6.7L5.2 22H2l7.3-8.4L1 2h6.9l4.8 6.1L18.9 2Zm-1.2 18h1.7L6.9 3.9H5.1L17.7 20Z"
      />
    </svg>
  );
}

export default function Footer() {
  const location = useLocation();
  const { user } = useAuth();
  const tier = getCurrentTier(user);
  const showPricingLink = tier === 'guest' || tier === 'free';
  const showLandingFineprint = location?.pathname === '/';
  const year = new Date().getFullYear();

  return (
    <footer className="footer" role="contentinfo">
      <div className="footer-inner">
        <div className="footer-brand">
          <div className="footer-logo">
            <img className="footer-logoIcon" src="/logo-1ma.svg" alt="" aria-hidden="true" draggable={false} />
            <span>1 Minute Academy</span>
          </div>
          <div className="footer-tagline">One minute. One idea.</div>

          <div className="footer-contact" aria-label="Contact">
            <a className="footer-iconLink" href={`mailto:${SUPPORT_EMAIL}`} aria-label="Email 1 Minute Academy">
              <EmailIcon />
            </a>
            <a
              className="footer-iconLink"
              href={X_URL}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Visit 1 Minute Academy on X"
            >
              <XIcon />
            </a>
          </div>
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
