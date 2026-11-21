import { Helmet } from 'react-helmet-async';
import { LOGO_URL, SITE_DOMAIN, SITE_NAME, SITE_TAGLINE } from '../../lib/constants';

export interface SeoHeadProps {
  title: string;
  ogTitle?: string;
  description?: string;
  url?: string;
  image?: string;
  type?: string;
}

export function formatMetaDescription(text?: string, fallback?: string): string {
  const cleaned = (text || '').replace(/\s+/g, ' ').trim();
  const value = cleaned || fallback || SITE_TAGLINE;
  if (value.length <= 160) return value;
  return `${value.slice(0, 157).trimEnd()}...`;
}

export function SeoHead({
  title,
  ogTitle,
  description,
  url,
  image = LOGO_URL,
  type = 'website',
}: SeoHeadProps) {
  const resolvedOgTitle = ogTitle?.trim() || title;
  const resolvedPageTitle = title.includes(SITE_NAME)
    ? title
    : `${title} | ${SITE_NAME}`;
  const resolvedDescription = formatMetaDescription(description);
  const resolvedUrl =
    url ||
    (typeof window !== 'undefined'
      ? window.location.href
      : `https://${SITE_DOMAIN}`);

  const safeImage =
    image && !image.trim().startsWith('data:') ? image.trim() : LOGO_URL;

  return (
    <Helmet>
      <title>{resolvedPageTitle}</title>
      <meta name="description" content={resolvedDescription} />
      <meta property="og:type" content={type} />
      <meta property="og:site_name" content={SITE_NAME} />
      <meta property="og:title" content={resolvedOgTitle} />
      <meta property="og:description" content={resolvedDescription} />
      <meta property="og:image" content={safeImage} />
      <meta property="og:url" content={resolvedUrl} />
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={resolvedOgTitle} />
      <meta name="twitter:description" content={resolvedDescription} />
      <meta name="twitter:image" content={safeImage} />
    </Helmet>
  );
}
