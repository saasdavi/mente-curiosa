import test from 'node:test';
import assert from 'node:assert/strict';
import { CFG } from '../config.mjs';
import { hojeBR, somarDias, paraISO, slugify } from '../util.mjs';
import { letraColuna, linhasDoCalendario } from '../sheets.mjs';
import { checarFatos, checarCopia, checarSeguranca, checarLinksInternos, checarMeta, percentualCopiado } from '../gates.mjs';
import { maiorSemelhanca, titulosParecidos } from '../similaridade.mjs';
import { selecionarPautas, falhasRecentes, processarPauta, statusAposFalha } from '../gerar-do-dia.mjs';
import { lerResposta } from '../prompts.mjs';
import { extrairJSON } from '../claude.mjs';
import { lerAcervo } from '../artigo.mjs';
import { LINHA, respostaRedator, depsFalsas, TEXTO_FONTE } from './mock.mjs';

test('datas', () => {
  assert.equal(somarDias('2026-10-31', 1), '2026-11-01');
  assert.equal(paraISO('01/10/2026'), '2026-10-01');
  assert.equal(paraISO('2026-10-01'), '2026-10-01');
  assert.equal(paraISO('lixo'), null);
  assert.equal(hojeBR('America/Sao_Paulo', new Date('2026-10-01T02:00:00Z')), '2026-09-30'); // 23h do dia 30 em Brasília
  assert.equal(slugify('Por que o céu é azul?'), 'por-que-o-ceu-e-azul');
});

test('planilha: colunas e linhas', () => {
  assert.equal(letraColuna(0), 'A');
  assert.equal(letraColuna(25), 'Z');
  assert.equal(letraColuna(26), 'AA');
  const { linhas, colunas } = linhasDoCalendario([['Data (AAAA-MM-DD)', 'Status'], ['01/10/2026', 'planejado']]);
  assert.equal(linhas[0].dataISO, '2026-10-01');
  assert.equal(linhas[0]._linha, 2);
  assert.equal(colunas.Status, 1);
});

test('P1: seleção respeita status, data, duplicidade e limite', () => {
  const acervo = [{ data: { slug: 'ja-existe', id: 'ART0001', keyword: 'tema antigo' } }];
  const base = (o) => ({ 'ID Artigo': 'ART1', Slug: 's1', 'Palavra-chave': 'k1', 'Ordem do Dia': '1', Status: 'planejado', dataISO: '2026-10-02', ...o });
  const linhas = [
    base({}),
    base({ 'ID Artigo': 'ART2', Slug: 's2', 'Palavra-chave': 'k2', dataISO: '2026-10-09' }),       // fora do horizonte
    base({ 'ID Artigo': 'ART3', Slug: 'ja-existe', 'Palavra-chave': 'k3' }),                          // slug já existe
    base({ 'ID Artigo': 'ART4', Slug: 's4', 'Palavra-chave': 'k4', Status: 'publicado' }),            // status errado
    base({ 'ID Artigo': 'ART5', Slug: 's5', 'Palavra-chave': 'k5' }),                                 // já tem branch
    base({ 'ID Artigo': 'ART6', Slug: 's6', 'Palavra-chave': 'k6', dataISO: '2026-10-01' }),
  ];
  const r = selecionarPautas({ linhas, acervo, hoje: '2026-10-01', horizonte: 2, max: 5, branches: ['refs/heads/artigo/art5-s5'] });
  assert.deepEqual(r.map((x) => x['ID Artigo']), ['ART6', 'ART1']);
  assert.equal(selecionarPautas({ linhas, acervo, hoje: '2026-10-01', horizonte: 2, max: 1, branches: [] }).length, 1);
});

test('P4: números precisam aparecer nas fontes lidas', () => {
  const fontes = [{ lido: true, texto: TEXTO_FONTE }, { lido: true, texto: 'outra fonte 4 graus' }];
  assert.deepEqual(checarFatos('O gelo tem 917 kg e a água 1.000 kg.', fontes), []);
  assert.match(checarFatos('O gelo tem 999 kg.', fontes)[0], /999/);
  assert.match(checarFatos('texto', [{ lido: false, texto: '' }])[0], /pôde ser lida|pôde\(ram\) ser lida/);
});

