// Monta o arquivo .md do artigo (frontmatter no schema do site) e grava texto e imagens.
import yaml from 'js-yaml';
import { mkdirSync, writeFileSync, readdirSync, readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { CFG } from './config.mjs';

export function garantirAviso(corpo, categoria) {
  if (!CFG.categoriasSaude.includes(categoria)) return corpo;
  if (/não substitui a orientação de um profissional de saúde/i.test(corpo)) return corpo;
  return `${corpo.trim()}\n\n*${CFG.avisoSaude}*\n`;
}

export function montarFrontmatter({ linha, meta, imagens, fontesValidas, autor = CFG.autorPadrao }) {
  const slug = linha['Slug'];
  const dir = `/images/${slug}`;
  const fm = {
    id: linha['ID Artigo'],
    title: meta.title,
    ...(meta.seoTitle ? { seoTitle: meta.seoTitle } : {}),
    slug,
    description: meta.description,
    category: linha['Categoria (slug)'],
    tags: meta.tags,
    keyword: linha['Palavra-chave'],
    author: autor,
    datePublished: linha.dataISO,
    dateModified: linha.dataISO,
    featuredImage: `${dir}/${imagens.capa.arquivo}`,
    featuredImageAlt: imagens.capa.alt,
    sources: fontesValidas.map((f) => ({ title: f.title, url: f.url })),
    imageCredit: imagens.capa.credito,
    images: imagens.fotos.map((f) => ({
      src: `${dir}/${f.arquivo}`,
      alt: f.alt,
      caption: f.legenda,
      section: f.secao,
      width: 1200,
      height: 800,
      credit: f.credito,
    })),
    altConferido: true, // a foto foi olhada por IA e confere com o alt (portão P7)
    draft: false,
  };
  return fm;
}

export function textoDoArquivo(frontmatter, corpo) {
  const y = yaml.dump(frontmatter, { lineWidth: -1, noRefs: true, quotingType: '"' });
  return `---\n${y}---\n\n${corpo.trim()}\n`;
}

/** Grava o .md e as imagens no disco. Retorna a lista de caminhos criados. */
export function gravarArtigo({ raiz = '.', frontmatter, corpo, imagens }) {
  const slug = frontmatter.slug;
  const criados = [];
  const md = join(raiz, 'src/content/artigos', `${slug}.md`);
  mkdirSync(join(raiz, 'src/content/artigos'), { recursive: true });
  writeFileSync(md, textoDoArquivo(frontmatter, corpo));
  criados.push(md);
  const pasta = join(raiz, 'public/images', slug);
  mkdirSync(pasta, { recursive: true });
  for (const im of [imagens.capa, ...imagens.fotos]) {
    const p = join(pasta, im.arquivo);
    writeFileSync(p, im.buffer);
    criados.push(p);
  }
  return criados;
}

/** Lê os artigos existentes: slugs, ids, keywords, datas, textos e URLs de crédito já usadas. */
export function lerAcervo(raiz = '.') {
  const dir = join(raiz, 'src/content/artigos');
  const itens = [];
  if (!existsSync(dir)) return itens;
  for (const f of readdirSync(dir).filter((x) => x.endsWith('.md'))) {
    const raw = readFileSync(join(dir, f), 'utf8');
    const m = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
    if (!m) continue;
    const data = yaml.load(m[1]) ?? {};
    // O YAML entrega datas sem aspas como objeto Date; padroniza para AAAA-MM-DD.
    for (const k of ['datePublished', 'dateModified']) {
      if (data[k] instanceof Date) data[k] = data[k].toISOString().slice(0, 10);
      else if (data[k]) data[k] = String(data[k]).slice(0, 10);
    }
    itens.push({ arquivo: f, data, corpo: m[2] });
  }
  return itens;
}

export function urlsDeCreditoUsadas(acervo) {
  const s = new Set();
  for (const a of acervo) {
    if (a.data.imageCredit?.url) s.add(a.data.imageCredit.url);
    for (const i of a.data.images ?? []) if (i.credit?.url) s.add(i.credit.url);
  }
  return s;
}
