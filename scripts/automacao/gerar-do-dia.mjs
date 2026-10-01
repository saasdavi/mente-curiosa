// Orquestrador: para cada pauta do dia escreve, valida (9 portões de AUDITORIA_AUTOMATICA.md) e publica.
// Uso: node scripts/automacao/gerar-do-dia.mjs [--data AAAA-MM-DD] [--horizonte N] [--max N] [--dry-run]
import { execFileSync } from 'node:child_process';
import { appendFileSync, mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { CFG, FONTES_FOTO } from './config.mjs';
import { hojeBR, somarDias, git, buscar, log } from './util.mjs';
import { lerCalendario, gravarCelulas } from './sheets.mjs';
import { readFileSync, existsSync } from 'node:fs';

function lerTemasLocal() {
  const arquivo = './temas-agendados.json';
  if (!existsSync(arquivo)) return null;
  const temas = JSON.parse(readFileSync(arquivo, 'utf8'));
  const linhas = temas.map((t, i) => ({
    _linha: i + 2,
    'Cal ID': `CAL${String(i).padStart(4, '0')}`,
    'Data (AAAA-MM-DD)': t.data,
    'ID Artigo': t.id,
    'Palavra-chave': t.palavra_chave,
    'Pauta': t.pauta,
    'Categoria (slug)': t.categoria,
    'Cluster': t.cluster,
    'Slug': t.slug,
    'Status': 'planejado',
    'Ordem do Dia': '1',
    'KW ID principal': t.id,
    dataISO: t.data,
  }));
  return { linhas, colunas: {}, token: null };
}
import { chamarClaude, extrairJSON, USO, custoEstimado } from './claude.mjs';
import { sistemaRedator, pedidoArtigo, pedidoReescrita, sistemaValidador, pedidoValidacao, lerResposta } from './prompts.mjs';
import { verificarFontes, termosDoAssunto, pesquisarFontes, termosDeContexto, relevancia } from './fontes.mjs';
import { maiorSemelhanca, titulosParecidos } from './similaridade.mjs';
import { checarTexto, checarFatos, checarCopia } from './gates.mjs';
import { prepararImagens, escolherFotosPrevias } from './imagens.mjs';
import { garantirAviso, sanearLinksInternos, montarFrontmatter, gravarArtigo, lerAcervo, urlsDeCreditoUsadas } from './artigo.mjs';
import { auditarArtigo, norm } from '../lib-audit.mjs';

const NOTA_MINIMA = 85;

// ---------------------------------------------------------------- seleção (P1)
export function selecionarPautas({ linhas, acervo, hoje, horizonte, max, branches = [] }) {
  const limite = somarDias(hoje, horizonte);
  const slugs = new Set(acervo.map((a) => a.data.slug));
  const ids = new Set(acervo.map((a) => a.data.id));
  const kws = new Set(acervo.map((a) => norm(a.data.keyword)));
  const emBranch = (l) => branches.some((b) => b.toLowerCase().includes(String(l['ID Artigo']).toLowerCase()) || b.endsWith(`-${l['Slug']}`));
  return linhas
    .filter((l) => String(l['Status']).trim().toLowerCase() === 'planejado' && l.dataISO && l.dataISO <= limite && l['Slug'] && l['ID Artigo'])
    .filter((l) => !slugs.has(l['Slug']) && !ids.has(l['ID Artigo']) && !kws.has(norm(l['Palavra-chave'])) && !emBranch(l))
    .sort((a, b) => a.dataISO.localeCompare(b.dataISO) || Number(a['Ordem do Dia']) - Number(b['Ordem do Dia']))
    .slice(0, max);
}

export function linksPermitidos(linha, acervo) {
  const cat = linha['Categoria (slug)'];
  const tags = new Set();
  const ate = linha.dataISO;
  const publicados = acervo.filter((a) => !a.data.draft && String(a.data.datePublished).slice(0, 10) <= ate);
  const nota = (a) => (a.data.category === cat ? 2 : 0) + (a.data.tags ?? []).filter((t) => tags.has(t)).length;
  const lista = publicados.sort((a, b) => nota(b) - nota(a)).slice(0, 8).map((a) => ({ titulo: a.data.title, url: `/${a.data.slug}/` }));
  return [{ titulo: `Categoria ${linha['Cluster']}`, url: `/categoria/${cat}/` }, ...lista];
}

// ---------------------------------------------------------------- redação + portões
/**
 * Escreve e valida uma pauta. Devolve { ok:true, frontmatter, corpo, imagens, nota, historico }
 * ou { ok:false, motivo, historico }.
 */
export async function processarPauta(linha, acervo, deps = {}) {
  const d = { claude: chamarClaude, fontes: verificarFontes, pesquisar: pesquisarFontes, fotosPrevias: escolherFotosPrevias, imagens: prepararImagens, buscarFn: buscar, ...deps };
  const permitidos = linksPermitidos(linha, acervo);
  const permitidosUrls = [...permitidos.map((l) => l.url), '/', '/sobre/', '/contato/', '/politica-de-privacidade/'];
  const termo = linha['Termo-cabeça (Planner)'] || '';
  const sistema = sistemaRedator();
  const kwCount = new Map(acervo.map((a) => [norm(a.data.keyword), 1]));
  const docs = acervo.map((a) => ({ slug: a.data.slug, texto: a.corpo }));
  const tits = acervo.map((a) => ({ slug: a.data.slug, titulo: a.data.title }));
  const historico = [];
  let ultima = null;
  let problemas = [];
  const cacheFontes = new Map();
  const motivosFonte = new Map();

  // Pesquisa antes de escrever: até 2 fontes lidas (5.000 caracteres cada) que o redator usa como base.
  let fontesLidas = [];
  let fontesExtras = [];
  let fotosPrevias = [];
  let termosContexto = [];
  try {
    let p = await d.pesquisar({ linha, claude: d.claude, buscarFn: d.buscarFn });
    for (const x of p.descartadas ?? []) log(`Fonte descartada: ${x.url} (${x.motivo})`);
    if ((p.lidas ?? []).length < CFG.fontesMin) {
      log(`Pesquisa prévia: só ${(p.lidas ?? []).length} fonte(s) lida(s); buscando outras fontes.`);
      const p2 = await d.pesquisar({ linha, claude: d.claude, buscarFn: d.buscarFn, excluir: p.tentadas ?? [] });
      for (const x of p2.descartadas ?? []) log(`Fonte descartada: ${x.url} (${x.motivo})`);
      const vistos = new Set();
      const termos2 = [...new Set([...(p.termos ?? []), ...(p2.termos ?? [])])];
      const todas = [...(p.lidas ?? []), ...(p2.lidas ?? [])]
        .filter((f) => !vistos.has(f.url) && vistos.add(f.url))
        .sort((a, b) => relevancia(b.texto, termos2).total - relevancia(a.texto, termos2).total);
      p = { ...p2, lidas: todas.slice(0, 2), extras: [...(p.extras ?? []), ...(p2.extras ?? []), ...todas.slice(2)].filter((f) => !todas.slice(0, 2).includes(f)).slice(0, 2), termos: termos2, fotos: (p.fotos ?? []).length ? p.fotos : p2.fotos };
    }
    fontesLidas = p.lidas ?? [];
    fontesExtras = p.extras ?? [];
    // Sem 2 fontes lidas o robô NÃO escreve (nada é gasto com redação) e o tema fica para outra tentativa.
    if (fontesLidas.length < CFG.fontesMin) return { ok: false, motivo: `P3: não achei 2 fontes legíveis para o tema (só ${fontesLidas.length}); nada foi escrito`, historico: [] };
    termosContexto = termosDeContexto(fontesLidas.map((f) => f.texto), [...termosDoAssunto(linha['Pauta'], linha['Palavra-chave']), ...(p.termos ?? [])]);
    if (termosContexto.length) log(`Palavras de contexto das fontes: ${termosContexto.join(', ')}`);
    // Fotos escolhidas ANTES de escrever (sem Claude): se o tema não tem foto, não gasta nada com texto.
    if ((p.fotos ?? []).length) {
      fotosPrevias = await d.fotosPrevias({ buscas: p.fotos, categoria: linha['Categoria (slug)'], usados: new Set(urlsDeCreditoUsadas(acervo)), fontesFoto: FONTES_FOTO[linha['Categoria (slug)']] ?? ['pexels'] });
      log(`Fotos escolhidas antes de escrever: ${fotosPrevias.map((f) => f.c.urlCredito).join(', ')}`);
    }
    for (const v of fontesLidas) cacheFontes.set(v.url, v);
    log(`Pesquisa prévia: ${fontesLidas.length} fonte(s) lida(s)${fontesLidas.length ? ': ' + fontesLidas.map((f) => f.url).join(', ') : ''}`);
  } catch (e) {
    if (FATAL.test(String(e.message))) throw e;
    if (/^sem foto no banco/.test(String(e.message))) return { ok: false, motivo: `P7: ${e.message} (nenhum texto foi escrito, nada foi gasto com redação)`, historico: [] };
    log(`aviso: pesquisa prévia falhou (${e.message}).`);
  }
  if (fontesLidas.length < CFG.fontesMin) return { ok: false, motivo: `P3: não achei 2 fontes legíveis para o tema (só ${fontesLidas.length}); nada foi escrito`, historico: [] };

  for (let volta = 0; volta <= CFG.voltasMax; volta++) {
    const pedido = volta === 0 || !ultima
      ? pedidoArtigo({ linha, linksPermitidos: permitidos, termoCabeca: termo, fontesLidas, fotosPrevias, termosContexto })
      : pedidoReescrita({ anterior: ultima.bruto, problemas, fontesLidas, termosContexto });
    let resp;
    try {
      const r = await d.claude({ system: sistema, user: pedido });
      resp = lerResposta(r.texto);
      ultima = { ...resp, bruto: r.texto };
    } catch (e) {
      problemas = [`formato: ${e.message}`];
      historico.push({ volta, problemas });
      continue;
    }
    const { meta } = resp;
    // Fontes: sempre as páginas que o robô abriu e leu (o modelo só pode acrescentar a que faltar, e ela é aberta no P3).
    const base = [...fontesLidas, ...fontesExtras].map((f) => ({ title: f.title, url: f.url }));
    meta.sources = [...base, ...(meta.sources ?? []).filter((x) => !base.some((b) => b.url === x.url))].slice(0, 3);
    // Links internos: só páginas que existem; o que não existe vira texto, por código.
    const corpo = garantirAviso(sanearLinksInternos(resp.corpo, permitidos, permitidosUrls), linha['Categoria (slug)']);
    problemas = [];

    // P2/P8/P9: estrutura, segurança, links
    problemas.push(...checarTexto({ meta, corpo, categoria: linha['Categoria (slug)'], permitidos: permitidosUrls }));

    // P2: auditoria de SEO (nota e bloqueantes)
    const aud = auditarArtigo(
      { data: { ...meta, slug: linha['Slug'], keyword: linha['Palavra-chave'], category: linha['Categoria (slug)'], imagensPlano: true }, body: corpo },
      kwCount,
    );
    if (aud.block.length) problemas.push(...aud.block.map((b) => `P2: ${b}`));
    if (aud.score < NOTA_MINIMA) problemas.push(`P2: nota ${aud.score} (mínimo ${NOTA_MINIMA}): ${aud.warn.join('; ')}`);
    if (aud.wc > 1600) problemas.push(`P2: ${aud.wc} palavras (máximo 1.600)`);

    // P3: fontes
    const novas = (meta.sources ?? []).filter((s) => !cacheFontes.has(s.url));
    const res = await d.fontes(novas, d.buscarFn, termosDoAssunto(linha['Pauta'], linha['Palavra-chave'], ...(Array.isArray(meta.termosFonte) ? meta.termosFonte : [])));
    for (const v of res.validas) cacheFontes.set(v.url, v);
    for (const i of res.invalidas) { cacheFontes.set(i.url, null); motivosFonte.set(i.url, i.motivo); }
    const fontes = (meta.sources ?? []).map((s) => cacheFontes.get(s.url)).filter(Boolean);
    if (fontes.length < CFG.fontesMin || (meta.sources ?? []).length < 3 || fontes.length < (meta.sources ?? []).length) {
      const inval = (meta.sources ?? []).filter((s) => cacheFontes.get(s.url) === null).map((s) => `${s.url} (${motivosFonte.get(s.url) ?? 'não abriu'})`);
      const citadas = (meta.sources ?? []).length;
      problemas.push(`P3: você citou ${citadas} fonte(s) e ${fontes.length} servem (precisa citar EXATAMENTE 3 fontes, e todas precisam abrir e tratar do assunto).${citadas < 3 ? ` Acrescente ${3 - citadas} fonte(s) específica(s) do tema.` : ''}${inval.length ? ` Troque: ${inval.join(', ')}` : ''}`);
    }

    // P4/P6: fatos e cópia
    problemas.push(...checarFatos(corpo, fontes));
    problemas.push(...checarCopia(corpo, fontes));
    const sim = maiorSemelhanca(corpo, docs);
    if (sim.valor >= CFG.similaridadeMax) problemas.push(`P6: texto ${(sim.valor * 100).toFixed(0)}% parecido com /${sim.slug}/; escreva um ângulo diferente`);
    const tp = titulosParecidos(meta.title, tits);
    if (tp) problemas.push(`P6: título quase igual ao de /${tp}/`);

    // P5: validador independente (só depois dos portões determinísticos)
    if (!problemas.length) {
      try {
        const v = await d.claude({
          system: sistemaValidador(),
          user: pedidoValidacao({ id: linha['ID Artigo'], meta, corpo, fontes }),
          maxTokens: 4000,
        });
        let j;
        try { j = extrairJSON(v.texto); } catch (err) {
          throw new Error(`${err.message}; stop_reason=${v.parou}; início da resposta: "${String(v.texto).slice(0, 300).replace(/\s+/g, ' ')}"`);
        }
        if (j.decisao !== 'APROVADO') problemas.push(...[...(j.motivos ?? []), ...(j.correcoes ?? []).map((c) => `correção: ${c}`)].map((m) => `P5: ${m}`));
      } catch (e) {
        problemas.push(`P5: validador falhou (${e.message})`);
      }
    }

    historico.push({ volta, problemas: [...problemas] });
    if (!problemas.length) {
      // P7: fotos do Pexels escolhidas sem gastar tokens (busca simples → busca reduzida → busca genérica da categoria)
      const imagens = await d
        .imagens({
          meta, categoria: linha['Categoria (slug)'], slug: linha['Slug'], titulo: meta.title,
          fontesFoto: FONTES_FOTO[linha['Categoria (slug)']] ?? ['pexels'],
          usados: urlsDeCreditoUsadas(acervo),
          previas: fotosPrevias,
        })
        .catch((e) => ({ erro: e.message }));
      if (imagens.erro) return { ok: false, motivo: `P7: ${imagens.erro}`, historico };
      const frontmatter = montarFrontmatter({ linha, meta, imagens, fontesValidas: fontes });
      return { ok: true, frontmatter, corpo, imagens, nota: aud.score, historico, fontes };
    }
  }
  return { ok: false, motivo: `reprovado após ${CFG.voltasMax + 1} tentativa(s): ${problemas.slice(0, 4).join(' | ')}`, historico };
}

// ---------------------------------------------------------------- publicação (P9 + git)
function sh(cmd, args, opts = {}) {
  return execFileSync(cmd, args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], ...opts }).trim();
}

