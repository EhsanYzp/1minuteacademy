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

## 📁 Project Structure

```
src/
├── components/     # Reusable UI components
│   ├── Header.jsx
│   ├── SubjectCard.jsx
│   └── Timer.jsx
├── pages/          # Page components
│   ├── Home.jsx
│   ├── TopicPage.jsx
│   └── LessonPage.jsx
├── modules/        # Learning module content
│   └── BlockchainLesson.jsx
└── App.jsx         # Main app component
```

## 🎯 How It Works

1. **Choose a Topic** - Browse available subjects on the home page
2. **Review & Start** - See what you'll learn and hit the start button
3. **Learn Interactively** - Engage with animated, interactive content for 60 seconds
4. **Celebrate!** - Get your achievement and XP rewards

## 🤝 Contributing

Contributions are welcome! To add a new learning module:

1. Create a new component in `src/modules/`
2. Add the topic data to the home page
3. Register the component in `LessonPage.jsx`

## 📝 License

MIT License - feel free to use this for learning and education!

---

Made with 💖 for curious minds
