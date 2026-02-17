import { useEffect, useRef } from 'react';
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
  twitterImage,
  noindex = false,
  jsonLd,
}) {
  const ownerIdRef = useRef(null);
  if (!ownerIdRef.current) {
    ownerIdRef.current = `seo-${Math.random().toString(36).slice(2)}-${Date.now()}`;
  }

  useEffect(() => {
    if (typeof document === 'undefined') return;

    const ownerId = ownerIdRef.current;

    const metaSelector = ({ name, property }) => {
      if (name) return `meta[name="${CSS.escape(name)}"]`;
      if (property) return `meta[property="${CSS.escape(property)}"]`;
      return null;
    };

    const getMetaContent = (attrs) => {
      const sel = metaSelector(attrs);
      if (!sel) return null;
      const el = document.head.querySelector(sel);
      return el ? el.getAttribute('content') : null;
    };

    const getLinkHref = (rel) => {
      const r = String(rel ?? '').trim();
      if (!r) return null;
      const el = document.head.querySelector(`link[rel="${CSS.escape(r)}"]`);
      return el ? el.getAttribute('href') : null;
    };

    const removeJsonLdOwned = () => {
      document.head
        .querySelectorAll(
          `script[type="application/ld+json"][data-seo-id^="${CSS.escape(`seo-jsonld-${ownerId}-`)}"]`
        )
        .forEach((el) => el.remove());
    };

    const nextTitle = buildTitle(title);
    const nextDescription = String(description ?? '').trim() || DEFAULT_DESCRIPTION;

    const ogImage = image || '/og/og-image.png';
    const twImage = twitterImage || ogImage;
    const isSvg = (p) => String(p ?? '').toLowerCase().includes('.svg');

    const url = toAbsoluteUrl(path || (typeof window !== 'undefined' ? window.location.pathname : '/'));
    const canonicalUrl = toAbsoluteUrl(
      canonicalPath || (typeof window !== 'undefined' ? window.location.pathname : '/'),
    );

    const prevTitle = document.title;

    const plannedMeta = [
      { name: 'description', content: nextDescription },

      { property: 'og:site_name', content: SITE_NAME },
      { property: 'og:title', content: nextTitle },
      { property: 'og:description', content: nextDescription },
      { property: 'og:type', content: String(type ?? 'website') },
      { property: 'og:url', content: url },
      { property: 'og:image', content: toAbsoluteUrl(ogImage) },

      { name: 'twitter:image', content: toAbsoluteUrl(twImage) },
      { name: 'twitter:card', content: (!isSvg(twImage) && !isSvg(ogImage)) ? 'summary_large_image' : 'summary' },
      { name: 'twitter:title', content: nextTitle },
      { name: 'twitter:description', content: nextDescription },

      { name: 'robots', content: noindex ? 'noindex,nofollow' : 'index,follow' },
    ];

    const prevMeta = plannedMeta.map((m) => ({
      key: m,
      prevContent: getMetaContent(m),
    }));

    const prevCanonicalHref = getLinkHref('canonical');

    setDocumentTitle(nextTitle);

    upsertLink({ rel: 'canonical', href: canonicalUrl });

    for (const m of plannedMeta) upsertMeta(m);

    // JSON-LD (owned IDs so cleanup doesn't fight the next page)
    removeJsonLdOwned();
    if (Array.isArray(jsonLd)) {
      jsonLd.forEach((item, idx) => upsertJsonLd({ id: `seo-jsonld-${ownerId}-${idx}`, json: item }));
    } else if (jsonLd) {
      upsertJsonLd({ id: `seo-jsonld-${ownerId}-0`, json: jsonLd });
    }

    return () => {
      // Restore title only if we still own it.
      if (document.title === nextTitle) document.title = prevTitle;

      // Restore canonical only if we still own it.
      const currentCanonical = getLinkHref('canonical');
      if (currentCanonical === canonicalUrl) {
        if (prevCanonicalHref == null) {
          const el = document.head.querySelector('link[rel="canonical"]');
          if (el) el.remove();
        } else {
          upsertLink({ rel: 'canonical', href: prevCanonicalHref });
        }
      }

      // Restore meta tags only if they still match what we set.
      for (const item of prevMeta) {
        const { key, prevContent } = item;
        const sel = metaSelector(key);
        if (!sel) continue;
        const el = document.head.querySelector(sel);
        if (!el) continue;

        const current = el.getAttribute('content');
        const expected = String(key.content ?? '').trim();
        if (current !== expected) continue;

        if (prevContent == null) {
          el.remove();
        } else {
          el.setAttribute('content', prevContent);
        }
      }

      removeJsonLdOwned();
    };
  }, [title, description, path, canonicalPath, type, image, twitterImage, noindex, jsonLd]);

  return null;
}
