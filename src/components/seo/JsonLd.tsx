/**
 * JSON-LD structured data components for SEO.
 * Renders BreadcrumbList and WebSite SearchAction schemas.
 */

import { Helmet } from 'react-helmet-async';
import { useLocation } from 'react-router-dom';
import { SITE_URL, ROUTE_SEO } from './seoConfig';

/** Derive breadcrumb items from pathname */
function buildBreadcrumbs(pathname: string) {
  const items: { name: string; url: string }[] = [
    { name: 'Home', url: SITE_URL },
  ];

  if (pathname === '/' || pathname === '/swap') return items;

  const segments = pathname.split('/').filter(Boolean);
  let path = '';

  for (const seg of segments) {
    path += `/${seg}`;
    const seo = ROUTE_SEO[path];
    const name = seo
      ? seo.h1
      : seg.charAt(0).toUpperCase() + seg.slice(1).replace(/-/g, ' ');
    items.push({ name, url: `${SITE_URL}${path}` });
  }

  return items;
}

export function BreadcrumbJsonLd() {
  const { pathname } = useLocation();
  const crumbs = buildBreadcrumbs(pathname);

  if (crumbs.length <= 1) return null;

  const schema = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: crumbs.map((c, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: c.name,
      item: c.url,
    })),
  };

  return (
    <Helmet>
      <script type="application/ld+json">{JSON.stringify(schema)}</script>
    </Helmet>
  );
}

export function WebSiteJsonLd() {
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: 'Crypto DeFi Bridge',
    url: SITE_URL,
    potentialAction: {
      '@type': 'SearchAction',
      target: {
        '@type': 'EntryPoint',
        urlTemplate: `${SITE_URL}/earn?q={search_term_string}`,
      },
      'query-input': 'required name=search_term_string',
    },
  };

  return (
    <Helmet>
      <script type="application/ld+json">{JSON.stringify(schema)}</script>
    </Helmet>
  );
}