export function publicarArtigo({ resultado, linha, autoMerge, dry }) {
  const slug = linha['Slug'];
  const ramo = `artigo/${linha['ID Artigo'].toLowerCase()}-${slug}`.slice(0, 100);
  if (dry) return { ok: true, nota: 'dry-run: nada gravado' };
  sh('git', ['checkout', '-q', '-B', ramo, 'origin/main']);
  const criados = gravarArtigo({ frontmatter: resultado.frontmatter, corpo: resultado.corpo, imagens: resultado.imagens });
  try {
    sh('npm', ['run', 'build'], { maxBuffer: 50 * 1024 * 1024 }); // P9
  } catch (e) {
    const saida = String(e.stderr || e.stdout || e.message).split('\n').filter(Boolean).slice(-6).join(' / ');
    voltarParaMain(ramo, slug);
    return { ok: false, motivo: `P9: build falhou: ${saida.slice(0, 300)}` };
  }
  sh('git', ['add', `src/content/artigos/${slug}.md`, `public/images/${slug}`]);
  sh('git', ['-c', 'user.name=mente-curiosa-bot', '-c', 'user.email=bot@mentecuriosa.blog', 'commit', '-q', '-m', `Artigo ${linha['ID Artigo']}: ${resultado.frontmatter.title}`]);
  sh('git', ['push', '-q', '-u', 'origin', ramo]);
  const corpoPR = [
    `Artigo gerado e validado automaticamente (9 portões de AUDITORIA_AUTOMATICA.md).`,
    ``, `- **Pauta:** ${linha['Pauta']}`, `- **Palavra-chave:** ${linha['Palavra-chave']}`, `- **Data de publicação:** ${linha.dataISO}`,
    `- **Nota da auditoria de SEO:** ${resultado.nota}`, `- **Fontes verificadas:** ${resultado.fontes.map((f) => f.url).join(', ')}`,
    `- **Voltas de correção:** ${resultado.historico.length - 1}`,
  ].join('\n');
  const dir = mkdtempSync(join(tmpdir(), 'pr-'));
  writeFileSync(join(dir, 'corpo.md'), corpoPR);
  const url = sh('gh', ['pr', 'create', '--base', 'main', '--head', ramo, '--title', `Artigo: ${resultado.frontmatter.title}`, '--body-file', join(dir, 'corpo.md')]);
  rmSync(dir, { recursive: true, force: true });
  let mesclado = false;
  if (autoMerge) {
    try { sh('gh', ['pr', 'merge', url, '--squash', '--delete-branch']); mesclado = true; }
    catch (e) { log(`aviso: não consegui mesclar sozinho (${String(e.stderr || e.message).slice(0, 160)}); PR fica aberto`); }
  }
  voltarParaMain(ramo, slug, true);
  return { ok: true, pr: url, mesclado, criados: criados.length };
}

