export const SITE_NAME = '1 Minute Academy';

export function normalizeSiteUrl(input) {
  const raw = String(input ?? '').trim();
  if (!raw) return '';
  return raw.endsWith('/') ? raw.slice(0, -1) : raw;
}

export function getSiteUrl() {
  const fromEnv = normalizeSiteUrl(import.meta.env.VITE_SITE_URL);
  if (fromEnv) return fromEnv;

  // Fallback: works locally and in most deployments, but isn't as stable
  // as setting VITE_SITE_URL for canonical URLs.
  if (typeof window !== 'undefined' && window.location?.origin) {
    return normalizeSiteUrl(window.location.origin);
  }

  return '';
}

export function toAbsoluteUrl(pathname) {
  const siteUrl = getSiteUrl();
  const path = String(pathname ?? '').trim();

  if (!siteUrl) return path || '';
  if (!path) return siteUrl;
  if (path.startsWith('http://') || path.startsWith('https://')) return path;

  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${siteUrl}${normalizedPath}`;
}

function ensureTag(tagName, selector, createAttrs) {
  const existing = document.head.querySelector(selector);
  if (existing) return existing;

  const el = document.createElement(tagName);
  for (const [k, v] of Object.entries(createAttrs ?? {})) {
    el.setAttribute(k, v);
  }
  document.head.appendChild(el);
  return el;
}

export function setDocumentTitle(nextTitle) {
  if (typeof document === 'undefined') return;
  const title = String(nextTitle ?? '').trim();
  if (title) document.title = title;
}

export function upsertMeta({ name, property, content }) {
  if (typeof document === 'undefined') return;
  const c = String(content ?? '').trim();

  if (name) {
    const meta = ensureTag('meta', `meta[name="${CSS.escape(name)}"]`, { name });
    meta.setAttribute('content', c);
    return;
  }

  if (property) {
    const meta = ensureTag('meta', `meta[property="${CSS.escape(property)}"]`, { property });
    meta.setAttribute('content', c);
  }
}

export function upsertLink({ rel, href }) {
  if (typeof document === 'undefined') return;
  const r = String(rel ?? '').trim();
  const h = String(href ?? '').trim();
  if (!r) return;

  const link = ensureTag('link', `link[rel="${CSS.escape(r)}"]`, { rel: r });
  if (h) link.setAttribute('href', h);
}

export function upsertJsonLd({ id, json }) {
  if (typeof document === 'undefined') return;
  const scriptId = String(id ?? 'seo-jsonld').trim() || 'seo-jsonld';
  const selector = `script[type="application/ld+json"][data-seo-id="${CSS.escape(scriptId)}"]`;
  const script = ensureTag('script', selector, {
    type: 'application/ld+json',
    'data-seo-id': scriptId,
  });

  if (!json) {
    script.textContent = '';
    return;
  }

  script.textContent = JSON.stringify(json);
}
