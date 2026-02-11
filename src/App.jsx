import { lazy, Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import { Analytics } from '@vercel/analytics/react';
import Home from './pages/Home';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './components/auth/ProtectedRoute';
import ScrollToTop from './components/ScrollToTop';
import Footer from './components/Footer';
import ErrorBoundary from './components/ErrorBoundary';
import RouteLoading from './components/RouteLoading';
import './App.css';

const TopicsBrowserPage = lazy(() => import('./pages/TopicsBrowserPage'));
const TopicPage = lazy(() => import('./pages/TopicPage'));
const LessonPage = lazy(() => import('./pages/LessonPage'));
const ReviewPage = lazy(() => import('./pages/ReviewPage'));
const UpgradePage = lazy(() => import('./pages/UpgradePage'));
const PrivacyPage = lazy(() => import('./pages/PrivacyPage'));
const TermsPage = lazy(() => import('./pages/TermsPage'));
const CookiesPage = lazy(() => import('./pages/CookiesPage'));
const FaqPage = lazy(() => import('./pages/FaqPage'));
const LoginPage = lazy(() => import('./pages/LoginPage'));
const AuthCallbackPage = lazy(() => import('./pages/AuthCallbackPage'));
const ResetPasswordPage = lazy(() => import('./pages/ResetPasswordPage'));
const ProfilePage = lazy(() => import('./pages/ProfilePage'));

function App() {
  return (
    <AuthProvider>
      <Router>
        <ScrollToTop />
        <div className="app">
          <div className="app-content">
            <AnimatePresence mode="wait">
              <ErrorBoundary>
                <Suspense fallback={<RouteLoading />}>
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
                </Suspense>
              </ErrorBoundary>
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