function voltarParaMain(ramo, slug, manter = false) {
  try { sh('git', ['checkout', '-q', '-f', 'main']); } catch { /* ignora */ }
  if (!manter) {
    try { sh('git', ['clean', '-fdq', 'src/content/artigos', `public/images/${slug}`]); } catch { /* ignora */ }
    try { sh('git', ['branch', '-D', ramo]); } catch { /* ignora */ }
  }
}

// ---------------------------------------------------------------- freio
export function falhasRecentes(linhas, hoje, dias = 7) {
  const desde = somarDias(hoje, -dias);
  let n = 0;
  for (const l of linhas) {
    const m = String(l['PR / Log da automação'] || '').match(/FALHA (\d{4}-\d{2}-\d{2})/);
    if (m && m[1] >= desde) n++;
  }
  return n;
}
/**
 * Regra anti-loop: uma pauta que o auditor reprovou sai da fila (status "revisar") e o robô passa para
 * o próximo tema. Falha de infraestrutura (API fora do ar, rede) não queima o tema: ele continua "planejado".
 */
export const INFRA = /API do Claude: (429|5\d\d)|fetch failed|timeout|ECONN|ETIMEDOUT|não abriu|rate.?limit|overloaded|Pexels HTTP (429|5\d\d)/i;
// Problema de conta/chave (sem crédito, chave inválida): nunca é culpa do tema; o tema fica "planejado" e a execução para.
export const FATAL = /credit balance|invalid x-api-key|authentication_error|permission_error|billing/i;
export function statusAposFalha({ tentativas, motivo }) {
  if (FATAL.test(String(motivo))) return null;
  // null = mantém "planejado": o tema volta à fila e é refeito (novas fontes, nova redação) em outra execução; depois de 3 tentativas vai para revisão.
  return tentativas >= 3 ? 'revisar' : null;
}
const tentativasAnteriores = (l) => Number(String(l['PR / Log da automação'] || '').match(/tentativa (\d+)/)?.[1] ?? 0);

