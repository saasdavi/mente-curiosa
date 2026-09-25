// Peças prontas para as redes (fan page e Pinterest), lidas pelo n8n via /feed.xml e /social.json.
// As imagens saem do workflow "Imagens do artigo" em public/social/<slug>/.
import { existsSync } from 'node:fs';
import { SITE } from '../config/site';
import { getCategory } from '../config/categories';
import { articleUrl, type Article } from './articles';

// Mesmos ângulos de scripts/imagens/gerar.py (ANGULOS_PADRAO), na mesma ordem dos pin-N.jpg.
export const PIN_ANGLES = ['A resposta simples', 'Você sabia?', 'Mito ou verdade?', 'Em 3 pontos', 'O que a ciência diz'];

const abs = (p: string) => new URL(p, SITE.url).href;
const hashtag = (s: string) =>
  '#' + s.replace(/[^\p{L}\p{N}]+/gu, ''); // mantém acentos: #céu, #física

export function socialPack(a: Article) {
  const d = a.data;
  const cat = getCategory(d.category);
  const link = abs(articleUrl(d.slug));
  const utm = (src: string, med: string, n?: number) =>
    `${link}?utm_source=${src}&utm_medium=${med}&utm_campaign=${d.id}${n ? `&utm_content=pin-${n}` : ''}`;
  const tags = [...new Set(['MenteCuriosa', ...d.tags].map(hashtag))].slice(0, 5);
  const fb = `/social/${d.slug}/facebook.jpg`;
  const pins = PIN_ANGLES.map((angle, i) => ({ n: i + 1, angle, file: `/social/${d.slug}/pin-${i + 1}.jpg` }))
    .filter((p) => existsSync(`public${p.file}`));
  return {
    id: d.id,
    slug: d.slug,
    url: link,
    title: d.title,
    description: d.description,
    category: cat.name,
    keyword: d.keyword,
    datePublished: d.datePublished.toISOString(),
    dateModified: d.dateModified.toISOString(),
    hashtags: tags,
    facebook: {
      image: abs(existsSync(`public${fb}`) ? fb : d.featuredImage),
      imageAlt: d.featuredImageAlt,
      link: utm('facebook', 'social'),
      message: `${d.title}\n\n${d.description}\n\nLeia: ${utm('facebook', 'social')}\n\n${tags.join(' ')}`,
    },
    pinterest: pins.map((p) => ({
      n: p.n,
      angle: p.angle,
      image: abs(p.file),
      board: cat.name,
      title: `${d.title} — ${p.angle}`.slice(0, 100),
      description: `${d.description} ${tags.join(' ')}`.slice(0, 500),
      altText: `Pin do Mente Curiosa: ${d.title} (${p.angle})`.slice(0, 500),
      link: utm('pinterest', 'social', p.n),
    })),
  };
}
