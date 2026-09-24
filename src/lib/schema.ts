// Dados estruturados (schema.org). Gerados a partir dos dados do artigo — nunca escritos à mão.
import { SITE } from '../config/site';
import { getCategory, categoryUrl } from '../config/categories';
import { articleUrl, type Article } from './articles';

const abs = (path: string) => new URL(path, SITE.url).href;

export const organizationJsonLd = () => ({
  '@type': 'Organization',
  '@id': abs('/#organization'),
  name: SITE.name,
  url: abs('/'),
  logo: { '@type': 'ImageObject', url: abs('/logo.png'), width: 512, height: 512 },
  sameAs: Object.values(SITE.social).filter(Boolean),
});

export const websiteJsonLd = () => ({
  '@context': 'https://schema.org',
  '@type': 'WebSite',
  '@id': abs('/#website'),
  name: SITE.name,
  url: abs('/'),
  inLanguage: SITE.lang,
  publisher: organizationJsonLd(),
});

export function articleJsonLd(a: Article) {
  const d = a.data;
  const url = abs(articleUrl(d.slug));
  return {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    '@id': `${url}#article`,
    mainEntityOfPage: { '@type': 'WebPage', '@id': url },
    headline: d.title,
    description: d.description,
    image: { '@type': 'ImageObject', url: abs(d.featuredImage), width: SITE.image.width, height: SITE.image.height },
    datePublished: d.datePublished.toISOString(),
    dateModified: d.dateModified.toISOString(),
    author: { '@type': 'Organization', name: d.author, url: abs('/sobre/') },
    publisher: organizationJsonLd(),
    articleSection: getCategory(d.category).name,
    keywords: d.tags.join(', '),
    inLanguage: SITE.lang,
    ...(d.sources?.length ? { citation: d.sources.map((s) => s.url) } : {}),
  };
}

export function breadcrumbJsonLd(items: { name: string; path: string }[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((c, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: c.name,
      item: abs(c.path),
    })),
  };
}

export const articleCrumbs = (a: Article) => {
  const cat = getCategory(a.data.category);
  return [
    { name: 'Início', path: '/' },
    { name: cat.name, path: categoryUrl(cat.slug) },
    { name: a.data.title, path: articleUrl(a.data.slug) },
  ];
};
