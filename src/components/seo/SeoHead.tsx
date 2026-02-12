import { Helmet } from 'react-helmet-async';
import { useLocation } from 'react-router-dom';
import { getRouteSeo, getCanonicalUrl } from './seoConfig';

interface SeoHeadProps {
  /** Override auto-detected route SEO */
  title?: string;
  description?: string;
}

export function SeoHead({ title, description }: SeoHeadProps) {
  const { pathname } = useLocation();
  const seo = getRouteSeo(pathname);
  const canonical = getCanonicalUrl(pathname);

  const pageTitle = title ?? seo.title;
  const pageDescription = description ?? seo.description;

  return (
    <Helmet>
      <title>{pageTitle}</title>
      <meta name="description" content={pageDescription} />
      <meta name="robots" content="index, follow" />
      <link rel="canonical" href={canonical} />

      {/* Open Graph */}
      <meta property="og:title" content={pageTitle} />
      <meta property="og:description" content={pageDescription} />
      <meta property="og:url" content={canonical} />
      <meta property="og:type" content="website" />
      <meta property="og:image" content="https://cryptodefibridge.com/og-image.png" />

      {/* Twitter */}
      <meta name="twitter:title" content={pageTitle} />
      <meta name="twitter:description" content={pageDescription} />
    </Helmet>
  );
}
