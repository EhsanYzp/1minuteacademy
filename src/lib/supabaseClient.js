import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

const REMEMBER_ME_STORAGE_KEY = '1ma.rememberMe';

function readRememberMePreference() {
  if (typeof window === 'undefined') return true;
  try {
    const raw = window.localStorage.getItem(REMEMBER_ME_STORAGE_KEY);
    if (raw === null) return true;
    return raw === 'true';
  } catch {
    return true;
  }
}

function writeRememberMePreference(value) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(REMEMBER_ME_STORAGE_KEY, String(Boolean(value)));
  } catch {
    // ignore
  }
}

export function getRememberMePreference() {
  return readRememberMePreference();
}

export function setRememberMePreference(rememberMe) {
  if (!isSupabaseConfigured) return;
  writeRememberMePreference(Boolean(rememberMe));
}

function buildStorageKey(suffix) {
  try {
    const host = new URL(supabaseUrl).host;
    return `1ma:${host}:${suffix}`;
  } catch {
    return `1ma:${suffix}`;
  }
}

let supabasePersistent = null;
let supabaseSession = null;

function getPersistentClient() {
  if (!isSupabaseConfigured) return null;
  if (supabasePersistent) return supabasePersistent;

  supabasePersistent = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      storageKey: buildStorageKey('auth:persist'),
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  });

  return supabasePersistent;
}

function getSessionClient() {
  if (!isSupabaseConfigured) return null;
  if (supabaseSession) return supabaseSession;

  // IMPORTANT:
  // OAuth uses a redirect + PKCE code verifier stored in browser storage.
  // If we set persistSession=false (memory only), the verifier and session are
  // lost across the provider redirect, leading to “No active session found yet”.
  //
  // sessionStorage gives us “not remembered after tab close” semantics while
  // still supporting OAuth redirects.
  const storage = typeof window !== 'undefined' ? window.sessionStorage : undefined;

  supabaseSession = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      storageKey: buildStorageKey('auth:session'),
      storage,
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  });

  return supabaseSession;
}

export function getSupabaseClient(rememberMe = readRememberMePreference()) {
  if (!isSupabaseConfigured) return null;
  return rememberMe ? getPersistentClient() : getSessionClient();
}

export async function clearPersistentSupabaseSession() {
  if (!isSupabaseConfigured) return;
  try {
    // Clear local storage only (do not revoke server-side tokens).
    await getPersistentClient()?.auth.signOut({ scope: 'local' });
  } catch {
    // ignore
  }
}

