// Dados e dependências falsas para testar a automação sem chamar Claude, Pexels ou Google.
import sharp from 'sharp';

export const LINHA = {
  _linha: 5,
  'Cal ID': 'CAL0005', 'Ordem do Dia': '1', 'ID Artigo': 'ART9999', 'KW ID principal': 'KW9999',
  'Palavra-chave': 'por que o gelo flutua', Pauta: 'Por que o gelo flutua?', Cluster: 'Ciência e fenômenos',
  'Categoria (slug)': 'ciencia-e-fenomenos', 'Caudas longas (seções H2)': 'por que o gelo flutua explicado de forma simples; por que o gelo flutua mitos e verdades',
  Slug: 'por-que-o-gelo-flutua', Status: 'planejado', dataISO: '2026-10-08', 'Termo-cabeça (Planner)': '',
};

const FRASES = [
  'A água líquida é formada por moléculas que se movem e se ajeitam de forma bem apertada.',
  'Quando a temperatura cai, essas moléculas vão perdendo velocidade e começam a se prender umas nas outras.',
  'No gelo, elas formam uma estrutura em anéis, cheia de espaços vazios entre as partes.',
  'Esses espaços fazem o mesmo volume de água ocupar mais lugar depois de congelar.',
  'Com mais volume e a mesma quantidade de matéria, a densidade do gelo fica menor.',
  'Um litro de gelo pesa menos que um litro de água, e por isso ele sobe e fica na superfície.',
  'O gelo tem cerca de 917 kg por metro cúbico, enquanto a água líquida tem cerca de 1.000 kg por metro cúbico.',
  'Essa diferença de mais de 80 kg por metro cúbico basta para manter cerca de 90 por cento do bloco debaixo d\'água.',
  'Quase todas as outras substâncias ficam mais densas ao esfriar, e o sólido afunda no próprio líquido.',
  'A água é uma exceção, e essa exceção mudou a história da vida nos lagos e nos mares frios.',
  'Em um lago no inverno, a camada de gelo vira uma tampa que protege a água de baixo do frio extremo.',
  'Peixes e plantas continuam vivos debaixo dessa tampa, em uma água que fica perto de 4 graus.',
  'Se o gelo afundasse, os lagos congelariam de baixo para cima e muitos seres morreriam todo inverno.',
  'Você pode ver o efeito em casa: basta colocar um cubo de gelo em um copo com água e observar.',
  'A maior parte do cubo fica escondida, e só uma pequena ponta aparece acima da linha da água.',
  'Quando o gelo derrete, o nível da água no copo quase não muda, porque o volume submerso já era o mesmo.',
  'Nos polos, os icebergs seguem a mesma regra, e a parte que aparece é só uma fração do total.',
  'Por isso navegar perto deles exige cuidado, já que o maior pedaço fica longe dos olhos.',
  'Cientistas estudam essa estrutura há mais de 100 anos e ainda descobrem detalhes novos.',
  'Hoje sabemos que as ligações entre as moléculas de água têm um papel central em todo esse processo.',
];

function paragrafos(n) {
  const out = [];
  let k = 0;
  for (let i = 0; i < n; i++) {
    const p = [];
    for (let j = 0; j < 3; j++) p.push(FRASES[(k++) % FRASES.length]);
    out.push(p.join(' '));
  }
  return out.join('\n\n');
}

