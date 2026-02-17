const cache = new Map();

function nowMs() {
  return Date.now();
}

function normalizeTtlMs(ttlMs) {
  const n = Number(ttlMs);
  if (!Number.isFinite(n) || n <= 0) return 0;
  return Math.floor(n);
}

export function makeCacheKey(parts) {
  if (!Array.isArray(parts)) return String(parts ?? '');
  return parts
    .map((p) => {
      if (p == null) return '';
      if (typeof p === 'string') return p;
      if (typeof p === 'number' || typeof p === 'boolean') return String(p);
      try {
        return JSON.stringify(p);
      } catch {
        return String(p);
      }
    })
    .join('|');
}

export function getCachedValue(key) {
  const k = String(key ?? '');
  if (!k) return null;

  const entry = cache.get(k);
  if (!entry) return null;

  if (entry.expiresAtMs > 0 && entry.expiresAtMs <= nowMs()) {
    cache.delete(k);
    return null;
  }

  return entry.value;
}

export function setCachedValue(key, value, { ttlMs = 0 } = {}) {
  const k = String(key ?? '');
  if (!k) return;

  const ttl = normalizeTtlMs(ttlMs);
  const expiresAtMs = ttl > 0 ? nowMs() + ttl : 0;
  cache.set(k, { value, expiresAtMs });
}

export function clearCache({ prefix } = {}) {
  if (!prefix) {
    cache.clear();
    return;
  }

  const p = String(prefix);
  for (const key of cache.keys()) {
    if (key.startsWith(p)) cache.delete(key);
  }
}

export async function withCache(key, { ttlMs = 0 } = {}, loader) {
  const cached = getCachedValue(key);
  if (cached != null) return cached;

  const value = await loader();
  setCachedValue(key, value, { ttlMs });
  return value;
}
