// Os 6 clusters do plano editorial viram as categorias do site.
// URL: /categoria/<slug>/  (no WordPress: base de categoria = "categoria")

export const CATEGORIES = [
  {
    slug: 'psicologia-e-comportamento',
    clusterId: 'CL001',
    name: 'Psicologia e comportamento',
    description: 'Por que sentimos, pensamos e agimos do jeito que agimos.',
  },
  {
    slug: 'corpo-humano',
    clusterId: 'CL002',
    name: 'Corpo humano',
    description: 'Como o nosso corpo funciona, do bocejo ao batimento do coração.',
  },
  {
    slug: 'universo-e-espaco',
    clusterId: 'CL003',
    name: 'Universo e espaço',
    description: 'Estrelas, planetas, galáxias e os mistérios do cosmos.',
  },
  {
    slug: 'animais',
    clusterId: 'CL004',
    name: 'Animais',
    description: 'Comportamentos, sentidos e curiosidades do reino animal.',
  },
  {
    slug: 'ciencia-e-fenomenos',
    clusterId: 'CL005',
    name: 'Ciência e fenômenos',
    description: 'Os fenômenos do dia a dia explicados pela ciência.',
  },
  {
    slug: 'tecnologia-ia-e-ciencia',
    clusterId: 'CL006',
    name: 'Tecnologia, IA e ciência',
    description: 'Como funcionam as tecnologias que usamos — e as que estão chegando.',
  },
] as const;

export type CategorySlug = (typeof CATEGORIES)[number]['slug'];

export const CATEGORY_SLUGS = CATEGORIES.map((c) => c.slug) as [CategorySlug, ...CategorySlug[]];

export function getCategory(slug: string) {
  const cat = CATEGORIES.find((c) => c.slug === slug);
  if (!cat) throw new Error(`Categoria desconhecida: ${slug}`);
  return cat;
}

export const categoryUrl = (slug: string) => `/categoria/${slug}/`;
