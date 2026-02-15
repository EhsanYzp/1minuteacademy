import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import Header from '../components/Header';
import Seo from '../components/Seo';
import './FaqPage.css';

const SUPPORT_EMAIL = import.meta.env.VITE_SUPPORT_EMAIL || 'support@1minute.academy';

function FaqItem({ q, children, defaultOpen = false }) {
  return (
    <details className="faq-item" open={defaultOpen}>
      <summary className="faq-q">{q}</summary>
      <div className="faq-a">{children}</div>
    </details>
  );
}

export default function FaqPage() {
  return (
    <motion.div className="faq-page" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <Seo title="FAQ" description="Quick answers about 1 Minute Academy." path="/faq" canonicalPath="/faq" />
      <Header />

      <main className="faq-main">
        <section className="faq-card">
          <Link className="page-back" to="/">← Home</Link>
          <div className="faq-hero">
            <div className="faq-emoji" aria-hidden="true">❓</div>
            <div>
              <h1 className="faq-title">FAQ</h1>
              <p className="faq-sub">Quick answers about how 1 Minute Academy works.</p>
            </div>
          </div>

          <div className="faq-grid">
            <FaqItem q="Is every lesson really 60 seconds?" defaultOpen>
              <p>
                Yes — lessons run on a strict 60-second timer with no pause. The goal is focus and momentum.
                After you finish, you can review calmly.
              </p>
            </FaqItem>

            <FaqItem q="What are the tiers (Guest / Free / Pro)?">
              <ul>
                <li><strong>Guest:</strong> Beginner topics only, no progress tracking.</li>
                <li><strong>Free account:</strong> Beginner topics + progress tracking (sign in required).</li>
                <li><strong>Pro:</strong> All topics + review mode.</li>
              </ul>
              <p>
                See the full comparison on the Pricing page.
              </p>
            </FaqItem>

            <FaqItem q="What is Minute Expert?">
              <p>
                <strong>Minute Expert</strong> is your minutes expertise level.
                On <strong>Pro</strong>, every time you finish a one-minute module, you earn <strong>+1 expert minute</strong>.
                Example: finish 60 modules → you’re a <strong>60-minute Expert</strong>.
              </p>
            </FaqItem>

            <FaqItem q="How do I earn expert minutes and badges?">
              <p>
                On <strong>Pro</strong>, each completed module adds <strong>+1</strong> to your expert minutes.
                As your expert minutes grow, you unlock badges at milestones (like <strong>1</strong>, <strong>10</strong>, <strong>60</strong>, and beyond).
              </p>
            </FaqItem>

            <FaqItem q="Why are some topics locked?">
              <p>
                Some topics are locked based on difficulty:
              </p>
              <ul>
                <li><strong>Intermediate/Advanced:</strong> Pro-only.</li>
                <li><strong>Premium:</strong> Pro-only.</li>
              </ul>
            </FaqItem>

            <FaqItem q="Can I review a lesson after the timer ends?">
              <p>
                Yes. Everyone gets an end-of-lesson recap, and Pro also unlocks dedicated Review mode.
              </p>
            </FaqItem>


            <FaqItem q="How does progress tracking work?">
              <p>
                If you’re signed in, we save which topics you’ve completed and your progress stats.
                Guests can still learn, but progress isn’t synced.
              </p>
            </FaqItem>

            <FaqItem q="What is a streak?">
              <p>
                Your <strong>streak</strong> is the number of consecutive days you’ve completed at least one module.
                Completing multiple modules in the same day won’t increase the streak beyond that day.
              </p>
            </FaqItem>

            <FaqItem q="Can I rate modules?">
              <p>
                Yes — ratings are available when you’re signed in. On module pages you can leave a star rating and change it anytime.
              </p>
            </FaqItem>

            <FaqItem q="Are payments live?">
              <p>
                Yes. Pro subscriptions are available via Stripe Checkout. After you subscribe, Pro features unlock
                automatically for your account.
              </p>
            </FaqItem>

            <FaqItem q="How do I cancel or manage my Pro subscription?">
              <p>
                If you’re Pro, open your <strong>Profile</strong> page and use the subscription management button.
                It takes you to the Stripe Customer Portal where you can cancel, update payment method, and view invoices.
              </p>
            </FaqItem>

            <FaqItem q="What does “Account paused” mean?">
              <p>
                If your account is paused, Pro features are temporarily disabled until you resume.
                You can manage this from your Profile.
              </p>
            </FaqItem>


            <FaqItem q="How can I contact you?">
              <p>
                Email us at <a className="faq-link" href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>.
              </p>
            </FaqItem>
          </div>

          <div className="faq-foot">
            <div className="faq-foot-note">Still stuck? Send a message and we’ll help.</div>
            <a className="faq-cta" href={`mailto:${SUPPORT_EMAIL}`}>Contact support</a>
          </div>
        </section>
      </main>
    </motion.div>
  );
}
