/**
 * Server-rendered route metadata.
 *
 * `usePageMeta` mutates document.head after hydration, which crawlers and
 * social-preview scrapers never see. Routes call `routeMeta()` from their
 * `head()` option so the exact same title/description/OG tags are present in
 * the server-rendered HTML.
 */

const BASE_TITLE = 'Shuffle Security';
const BASE_URL = 'https://shuffle.security';
const DEFAULT_IMAGE = `${BASE_URL}/og-image.png`;

export interface BreadcrumbItem {
  name: string;
  /** Site-relative path, e.g. `/docs/getting-started`. */
  path: string;
}

export interface RouteMetaInput {
  title: string;
  description: string;
  url: string;
  image?: string;
  type?: string;
  /** Product/app pages: keep them out of search results. */
  noindex?: boolean;
  /** Breadcrumb trail for this page (excluding the page itself). */
  breadcrumbs?: BreadcrumbItem[];
}

/** BreadcrumbList JSON-LD entry for `head().scripts`. */
const breadcrumbJsonLd = (url: string, title: string, trail: BreadcrumbItem[]) => ({
  type: 'application/ld+json',
  children: JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      ...trail.map((item, i) => ({
        '@type': 'ListItem',
        position: i + 1,
        name: item.name,
        item: `${BASE_URL}${item.path}`,
      })),
      {
        '@type': 'ListItem',
        position: trail.length + 1,
        name: title,
        item: `${BASE_URL}${url}`,
      },
    ],
  }),
});

export const routeMeta = ({ title, description, url, image, type = 'website', noindex, breadcrumbs }: RouteMetaInput) => {
  const fullTitle = title.includes(BASE_TITLE) ? title : `${title} | ${BASE_TITLE}`;
  const fullUrl = `${BASE_URL}${url}`;
  const img = image || DEFAULT_IMAGE;

  return {
    meta: [
      { title: fullTitle },
      { name: 'description', content: description },
      { property: 'og:title', content: fullTitle },
      { property: 'og:description', content: description },
      { property: 'og:image', content: img },
      { property: 'og:image:alt', content: title },
      { property: 'og:url', content: fullUrl },
      { property: 'og:type', content: type },
      { property: 'og:site_name', content: BASE_TITLE },
      { property: 'og:locale', content: 'en_US' },
      { name: 'twitter:card', content: 'summary_large_image' },
      { name: 'twitter:site', content: '@shuffleio' },
      { name: 'twitter:title', content: fullTitle },
      { name: 'twitter:description', content: description },
      { name: 'twitter:image', content: img },
      { name: 'twitter:image:alt', content: title },
      ...(noindex ? [{ name: 'robots', content: 'noindex, nofollow' }] : []),
    ],
    links: noindex ? [] : [{ rel: 'canonical', href: fullUrl }],
    scripts: breadcrumbs && breadcrumbs.length > 0 ? [breadcrumbJsonLd(url, title, breadcrumbs)] : [],
  };
};
