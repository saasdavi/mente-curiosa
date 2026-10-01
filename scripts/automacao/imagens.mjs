// Fotos com licença (Pexels, NASA), conferência por IA e composição das imagens do artigo (sharp).
import sharp from 'sharp';
import { readFileSync } from 'node:fs';
import { buscar, slugify } from './util.mjs';
import { extrairJSON, chamarClaudeComImagem } from './claude.mjs';

const LICENCA_PEXELS = { license: 'Licença Pexels', licenseUrl: 'https://www.pexels.com/license/' };
const LICENCA_NASA = { license: 'Imagem da NASA (uso público)', licenseUrl: 'https://www.nasa.gov/nasa-brand-center/images-and-media/' };

// Sem Claude aqui: o robô só chama a API do Pexels e pontua cada foto pela descrição (alt) que o próprio Pexels informa.
const PROIBIDAS = /\b(blood|bloody|dead|corpse|death|dying|gun|weapon|knife|war|violence|kill|killed|injur\w*|wound\w*|skull|naked|nude|logo|brand)\b/i;
const FALLBACK_CATEGORIA = {
  'universo-e-espaco': 'night sky stars',
  animais: 'wildlife nature',
  'ciencia-e-fenomenos': 'science laboratory',
  'corpo-humano': 'human anatomy model',
  'psicologia-e-comportamento': 'thinking mind',
  'tecnologia-ia-e-ciencia': 'technology computer',
};
export { FALLBACK_CATEGORIA };
const palavras = (t) => String(t).toLowerCase().split(/[^a-z]+/).filter((w) => w.length >= 3);
/** Quantas palavras da busca aparecem na descrição da foto (0 se a descrição vier vazia). */
export function pontuar(consulta, alt) {
  const a = new Set(palavras(alt));
  return palavras(consulta).filter((w) => a.has(w)).length;
}

/** Candidatas do Pexels: [{ id, fonte, urlImagem, autor, urlCredito, pontos, ...licença }] ordenadas da mais à menos adequada. */
export async function buscarPexels(consulta, { chave = process.env.PEXELS_API_KEY, pagina = 1 } = {}) {
  if (!chave) throw new Error('PEXELS_API_KEY não definida');
  // orientation=landscape (cabe na capa 16:9), size=medium (12 MP, suficiente), 30 resultados para escolher
  const u = `https://api.pexels.com/v1/search?query=${encodeURIComponent(consulta)}&per_page=30&page=${pagina}&orientation=landscape&size=medium`;
  const r = await buscar(u, { headers: { Authorization: chave } });
  if (!r.ok) throw new Error(`Pexels HTTP ${r.status}`);
  const j = await r.json();
  return (j.photos ?? [])
    .filter((f) => !PROIBIDAS.test(f.alt ?? ''))
    .map((f, i) => ({
      id: `pexels:${f.id}`,
      fonte: 'Pexels',
      urlImagem: f.src?.large2x || f.src?.large || f.src?.original,
      autor: f.photographer || 'Pexels',
      urlCredito: f.url,
      descricao: String(f.alt ?? '').trim(),
      pontos: pontuar(consulta, f.alt),
      ordem: i,
      ...LICENCA_PEXELS,
    }))
    .sort((x, y) => y.pontos - x.pontos || x.ordem - y.ordem);
}

/** Candidatas da NASA Image Library (sem chave). A URL da imagem é resolvida sob demanda. */
export async function buscarNasa(consulta) {
  const r = await buscar(`https://images-api.nasa.gov/search?q=${encodeURIComponent(consulta)}&media_type=image&page_size=15`);
  if (!r.ok) throw new Error(`NASA HTTP ${r.status}`);
  const j = await r.json();
  return (j.collection?.items ?? []).slice(0, 15).map((it) => {
    const d = it.data?.[0] ?? {};
    return {
      id: `nasa:${d.nasa_id}`,
      fonte: 'NASA',
      autor: d.photographer || d.secondary_creator || `NASA${d.center ? ` (${d.center})` : ''}`,
      urlCredito: `https://images.nasa.gov/details/${encodeURIComponent(d.nasa_id)}`,
      ...LICENCA_NASA,
      resolver: async () => {
        const a = await (await buscar(`https://images-api.nasa.gov/asset/${encodeURIComponent(d.nasa_id)}`)).json();
        const urls = (a.collection?.items ?? []).map((x) => x.href).filter((h) => /\.(jpe?g|png)$/i.test(h));
        return urls.find((h) => /~large/i.test(h)) || urls.find((h) => /~medium/i.test(h)) || urls.find((h) => /~orig/i.test(h)) || urls[0];
      },
    };
  });
}

