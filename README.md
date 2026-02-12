# 🎮 1MinuteAcademy

> Learn anything in just 60 seconds! An interactive, game-like educational platform.

![1MinuteAcademy](https://img.shields.io/badge/Learn-60%20Seconds-FF6B6B?style=for-the-badge)
![React](https://img.shields.io/badge/React-18-61DAFB?style=for-the-badge&logo=react)
![Vite](https://img.shields.io/badge/Vite-Fast-646CFF?style=for-the-badge&logo=vite)

## ✨ Features

- **⏱️ 60-Second Learning** - Master any concept in just one minute
- **🎮 Game-Like Experience** - Interactive, engaging, and fun
- **🎨 Beautiful Design** - Warm, playful UI with smooth animations
- **📱 Responsive** - Works on all devices
- **🎯 Interactive Content** - Click, tap, and explore to learn
- **👤 Accounts + Profile** - Sign in, view your profile, and track your 1MA balance/progress

## 🚀 Getting Started

### Prerequisites

- Node.js 18+ 
- npm or yarn

### Installation

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build
```

### Supabase Setup (Required for Lessons + 1MA/Streak)

1. Create a Supabase project
2. In Supabase SQL Editor, run the schema in `supabase/001_init.sql`
3. Create a `.env.local` file (recommended) using `.env.example` and fill:

```bash
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...
```

4. Run `npm run dev`

Notes:
- The `/lesson/:topicId` route requires authentication (email/password or magic link).
- Topics are loaded from the `topics` table; the seeded `blockchain` topic is included in the SQL.

### Supabase Auth redirect URLs (fix email links going to localhost)

If Supabase emails (magic link / confirm signup / reset password) send you back to `http://localhost:5173`, update your Supabase Auth URL configuration:

1. Supabase Dashboard → **Authentication** → **URL Configuration**
2. Set **Site URL** to your production domain:
	- `https://1minuteacademy.vercel.app`
3. Add **Redirect URLs** for every origin you use:
	- `https://1minuteacademy.vercel.app/**`
	- `http://localhost:5173/**`

Then request a new email link (old emails will keep the old redirect).

### Profile + progress

- After signing in, open `/me` (or click **Profile** in the header).
- Landing page shows a **✅ Completed** badge for topics you’ve completed.

## 🧩 Scaling to Thousands of Modules

This project scales by treating each module/topic as **data**, not code.

- Topic content lives in Supabase: `public.topics.lesson` (JSON)
- The frontend renders lessons via a small set of reusable “step types” in `src/engine/stepTypes/`
- Optional local authoring lives in `content/topics/**` and can be validated/synced in bulk

See: `docs/architecture.md` for the full platform layout.
See: `docs/content-generation.md` for the content playbook.

### Content tooling

- Validate topic JSON: `npm run content:validate`

- Publish topic JSON to Supabase (recommended per-module):
  - `npm run content:sync -- --topic <topicId>`

- Bulk sync to Supabase (safe by default): `npm run content:sync`
	- Requires `SUPABASE_SERVICE_ROLE_KEY` in `.env.local` (scripts only; never ship to browser)
	- The sync script loads `.env.local` automatically
	- Updates existing topics only if local `lesson.version` is higher (prevents accidental overwrites)

- Sync to a specific environment (recommended for staging/prod split):
	- Create `.env.staging.local` with staging keys, then run: `npm run content:sync:staging`
	- Create `.env.production.local` (or keep using `.env.local`), then run: `npm run content:sync:prod`
	- You can also use: `npm run content:sync -- --env staging`

### Troubleshooting progress not saving

- If lesson completion shows an RPC error, re-run the SQL in [supabase/001_init.sql](supabase/001_init.sql) to update `public.complete_topic(...)`.
- If your Supabase project was created before the 1MA change, also apply [supabase/010_one_ma_collectible.sql](supabase/010_one_ma_collectible.sql).
- Ensure you are running `npm run dev` (Supabase mode), not `npm run dev:local` (Local Preview).

### Local Preview (no Supabase push while iterating)

When you’re drafting a new module, you can run the app using local JSON from `content/topics/**`:

- `npm run dev:local`

In this mode:
- Topics/lessons come from `content/topics/**` (bundled by Vite)
- 1MA balance/streak are stored in `localStorage` (1MA awarding is Pro-only)
- `/lesson/:topicId` does not require login

When you’re happy, publish to Supabase with `npm run content:sync`.

Tip: prefer `npm run content:sync -- --topic <id>` so publishing a new module only touches that one module.

## 💳 Stripe Integration (Pro subscriptions)

This repo includes a Stripe Checkout + webhook flow for Pro.

### Endpoints

- Create Checkout Session: `POST /api/stripe/create-checkout-session`
- Stripe Webhook: `POST /api/stripe/webhook`
- Create Customer Portal Session: `POST /api/stripe/create-portal-session`
- Subscription status (for UI): `GET /api/stripe/subscription-status`

These endpoints work on:

- **Vercel** via the serverless handlers in `api/stripe/*`
- **Netlify** via functions in `netlify/functions/*` (rewired from `/api/stripe/*` in `netlify.toml` + `public/_redirects`)

### Setup

1. In Stripe, create a Product (e.g. “1MinuteAcademy Pro”) and two recurring Prices (monthly + yearly).
2. Set environment variables on your deploy target (Vercel/Netlify):

	- `STRIPE_SECRET_KEY`
	- `STRIPE_WEBHOOK_SECRET`
	- `STRIPE_PRICE_ID_MONTHLY`
	- `STRIPE_PRICE_ID_YEARLY`
	- `SITE_URL` (e.g. `https://your-domain.com`)
	- `SUPABASE_URL` (same as `VITE_SUPABASE_URL`)
	- `SUPABASE_ANON_KEY` (same as `VITE_SUPABASE_ANON_KEY`)
	- `SUPABASE_SERVICE_ROLE_KEY` (server-only)

	See `.env.example` for a template.

3. Add a Stripe webhook endpoint:

	- URL: `https://your-domain.com/api/stripe/webhook`
	- Events:
	  - `checkout.session.completed`
	  - `customer.subscription.deleted`

### How Pro is activated

When Stripe confirms checkout, the webhook updates Supabase Auth user metadata:

- `user_metadata.plan = "pro"`

The client reads this field to unlock Pro features.

### Cancel / manage subscription

Users manage their subscription via the Stripe Customer Portal (recommended). From **Profile**, Pro users can open the portal to:

- Cancel subscription
- Update payment method
- View invoices and renewal dates

In Stripe Dashboard, make sure Customer Portal is enabled and cancellation is allowed.

## 📚 Available Modules

### Currently Available:
- 🔗 **What is Blockchain?** - Learn how blockchain technology works
- ⚛️ **Quantum Computing (in 60s)** - Qubits, superposition, entanglement
- 🤖 **AI Agents (in 60s)** - Tools + memory + loops (agent basics)

### Coming Soon:
- 🧠 What is AI?
- 💰 Cryptocurrency

## 🎨 Design System

The app uses a custom design system with:

- **Fonts**: Fredoka (display) & Baloo 2 (body) - game-like typography
- **Colors**: Warm, playful palette with coral, teal, and yellow accents
- **Theme**: Light theme only for optimal readability
- **Animations**: Smooth, bouncy animations using Framer Motion

## 🛠️ Tech Stack

- **React 19** - UI library
- **Vite** - Build tool & dev server
- **Framer Motion** - Animations
- **React Router** - Navigation
- **CSS Modules** - Styling
- **Supabase (Auth + Postgres + RLS + RPC)** - Accounts, topics, 1MA balance/streak/progress

## 📁 Project Structure

```
src/
├── components/     # Reusable UI components
│   ├── Header.jsx
│   ├── SubjectCard.jsx
│   └── Timer.jsx
│   └── auth/        # Route guards
├── pages/          # Page components
│   ├── Home.jsx
│   ├── TopicPage.jsx
│   └── LessonPage.jsx
├── context/        # Auth session provider
├── services/       # Supabase queries + progress RPC
├── engine/         # JSON-driven lesson renderer
└── App.jsx         # Main app component

supabase/
└── 001_init.sql     # Tables, RLS, RPC + seed content
```

## 🎯 How It Works

1. **Choose a Topic** - Browse available subjects on the home page
2. **Review & Start** - See what you'll learn and hit the start button
3. **Learn Interactively** - Engage with animated, interactive content for 60 seconds
4. **Celebrate!** - Get your achievement (and collect 1MA if you're Pro)

## 🤝 Contributing

Contributions are welcome! To add a new topic:

1. Insert a row into `topics` (see the seeded `blockchain` example)
2. Provide a `lesson` JSON with `totalSeconds` and `steps`
3. Reuse existing step types (`intro`, `tapReveal`, `buildChain`, `summary`) or add new step components under `src/engine/stepTypes/`

## 📝 License

MIT License - feel free to use this for learning and education!

---

Made with 💖 for curious minds
