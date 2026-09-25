# Padrão de qualidade SEO — Mente Curiosa

> Resumo operacional para quem escreve (Claude/n8n): **REGRAS_OURO.md**.

Todo artigo passa por 3 filtros antes de ir ao ar, e é revisado de novo depois de publicado.

```
Claude escreve → AUDITORIA AUTOMÁTICA → Claude corrige → REVISÃO HUMANA → publica → REVISÃO PÓS-PUBLICAÇÃO
                 (npm run audit)                          (checklist, ~5 min)          (D+7, D+28, D+90)
```

## 1. O padrão (o que é um artigo bom aqui)

1. **Responde a pergunta no primeiro parágrafo**, em até 50 palavras, com a keyword.
2. **Uma intenção por URL.** As variações de cauda longa viram seções H2, não artigos novos.
3. **Profundidade útil:** 1.000–1.500 palavras (mínimo 1.000), 4+ seções H2, sem enchimento.
4. **Estrutura fixa:** resposta direta → explicação simples → como acontece → o que a ciência sabe → exemplos/curiosidades → mitos e verdades → resumo.
5. **Fontes primárias** (instituições científicas, universidades, periódicos, órgãos públicos): mínimo 2.
6. **Links internos:** mínimo 2, com pelo menos 1 para outro artigo relacionado.
7. **Texto humano:** frases curtas, parágrafos curtos, exemplos do dia a dia, zero frases de enchimento.
8. **Saúde e comportamento:** aviso de que não substitui profissional; nada de diagnóstico ou dose.

## 2. Auditoria automática (`npm run audit`)

Nota de 0 a 100. **Publica com nota ≥ 80 e nenhum bloqueante.** O build falha se houver bloqueante.

**Bloqueantes** — o artigo não vai ao ar:

| Regra | O que verifica |
|---|---|
| B01 | Sem H1 no corpo (o H1 é o title) |
| B02 | Mínimo de 1.000 palavras (conteúdo raso é o principal motivo de recusa no AdSense) |
| B03 | Ao menos 1 fonte |
| B04 | Keyword principal única no acervo (canibalização) |
| B05 | Aviso de saúde nos clusters Corpo humano e Psicologia |
| B06 | Sem restos de rascunho/IA ("como uma IA", "[inserir", lorem ipsum) |

**Pontuação** — alertas que baixam a nota:

| Grupo | Regras |
|---|---|
| Title e description (T) | title ≤ 60 caracteres no Google · keyword no title · description 120–160 · keyword na description · keyword no slug |
| Conteúdo (C) | keyword no 1º parágrafo · 1º parágrafo ≤ 50 palavras · ideal ≥ 1.200 palavras · ≥ 4 H2 · subtítulo a cada ≤ 300 palavras · hierarquia correta · seção de valor extra · resumo final |
| Links (L) | ≥ 2 links internos · ≥ 1 para outro artigo |
| Fontes (F) | ≥ 2 fontes · sem Wikipédia/blogs/fóruns |
| Qualidade (Q) | sem enchimento · frases ≤ 22 palavras em média · parágrafos ≤ 50 palavras (2–4 linhas no celular) · densidade de keyword ≤ 3% |
| Imagem (I) | alt descritivo, ≥ 1 foto no corpo (2 se ≥ 1200 palavras), nomes de arquivo descritivos, crédito/licença e legenda em toda imagem |
| Duplicidade (X) | título não quase-igual a outro artigo |

O relatório sai em `reports/auditoria-seo.csv`, no formato da aba **SEO_DIARIO** do banco editorial.

**Já garantido pelo template (não depende do texto):** canonical, meta robots, Open Graph, schema BlogPosting + BreadcrumbList, sitemap com lastmod, URL com barra final, imagem com dimensões, links internos válidos (o build falha se quebrar).

## 3. Revisão humana (checklist do PR, ~5 minutos)

- [ ] **Está certo?** Conferi 2–3 afirmações principais nas fontes citadas.
- [ ] **É melhor que o que já existe?** Comparado com os 3 primeiros do Google, tem algo a mais (exemplo, clareza, curiosidade).
- [ ] **Soa humano?** Li o primeiro parágrafo e o resumo em voz alta.
- [ ] **Imagem certa?** Relevante, com licença registrada, sem texto errado.
- [ ] **Seguro?** Nenhuma orientação médica, psicológica ou perigosa.

Reprovado em qualquer item → volta para o Claude com o motivo, que fica registrado.

## 4. Revisão pós-publicação (registrada em SEO_DIARIO)

| Quando | Verifica | Ação se falhar |
|---|---|---|
| D+7 | Indexado? | Inspecionar URL no Search Console, reforçar links internos |
| D+28 | Impressões, consultas reais, CTR | CTR baixo → reescrever title/description · consultas novas → EXPANDIR |
| D+90 | Posição e cliques | Posição 8–20 → EXPANDIR · sem impressões → rever intenção ou MESCLAR |
| A cada 6 meses | Informação ainda correta? | ATUALIZAR e mudar `dateModified` |