test('P6: cópia e semelhança', () => {
  const fonte = 'a densidade do gelo e menor que a da agua liquida por causa da estrutura hexagonal das moleculas';
  assert.ok(percentualCopiado(`intro ${fonte} fim`, [{ texto: fonte }]) > 0.3);
  assert.equal(checarCopia('texto totalmente diferente sobre outro assunto qualquer aqui hoje sim', [{ texto: fonte }]).length, 0);
  assert.ok(maiorSemelhanca('gelo flutua densidade agua moleculas', [{ slug: 'a', texto: 'gelo flutua densidade agua moleculas' }]).valor > 0.9);
  assert.equal(titulosParecidos('Por que o gelo flutua na água', [{ slug: 'x', titulo: 'Por que o gelo flutua na água?' }]), 'x');
});

test('P8 e P9: saúde e links', () => {
  assert.equal(checarSeguranca('texto', 'animais').length, 0);
  assert.match(checarSeguranca('texto', 'corpo-humano')[0], /P8/);
  assert.equal(checarSeguranca('texto\n\nEste conteúdo é informativo e não substitui a orientação de um profissional de saúde.', 'corpo-humano').length, 0);
  assert.match(checarSeguranca('Tome 500 mg de remédio. Este conteúdo é informativo e não substitui a orientação de um profissional de saúde.', 'corpo-humano')[0], /dose|tratamento/);
  assert.equal(checarLinksInternos('veja [a](/x/) e [b](/categoria/animais/)', ['/x/', '/categoria/animais/']).length, 0);
  assert.match(checarLinksInternos('veja [a](/nao-existe/)', ['/x/'])[0], /nao-existe/);
});

test('P2: metadados', () => {
  const { meta, corpo } = lerResposta(respostaRedator());
  assert.deepEqual(checarMeta(meta, corpo), []);
  assert.ok(checarMeta({ ...meta, description: 'curta' }, corpo).length > 0);
  assert.ok(checarMeta({ ...meta, imagens: { ...meta.imagens, fotos: [{ ...meta.imagens.fotos[0], secao: 99 }] } }, corpo).length > 0);
});

test('formato de resposta e JSON', () => {
  assert.throws(() => lerResposta('sem marcadores'));
  assert.deepEqual(extrairJSON('```json\n{"a":1}\n```'), { a: 1 });
});

test('falhas recentes (freio)', () => {
  const l = (t) => ({ 'PR / Log da automação': t });
  assert.equal(falhasRecentes([l('FALHA 2026-10-03 (tentativa 1): x'), l('FALHA 2026-09-01: velho'), l('PR: https://x')], '2026-10-05'), 1);
});

test('fluxo completo com Claude e fotos falsos: aprova e devolve artigo', async () => {
  const acervo = lerAcervo();
  const d = depsFalsas();
  const r = await processarPauta(LINHA, acervo, d);
  assert.equal(r.ok, true, r.motivo);
  assert.deepEqual(d.chamadas, ['redator', 'validador']);
  assert.equal(r.frontmatter.slug, 'por-que-o-gelo-flutua');
  assert.equal(r.frontmatter.datePublished, '2026-10-08T12:00:00-03:00');
  assert.ok(r.nota >= 85);
  assert.equal(r.frontmatter.images.length, 2);
});

test('validador devolve: tenta de novo e, persistindo, reprova sem publicar', async () => {
  const d = depsFalsas({ aprovar: false });
  const r = await processarPauta(LINHA, lerAcervo(), d);
  assert.equal(r.ok, false);
  assert.match(r.motivo, /P5/);
  assert.equal(d.chamadas.filter((c) => c === 'redator').length, CFG.voltasMax + 1); // 1 + voltas
});

test('P3: fonte precisa tratar do assunto e o trecho enviado ao validador vem da região relevante', async () => {
  const { termosDoAssunto, relevancia, trechoRelevante, verificarFontes } = await import('../fontes.mjs');
  const termos = termosDoAssunto('Por que a lua tem fases?', 'por que a lua tem fases', 'lua', 'fases', 'moon', 'phases');
  assert.deepEqual(termos, ['lua', 'fases', 'moon', 'phases']);
  assert.ok(relevancia('The Moon goes through phases as the moon orbits. Moon phases repeat.', termos).distintos >= 2);
  assert.equal(relevancia('Crew-13 Starliner DAVINCI menu', termos).distintos, 0);
  const lixo = 'menu '.repeat(900);
  const conteudo = `${lixo} As fases da Lua acontecem porque a Lua reflete a luz do Sol. ${'A lua muda de fase. '.repeat(10)}`;
  assert.match(trechoRelevante(conteudo, termos), /fases da Lua/);
  const fake = (texto) => async () => ({ ok: true, status: 200, headers: { get: () => 'text/html' }, text: async () => `<p>${texto}</p>` });
  const geral = await verificarFontes([{ title: 'x', url: 'https://www.nasa.gov/' }], fake('Crew-13 Starliner '.repeat(40)), termos);
  assert.equal(geral.validas.length, 0);
  assert.match(geral.invalidas[0].motivo, /não trata do assunto/);
  const boa = await verificarFontes([{ title: 'x', url: 'https://science.nasa.gov/moon/moon-phases/' }], fake(conteudo), termos);
  assert.equal(boa.validas.length, 1);
});

