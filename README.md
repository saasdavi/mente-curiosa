# Mente Curiosa — site

Astro (site estático) + Vercel. Conteúdo em Markdown, separado do código.
Feito para trocar de plataforma (ex.: WordPress) sem perder URLs, conteúdo, imagens nem redirects.

## Estrutura

```
src/content/artigos/<slug>.md   ← artigos (1 arquivo por artigo)
public/images/<slug>/capa.webp  ← imagens de cada artigo (1200×675, .webp)
redirects/migration.csv         ← mudanças de URL futuras / migração
src/config/site.ts              ← nome, domínio, e-mail
src/config/categories.ts        ← as 6 categorias (clusters do plano editorial)
src/config/ads.ts               ← AdSense (liga/desliga, IDs de bloco)
src/components/ads/             ← único lugar com código de anúncio
public/ads.txt                  ← publisher do AdSense
src/content.config.ts           ← schema: o contrato de cada artigo
scripts/                        ← redirects (pré-build) e verificação (pós-build)
ARTIGO_FORMATO.md               ← como Claude deve entregar um artigo
rascunhos/                      ← ideias de artigos ainda fora do site (formato antigo)
```

## URLs

| Página | URL |
|---|---|
| Artigo | `/por-que-sentimos-medo/` |
| Categoria | `/categoria/psicologia-e-comportamento/` |
| Institucionais | `/sobre/`, `/contato/`, `/politica-de-privacidade/` |
| Sitemap, RSS, robots | `/sitemap.xml`, `/feed.xml`, `/robots.txt` |
| Mapa de migração | `/migration-map.csv` (noindex) |

Sempre com barra final — igual ao permalink `/%postname%/` do WordPress.

## Publicar um artigo

1. Criar `src/content/artigos/<slug>.md` seguindo `ARTIGO_FORMATO.md`.
2. Colocar a capa em `public/images/<slug>/capa.webp`.
3. Commit/PR no GitHub → a Vercel faz o build e publica.

**Agendamento:** artigo com `datePublished` no futuro fica fora do site até a data.
Para ele aparecer sozinho, dispare um build diário (Deploy Hook da Vercel
chamado por GitHub Actions ou por um cron às 06:00).

## O que trava o deploy (de propósito)

- campo obrigatório faltando, slug fora do padrão, categoria inexistente, descrição curta/longa
- imagem de capa que não existe ou fora da pasta do artigo
- `id` ou `slug` repetido
- link interno quebrado ou sem barra final
- link interno apontando para URL que foi redirecionada
- redirect com destino inexistente, duplicado ou em cadeia

## Redirects

Edite só os CSVs em `redirects/`. O pré-build gera:

- `vercel.json` → 301 + cabeçalhos. Rode `npm run build` antes do commit para mantê-lo atualizado
- `functions/_middleware.js` + `public/_routes.json` → 410, só se houver linhas com `410`

Cada URL antiga vai para o artigo **equivalente**. Sem equivalente: `410`.
Nunca redirecionar tudo para a home.

## Comandos

```
npm install
npm run dev       # http://localhost:4321
npm run build     # redirects → build → verificação
npm run preview
```

## Vercel (deploy)

1. Repositório no GitHub conectado ao projeto na Vercel (Import Project).
2. Framework Astro · Build `npm run build` · Output `dist` · Node 22 (`.nvmrc`).
3. Settings → Domains: `www.mentecuriosa.blog` (principal) e `mentecuriosa.blog` (redireciona 308 para o www).
4. Deploy Hook (Settings → Git → Deploy Hooks) para publicar artigos agendados.

## Depois do ar

- Search Console: verificar o domínio por DNS e enviar `/sitemap.xml`.
- AdSense: adicionar o site; `ads.txt` e o script já estão publicados.
  Ativar a mensagem de consentimento (Privacidade e mensagens) no painel do AdSense.
- Criar blocos de anúncio e colar os IDs em `src/config/ads.ts` (opcional; Anúncios automáticos já funcionam).

## Migração futura para WordPress

1. Baixar `/migration-map.csv` (todas as URLs, imagens, datas e hash de cada artigo).
2. Importar os Markdown (frontmatter → campos do post; `slug` → permalink).
3. Permalink `/%postname%/`, base de categoria `categoria`.
4. Manter as imagens em `/images/<slug>/` (ou importar e redirecionar pelo mapa).
5. Importar `redirects/*.csv` no plugin Redirection.
6. Conferir as URLs do mapa respondendo 200 → trocar o DNS.
