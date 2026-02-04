import { motion } from 'framer-motion';
import Header from '../components/Header';
import './FaqPage.css';

const SUPPORT_EMAIL = import.meta.env.VITE_SUPPORT_EMAIL || 'support@oneminuteacademy.com';

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
      <Header />

      <main className="faq-main">
        <section className="faq-card">
          <div className="faq-hero">
            <div className="faq-emoji" aria-hidden="true">❓</div>
            <div>
              <h1 className="faq-title">FAQ</h1>
              <p className="faq-sub">Quick answers about how 1MinuteAcademy works.</p>
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
                <li><strong>Pro:</strong> All topics + review mode + saved takeaways.</li>
              </ul>
              <p>
                See the full comparison on the Pricing page.
              </p>
            </FaqItem>

            <FaqItem q="Why are some topics locked?">
              <p>
                Topics above <strong>Beginner</strong> are Pro-only. We use the topic’s difficulty to determine access.
              </p>
            </FaqItem>

            <FaqItem q="Can I review a lesson after the timer ends?">
              <p>
                Yes. Everyone gets an end-of-lesson recap, and Pro also unlocks dedicated Review mode.
              </p>
            </FaqItem>

            <FaqItem q="Do you save my takeaways?">
              <p>
                Takeaways are derived from each lesson’s Summary step. Saved takeaways are a Pro feature.
              </p>
            </FaqItem>

            <FaqItem q="How does progress tracking work?">
              <p>
                If you’re signed in, we save which topics you’ve completed and your progress stats.
                Guests can still learn, but progress isn’t synced.
              </p>
            </FaqItem>

            <FaqItem q="Are payments live?">
              <p>
                Not yet. The Pro checkout buttons are labeled “coming soon”. Once payments are wired (Stripe),
                Pro access will be enabled automatically for subscribers.
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
