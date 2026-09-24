// Leitura e validação dos CSVs de redirect (usado no prebuild e no check pós-build).
import { readFileSync, readdirSync } from 'node:fs';

export function readRedirects(dir = 'redirects') {
  const rules = [];
  const errors = [];
  const pending = [];
  for (const file of readdirSync(dir).filter((f) => f.endsWith('.csv')).sort()) {
    const lines = readFileSync(`${dir}/${file}`, 'utf8').split(/\r?\n/);
    lines.forEach((raw, i) => {
      const line = raw.trim();
      if (!line || line.startsWith('#') || /^from\s*,/.test(line)) return;
      const [from = '', to = '', ...note] = line.split(',').map((s) => s.trim());
      const where = `${file}:${i + 1}`;
      if (!from.startsWith('/')) return errors.push(`${where} "from" deve começar com /: ${from}`);
      if (/[*:?#]/.test(from)) return errors.push(`${where} use caminhos exatos (sem query, * ou :param): ${from}`);
      if (!to) return pending.push(`${where} ${from}`);
      if (to === '410') return rules.push({ from, to, status: 410, file, where, note: note.join(',') });
      const internal = to.startsWith('/');
      if (!internal && !/^https:\/\//.test(to)) return errors.push(`${where} destino inválido: ${to}`);
      if (internal && !to.endsWith('/')) return errors.push(`${where} destino interno sem barra final: ${to}`);
      if (from === to) return errors.push(`${where} redirect para si mesmo: ${from}`);
      rules.push({ from, to, status: 301, file, where, internal, note: note.join(',') });
    });
  }
  const seen = new Map();
  for (const r of rules) {
    if (seen.has(r.from)) errors.push(`${r.where} "from" duplicado (também em ${seen.get(r.from)}): ${r.from}`);
    seen.set(r.from, r.where);
  }
  // Cadeias: A → B → C devem apontar direto para C.
  for (const r of rules) {
    if (r.internal && seen.has(r.to)) errors.push(`${r.where} cadeia de redirect: ${r.from} → ${r.to} → ...`);
  }
  return { rules, errors, pending };
}
