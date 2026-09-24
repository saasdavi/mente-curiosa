// Pós-build: verifica o site gerado antes de ir para o ar.
// Falha o deploy se houver link interno quebrado, link sem barra final,
// imagem faltando ou redirect apontando para página inexistente.
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { readRedirects } from './lib-redirects.mjs';

const DIST = 'dist';
const errors = [];

function walk(dir) {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
}

const files = walk(DIST);
const exists = (urlPath) => {
  const clean = decodeURI(urlPath.split(/[?#]/)[0]);
  if (clean.endsWith('/')) return existsSync(join(DIST, clean, 'index.html'));
  return existsSync(join(DIST, clean));
};

const { rules } = readRedirects();
const redirected = new Set(rules.map((r) => r.from));

for (const file of files.filter((f) => f.endsWith('.html'))) {
  const html = readFileSync(file, 'utf8');
  const page = '/' + file.slice(DIST.length + 1).replace(/index\.html$/, '');
  for (const [, attr, url] of html.matchAll(/\s(href|src)="([^"]+)"/g)) {
    if (!url.startsWith('/') || url.startsWith('//')) continue;
    const path = url.split(/[?#]/)[0];
    const isFile = /\.[a-z0-9]+$/i.test(path);
    if (!isFile && !path.endsWith('/')) errors.push(`${page}: link sem barra final → ${url}`);
    else if (!exists(path) && !redirected.has(path)) errors.push(`${page}: ${attr} quebrado → ${url}`);
    else if (redirected.has(path)) errors.push(`${page}: link para URL redirecionada (aponte direto para o destino) → ${url}`);
  }
}

for (const r of rules.filter((r) => r.internal)) {
  if (!exists(r.to)) errors.push(`redirect ${r.where}: destino não existe → ${r.to}`);
}

if (errors.length) {
  console.error(`✖ check-build: ${errors.length} problema(s)\n  ` + errors.join('\n  '));
  process.exit(1);
}
const pages = files.filter((f) => f.endsWith('.html')).length;
console.log(`✔ check-build: ${pages} páginas, links internos e redirects OK`);
