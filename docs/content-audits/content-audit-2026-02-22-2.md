# Beat Audit Report

> Generated 2026-02-21T23:27:07.672Z
> Scanned **3616** topic files — found **38** issues across **30** files.
> Output: `docs/content-audits/content-audit-2026-02-22-2.md`

## Summary by severity

| Severity | Count |
|----------|------:|
| high | 4 |
| medium | 14 |
| low | 20 |

## Summary by issue type

| Check | Severity | Count |
|-------|----------|------:|
| lowercase-start | low | 11 |
| markup-artifacts | medium | 9 |
| repeated-punct | low | 7 |
| template-placeholders | medium | 4 |
| unbalanced-ascii-quotes | high | 3 |
| too-short | low | 2 |
| near-duplicate | medium | 1 |
| unbalanced-parens | high | 1 |

## Detailed findings

### Define the Agent’s Job in One Sentence

**File:** `content/topics/ai/ai--agent-builder-lab/ai--agent-builder-lab--ch01-foundations/ai--agent-builder-lab--t-define-the-agent-s-job-in-one-sentence.topic.json`

- **medium / markup-artifacts** — Beat "discovery" may contain JSON/HTML artifacts: "Write: “Help the user {verb} {object} using {tools}, within "
- **medium / template-placeholders** — Beat "discovery" may contain template placeholders: "Write: “Help the user {verb} {object} using {tools}, within {limits}.”"

### Prompt as Contract, Not Vibes

**File:** `content/topics/ai/ai--agent-builder-lab/ai--agent-builder-lab--ch02-contracts-and-tools/ai--agent-builder-lab--t-prompt-as-contract-not-vibes.topic.json`

- **low / too-short** — Beat "punchline" is only 18 chars: "Vibes don’t parse."

### Regression Tests for Prompts

**File:** `content/topics/ai/ai--agent-builder-lab/ai--agent-builder-lab--ch06-reliability/ai--agent-builder-lab--t-regression-tests-for-prompts.topic.json`

- **low / too-short** — Beat "punchline" is only 19 chars: "Prompts deserve CI."

### Structured Output: JSON, XML, and Schemas

**File:** `content/topics/ai/ai--generative-ai/ai--generative-ai--ch02-text/ai--generative-ai--t-structured-output-json-xml-and-schemas.topic.json`

- **medium / markup-artifacts** — Beat "hook" may contain JSON/HTML artifacts: "You need valid JSON. The model returns: {name: 'Alice'—missi"

### Delimiters: Separating Instructions from Data

**File:** `content/topics/ai/ai--prompt-engineering/ai--prompt-engineering--ch02-techniques/ai--prompt-engineering--t-delimiters-separating-instructions-from-data.topic.json`

- **medium / markup-artifacts** — Beat "climax" may contain JSON/HTML artifacts: "Wrap user input in tags: <user_input>…</user_input>. Referen"

### Getting Structured JSON Output

**File:** `content/topics/ai/ai--prompt-engineering/ai--prompt-engineering--ch04-formats/ai--prompt-engineering--t-getting-structured-json-output.topic.json`

- **medium / markup-artifacts** — Beat "discovery" may contain JSON/HTML artifacts: "Say: 'Respond with valid JSON only. No explanation. Use this"

### XML Tags for Structured Prompts

**File:** `content/topics/ai/ai--prompt-engineering/ai--prompt-engineering--ch04-formats/ai--prompt-engineering--t-xml-tags-for-structured-prompts.topic.json`

- **medium / markup-artifacts** — Beat "buildup" may contain JSON/HTML artifacts: "XML tags let you name sections: <instructions>, <context>, <"
- **medium / markup-artifacts** — Beat "climax" may contain JSON/HTML artifacts: "Ask the model to reply inside tags too: 'Put your answer ins"

### Dynamic Prompts with Template Variables

**File:** `content/topics/ai/ai--prompt-engineering/ai--prompt-engineering--ch06-advanced/ai--prompt-engineering--t-dynamic-prompts-with-template-variables.topic.json`

- **medium / markup-artifacts** — Beat "buildup" may contain JSON/HTML artifacts: "Template variables let you inject dynamic values: {user_name"
- **medium / template-placeholders** — Beat "buildup" may contain template placeholders: "Template variables let you inject dynamic values: {user_name}, {language}, {task"

### Toulouse-Lautrec and the Art of the Poster

**File:** `content/topics/art/art--art-history-highlights/art--art-history-highlights--ch04-impressionism-and-post/art--art-history-highlights--t-toulouse-lautrec-and-the-art-of-the-poster.topic.json`

