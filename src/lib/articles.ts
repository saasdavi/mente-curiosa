import { getCollection, type CollectionEntry } from 'astro:content';

export type Article = CollectionEntry<'artigos'>;

export const articleUrl = (slug: string) => `/${slug}/`;

let cache: Article[] | undefined;

/**
 * Artigos publicáveis, do mais novo para o mais antigo.
 * Artigo sem capa (ainda com imagensPlano, esperando a automação de imagens) nunca vai ao ar,
 * nem em desenvolvimento: todo artigo publicado sobe com imagem.
 * Em produção ficam de fora: rascunhos (draft: true) e artigos com
 * datePublished no futuro — é assim que o agendamento funciona:
 * o artigo entra no repositório antes e aparece no primeiro build após a data.
 */
export async function getArticles(): Promise<Article[]> {
  if (cache) return cache;
  const now = new Date();
  const all = await getCollection('artigos');
  assertUnique(all);
  cache = all
    .filter((a) => Boolean(a.data.featuredImage))
    .filter((a) => import.meta.env.DEV || (!a.data.draft && a.data.datePublished <= now))
    .sort((a, b) => b.data.datePublished.getTime() - a.data.datePublished.getTime());
  return cache;
}

/** id e slug precisam ser únicos em todo o acervo (inclusive rascunhos). */
function assertUnique(all: Article[]) {
  const seen = { id: new Map<string, string>(), slug: new Map<string, string>() };
  for (const a of all) {
    for (const key of ['id', 'slug'] as const) {
      const value = a.data[key];
      const other = seen[key].get(value);
      if (other) throw new Error(`${key} duplicado "${value}": ${other} e ${a.filePath}`);
      seen[key].set(value, a.filePath ?? a.id);
    }
  }
}

/** Links internos automáticos: mesma categoria + tags em comum. */
export function getRelated(article: Article, all: Article[], limit = 4): Article[] {
  const tags = new Set(article.data.tags);
  return all
    .filter((a) => a.data.slug !== article.data.slug)
    .map((a) => ({
      a,
      score:
        (a.data.category === article.data.category ? 2 : 0) +
        a.data.tags.filter((t) => tags.has(t)).length,
    }))
    .filter((x) => x.score > 0)
    .sort((x, y) => y.score - x.score || y.a.data.datePublished.getTime() - x.a.data.datePublished.getTime())
    .slice(0, limit)
    .map((x) => x.a);
}

export const formatDate = (d: Date) =>
  d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric', timeZone: 'UTC' });

export const isoDate = (d: Date) => d.toISOString().slice(0, 10);

/** Tempo de leitura aproximado (200 palavras/min). */
export const readingTime = (body = '') => Math.max(1, Math.round(body.split(/\s+/).length / 200));
