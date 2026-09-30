// Prompts do redator e do validador. As regras vêm dos arquivos do projeto (fonte única):
// REGRAS_OURO.md, ARTIGO_FORMATO.md e um artigo de referência.
import { readFileSync } from 'node:fs';
import { CFG } from './config.mjs';

export const ANGULOS_PIN = ['A resposta simples', 'Você sabia?', 'Mito ou verdade?', 'Em 3 pontos', 'O que a ciência diz'];

const ler = (p) => readFileSync(p, 'utf8');

function regrasDeOuro() {
  const t = ler('REGRAS_OURO.md');
  const ini = t.indexOf('## As 15 regras');
  const fim = t.indexOf('## Checklist do validador');
  return t.slice(ini, fim).trim();
}

function checklistValidador() {
  const t = ler('REGRAS_OURO.md');
  const ini = t.indexOf('## Checklist do validador');
  const fim = t.indexOf('## Para treinar');
  return t.slice(ini, fim).trim();
}

function exemploReferencia() {
  const t = ler('src/content/artigos/por-que-o-ceu-e-azul.md');
  const corpo = t.split(/\n---\n/).slice(1).join('\n---\n').trim();
  return corpo.split(/\s+/).slice(0, 700).join(' ');
}

export const FORMATO_SAIDA = `
FORMATO DA RESPOSTA (obrigatório, nada antes nem depois):

===META===
{
  "title": "título com a keyword, natural, até 60 caracteres somando ' | Mente Curiosa' (ideal até 44)",
  "seoTitle": "",
  "description": "120 a 160 caracteres, com a keyword",
  "tags": ["3 a 6 tags curtas em português"],
  "termosFonte": ["8 a 12 palavras-chave do assunto, metade em português e metade em inglês (ex.: lua, fases, moon, phases), que uma página sobre o tema contém; o robô usa para conferir se cada fonte trata do assunto"],
  "sources": [{"title": "Instituição — título da página", "url": "https://..."}],
  "imagens": {
    "capa": {"busca": "busca em inglês, cena concreta fotografável", "alt": "português, descreve o que aparece, 25+ caracteres"},
    "fotos": [{"busca": "inglês", "alt": "português, 25+ caracteres", "legenda": "liga a foto ao texto, 10+ caracteres", "secao": 2}],
    "extras": ["2 buscas em inglês, cenas diferentes da capa, para fundos dos pins"]
  },
  "pins": [
    {"angulo": "A resposta simples", "texto": "1 frase com a resposta, até 90 caracteres"},
    {"angulo": "Você sabia?", "texto": "1 fato curioso do artigo, até 90 caracteres"},
    {"angulo": "Mito ou verdade?", "texto": "1 mito e a resposta, até 90 caracteres"},
    {"angulo": "Em 3 pontos", "texto": "3 pontos curtos separados por ' | ', até 90 caracteres no total"},
    {"angulo": "O que a ciência diz", "texto": "1 frase apoiada numa fonte, até 90 caracteres"}
  ]
}
===CORPO===
(texto em Markdown: começa direto no primeiro parágrafo, sem título H1; seções com ## )

Regras do formato:
- "fotos": 2 fotos (1 só se o texto ficar abaixo de 1.200 palavras). "secao" = número da seção ## após a qual a foto entra (1 = primeira seção ##). Não repita seção.
- "sources": 3 fontes primárias REAIS que você conhece com segurança (URLs estáveis de instituições, universidades, periódicos, órgãos públicos). Cada URL será aberta por um robô; link que não abrir é descartado. Cada fonte deve ser uma página ESPECÍFICA do assunto do artigo, com texto explicativo (por exemplo science.nasa.gov/moon/moon-phases/, esa.int, britannica.com/science/..., scielo.br, fiocruz.br); nunca a home nem uma página geral ou de notícias: o robô lê o texto da página e reprova a fonte que não trate do tema. Se não tiver certeza do caminho exato, prefira uma página de tema amplo do mesmo assunto, nunca invente caminho.
- Links internos: use SOMENTE os listados no pedido, no formato [texto](/slug/). Mínimo 2.
- Não use H1 (#) no corpo.
`.trim();

export function sistemaRedator() {
  return [
    'Você é o redator do blog Mente Curiosa (português do Brasil): explica curiosidades da ciência de forma simples, correta e útil.',
    'Siga estas regras sem exceção.',
    '',
    regrasDeOuro(),
    '',
    'EXEMPLO DE REFERÊNCIA (trecho do corpo de um artigo aprovado; imite o tom e a estrutura, nunca o conteúdo):',
    exemploReferencia(),
    '',
    FORMATO_SAIDA,
  ].join('\n');
}

