// Configuração da automação de artigos. Segredos vêm de variáveis de ambiente (GitHub Secrets), nunca daqui.

export const CFG = {
  fusoHorario: 'America/Sao_Paulo',
  abaCalendario: 'pautas-modelo_calendario',
  intervaloCalendario: 'A1:V1200',
  horizonteDias: 2, // gera artigos com até N dias de antecedência, para dar tempo de revisar o PR
  maxPorExecucao: 4,
  modeloClaude: process.env.CLAUDE_MODEL || 'claude-sonnet-5-5',
  maxTokensRedator: 7000,
  voltasMax: 2, // reescritas por auditoria ou validador
  autorPadrao: 'Equipe Mente Curiosa',
  siteUrl: 'https://www.mentecuriosa.blog',
  // Categorias que exigem o aviso de saúde no fim do texto (REGRAS_OURO 12)
  categoriasSaude: ['corpo-humano', 'psicologia-e-comportamento'],
  avisoSaude: 'Este conteúdo é informativo e não substitui a orientação de um profissional de saúde.',
  similaridadeMax: 0.55, // cosseno TF-IDF contra artigos existentes; acima disso o artigo é barrado
  fontesMin: 2,
};

export const CATEGORIAS = [
  'psicologia-e-comportamento',
  'corpo-humano',
  'universo-e-espaco',
  'animais',
  'ciencia-e-fenomenos',
  'tecnologia-ia-e-ciencia',
];

// Ordem de busca de fotos por categoria (IMAGENS.md). IA e Pixabay ficam para depois.
export const FONTES_FOTO = {
  'universo-e-espaco': ['nasa', 'pexels'],
  animais: ['pexels'],
  'ciencia-e-fenomenos': ['pexels'],
  'corpo-humano': ['pexels'],
  'psicologia-e-comportamento': ['pexels'],
  'tecnologia-ia-e-ciencia': ['pexels'],
};

// Domínios aceitos como fonte primária sem precisar abrir a página (alguns bloqueiam robôs).
export const DOMINIOS_CONFIAVEIS = [
  'nasa.gov', 'esa.int', 'noaa.gov', 'usgs.gov', 'nih.gov', 'cdc.gov', 'who.int', 'fda.gov',
  'nature.com', 'science.org', 'sciencedirect.com', 'pnas.org', 'cell.com', 'thelancet.com', 'bmj.com',
  'scielo.br', 'fiocruz.br', 'butantan.gov.br', 'inpe.br', 'usp.br', 'unesp.br', 'unicamp.br',
  'royalsociety.org', 'smithsonianmag.com', 'nationalgeographic.com', 'britannica.com',
  'apa.org', 'harvard.edu', 'mit.edu', 'stanford.edu', 'ox.ac.uk', 'cam.ac.uk',
];
export const DOMINIOS_BLOQUEADOS = /wikipedia\.org|blogspot|medium\.com|quora\.com|reddit\.com|brainly|pinterest\.|facebook\.com|tiktok\.com|youtube\.com/i;
