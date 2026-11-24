import { Helmet } from 'react-helmet-async';
import { LOGO_URL, SITE_NAME } from '../../lib/constants';
import {
  buildCanonicalUrl,
  formatMetaDescription,
  getRobotsDirective,
} from '../../lib/seoHelpers';

export { formatMetaDescription };

export interface SeoHeadProps {
  title: string;
  ogTitle?: string;
  description?: string;
  url?: string;
  image?: string;
  type?: string;
  noIndex?: boolean;
}

export function SeoHead({
  title,
  ogTitle,
  description,
  url,
  image = LOGO_URL,
  type = 'website',
  noIndex = false,
}: SeoHeadProps) {
  const resolvedOgTitle = ogTitle?.trim() || title;
  const resolvedPageTitle = title.includes(SITE_NAME)
    ? title
    : `${title} | ${SITE_NAME}`;
  const resolvedDescription = formatMetaDescription(description);
  const resolvedCanonical = buildCanonicalUrl({
    explicitUrl: url,
    origin: typeof window !== 'undefined' ? window.location.origin : undefined,
    pathname:
      typeof window !== 'undefined' ? window.location.pathname : undefined,
  });
  const robotsDirective = getRobotsDirective(noIndex);

  const safeImage =
    image && !image.trim().startsWith('data:') ? image.trim() : LOGO_URL;

  return (
    <Helmet>
      <title>{resolvedPageTitle}</title>
      <meta name="description" content={resolvedDescription} />
      <meta name="robots" content={robotsDirective} />
      <link rel="canonical" href={resolvedCanonical} />
      <meta property="og:type" content={type} />
      <meta property="og:site_name" content={SITE_NAME} />
      <meta property="og:title" content={resolvedOgTitle} />
      <meta property="og:description" content={resolvedDescription} />
      <meta property="og:image" content={safeImage} />
      <meta property="og:url" content={resolvedCanonical} />
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={resolvedOgTitle} />
      <meta name="twitter:description" content={resolvedDescription} />
      <meta name="twitter:image" content={safeImage} />
    </Helmet>
  );
}
