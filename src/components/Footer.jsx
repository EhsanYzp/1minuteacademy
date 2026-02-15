import { Link } from 'react-router-dom';
import './Footer.css';

const SUPPORT_EMAIL = import.meta.env.VITE_SUPPORT_EMAIL || 'support@1minute.academy';

export default function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="footer" role="contentinfo">
      <div className="footer-inner">
        <div className="footer-brand">
          <div className="footer-logo">⏱️ 1 Minute Academy</div>
          <div className="footer-tagline">One minute. One idea.</div>
        </div>

        <nav className="footer-links" aria-label="Footer">
          <Link className="footer-link" to="/pricing">Pricing</Link>
          <Link className="footer-link" to="/faq">FAQ</Link>
          <Link className="footer-link" to="/reviews">Reviews</Link>
          <Link className="footer-link" to="/terms">Terms</Link>
          <Link className="footer-link" to="/privacy">Privacy</Link>
          <a className="footer-link" href={`mailto:${SUPPORT_EMAIL}`}>Support</a>
        </nav>

        <div className="footer-meta">
          <div className="footer-copy">© {year} 1 Minute Academy</div>
          <div className="footer-fineprint">Made for people who hate long landing pages.</div>
        </div>
      </div>
    </footer>
  );
}
