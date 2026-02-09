import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { getContentSource } from '../../services/_contentSource';

export default function ProtectedRoute({ children, requireVerified = false }) {
  const { user, loading, isSupabaseConfigured, sessionExpired } = useAuth();
  const location = useLocation();

  if (getContentSource() === 'local') {
    return children;
  }

  if (!isSupabaseConfigured) {
    return (
      <Navigate
        to="/login"
        replace
        state={{ from: location, reason: 'Supabase not configured' }}
      />
    );
  }

  if (loading) return null;

  if (!user) {
    if (sessionExpired) {
      return <Navigate to="/login" replace state={{ from: location, reason: 'session_expired' }} />;
    }
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  if (requireVerified) {
    const isVerified = Boolean(user?.email_confirmed_at || user?.confirmed_at);
    if (!isVerified) {
      return <Navigate to="/login" replace state={{ from: location, reason: 'verify_email' }} />;
    }
  }

  return children;
}
