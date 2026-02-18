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

const CategoriesPage = lazy(() => import('./pages/CategoriesPage'));
const CategoryCoursesPage = lazy(() => import('./pages/CategoryCoursesPage'));
const CourseChaptersPage = lazy(() => import('./pages/CourseChaptersPage'));
const ChapterTopicsPage = lazy(() => import('./pages/ChapterTopicsPage'));
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
      { path: 'categories', element: <CategoriesPage /> },
      { path: 'categories/:categoryId', element: <CategoryCoursesPage /> },
      { path: 'categories/:categoryId/courses/:courseId', element: <CourseChaptersPage /> },
      { path: 'categories/:categoryId/courses/:courseId/chapters/:chapterId', element: <ChapterTopicsPage /> },
      {
        path: 'topics',
        element: <Navigate to="/categories" replace />,
      },
      // Backwards-compatible alias.
      { path: 'topics/search', element: <Navigate to="/categories" replace /> },
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
      // Chapter-scoped aliases (preferred when navigating from the catalog flow).
      { path: 'categories/:categoryId/courses/:courseId/chapters/:chapterId/topic/:topicId', element: <TopicPage /> },
      { path: 'categories/:categoryId/courses/:courseId/chapters/:chapterId/lesson/:topicId', element: <LessonPage /> },
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