// ---------------------------------------------------------------- principal
async function main() {
  const arg = (n, pad) => { const i = process.argv.indexOf(`--${n}`); return i > 0 ? process.argv[i + 1] : pad; };
  const dry = process.argv.includes('--dry-run');
  const hoje = arg('data', hojeBR(CFG.fusoHorario));
  const horizonte = Number(arg('horizonte', CFG.horizonteDias));
  const max = Number(arg('max', CFG.maxPorExecucao));
  const autoMerge = process.env.AUTO_MERGE === 'true';
  const resumo = [];

  if (process.env.PAUSAR === 'true') { log('PAUSAR=true: geração pausada.'); return; }
  let resultado = lerTemasLocal();
  let token = null;
  let colunas = {};
  if (!resultado) {
    resultado = await lerCalendario({ sheetId: process.env.SHEET_ID, credenciais: process.env.GOOGLE_SHEETS_CREDENTIALS });
    token = resultado.token;
    colunas = resultado.colunas;
  } else {
    token = resultado.token;
    colunas = resultado.colunas;
  }
  const { linhas } = resultado;
  // --reabrir ART0453,ART2838: devolve à fila temas que estavam em "revisar" (ex.: depois de corrigir o robô)
  const reabrir = arg('reabrir', '').split(',').map((x) => x.trim().toUpperCase()).filter(Boolean);
  if (reabrir.length) {
    const alvo = linhas.filter((l) => reabrir.includes(String(l['ID Artigo']).toUpperCase()) && String(l['Status']).trim().toLowerCase() === 'revisar');
    for (const l of alvo) { l['Status'] = 'planejado'; l['PR / Log da automação'] = `Reaberto ${hoje}`; }
    if (!dry && alvo.length) {
      await gravarCelulas({ sheetId: process.env.SHEET_ID, token, colunas, atualizacoes: alvo.flatMap((l) => [{ linha: l._linha, coluna: 'Status', valor: 'planejado' }, { linha: l._linha, coluna: 'PR / Log da automação', valor: `Reaberto ${hoje}` }]) });
    }
    log(`Reabertos: ${alvo.map((l) => l['ID Artigo']).join(', ') || 'nenhum (só temas em "revisar" podem ser reabertos)'}`);
  }
  const falhas7 = falhasRecentes(linhas, hoje);
  if (falhas7 >= 5) { log(`Freio: ${falhas7} falhas nos últimos 7 dias; geração pausada.`); abrirAviso(`Geração pausada: ${falhas7} falhas em 7 dias`, 'Veja a coluna "PR / Log da automação" da planilha.'); return; }

  try { sh('git', ['fetch', '-q', 'origin', 'main']); } catch { /* ok em teste local */ }
  let branches = [];
  try { branches = sh('git', ['ls-remote', '--heads', 'origin', 'artigo/*']).split('\n').map((l) => l.split('\t')[1] ?? ''); } catch { /* ok */ }
  const acervo = lerAcervo();
  const RESERVA = 3; // temas extras para trocar quando um for reprovado
  const pautas = selecionarPautas({ linhas, acervo, hoje, horizonte, max: max + RESERVA, branches });
  log(`Hoje ${hoje} | meta: ${max} artigo(s) | candidatas (com reserva): ${pautas.length}`);
  let sucessos = 0;

  let falhasNaExecucao = 0;
  for (const linha of pautas) {
    if (sucessos >= max) break;
    if (falhasNaExecucao >= 3) { log('Freio: 3 falhas nesta execução; parando.'); break; }
    log(`\n=== ${linha['ID Artigo']} ${linha['Pauta']} (${linha.dataISO}) ===`);
    let r;
    try { r = await processarPauta(linha, acervo); } catch (e) { r = { ok: false, motivo: `erro inesperado: ${e.message}`, historico: [] }; }
    const atualizacoes = [];
    if (r.ok) {
      const pub = publicarArtigo({ resultado: r, linha, autoMerge, dry });
      if (pub.ok) {
        // "publicado" só depois que o deploy termina e o link é conferido (confirmar-no-ar.mjs)
        const status = pub.mesclado ? 'agendado' : 'em revisão';
        atualizacoes.push({ coluna: 'Status', valor: dry ? linha['Status'] : status }, { coluna: 'PR / Log da automação', valor: pub.pr ?? pub.nota });
        sucessos++;
        log(`APROVADO ${linha['ID Artigo']}: nota de auditoria ${r.nota}, ${r.corpo.split(/\s+/).length} palavras, ${(r.fontes ?? []).length} fontes, título "${r.frontmatter?.title ?? ''}"${dry ? ' (dry-run: nada gravado)' : ''}`);
        resumo.push(`| ${linha['ID Artigo']} | ${linha['Pauta']} | ${status} | ${pub.pr ?? '-'} | nota ${r.nota} |`);
      } else { r = { ok: false, motivo: pub.motivo, historico: r.historico }; }
    }
    if (!r.ok) {
      falhasNaExecucao++;
      const n = tentativasAnteriores(linha) + 1;
      const novoStatus = statusAposFalha({ tentativas: n, motivo: r.motivo });
      atualizacoes.push(
        { coluna: 'PR / Log da automação', valor: `FALHA ${hoje} (tentativa ${n}): ${r.motivo}`.slice(0, 480) },
        ...(novoStatus ? [{ coluna: 'Status', valor: novoStatus }] : []),
      );
      if (novoStatus) log(`Tema ${linha['ID Artigo']} reprovado ${n} vezes: vai para revisão (status "${novoStatus}"); passando para o próximo tema.`);
      else log(`Tema ${linha['ID Artigo']} não passou (tentativa ${n} de 3): continua "planejado" e será refeito em outra execução; passando para o próximo tema.`);
      resumo.push(`| ${linha['ID Artigo']} | ${linha['Pauta']} | FALHA | ${r.motivo.slice(0, 120)} | - |`);
      log(`FALHA: ${r.motivo}`);
      if (FATAL.test(String(r.motivo))) {
        if (!dry) await gravarCelulas({ sheetId: process.env.SHEET_ID, token, colunas, atualizacoes: atualizacoes.map((a) => ({ ...a, linha: linha._linha })) });
        log('Parando: problema na conta ou chave da API (ex.: sem crédito). Nenhum tema foi descartado.');
        abrirAviso('Geração parou: sem crédito ou chave da API inválida', 'A API da Anthropic recusou a chamada (crédito insuficiente ou chave inválida). Recarregue o crédito em console.anthropic.com > Plans & Billing e rode o workflow de novo. Nenhum tema foi descartado.');
        resumo.push('| - | (parou: problema na conta/chave da API) | | | |');
        break;
      }
    }
    if (!dry) await gravarCelulas({ sheetId: process.env.SHEET_ID, token, colunas, atualizacoes: atualizacoes.map((a) => ({ ...a, linha: linha._linha })) });
  }
  if (falhasNaExecucao >= 3) abrirAviso('Geração parou: 3 artigos reprovados seguidos', 'Veja o resumo da execução e a coluna "PR / Log da automação".');
  else if (falhasNaExecucao > 0 && !dry) abrirAviso(`Falha ao gerar artigo(s) em ${hoje}`, `${falhasNaExecucao} pauta(s) reprovada(s). Veja o resumo da execução e a coluna "PR / Log da automação" da planilha.`);
  log(`Uso da API nesta execução: ${USO.chamadas} chamada(s), ${USO.entrada} tokens lidos + ${USO.saida} escritos = US$ ${custoEstimado().toFixed(3)} (modelo ${CFG.modeloClaude})`);
  // Falha nunca pode parecer sucesso: o workflow fica vermelho e o GitHub avisa por e-mail.
  if (falhasNaExecucao > 0 && sucessos >= max) console.log(`::warning::${falhasNaExecucao} tema(s) reprovado(s) e substituído(s); meta do dia cumprida (${sucessos}/${max}).`);
  else if (falhasNaExecucao > 0) process.exitCode = 1;
  if (process.env.GITHUB_STEP_SUMMARY) {
    appendFileSync(process.env.GITHUB_STEP_SUMMARY, `## Artigos de ${hoje}\n\nCusto estimado da API: US$ ${custoEstimado().toFixed(3)} (${USO.entrada} tokens lidos, ${USO.saida} escritos, modelo ${CFG.modeloClaude})\n\n| ID | Pauta | Resultado | PR / motivo | Auditoria |\n|---|---|---|---|---|\n${resumo.join('\n') || '| - | nenhuma pauta pendente | | | |'}\n`);
  }
}

function abrirAviso(titulo, corpo) {
  try { sh('gh', ['issue', 'create', '--title', titulo, '--body', corpo]); } catch { log('aviso: não consegui abrir issue'); }
}

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  main().catch((e) => { console.error(e); process.exit(1); });
}
