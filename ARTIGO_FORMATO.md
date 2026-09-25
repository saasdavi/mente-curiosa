# Formato de entrega de artigo (Claude / n8n)

Claude entrega **dados + texto**. O template cuida de SEO técnico, schema,
breadcrumbs, sitemap, anúncios e links relacionados. Não escrever HTML de SEO no texto.

## Arquivo

Só `src/content/artigos/<slug>.md`. **Regra: todo artigo sobe com imagem** — quem escreve não gera imagem,
escreve o **plano de imagens** (`imagensPlano`). No push, a automação *Imagens automáticas* (GitHub Actions)
busca as fotos grátis, cria capa + 5 Pins + fotos do corpo, preenche `featuredImage`/`images`, apaga o plano
e publica. Sem imagem o artigo não aparece no site.

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
author: Equipe Mente Curiosa
datePublished: 2026-10-01        # data futura = agendado
dateModified: 2026-10-01         # atualizar sempre que o conteúdo mudar
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
- Qualidade: seguir o PADRAO_SEO.md. Rodar `npm run audit` — publicar só com nota ≥ 80 e sem bloqueantes.

## Nunca

- Mudar o `slug` de um artigo publicado sem adicionar a linha em `redirects/migration.csv`.
- Reutilizar um `id`.
- Apagar um artigo publicado sem decidir: 301 para o equivalente ou 410.
