import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import {
  clearPersistentSupabaseSession,
  getRememberMePreference,
  getSupabaseClient,
  isSupabaseConfigured,
  setRememberMePreference,
} from '../lib/supabaseClient';

const AuthContext = createContext(null);

function getAuthRedirectBaseUrl() {
  const isDev = (import.meta?.env?.DEV ?? false) === true;
  const configured = String(import.meta?.env?.VITE_SITE_URL ?? '').trim();
  if (configured) return configured.replace(/\/+$/, '');
  if (isDev && typeof window !== 'undefined' && window?.location?.origin) return window.location.origin;
  throw new Error('VITE_SITE_URL is required for auth redirects');
}

function buildAuthRedirectUrl(pathname) {
  const base = getAuthRedirectBaseUrl();
  const path = String(pathname ?? '').startsWith('/') ? String(pathname) : `/${String(pathname ?? '')}`;
  return `${base}${path}`;
}

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState(null);
  const [rememberMe, setRememberMeState] = useState(() => getRememberMePreference());
  const [sessionExpired, setSessionExpired] = useState(false);

  const manualSignOutRef = useRef(false);
  const hadSessionRef = useRef(false);
  const clientRef = useRef(isSupabaseConfigured ? getSupabaseClient(getRememberMePreference()) : null);

  const LS_LAST_AUTHED_AT = '1ma.lastAuthedAt';
  const LS_MANUAL_SIGNOUT_AT = '1ma.manualSignOutAt';

  const markAuthed = useCallback(() => {
    try {
      window?.localStorage?.setItem(LS_LAST_AUTHED_AT, String(Date.now()));
      window?.localStorage?.removeItem(LS_MANUAL_SIGNOUT_AT);
    } catch {
      // ignore
    }
  }, []);

  const markManualSignOut = useCallback(() => {
    try {
      window?.localStorage?.setItem(LS_MANUAL_SIGNOUT_AT, String(Date.now()));
      window?.localStorage?.removeItem(LS_LAST_AUTHED_AT);
    } catch {
      // ignore
    }
  }, []);

  const shouldShowSessionExpiredOnBootstrap = useCallback(() => {
    try {
      const lastAuthedAt = window?.localStorage?.getItem(LS_LAST_AUTHED_AT);
      const manualAt = window?.localStorage?.getItem(LS_MANUAL_SIGNOUT_AT);
      // If we previously had a session and did not manually sign out, explain why they're back at login.
      return Boolean(lastAuthedAt) && !manualAt;
    } catch {
      return false;
    }
  }, []);

  const getClient = useCallback(() => {
    if (!isSupabaseConfigured) return null;
    if (!clientRef.current) clientRef.current = getSupabaseClient(getRememberMePreference());
    return clientRef.current;
  }, []);

  const reloadUser = useCallback(async () => {
    if (!isSupabaseConfigured) return null;
    setAuthError(null);

    const supabase = getClient();
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
    const supabase = getClient();
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
    const supabase = getClient();
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: buildAuthRedirectUrl('/auth/callback'),
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

    const supabase = getClient();
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
    const supabase = getClient();
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
    const supabase = getClient();
    const safeRedirectTo = redirectTo || buildAuthRedirectUrl('/auth/reset');
    const { data, error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: safeRedirectTo });
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

    const supabase = getClient();

    const safeRedirectTo = redirectTo || buildAuthRedirectUrl('/auth/callback');

    const nextOptions = {
      ...(options && typeof options === 'object' ? options : null),
      ...(safeRedirectTo ? { redirectTo: safeRedirectTo } : null),
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
    markManualSignOut();
    const supabase = getClient();
    const { error } = await supabase.auth.signOut();
    if (error) {
      setAuthError(error);
      manualSignOutRef.current = false;
      throw error;
    }
    manualSignOutRef.current = false;
  }, [getClient, markManualSignOut]);

  const setRememberMe = useCallback(async (nextRememberMe) => {
    if (!isSupabaseConfigured) return;
    const next = Boolean(nextRememberMe);

    // Snapshot current session before switching clients.
    const prevClient = clientRef.current ?? getSupabaseClient(getRememberMePreference());
    const nextClient = getSupabaseClient(next);

    setRememberMeState(next);
    setRememberMePreference(next);

    if (!prevClient || !nextClient || prevClient === nextClient) {
      clientRef.current = nextClient;
      return;
    }

    try {
      const { data: prevSessionData } = await prevClient.auth.getSession();
      const prevSession = prevSessionData?.session ?? null;
      if (prevSession?.access_token && prevSession?.refresh_token) {
        await nextClient.auth.setSession({
          access_token: prevSession.access_token,
          refresh_token: prevSession.refresh_token,
        });
      }
    } catch {
      // ignore
    }

    // If Remember me is turned OFF, clear any persisted storage so future restarts
    // never auto-restore a previously persisted session.
    if (!next) {
      await clearPersistentSupabaseSession();
    }

    clientRef.current = nextClient;
  }, []);

  useEffect(() => {
    let unsub = null;
    let cancelled = false;

    async function bootstrap() {
      if (!isSupabaseConfigured) {
        setLoading(false);
        return;
      }

      const supabase = getSupabaseClient(rememberMe);
      clientRef.current = supabase;

      const { data, error } = await supabase.auth.getSession();
      if (cancelled) return;
      if (error) setAuthError(error);

      const nextSession = data?.session ?? null;
      setSession(nextSession);
      setUser(nextSession?.user ?? null);
      hadSessionRef.current = Boolean(nextSession);

      if (nextSession) {
        setSessionExpired(false);
        markAuthed();
      } else if (shouldShowSessionExpiredOnBootstrap()) {
        setSessionExpired(true);
      }

      setLoading(false);

      const { data: listener } = supabase.auth.onAuthStateChange((event, sessionNow) => {
        const hadSession = hadSessionRef.current;
        const hasSessionNow = Boolean(sessionNow);

        setSession(sessionNow);
        setUser(sessionNow?.user ?? null);

        if (hasSessionNow) {
          setSessionExpired(false);
          markAuthed();
        } else {
          const looksLikeExpiry =
            (event === 'SIGNED_OUT' && hadSession && !manualSignOutRef.current) ||
            event === 'TOKEN_REFRESH_FAILED';

          if (looksLikeExpiry) {
            setSessionExpired(true);
            setAuthError(new Error('Your session expired. Please sign in again.'));
          }
        }

        hadSessionRef.current = hasSessionNow;
      });

      unsub = () => listener?.subscription?.unsubscribe();
    }

    bootstrap();

    return () => {
      cancelled = true;
      if (unsub) unsub();
    };
  }, [rememberMe, markAuthed, shouldShowSessionExpiredOnBootstrap]);

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
