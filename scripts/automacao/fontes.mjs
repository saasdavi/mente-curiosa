// Confere se cada fonte citada existe e extrai um trecho do texto para o validador conferir os fatos.
import { DOMINIOS_CONFIAVEIS, DOMINIOS_BLOQUEADOS } from './config.mjs';
import { extrairJSON } from './claude.mjs';

const UA = 'Mozilla/5.0 (compatible; MenteCuriosaBot/1.0; +https://www.mentecuriosa.blog)';

const dominio = (u) => new URL(u).hostname.replace(/^www\./, '').toLowerCase();
const confiavel = (host) => DOMINIOS_CONFIAVEIS.some((d) => host === d || host.endsWith(`.${d}`)) || /\.(gov|edu)(\.[a-z]{2})?$/.test(host);

export function htmlParaTexto(html) {
  return html
    .replace(/<(script|style|noscript|svg|nav|footer|header)[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

const semAcento = (t) => String(t).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
const STOP = new Set(['por', 'que', 'como', 'uma', 'para', 'com', 'dos', 'das', 'tem', 'foi', 'sao', 'seu', 'sua', 'mais', 'ser', 'ter', 'nos', 'nas', 'isso', 'esse', 'essa', 'qual', 'quais', 'onde', 'quando']);

/** Termos que uma fonte precisa conter para tratar do assunto (vêm da pauta e da palavra-chave). */
export function termosDoAssunto(...textos) {
  const t = semAcento(textos.join(' ')).replace(/[^a-z0-9 ]/g, ' ').split(/\s+/).filter((w) => w.length >= 3 && !STOP.has(w));
  return [...new Set(t)];
}

/** Quantos termos distintos aparecem e quantas vezes no total. */
export function relevancia(texto, termos) {
  const base = semAcento(texto);
  let distintos = 0;
  let total = 0;
  for (const t of termos) {
    const n = base.split(t).length - 1;
    if (n > 0) { distintos++; total += n; }
  }
  return { distintos, total };
}

/** Janela de ~9000 caracteres em volta da região com mais termos (em vez do começo da página, cheio de menu). */
export function trechoRelevante(texto, termos, tam = 9000) {
  if (texto.length <= tam || !termos.length) return texto.slice(0, tam);
  const base = semAcento(texto);
  let melhor = 0;
  let melhorPts = -1;
  for (let ini = 0; ini < texto.length; ini += 500) {
    const janela = base.slice(ini, ini + tam);
    const pts = termos.reduce((n, t) => n + (janela.includes(t) ? 1 : 0) * 10 + (janela.split(t).length - 1), 0);
    if (pts > melhorPts) { melhorPts = pts; melhor = ini; }
  }
  return texto.slice(melhor, melhor + tam);
}

async function abrir(url, buscarFn) {
  const r = await buscarFn(url, { headers: { 'User-Agent': UA, Accept: 'text/html,application/pdf,*/*' }, redirect: 'follow', tentativas: 2, timeoutMs: 20000 });
  return r;
}

/** Retorna { validas: [{title,url,texto,lido}], invalidas: [{url,motivo}] }. */
export async function verificarFontes(fontes, buscarFn, termos = [], tam = 9000) {
  const validas = [];
  const invalidas = [];
  const vistos = new Set();
  for (const f of fontes ?? []) {
    let host;
    try {
      const u = new URL(f.url);
      if (u.protocol !== 'https:' && u.protocol !== 'http:') throw new Error('protocolo');
      host = dominio(f.url);
    } catch {
      invalidas.push({ url: f.url, motivo: 'URL inválida' });
      continue;
    }
    if (DOMINIOS_BLOQUEADOS.test(host)) { invalidas.push({ url: f.url, motivo: 'fonte não primária' }); continue; }
    if (vistos.has(f.url)) continue;
    vistos.add(f.url);
    try {
      const r = await abrir(f.url, buscarFn);
      const tipo = r.headers.get('content-type') || '';
      if (r.ok) {
        const html = /html/i.test(tipo) ? await r.text() : '';
        const completo = html ? htmlParaTexto(html) : '';
        const tituloPagina = htmlParaTexto(/<title[^>]*>([\s\S]*?)<\/title>/i.exec(html)?.[1] ?? '').slice(0, 140);
        if (completo.length >= 300 && termos.length) {
          const rel = relevancia(completo, termos);
          const minimo = Math.min(2, termos.length);
          if (rel.distintos < minimo || rel.total < 4) {
            invalidas.push({ url: f.url, motivo: `a página não trata do assunto (só ${rel.distintos} dos termos: ${termos.join(', ')}); use uma página ESPECÍFICA sobre o tema, não a home nem uma página geral` });
            continue;
          }
        }
        const texto = completo ? trechoRelevante(completo, termos, tam) : '';
        validas.push({ title: f.title || (tituloPagina ? `${host} — ${tituloPagina}` : host), url: f.url, texto, lido: Boolean(texto) });
      } else if ([401, 403, 429, 999].includes(r.status) && confiavel(host)) {
        validas.push({ title: f.title || host, url: f.url, texto: '', lido: false });
      } else {
        invalidas.push({ url: f.url, motivo: `HTTP ${r.status}` });
      }
    } catch (e) {
      invalidas.push({ url: f.url, motivo: `não abriu (${e.message.slice(0, 60)})` });
    }
  }
  return { validas, invalidas };
}

/**
 * Links REAIS por código, sem depender da memória do modelo: a API da Wikipédia (pt e en) devolve as referências
 * externas do verbete do tema; ficam só as de domínios confiáveis. A Wikipédia em si nunca é fonte (DOMINIOS_BLOQUEADOS).
 * O robô ainda abre, confere e lê cada link em verificarFontes. Falha de rede devolve lista vazia.
 */
export async function candidatasReais(consulta, buscarFn, max = 8) {
  const q = String(consulta ?? '').trim();
  if (!q) return [];
  const api = async (lang, params) => {
    try {
      const r = await buscarFn(`https://${lang}.wikipedia.org/w/api.php?format=json&formatversion=2&origin=*&${params}`, { headers: { 'User-Agent': UA, Accept: 'application/json' }, tentativas: 2, timeoutMs: 15000 });
      return r.ok ? await r.json() : null;
    } catch { return null; }
  };
  const links = [];
  const colher = (pagina) => { for (const l of pagina?.extlinks ?? []) links.push(l.url); };
  const achou = await api('pt', `action=query&list=search&srlimit=1&srsearch=${encodeURIComponent(q)}`);
  const titulo = achou?.query?.search?.[0]?.title;
  if (titulo) {
    const pt = await api('pt', `action=query&prop=extlinks|langlinks&ellimit=80&lllang=en&titles=${encodeURIComponent(titulo)}`);
    const pagina = pt?.query?.pages?.[0];
    colher(pagina);
    const en = pagina?.langlinks?.[0]?.title;
    if (en) colher((await api('en', `action=query&prop=extlinks&ellimit=80&titles=${encodeURIComponent(en)}`))?.query?.pages?.[0]);
  }
  const vistos = new Set();
  const out = [];
  for (const url of links) {
    let host;
    try { host = dominio(url); } catch { continue; }
    if (!/^https?:/i.test(url) || DOMINIOS_BLOQUEADOS.test(host) || !confiavel(host) || /\.(pdf|jpe?g|png|gif)(\?|$)/i.test(url) || /archive\.org/.test(host)) continue;
    const chave = url.replace(/#.*$/, '');
    if (vistos.has(chave)) continue;
    vistos.add(chave);
    out.push({ title: '', url: chave });
    if (out.length >= max) break;
  }
  return out;
}

/**
 * Pesquisa ANTES de escrever: o Claude sugere páginas (uma chamada curta), o robô abre, confere se tratam do tema
 * e fica com as `max` mais relevantes, com até `tam` caracteres de cada. O redator escreve com base nesse texto.
 * Devolve { lidas: [{title,url,texto,lido}], termos }. Falha de rede ou fonte ruim devolve lidas vazio (segue sem).
 */
export async function pesquisarFontes({ linha, claude, buscarFn, tam = 5000, max = 3, excluir = [] }) {
  // Se o JSON tiver fontes predefinidas, usar aquelas primeiro
  let candidatas = (Array.isArray(linha['fontes']) ? linha['fontes'] : []).filter((f) => f && typeof f.url === 'string' && !excluir.includes(f.url)).slice(0, 4);
  let termos = termosDoAssunto(linha['Pauta'], linha['Palavra-chave']);
  let fotos = [];

  // Se não temos candidatas no JSON, perguntar ao Haiku
  if (candidatas.length < 2) {
    const r = await claude({
      system: 'TAREFA CRÍTICA: indicar fontes primárias REAIS e buscas de fotos (ciência para público geral). Responda APENAS com JSON válido: {"termos": ["8 a 12 palavras-chave, metade pt/en"], "fotos": ["3 buscas em inglês, 2-4 palavras"], "fontes": [{"title": "Instituição — página", "url": "https://..."}]}. REGRAS INVIOLÁVEIS PARA FONTES: 1. Listara SOMENTE URLs que EXISTEM e FUNCIONAM (science.nasa.gov, esa.int, britannica.com, scielo.br, fiocruz.br, nature.com, arxiv.org, etc). 2. Verificar MENTALMENTE cada URL antes de listar — se tiver DÚVIDA sobre se existe, NÃO liste. 3. PROIBIDO inventar caminhos/URLs — nunca crie URLs que parecem reais mas não existem. 4. PROIBIDO listar home da instituição — sempre busque página ESPECÍFICA do tema. 5. Se não tiver CERTEZA do caminho exato, use homepage do site ou não liste. 6. Formato OBRIGATÓRIO de URL: https://domain.com/path (não use caminhos genéricos que parecem reais).',
      user: `Assunto do artigo: ${linha['Pauta']}\nPalavra-chave: ${linha['Palavra-chave']}${excluir.length ? `\nJÁ TENTEI estas páginas e NÃO servem (não abrem ou não tratam do assunto); indique outras DIFERENTES, de outros sites:\n${excluir.join('\n')}` : ''}`,
      maxTokens: 700,
    });
    let j;
    try { j = extrairJSON(r.texto); } catch { return { lidas: [], termos: [], tentadas: [], descartadas: [] }; }
    termos = termosDoAssunto(linha['Pauta'], linha['Palavra-chave'], ...(Array.isArray(j.termos) ? j.termos.map(String) : []));
    candidatas = [...candidatas, ...(Array.isArray(j.fontes) ? j.fontes : []).filter((f) => f && typeof f.url === 'string' && !excluir.includes(f.url)).slice(0, 4)];
    fotos = (Array.isArray(j.fotos) ? j.fotos : []).map((x) => String(x).trim()).filter(Boolean).slice(0, 3);
  }

  const reais = (await candidatasReais(linha['Palavra-chave'] || linha['Pauta'], buscarFn, excluir.length ? 24 : 8)).filter((c) => !excluir.includes(c.url)); // na 2ª busca olha mais referências, sem repetir as já tentadas

  // Fallback: se ainda não temos fontes, adicione URLs confiáveis conhecidas que funcionam
  let todasCandidatas = [...reais, ...candidatas];
  if (todasCandidatas.length < 3) {
    todasCandidatas.push(
      { title: 'NASA', url: 'https://www.nasa.gov' },
      { title: 'NOAA', url: 'https://www.noaa.gov' },
      { title: 'USGS', url: 'https://www.usgs.gov' }
    );
  }

  const res = await verificarFontes(todasCandidatas, buscarFn, termos, tam);
  const candidatasUrls = new Set(candidatas.map((c) => c.url));
  const lidas = res.validas
    .filter((v) => v.lido || candidatasUrls.has(v.url))
    .sort((a, b) => relevancia(b.texto, termos).total - relevancia(a.texto, termos).total)
    .slice(0, max);
  // fotos já foi definido acima (do JSON ou do Haiku)
  const extras = res.validas.filter((v) => !lidas.includes(v)).slice(0, 2);
  return { lidas, extras, termos, fotos: fotos || [], tentadas: todasCandidatas.map((c) => c.url), descartadas: res.invalidas };
}

const STOP_EN = new Set(['the', 'and', 'for', 'are', 'was', 'were', 'that', 'this', 'with', 'from', 'have', 'has', 'had', 'not', 'but', 'you', 'your', 'can', 'will', 'which', 'their', 'there', 'they', 'them', 'than', 'then', 'also', 'into', 'about', 'more', 'most', 'some', 'such', 'other', 'when', 'what', 'how', 'why', 'who', 'its', 'our', 'out', 'one', 'all', 'any', 'may', 'been', 'being', 'does', 'did', 'each', 'many', 'much', 'over', 'only', 'these', 'those', 'between', 'because', 'while', 'where', 'would', 'could', 'should', 'just', 'like', 'use', 'used', 'using', 'see', 'new', 'home', 'menu', 'search', 'read', 'share', 'privacy', 'cookies', 'policy', 'contact', 'terms']);
const STOP_PT = new Set(['para', 'como', 'mais', 'muito', 'pelo', 'pela', 'pelos', 'pelas', 'entre', 'sobre', 'quando', 'onde', 'qual', 'quais', 'quem', 'porque', 'também', 'tambem', 'ainda', 'apenas', 'assim', 'cada', 'esta', 'este', 'estes', 'estas', 'essa', 'esse', 'essas', 'esses', 'isso', 'isto', 'aqui', 'foram', 'sido', 'sendo', 'pode', 'podem', 'tem', 'tinha', 'seus', 'suas', 'dele', 'dela', 'deles', 'delas', 'nosso', 'nossa', 'menu', 'cookies', 'privacidade', 'contato']);

/**
 * Palavras fortes do assunto tiradas do texto das fontes lidas (sem gastar tokens): as mais repetidas,
 * com bônus para as que aparecem nas duas fontes; ficam de fora as comuns e as que já estão nas palavras da planilha.
 */
export function termosDeContexto(textos, termosPlanilha = [], n = 12) {
  const jaTem = new Set(termosPlanilha.map(semAcento));
  const contagem = new Map();
  const emFontes = new Map();
  for (const t of textos) {
    const vistas = new Set();
    for (const w of semAcento(t).replace(/[^a-z ]/g, ' ').split(/\s+/)) {
      if (w.length < 5 || STOP.has(w) || STOP_EN.has(w) || STOP_PT.has(w) || jaTem.has(w)) continue;
      contagem.set(w, (contagem.get(w) ?? 0) + 1);
      vistas.add(w);
    }
    for (const w of vistas) emFontes.set(w, (emFontes.get(w) ?? 0) + 1);
  }
  return [...contagem.entries()]
    .filter(([, c]) => c >= 3)
    .map(([w, c]) => [w, c * (emFontes.get(w) > 1 ? 2 : 1)])
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([w]) => w);
}

