import { Helmet } from 'react-helmet-async';
import { useLocation } from 'react-router-dom';
import { getRouteSeo, getCanonicalUrl, SITE_URL } from './seoConfig';
import { BreadcrumbJsonLd } from './JsonLd';

interface SeoHeadProps {
  title?: string;
  description?: string;
  noindex?: boolean;
}

export function SeoHead({ title, description, noindex }: SeoHeadProps) {
  const { pathname } = useLocation();
  const seo = getRouteSeo(pathname);
  const canonical = getCanonicalUrl(pathname);

  const pageTitle = title ?? seo.title;
  const pageDescription = description ?? seo.description;

  return (
    <>
      <Helmet>
        <title>{pageTitle}</title>
        <meta name="description" content={pageDescription} />
        <meta name="robots" content={noindex ? 'noindex, nofollow' : 'index, follow'} />
        <link rel="canonical" href={canonical} />

        {/* Open Graph */}
        <meta property="og:title" content={pageTitle} />
        <meta property="og:description" content={pageDescription} />
        <meta property="og:url" content={canonical} />
        <meta property="og:type" content="website" />
        <meta property="og:image" content={`${SITE_URL}/og-image.png`} />
        <meta property="og:site_name" content="Crypto DeFi Bridge" />

        {/* Twitter */}
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={pageTitle} />
        <meta name="twitter:description" content={pageDescription} />
        <meta name="twitter:image" content={`${SITE_URL}/og-image.png`} />
      </Helmet>
      <BreadcrumbJsonLd />
    </>
  );
}
