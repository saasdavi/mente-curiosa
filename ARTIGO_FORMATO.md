# Formato de entrega de artigo Astro (Claude / n8n)

As regras editoriais comuns estão em [`DIRETRIZES_EDITORIAIS_GLOBAIS.md`](DIRETRIZES_EDITORIAIS_GLOBAIS.md). SEO, GEO e EAO não alteram o formato técnico: este projeto continua usando Markdown + frontmatter Astro.

Claude entrega **dados + texto**. O template cuida de SEO técnico, schema,
breadcrumbs, sitemap, anúncios e links relacionados. Não escrever HTML de SEO no texto.

## Arquivo e fluxo

- **Entrada da fila de publicação:** `dados/entrada/pautas-chat_01/GPT ARTIGOS PRONTOS/<slug>.md`. O exemplo de frontmatter abaixo é para este arquivo de entrada e inclui os campos de auditoria editorial.
- **Arquivo final do site:** `src/content/artigos/<slug>.md`. A automação valida a entrada, busca as fotos, preenche `featuredImage`/`images` e remove `imagensPlano` e os campos de auditoria editorial antes de gravar o artigo final.
- Não coloque `editorialScore`, `editorialVerdict`, `editorialSourcesVerified` ou `editorialFactsVerified` diretamente no artigo final: são metadados de controle da fila.
- **Todo artigo sobe com imagem.** Quem escreve não gera a imagem final; prepara o plano `imagensPlano`. Sem imagem válida, o artigo não é publicado.

```markdown
---
id: ART0001                      # ID do banco editorial (planilha)
title: "Por que sentimos medo?"  # vira o H1 (10–110 caracteres)
seoTitle: ""                     # opcional, ≤ 60; só se o title for longo
slug: por-que-sentimos-medo      # minúsculas, sem acento, hífens; NUNCA muda depois de publicado
description: "..."               # 70–160 caracteres; meta description e resumo
category: psicologia-e-comportamento
tags: [medo, cérebro, emoções]   # 1–8
keyword: por que sentimos medo   # palavra-chave principal da planilha
author: Davi Burato Custódio     # nome exato da página de autor (ver src/config/site.ts → authorPages)
datePublished: 2026-10-01        # data futura = agendado
dateModified: 2026-10-01         # atualizar sempre que o conteúdo mudar
# Campos obrigatórios no arquivo da fila; a automação os remove do artigo publicado.
editorialScore: 9.0
editorialVerdict: APROVADO
editorialSourcesVerified: true
editorialFactsVerified: true
imagensPlano:                    # OBRIGATÓRIO em artigo novo (a automação transforma em imagens)
  capa:                          # foto de fundo da capa (o título entra por cima)
    busca: "dark forest fog night"                        # em inglês, cena concreta e sem pessoas se possível
    alt: "Floresta escura coberta de neblina ao anoitecer"  # ≥ 25 caracteres, o que se espera ver
  fotos:                         # 1 a 3 fotos no corpo (2 se o artigo passar de 1.200 palavras)
    - busca: "human brain model"
      alt: "Modelo de cérebro humano sobre uma mesa"
      legenda: "A amígdala dispara o alarme do medo em frações de segundo"  # liga a foto ao texto
      secao: 2                   # a foto entra no fim do 2º H2
sources:                         # fontes confiáveis e verificadas
  - title: "Nome da fonte — título"
    url: https://...
faq:                             # opcional: 1 a 5 perguntas; respostas de 2 a 3 frases; gera FAQPage
  - question: "A Lua tem o próprio brilho?"
    answer: "Não. A Lua não produz luz; ela reflete a luz do Sol."
draft: false
---

Primeiro parágrafo: responde a pergunta direto, em 2–3 frases.

## Seções em H2 (nunca usar H1 no corpo)
```

Categorias válidas: `psicologia-e-comportamento`, `corpo-humano`, `universo-e-espaco`,
`animais`, `ciencia-e-fenomenos`, `tecnologia-ia-e-ciencia`.

## Regras de imagem

- Busca em inglês, concreta e fotografável ("roller coaster", não "adrenaline"); nada de marcas, logos ou pessoas famosas.
- Uma foto por seção relevante, nunca duas seguidas; a capa não repete foto do corpo (a automação garante).
- O alt é escrito antes de ver a foto → a automação marca `altConferido: false`. Depois de publicado, alguém
  olha cada foto (o resumo da execução no GitHub mostra o que a fonte diz de cada uma), corrige o alt se
  preciso e marca `altConferido: true`. Enquanto isso a auditoria desconta pontos (I06).

## Regras de conteúdo

- **Uma intenção = uma URL.** As variações de cauda longa da planilha
  ("explicado de forma simples", "mitos e verdades", "causas"...) viram **seções H2
  do artigo principal**, não artigos separados.
- Antes de criar: conferir no `migration-map.csv` se outra URL já atende a mesma intenção.
  Se já existe → ATUALIZAR/EXPANDIR aquela URL (e mudar `dateModified`).
- Links internos: sempre `/slug/` com barra final, só para artigos já publicados.
- Nada de fatos sem fonte; nada de números inventados.
- Temas de saúde: incluir aviso de que o conteúdo não substitui um profissional.
- Qualidade: seguir `DIRETRIZES_EDITORIAIS_GLOBAIS.md` e `PADRAO_SEO.md`. O arquivo da fila precisa declarar `editorialScore ≥ 8.5`, `editorialVerdict: APROVADO`, `editorialSourcesVerified: true` e `editorialFactsVerified: true`. A automação bloqueia se faltarem esses campos ou falhar a nota. Esses campos são removidos do frontmatter publicado. O build também exige auditoria mecânica ≥ 85/100 e sem bloqueantes. A declaração só deve ser preenchida depois da revisão real; o código não verifica a honestidade dessa declaração.

## Nunca

- Mudar o `slug` de um artigo publicado sem adicionar a linha em `redirects/migration.csv`.
- Reutilizar um `id`.
- Apagar um artigo publicado sem decidir: 301 para o equivalente ou 410.
