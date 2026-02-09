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

const supabasePersistent = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  : null;

const supabaseEphemeral = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  : null;

export let supabase = null;

if (isSupabaseConfigured) {
  supabase = readRememberMePreference() ? supabasePersistent : supabaseEphemeral;
}

export async function setRememberMePreference(rememberMe) {
  if (!isSupabaseConfigured) return;
  const next = Boolean(rememberMe);
  writeRememberMePreference(next);

  if (!next) {
    // Defensive: if a user previously used Remember Me ON, there may be a stored
    // session in localStorage. Clear it so "Remember me OFF" never auto-logs-in
    // after a browser restart.
    try {
      await supabasePersistent.auth.signOut({ scope: 'local' });
    } catch {
      // ignore
    }
    supabase = supabaseEphemeral;
    return;
  }

  supabase = supabasePersistent;
}

