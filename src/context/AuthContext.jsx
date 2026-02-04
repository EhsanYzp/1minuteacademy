import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { isSupabaseConfigured, supabase } from '../lib/supabaseClient';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState(null);

  useEffect(() => {
    let unsub = null;

    async function bootstrap() {
      if (!isSupabaseConfigured) {
        setLoading(false);
        return;
      }

      const { data, error } = await supabase.auth.getSession();
      if (error) setAuthError(error);

      setSession(data?.session ?? null);
      setUser(data?.session?.user ?? null);
      setLoading(false);

      const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
        setSession(nextSession);
        setUser(nextSession?.user ?? null);
      });

      unsub = () => listener?.subscription?.unsubscribe();
    }

    bootstrap();

    return () => {
      if (unsub) unsub();
    };
  }, []);

  const value = useMemo(
    () => ({
      isSupabaseConfigured,
      session,
      user,
      loading,
      authError,
      async signUpWithPassword(email, password) {
        if (!isSupabaseConfigured) throw new Error('Supabase is not configured');
        setAuthError(null);
        const { data, error } = await supabase.auth.signUp({ email, password });
        if (error) {
          setAuthError(error);
          throw error;
        }
        return data;
      },
      async signInWithPassword(email, password) {
        if (!isSupabaseConfigured) throw new Error('Supabase is not configured');
        setAuthError(null);
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) {
          setAuthError(error);
          throw error;
        }
        return data;
      },
      async signInWithOtp(email) {
        if (!isSupabaseConfigured) throw new Error('Supabase is not configured');
        setAuthError(null);
        const { data, error } = await supabase.auth.signInWithOtp({
          email,
          options: { emailRedirectTo: window.location.origin },
        });
        if (error) {
          setAuthError(error);
          throw error;
        }
        return data;
      },
      async signOut() {
        if (!isSupabaseConfigured) return;
        setAuthError(null);
        const { error } = await supabase.auth.signOut();
        if (error) {
          setAuthError(error);
          throw error;
        }
      },
    }),
    [session, user, loading, authError]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
