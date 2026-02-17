const cache = new Map();
const inflight = new Map();

const MAX_ENTRIES = 200;
const SWEEP_INTERVAL_MS = 60_000;

function nowMs() {
  return Date.now();
}

function normalizeTtlMs(ttlMs) {
  const n = Number(ttlMs);
  if (!Number.isFinite(n) || n <= 0) return 0;
  return Math.floor(n);
}

/** Remove all expired entries. Called periodically. */
function sweep() {
  const now = nowMs();
  for (const [key, entry] of cache) {
    if (entry.expiresAtMs > 0 && entry.expiresAtMs <= now) {
      cache.delete(key);
    }
  }
}

/** Evict oldest entries (by insertion order) until size <= MAX_ENTRIES. */
function evictIfOverSize() {
  if (cache.size <= MAX_ENTRIES) return;
  const excess = cache.size - MAX_ENTRIES;
  let removed = 0;
  for (const key of cache.keys()) {
    if (removed >= excess) break;
    cache.delete(key);
    removed++;
  }
}

// Start periodic sweep (self-cleaning; no-op in SSR)
let sweepTimer = null;
function ensureSweep() {
  if (sweepTimer != null) return;
  if (typeof setInterval !== 'function') return;
  sweepTimer = setInterval(sweep, SWEEP_INTERVAL_MS);
  // Allow the process/tab to exit without the timer keeping it alive.
  if (sweepTimer && typeof sweepTimer === 'object' && typeof sweepTimer.unref === 'function') {
    sweepTimer.unref();
  }
}
ensureSweep();

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
  evictIfOverSize();
}

export function clearCache({ prefix } = {}) {
  if (!prefix) {
    cache.clear();
    inflight.clear();
    return;
  }

  const p = String(prefix);
  for (const key of cache.keys()) {
    if (key.startsWith(p)) cache.delete(key);
  }
  for (const key of inflight.keys()) {
    if (key.startsWith(p)) inflight.delete(key);
  }
}

export async function withCache(key, { ttlMs = 0 } = {}, loader) {
  const cached = getCachedValue(key);
  if (cached != null) return cached;

  // Deduplicate concurrent in-flight requests for the same key.
  const pending = inflight.get(key);
  if (pending) return pending;

  const promise = loader().then(
    (value) => {
      inflight.delete(key);
      setCachedValue(key, value, { ttlMs });
      return value;
    },
    (err) => {
      inflight.delete(key);
      throw err;
    },
  );

  inflight.set(key, promise);
  return promise;
}
