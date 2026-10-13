// llms.txt: índice em texto puro para assistentes de IA (https://llmstxt.org).
// Usa a mesma lista de artigos do sitemap e do feed, então nunca mostra rascunho ou artigo sem capa.
import type { APIRoute } from 'astro';
import { SITE } from '../config/site';
import { CATEGORIES, getCategory } from '../config/categories';
import { getArticles, articleUrl } from '../lib/articles';

export const GET: APIRoute = async () => {
  const articles = await getArticles();
  const abs = (p: string) => new URL(p, SITE.url).href;

  const secoes = CATEGORIES.map((c) => {
    const itens = articles.filter((a) => a.data.category === c.slug);
    if (!itens.length) return '';
    const linhas = itens
      .map((a) => `- [${a.data.title}](${abs(articleUrl(a.data.slug))}): ${a.data.description}`)
      .join('\n');
    return `## ${getCategory(c.slug).name}\n\n${linhas}`;
  })
    .filter(Boolean)
    .join('\n\n');

  const body = `# ${SITE.name}

> ${SITE.description} Cada artigo responde a uma única pergunta logo na primeira frase, explica o mecanismo e lista as fontes consultadas.

- Idioma: ${SITE.lang}
- Publicado por: ${SITE.name}
- Contato: ${SITE.contactEmail}
- Citação: o conteúdo pode ser citado com atribuição e link para a URL de origem.

${secoes}

## Páginas institucionais

- [Sobre](${abs('/sobre/')}): quem escreve, processo editorial e critérios de fontes
- [Contato](${abs('/contato/')})
- [Política de privacidade](${abs('/politica-de-privacidade/')})
- [Termos de uso](${abs('/termos-de-uso/')})
`;

  return new Response(body, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
};
