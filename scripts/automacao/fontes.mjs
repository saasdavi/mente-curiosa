// Confere se cada fonte citada existe e extrai um trecho do texto para o validador conferir os fatos.
import { DOMINIOS_CONFIAVEIS, DOMINIOS_BLOQUEADOS } from './config.mjs';

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
export async function verificarFontes(fontes, buscarFn, termos = []) {
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
        const completo = /html/i.test(tipo) ? htmlParaTexto(await r.text()) : '';
        if (completo.length >= 300 && termos.length) {
          const rel = relevancia(completo, termos);
          const minimo = Math.min(2, termos.length);
          if (rel.distintos < minimo || rel.total < 4) {
            invalidas.push({ url: f.url, motivo: `a página não trata do assunto (só ${rel.distintos} dos termos: ${termos.join(', ')}); use uma página ESPECÍFICA sobre o tema, não a home nem uma página geral` });
            continue;
          }
        }
        const texto = completo ? trechoRelevante(completo, termos) : '';
        validas.push({ title: f.title, url: f.url, texto, lido: Boolean(texto) });
      } else if ([401, 403, 429, 999].includes(r.status) && confiavel(host)) {
        validas.push({ title: f.title, url: f.url, texto: '', lido: false });
      } else {
        invalidas.push({ url: f.url, motivo: `HTTP ${r.status}` });
      }
    } catch (e) {
      invalidas.push({ url: f.url, motivo: `não abriu (${e.message.slice(0, 60)})` });
    }
  }
  return { validas, invalidas };
}
