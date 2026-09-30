import { execFileSync } from 'node:child_process';
import { norm } from '../lib-audit.mjs';

export { norm };
export const slugify = (s) =>
  norm(s).replace(/[^a-z0-9]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');

export const esperar = (ms) => new Promise((r) => setTimeout(r, ms));

/** Data de hoje (AAAA-MM-DD) no fuso do Brasil. */
export function hojeBR(fuso = 'America/Sao_Paulo', agora = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: fuso }).format(agora);
}

export function somarDias(iso, dias) {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
}

/** Aceita AAAA-MM-DD ou DD/MM/AAAA; devolve AAAA-MM-DD ou null. */
export function paraISO(valor) {
  const s = String(valor ?? '').trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  return m ? `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}` : null;
}

export function git(args, opts = {}) {
  return execFileSync('git', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], ...opts }).trim();
}

/** fetch com timeout e repetição para erros transitórios (429/5xx/rede). */
export async function buscar(url, { tentativas = 3, timeoutMs = 30000, ...init } = {}) {
  let ultimo;
  for (let i = 0; i < tentativas; i++) {
    try {
      const r = await fetch(url, { ...init, signal: AbortSignal.timeout(timeoutMs) });
      if (r.status === 429 || r.status >= 500) {
        ultimo = new Error(`HTTP ${r.status} em ${url}`);
      } else {
        return r;
      }
    } catch (e) {
      ultimo = e;
    }
    await esperar(1500 * (i + 1) ** 2);
  }
  throw ultimo;
}

export function log(...a) {
  console.log(...a);
}
