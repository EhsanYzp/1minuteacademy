import { useEffect } from 'react';
import {
  SITE_NAME,
  setDocumentTitle,
  toAbsoluteUrl,
  upsertJsonLd,
  upsertLink,
  upsertMeta,
} from '../services/seo';

const DEFAULT_DESCRIPTION = 'One minute. One story. Real progress.';

function buildTitle(pageTitle) {
  const t = String(pageTitle ?? '').trim();
  if (!t) return SITE_NAME;
  if (t.toLowerCase().includes(SITE_NAME.toLowerCase())) return t;
  return `${t} | ${SITE_NAME}`;
}

export default function Seo({
  title,
  description,
  path,
  canonicalPath,
  type = 'website',
  image,
  noindex = false,
  jsonLd,
}) {
  useEffect(() => {
    const nextTitle = buildTitle(title);
    const nextDescription = String(description ?? '').trim() || DEFAULT_DESCRIPTION;

    const url = toAbsoluteUrl(path || (typeof window !== 'undefined' ? window.location.pathname : '/'));
    const canonicalUrl = toAbsoluteUrl(
      canonicalPath || (typeof window !== 'undefined' ? window.location.pathname : '/'),
    );

    setDocumentTitle(nextTitle);

    upsertMeta({ name: 'description', content: nextDescription });

    upsertLink({ rel: 'canonical', href: canonicalUrl });

    upsertMeta({ property: 'og:site_name', content: SITE_NAME });
    upsertMeta({ property: 'og:title', content: nextTitle });
    upsertMeta({ property: 'og:description', content: nextDescription });
    upsertMeta({ property: 'og:type', content: String(type ?? 'website') });
    upsertMeta({ property: 'og:url', content: url });

    if (image) {
      upsertMeta({ property: 'og:image', content: toAbsoluteUrl(image) });
      upsertMeta({ name: 'twitter:image', content: toAbsoluteUrl(image) });
    }

    // Twitter/X cards
    upsertMeta({ name: 'twitter:card', content: image ? 'summary_large_image' : 'summary' });
    upsertMeta({ name: 'twitter:title', content: nextTitle });
    upsertMeta({ name: 'twitter:description', content: nextDescription });

    // Robots
    upsertMeta({ name: 'robots', content: noindex ? 'noindex,nofollow' : 'index,follow' });

    // JSON-LD
    if (Array.isArray(jsonLd)) {
      jsonLd.forEach((item, idx) => upsertJsonLd({ id: `seo-jsonld-${idx}`, json: item }));
    } else if (jsonLd) {
      upsertJsonLd({ id: 'seo-jsonld-0', json: jsonLd });
    }
  }, [title, description, path, canonicalPath, type, image, noindex, jsonLd]);

  return null;
}
