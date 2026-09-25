import { existsSync } from 'node:fs';
import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';
import { CATEGORY_SLUGS } from './config/categories';
import { RESERVED_SLUGS } from './config/site';

// Contrato de cada artigo. Se algo obrigatório faltar ou estiver fora do padrão,
// o build falha e nada é publicado.

const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const imagePath = z
  .string()
  .regex(/^\/images\/[a-z0-9-]+\/[a-z0-9-]+\.webp$/, 'imagem: /images/<slug>/<nome-descritivo>.webp')
  .refine((p) => existsSync(`public${p}`), 'arquivo da imagem não encontrado em public/');

const credit = z.object({
  author: z.string(),
  source: z.enum(['Pexels', 'Pixabay', 'Unsplash', 'NASA', 'Openverse', 'IA', 'Próprio']),
  url: z.url().optional(),
  license: z.string(),
  licenseUrl: z.url().optional(),
});

const artigos = defineCollection({
  loader: glob({
    pattern: '**/*.md',
    base: './src/content/artigos',
    // A URL vem do campo slug, nunca do nome do arquivo.
    generateId: ({ data, entry }) => String(data.slug ?? entry),
  }),
  schema: z
    .object({
      id: z.string().regex(/^ART\d{4}$/, 'id deve seguir o banco editorial: ART0001'),
      title: z.string().min(10).max(110),
      // Título para o <title> quando o H1 for longo demais (opcional).
      seoTitle: z.string().max(60).optional(),
      slug: z
        .string()
        .regex(slugPattern, 'slug: só minúsculas, números e hífens, sem acentos')
        .max(80)
        .refine((s) => !(RESERVED_SLUGS as readonly string[]).includes(s), 'slug reservado pelo site'),
      description: z.string().min(70).max(160),
      category: z.enum(CATEGORY_SLUGS),
      tags: z.array(z.string().min(2)).min(1).max(8),
      keyword: z.string().min(3),
      author: z.string().default('Equipe Mente Curiosa'),
      datePublished: z.coerce.date(),
      dateModified: z.coerce.date(),
      featuredImage: imagePath,
      featuredImageAlt: z.string().min(10),
      // Origem da foto de fundo da capa (licença rastreável). Vazio = arte só com a marca.
      imageCredit: credit.optional(),
      // Fotos no corpo do artigo — inseridas ao fim da seção H2 indicada (ver IMAGENS.md).
      images: z
        .array(
          z.object({
            src: imagePath,
            alt: z.string().min(25, 'alt: descreva o que aparece na foto (≥ 25 caracteres)'),
            caption: z.string().min(10),
            section: z.number().int().min(1),
            width: z.number().int().positive(),
            height: z.number().int().positive(),
            credit,
          }),
        )
        .max(4)
        .optional(),
      sources: z
        .array(z.object({ title: z.string().min(3), url: z.url() }))
        .min(1, 'informe ao menos uma fonte')
        .optional(),
      draft: z.boolean().default(false),
    })
    .refine((d) => d.dateModified >= d.datePublished, {
      message: 'dateModified não pode ser anterior a datePublished',
      path: ['dateModified'],
    })
    .refine((d) => [d.featuredImage, ...(d.images ?? []).map((i) => i.src)].every((p) => p.startsWith(`/images/${d.slug}/`)), {
      message: 'as imagens devem ficar na pasta do próprio artigo: /images/<slug>/',
      path: ['featuredImage'],
    })
    .refine((d) => new Set([d.featuredImage, ...(d.images ?? []).map((i) => i.src)]).size === 1 + (d.images?.length ?? 0), {
      message: 'imagem repetida no artigo',
      path: ['images'],
    }),
});

export const collections = { artigos };
