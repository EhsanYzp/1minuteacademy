import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import { Analytics } from '@vercel/analytics/react';
import Home from './pages/Home';
import TopicsBrowserPage from './pages/TopicsBrowserPage';
import TopicPage from './pages/TopicPage';
import LessonPage from './pages/LessonPage';
import ReviewPage from './pages/ReviewPage';
import UpgradePage from './pages/UpgradePage';
import PrivacyPage from './pages/PrivacyPage';
import TermsPage from './pages/TermsPage';
import CookiesPage from './pages/CookiesPage';
import FaqPage from './pages/FaqPage';
import LoginPage from './pages/LoginPage';
import AuthCallbackPage from './pages/AuthCallbackPage';
import ResetPasswordPage from './pages/ResetPasswordPage';
import ProfilePage from './pages/ProfilePage';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './components/auth/ProtectedRoute';
import ScrollToTop from './components/ScrollToTop';
import Footer from './components/Footer';
import './App.css';

function App() {
  return (
    <AuthProvider>
      <Router>
        <ScrollToTop />
        <div className="app">
          <div className="app-content">
            <AnimatePresence mode="wait">
              <Routes>
                <Route path="/" element={<Home />} />
                <Route path="/topics" element={<TopicsBrowserPage />} />
                <Route path="/login" element={<LoginPage />} />
                <Route path="/auth/callback" element={<AuthCallbackPage />} />
                <Route path="/auth/reset" element={<ResetPasswordPage />} />
                <Route path="/upgrade" element={<UpgradePage />} />
                <Route path="/pricing" element={<UpgradePage />} />
                <Route path="/faq" element={<FaqPage />} />
                <Route path="/privacy" element={<PrivacyPage />} />
                <Route path="/terms" element={<TermsPage />} />
                <Route path="/cookies" element={<CookiesPage />} />
                <Route
                  path="/me"
                  element={
                    <ProtectedRoute requireVerified>
                      <ProfilePage />
                    </ProtectedRoute>
                  }
                />
                <Route path="/topic/:topicId" element={<TopicPage />} />
                <Route path="/lesson/:topicId" element={<LessonPage />} />
                <Route path="/review/:topicId" element={<ReviewPage />} />
              </Routes>
            </AnimatePresence>
          </div>

          <Footer />
          <Analytics />
        </div>
      </Router>
    </AuthProvider>
  );
}

export default App;
