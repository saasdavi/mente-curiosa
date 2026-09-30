// Utilitários compartilhados pelos scripts de build (leitura de artigos e CSVs).
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import yaml from 'js-yaml';

export const ARTIGOS_DIR = 'src/content/artigos';

export function loadArticles() {
  return readdirSync(ARTIGOS_DIR)
    .filter((f) => f.endsWith('.md'))
    .map((file) => {
      const raw = readFileSync(join(ARTIGOS_DIR, file), 'utf8');
      const m = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
      if (!m) throw new Error(`${file}: frontmatter ausente`);
      return { file, data: yaml.load(m[1]) ?? {}, body: m[2] };
    });
}

// CSV simples com aspas; ignora linhas vazias e comentários (#).
export function parseCsv(text) {
  const rows = [];
  for (const line of text.split(/\r?\n/)) {
    if (!line.trim() || line.startsWith('#')) continue;
    const cells = [];
    let cur = '', q = false;
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (q) {
        if (c === '"' && line[i + 1] === '"') { cur += '"'; i++; }
        else if (c === '"') q = false;
        else cur += c;
      } else if (c === '"') q = true;
      else if (c === ',') { cells.push(cur); cur = ''; }
      else cur += c;
    }
    cells.push(cur);
    rows.push(cells);
  }
  return rows;
}

export function loadRedirects() {
  if (!existsSync('redirects')) return [];
  const out = [];
  for (const f of readdirSync('redirects').filter((f) => f.endsWith('.csv'))) {
    const [header, ...rows] = parseCsv(readFileSync(join('redirects', f), 'utf8'));
    if (!header) continue;
    for (const r of rows) {
      out.push({ from: r[header.indexOf('from')]?.trim(), to: r[header.indexOf('to')]?.trim() ?? '', file: f });
    }
  }
  return out;
}
