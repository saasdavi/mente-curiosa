// Configuração central do site. Nada aqui depende de hospedagem.

export const SITE = {
  name: 'Mente Curiosa',
  // Host canônico (a versão sem www redireciona para cá na Vercel).
  url: 'https://www.mentecuriosa.blog',
  lang: 'pt-BR',
  locale: 'pt_BR',
  tagline: 'Respostas simples para perguntas curiosas',
  description:
    'Curiosidades explicadas de forma simples e com base na ciência: corpo humano, mente, universo, animais, fenômenos e tecnologia.',
  defaultAuthor: 'Equipe Mente Curiosa',
  defaultImage: '/images/og-default.webp',
  contactEmail: 'daviestreladamanha2@gmail.com',
  // Perfis oficiais: aparecem no rodapé e no schema (sameAs). Vazio = não exibe.
  social: {
    facebook: 'https://www.facebook.com/profile.php?id=61594868995892',
    instagram: '',
    pinterest: 'https://br.pinterest.com/daviestreladamanha2/',
  },
  // Tamanho padrão de todas as imagens de capa (1200×675, 16:9, .webp).
  image: { width: 1200, height: 675 },
  // Verificação do Search Console por meta tag (opcional; preferir verificação por DNS).
  googleSiteVerification: 'vuldBToYK-rDshgD-qCqn3iOSdYF6kH3v-IzgbrnLcw',
  // Código de verificação do domínio no Pinterest (Configurações → Declarar site → meta tag).
  pinterestDomainVerify: '',
} as const;

// Slugs que não podem ser usados por artigos (colidem com páginas do site).
export const RESERVED_SLUGS = [
  'categoria',
  'sobre',
  'contato',
  'politica-de-privacidade',
  'termos-de-uso',
  'social',
  'images',
  'feed',
  'sitemap',
  'page',
  'tag',
  'wp-admin',
  'wp-content',
] as const;
