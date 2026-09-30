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

async function abrir(url, buscarFn) {
  const r = await buscarFn(url, { headers: { 'User-Agent': UA, Accept: 'text/html,application/pdf,*/*' }, redirect: 'follow', tentativas: 2, timeoutMs: 20000 });
  return r;
}

/** Retorna { validas: [{title,url,texto,lido}], invalidas: [{url,motivo}] }. */
export async function verificarFontes(fontes, buscarFn) {
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
        const texto = /html/i.test(tipo) ? htmlParaTexto(await r.text()).slice(0, 3500) : '';
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
