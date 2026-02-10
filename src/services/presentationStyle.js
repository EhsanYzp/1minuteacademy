import { getSupabaseClient } from '../lib/supabaseClient';

const LS_KEY = 'oma:presentation_style';

export const PRESENTATION_STYLES = [
  { id: 'focus', label: 'Focus (classic)' },
  { id: 'cards', label: 'Cards (readable)' },
  { id: 'split', label: 'Split (visual + text)' },
  { id: 'minimal', label: 'Minimal (quiet)' },
  { id: 'bold', label: 'Bold (punchy)' },
  { id: 'dark', label: 'Dark (spotlight)' },
];

export const DEFAULT_PRESENTATION_STYLE = 'focus';

export function normalizePresentationStyle(raw) {
  const s = String(raw ?? '').trim().toLowerCase();
  const ids = new Set(PRESENTATION_STYLES.map((x) => x.id));
  return ids.has(s) ? s : null;
}

export function canChoosePresentationStyle(tier) {
  const t = String(tier ?? '').toLowerCase();
  return t === 'pro' || t === 'paused';
}

export function getLocalPresentationStyle() {
  try {
    return normalizePresentationStyle(window?.localStorage?.getItem(LS_KEY));
  } catch {
    return null;
  }
}

export function setLocalPresentationStyle(style) {
  try {
    const s = normalizePresentationStyle(style);
    if (!s) return;
    window?.localStorage?.setItem(LS_KEY, s);
  } catch {
    // ignore
  }
}

export function getJourneyPresentationProtocol(journey) {
  const p = journey?.protocol?.presentation;
  if (!p || typeof p !== 'object') return null;

  const supported = Array.isArray(p.storyStyles)
    ? p.storyStyles.map(normalizePresentationStyle).filter(Boolean)
    : null;

  const defaultStyle = normalizePresentationStyle(p.defaultStoryStyle) ?? DEFAULT_PRESENTATION_STYLE;

  return {
    supportedStoryStyles: supported && supported.length ? supported : null,
    defaultStoryStyle: defaultStyle,
  };
}

export function resolveStoryPresentationStyle({ user, tier, journey }) {
  const protocol = getJourneyPresentationProtocol(journey);
  const supported = protocol?.supportedStoryStyles ?? PRESENTATION_STYLES.map((x) => x.id);
  const defaultStyle = protocol?.defaultStoryStyle ?? DEFAULT_PRESENTATION_STYLE;

  // Only Pro can opt into non-default styles.
  if (!canChoosePresentationStyle(tier)) return defaultStyle;

  const fromUser = normalizePresentationStyle(user?.user_metadata?.presentation_style);
  const fromLocal = getLocalPresentationStyle();
  const candidate = fromUser ?? fromLocal ?? defaultStyle;
  return supported.includes(candidate) ? candidate : defaultStyle;
}

export async function saveStoryPresentationStyle({ user, style }) {
  const s = normalizePresentationStyle(style);
  if (!s) throw new Error('Invalid presentation style');

  // Always persist locally for instant effect and local-preview mode.
  setLocalPresentationStyle(s);

  if (!user) return { saved: 'local' };

  const supabase = getSupabaseClient();
  if (!supabase) return { saved: 'local' };

  const { error } = await supabase.auth.updateUser({ data: { presentation_style: s } });
  if (error) throw error;

  return { saved: 'remote' };
}
