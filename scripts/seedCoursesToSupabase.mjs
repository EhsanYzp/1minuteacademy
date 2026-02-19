import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

function parseEnvNameFromArgv(argv) {
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--env') {
      const v = argv[i + 1];
      if (!v || v.startsWith('--')) return null;
      return String(v).trim();
    }
  }
  return null;
}

function normalizeEnvName(raw) {
  const v = String(raw ?? '').trim().toLowerCase();
  if (!v) return null;
  if (v === 'prod') return 'production';
  return v;
}

function loadDotenv(envName) {
  const loaded = [];
  const load = (p) => {
    const res = dotenv.config({ path: p });
    if (!res.error) loaded.push(p);
  };

  load('.env');
  load('.env.local');
  if (envName) {
    load(`.env.${envName}`);
    load(`.env.${envName}.local`);
  }

  const present = (name) => (process.env[name] ? 'present' : 'missing');
  const envLabel = envName ? `--env ${envName}` : '(no --env)';
  console.log(`[content:seed-courses] dotenv loaded (${envLabel}): ${loaded.length ? loaded.join(', ') : '(none found)'}`);
  console.log(
    `[content:seed-courses] env check: ` +
      [
        `SUPABASE_URL=${present('SUPABASE_URL')}`,
        `VITE_SUPABASE_URL=${present('VITE_SUPABASE_URL')}`,
        `SUPABASE_SERVICE_ROLE_KEY=${present('SUPABASE_SERVICE_ROLE_KEY')}`,
        `VITE_SUPABASE_SERVICE_ROLE_KEY=${present('VITE_SUPABASE_SERVICE_ROLE_KEY')}`,
      ].join(' ')
  );
}

const requestedEnv = normalizeEnvName(parseEnvNameFromArgv(process.argv.slice(2)));
loadDotenv(requestedEnv);

function requiredEnvAny(names) {
  for (const name of names) {
    const v = process.env[name];
    if (v) return v;
  }
  const envFileHint = requestedEnv ? `.env.${requestedEnv}.local` : '.env.local';
  throw new Error(`Missing env var: ${names.join(' or ')} (set it in ${envFileHint} or export it in your shell)`);
}

