const LS_KEY = 'oma:show_progress_visuals';
export const PROGRESS_VISUALS_CHANGED_EVENT = 'oma:progress_visuals_changed';

function parseBool(raw, fallback) {
  const s = String(raw ?? '').trim().toLowerCase();
  if (s === '1' || s === 'true' || s === 'yes' || s === 'on') return true;
  if (s === '0' || s === 'false' || s === 'no' || s === 'off') return false;
  return fallback;
}

export function getLocalShowProgressVisuals() {
  try {
    const raw = window?.localStorage?.getItem(LS_KEY);
    // Default: ON
    return parseBool(raw, true);
  } catch {
    return true;
  }
}

export function setLocalShowProgressVisuals(value) {
  const next = Boolean(value);
  try {
    window?.localStorage?.setItem(LS_KEY, next ? '1' : '0');
  } catch {
    // ignore
  }

  try {
    window?.dispatchEvent?.(new Event(PROGRESS_VISUALS_CHANGED_EVENT));
  } catch {
    // ignore
  }

  return next;
}
