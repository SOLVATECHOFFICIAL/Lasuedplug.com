import { SITE_DOMAIN, SITE_TAGLINE } from './constants';

export function formatMetaDescription(text?: string, fallback?: string): string {
  const cleaned = (text || '').replace(/\s+/g, ' ').trim();
  const value = cleaned || fallback || SITE_TAGLINE;
  if (value.length <= 160) return value;
  return `${value.slice(0, 157).trimEnd()}...`;
}

export function buildCanonicalUrl(input?: {
  explicitUrl?: string;
  origin?: string;
  pathname?: string;
}): string {
  const defaultOrigin = `https://${SITE_DOMAIN}`;
  const rawExplicit = input?.explicitUrl?.trim();

  if (rawExplicit) {
    try {
      const parsed = new URL(rawExplicit, input?.origin || defaultOrigin);
      const cleanPath =
        parsed.pathname.length > 1 && parsed.pathname.endsWith('/')
          ? parsed.pathname.slice(0, -1)
          : parsed.pathname || '/';
      return `${parsed.origin}${cleanPath}`;
    } catch {
      return `${defaultOrigin}/`;
    }
  }

  const resolvedOrigin = (input?.origin || defaultOrigin).replace(/\/+$/, '');
  const rawPathname = (input?.pathname || '/').split('?')[0].split('#')[0] || '/';
  const normalizedPath =
    rawPathname.length > 1 && rawPathname.endsWith('/')
      ? rawPathname.slice(0, -1)
      : rawPathname.startsWith('/')
        ? rawPathname
        : `/${rawPathname}`;

  return `${resolvedOrigin}${normalizedPath}`;
}

export function getRobotsDirective(noIndex?: boolean): string {
  return noIndex ? 'noindex, nofollow' : 'index, follow';
}
