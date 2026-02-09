import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { getRememberMePreference, isSupabaseConfigured, setRememberMePreference, supabase } from '../lib/supabaseClient';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState(null);
  const [rememberMe, setRememberMeState] = useState(() => getRememberMePreference());
  const [sessionExpired, setSessionExpired] = useState(false);

  const manualSignOutRef = useRef(false);
  const hadSessionRef = useRef(false);

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
    setSessionExpired(false);
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });
    if (error) {
      setAuthError(error);
      throw error;
    }
    return data;
  }, []);

  const resendVerificationEmail = useCallback(async (email, emailRedirectTo) => {
    if (!isSupabaseConfigured) throw new Error('Supabase is not configured');
    if (!email) throw new Error('Email is required');
    setAuthError(null);
    setSessionExpired(false);

    const { data, error } = await supabase.auth.resend({
      type: 'signup',
      email,
      options: emailRedirectTo ? { emailRedirectTo } : undefined,
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
    setSessionExpired(false);
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setAuthError(error);
      throw error;
    }
    return data;
  }, []);

  const requestPasswordReset = useCallback(async (email, redirectTo) => {
    if (!isSupabaseConfigured) throw new Error('Supabase is not configured');
    setAuthError(null);
    setSessionExpired(false);
    const { data, error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });
    if (error) {
      setAuthError(error);
      throw error;
    }
    return data;
  }, []);

  const signInWithOAuth = useCallback(async (provider, redirectTo, options) => {
    if (!isSupabaseConfigured) throw new Error('Supabase is not configured');
    if (!provider) throw new Error('OAuth provider is required');
    setAuthError(null);
    setSessionExpired(false);

    const nextOptions = {
      ...(options && typeof options === 'object' ? options : null),
      ...(redirectTo ? { redirectTo } : null),
    };

    const { data, error } = await supabase.auth.signInWithOAuth({
      provider,
      options: Object.keys(nextOptions).length ? nextOptions : undefined,
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
    manualSignOutRef.current = true;
    const { error } = await supabase.auth.signOut();
    if (error) {
      setAuthError(error);
      manualSignOutRef.current = false;
      throw error;
    }
    manualSignOutRef.current = false;
  }, []);

  const setRememberMe = useCallback(async (nextRememberMe) => {
    const next = Boolean(nextRememberMe);
    setRememberMeState(next);
    await setRememberMePreference(next);
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
      hadSessionRef.current = Boolean(data?.session);
      setLoading(false);

      const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
        const hadSession = hadSessionRef.current;
        const hasSessionNow = Boolean(nextSession);

        setSession(nextSession);
        setUser(nextSession?.user ?? null);

        if (hasSessionNow) {
          setSessionExpired(false);
        } else if (_event === 'SIGNED_OUT' && hadSession && !manualSignOutRef.current) {
          setSessionExpired(true);
          setAuthError(new Error('Your session expired. Please sign in again.'));
        }

        hadSessionRef.current = hasSessionNow;
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
      rememberMe,
      setRememberMe,
      sessionExpired,
      session,
      user,
      loading,
      authError,
      refreshSession,
      reloadUser,
      signUpWithPassword,
      resendVerificationEmail,
      signInWithPassword,
      signInWithOAuth,
      requestPasswordReset,
      signOut,
    }),
    [rememberMe, setRememberMe, sessionExpired, session, user, loading, authError, refreshSession, reloadUser, signUpWithPassword, resendVerificationEmail, signInWithPassword, signInWithOAuth, requestPasswordReset, signOut]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
