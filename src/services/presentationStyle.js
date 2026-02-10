import { getSupabaseClient } from '../lib/supabaseClient';

const LS_KEY = 'oma:presentation_style';

export const PRESENTATION_STYLES = [
  { id: 'focus', label: 'Focus (classic)' },
  { id: 'dark', label: 'Dark (spotlight)' },
  { id: 'cards', label: 'Cards (readable)' },
  { id: 'split', label: 'Split (visual + text)' },
  { id: 'minimal', label: 'Minimal (quiet)' },
  { id: 'bold', label: 'Bold (punchy)' },
];

export const DEFAULT_PRESENTATION_STYLE = 'focus';

export function normalizePresentationStyle(raw) {
  const s = String(raw ?? '').trim().toLowerCase();
  const ids = new Set(PRESENTATION_STYLES.map((x) => x.id));
  return ids.has(s) ? s : null;
}

export function canChoosePresentationStyle(tier) {
  return getAllowedPresentationStyleIds(tier).length > 1;
}

export function getAllowedPresentationStyleIds(tier) {
  const t = String(tier ?? '').toLowerCase();
  const all = PRESENTATION_STYLES.map((x) => x.id);
  if (t === 'pro' || t === 'paused') return all;
  if (t === 'free') return ['focus', 'dark'];
  if (!t || t === 'guest') return ['focus', 'dark'];
  // Anything unknown defaults to the classic focus experience.
  return ['focus'];
}

function pickEffectiveDefault({ supported, allowed, defaultStyle }) {
  const supportedSet = new Set(Array.isArray(supported) ? supported : []);
  const allowedSet = new Set(Array.isArray(allowed) ? allowed : []);

  if (defaultStyle && supportedSet.has(defaultStyle) && allowedSet.has(defaultStyle)) return defaultStyle;

  const firstAllowedSupported = (allowed ?? []).find((id) => supportedSet.has(id));
  if (firstAllowedSupported) return firstAllowedSupported;

  // Last resort: focus (even if protocol is misconfigured).
  return DEFAULT_PRESENTATION_STYLE;
}

export function buildPresentationStyleOptions({ tier, journey } = {}) {
  const protocol = getJourneyPresentationProtocol(journey);
  const supported = protocol?.supportedStoryStyles ?? PRESENTATION_STYLES.map((x) => x.id);
  const allowed = getAllowedPresentationStyleIds(tier);
  const supportedSet = new Set(supported);
  const allowedSet = new Set(allowed);

  return PRESENTATION_STYLES.map((s) => {
    const isSupported = supportedSet.has(s.id);
    const isAllowed = allowedSet.has(s.id);
    const disabled = !isSupported || !isAllowed;
    const proLocked = isSupported && !isAllowed && (String(tier ?? '').toLowerCase() !== 'pro') && (String(tier ?? '').toLowerCase() !== 'paused');

    const label = proLocked
      ? `${s.label} (Pro only)`
      : s.label;

    return {
      ...s,
      label,
      disabled,
    };
  });
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
  const protocolDefault = protocol?.defaultStoryStyle ?? DEFAULT_PRESENTATION_STYLE;

  const allowed = getAllowedPresentationStyleIds(tier);
  const effectiveDefault = pickEffectiveDefault({ supported, allowed, defaultStyle: protocolDefault });

  const fromUser = normalizePresentationStyle(user?.user_metadata?.presentation_style);
  const fromLocal = getLocalPresentationStyle();
  const candidate = fromUser ?? fromLocal ?? effectiveDefault;

  const ok = supported.includes(candidate) && allowed.includes(candidate);
  return ok ? candidate : effectiveDefault;
}

export async function saveStoryPresentationStyle({ user, style, tier } = {}) {
  const s = normalizePresentationStyle(style);
  if (!s) throw new Error('Invalid presentation style');

  const allowed = getAllowedPresentationStyleIds(tier);
  if (!allowed.includes(s)) {
    throw new Error('This presentation style is a Pro feature');
  }

  // Always persist locally for instant effect and local-preview mode.
  setLocalPresentationStyle(s);

  if (!user) return { saved: 'local' };

  const supabase = getSupabaseClient();
  if (!supabase) return { saved: 'local' };

  const { error } = await supabase.auth.updateUser({ data: { presentation_style: s } });
  if (error) throw error;

  return { saved: 'remote' };
}
