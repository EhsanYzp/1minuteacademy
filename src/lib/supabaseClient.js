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

export const supabasePersistent = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  : null;

export const supabaseEphemeral = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  : null;

export function getSupabaseClient(rememberMe = readRememberMePreference()) {
  if (!isSupabaseConfigured) return null;
  return rememberMe ? supabasePersistent : supabaseEphemeral;
}

export async function clearPersistentSupabaseSession() {
  if (!isSupabaseConfigured || !supabasePersistent) return;
  try {
    // Clear local storage only (do not revoke server-side tokens).
    await supabasePersistent.auth.signOut({ scope: 'local' });
  } catch {
    // ignore
  }
}

