import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { getContentSource } from '../../services/_contentSource';

export default function ProtectedRoute({ children }) {
  const { user, loading, isSupabaseConfigured } = useAuth();
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
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  return children;
}