export function respostaRedator({ keyword = 'por que o gelo flutua' } = {}) {
  const meta = {
    title: 'Por que o gelo flutua na água?',
    description: `Entenda por que o gelo flutua: ao congelar, a água ganha volume e fica menos densa. Veja a estrutura das moléculas e o que isso muda na vida dos lagos.`,
    tags: ['gelo', 'água', 'densidade', 'física'],
    sources: [
      { title: 'NASA — Water and ice', url: 'https://www.nasa.gov/water-ice' },
      { title: 'USGS — Water density', url: 'https://www.usgs.gov/water-density' },
      { title: 'Smithsonian — Why ice floats', url: 'https://www.smithsonianmag.com/why-ice-floats' },
    ],
    imagens: {
      capa: { busca: 'ice cubes floating in water glass', alt: 'Cubos de gelo boiando em um copo de água transparente' },
      fotos: [
        { busca: 'iceberg floating ocean', alt: 'Iceberg boiando no oceano com a maior parte submersa', legenda: 'A maior parte de um iceberg fica debaixo da água', secao: 2 },
        { busca: 'frozen lake winter', alt: 'Lago congelado no inverno com uma camada de gelo na superfície', legenda: 'A camada de gelo protege a água que fica embaixo', secao: 4 },
      ],
    },
    pins: [],
  };
  const corpo = [
    `Você já se perguntou ${keyword}? **O gelo flutua porque, ao congelar, a água ocupa mais espaço e fica menos densa que a água líquida.** Essa pequena diferença muda tudo.`,
    '## Explicado de forma simples', paragrafos(4),
    '## Como isso acontece com as moléculas', paragrafos(4),
    '## O que a ciência sabe', paragrafos(4),
    '## Exemplos do dia a dia', paragrafos(4),
    '## Mitos e verdades', paragrafos(3),
    '## Resumindo', `Em resumo, o gelo boia porque é mais leve que a água. Veja também a página da [categoria de ciência e fenômenos](/categoria/ciencia-e-fenomenos/) e o artigo sobre [por que o céu é azul](/por-que-o-ceu-e-azul/).`,
  ].join('\n\n');
  return `===META===\n${JSON.stringify(meta, null, 1)}\n===CORPO===\n${corpo}`;
}

export const TEXTO_FONTE =
  'Ice is less dense than liquid water. The density of ice is about 917 kg per cubic meter, while liquid water is about 1.000 kg per cubic meter. Hydrogen bonds hold molecules in an open hexagonal lattice when water freezes. Lakes freeze from the top down, which protects aquatic life below the surface throughout the winter season in cold regions of the world. A difference of more than 80 kg per cubic meter keeps about 90 percent of an iceberg below the surface.';

export function depsFalsas({ aprovar = true } = {}) {
  const chamadas = [];
  return {
    chamadas,
    claude: async ({ system, user }) => {
      const validador = /validador editorial/i.test(system);
      chamadas.push(validador ? 'validador' : 'redator');
      if (validador) return { texto: JSON.stringify(aprovar ? { id: 'ART9999', decisao: 'APROVADO', motivos: [], correcoes: [] } : { id: 'ART9999', decisao: 'DEVOLVER', motivos: ['V1: dado sem fonte'], correcoes: ['remover o dado'] }) };
      return { texto: respostaRedator() };
    },
    pesquisar: async () => ({ lidas: [], termos: [], fotos: [] }),
    fotosPrevias: async () => [],
    fontes: async (fontes) => ({ validas: fontes.map((f) => ({ title: f.title, url: f.url, texto: TEXTO_FONTE, lido: true })), invalidas: [] }),
    imagens: async ({ meta, slug, titulo }) => {
      const png = await sharp({ create: { width: 1600, height: 1000, channels: 3, background: '#3b6ea5' } }).png().toBuffer();
      const { comporCapa, fotoCorpo } = await import('../imagens.mjs');
      const c = (n) => ({ author: 'Autor Teste', source: 'Pexels', url: `https://www.pexels.com/photo/teste-${n}/`, license: 'Licença Pexels', licenseUrl: 'https://www.pexels.com/license/' });
      return {
        capa: { arquivo: `${slug}.webp`, buffer: await comporCapa(png, titulo), alt: meta.imagens.capa.alt, credito: c(0) },
        fotos: await Promise.all(meta.imagens.fotos.map(async (f, i) => ({
          arquivo: `${f.alt.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').split('-').slice(0, 6).join('-')}.webp`,
          buffer: await fotoCorpo(png), alt: f.alt, legenda: f.legenda, secao: f.secao, credito: c(i + 1),
        }))),
      };
    },
  };
}
