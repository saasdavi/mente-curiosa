// Depois do deploy: abre o link de cada artigo, confere texto e imagens e só então muda a planilha para "publicado".
// Uso: node scripts/automacao/confirmar-no-ar.mjs [--so-conferir]   (--so-conferir não grava na planilha)
import { appendFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { CFG } from './config.mjs';
import { hojeBR, buscar, esperar, log, norm } from './util.mjs';
import { htmlParaTexto } from './fontes.mjs';
import { lerCalendario, gravarCelulas } from './sheets.mjs';
import { lerAcervo } from './artigo.mjs';

const UA = 'Mozilla/5.0 (compatible; MenteCuriosaBot/1.0; +https://www.mentecuriosa.blog)';
const PALAVRAS_MIN = 900;

/** A data que vale é a do próprio artigo no blog (pode ter sido ajustada); a da planilha é só o plano. */
export function dataEfetiva(slug, dataPlanilha, info) {
  return info.get(slug)?.data || dataPlanilha;
}

/** Artigo com horário (ex.: 18:00) só é conferido depois dessa hora; sem horário, vale o dia todo. */
export function jaPassouDoHorario(slug, info, agora = Date.now()) {
  const q = info.get(slug)?.quando;
  const t = q ? Date.parse(q) : NaN;
  return Number.isNaN(t) || t <= agora;
}

const absoluto = (src, base) => { try { return new URL(src, base).href; } catch { return null; } };

/**
 * Confere uma página publicada. Devolve { ok, problemas, palavras, imagens }.
 * buscarFn tem a mesma assinatura de util.buscar; sitemapTexto é o XML do sitemap (opcional).
 */
export async function conferirPagina({ url, titulo, buscarFn = buscar, sitemapTexto = '' }) {
  const problemas = [];
  let r;
  try {
    r = await buscarFn(url, { headers: { 'User-Agent': UA }, redirect: 'follow', tentativas: 3, timeoutMs: 20000 });
  } catch (e) {
    return { ok: false, problemas: [`não abriu (${String(e.message).slice(0, 80)})`], palavras: 0, imagens: 0 };
  }
  if (!r.ok) return { ok: false, problemas: [`a página respondeu HTTP ${r.status}`], palavras: 0, imagens: 0 };

  const html = await r.text();
  if (/<meta[^>]+name=["']robots["'][^>]+noindex/i.test(html)) problemas.push('a página está marcada noindex');

  const h1 = (html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)?.[1] ?? '').replace(/<[^>]+>/g, ' ');
  if (!h1.trim()) problemas.push('a página não tem título (h1)');
  else if (titulo && !norm(h1).includes(norm(titulo).slice(0, 25))) problemas.push(`o título da página ("${h1.trim().slice(0, 60)}") não é o do artigo`);

  const palavras = htmlParaTexto(html).split(/\s+/).filter(Boolean).length;
  if (palavras < PALAVRAS_MIN) problemas.push(`só ${palavras} palavras na página (esperado pelo menos ${PALAVRAS_MIN}); o texto pode não ter sido publicado`);

  // imagens: todas as <img> e a og:image precisam abrir e ser imagem
  const srcs = new Set();
  for (const m of html.matchAll(/<img[^>]+src=["']([^"']+)["']/gi)) srcs.add(absoluto(m[1], url));
  const og = html.match(/property=["']og:image["'][^>]+content=["']([^"']+)["']/i)?.[1] ?? html.match(/content=["']([^"']+)["'][^>]+property=["']og:image["']/i)?.[1];
  if (og) srcs.add(absoluto(og, url)); else problemas.push('falta a imagem de compartilhamento (og:image)');
  const lista = [...srcs].filter(Boolean).filter((s) => !s.startsWith('data:')).slice(0, 14);
  if (!lista.length) problemas.push('a página não tem nenhuma imagem');
  for (const src of lista) {
    try {
      const ri = await buscarFn(src, { headers: { 'User-Agent': UA }, tentativas: 2, timeoutMs: 20000 });
      const tipo = ri.headers.get('content-type') || '';
      if (!ri.ok) problemas.push(`imagem quebrada (HTTP ${ri.status}): ${src}`);
      else if (!/^image\//i.test(tipo)) problemas.push(`o arquivo não é imagem (${tipo}): ${src}`);
    } catch (e) {
      problemas.push(`imagem não abriu: ${src}`);
    }
  }

  if (sitemapTexto) {
    const caminho = new URL(url).pathname;
    if (!sitemapTexto.includes(caminho)) problemas.push('o artigo não está no sitemap.xml');
  }
  return { ok: problemas.length === 0, problemas, palavras, imagens: lista.length };
}

function abrirAviso(titulo, corpo) {
  try { execFileSync('gh', ['issue', 'create', '--title', titulo, '--body', corpo], { stdio: 'ignore' }); } catch { log('aviso: não consegui abrir issue'); }
}

async function main() {
  const soConferir = process.argv.includes('--so-conferir');
  const hoje = hojeBR(CFG.fusoHorario);
  const { linhas, colunas, token } = await lerCalendario({ sheetId: process.env.SHEET_ID, credenciais: process.env.GOOGLE_SHEETS_CREDENTIALS });
  const status = (l) => String(l['Status']).trim().toLowerCase();
  const info = new Map(lerAcervo().map((a) => [a.data.slug, { titulo: a.data.title, data: String(a.data.datePublished).slice(0, 10), quando: a.data.datePublishedCompleta }]));
  const dataReal = (l) => dataEfetiva(l['Slug'], l.dataISO, info);
  const alvo = linhas.filter((l) => ['agendado', 'em revisão', 'em revisao'].includes(status(l)) && l['Slug'] && dataReal(l) && dataReal(l) <= hoje && jaPassouDoHorario(l['Slug'], info));
  log(`Hoje ${hoje} | artigos a confirmar no ar: ${alvo.length}`);
  if (!alvo.length) return;

  await esperar(Number(process.env.ESPERA_SEGUNDOS || 0) * 1000);
  let sitemapTexto = '';
  try { sitemapTexto = await (await buscar(`${CFG.siteUrl}/sitemap.xml`, { headers: { 'User-Agent': UA }, tentativas: 3 })).text(); } catch { log('aviso: não consegui ler o sitemap.xml'); }

  const atualizacoes = [];
  const resumo = [];
  let falhas = 0;
  for (const l of alvo) {
    const url = `${CFG.siteUrl}/${l['Slug']}/`;
    const res = await conferirPagina({ url, titulo: info.get(l['Slug'])?.titulo ?? '', sitemapTexto });
    if (res.ok) {
      log(`NO AR ✓ ${l['ID Artigo']} ${url} (${res.palavras} palavras, ${res.imagens} imagens)`);
      atualizacoes.push(
        { linha: l._linha, coluna: 'Status', valor: 'publicado' },
        { linha: l._linha, coluna: 'Data Publicação', valor: dataReal(l) },
        { linha: l._linha, coluna: 'PR / Log da automação', valor: `NO AR ✓ ${hoje}: ${url}` },
      );
      resumo.push(`| ${l['ID Artigo']} | [${l['Slug']}](${url}) | publicado ✓ | ${res.palavras} palavras, ${res.imagens} imagens |`);
    } else {
      const motivo = res.problemas.join('; ');
      const aguardandoRevisao = status(l) !== 'agendado';
      log(`${aguardandoRevisao ? 'AGUARDANDO' : 'NÃO CONFIRMADO'} ${l['ID Artigo']} ${url}: ${motivo}`);
      atualizacoes.push({ linha: l._linha, coluna: 'PR / Log da automação', valor: `${aguardandoRevisao ? 'AGUARDANDO MERGE' : 'NÃO CONFIRMADO'} ${hoje}: ${motivo}`.slice(0, 480) });
      resumo.push(`| ${l['ID Artigo']} | [${l['Slug']}](${url}) | ${aguardandoRevisao ? 'aguardando merge' : 'NÃO CONFIRMADO'} | ${motivo.slice(0, 160)} |`);
      if (!aguardandoRevisao) { falhas++; abrirAviso(`Artigo não confirmado no ar: ${l['Slug']}`, `${url}\n\n${motivo}\n\nO status da planilha continua "agendado" até o artigo abrir corretamente.`); }
      else if (dataReal(l) < hoje) abrirAviso(`Artigo atrasado aguardando merge: ${l['Slug']}`, `A data de publicação (${dataReal(l)}) já passou e o PR ainda não foi mesclado.`);
    }
  }
  if (!soConferir) await gravarCelulas({ sheetId: process.env.SHEET_ID, token, colunas, atualizacoes });
  if (process.env.GITHUB_STEP_SUMMARY) {
    appendFileSync(process.env.GITHUB_STEP_SUMMARY, `## Confirmação no ar (${hoje})\n\n| ID | Link | Resultado | Detalhe |\n|---|---|---|---|\n${resumo.join('\n')}\n`);
  }
  if (falhas > 0) process.exitCode = 1;
}

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  main().catch((e) => { console.error(e); process.exit(1); });
}