export function pedidoArtigo({ linha, linksPermitidos, termoCabeca }) {
  const caudas = String(linha['Caudas longas (seções H2)'] || '').split(';').map((s) => s.trim()).filter(Boolean);
  const saude = CFG.categoriasSaude.includes(linha['Categoria (slug)']);
  return [
    `Escreva o artigo da pauta abaixo.`,
    ``,
    `Pauta: ${linha['Pauta']}`,
    `Palavra-chave principal (keyword): ${linha['Palavra-chave']}`,
    termoCabeca ? `Termo curto com busca real (use no title e no primeiro parágrafo quando soar natural): ${termoCabeca}` : '',
    `Categoria: ${linha['Cluster']} (${linha['Categoria (slug)']})`,
    `Data de publicação: ${linha.dataISO}`,
    caudas.length
      ? `Variações de busca que devem virar SEÇÕES (##) do mesmo artigo, quando fizerem sentido, nunca artigos separados:\n${caudas.map((c) => `- ${c}`).join('\n')}`
      : `Sem variações de busca catalogadas: monte as seções pela estrutura da regra 6.`,
    ``,
    `Links internos permitidos (use pelo menos 2; o primeiro da lista é sempre a página da categoria):`,
    ...linksPermitidos.map((l) => `- [${l.titulo}](${l.url})`),
    ``,
    saude ? `Assunto de saúde/mente: termine com a frase "${CFG.avisoSaude}" e não dê diagnóstico, dose ou tratamento.` : '',
    `Tamanho: 1.300 a 1.500 palavras no corpo (o mínimo aceito é 1.200 e o máximo 1.600; conte antes de responder). Cada parágrafo com NO MÁXIMO 45 palavras; divida os maiores. Frases diretas.`,
    `O title deve ter no máximo 44 caracteres (com " | Mente Curiosa" nunca passa de 60).`,
    `A palavra-chave principal, exatamente como escrita acima ("${linha['Palavra-chave']}"), deve aparecer na primeira frase do primeiro parágrafo.`,
    `Use números e estatísticas somente se aparecerem no texto da fonte citada; na dúvida, prefira uma explicação qualitativa a um número.`,
    `Afirme apenas o que as fontes citadas dizem ou o que é conhecimento científico básico e incontroverso. Não acrescente exemplos, causas, efeitos, relações ou estatísticas que a fonte não traga: um validador compara cada afirmação com o texto das fontes e reprova o que não tem apoio. Para chegar ao tamanho, aprofunde com definições, etapas e exemplos que a própria fonte traz.`,
    `Responda exatamente no FORMATO DA RESPOSTA.`,
  ].filter((x) => x !== '').join('\n');
}

export function pedidoReescrita({ anterior, problemas }) {
  return [
    'A versão abaixo foi reprovada. Corrija SOMENTE os problemas listados, mantendo o restante, e devolva o artigo completo no mesmo FORMATO DA RESPOSTA.',
    'Regras da correção: (1) para cada afirmação "sem apoio nas fontes", REMOVA a afirmação ou reescreva dizendo apenas o que a fonte diz; nunca acrescente fato novo para compensar; (2) apague também as repetições dela no FAQ, nos mitos e nos pins; (3) se o texto encurtar, mantenha o mínimo de 1.250 palavras aprofundando o que as fontes trazem; (4) se faltarem fontes, cite exatamente 3 fontes específicas do tema.',
    '',
    'PROBLEMAS:',
    ...problemas.map((p) => `- ${p}`),
    '',
    'VERSÃO ANTERIOR:',
    anterior,
  ].join('\n');
}

export function sistemaValidador() {
  return [
    'Você é o validador editorial do blog Mente Curiosa. Você NÃO reescreve: aprova ou devolve com motivos objetivos.',
    'Confira o artigo contra o checklist e contra o texto das fontes fornecidas. Só afirme que um fato está apoiado se ele aparecer nas fontes ou for conhecimento científico básico e incontroverso.',
    'Se uma fonte aparece como "não lida", você não pode usá-la para apoiar números ou estudos específicos: nesses casos devolva.',
    '',
    checklistValidador(),
    '',
    'QUANDO DEVOLVER: somente por (a) erro factual, (b) afirmação específica (número, estudo, nome, data, causa atribuída a uma fonte) que as fontes lidas não sustentam e que não é conhecimento básico, (c) violação do checklist, ou (d) risco de saúde ou segurança.',
    'NÃO devolva por estilo, foco editorial, preferência de redação, simplificação pedagógica razoável, ou por um ponto que você mesmo considerou correto ou apoiado. Conhecimento científico básico e incontroverso (ex.: a Lua reflete a luz do Sol; o ciclo de fases dura cerca de 29,5 dias) não precisa estar escrito na fonte.',
    'Em "motivos" liste SOMENTE problemas que exigem mudança no texto, cada um com o trecho exato. Se um ponto está correto, não o liste. Sugestões opcionais vão em "avisos" e não bloqueiam. Se não houver nenhum motivo bloqueante, a decisão é APROVADO.',
    'Responda SOMENTE com JSON: {"id": "...", "decisao": "APROVADO" ou "DEVOLVER", "motivos": ["V1: trecho → problema"], "correcoes": ["trecho → correção"], "avisos": ["sugestão opcional"]}',
  ].join('\n');
}

export function pedidoValidacao({ id, meta, corpo, fontes }) {
  return [
    `id: ${id}`,
    `title: ${meta.title}`,
    `description: ${meta.description}`,
    '',
    'PLANO DE IMAGENS:',
    JSON.stringify(meta.imagens, null, 1),
    '',
    'TEXTOS DOS PINS:',
    JSON.stringify(meta.pins, null, 1),
    '',
    'FONTES:',
    ...fontes.map((f) => `### ${f.title} (${f.url}) ${f.lido ? '' : '[NÃO LIDA: só confirmada como existente]'}\n${f.texto || ''}`),
    '',
    'ARTIGO:',
    corpo,
  ].join('\n');
}

/** Separa a resposta do redator em { meta, corpo }. */
export function lerResposta(texto) {
  const m = texto.match(/===META===\s*([\s\S]*?)\s*===CORPO===\s*([\s\S]*)$/);
  if (!m) throw new Error('resposta do redator fora do formato (faltam ===META=== / ===CORPO===)');
  const jsonTxt = m[1].replace(/```(?:json)?/g, '').trim();
  const meta = JSON.parse(jsonTxt);
  return { meta, corpo: m[2].trim() };
}
