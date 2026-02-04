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

### Supabase Setup (Required for Lessons + XP/Streak)

1. Create a Supabase project
2. In Supabase SQL Editor, run the schema in `supabase/001_init.sql`
3. Create a `.env` file (Vite) using `.env.example` and fill:

```bash
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...
```

4. Run `npm run dev`

Notes:
- The `/lesson/:topicId` route requires authentication (email/password or magic link).
- Topics are loaded from the `topics` table; the seeded `blockchain` topic is included in the SQL.

## 🧩 Scaling to Thousands of Modules

This project scales by treating each module/topic as **data**, not code.

- Topic content lives in Supabase: `public.topics.lesson` (JSON)
- The frontend renders lessons via a small set of reusable “step types” in `src/engine/stepTypes/`
- Optional local authoring lives in `content/topics/**` and can be validated/synced in bulk

See: `docs/architecture.md` for the full platform layout.

### Content tooling

- Validate topic JSON: `npm run content:validate`
- Bulk sync to Supabase: `npm run content:sync`
	- Requires `SUPABASE_SERVICE_ROLE_KEY` in your local env (scripts only; never ship to browser)

## 📚 Available Modules

### Currently Available:
- 🔗 **What is Blockchain?** - Learn how blockchain technology works

### Coming Soon:
- 🤖 What is AI?
- ⚛️ Quantum Computing
- 💰 Cryptocurrency

## 🎨 Design System

The app uses a custom design system with:

- **Fonts**: Fredoka (display) & Baloo 2 (body) - game-like typography
- **Colors**: Warm, playful palette with coral, teal, and yellow accents
- **Theme**: Light theme only for optimal readability
- **Animations**: Smooth, bouncy animations using Framer Motion

## 🛠️ Tech Stack

- **React 18** - UI library
- **Vite** - Build tool & dev server
- **Framer Motion** - Animations
- **React Router** - Navigation
- **CSS Modules** - Styling
- **Supabase (Auth + Postgres + RLS + RPC)** - Accounts, topics, XP/streak/progress

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
4. **Celebrate!** - Get your achievement and XP rewards

## 🤝 Contributing

Contributions are welcome! To add a new topic:

1. Insert a row into `topics` (see the seeded `blockchain` example)
2. Provide a `lesson` JSON with `totalSeconds`, `xp`, and `steps`
3. Reuse existing step types (`intro`, `tapReveal`, `buildChain`, `summary`) or add new step components under `src/engine/steps/`

## 📝 License

MIT License - feel free to use this for learning and education!

---

Made with 💖 for curious minds
