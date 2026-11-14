import { serializeJsonLd } from './jsonLdGenerator';

const DYNAMIC_JSONLD_SCRIPT_ID = 'lottery-result-jsonld';

function upsertMetaTag(attr: 'name' | 'property', key: string, content: string) {
  if (!content) return;
  let el = document.querySelector(`meta[${attr}="${key}"]`) as HTMLMetaElement | null;
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.setAttribute('content', content);
}

function upsertCanonicalLink(href: string) {
  let link = document.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
  if (!link) {
    link = document.createElement('link');
    link.setAttribute('rel', 'canonical');
    document.head.appendChild(link);
  }
  link.setAttribute('href', href);
}

export function applyDynamicSeoHead({
  title,
  description,
  canonicalPath,
  jsonLd,
}: {
  title?: string;
  description?: string;
  canonicalPath: string;
  jsonLd: Record<string, unknown>;
}) {
  if (typeof document === 'undefined' || typeof window === 'undefined') return;

  const origin = window.location.origin;
  const fullCanonicalUrl = `${origin}${canonicalPath}`;

  if (title) {
    document.title = title;
    upsertMetaTag('property', 'og:title', title);
    upsertMetaTag('name', 'twitter:title', title);
  }

  if (description) {
    upsertMetaTag('name', 'description', description);
    upsertMetaTag('property', 'og:description', description);
    upsertMetaTag('name', 'twitter:description', description);
  }

  upsertCanonicalLink(fullCanonicalUrl);
  upsertMetaTag('property', 'og:url', fullCanonicalUrl);

  let scriptEl = document.getElementById(DYNAMIC_JSONLD_SCRIPT_ID) as HTMLScriptElement | null;
  if (!scriptEl) {
    scriptEl = document.createElement('script');
    scriptEl.id = DYNAMIC_JSONLD_SCRIPT_ID;
    scriptEl.type = 'application/ld+json';
    document.head.appendChild(scriptEl);
  }
  scriptEl.textContent = serializeJsonLd(jsonLd);
}
