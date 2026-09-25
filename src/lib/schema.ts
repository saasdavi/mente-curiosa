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

type Credit = { author: string; source: string; url?: string; license: string; licenseUrl?: string };

// ImageObject com crédito e licença: habilita o selo "Licenciável" e ajuda o Google Imagens.
const imageObject = (src: string, width: number, height: number, alt: string, credit?: Credit, caption?: string) => ({
  '@type': 'ImageObject',
  url: abs(src),
  contentUrl: abs(src),
  width,
  height,
  ...(caption || alt ? { caption: caption || alt } : {}),
  ...(credit
    ? {
        creditText: `${credit.author} / ${credit.source}`,
        creator: { '@type': credit.source === 'NASA' ? 'Organization' : 'Person', name: credit.author },
        copyrightNotice: credit.license,
        ...(credit.licenseUrl ? { license: credit.licenseUrl } : {}),
        ...(credit.url ? { acquireLicensePage: credit.url } : {}),
      }
    : {}),
});

export const articleImages = (a: Article) => [
  imageObject(a.data.featuredImage, SITE.image.width, SITE.image.height, a.data.featuredImageAlt, a.data.imageCredit),
  ...(a.data.images ?? []).map((i) => imageObject(i.src, i.width, i.height, i.alt, i.credit, i.caption)),
];

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
    image: articleImages(a),
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
