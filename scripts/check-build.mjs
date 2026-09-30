// Pós-build: confere o dist/ — páginas dos artigos, sitemap e links internos.
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { loadArticles } from './lib.mjs';

const DIST = 'dist';
const errors = [];
const walk = (d) => readdirSync(d).flatMap((f) => (statSync(join(d, f)).isDirectory() ? walk(join(d, f)) : [join(d, f)]));

const now = new Date();
for (const a of loadArticles()) {
  const live = !a.data.draft && a.data.featuredImage && new Date(a.data.datePublished) <= now;
  if (live && !existsSync(join(DIST, a.data.slug, 'index.html'))) errors.push(`artigo publicado sem página: /${a.data.slug}/`);
}
for (const f of ['sitemap.xml', 'robots.txt', 'feed.xml']) if (!existsSync(join(DIST, f))) errors.push(`faltando dist/${f}`);

for (const file of walk(DIST).filter((f) => f.endsWith('.html'))) {
  const html = readFileSync(file, 'utf8');
  for (const [, href] of html.matchAll(/<a\s[^>]*href="(\/[^"#?]*)/g)) {
    if (href.startsWith('//')) continue;
    const isFile = /\.[a-z0-9]+$/i.test(href);
    if (!isFile && !href.endsWith('/')) errors.push(`${file}: link sem barra final: ${href}`);
    const target = isFile ? join(DIST, href) : join(DIST, href, 'index.html');
    if (!existsSync(target)) errors.push(`${file}: link quebrado: ${href}`);
  }
}
if (errors.length) { console.error([...new Set(errors)].join('\n')); process.exit(1); }
console.log('check-build: ok');
