import type { Loader, LoaderContext } from 'astro/loaders';

// Fonte dos artigos em produção: a database "Artigos Mente Curiosa" no Notion.
// Só entra o que está com Status = "Publicado". O build lê o Notion a cada deploy.

const NOTION_API = 'https://api.notion.com/v1';
const NOTION_VERSION = '2022-06-28';

// Capa usada enquanto o artigo não tem imagem própria (as fotos do Notion ainda não são baixadas).
export const CAPA_PADRAO = '/images/og-default.webp';

type Rich = { plain_text: string; href: string | null; annotations: { bold: boolean; italic: boolean; code: boolean } };
type Block = { id: string; type: string; has_children?: boolean; [key: string]: any };
type Page = { id: string; last_edited_time: string; properties: Record<string, any> };

async function notion<T>(path: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
  const res = await fetch(`${NOTION_API}${path}`, {
    method: init.method ?? 'GET',
    headers: {
      Authorization: `Bearer ${process.env.NOTION_API_KEY}`,
      'Notion-Version': NOTION_VERSION,
      'Content-Type': 'application/json',
    },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
  });
  if (!res.ok) throw new Error(`Notion ${res.status} em ${path}: ${await res.text()}`);
  return res.json() as Promise<T>;
}

async function todasPaginas<T>(path: string, body: Record<string, unknown> = {}): Promise<T[]> {
  const out: T[] = [];
  let cursor: string | undefined;
  do {
    const page: { results: T[]; has_more: boolean; next_cursor: string | null } = await notion(path, {
      method: path.includes('/query') ? 'POST' : 'GET',
      body: { ...body, page_size: 100, ...(cursor ? { start_cursor: cursor } : {}) },
    });
    out.push(...page.results);
    cursor = page.has_more ? (page.next_cursor ?? undefined) : undefined;
  } while (cursor);
  return out;
}

// Propriedades do Notion -> texto puro.
const texto = (prop: any): string => (prop?.rich_text ?? prop?.title ?? []).map((t: Rich) => t.plain_text).join('').trim();
const select = (prop: any): string => prop?.select?.name ?? '';
const data = (prop: any): string | undefined => prop?.date?.start ?? undefined;

// Rich text -> Markdown (negrito, itálico, código e links).
function inline(rich: Rich[] = []): string {
  return rich
    .map((t) => {
      let s = t.plain_text;
      if (t.annotations.code) s = `\`${s}\``;
      if (t.annotations.bold) s = `**${s}**`;
      if (t.annotations.italic) s = `*${s}*`;
      if (t.href) s = `[${s}](${t.href})`;
      return s;
    })
    .join('');
}

async function filhos(blockId: string): Promise<Block[]> {
  return todasPaginas<Block>(`/blocks/${blockId}/children`);
}

// Blocos -> Markdown. Cobre os tipos que os artigos usam: títulos, parágrafos, listas, citações e divisores.
async function paraMarkdown(blocks: Block[], recuo = ''): Promise<string> {
  const linhas: string[] = [];
  let numero = 0;
  for (const b of blocks) {
    const t = b.type;
    const conteudo = b[t] ?? {};
    if (t !== 'numbered_list_item') numero = 0;
    switch (t) {
      case 'heading_1':
        linhas.push(`# ${inline(conteudo.rich_text)}`);
        break;
      case 'heading_2':
        linhas.push(`## ${inline(conteudo.rich_text)}`);
        break;
      case 'heading_3':
        linhas.push(`### ${inline(conteudo.rich_text)}`);
        break;
      case 'paragraph':
        linhas.push(`${recuo}${inline(conteudo.rich_text)}`);
        break;
      case 'bulleted_list_item':
        linhas.push(`${recuo}- ${inline(conteudo.rich_text)}`);
        break;
      case 'numbered_list_item':
        numero += 1;
        linhas.push(`${recuo}${numero}. ${inline(conteudo.rich_text)}`);
        break;
      case 'quote':
        linhas.push(`> ${inline(conteudo.rich_text)}`);
        break;
      case 'divider':
        linhas.push('---');
        break;
      default:
        // Tipo não suportado: não quebra o build, só fica de fora do corpo.
        continue;
    }
    linhas.push('');
    if (b.has_children) linhas.push(await paraMarkdown(await filhos(b.id), `${recuo}  `));
  }
  return linhas.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

// "Fontes": uma por linha, no formato "Título | https://..."
function fontes(texto: string) {
  return texto
    .split('\n')
    .map((linha) => linha.trim())
    .filter(Boolean)
    .map((linha) => {
      const [title, ...resto] = linha.split(/\s\|\s/);
      return { title: title.trim(), url: resto.join(' | ').trim() };
    })
    .filter((f) => /^https?:\/\//.test(f.url));
}

// Página do Notion -> dados no formato do schema de artigos.
function paraDados(page: Page) {
  const p = page.properties;
  const publicado = data(p['Data']) ?? page.last_edited_time.slice(0, 10);
  const editado = page.last_edited_time.slice(0, 10);
  const alt = texto(p['Alt da capa']);
  const titulo = texto(p['Título']);
  const lista = fontes(texto(p['Fontes']));
  return {
    id: texto(p['ID']),
    title: titulo,
    seoTitle: texto(p['Título SEO']) || undefined,
    slug: texto(p['Slug']),
    description: texto(p['Descrição']),
    category: select(p['Categoria']),
    tags: texto(p['Tags'])
      .split(',')
      .map((t) => t.trim())
      .filter((t) => t.length >= 2)
      .slice(0, 8),
    keyword: texto(p['Palavra-chave']),
    datePublished: new Date(publicado),
    dateModified: new Date(editado > publicado ? editado : publicado),
    featuredImage: CAPA_PADRAO,
    featuredImageAlt: alt.length >= 10 ? alt : `Ilustração sobre o tema: ${titulo}`,
    sources: lista.length ? lista : undefined,
    draft: false,
  };
}

/**
 * Loader do Astro: lê os artigos publicados no Notion e grava na coleção "artigos".
 * Um artigo inválido não derruba o build: é listado no log e fica de fora até ser corrigido no Notion.
 */
export function notionArtigosLoader(): Loader {
  return {
    name: 'notion-artigos',
    load: async (context: LoaderContext) => {
      const { store, parseData, renderMarkdown, generateDigest, logger } = context;
      const dbId = process.env.NOTION_ARTIGOS_DB;
      if (!process.env.NOTION_API_KEY || !dbId) {
        throw new Error('Notion: defina NOTION_API_KEY e NOTION_ARTIGOS_DB no ambiente.');
      }

      store.clear();
      const paginas = await todasPaginas<Page>(`/databases/${dbId}/query`, {
        filter: { property: 'Status', select: { equals: 'Publicado' } },
      });
      logger.info(`Notion: ${paginas.length} artigo(s) publicado(s).`);

      for (const page of paginas) {
        const dados = paraDados(page);
        try {
          const corpo = await paraMarkdown(await filhos(page.id));
          const parsed = await parseData({ id: dados.slug, data: dados });
          const rendered = await renderMarkdown(corpo);
          store.set({ id: dados.slug, data: parsed, body: corpo, rendered, digest: generateDigest({ ...dados, corpo }) });
        } catch (erro) {
          logger.error(`Notion: artigo "${dados.title || page.id}" ficou de fora: ${(erro as Error).message}`);
        }
      }
    },
  };
}
