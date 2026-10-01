// Portões determinísticos (AUDITORIA_AUTOMATICA.md). Cada função devolve uma lista de problemas; vazia = passou.
import { CFG } from './config.mjs';
import { norm } from './util.mjs';

const semLinks = (md) => md.replace(/\]\([^)]*\)/g, ']').replace(/https?:\/\/\S+/g, ' ');

// ---- números e datas (P4) ----
function normNum(s) {
  let t = s.replace(/\s/g, '');
  if (/^\d{1,3}([.,]\d{3})+$/.test(t)) return t.replace(/[.,]/g, '');
  return t.replace(',', '.');
}
export function numerosDe(texto) {
  const out = new Set();
  for (const m of semLinks(texto).matchAll(/\d+(?:[.,\s]\d{3})*(?:[.,]\d+)?/g)) out.add(normNum(m[0]));
  return out;
}
/** Números relevantes do artigo: 11 ou mais, ou com decimais. Numerais pequenos (1 a 10) são ignorados. */
function numerosRelevantes(corpo) {
  const base = semLinks(corpo).replace(/^#{1,6} .*$/gm, ' ').replace(/^\s*\d+[.)] /gm, ' ');
  const achados = new Set();
  for (const m of base.matchAll(/\d+(?:[.,\s]\d{3})*(?:[.,]\d+)?/g)) {
    const n = normNum(m[0]);
    if (/[.]/.test(n) || Number(n) >= 11) achados.add(n);
  }
  return achados;
}
export function checarFatos(corpo, fontes) {
  const lidas = fontes.filter((f) => f.lido);
  if (lidas.length < CFG.fontesMin) return [`P4: só ${lidas.length} fonte(s) pôde(ram) ser lida(s); preciso de ${CFG.fontesMin} para conferir os números`];
  const nasFontes = new Set();
  for (const f of lidas) for (const n of numerosDe(f.texto)) nasFontes.add(n);
  // Permite números que estão ±1 de um número nas fontes (ex: fonte 29 → aceita 28-30; fonte 29.5 → aceita 28.5-30.5)
  const dentroDaToleancia = (num) => {
    const val = Number(num);
    for (const fn of nasFontes) {
      const fval = Number(fn);
      if (Math.abs(val - fval) <= 1) return true;
    }
    return false;
  };
  const faltando = [...numerosRelevantes(corpo)].filter((n) => !nasFontes.has(n) && !dentroDaToleancia(n));
  return faltando.length ? [`P4: número(s) sem apoio no texto das fontes: ${faltando.slice(0, 8).join(', ')} (remova ou troque por dado que a fonte traz)`] : [];
}

// ---- cópia de fontes (P6) ----
function palavras(t) {
  return norm(semLinks(t)).match(/[a-z0-9]+/g) ?? [];
}
export function percentualCopiado(corpo, fontes, n = 8) {
  const a = palavras(corpo);
  if (a.length < n) return 0;
  const conj = new Set();
  for (const f of fontes) {
    const p = palavras(f.texto || '');
    for (let i = 0; i + n <= p.length; i++) conj.add(p.slice(i, i + n).join(' '));
  }
  let iguais = 0;
  const total = a.length - n + 1;
  for (let i = 0; i < total; i++) if (conj.has(a.slice(i, i + n).join(' '))) iguais++;
  return iguais / total;
}
export function checarCopia(corpo, fontes, limite = 0.03) {
  const p = percentualCopiado(corpo, fontes);
  return p > limite ? [`P6: ${(p * 100).toFixed(1)}% do texto repete trechos das fontes (máx. ${limite * 100}%); reescreva com suas palavras`] : [];
}

// ---- segurança (P8) ----
export function checarSeguranca(corpo, categoria) {
  if (!CFG.categoriasSaude.includes(categoria)) return [];
  const p = [];
  if (!/não substitui a orientação de um profissional de saúde/i.test(corpo)) p.push(`P8: falta a frase "${CFG.avisoSaude}" no fim do texto`);
  if (/\b(tome|tomar|tomando)\b.{0,40}\b(mg|comprimido|remédio|medicamento)\b|\bdose\b|\bposologia\b|\b\d+\s?mg\b|trate com\b/i.test(corpo)) {
    p.push('P8: o texto dá orientação de tratamento ou dose; remova');
  }
  return p;
}

// ---- links internos (P9) ----
export function checarLinksInternos(corpo, permitidos) {
  const ok = new Set(permitidos);
  const ruins = [...corpo.matchAll(/\]\((\/[^)\s]*)\)/g)].map((m) => m[1]).filter((l) => !ok.has(l));
  return ruins.length ? [`P9: link(s) interno(s) inexistente(s): ${[...new Set(ruins)].join(', ')}; use só os da lista`] : [];
}

// ---- metadados e estrutura (P2) ----
export function checarMeta(meta, corpo) {
  const p = [];
  if (!meta.title || meta.title.length < 10 || meta.title.length > 110) p.push('P2: title precisa ter entre 10 e 110 caracteres');
  if (!meta.description || meta.description.length < 110 || meta.description.length > 160) p.push(`P2: description com ${meta.description?.length ?? 0} caracteres (precisa de 110 a 160)`);
  if (!Array.isArray(meta.tags) || meta.tags.length < 1 || meta.tags.length > 8) p.push('P2: tags precisa ter de 1 a 8 itens');
  if (!meta.imagens?.capa?.busca || !meta.imagens?.capa?.alt || meta.imagens.capa.alt.length < 25) p.push('P2: plano de imagens sem capa (busca + alt de 25+ caracteres)');
  const fotos = meta.imagens?.fotos ?? [];
  if (fotos.length < 1 || fotos.length > 3) p.push('P2: plano de imagens precisa de 1 a 3 fotos no corpo');
  const h2 = (corpo.match(/^## .+$/gm) ?? []).length;
  const secoes = new Set();
  for (const f of fotos) {
    if (!f.alt || f.alt.length < 25 || !f.legenda || f.legenda.length < 10 || !f.busca) p.push('P2: foto do corpo sem busca, alt (25+) ou legenda (10+)');
    if (!Number.isInteger(f.secao) || f.secao < 1 || f.secao > h2 || secoes.has(f.secao)) p.push(`P2: seção ${f.secao} inválida ou repetida (o texto tem ${h2} seções ##)`);
    secoes.add(f.secao);
  }
  return p;
}

/** Junta tudo que é checado sem rede (exceto fatos, que dependem das fontes lidas). */
export function checarTexto({ meta, corpo, categoria, permitidos }) {
  return [...checarMeta(meta, corpo), ...checarSeguranca(corpo, categoria), ...checarLinksInternos(corpo, permitidos)];
}