- **high / unbalanced-ascii-quotes** — Beat "hook" has an odd number of ASCII quotes (").

### Brand Positioning: Owning a Space in the Mind

**File:** `content/topics/art/art--branding-and-visual-identity/art--branding-and-visual-identity--ch01-brand-foundations/art--branding-and-visual-identity--t-brand-positioning-owning-a-space-in-the-mind.topic.json`

- **medium / markup-artifacts** — Beat "climax" may contain JSON/HTML artifacts: "The positioning statement formula: For [audience]."
- **medium / template-placeholders** — Beat "climax" may contain template placeholders: "The positioning statement formula: For [audience]."

### Web Fonts: Typography Goes Online

**File:** `content/topics/art/art--typography-essentials/art--typography-essentials--ch05-digital-type/art--typography-essentials--t-web-fonts-typography-goes-online.topic.json`

- **low / lowercase-start** — Beat "climax" starts with lowercase: "font-display: swap tells the browser to …"

### Marketplace Business Models

**File:** `content/topics/business/business--innovation-and-disruption/business--innovation-and-disruption--ch04-business-models/business--innovation-and-disruption--t-marketplace-business-models.topic.json`

- **low / lowercase-start** — Beat "hook" starts with lowercase: "eBay connects 135 million buyers and sel…"

### Brand Loyalty: Beyond Rational Choice

**File:** `content/topics/business/business--marketing-psychology/business--marketing-psychology--ch04-brand/business--marketing-psychology--t-brand-loyalty-beyond-rational-choice.topic.json`

- **low / lowercase-start** — Beat "discovery" starts with lowercase: "fMRI scans show that knowing you're drin…"

### The Elevator Pitch Formula

**File:** `content/topics/career/career--personal-branding/career--personal-branding--ch03-storytelling-and-positioning/career--personal-branding--t-the-elevator-pitch-formula.topic.json`

- **medium / markup-artifacts** — Beat "discovery" may contain JSON/HTML artifacts: "The formula: 'I help [audience] achieve [outcome] by [method"
- **medium / template-placeholders** — Beat "discovery" may contain template placeholders: "The formula: 'I help [audience] achieve [outcome] by [method].' Problem-focused,"

### Ferran Adrià and the Birth of Molecular Gastronomy

**File:** `content/topics/cooking/cooking--great-chefs-and-culinary-revolutions/cooking--great-chefs-and-culinary-revolutions--ch03-molecular-gastronomy/cooking--great-chefs-and-culinary-revolutions--t-ferran-adri-and-the-birth-of-molecular-gastronomy.topic.json`

- **low / lowercase-start** — Beat "twist" starts with lowercase: "elBulli received 2 million reservation r…"

### Science Fiction: Exploring 'What If?' to Its Limit

**File:** `content/topics/creativity/creativity--creative-writing-secrets/creativity--creative-writing-secrets--ch05-genres-and-their-secrets/creativity--creative-writing-secrets--t-science-fiction-exploring-what-if-to-its-limit.topic.json`

- **medium / near-duplicate** — Beats "hook" and "punchline" start with the same 40 chars — possible copy-paste.

### John Cage's 4'33": The Most Creative Silence in History

**File:** `content/topics/creativity/creativity--creativity-in-music/creativity--creativity-in-music--ch02-revolutionary-compositions/creativity--creativity-in-music--t-john-cage-s-4-33-the-most-creative-silence-in-history.topic.json`

- **high / unbalanced-ascii-quotes** — Beat "buildup" has an odd number of ASCII quotes (").
- **high / unbalanced-ascii-quotes** — Beat "climax" has an odd number of ASCII quotes (").

### Default Mode Network: Your Brain's Idea Factory

**File:** `content/topics/creativity/creativity--the-science-of-creativity/creativity--the-science-of-creativity--ch01-how-the-brain-creates/creativity--the-science-of-creativity--t-default-mode-network-your-brain-s-idea-factory.topic.json`

- **low / lowercase-start** — Beat "climax" starts with lowercase: "fMRI scans show the DMN is most active d…"

### Steelmanning: Making the Strongest Version of the Other Side

**File:** `content/topics/critical-thinking/critical-thinking--argumentation-and-debate/critical-thinking--argumentation-and-debate--ch02-building-strong-arguments/critical-thinking--argumentation-and-debate--t-steelmanning-making-the-strongest-version-of-the-other-side.topic.json`

- **high / unbalanced-parens** — Beat "discovery" has 0 "(" vs 2 ")" — possible truncation.

### The Whistleblower's Dilemma: Snowden, Manning, and Reality Winner

**File:** `content/topics/cybersecurity/cybersecurity--cybersecurity-law-and-ethics/cybersecurity--cybersecurity-law-and-ethics--ch03-ethical-hacking-and-disclosure/cybersecurity--cybersecurity-law-and-ethics--t-the-whistleblower-s-dilemma-snowden-manning-and-reality-winner.topic.json`

- **low / repeated-punct** — Beat "twist" ends with repeated punctuation: "…n prison.."

### Free Speech vs. Cybersecurity: Where's the Line?

**File:** `content/topics/cybersecurity/cybersecurity--cybersecurity-law-and-ethics/cybersecurity--cybersecurity-law-and-ethics--ch04-digital-rights-and-freedoms/cybersecurity--cybersecurity-law-and-ethics--t-free-speech-vs-cybersecurity-where-s-the-line.topic.json`

- **low / repeated-punct** — Beat "buildup" ends with repeated punctuation: "… details.."

### Cyber Insurance: Transferring Digital Risk

**File:** `content/topics/cybersecurity/cybersecurity--cybersecurity-law-and-ethics/cybersecurity--cybersecurity-law-and-ethics--ch05-cyber-law-in-action/cybersecurity--cybersecurity-law-and-ethics--t-cyber-insurance-transferring-digital-risk.topic.json`

- **low / repeated-punct** — Beat "hook" ends with repeated punctuation: "…lawsuits.."
- **low / repeated-punct** — Beat "twist" ends with repeated punctuation: "…clusion).."

### Quantum Computing and Crypto Law: Preparing for Q-Day

**File:** `content/topics/cybersecurity/cybersecurity--cybersecurity-law-and-ethics/cybersecurity--cybersecurity-law-and-ethics--ch06-the-future-of-cyber-governance/cybersecurity--cybersecurity-law-and-ethics--t-quantum-computing-and-crypto-law-preparing-for-q-day.topic.json`

- **low / repeated-punct** — Beat "hook" ends with repeated punctuation: "…readable.."

### Behavioral Biometrics: How You Type Reveals Who You Are

**File:** `content/topics/cybersecurity/cybersecurity--identity-and-authentication/cybersecurity--identity-and-authentication--ch03-biometric-security/cybersecurity--identity-and-authentication--t-behavioral-biometrics-how-you-type-reveals-who-you-are.topic.json`

- **low / repeated-punct** — Beat "twist" ends with repeated punctuation: "…e rhythm.."

### Ransomware-as-a-Service: Crime Made Easy

**File:** `content/topics/cybersecurity/cybersecurity--the-dark-web-and-cybercrime/cybersecurity--the-dark-web-and-cybercrime--ch03-the-ransomware-economy/cybersecurity--the-dark-web-and-cybercrime--t-ransomware-as-a-service-crime-made-easy.topic.json`

- **low / repeated-punct** — Beat "buildup" ends with repeated punctuation: "…services.."

### p-Hacking: Torturing Data Until It Confesses

**File:** `content/topics/data/data--misleading-data-and-statistical-traps/data--misleading-data-and-statistical-traps--ch04-research-gone-wrong/data--misleading-data-and-statistical-traps--t-p-hacking-torturing-data-until-it-confesses.topic.json`

- **low / lowercase-start** — Beat "buildup" starts with lowercase: "p-hacking means trying many analyses unt…"
- **low / lowercase-start** — Beat "climax" starts with lowercase: "p-hacking is a major cause of the replic…"

### Citizen Science: Everyone's a Data Collector

**File:** `content/topics/data/data--open-data-and-transparency/data--open-data-and-transparency--ch04-scientific-openness/data--open-data-and-transparency--t-citizen-science-everyone-s-a-data-collector.topic.json`

- **low / lowercase-start** — Beat "discovery" starts with lowercase: "iNaturalist has collected over 150 milli…"

### The Replication Crisis: When Studies Don't Reproduce

**File:** `content/topics/data/data--statistics-that-changed-the-world/data--statistics-that-changed-the-world--ch06-modern-statistical-thinking/data--statistics-that-changed-the-world--t-the-replication-crisis-when-studies-don-t-reproduce.topic.json`

- **low / lowercase-start** — Beat "discovery" starts with lowercase: "p-hacking, small samples, and publicatio…"

### Thomas Piketty: Capital in the Twenty-First Century

**File:** `content/topics/economics/economics--great-economists-and-their-ideas/economics--great-economists-and-their-ideas--ch05-modern-innovators/economics--great-economists-and-their-ideas--t-thomas-piketty-capital-in-the-twenty-first-century.topic.json`

- **low / lowercase-start** — Beat "punchline" starts with lowercase: "r > g: two letters that explain why the …"

### Piketty's r > g: Capital Eats the Economy

**File:** `content/topics/economics/economics--the-economics-of-inequality/economics--the-economics-of-inequality--ch03-wealth-and-power/economics--the-economics-of-inequality--t-piketty-s-r-g-capital-eats-the-economy.topic.json`

- **low / lowercase-start** — Beat "climax" starts with lowercase: "r > g means capitalism, left alone, prod…"
