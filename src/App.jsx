import { lazy, Suspense } from 'react';
import { Navigate, createBrowserRouter, Outlet, RouterProvider, useLocation } from 'react-router-dom';
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
const CatalogLayoutPage = lazy(() => import('./pages/CatalogLayoutPage'));
const CatalogCategoriesPage = lazy(() => import('./pages/CatalogCategoriesPage'));
const CatalogCategoryPage = lazy(() => import('./pages/CatalogCategoryPage'));
const CatalogCoursePage = lazy(() => import('./pages/CatalogCoursePage'));
const TopicPage = lazy(() => import('./pages/TopicPage'));
const LessonPage = lazy(() => import('./pages/LessonPage'));
const ReviewPage = lazy(() => import('./pages/ReviewPage'));
const ReviewsPage = lazy(() => import('./pages/ReviewsPage'));
const UpgradePage = lazy(() => import('./pages/UpgradePage'));
const PrivacyPage = lazy(() => import('./pages/PrivacyPage'));
const TermsPage = lazy(() => import('./pages/TermsPage'));
const CookiesPage = lazy(() => import('./pages/CookiesPage'));
const FaqPage = lazy(() => import('./pages/FaqPage'));
const LoginPage = lazy(() => import('./pages/LoginPage'));
const AuthCallbackPage = lazy(() => import('./pages/AuthCallbackPage'));
const ResetPasswordPage = lazy(() => import('./pages/ResetPasswordPage'));
const ProfilePage = lazy(() => import('./pages/ProfilePage'));
const NotFoundPage = lazy(() => import('./pages/NotFoundPage'));

function AppFrame() {
  const location = useLocation();

  return (
    <>
      <ScrollToTop />
      <div className="app">
        <div className="app-content">
          <AnimatePresence mode="wait">
            <ErrorBoundary resetKey={location.key}>
              <Suspense fallback={<RouteLoading />}>
                <div key={location.pathname}>
                  <Outlet />
                </div>
              </Suspense>
            </ErrorBoundary>
          </AnimatePresence>
        </div>

        <Footer />
        <Analytics />
      </div>
    </>
  );
}

const router = createBrowserRouter([
  {
    path: '/',
    element: <AppFrame />,
    children: [
      { index: true, element: <Home /> },
      { path: 'learn', element: <Navigate to="/" replace /> },
      {
        path: 'topics',
        element: <CatalogLayoutPage />,
        children: [
          // Legacy / original entry: search + filters + topic list.
          { index: true, element: <TopicsBrowserPage /> },
          // Backwards-compatible alias for the older nested route.
          { path: 'search', element: <Navigate to="/topics" replace /> },

          // New catalog navigation.
          {
            path: 'catalog',
            element: <CatalogLayoutPage />,
            children: [
              { index: true, element: <CatalogCategoriesPage /> },
              { path: 'category/:categoryId', element: <CatalogCategoryPage /> },
              { path: 'course/:courseId', element: <CatalogCoursePage /> },
            ],
          },
        ],
      },
      { path: 'login', element: <LoginPage /> },
      { path: 'auth/callback', element: <AuthCallbackPage /> },
      { path: 'auth/reset', element: <ResetPasswordPage /> },
      { path: 'upgrade', element: <UpgradePage /> },
      { path: 'pricing', element: <UpgradePage /> },
      { path: 'faq', element: <FaqPage /> },
      { path: 'privacy', element: <PrivacyPage /> },
      { path: 'terms', element: <TermsPage /> },
      { path: 'cookies', element: <CookiesPage /> },
      {
        path: 'me',
        element: (
          <ProtectedRoute requireVerified>
            <ProfilePage />
          </ProtectedRoute>
        ),
      },
      { path: 'topic/:topicId', element: <TopicPage /> },
      { path: 'lesson/:topicId', element: <LessonPage /> },
      { path: 'review/:topicId', element: <ReviewPage /> },
      { path: 'reviews', element: <ReviewsPage /> },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
]);

function App() {
  return (
    <AuthProvider>
      <RouterProvider router={router} />
    </AuthProvider>
  );
}

export default App;