test('anti-loop: reprovação de conteúdo tira o tema da fila; falha de API não queima o tema', async () => {
  const { statusAposFalha } = await import('../gerar-do-dia.mjs');
  assert.equal(statusAposFalha({ tentativas: 1, motivo: 'P2: nota 80 (mínimo 85)' }), 'revisar');
  assert.equal(statusAposFalha({ tentativas: 1, motivo: 'formato: API do Claude: 529 overloaded' }), null);
  assert.equal(statusAposFalha({ tentativas: 3, motivo: 'formato: API do Claude: 529 overloaded' }), 'revisar');
});

test('no ar: só confirma se a página abre, tem título, texto, imagens que carregam e está no sitemap', async () => {
  const { conferirPagina } = await import('../confirmar-no-ar.mjs');
  const texto = 'palavra '.repeat(1000);
  const html = (img) => `<html><head><meta property="og:image" content="/images/x/capa.jpg"></head><body><h1>Por que a lua tem fases?</h1><img src="${img}"><p>${texto}</p></body></html>`;
  const resp = (status, tipo, corpo = '') => ({ ok: status < 400, status, headers: { get: () => tipo }, text: async () => corpo });
  const site = (pagina, imagens = 200) => async (url) => {
    if (url.endsWith('/por-que-a-lua-tem-fases/')) return pagina;
    if (url.includes('/images/')) return resp(imagens, 'image/jpeg');
    return resp(404, 'text/html');
  };
  const url = 'https://www.mentecuriosa.blog/por-que-a-lua-tem-fases/';
  const sitemap = '<loc>https://www.mentecuriosa.blog/por-que-a-lua-tem-fases/</loc>';

  const ok = await conferirPagina({ url, titulo: 'Por que a lua tem fases?', buscarFn: site(resp(200, 'text/html', html('/images/x/foto1.jpg'))), sitemapTexto: sitemap });
  assert.equal(ok.ok, true, ok.problemas.join('|'));
  assert.ok(ok.imagens >= 2);

  const quebrada = await conferirPagina({ url, titulo: 'Por que a lua tem fases?', buscarFn: site(resp(200, 'text/html', html('/images/x/foto1.jpg')), 404), sitemapTexto: sitemap });
  assert.equal(quebrada.ok, false);
  assert.match(quebrada.problemas.join(' '), /imagem quebrada/);

  const naoExiste = await conferirPagina({ url: 'https://www.mentecuriosa.blog/nao-existe/', titulo: 'x', buscarFn: site(resp(200, 'text/html', '')) });
  assert.equal(naoExiste.ok, false);
  assert.match(naoExiste.problemas[0], /HTTP 404/);

  const foraSitemap = await conferirPagina({ url, titulo: 'Por que a lua tem fases?', buscarFn: site(resp(200, 'text/html', html('/images/x/foto1.jpg'))), sitemapTexto: '<loc>outra</loc>' });
  assert.match(foraSitemap.problemas.join(' '), /sitemap/);
});

test('P7: usa a legenda corrigida pela IA e tenta um novo plano de fotos quando nada combina', async () => {
  const sharp = (await import('sharp')).default;
  const { prepararImagens, fotoConfereComAlt } = await import('../imagens.mjs');
  const png = await sharp({ create: { width: 800, height: 600, channels: 3, background: '#88aa88' } }).png().toBuffer();
  const meta = { imagens: { capa: { busca: 'lion zebra', alt: 'Leoa observando uma zebra na savana africana' }, fotos: [], extras: [] } };
  const cand = { id: 'pexels:1', fonte: 'Pexels', urlImagem: 'x', autor: 'A', urlCredito: 'u1', license: 'L', licenseUrl: 'lu' };
  const deps = {
    pexels: async () => [cand], nasa: async () => [], baixar: async () => png,
    confere: async () => ({ ok: true, motivo: '', altCorrigido: 'Leoa segurando uma zebra jovem no chão da savana seca' }),
  };
  const r = await prepararImagens({ meta, categoria: 'animais', slug: 'x', titulo: 'Cadeia alimentar', fontesFoto: ['pexels'], usados: new Set(), deps });
  assert.match(r.capa.alt, /Leoa segurando/);

  // a IA de visão entende o JSON novo e ignora alt_corrigido curto demais
  const visao = async () => '{"ok": true, "motivo": "", "alt_corrigido": "curto"}';
  assert.equal((await fotoConfereComAlt(png, 'x', visao)).altCorrigido, '');
  const visao2 = async () => '{"ok": false, "motivo": "violência explícita"}';
  assert.equal((await fotoConfereComAlt(png, 'x', visao2)).ok, false);
});

