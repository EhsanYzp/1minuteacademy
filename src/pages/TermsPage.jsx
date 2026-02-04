import { motion } from 'framer-motion';
import Header from '../components/Header';
import './LegalPage.css';

const SUPPORT_EMAIL = import.meta.env.VITE_SUPPORT_EMAIL || 'support@oneminuteacademy.com';

export default function TermsPage() {
  return (
    <motion.div className="legal-page" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <Header />

      <main className="legal-main">
        <section className="legal-card">
          <h1 className="legal-title">Terms of Service</h1>
          <div className="legal-updated">Last updated: Feb 4, 2026</div>

          <div className="legal-summary">
            By using 1MinuteAcademy, you agree to these Terms. If you do not agree, do not use the app.
          </div>

          <h2>The service</h2>
          <p>
            1MinuteAcademy provides short, interactive lessons. Lessons are for educational purposes only and are not professional advice.
          </p>

          <h2>Accounts</h2>
          <ul>
            <li>You may need an account to access features like progress sync.</li>
            <li>You are responsible for maintaining the security of your account.</li>
          </ul>

          <h2>Plans & access</h2>
          <p>
            We may offer multiple tiers (e.g., Guest, Free account, Pro). Feature access depends on your plan.
            Payment integration may be introduced later; until then, Pro access may be managed via account metadata.
          </p>

          <h2>Acceptable use</h2>
          <ul>
            <li>Do not abuse the service, attempt to bypass paywalls, or disrupt other users.</li>
            <li>Do not attempt to reverse engineer or scrape private endpoints.</li>
          </ul>

          <h2>Availability</h2>
          <p>
            We strive for high availability, but the service is provided “as is” and may be interrupted for maintenance or updates.
          </p>

          <h2>Changes</h2>
          <p>
            We may update these Terms from time to time. Continued use after updates means you accept the revised Terms.
          </p>

          <h2>Contact</h2>
          <p>
            Questions: <a className="legal-inline-link" href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>
          </p>

          <p className="legal-note">
            These Terms are provided for general informational purposes and may not cover every scenario.
          </p>
        </section>
      </main>
    </motion.div>
  );
}
