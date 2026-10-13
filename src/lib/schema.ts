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

type Faq = { question: string; answer: string };

const limpa = (texto: string) =>
  texto
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/\*\*|__|`/g, '')
    .replace(/\s+/g, ' ')
    .trim();

// Lê a seção "## Perguntas frequentes" do corpo. Aceita os formatos usados nos artigos:
// "### Pergunta", "**Pergunta?** resposta" e "**Pergunta?**" com a resposta na linha seguinte.
export function faqDoCorpo(corpo: string): Faq[] {
  const linhas = corpo.split('\n');
  const inicio = linhas.findIndex((l) => /^##\s+Perguntas frequentes\s*$/.test(l));
  if (inicio < 0) return [];

  const itens: Faq[] = [];
  let pergunta: string | null = null;
  let resposta: string[] = [];
  const fecha = () => {
    if (pergunta && resposta.length) itens.push({ question: limpa(pergunta), answer: limpa(resposta.join(' ')) });
    pergunta = null;
    resposta = [];
  };

  for (const linha of linhas.slice(inicio + 1)) {
    if (/^##\s/.test(linha)) break; // próxima seção de nível 2
    const titulo = linha.match(/^###\s+(.+)$/);
    const negrito = linha.match(/^\*\*(.+?\?)\*\*\s*(.*)$/);
    if (titulo) {
      fecha();
      pergunta = titulo[1];
    } else if (negrito) {
      fecha();
      pergunta = negrito[1];
      if (negrito[2].trim()) resposta.push(negrito[2]);
    } else if (pergunta && linha.trim()) {
      resposta.push(linha.trim());
    }
  }
  fecha();
  return itens.filter((f) => f.question.length >= 10 && f.answer.length >= 20);
}

// Frontmatter faq tem prioridade; artigos antigos usam a seção do corpo.
export const faqDoArtigo = (a: Article): Faq[] => (a.data.faq?.length ? a.data.faq : faqDoCorpo(a.body ?? ''));

export const faqJsonLd = (itens: Faq[]) => ({
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: itens.map((f) => ({
    '@type': 'Question',
    name: f.question,
    acceptedAnswer: { '@type': 'Answer', text: f.answer },
  })),
});

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