test('no ar: vale a data real do artigo no blog, não a da planilha', async () => {
  const { dataEfetiva } = await import('../confirmar-no-ar.mjs');
  const info = new Map([['a', { titulo: 'A', data: '2026-09-30' }]]);
  assert.equal(dataEfetiva('a', '2026-10-02', info), '2026-09-30');
  assert.equal(dataEfetiva('b', '2026-10-02', info), '2026-10-02');
});

test('horário de publicação: 1º do dia 12:00, 2º 18:00', async () => {
  const { dataHoraPublicacao } = await import('../artigo.mjs');
  assert.equal(dataHoraPublicacao({ dataISO: '2026-10-01', 'Ordem do Dia': '1' }), '2026-10-01T12:00:00-03:00');
  assert.equal(dataHoraPublicacao({ dataISO: '2026-10-01', 'Ordem do Dia': '2' }), '2026-10-01T18:00:00-03:00');
  const { jaPassouDoHorario } = await import('../confirmar-no-ar.mjs');
  const info = new Map([['a', { quando: '2026-10-01T18:00:00-03:00' }], ['b', {}]]);
  assert.equal(jaPassouDoHorario('a', info, Date.parse('2026-10-01T17:00:00-03:00')), false);
  assert.equal(jaPassouDoHorario('a', info, Date.parse('2026-10-01T18:05:00-03:00')), true);
  assert.equal(jaPassouDoHorario('b', info), true);
});

test('sem crédito na API não descarta o tema', () => {
  const m = 'API do Claude: 400 {"error":{"message":"Your credit balance is too low to access the Anthropic API."}}';
  assert.equal(statusAposFalha({ tentativas: 5, motivo: m }), null);
  assert.equal(statusAposFalha({ tentativas: 1, motivo: 'P2: 1753 palavras' }), 'revisar');
});

test('fotos sem Claude: pontua pela descrição do Pexels', async () => {
  const { pontuar } = await import('../imagens.mjs');
  assert.equal(pontuar('full moon night sky', 'A full moon in the night sky'), 4);
  assert.equal(pontuar('full moon', ''), 0);
});

test('custo: Haiku não envia thinking', async () => {
  const { custoEstimado, USO } = await import('../claude.mjs');
  USO.entrada = 1_000_000; USO.saida = 1_000_000;
  assert.equal(custoEstimado('claude-haiku-4-5'), 6);
  USO.entrada = 0; USO.saida = 0;
  assert.equal(CFG.modeloClaude, 'claude-haiku-4-5');
});

test('pesquisa prévia: fica com as 2 fontes mais relevantes e limita o texto a 5.000 caracteres', async () => {
  const { pesquisarFontes } = await import('../fontes.mjs');
  const { blocoFontesLidas, pedidoArtigo } = await import('../prompts.mjs');
  const longo = (t) => `<html><body><p>${(t + ' ').repeat(400)}</p></body></html>`;
  const paginas = {
    'https://ex.org/a': longo('ice floats because ice is less dense than water and lake ice protects life'),
    'https://ex.org/b': longo('density of ice and water hydrogen bonds ice floats lake'),
    'https://ex.org/c': longo('receitas de bolo e dicas de culinária sem relação nenhuma com o tema escolhido hoje'),
    'https://ex.org/d': longo('ice floats water density ice lake'),
  };
  const claude = async () => ({ texto: JSON.stringify({ termos: ['gelo', 'ice', 'density', 'water'], fontes: Object.keys(paginas).map((url) => ({ title: url, url })) }) });
  const buscarFn = async (url) => ({ ok: true, status: 200, headers: { get: () => 'text/html' }, text: async () => paginas[url] });
  const r = await pesquisarFontes({ linha: { Pauta: 'Por que o gelo flutua?', 'Palavra-chave': 'por que o gelo flutua' }, claude, buscarFn });
  assert.equal(r.lidas.length, 2);
  assert.ok(r.lidas.every((f) => f.texto.length <= 5000 && !/bolo/.test(f.texto)));
  assert.match(blocoFontesLidas(r.lidas), /FONTES JÁ LIDAS/);
  assert.match(pedidoArtigo({ linha: LINHA, linksPermitidos: [], fontesLidas: r.lidas }), /FONTE 1/);
});

