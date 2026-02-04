import { Link } from 'react-router-dom';
import './Footer.css';

const SUPPORT_EMAIL = import.meta.env.VITE_SUPPORT_EMAIL || 'support@oneminuteacademy.com';

export default function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="footer" role="contentinfo">
      <div className="footer-inner">
        <div className="footer-brand">
          <div className="footer-logo">⏱️ 1MinuteAcademy</div>
          <div className="footer-tagline">One focused minute at a time.</div>
        </div>

        <nav className="footer-links" aria-label="Footer">
          <Link className="footer-link" to="/topics">Browse</Link>
          <Link className="footer-link" to="/pricing">Pricing</Link>
          <Link className="footer-link" to="/privacy">Privacy</Link>
          <Link className="footer-link" to="/terms">Terms</Link>
          <Link className="footer-link" to="/cookies">Cookies</Link>
          <a className="footer-link" href={`mailto:${SUPPORT_EMAIL}`}>Contact</a>
        </nav>

        <div className="footer-meta">
          <div className="footer-copy">© {year} 1MinuteAcademy</div>
          <div className="footer-fineprint">Pro payments are coming soon. Until then, access is managed via your account plan.</div>
        </div>
      </div>
    </footer>
  );
}
