import { motion } from 'framer-motion';
import Header from '../components/Header';
import './LegalPage.css';

const SUPPORT_EMAIL = import.meta.env.VITE_SUPPORT_EMAIL || 'support@oneminuteacademy.com';

export default function PrivacyPage() {
  return (
    <motion.div className="legal-page" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <Header />

      <main className="legal-main">
        <section className="legal-card">
          <h1 className="legal-title">Privacy Policy</h1>
          <div className="legal-updated">Last updated: Feb 4, 2026</div>

          <div className="legal-summary">
            This policy explains what data we collect, why we collect it, and how you can contact us.
            We aim to collect the minimum needed to run the app (auth + progress).
          </div>

          <h2>What we collect</h2>
          <ul>
            <li><strong>Account data:</strong> if you sign in, we store your login identity (e.g. email) via our auth provider.</li>
            <li><strong>Learning progress:</strong> topics you started/completed and basic progress stats.</li>
            <li><strong>Takeaways (Pro):</strong> saved takeaways derived from lesson summaries (if enabled for your plan).</li>
            <li><strong>Basic technical data:</strong> approximate device/browser information needed for security and reliability.</li>
          </ul>

          <h2>What we do not sell</h2>
          <p>We do not sell your personal information.</p>

          <h2>Cookies & local storage</h2>
          <p>
            We may use cookies/local storage for authentication sessions, app preferences, and to keep you signed in.
            In developer builds, we may store a local tier override for testing.
          </p>

          <h2>How we use data</h2>
          <ul>
            <li>To provide the service (run lessons, sync progress).</li>
            <li>To improve reliability and prevent abuse.</li>
            <li>To provide plan-specific features (e.g. saved takeaways for Pro).</li>
          </ul>

          <h2>Data retention</h2>
          <p>We retain data for as long as your account is active or as needed to provide the service and comply with legal obligations.</p>

          <h2>Your choices</h2>
          <ul>
            <li>You can sign out at any time.</li>
            <li>You can request account deletion by contacting us.</li>
          </ul>

          <h2>Contact</h2>
          <p>
            Questions or requests: <a className="legal-inline-link" href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>
          </p>

          <p className="legal-note">
            This is a general policy and may be updated as we add payments and additional features.
          </p>
        </section>
      </main>
    </motion.div>
  );
}
