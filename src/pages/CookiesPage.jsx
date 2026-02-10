import { motion } from 'framer-motion';
import Header from '../components/Header';
import Seo from '../components/Seo';
import './LegalPage.css';

export default function CookiesPage() {
  return (
    <motion.div className="legal-page" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <Seo title="Cookie Policy" description="Cookie policy for 1 Minute Academy." path="/cookies" canonicalPath="/cookies" />
      <Header />

      <main className="legal-main">
        <section className="legal-card">
          <h1 className="legal-title">Cookie Policy</h1>
          <div className="legal-updated">Last updated: Feb 4, 2026</div>

          <div className="legal-summary">
            We use cookies and local storage primarily for authentication sessions and core app functionality.
          </div>

          <h2>What we use</h2>
          <ul>
            <li><strong>Essential cookies:</strong> keep you signed in and protect the service.</li>
            <li><strong>Local storage:</strong> remember lightweight preferences (e.g., UI state). In developer builds, it may also store a tier override for testing.</li>
          </ul>

          <h2>Analytics</h2>
          <p>
            If we add analytics in the future, we will update this page and provide controls where required.
          </p>

          <h2>How to control cookies</h2>
          <p>
            You can manage cookies through your browser settings. Blocking essential cookies may prevent sign-in or progress syncing.
          </p>
        </section>
      </main>
    </motion.div>
  );
}
