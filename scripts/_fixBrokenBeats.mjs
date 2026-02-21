#!/usr/bin/env node
/**
 * _fixBrokenBeats.mjs
 *
 * Reads /tmp/broken-beats.json (produced by _extractBrokenBeats.mjs),
 * applies human-written rewrites to the course-plan JSON files,
 * validates every rewrite before writing, then saves.
 *
 * Usage:  node scripts/_fixBrokenBeats.mjs [--dry-run]
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const PLANS_DIR = join(ROOT, 'content', 'course-plans');
const DRY_RUN = process.argv.includes('--dry-run');

/* ── Validation constants (mirrored from validateContent.mjs) ────── */
const BEAT_MAX = { hook: 120, buildup: 120, discovery: 120, twist: 120, climax: 120, punchline: 80 };
const VALID_ENDINGS = new Set(['.', '!', '?', ')', "'", '"', ':', ';', '\u2019', '\u201D']);

function detectIssues(text, beat) {
  const issues = [];
  const lastChar = text[text.length - 1];
  if (!VALID_ENDINGS.has(lastChar)) issues.push('bad-ending');
  if (text.length > BEAT_MAX[beat]) issues.push(`over-limit(${text.length}/${BEAT_MAX[beat]})`);
  const tail10 = text.slice(-10);
  if (tail10.includes('\u2026') || tail10.includes('...')) issues.push('ellipsis');
  if (text.length >= 2 && text[text.length - 2] === ' ') issues.push('space-before-punct');
  const opens  = (text.match(/[\u201C(]/g) || []).length;
  const closes = (text.match(/[\u201D)]/g) || []).length;
  if (opens > closes) issues.push('unbalanced');
  const articleEnding = /\b(the|a|an|than)\s*[.!?;:\u201D"')]+$/i;
  if (articleEnding.test(text)) issues.push('article-ending');
  return issues;
}

/* ── Fix map: "file|topicTitle|beat" → newText ──────────────────── */
const FIXES = new Map([

  // ═══════════════════════════════════════════════════════════════════
  // ELLIPSIS fixes (6)
  // ═══════════════════════════════════════════════════════════════════

  [`ai--prompt-engineering.json|Getting Structured JSON Output|discovery`,
   `Say: 'Respond with valid JSON only. No explanation. Use this exact schema: {key: type}.'`],

  [`communication--persuasion-and-influence.json|The Door-in-the-Face Technique|hook`,
   `'Volunteer every weekend for two years?' No way. 'How about just this Saturday?' That sounds fair.`],

  [`communication--psychology-of-listening.json|Empathy vs. Sympathy in Listening|discovery`,
   `Brené Brown: sympathy drives disconnection by minimizing pain. Empathy creates connection by being present.`],

  [`communication--psychology-of-listening.json|Listening Without Fixing|buildup`,
   `Many listeners jump to advice: 'Have you tried this?' or 'You should do that.' This blocks real connection.`],

  [`communication--storytelling.json|The Story Spine: Pixar's Secret|buildup`,
   `The Story Spine follows a template: once upon a time, every day, until one day, because of that, until finally.`],

  [`critical-thinking--great-thinkers-and-their-methods.json|Ibn al-Haytham: The First True Scientist|twist`,
   `He openly challenged ancient authorities, insisting that truth comes from reason and experimentation, not old texts.`],

  // ═══════════════════════════════════════════════════════════════════
  // SPACE-BEFORE-PUNCT fixes (7) — auto-trimmed below, but listed for
  // completeness.  The script auto-handles these; entries here are
  // overridden only if you want a DIFFERENT rewrite.
  // ═══════════════════════════════════════════════════════════════════
  // (handled automatically — see the auto-fix loop in main())

  // ═══════════════════════════════════════════════════════════════════
  // UNBALANCED fixes (20)
  // ═══════════════════════════════════════════════════════════════════

  [`art--psychology-of-design.json|Dark Patterns: Design That Deceives|discovery`,
   `Dark patterns include confirm-shaming, hidden costs, trick questions, and roach motels (easy to enter, hard to leave).`],

  [`business--financial-literacy.json|Capital Gains Tax: Selling Winners|climax`,
   `Billionaires 'buy, borrow, die': hold assets (no tax), borrow against them (no income), heirs inherit (stepped-up basis).`],

  [`business--leadership-principles.json|Situational Leadership Theory|discovery`,
   `Four styles: directing (low skill), coaching (growing skill), supporting (high skill, low will), delegating (both high).`],

  [`communication--body-language.json|High-Contact vs. Low-Contact Cultures|buildup`,
   `Hall classified cultures as 'high-contact' (Latin America, Middle East) or 'low-contact' (East Asia, Northern Europe).`],

  [`communication--cross-cultural-communication.json|Silence: The Language That Speaks Volumes|buildup`,
   `Silence means different things: respect (Japan), discomfort (US), contemplation (Finland), agreement (Arab cultures).`],

  [`communication--cross-cultural-communication.json|Time Orientation: Clock vs. Event|buildup`,
   `Hall distinguished monochronic time (linear, scheduled, sequential) from polychronic time (flexible, relationship-driven).`],

  [`communication--cross-cultural-communication.json|Cultural Intelligence (CQ): The Skill of Adaptation|buildup`,
   `CQ has four dimensions: Drive (motivation), Knowledge (understanding), Strategy (planning), Action (adapting behavior).`],

  [`communication--emotional-intelligence.json|Internal vs. External Self-Awareness|climax`,
   `Eurich found that 'what' questions ('What am I feeling?') beat 'why' questions — 'why' traps us in ruminative loops.`],

  [`communication--rhetoric-and-logic.json|Legal Rhetoric: Arguing in the Courtroom|buildup`,
   `Legal rhetoric is classical rhetoric: ethos (credibility), pathos (jury emotion), and logos (evidence and logic).`],

  [`creativity--comedy-and-the-art-of-humor.json|Humor Across Cultures: Why Some Jokes Don't Translate|hook`,
   `Germans love slapstick. British prefer dry wit. Japanese love 'manzai' (a duo comedy with a straight man and funny man).`],

  [`creativity--creativity-myths-debunked.json|Creativity Declines with Age: A Myth the Data Destroys|discovery`,
   `Galenson found two types of geniuses: conceptual (peak young, like Picasso) and experimental (peak late, like Cézanne).`],

  [`creativity--design-thinking-and-innovation.json|Platform Thinking: How Networks Create Value|climax`,
   `Seven of ten top companies are platforms — shifted from pipeline (make and sell) to platform (connect and enable).`],

  [`critical-thinking--great-thinkers-and-their-methods.json|John Stuart Mill: The Harm Principle and Free Thought|discovery`,
   `'On Liberty': silencing any opinion is wrong — true or false. Suppressing it destroys your ability to defend truth.`],

  [`critical-thinking--great-thinkers-and-their-methods.json|Bertrand Russell: Logic, Skepticism, and Clear Thinking|twist`,
   `He showed even math has paradoxes (does the set of all sets that don't contain themselves contain itself?).`],

  [`cybersecurity--network-security-fundamentals.json|Bluetooth Attacks: Hacking Through Your Headphones|buildup`,
   `Bluetooth flaws include BlueBorne (remote takeover), KNOB (key negotiation attack), and BlueSmack (denial of service).`],

  [`data--the-future-of-data.json|Synthetic Data: When Real Data Isn't Enough|discovery`,
   `It solves privacy (no real people), bias (you control the distribution), and scarcity (generate unlimited samples).`],

  [`economics--behavioral-economics.json|Loss Aversion: Losses Hurt Twice as Much as Gains Feel Good|discovery`,
   `Investors hold losers too long (avoiding the pain of loss) and sell winners too early (locking in gains).`],

  [`economics--the-economics-of-everyday-life.json|The Economics of Tipping: A System Nobody Designed|discovery`,
   `The real economics: tipping lets restaurants pay below minimum wage ($2.13/hr in some U.S. states) and shift labor costs.`],

  [`economics--the-economics-of-technology.json|AI and the Future of Work: Complement or Replacement?|buildup`,
   `Will AI complement human work (making workers more productive) or substitute it (replacing workers entirely)?`],

  // ═══════════════════════════════════════════════════════════════════
  // ARTICLE-ENDING fixes (111)
  // ═══════════════════════════════════════════════════════════════════

  // ── business ──────────────────────────────────────────────────────

  [`business--financial-literacy.json|Index Funds: Beating the Experts by Not Trying|discovery`,
   `Index funds charge 0.03% fees vs. active funds at 1%+. That tiny gap compounds to hundreds of thousands over a lifetime.`],

  [`business--innovation-and-disruption.json|Subscription Economy: From Ownership to Access|climax`,
   `The subscription economy grew 435% in a decade. Software, razors, even cars — everything is now a recurring payment.`],

  [`business--startup-fundamentals.json|The Series A Crunch|hook`,
   `Thousands of startups raise seed funding each year. Only a fraction survive to raise their Series A round.`],

  [`business--supply-chain-essentials.json|The Bullwhip Effect|discovery`,
   `Each link in the chain overreacts. Safety stock, batch ordering, and forecasting errors all amplify the distortion.`],

  // ── career ────────────────────────────────────────────────────────

  [`career--burnout-and-balance.json|The Power of Active Recovery|discovery`,
   `Sonnentag's research: mastery, control, or social connection activities restore energy far better than passive rest.`],

  [`career--career-transitions.json|The First 90 Days in a New Career|punchline`,
   `The first 90 days aren't about proving yourself. They're about learning the game.`],

  // ── communication ─────────────────────────────────────────────────

  [`communication--cross-cultural-communication.json|Ethnocentrism: The Default Bias|climax`,
   `Moving from ethnocentrism to ethnorelativism — appreciating other cultural logics — is a process, not a switch to flip.`],

  [`communication--cross-cultural-communication.json|Global Virtual Teams: The New Frontier|twist`,
   `Technology doesn't eliminate cultural difference. It amplifies it — digital communication strips away vital context cues.`],

  [`communication--emotional-intelligence.json|Triggers: Your Emotional Buttons|twist`,
   `Knowing your triggers is the first step to disarming them. If you predict your reaction, you can choose a better response.`],

  [`communication--emotional-intelligence.json|The Marshmallow Test Revisited|twist`,
   `Recent replications showed environment matters. Kids from unstable backgrounds had good reason not to trust the promise.`],

  [`communication--media-literacy.json|Inoculation Theory: Vaccines for the Mind|punchline`,
   `The best defense against misinformation is a small dose of it, plus the antidote.`],

  [`communication--psychology-of-listening.json|How the Brain Processes Speech|punchline`,
   `Your brain outpaces speech. Discipline that speed, and you become a master.`],

  [`communication--psychology-of-listening.json|The Cocktail Party Effect|discovery`,
   `Your auditory system uses pitch, location, and timing to separate sound streams — like untangling threads in a tapestry.`],

  [`communication--psychology-of-listening.json|Emotional Triggers: When Feelings Block Hearing|buildup`,
   `Emotional triggers activate the amygdala, flooding the brain with cortisol and adrenaline — hijacking the thinking mind.`],

  [`communication--psychology-of-listening.json|Emotional Triggers: When Feelings Block Hearing|climax`,
   `The technique: name the emotion ('I'm feeling defensive'). Naming activates the prefrontal cortex and calms the amygdala.`],

  [`communication--psychology-of-listening.json|Asking Powerful Questions|discovery`,
   `The best questions are curious, not leading. They explore the speaker's world rather than steering toward your own answer.`],

  [`communication--psychology-of-listening.json|Listening as Connection: The Thread That Binds|climax`,
   `Every relationship — romantic, professional, friendship — is only as deep as your ability to truly hear the other person.`],

  [`communication--rhetoric-and-logic.json|Kairos: The Art of Perfect Timing|climax`,
   `Kairos can't be fully planned — it requires reading the room, sensing the moment, and having courage to seize the opening.`],

  [`communication--rhetoric-and-logic.json|Burden of Proof: Who Must Prove What?|buildup`,
   `Burden of proof lies with the claimant. The more extraordinary the claim, the more extraordinary the evidence must be.`],

  [`communication--rhetoric-and-logic.json|Slippery Slope: The Domino That Never Falls|buildup`,
   `Slippery slope argues one action will inevitably cause a chain of negative consequences, without proving the connection.`],

  [`communication--rhetoric-and-logic.json|Dialectic: Thesis, Antithesis, Synthesis|hook`,
   `Hegel proposed that ideas evolve through conflict. A thesis meets its antithesis, and their collision creates synthesis.`],

  [`communication--rhetoric-and-logic.json|Rhetoric of Science: How Researchers Persuade|hook`,
   `Scientists claim objectivity. But every research paper is an argument — structured to persuade reviewers the findings matter.`],

  [`communication--storytelling.json|Suspense vs. Surprise: Hitchcock's Lesson|climax`,
   `Hitchcock's principle: give the audience information. The anticipation of what will happen is more powerful than the shock.`],

  // ── creativity ────────────────────────────────────────────────────

  [`creativity--comedy-and-the-art-of-humor.json|The Neuroscience of Funny: Your Brain on Comedy|buildup`,
   `Brain scans show jokes activate two regions: the logical left hemisphere (understanding) and the reward center (pleasure).`],

  [`creativity--comedy-and-the-art-of-humor.json|Tickling: Why You Can't Tickle Yourself|buildup`,
   `Tickling needs unpredictability. The cerebellum tracks your movements and mutes self-generated sensations — a safety filter.`],

  [`creativity--comedy-and-the-art-of-humor.json|Comedic Timing: The Art of the Pause|buildup`,
   `Timing is the silence between words. It's when the audience's brain catches up, anticipates, and then gets hit by the twist.`],

  [`creativity--comedy-and-the-art-of-humor.json|Comedic Timing: The Art of the Pause|climax`,
   `Comedic timing can't be written. It lives in performance — the breath before the word, the look before the line, the pause.`],

  [`creativity--comedy-and-the-art-of-humor.json|Callback Humor: The Delayed Explosion|buildup`,
   `A callback references an earlier joke. It's comedy's compound interest — planting a seed early and harvesting laughs later.`],

  [`creativity--comedy-and-the-art-of-humor.json|Lucille Ball: The Woman Who Owned Television|twist`,
   `She wasn't just a performer. Desilu Productions — her company — produced Star Trek, Mission: Impossible, and more.`],

  [`creativity--comedy-and-the-art-of-humor.json|Tina Fey and the Second City: Improv as Comedy Training Ground|discovery`,
   `'Yes, and' is more than improv — it's a philosophy. Treat every idea as a gift to be expanded, not a threat to be blocked.`],

  [`creativity--comedy-and-the-art-of-humor.json|Dark Comedy: Laughing at What You Shouldn't|twist`,
   `Holocaust survivors used humor extensively. Viktor Frankl wrote that humor was 'the soul's weapon in the fight to survive.'`],

  [`creativity--creative-thinking-frameworks.json|Six Thinking Hats: Structured Perspective-Switching|discovery`,
   `Everyone wears the same hat at the same time. This eliminates ego battles — you're playing a role, not defending a position.`],

  [`creativity--creative-writing-secrets.json|Flaws Make Heroes: The Power of Imperfection|hook`,
   `Superman is boring. Batman is fascinating. The difference? Batman is broken — brokenness beats perfection every time.`],

  [`creativity--creative-writing-secrets.json|Conflict in Every Conversation: The Engine of Good Dialogue|hook`,
   `Two friends agreeing on dinner is boring. Two friends debating where to eat while hiding resentment — that's a real scene.`],

  [`creativity--creative-writing-secrets.json|Exposition Through Dialogue: The Info-Dump Problem|buildup`,
   `The challenge: readers need information. But characters shouldn't explain things they both already know for the reader's sake.`],

  [`creativity--creative-writing-secrets.json|Toni Morrison: Writing the World That Wasn't Written|buildup`,
   `She wrote the stories of Black American experience that mainstream publishing ignored — giving voice to the unheard.`],

  [`creativity--creative-writing-secrets.json|Agatha Christie: The Queen of Misdirection|buildup`,
   `She planted clues in plain sight but surrounded them with red herrings — false leads that felt more important than the truth.`],

  [`creativity--creative-writing-secrets.json|Romance: The Most Profitable Genre's Hidden Sophistication|buildup`,
   `Critics call it formulaic. But the 'formula' is structure: two protagonists, obstacles, emotional growth, and a clear arc.`],

  [`creativity--creative-writing-secrets.json|The Midnight Disease: Why Writers Can't Stop Writing|discovery`,
   `The drive to write shares neural circuitry with addiction — dopamine release during creative flow creates a compulsive loop.`],

  [`creativity--creativity-in-music.json|Electronic Music: When Machines Became Musicians|twist`,
   `Musicians feared machines would kill creativity. Instead, machines became creativity's most powerful instrument of expression.`],

  [`creativity--creativity-in-music.json|Music NFTs and Creator Economics: Who Owns Creativity?|discovery`,
   `Blockchain and direct-to-fan platforms let artists sell music directly — keeping 80–95% of revenue instead of the usual 12%.`],

  [`creativity--creativity-myths-debunked.json|Mozart the 'Natural Genius': A Manufactured Legend|punchline`,
   `Mozart wasn't born a genius. He was trained into one — harder than anyone else.`],

  [`creativity--creativity-myths-debunked.json|The Eureka Myth: Breakthroughs Don't Happen in Bathtubs|discovery`,
   `Real breakthroughs are messy, gradual, and collaborative. Darwin's evolution idea developed over 20+ years, not in a flash.`],

  [`creativity--creativity-myths-debunked.json|The 10% Brain Myth: You Already Use It All|buildup`,
   `The myth likely started with William James saying we use a 'fraction' of mental potential — a metaphor twisted into fact.`],

  [`creativity--creativity-myths-debunked.json|Originality Doesn't Exist: Everything Is a Remix|twist`,
   `Demanding 'originality' paralyzes creators. Accepting that all creation is recombination frees you to stop waiting and start.`],

  [`creativity--design-thinking-and-innovation.json|The Double Diamond: Diverge, Converge, Repeat|hook`,
   `The British Design Council mapped how designers work: two diamonds — first find the right problem, then the right solution.`],

  [`creativity--design-thinking-and-innovation.json|AI-Assisted Design: When Algorithms Become Co-Creators|discovery`,
   `AI generates forms no human would imagine — organic, asymmetric, seemingly random — but mathematically optimal for the task.`],

  [`creativity--design-thinking-and-innovation.json|Ethical Design: When Innovation Must Say 'No'|hook`,
   `Instagram's infinite scroll was designed to be addictive. Its creators now admit this was a design choice — not an accident.`],

  [`creativity--the-business-of-creativity.json|Apple's Design-Led Strategy: How Aesthetics Beat Specs|buildup`,
   `Steve Jobs made design Apple's core strategy — not a department that prettified engineering's work, but the driving force.`],

  [`creativity--the-business-of-creativity.json|Apple's Design-Led Strategy: How Aesthetics Beat Specs|discovery`,
   `Jony Ive's design team had veto power over engineering. If a component made the product ugly, engineering found a new way.`],

  [`creativity--the-business-of-creativity.json|Licensing: Making Money While You Sleep|punchline`,
   `Create once, earn forever. That's the promise of licensing — and why IP is gold.`],

  [`creativity--the-psychology-of-imagination.json|Motor Imagery: Moving Without Moving|buildup`,
   `Motor imagery — mentally rehearsing physical movements — activates the premotor and supplementary motor areas of the brain.`],

  // ── critical-thinking ─────────────────────────────────────────────

  [`critical-thinking--argumentation-and-debate.json|The Socratic Method: Destroying Arguments with Questions|discovery`,
   `The pattern: 'What do you mean by X?' 'How do you know that?' 'What if the opposite were true?' 'Can you give an example?'`],

  [`critical-thinking--argumentation-and-debate.json|Moving the Goalposts: When Nothing Will Satisfy|climax`,
   `If they can't name any evidence that would change their mind, they're not reasoning — they're defending a fixed belief.`],

  [`critical-thinking--evidence-and-truth.json|Anecdotes vs. Data: The Battle for Truth|discovery`,
   `Our brains weight anecdotes more heavily due to the availability heuristic — stories are easier to recall than statistics.`],

  [`critical-thinking--fallacies-flawed-arguments-exposed.json|What Is a Logical Fallacy?|buildup`,
   `A logical fallacy is a flaw in reasoning that undermines an argument's logic — regardless of whether the conclusion is true.`],

  [`critical-thinking--fallacies-flawed-arguments-exposed.json|Begging the Question: Circular Reasoning|buildup`,
   `Begging the question: the conclusion is hidden in the premises. It's circular reasoning — using your claim to prove itself.`],

  [`critical-thinking--fallacies-flawed-arguments-exposed.json|Slippery Slope: The Domino That Never Falls|hook`,
   `'Allow calculators in class and soon they'll forget math and civilization collapses!' Quite the leap in logic.`],

  [`critical-thinking--media-literacy-and-information-warfare.json|Filter Bubbles: The Internet That Agrees with You|buildup`,
   `Pariser coined 'filter bubble' in 2011: algorithms curate content based on your past behavior, creating a sealed worldview.`],

  [`critical-thinking--media-literacy-and-information-warfare.json|Astroturfing: Manufacturing Grassroots Movements|buildup`,
   `Astroturfing: creating the appearance of grassroots support for a position actually manufactured by a hidden interest group.`],

  [`critical-thinking--media-literacy-and-information-warfare.json|Following the Money: Who Funds the Message?|discovery`,
   `A systematic review found that industry-funded studies were 4x more likely to report favorable results than independent ones.`],

  [`critical-thinking--the-psychology-of-belief.json|Cognitive Dissonance: The Pain of Contradictory Beliefs|climax`,
   `Cults exploit this: once you invest effort, money, or reputation, your mind protects the investment by deepening the belief.`],

  [`critical-thinking--the-psychology-of-belief.json|Magical Thinking: Rituals, Luck, and Invisible Forces|buildup`,
   `Magical thinking: believing your thoughts, words, or symbolic actions can influence physical reality without a causal link.`],

  // ── cybersecurity ─────────────────────────────────────────────────

  [`cybersecurity--anatomy-of-cyber-attacks.json|Vulnerability Scanning: Finding the Weak Spots|climax`,
   `Companies with thousands of unpatched vulnerabilities are the norm. Prioritizing which to fix first is the real challenge.`],

  [`cybersecurity--anatomy-of-cyber-attacks.json|Buffer Overflow: Crashing Your Way In|discovery`,
   `By overwriting the return address, attackers redirect execution to their own code. The program unknowingly obeys the attacker.`],

  [`cybersecurity--anatomy-of-cyber-attacks.json|Trojans: Malware in Disguise|buildup`,
   `A Trojan horse disguises itself as legitimate software. Users willingly install it, not knowing it carries a hidden payload.`],

  [`cybersecurity--anatomy-of-cyber-attacks.json|SQL Injection: Hacking with a Search Box|climax`,
   `Heartland Payment Systems lost 130 million credit cards to SQL injection. The fix? Parameterized queries — a simple defense.`],

  [`cybersecurity--cryptography-secrets-and-ciphers.json|Hash Functions: Digital Fingerprints|buildup`,
   `A hash function takes any input and produces a fixed-size fingerprint. Even a tiny change creates a wildly different output.`],

  [`cybersecurity--cyber-warfare-and-digital-espionage.json|Hospital Ransomware: When Cyber Attacks Turn Deadly|twist`,
   `The attackers may have targeted the university, not the hospital. They provided decryption keys when told a patient had died.`],

  [`cybersecurity--cyber-warfare-and-digital-espionage.json|Water Treatment Hacking: Poisoning from a Keyboard|buildup`,
   `The Oldsmar water treatment plant used TeamViewer for remote access. An attacker logged in and changed the chemical levels.`],

  [`cybersecurity--cyber-warfare-and-digital-espionage.json|The Tallinn Manual: Rules of Cyber War|twist`,
   `Most cyber operations fall below that threshold. Espionage, disruption, and influence operations remain in a legal gray zone.`],

  [`cybersecurity--cybersecurity-law-and-ethics.json|Data Breach Notification Laws: The Clock Is Ticking|twist`,
   `Uber hid a 2016 breach affecting 57 million users for over a year. They paid hackers $100,000 to delete the stolen data.`],

  [`cybersecurity--cybersecurity-law-and-ethics.json|The Encryption Debate: Backdoors vs. Privacy|hook`,
   `The FBI wanted Apple to unlock a terrorist's iPhone. Apple refused: a backdoor for one phone is a backdoor for every phone.`],

  [`cybersecurity--cybersecurity-law-and-ethics.json|The Encryption Debate: Backdoors vs. Privacy|twist`,
   `The FBI eventually cracked the iPhone without Apple's help — paying a third-party firm over $1 million. The debate rages on.`],

  [`cybersecurity--identity-and-authentication.json|TOTP: Time-Based One-Time Passwords|buildup`,
   `TOTP uses a shared secret and current time to generate codes. Your phone and the server independently compute the same result.`],

  [`cybersecurity--identity-and-authentication.json|MFA Fatigue: Bombarding Users Into Approval|climax`,
   `Push-based MFA without number matching is vulnerable. 'Was this you?' must become 'Enter the number shown on screen.'`],

  [`cybersecurity--identity-and-authentication.json|Iris and Retina Scanning: The Most Unique Biometric|buildup`,
   `Iris scanning photographs the colored ring around your pupil. Retina scanning maps blood vessels at the back of the eye.`],

  [`cybersecurity--identity-and-authentication.json|Single Sign-On: One Login for Everything|buildup`,
   `SSO lets users authenticate once and access multiple services. SAML and OAuth protocols handle the trust exchange securely.`],

  [`cybersecurity--identity-and-authentication.json|Identity Federation: Trust Across Organizations|buildup`,
   `Federation lets organizations trust each other's identity providers. Your employer vouches for you, and the partner accepts it.`],

  [`cybersecurity--identity-and-authentication.json|Identity Federation: Trust Across Organizations|twist`,
   `The 2020 SolarWinds attack forged SAML tokens to impersonate trusted users. Federation's trust chain became the weapon itself.`],

  [`cybersecurity--identity-and-authentication.json|SIM Swapping: Stealing Your Phone Number|buildup`,
   `SIM swapping exploits carrier customer service. Attackers use personal info to impersonate you and request a number transfer.`],

  [`cybersecurity--identity-and-authentication.json|Session Hijacking: Stealing Your Login Without a Password|discovery`,
   `Session hijacking steals tokens via XSS attacks, packet sniffing, or malware. No password needed — the stolen token is enough.`],

  [`cybersecurity--identity-and-authentication.json|Passkeys: The End of Passwords?|twist`,
   `Passkeys are domain-bound — they only work on the real website. A phishing page can't trigger your passkey for the real site.`],

  [`cybersecurity--identity-and-authentication.json|Passkeys: The End of Passwords?|climax`,
   `Passkeys eliminate the three biggest password problems: reuse, phishing, and breach-exposed credentials. The future is keyless.`],

  [`cybersecurity--identity-and-authentication.json|Decentralized Identity: Owning Your Digital Self|buildup`,
   `Decentralized identity (DID) uses blockchain or distributed ledgers. You hold verifiable credentials in a digital wallet.`],

  [`cybersecurity--identity-and-authentication.json|Zero-Knowledge Proofs: Proving Without Revealing|discovery`,
   `The 'Ali Baba cave' analogy: prove you know the magic word by emerging from the correct side — without ever revealing it.`],

  [`cybersecurity--network-security-fundamentals.json|IP Addresses: Your Digital Home Address|twist`,
   `IP geolocation databases can pinpoint your city. In 2016, a mapping error directed all 'unknown' U.S. IPs to a Kansas farm.`],

  [`cybersecurity--network-security-fundamentals.json|DNS Poisoning: Corrupting the Internet's Address Book|twist`,
   `Dan Kaminsky secretly coordinated with every major DNS vendor to patch the flaw before going public. A rare industry-wide fix.`],

  [`cybersecurity--network-security-fundamentals.json|BGP Hijacking: Rerouting the Internet Itself|twist`,
   `Pakistan accidentally knocked YouTube offline worldwide in 2008 while trying to block it domestically — a BGP routing mistake.`],

  [`cybersecurity--network-security-fundamentals.json|SIEM: The Security Nerve Center|discovery`,
   `A SIEM might connect a failed login in New York, a successful login in Moscow, and a file download to spot an active breach.`],

  [`cybersecurity--network-security-fundamentals.json|Honeypots: Traps for Hackers|twist`,
   `Project Honey Pot tracked spammers by publishing unique email addresses on web pages. When spammed, the source was revealed.`],

  [`cybersecurity--network-security-fundamentals.json|Network Forensics: Reconstructing the Crime Scene|climax`,
   `Network forensics is like a security camera for your network — but only useful if it was recording when the breach happened.`],

  [`cybersecurity--privacy-in-the-digital-age.json|Tor and the Onion Network: Real Anonymity Online|buildup`,
   `Tor routes traffic through three encrypted relays. Each relay only knows the previous and next hop — never the full path.`],

  [`cybersecurity--privacy-in-the-digital-age.json|Metadata Surveillance: Hidden Traces in Every Click|discovery`,
   `Former NSA director Michael Hayden admitted: 'We kill people based on metadata.' It reveals patterns more than content does.`],

  [`cybersecurity--social-engineering-the-human-hack.json|Deepfake Impersonation: AI-Powered Social Engineering|discovery`,
   `AI voice cloning has been used to impersonate CEOs, ordering urgent wire transfers that sound exactly like the real person.`],

  [`cybersecurity--social-engineering-the-human-hack.json|Deepfake Impersonation: AI-Powered Social Engineering|twist`,
   `The 2024 Hong Kong case used a full deepfake video conference — multiple fake participants fooled the target into wiring $25M.`],

  [`cybersecurity--the-dark-web-and-cybercrime.json|Surface, Deep, and Dark: The Three Layers of the Internet|discovery`,
   `The deep web is mostly mundane: medical records, academic databases, and corporate intranets. The dark web is a tiny subset.`],

  [`cybersecurity--the-dark-web-and-cybercrime.json|I2P and Freenet: Alternatives to Tor|discovery`,
   `I2P is optimized for internal services. Freenet is designed for censorship-resistant publishing. Each has a unique strength.`],

  [`cybersecurity--the-dark-web-and-cybercrime.json|Double Extortion: Pay Twice or Else|climax`,
   `Backups no longer defeat ransomware. When data theft is the real threat, the only defense is preventing the initial breach.`],

  [`cybersecurity--the-dark-web-and-cybercrime.json|The Ransomware Negotiator: Bargaining With Criminals|twist`,
   `Some negotiate in multiple languages at 3 AM while attackers set deadlines. It's hostage negotiation for the digital age.`],

  [`cybersecurity--the-dark-web-and-cybercrime.json|Cryptocurrency Mixers: Laundering Digital Money|buildup`,
   `Cryptocurrency mixers (tumblers) combine coins from multiple users, making it nearly impossible to trace the original source.`],

  [`cybersecurity--the-dark-web-and-cybercrime.json|Cryptocurrency Mixers: Laundering Digital Money|twist`,
   `The U.S. sanctioned Tornado Cash in 2022 — the first smart contract ever sanctioned. Using it became a criminal act overnight.`],

  [`cybersecurity--the-dark-web-and-cybercrime.json|Takedowns and Whack-a-Mole: Can You Kill the Dark Web?|twist`,
   `The biggest impact of takedowns isn't the arrest — it's the paranoia. Users never know if the next market is a police sting.`],

  // ── data ──────────────────────────────────────────────────────────

  [`data--open-data-and-transparency.json|Data Colonialism: When Open Data Extracts Value|twist`,
   `Some developing nations now restrict data exports, arguing that open data disproportionately benefits the already powerful.`],

  [`data--the-evolution-of-databases.json|Stored Procedures: Code Inside the Database|hook`,
   `Instead of sending 10 queries from your app to the database, you can send one command that runs all 10 inside the database.`],

  // ── economics ─────────────────────────────────────────────────────

  [`economics--development-economics.json|Corruption: The Tax on the Poor|punchline`,
   `Corruption isn't cultural. It thrives where institutions let power go unchecked.`],

  [`economics--development-economics.json|Malaria and Poverty: A Vicious Cycle|punchline`,
   `A $2 bed net saves a life. The math of poverty is cruel but the fixes are cheap.`],

  [`economics--development-economics.json|Foreign Direct Investment: Double-Edged Capital|twist`,
   `FDI can create 'enclave economies': foreign factories linked to global supply chains but disconnected from local markets.`],

  [`economics--economic-crises-that-shook-the-world.json|The Dot-Com Bust: When the Internet Bubble Burst|punchline`,
   `The internet changed everything. That didn't make every internet company viable.`],

  [`economics--global-trade-and-globalization.json|The Opium Wars: When Free Trade Meant Forced Drugs|climax`,
   `The Opium Wars reveal trade's dark side: 'free trade' has often been imposed by force on weaker nations for imperial profit.`],

  [`economics--global-trade-and-globalization.json|The Corn Laws: Britain's Great Free Trade Debate|punchline`,
   `It took a famine to prove cheap food mattered more than landlord wealth.`],

]);

/* ── Main ───────────────────────────────────────────────────────── */
function main() {
  const broken = JSON.parse(readFileSync('/tmp/broken-beats.json', 'utf8'));
  const fileCache = new Map();   // file → parsed plan JSON
  let fixed = 0;
  let failed = 0;
  const failures = [];

  for (const b of broken) {
    const key = `${b.file}|${b.topicTitle}|${b.beat}`;

    // ── Auto-fix: space-before-punct → just remove the trailing space ──
    let newText = FIXES.get(key);
    if (!newText && b.issues === 'space-before-punct') {
      // Remove the space just before the final punctuation character
      newText = b.text.slice(0, -2) + b.text.slice(-1);
    }

    if (!newText) {
      console.error(`❌ NO FIX for: ${key}`);
      failures.push(key);
      failed++;
      continue;
    }

    // ── Validate the new text ──────────────────────────────────────
    const issues = detectIssues(newText, b.beat);
    if (issues.length > 0) {
      console.error(`❌ FIX STILL HAS ISSUES: ${key} → [${issues.join(', ')}]`);
      console.error(`   New text (${newText.length} chars): "${newText}"`);
      failures.push(key);
      failed++;
      continue;
    }

    // ── Load plan (once per file) ──────────────────────────────────
    if (!fileCache.has(b.file)) {
      const filePath = join(PLANS_DIR, b.file);
      fileCache.set(b.file, JSON.parse(readFileSync(filePath, 'utf8')));
    }
    const plan = fileCache.get(b.file);

    // ── Find topic and verify old text matches ─────────────────────
    const topic = plan.topics.find(t => t.title === b.topicTitle);
    if (!topic) {
      console.error(`❌ TOPIC NOT FOUND: "${b.topicTitle}" in ${b.file}`);
      failures.push(key);
      failed++;
      continue;
    }

    const oldText = topic.story[b.beat]?.text;
    if (oldText !== b.text) {
      console.error(`❌ TEXT MISMATCH: ${key}`);
      console.error(`   Expected: "${b.text}"`);
      console.error(`   Found:    "${oldText}"`);
      failures.push(key);
      failed++;
      continue;
    }

    // ── Apply the fix ──────────────────────────────────────────────
    topic.story[b.beat].text = newText;
    fixed++;
    console.log(`✅ ${key}`);
  }

  // ── Write updated course plans ───────────────────────────────────
  if (!DRY_RUN) {
    for (const [file, plan] of fileCache) {
      const filePath = join(PLANS_DIR, file);
      writeFileSync(filePath, JSON.stringify(plan, null, 2) + '\n');
      console.log(`📝 Written: ${file}`);
    }
  } else {
    console.log(`\n🔍 DRY RUN — no files written.`);
  }

  console.log(`\n━━━ Results ━━━`);
  console.log(`Fixed:  ${fixed}`);
  console.log(`Failed: ${failed}`);
  console.log(`Total:  ${broken.length}`);

  if (failures.length > 0) {
    console.log(`\nFailed entries:`);
    failures.forEach(f => console.log(`  • ${f}`));
  }

  if (failed > 0) process.exit(1);
}

main();
