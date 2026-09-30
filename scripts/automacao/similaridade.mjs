// Barra texto parecido demais com artigo já existente (conteúdo exclusivo) usando TF-IDF + cosseno.
import { norm } from './util.mjs';

const STOP = new Set('a o as os um uma uns umas de do da dos das em no na nos nas por para com sem que se e ou mas como mais muito quando onde qual quais ao aos pelo pela pelos pelas ser sao foi ha tem tambem isso esse essa esses essas este esta estes estas seu sua seus suas ele ela eles elas nao sim ja so apenas entre sobre ate'.split(' '));

const tokens = (t) => norm(t).match(/[a-z0-9]{3,}/g)?.filter((w) => !STOP.has(w)) ?? [];

function tf(toks) {
  const m = new Map();
  for (const t of toks) m.set(t, (m.get(t) ?? 0) + 1);
  return m;
}

/** docs: [{slug, texto}]. Devolve a semelhança máxima do `novo` contra cada documento. */
export function maiorSemelhanca(novo, docs) {
  if (!docs.length) return { valor: 0, slug: null };
  const todos = [novo, ...docs.map((d) => d.texto)].map((t) => tf(tokens(t)));
  const df = new Map();
  for (const m of todos) for (const t of m.keys()) df.set(t, (df.get(t) ?? 0) + 1);
  const N = todos.length;
  const vec = (m) => {
    const v = new Map();
    let n2 = 0;
    for (const [t, c] of m) {
      const w = (1 + Math.log(c)) * Math.log((N + 1) / (df.get(t) + 0.5));
      v.set(t, w);
      n2 += w * w;
    }
    return { v, norma: Math.sqrt(n2) || 1 };
  };
  const a = vec(todos[0]);
  let melhor = { valor: 0, slug: null };
  docs.forEach((d, i) => {
    const b = vec(todos[i + 1]);
    let dot = 0;
    for (const [t, w] of a.v) if (b.v.has(t)) dot += w * b.v.get(t);
    const cos = dot / (a.norma * b.norma);
    if (cos > melhor.valor) melhor = { valor: cos, slug: d.slug };
  });
  return melhor;
}

/** Títulos quase iguais (Jaccard de palavras). */
export function titulosParecidos(titulo, outros, limite = 0.7) {
  const a = new Set(tokens(titulo));
  for (const o of outros) {
    const b = new Set(tokens(o.titulo));
    const inter = [...a].filter((t) => b.has(t)).length;
    const uniao = new Set([...a, ...b]).size || 1;
    if (inter / uniao >= limite) return o.slug;
  }
  return null;
}
