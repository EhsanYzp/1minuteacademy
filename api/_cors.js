function normalizeOrigin(input) {
  let raw = String(input ?? '').trim();
  if (!raw) return null;

  // Fix common env-var typos like `https;//example.com` or `https:;//example.com`
  raw = raw.replace(/^https?;\/\//i, 'https://');
  raw = raw.replace(/^https?:;\/\//i, 'https://');
  raw = raw.replace(/^http;\/\//i, 'http://');
  raw = raw.replace(/^https?:\/\/\//i, (m) => m.slice(0, 8)); // collapse `https:////` -> `https://`

  const hasScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(raw);
  const withScheme = hasScheme ? raw : `https://${raw}`;

  try {
    const u = new URL(withScheme);
    return `${u.protocol}//${u.host}`;
  } catch {
    return null;
  }
}

function addVary(res, value) {
  const prev = res.getHeader('Vary');
  const prevStr = Array.isArray(prev) ? prev.join(', ') : String(prev ?? '').trim();
  const parts = prevStr ? prevStr.split(',').map((p) => p.trim()).filter(Boolean) : [];
  const has = parts.some((p) => p.toLowerCase() === String(value).toLowerCase());
  if (!has) parts.push(String(value));
  res.setHeader('Vary', parts.join(', '));
}

function isAllowedDevOrigin(origin) {
  if (!origin) return false;
  return (
    origin.startsWith('http://localhost:') ||
    origin.startsWith('http://127.0.0.1:') ||
    origin.startsWith('http://[::1]:')
  );
}

/**
 * Applies a strict CORS policy for browser requests.
 *
 * - Allows only the configured `SITE_URL` origin (and localhost in non-production).
 * - Responds to `OPTIONS` preflight with 204.
 * - Returns `true` if the response has been ended (preflight handled).
 */
export function applyCors(req, res, opts = {}) {
  const siteOrigin = normalizeOrigin(opts.siteUrl ?? process.env.SITE_URL);
  const requestOrigin = normalizeOrigin(req.headers?.origin);

  // Non-browser / server-to-server requests typically have no Origin header.
  if (!requestOrigin) {
    if (req.method === 'OPTIONS') {
      res.statusCode = 204;
      res.end();
      return true;
    }
    return false;
  }

  const isDev = String(process.env.NODE_ENV ?? '').toLowerCase() !== 'production';
  const allowed = (siteOrigin && requestOrigin === siteOrigin) || (isDev && isAllowedDevOrigin(requestOrigin));

  if (!allowed) {
    if (req.method === 'OPTIONS') {
      res.statusCode = 403;
      res.end();
      return true;
    }
    return false;
  }

  addVary(res, 'Origin');
  res.setHeader('Access-Control-Allow-Origin', requestOrigin);
  res.setHeader('Access-Control-Allow-Credentials', 'true');

  if (req.method === 'OPTIONS') {
    const allowMethods = opts.allowMethods ?? 'GET,POST,PUT,PATCH,DELETE,OPTIONS';
    const requestedHeaders = req.headers?.['access-control-request-headers'];
    const allowHeaders = requestedHeaders
      ? String(requestedHeaders)
      : (opts.allowHeaders ?? 'Authorization, Content-Type, Stripe-Signature');

    res.setHeader('Access-Control-Allow-Methods', allowMethods);
    res.setHeader('Access-Control-Allow-Headers', allowHeaders);
    res.setHeader('Access-Control-Max-Age', String(opts.maxAgeSeconds ?? 600));

    res.statusCode = 204;
    res.end();
    return true;
  }

  return false;
}

export const _internal = { normalizeOrigin };