export async function baixarImagem(cand, buscarFn = buscar) {
  const url = cand.urlImagem || (await cand.resolver?.());
  if (!url) throw new Error('candidata sem URL de imagem');
  const r = await buscarFn(url, { timeoutMs: 60000 });
  if (!r.ok) throw new Error(`download HTTP ${r.status}`);
  const buf = Buffer.from(await r.arrayBuffer());
  if (buf.length > 30 * 1024 * 1024) throw new Error('imagem grande demais');
  return buf;
}

/**
 * Pede à IA para olhar a foto. Devolve { ok, motivo, altCorrigido }.
 * - foto adequada ao tema mas com legenda imprecisa: ok=true e altCorrigido descrevendo só o que aparece;
 * - foto sem relação com o tema, com pessoas reconhecíveis, marcas, texto legível ou violência explícita: ok=false.
 */
export async function fotoConfereComAlt(buffer, alt, visaoFn = chamarClaudeComImagem, tema = '') {
  const jpeg = await sharp(buffer).resize(900, 900, { fit: 'inside' }).jpeg({ quality: 70 }).toBuffer();
  const texto = await visaoFn({
    system: 'Você confere fotos para um blog de ciência para o grande público. Responda SOMENTE com JSON: {"ok": true|false, "motivo": "curto", "alt_corrigido": "texto alternativo em português ou vazio"}.',
    pergunta: [
      `Texto alternativo proposto: "${alt}"`,
      tema ? `Tema buscado: "${tema}"` : '',
      '',
      'Regras:',
      '- ok=false se a foto não tem relação com o tema, mostra pessoa reconhecível, marca, logo, texto legível que atrapalhe, ou violência explícita (sangue, animal morto ou ferido em destaque, cena de ataque).',
      '- Se a foto serve ao tema mas o texto alternativo está impreciso, responda ok=true e escreva em alt_corrigido um texto em português (25 a 140 caracteres) que descreva somente o que aparece na foto.',
      '- Se o texto alternativo já está correto, ok=true e alt_corrigido vazio.',
    ].filter((x) => x !== '').join('\n'),
    imagemBase64: jpeg.toString('base64'),
  });
  try {
    const j = extrairJSON(texto);
    const altCorrigido = String(j.alt_corrigido ?? '').trim();
    return { ok: j.ok === true, motivo: String(j.motivo ?? ''), altCorrigido: altCorrigido.length >= 25 ? altCorrigido : '' };
  } catch {
    return { ok: false, motivo: 'resposta da IA ilegível', altCorrigido: '' };
  }
}

const ESC = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function quebrarLinhas(texto, maxChars) {
  const linhas = [];
  let atual = '';
  for (const w of texto.split(/\s+/)) {
    if ((atual + ' ' + w).trim().length > maxChars && atual) { linhas.push(atual); atual = w; }
    else atual = (atual + ' ' + w).trim();
  }
  if (atual) linhas.push(atual);
  return linhas;
}

export async function fotoCorpo(buffer) {
  return sharp(buffer).resize(1200, 800, { fit: 'cover', position: 'attention' }).webp({ quality: 80 }).toBuffer();
}