test('pesquisa prévia: resposta ilegível segue sem fontes lidas', async () => {
  const { pesquisarFontes } = await import('../fontes.mjs');
  const r = await pesquisarFontes({ linha: LINHA, claude: async () => ({ texto: 'sem json' }), buscarFn: async () => { throw new Error('não deveria abrir'); } });
  assert.deepEqual(r.lidas, []);
});

test('palavras de contexto: as mais fortes das fontes, sem as da planilha nem as comuns', async () => {
  const { termosDeContexto } = await import('../fontes.mjs');
  const a = 'Ice density hydrogen bonds lattice. The density of ice is lower; hydrogen bonds form a lattice. Density matters for lakes and the lattice. '.repeat(3);
  const b = 'A densidade do gelo e a rede de ligações: hydrogen bonds and lattice also appear here; the lattice and bonds. '.repeat(3);
  const t = termosDeContexto([a, b], ['ice', 'gelo'], 5);
  assert.ok(t.includes('lattice') && t.includes('density') && t.includes('hydrogen'));
  assert.ok(!t.includes('ice') && !t.includes('the'));
});

test('fotos antes de escrever: uma por busca, sem repetir; erro se faltar foto', async () => {
  const { escolherFotosPrevias } = await import('../imagens.mjs');
  const { blocoFotosPrevias, blocoTermosContexto } = await import('../prompts.mjs');
  const cand = (id) => ({ id: `pexels:${id}`, urlCredito: `https://pexels.com/p/${id}`, descricao: `photo ${id}` });
  const pexels = async () => [cand(1), cand(2), cand(3), cand(4)];
  const r = await escolherFotosPrevias({ buscas: ['a', 'b', 'c'], categoria: 'animais', deps: { pexels } });
  assert.deepEqual(r.map((x) => x.c.id), ['pexels:1', 'pexels:2', 'pexels:3']);
  assert.match(blocoFotosPrevias(r), /CAPA.*photo 1/);
  assert.match(blocoTermosContexto(['lattice']), /lattice/);
  await assert.rejects(escolherFotosPrevias({ buscas: ['a'], categoria: 'animais', deps: { pexels: async () => [] } }), /sem foto no banco/);
});

test('sem foto para o tema: não escreve nada e não gasta Claude de redação', async () => {
  const d = depsFalsas();
  d.pesquisar = async () => ({ lidas: [], termos: [], fotos: ['x'] });
  d.fotosPrevias = async () => { throw new Error('sem foto no banco de imagens para "x"'); };
  const r = await processarPauta(LINHA, lerAcervo(), d);
  assert.equal(r.ok, false);
  assert.match(r.motivo, /P7: sem foto/);
  assert.equal(d.chamadas.length, 0);
});

test('prepararImagens usa as fotos escolhidas antes', async () => {
  const { prepararImagens } = await import('../imagens.mjs');
  const sharp = (await import('sharp')).default;
  const png = await sharp({ create: { width: 1600, height: 1000, channels: 3, background: '#335577' } }).png().toBuffer();
  const previa = (id) => ({ consulta: 'q', c: { id: `pexels:${id}`, urlCredito: `https://pexels.com/p/${id}`, autor: 'A', fonte: 'Pexels', license: 'L', licenseUrl: 'u', descricao: 'd' } });
  const baixados = [];
  const meta = { imagens: { capa: { busca: 'q', alt: 'Capa de teste com mais de vinte caracteres' }, fotos: [{ busca: 'q', alt: 'Foto de teste com mais de vinte caracteres', legenda: 'Legenda de teste longa', secao: 2 }] } };
  const r = await prepararImagens({ meta, categoria: 'animais', slug: 's', titulo: 'Título', fontesFoto: ['pexels'], usados: [], previas: [previa(1), previa(2)], deps: { baixar: async (c) => { baixados.push(c.id); return png; }, pexels: async () => { throw new Error('não deveria buscar'); } } });
  assert.deepEqual(baixados, ['pexels:1', 'pexels:2']);
  assert.equal(r.fotos.length, 1);
});