function requiredEnv(name) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env var: ${name}`);
  return v;
}

function forbidEnv(name) {
  const v = process.env[name];
  if (v) {
    throw new Error(
      `Refusing to run: ${name} is set. Never expose the service role key in any VITE_ variable (it would be bundled into the browser). Use SUPABASE_SERVICE_ROLE_KEY instead.`
    );
  }
}

function parseArgs(argv) {
  const args = {
    dryRun: false,
    forceUpdate: false,
    minPerCategory: 6,
    maxPerCategory: 15,
    prune: false,
  };

  const parseRange = (raw) => {
    const s = String(raw ?? '').trim();
    const m = s.match(/^\s*(\d+)\s*(?:\-|\.\.)\s*(\d+)\s*$/);
    if (!m) return null;
    return { min: Number(m[1]), max: Number(m[2]) };
  };

  const validateMinMax = () => {
    const min = Number(args.minPerCategory);
    const max = Number(args.maxPerCategory);
    if (!Number.isFinite(min) || !Number.isFinite(max)) throw new Error('Invalid per-category range');
    if (min < 6 || max > 15 || min > max) throw new Error('Invalid per-category range (must be within 6..15 and min<=max)');
    args.minPerCategory = Math.floor(min);
    args.maxPerCategory = Math.floor(max);
  };

  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--dry-run') args.dryRun = true;
    else if (a === '--force-update') args.forceUpdate = true;
    else if (a === '--prune') args.prune = true;
    else if (a === '--per-category') {
      const v = argv[i + 1];
      i++;
      const n = Number(v);
      if (!Number.isFinite(n) || n < 6 || n > 15) {
        throw new Error('Invalid --per-category (must be 6..15)');
      }
      args.minPerCategory = Math.floor(n);
      args.maxPerCategory = Math.floor(n);
    } else if (a === '--per-category-range') {
      const v = argv[i + 1];
      i++;
      const r = parseRange(v);
      if (!r) throw new Error('Invalid --per-category-range (expected e.g. 6-15 or 6..15)');
      args.minPerCategory = r.min;
      args.maxPerCategory = r.max;
      validateMinMax();
    } else if (a === '--min-per-category') {
      const v = argv[i + 1];
      i++;
      const n = Number(v);
      if (!Number.isFinite(n)) throw new Error('Invalid --min-per-category');
      args.minPerCategory = Math.floor(n);
      validateMinMax();
    } else if (a === '--max-per-category') {
      const v = argv[i + 1];
      i++;
      const n = Number(v);
      if (!Number.isFinite(n)) throw new Error('Invalid --max-per-category');
      args.maxPerCategory = Math.floor(n);
      validateMinMax();
    } else if (a === '--env') {
      i += 1; // handled earlier
    } else if (a === '--help' || a === '-h') {
      console.log(
        `\nUsage:\n  node scripts/seedCoursesToSupabase.mjs [--env staging|production] [--dry-run] [--force-update] [--per-category 6..15 | --per-category-range 6-15]\n\nDefaults:\n- Inserts missing courses only (does not overwrite)\n- Seeds a deterministic number of courses per category in the range 6..15\n\nFlags:\n- --dry-run                Print what would be written; no DB changes\n- --force-update           Upsert and overwrite existing ids\n- --per-category           Seed an exact N courses per category (6..15)\n- --per-category-range     Seed a deterministic N per category within a range (e.g. 6-15)\n- --min-per-category       Lower bound (6..15)\n- --max-per-category       Upper bound (6..15)\n- --prune                  Delete extra courses beyond the target for a category (DANGEROUS)\n\nNotes:\n- Course IDs are deterministic: <categoryId>--<courseSlug>\n- Course counts are deterministic per category id (no randomness).\n- Course color defaults to the category color when available.\n`
      );
      process.exit(0);
    } else {
      throw new Error(`Unknown arg: ${a}`);
    }
  }

  validateMinMax();

  return args;
}

function slugify(input) {
  return String(input ?? '')
    .trim()
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/--+/g, '-');
}

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

function fnv1a32(input) {
  const s = String(input ?? '');
  let hash = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    hash ^= s.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

function deterministicCountForCategory({ categoryId, min, max }) {
  const lo = clamp(Math.floor(min), 6, 15);
  const hi = clamp(Math.floor(max), 6, 15);
  if (lo > hi) throw new Error('Invalid per-category range');
  if (lo === hi) return lo;
  const span = hi - lo + 1;
  const h = fnv1a32(categoryId);
  return lo + (h % span);
}

function pickEmoji(courseTitle) {
  const t = String(courseTitle ?? '').toLowerCase();
  if (t.includes('basics') || t.includes('foundations') || t.includes('essentials')) return '📘';
  if (t.includes('advanced') || t.includes('mastery')) return '🧠';
  if (t.includes('strategy') || t.includes('strategies') || t.includes('playbook')) return '🗺️';
  if (t.includes('tools') || t.includes('systems') || t.includes('frameworks')) return '🛠️';
  if (t.includes('habits') || t.includes('routine')) return '🔁';
  if (t.includes('case') || t.includes('examples')) return '🧪';
  if (t.includes('legal') || t.includes('law') || t.includes('contracts')) return '⚖️';
  if (t.includes('health') || t.includes('sleep') || t.includes('fitness')) return '💪';
  return null;
}

function categorySpecificCourseTitles(title) {
  const key = String(title ?? '').trim();

  const map = {
    'Personal Finance': [
      'Budgeting & Cash Flow',
      'Debt & Credit',
      'Taxes 101',
      'Insurance Basics',
      'Retirement Planning',
      'Personal Finance Systems',
      'Money Psychology',
      'Big Purchases (Cars, Homes)',
      'Family Finance',
      'Financial Mistakes to Avoid',
      'Negotiating Bills & Rates',
      'Financial Independence (FI)',
    ],
    Investing: [
      'Index Funds & ETFs',
      'Stocks: Fundamentals',
      'Bonds & Fixed Income',
      'Portfolio Construction',
      'Risk & Volatility',
      'Behavioral Investing',
      'Valuation Basics',
      'Rebalancing & Asset Allocation',
      'Long-Term Compounding',
      'Investing Mistakes',
      'Tax-Advantaged Accounts',
      'Market Cycles & Drawdowns',
    ],
    'Real Estate': [
      'Rent vs Buy',
      'Mortgages & Rates',
      'Property Analysis',
      'Real Estate Investing 101',
      'Landlording Basics',
      'Negotiation & Offers',
      'Home Maintenance Essentials',
      'Renovation ROI',
      'Real Estate Taxes',
      'Common Deal Mistakes',
      'Commercial vs Residential',
      'Real Estate Market Dynamics',
    ],
    Entrepreneurship: [
      'Idea to Validation',
      'Finding Product-Market Fit',
      'Pricing & Monetization',
      'MVP Building',
      'Go-to-Market',
      'Sales for Founders',
      'Operations & Systems',
      'Hiring & Team',
      'Fundraising Basics',
      'Customer Support & Retention',
      'Founder Mindset',
      'Startup Mistakes',
    ],
    Business: [
      'Business Fundamentals',
      'Strategy & Competitive Advantage',
      'Operations & Execution',
      'Finance for Business',
      'Customer Research',
      'Building Moats',
      'Metrics & KPIs',
      'Business Models',
      'Decision Making',
      'Problem Solving',
      'Business Communication',
      'Case Studies',
    ],
    Leadership: [
      'Leadership Foundations',
      'Leading 1:1s',
      'Feedback & Coaching',
      'Managing Conflict',
      'Decision Making Under Uncertainty',
      'Culture & Values',
      'Hiring & Performance',
      'Stakeholder Management',
      'Leading Change',
      'Executive Presence',
      'Team Motivation',
      'Leadership Mistakes',
    ],
    Management: [
      'New Manager Bootcamp',
      'Setting Goals (OKRs)',
      'Project Execution',
      'Performance Reviews',
      'Delegation',
      'Meeting Discipline',
      'Team Systems',
      'Cross-Functional Work',
      'Managing Up',
      'Difficult Conversations',
      'Onboarding & Training',
      'Management Mistakes',
    ],
    Sales: [
      'Sales Fundamentals',
      'Prospecting',
      'Discovery Calls',
      'Objection Handling',
      'Negotiation & Closing',
      'Account Management',
      'Sales Funnels',
      'Cold Email & Outreach',
      'Sales Psychology',
      'Pricing Conversations',
      'Enterprise Sales Basics',
      'Sales Mistakes',
    ],
    Marketing: [
      'Positioning & Messaging',
      'Content Marketing',
      'SEO Basics',
      'Paid Ads Foundations',
      'Email Marketing',
      'Brand Building',
      'Analytics & Attribution',
      'Social Media Systems',
      'Growth Experiments',
      'Product Marketing',
      'Marketing Funnels',
      'Marketing Mistakes',
    ],
    Negotiation: [
      'Negotiation Fundamentals',
      'BATNA & Leverage',
      'Anchoring & Framing',
      'Difficult Negotiations',
      'Salary Negotiation',
      'Business Negotiation',
      'Negotiation Psychology',
      'Handling Ultimatums',
      'Common Tactics',
      'Win-Win Agreements',
      'Negotiation Mistakes',
      'Practice Drills',
    ],
    Career: [
      'Career Strategy',
      'Resume & LinkedIn',
      'Interviewing',
      'Networking Systems',
      'Salary Negotiation',
      'Career Switching',
      'High-Impact Work',
      'Managing Up',
      'Personal Branding',
      'Career Mistakes',
      'Promotion Playbook',
      'Workplace Communication',
    ],
    Communication: [
      'Clear Writing',
      'Difficult Conversations',
      'Active Listening',
      'Persuasion Basics',
      'Conflict Resolution',
      'Asking Better Questions',
      'Meeting Communication',
      'Nonverbal Signals',
      'Communication for Leaders',
      'Remote Communication',
      'Common Miscommunications',
      'Storytelling',
    ],
    Productivity: [
      'Productivity Foundations',
      'Time Management',
      'Focus & Deep Work',
      'Habit Systems',
      'Task Prioritization',
      'Planning Weekly',
      'Avoiding Burnout',
      'Productivity Tools',
      'Email & Inbox Control',
      'Meetings & Calendars',
      'Personal Systems',
      'Productivity Mistakes',
    ],
    Learning: [
      'How to Learn Faster',
      'Spaced Repetition',
      'Memory Techniques',
      'Note-Taking Systems',
      'Deliberate Practice',
      'Learning Projects',
      'Reading & Comprehension',
      'Skill Acquisition',
      'Learning Mindset',
      'Avoiding Plateaus',
      'Teaching to Learn',
      'Learning Mistakes',
    ],
    Writing: [
      'Writing Foundations',
      'Clarity & Structure',
      'Editing & Revision',
      'Persuasive Writing',
      'Writing Habits',
      'Short-Form Writing',
      'Long-Form Writing',
      'Storytelling for Writers',
      'Writing for Work',
      'Common Writing Mistakes',
      'Style & Voice',
      'Writing Prompts & Practice',
    ],
    'Public Speaking': [
      'Speaking Foundations',
      'Nerves & Confidence',
      'Storytelling on Stage',
      'Slide Design Basics',
      'Persuasive Presentations',
      'Delivery & Voice',
      'Body Language',
      'Q&A Handling',
      'Impromptu Speaking',
      'Speaking Practice Drills',
      'Common Speaking Mistakes',
      'Talk Structures',
    ],
    Creativity: [
      'Creative Foundations',
      'Idea Generation',
      'Creative Habits',
      'Constraints & Prompts',
      'Creative Projects',
      'Overcoming Blocks',
      'Critique & Iteration',
      'Collaboration',
      'Creative Tools',
      'Originality & Influence',
      'Creative Confidence',
      'Creativity Mistakes',
    ],
    'Critical Thinking': [
      'Reasoning Foundations',
      'Cognitive Biases',
      'Logic & Arguments',
      'Decision Making',
      'Probability Intuition',
      'Causal Thinking',
      'Scientific Thinking',
      'Debunking & Skepticism',
      'Mental Models',
      'Problem Framing',
      'Critical Thinking Drills',
      'Common Fallacies',
    ],
    Psychology: [
      'Psychology Foundations',
      'Motivation',
      'Habits & Behavior Change',
      'Social Psychology',
      'Emotions',
      'Cognitive Biases',
      'Personality',
      'Attachment & Relationships',
      'Mental Health Basics',
      'Therapy Concepts',
      'Psychology Myths',
      'Applied Psychology',
    ],
    'Mental Health': [
      'Mental Health Foundations',
      'Stress Management',
      'Anxiety Tools',
      'Depression Basics',
      'Mindfulness',
      'Emotional Regulation',
      'Boundaries',
      'Self-Compassion',
      'Therapy Literacy',
      'Habits for Wellbeing',
      'Mental Health Myths',
      'Helping Others',
    ],
    Relationships: [
      'Relationship Foundations',
      'Communication for Couples',
      'Conflict Repair',
      'Trust & Boundaries',
      'Love Languages (practical)',
      'Attachment Styles',
      'Dating Strategy',
      'Friendships',
      'Family Relationships',
      'Hard Conversations',
      'Relationship Mistakes',
      'Building Intimacy',
    ],
    Parenting: [
      'Parenting Foundations',
      'Toddlers: Practical Tools',
      'Kids: Behavior & Discipline',
      'Teens: Communication',
      'Emotional Coaching',
      'Routines & Systems',
      'School & Learning Support',
      'Parenting Stress',
      'Co-Parenting',
      'Healthy Boundaries',
      'Parenting Mistakes',
      'Family Culture',
    ],
    Education: [
      'Teaching Foundations',
      'Curriculum Design',
      'Assessment & Feedback',
      'Learning Science',
      'Classroom Management',
      'Online Education',
      'Equity & Inclusion',
      'Student Motivation',
      'Project-Based Learning',
      'EdTech Tools',
      'Education Policy Basics',
      'Teaching Mistakes',
    ],
    Philosophy: [
      'Philosophy Foundations',
      'Ethics & Moral Theories',
      'Stoicism (practical)',
      'Existentialism',
      'Logic & Argument',
      'Epistemology',
      'Philosophy of Mind',
      'Political Philosophy',
      'Philosophy of Science',
      'Great Thinkers',
      'Philosophy Debates',
      'Reading Philosophy',
    ],
    History: [
      'History Foundations',
      'Ancient World',
      'Medieval World',
      'Modern Era',
      'World Wars',
      'Cold War',
      'Economic History',
      'History Methods',
      'Primary Sources',
      'History Myths',
      'Turning Points',
      'Case Studies',
    ],
    Politics: [
      'Politics Foundations',
      'Political Systems',
      'Elections & Voting',
      'Policy Making',
      'Political Ideologies',
      'Media & Polarization',
      'Civic Literacy',
      'International Relations',
      'Political Economy',
      'Public Opinion',
      'Negotiation in Politics',
      'Political Mistakes',
    ],
    Economics: [
      'Microeconomics Basics',
      'Macroeconomics Basics',
      'Supply & Demand',
      'Markets & Incentives',
      'Game Theory Intuition',
      'Behavioral Economics',
      'Economic Indicators',
      'Monetary Policy',
      'Trade & Globalization',
      'Inequality & Growth',
      'Economics Myths',
      'Case Studies',
    ],
    Law: [
      'Law Foundations',
      'Contracts Basics',
      'Employment Law Basics',
      'IP (Copyright/Trademark)',
      'Business Law Essentials',
      'Liability & Risk',
      'Privacy Basics',
      'Negotiation & Disputes',
      'Legal Writing Basics',
      'Court System Overview',
      'Common Legal Mistakes',
      'Reading Legal Docs',
    ],
    Ethics: [
      'Ethics Foundations',
      'Moral Frameworks',
      'Ethics at Work',
      'AI & Tech Ethics',
      'Medical Ethics Basics',
      'Business Ethics',
      'Ethical Decision Making',
      'Fairness & Justice',
      'Integrity & Character',
      'Ethics Case Studies',
      'Ethics Debates',
      'Ethics Mistakes',
    ],
    'Religion & Spirituality': [
      'World Religions Overview',
      'Spiritual Practices',
      'Meditation Basics',
      'Rituals & Meaning',
      'Texts & Traditions',
      'Faith & Doubt',
      'Community & Belonging',
      'Ethics & Spirituality',
      'Religious History',
      'Interfaith Literacy',
      'Spiritual Wellbeing',
      'Common Misconceptions',
    ],
    'Physical Fitness': [
      'Fitness Foundations',
      'Strength Training',
      'Cardio & Endurance',
      'Mobility & Flexibility',
      'Workout Programming',
      'Injury Prevention',
      'Fitness Habits',
      'Nutrition for Fitness',
      'Recovery & Rest',
      'Tracking Progress',
      'Fitness Mistakes',
      'Home Workouts',
    ],
    Nutrition: [
      'Nutrition Foundations',
      'Macros & Calories',
      'Protein & Muscle',
      'Healthy Eating Systems',
      'Meal Planning',
      'Reading Labels',
      'Supplements Basics',
      'Nutrition for Performance',
      'Gut Health Basics',
      'Nutrition Myths',
      'Dieting Pitfalls',
      'Cooking for Nutrition',
    ],
    Sleep: [
      'Sleep Foundations',
      'Sleep Hygiene',
      'Circadian Rhythm',
      'Caffeine & Sleep',
      'Napping Strategy',
      'Stress & Sleep',
      'Insomnia Basics',
      'Sleep Tracking',
      'Recovery Sleep',
      'Sleep Myths',
      'Bedroom Setup',
      'Travel & Jet Lag',
    ],
    Medicine: [
      'Medicine Foundations',
      'How the Body Works',
      'Preventive Care',
      'Understanding Labs',
      'Common Conditions',
      'Medications Basics',
      'Medical Decision Making',
      'Healthcare Systems',
      'Asking Doctors Better Questions',
      'Medical Myths',
      'First Aid Basics',
      'Health Literacy',
    ],
    'Sexual Health': [
      'Sexual Health Foundations',
      'Consent & Communication',
      'STI Basics',
      'Contraception Basics',
      'Reproductive Health',
      'Sex & Relationships',
      'Body Literacy',
      'Myths & Misinformation',
      'Safety & Boundaries',
      'Pleasure & Wellbeing',
      'Health Checkups',
      'Talking About Sex',
    ],
    'Self-Care': [
      'Self-Care Foundations',
      'Stress Reset Tools',
      'Routine Building',
      'Boundaries & Saying No',
      'Digital Hygiene',
      'Mindfulness & Calm',
      'Rest & Recovery',
      'Journaling',
      'Self-Compassion',
      'Energy Management',
      'Self-Care Mistakes',
      'Sustainable Habits',
    ],
    Cooking: [
      'Kitchen Foundations',
      'Knife Skills',
      'Meal Prep Systems',
      'Healthy Cooking',
      'Flavor & Seasoning',
      'Cooking Techniques',
      'Baking Basics',
      'Global Cuisines',
      'Cooking on a Budget',
      'Food Safety',
      'Cooking Mistakes',
      'Quick Weeknight Meals',
    ],
    'Home & DIY': [
      'DIY Foundations',
      'Tools & Safety',
      'Home Maintenance',
      'Painting & Finishing',
      'Basic Plumbing',
      'Basic Electrical',
      'Furniture & Assembly',
      'Small Repairs',
      'Home Projects Planning',
      'Budgeting for DIY',
      'DIY Mistakes',
      'Renters DIY',
    ],
    Gardening: [
      'Gardening Foundations',
      'Soil & Compost',
      'Planting Basics',
      'Watering Systems',
      'Pests & Disease',
      'Vegetable Gardening',
      'Herbs & Indoor Plants',
      'Seasonal Gardening',
      'Pruning Basics',
      'Garden Design',
      'Gardening Mistakes',
      'Sustainable Gardening',
    ],
    Travel: [
      'Travel Foundations',
      'Planning & Itineraries',
      'Travel on a Budget',
      'Packing Systems',
      'Safety & Scams',
      'Flights & Points Basics',
      'Cultural Etiquette',
      'Solo Travel',
      'Family Travel',
      'Work Travel',
      'Travel Mistakes',
      'Jet Lag & Health',
    ],
    Art: [
      'Art Foundations',
      'Art History Essentials',
      'Color Theory',
      'Composition and Design',
      'Creative Process',
      'Digital Art Basics',
      'Drawing Fundamentals',
      'Illustration Techniques',
      'Painting Techniques',
      'Photography Basics',
      'Typography Fundamentals',
    ],
    Music: [
      'Music Foundations',
      'Rhythm & Timing',
      'Harmony Basics',
      'Melody Writing',
      'Practice Systems',
      'Ear Training',
      'Music Theory Essentials',
      'Songwriting',
      'Recording Basics',
      'Live Performance',
      'Music Mistakes',
      'Music Production',
    ],
    Photography: [
      'Photography Foundations',
      'Exposure Triangle',
      'Composition',
      'Lighting Basics',
      'Portrait Photography',
      'Landscape Photography',
      'Editing Workflow',
      'Camera Gear Basics',
      'Street Photography',
      'Storytelling with Photos',
      'Photography Mistakes',
      'Mobile Photography',
    ],
    Design: [
      'Design Foundations',
      'Typography',
      'Color & Contrast',
      'Layout & Grids',
      'Design Systems',
      'UX Basics',
      'UI Patterns',
      'Accessibility Basics',
      'Prototyping',
      'User Research Basics',
      'Design Mistakes',
      'Design Critique',
    ],
    Fashion: [
      'Style Foundations',
      'Wardrobe Essentials',
      'Fit & Proportions',
      'Color & Matching',
      'Personal Style',
      'Shopping Smarter',
      'Sustainable Fashion',
      'Dress Codes',
      'Accessories',
      'Fashion History Basics',
      'Fashion Mistakes',
      'Capsule Wardrobe',
    ],
    Technology: [
      'Tech Foundations',
      'Internet & Web Basics',
      'Cloud Basics',
      'APIs & Integrations',
      'Databases Basics',
      'Cyber Hygiene',
      'AI & Automation',
      'Tech Product Thinking',
      'Troubleshooting',
      'Productivity Tech Tools',
      'Tech Trends',
      'Common Tech Mistakes',
    ],
    Programming: [
      'Programming Foundations',
      'Data Structures',
      'Algorithms',
      'Debugging Skills',
      'Testing Basics',
      'Git & Collaboration',
      'Web Development Basics',
      'APIs & Backend Basics',
      'Code Quality',
      'System Design Intuition',
      'Performance Basics',
      'Programming Mistakes',
    ],
    Data: [
      'Data Foundations',
      'SQL Basics',
      'Data Modeling',
      'Analytics Basics',
      'Dashboards & Reporting',
      'Experimentation',
      'Data Pipelines',
      'Data Quality',
      'Metrics & KPIs',
      'Statistics Intuition',
      'Data Storytelling',
      'Data Mistakes',
    ],
    AI: [
      'AI Foundations',
      'Prompt Engineering',
      'LLMs 101',
      'RAG Basics',
      'AI Agents',
      'Agent Builder Lab',
      'Evaluation & Testing',
      'AI Product Design',
      'AI Safety Basics',
      'Model Limitations',
      'Automation Workflows',
      'AI for Developers',
      'AI Mistakes',
    ],
    Cybersecurity: [
      'Security Foundations',
      'Threat Modeling',
      'Passwords & Authentication',
      'Phishing & Social Engineering',
      'Web Security Basics',
      'Network Security Basics',
      'Secure Coding',
      'Incident Response',
      'Privacy Basics',
      'Security Tools',
      'Common Vulnerabilities',
      'Security Mistakes',
    ],
  };

  return map[key] ?? null;
}

function baseCourseTitles(categoryTitle) {
  return [
    `${categoryTitle}: Foundations`,
    `${categoryTitle}: Core Concepts`,
    `${categoryTitle}: Practical Skills`,
    `${categoryTitle}: Tools & Frameworks`,
    `${categoryTitle}: Advanced`,
    `${categoryTitle}: Mistakes & Myths`,
  ];
}

function genericCourseTitles(categoryTitle) {
  const t = String(categoryTitle ?? '').trim();
  return [
    `${t}: Projects & Practice`,
    `${t}: Case Studies`,
    `${t}: Glossary`,
    `${t}: Quick Wins`,
    `${t}: Systems`,
    `${t}: Strategy`,
    `${t}: Checklists`,
    `${t}: Mental Models`,
    `${t}: Metrics`,
    `${t}: Exercises`,
    `${t}: FAQs`,
    `${t}: Patterns`,
    `${t}: Playbook`,
    `${t}: Tools Deep Dive`,
    `${t}: Advanced Scenarios`,
  ];
}

function buildDesiredCourses({ category }) {
  const categoryId = String(category?.id ?? '').trim();
  const title = String(category?.title ?? '').trim() || categoryId;
  const categoryColor = category?.color ? String(category.color) : null;

  const specific = categorySpecificCourseTitles(title);

  const titles = (specific && Array.isArray(specific) && specific.length > 0 ? specific : []).concat(
    baseCourseTitles(title),
    genericCourseTitles(title)
  );

  const uniq = new Map();
  for (const courseTitle of titles) {
    const t = String(courseTitle ?? '').trim();
    if (!t) continue;
    const slug = slugify(t);
    if (!slug) continue;
    if (!uniq.has(slug)) uniq.set(slug, t);
  }

  const out = [];
  for (const [slug, courseTitle] of uniq) {
    out.push({
      id: `${categoryId}--${slug}`,
      category_id: categoryId,
      title: courseTitle,
      emoji: pickEmoji(courseTitle),
      color: categoryColor,
      description: `A focused course on ${courseTitle} with 1-minute lessons.`,
      published: true,
    });
  }

  return out;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  forbidEnv('VITE_SUPABASE_SERVICE_ROLE_KEY');

  const supabaseUrl = requiredEnvAny(['SUPABASE_URL', 'VITE_SUPABASE_URL']);
  const serviceKey = requiredEnv('SUPABASE_SERVICE_ROLE_KEY');

  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: categories, error: catErr } = await supabase
    .from('categories')
    .select('id, title, color, published')
    .eq('published', true)
    .order('title', { ascending: true });
  if (catErr) throw catErr;

  const categoryRows = Array.isArray(categories) ? categories : [];
  if (categoryRows.length === 0) {
    console.log('[content:seed-courses] No published categories found; nothing to do.');
    return;
  }

  const desiredAll = [];
  const targetCounts = new Map();
  for (const cat of categoryRows) {
    const desired = buildDesiredCourses({ category: cat });
    const categoryId = String(cat?.id ?? '').trim();
    const target = deterministicCountForCategory({ categoryId, min: args.minPerCategory, max: args.maxPerCategory });
    targetCounts.set(categoryId, target);
    const limited = desired.slice(0, target);
    desiredAll.push(...limited);
  }

  const desiredIds = desiredAll.map((c) => c.id);
  if (new Set(desiredIds).size !== desiredIds.length) {
    throw new Error('Duplicate course ids detected; adjust slugify/id strategy.');
  }

  const existingIds = new Set();
  const categoryIds = categoryRows.map((c) => String(c?.id ?? '').trim()).filter(Boolean);
  const CAT_CHUNK = 25;
  for (let i = 0; i < categoryIds.length; i += CAT_CHUNK) {
    const slice = categoryIds.slice(i, i + CAT_CHUNK);
    // eslint-disable-next-line no-await-in-loop
    const { data, error } = await supabase.from('courses').select('id').in('category_id', slice);
    if (error) throw error;
    for (const row of Array.isArray(data) ? data : []) {
      const id = String(row?.id ?? '').trim();
      if (id) existingIds.add(id);
    }
  }

  const toWrite = args.forceUpdate ? desiredAll : desiredAll.filter((c) => !existingIds.has(c.id));

  const categoryCount = categoryRows.length;
  const perLabel = args.minPerCategory === args.maxPerCategory ? String(args.minPerCategory) : `${args.minPerCategory}..${args.maxPerCategory}`;
  console.log(
    `[content:seed-courses] categories=${categoryCount} desired=${desiredAll.length} existing=${existingIds.size} willWrite=${toWrite.length} perCategory=${perLabel} mode=${args.forceUpdate ? 'upsert' : 'insert-missing'}`
  );

  if (args.dryRun) {
    const counts = {};
    for (const n of targetCounts.values()) counts[n] = (counts[n] ?? 0) + 1;
    const keys = Object.keys(counts)
      .map((k) => Number(k))
      .sort((a, b) => a - b);
    const summary = keys.map((k) => `${k}:${counts[k]}`).join(' ');
    console.log(`[content:seed-courses] targetCounts (courses:categories) ${summary}`);

    const preview = toWrite.slice(0, 30);
    for (const c of preview) {
      console.log(`(dry-run) ${c.category_id} :: ${c.id} -> ${c.title}`);
    }
    if (toWrite.length > preview.length) {
      console.log(`(dry-run) …and ${toWrite.length - preview.length} more`);
    }
    return;
  }

  if (args.prune) {
    throw new Error('Prune mode is not implemented yet (intentionally). Tell me if you want safe pruning and I will add it behind an explicit confirm flag.');
  }

  if (toWrite.length === 0) {
    console.log('✅ No Supabase writes needed (all courses already exist).');
    return;
  }

  const CHUNK = 250;
  for (let i = 0; i < toWrite.length; i += CHUNK) {
    const slice = toWrite.slice(i, i + CHUNK);
    // eslint-disable-next-line no-await-in-loop
    const { error } = args.forceUpdate
      ? await supabase.from('courses').upsert(slice, { onConflict: 'id' })
      : await supabase.from('courses').insert(slice);
    if (error) throw error;
    console.log(`✅ Wrote ${slice.length} course row(s) to Supabase (${i + slice.length}/${toWrite.length}).`);
  }

  console.log('\nNext: refresh /categories and /categories/<id> (cache TTL ~2m) or hard refresh to see new courses.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
