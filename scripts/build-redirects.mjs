// prebuild: gera os arquivos de redirect da hospedagem a partir de redirects/*.csv.
// Hoje: Cloudflare Pages (_redirects para 301, Pages Function para 410).
// No WordPress, os mesmos CSVs são importados no plugin Redirection.
import { writeFileSync, rmSync, mkdirSync } from 'node:fs';
import { readRedirects } from './lib-redirects.mjs';

const { rules, errors, pending } = readRedirects();

if (errors.length) {
  console.error('✖ Erros nos redirects:\n  ' + errors.join('\n  '));
  process.exit(1);
}
pending.forEach((p) => console.warn(`⚠ redirect pendente (vai responder 404): ${p}`));

const moved = rules.filter((r) => r.status === 301);
const gone = rules.filter((r) => r.status === 410);

// 301 — Cloudflare Pages aceita até 2.000 regras estáticas no _redirects.
if (moved.length > 2000) console.warn(`⚠ ${moved.length} redirects: acima do limite do _redirects; migrar para Bulk Redirects.`);
const header = '# GERADO AUTOMATICAMENTE por scripts/build-redirects.mjs — edite redirects/*.csv\n';
writeFileSync('public/_redirects', header + moved.map((r) => `${r.from} ${r.to} 301`).join('\n') + '\n');

// 410 — _redirects não suporta 410; uma Pages Function responde só nesses caminhos.
rmSync('functions', { recursive: true, force: true });
rmSync('public/_routes.json', { force: true });
if (gone.length) {
  if (gone.length > 100) console.warn('⚠ mais de 100 URLs 410: considere deixá-las como 404.');
  mkdirSync('functions', { recursive: true });
  writeFileSync(
    'functions/_middleware.js',
    `${header.replace('#', '//')}const GONE = new Set(${JSON.stringify(gone.map((r) => r.from))});
export async function onRequest({ request, next }) {
  const path = new URL(request.url).pathname;
  if (GONE.has(path)) {
    return new Response('<!doctype html><meta charset="utf-8"><title>Conteúdo removido</title><p>Este conteúdo foi removido. <a href="/">Ir para o início</a>.</p>', {
      status: 410,
      headers: { 'Content-Type': 'text/html; charset=utf-8', 'X-Robots-Tag': 'noindex' },
    });
  }
  return next();
}
`,
  );
  // A Function só é invocada nesses caminhos; o resto do site continua 100% estático.
  writeFileSync('public/_routes.json', JSON.stringify({ version: 1, include: gone.map((r) => r.from).slice(0, 100), exclude: [] }, null, 2) + '\n');
}

// Vercel: mesmo conteúdo em vercel.json (lido no início do deploy, por isso também fica versionado).
const vercel = {
  $schema: 'https://openapi.vercel.sh/vercel.json',
  framework: 'astro',
  buildCommand: 'npm run build',
  outputDirectory: 'dist',
  trailingSlash: true,
  headers: [
    { source: '/migration-map.csv', headers: [{ key: 'X-Robots-Tag', value: 'noindex' }] },
    { source: '/images/(.*)', headers: [{ key: 'Cache-Control', value: 'public, max-age=2592000' }] },
    { source: '/_astro/(.*)', headers: [{ key: 'Cache-Control', value: 'public, max-age=31536000, immutable' }] },
  ],
  redirects: moved.map((r) => ({ source: r.from, destination: r.to, permanent: true })),
};
writeFileSync('vercel.json', JSON.stringify(vercel, null, 2) + '\n');

console.log(`✔ redirects: ${moved.length} × 301, ${gone.length} × 410, ${pending.length} pendentes`);
