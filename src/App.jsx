import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import Home from './pages/Home';
import TopicsBrowserPage from './pages/TopicsBrowserPage';
import TopicPage from './pages/TopicPage';
import LessonPage from './pages/LessonPage';
import ReviewPage from './pages/ReviewPage';
import UpgradePage from './pages/UpgradePage';
import LoginPage from './pages/LoginPage';
import ProfilePage from './pages/ProfilePage';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './components/auth/ProtectedRoute';
import './App.css';

function App() {
  return (
    <AuthProvider>
      <Router>
        <div className="app">
          <AnimatePresence mode="wait">
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/topics" element={<TopicsBrowserPage />} />
              <Route path="/login" element={<LoginPage />} />
              <Route path="/upgrade" element={<UpgradePage />} />
              <Route
                path="/me"
                element={
                  <ProtectedRoute>
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
      </Router>
    </AuthProvider>
  );
}

export default App;
