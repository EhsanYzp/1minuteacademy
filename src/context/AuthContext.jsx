import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { isSupabaseConfigured, supabase } from '../lib/supabaseClient';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState(null);

  const reloadUser = useCallback(async () => {
    if (!isSupabaseConfigured) return null;
    setAuthError(null);

    const { data: sessionData, error: sessionErr } = await supabase.auth.getSession();
    if (sessionErr) {
      setAuthError(sessionErr);
      throw sessionErr;
    }

    const currentSession = sessionData?.session ?? null;
    if (!currentSession) return null;

    const { data: userData, error: userErr } = await supabase.auth.getUser();
    if (userErr) {
      setAuthError(userErr);
      throw userErr;
    }

    const nextUser = userData?.user ?? currentSession.user ?? null;
    setSession({ ...currentSession, user: nextUser ?? currentSession.user });
    setUser(nextUser);
    return nextUser;
  }, []);

  const refreshSession = useCallback(async () => {
    if (!isSupabaseConfigured) return null;
    setAuthError(null);
    const { data, error } = await supabase.auth.refreshSession();
    if (error) {
      setAuthError(error);
      throw error;
    }
    // refreshSession() does not always reflect server-side user_metadata changes immediately.
    // Fetch the user explicitly so entitlements update without requiring logout/login.
    let nextUser = data?.session?.user ?? null;
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (userData?.user) nextUser = userData.user;
    } catch {
      // ignore
    }

    setSession(data?.session ? { ...data.session, user: nextUser ?? data.session.user } : null);
    setUser(nextUser);
    return data;
  }, []);

  const signUpWithPassword = useCallback(async (email, password) => {
    if (!isSupabaseConfigured) throw new Error('Supabase is not configured');
    setAuthError(null);
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: window.location.origin,
      },
    });
    if (error) {
      setAuthError(error);
      throw error;
    }
    return data;
  }, []);

  const signInWithPassword = useCallback(async (email, password) => {
    if (!isSupabaseConfigured) throw new Error('Supabase is not configured');
    setAuthError(null);
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setAuthError(error);
      throw error;
    }
    return data;
  }, []);

  const signInWithOtp = useCallback(async (email) => {
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
  }, []);

  const signOut = useCallback(async () => {
    if (!isSupabaseConfigured) return;
    setAuthError(null);
    const { error } = await supabase.auth.signOut();
    if (error) {
      setAuthError(error);
      throw error;
    }
  }, []);

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
      refreshSession,
      reloadUser,
      signUpWithPassword,
      signInWithPassword,
      signInWithOtp,
      signOut,
    }),
    [session, user, loading, authError, refreshSession, reloadUser, signUpWithPassword, signInWithPassword, signInWithOtp, signOut]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