/** Capa 1200×675: foto de fundo + degradê + título + marca. */
export async function comporCapa(buffer, titulo, logoPath = 'public/brand/logo-circulo-400.png') {
  const W = 1200, H = 675;
  let tam = 58, linhas = quebrarLinhas(titulo, Math.floor(1000 / (tam * 0.6)));
  while (linhas.length > 4 && tam > 34) { tam -= 4; linhas = quebrarLinhas(titulo, Math.floor(1000 / (tam * 0.6))); }
  const altura = linhas.length * tam * 1.2;
  const y0 = H - 70 - altura;
  const textos = linhas.map((l, i) => `<text x="64" y="${y0 + (i + 1) * tam * 1.2 - 8}" font-family="DejaVu Sans, Arial, sans-serif" font-weight="bold" font-size="${tam}" fill="#ffffff">${ESC(l)}</text>`).join('');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}"><defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0.25" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity="0.82"/></linearGradient></defs><rect width="${W}" height="${H}" fill="url(#g)"/>${textos}<text x="64" y="${H - 28}" font-family="DejaVu Sans, Arial, sans-serif" font-size="24" fill="#ffffffcc">Mente Curiosa</text></svg>`;
  const logo = await sharp(readFileSync(logoPath)).resize(84, 84).toBuffer();
  return sharp(buffer)
    .resize(W, H, { fit: 'cover', position: 'attention' })
    .composite([{ input: Buffer.from(svg) }, { input: logo, left: 56, top: 40 }])
    .webp({ quality: 82 })
    .toBuffer();
}

/**
 * Escolhe e prepara as imagens do artigo.
 * deps: { pexels, nasa, baixar, confere } (substituíveis nos testes)
 * Retorna { capa, fotos } ou lança erro com o motivo.
 */
export async function prepararImagens({ meta, categoria, slug, titulo, fontesFoto, usados, previas = [], deps = {} }) {
  const d = { pexels: buscarPexels, nasa: buscarNasa, baixar: baixarImagem, confere: async () => ({ ok: true, motivo: '', altCorrigido: '' }), ...deps };
  const usadosLocal = new Set(usados);
  const buscarCandidatas = async (consulta) => {
    const lista = [];
    for (const f of fontesFoto) {
      try {
        lista.push(...(await (f === 'nasa' ? d.nasa : d.pexels)(consulta)));
      } catch (e) {
        console.warn(`aviso: busca em ${f} falhou (${e.message})`);
      }
      if (lista.length >= 6) break;
    }
    return lista.filter((c) => !usadosLocal.has(c.urlCredito) && !usadosLocal.has(c.id));
  };
  const escolher = async (consulta, alt, previa) => {
    const motivos = [];
    if (previa) { // foto já escolhida antes de escrever: baixa essa; se falhar, cai na busca normal
      try {
        const buf = await d.baixar(previa.c);
        usadosLocal.add(previa.c.urlCredito); usadosLocal.add(previa.c.id);
        return { c: previa.c, buf, alt };
      } catch (e) { motivos.push(e.message); }
    }
    // busca do plano → só as 2 primeiras palavras → busca genérica da categoria
    const consultas = [...new Set([consulta, String(consulta).split(/\s+/).slice(0, 2).join(' '), FALLBACK_CATEGORIA[categoria]].filter(Boolean))];
    for (const q of consultas) {
      let tentativas = 0;
      for (const c of await buscarCandidatas(q)) {
        if (tentativas++ >= 3) break;
        try {
          const buf = await d.baixar(c);
          const r = await d.confere(buf, alt, undefined, q);
          if (r.ok) { usadosLocal.add(c.urlCredito); usadosLocal.add(c.id); return { c, buf, alt: r.altCorrigido || alt }; }
          motivos.push(r.motivo);
        } catch (e) { motivos.push(e.message); }
      }
    }
    throw new Error(`sem foto que confira com "${alt.slice(0, 50)}" (${motivos.slice(0, 2).join('; ') || 'sem candidatas'})`);
  };
  const credito = (c) => ({ author: c.autor, source: c.fonte, url: c.urlCredito, license: c.license, licenseUrl: c.licenseUrl });

  previas.forEach((p) => { usadosLocal.add(p.c.urlCredito); usadosLocal.add(p.c.id); });
  const cap = await escolher(meta.imagens.capa.busca, meta.imagens.capa.alt, previas[0]);
  const capa = {
    arquivo: `${slug}.webp`,
    buffer: await comporCapa(cap.buf, titulo),
    alt: cap.alt,
    credito: credito(cap.c),
  };
  const fotos = [];
  for (const [i, f] of meta.imagens.fotos.entries()) {
    const e = await escolher(f.busca, f.alt, previas[i + 1]);
    const nome = slugify(e.alt).split('-').slice(0, 7).join('-') || `foto-${fotos.length + 1}`;
    fotos.push({
      arquivo: `${nome}.webp`,
      buffer: await fotoCorpo(e.buf),
      alt: e.alt,
      legenda: f.legenda,
      secao: f.secao,
      credito: credito(e.c),
    });
  }
  return { capa, fotos };
}

/**
 * Escolhe as fotos ANTES de escrever (sem Claude e sem baixar nada): uma por busca (a 1ª é a capa), sem repetir.
 * Devolve [{ consulta, c }] (c = candidata do Pexels/NASA com `descricao`). Lança erro se faltar foto para o tema.
 */
export async function escolherFotosPrevias({ buscas, categoria, usados = new Set(), fontesFoto = ['pexels'], deps = {} }) {
  const d = { pexels: buscarPexels, nasa: buscarNasa, ...deps };
  const usadosLocal = new Set(usados);
  const fora = [];
  const lista = [];
  for (const consulta of buscas) {
    const consultas = [...new Set([consulta, String(consulta).split(/\s+/).slice(0, 2).join(' '), FALLBACK_CATEGORIA[categoria]].filter(Boolean))];
    let achou = null;
    for (const q of consultas) {
      for (const f of fontesFoto) {
        try {
          const cands = await (f === 'nasa' ? d.nasa : d.pexels)(q);
          achou = cands.find((c) => !usadosLocal.has(c.urlCredito) && !usadosLocal.has(c.id));
        } catch (e) { fora.push(e.message); }
        if (achou) break;
      }
      if (achou) break;
    }
    if (!achou) throw new Error(`sem foto no banco de imagens para "${consulta}"${fora.length ? ` (${fora[0]})` : ''}`);
    usadosLocal.add(achou.urlCredito); usadosLocal.add(achou.id);
    lista.push({ consulta, c: achou });
  }
  return lista;
}
