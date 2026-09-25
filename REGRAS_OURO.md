# Regras de ouro — criação de artigos Mente Curiosa

Valem para **qualquer redator**: Claude hoje, Hermes (ou outro modelo) no futuro. O fluxo é sempre o mesmo:
**um escreve, o Claude confere e valida, a auditoria automática decide se publica.**

```
Planilha (pauta PLANEJADO) → REDATOR escreve (.md + imagensPlano)
  → auditoria automática (npm run audit)  ── nota < 80 ou bloqueante → volta ao redator com o relatório (máx. 2 voltas)
  → VALIDADOR (Claude) confere fatos, fontes e tom ── reprovado → volta com o motivo
  → commit no GitHub → Imagens automáticas → Vercel publica
  → Claude confere as fotos e o alt → altConferido: true
  → planilha: PUBLICADO + fila de distribuição (Facebook / Pinterest)
```

## As 15 regras

**Conteúdo**
1. **Uma pauta = uma intenção = uma URL.** A keyword principal não pode existir em outro artigo. Variações de cauda longa viram seções, não artigos novos.
2. **Nunca inventar.** Todo número, nome, data e estudo precisa estar nas fontes. Na dúvida, corta.
3. **Mínimo 2 fontes primárias** (NASA, universidades, periódicos, órgãos públicos). Nada de Wikipédia, blogs, fóruns ou Brainly.
4. **Resposta no primeiro parágrafo**, em até 50 palavras, com a keyword. Quem só ler isso já sai com a resposta.
5. **1.000 a 1.500 palavras.** Menos de 1.000 não publica. Nada de enchimento para bater número: cada seção precisa ensinar algo.

**Estrutura (nesta ordem)**
6. Resposta direta → explicado de forma simples → como acontece → o que a ciência sabe → exemplos do dia a dia → mitos e verdades → perguntas frequentes → resumindo. Mínimo 4 seções H2; nunca H1 no corpo.
7. **Leitura no celular:** parágrafos de até 50 palavras (2–4 linhas), frases de até 22 palavras em média, um subtítulo a cada 300 palavras no máximo.

**SEO técnico**
8. **Title** com a keyword e até 60 caracteres somando " | Mente Curiosa" (se passar, use `seoTitle`). **Description** de 120 a 160 caracteres com a keyword. **Slug** curto, sem acento, nunca muda depois de publicado.
9. **Links internos:** pelo menos 2, sempre `/slug/` com barra final, sendo 1 para outro artigo já publicado.
10. **Keyword natural:** no title, na description, no 1º parágrafo e no slug; em subtítulos só quando soar natural; densidade abaixo de 3%.

**Imagens**
11. **Todo artigo sobe com `imagensPlano`:** capa + 2 fotos no corpo (1 se o texto for curto). Busca em inglês, concreta e fotografável. Alt em português descrevendo o que aparece. Legenda ligando a foto ao texto. Uma foto por seção.

**Segurança e tom**
12. **Saúde, mente e corpo:** terminar com o aviso "Este conteúdo é informativo e não substitui a orientação de um profissional de saúde." Nada de diagnóstico, dose ou tratamento.
13. **Tom humano:** exemplos do dia a dia, você, frases diretas. Proibido: "neste artigo", "vamos explorar", "mergulhar", "jornada", "vale ressaltar", "é importante destacar", "em suma", "concluindo", "fascinante mundo", "desvendar os mistérios", "no cenário atual".

**Processo**
14. **Entrega no formato do `ARTIGO_FORMATO.md`**, com o `id` da planilha (ART0000). Artigo existente: atualizar `dateModified`, nunca o slug.
15. **Só publica aprovado:** auditoria ≥ 80 sem bloqueante + validação do Claude. Tudo registrado na planilha (status e motivo de cada reprovação).

## Checklist do validador (Claude)

O validador não reescreve o artigo; ele aprova ou devolve com motivos objetivos.

| # | Pergunta | Reprova se |
|---|---|---|
| V1 | Os fatos batem com as fontes citadas? | qualquer número, nome ou estudo sem apoio nas fontes |
| V2 | As fontes existem e são primárias? | link quebrado, fonte fraca ou fonte que não fala do assunto |
| V3 | O 1º parágrafo responde a pergunta? | enrola antes de responder |
| V4 | Cada seção ensina algo novo? | repetição ou enchimento para bater 1.000 palavras |
| V5 | O tom é humano e claro? | frases de IA, jargão sem explicação, frases proibidas |
| V6 | É seguro? | orientação médica, psicológica ou perigosa |
| V7 | O plano de imagens faz sentido? | busca vaga ("adrenaline"), alt que não descreve cena, foto sem relação com a seção |
| V8 | A intenção é única no acervo? | canibaliza outro artigo (então vira ATUALIZAR aquele) |

Resposta do validador, sempre neste formato (o n8n lê):

```json
{ "id": "ART0001", "decisao": "APROVADO | DEVOLVER", "motivos": ["V1: ...", "V4: ..."], "correcoes": ["trecho → correção"] }
```

## Para treinar o Hermes (ou outro redator)

- **Exemplos de referência (padrão ouro):** `por-que-o-ceu-e-azul.md` e `por-que-sentimos-medo.md` — use como exemplos no prompt.
- **Prompt do redator** = estas 15 regras + o `ARTIGO_FORMATO.md` + 1 exemplo de referência + a pauta da planilha (keyword, cauda longa, cluster, links internos disponíveis).
- **Aprendizado:** cada devolução do validador fica na planilha (aba LOG). Os motivos que mais se repetem viram regra nova neste arquivo ou exemplo no prompt.
- **Métrica do redator:** % aprovado de primeira, nota média da auditoria, nº de voltas por artigo. O Hermes só assume sozinho quando mantiver ≥ 80% aprovado de primeira por 30 artigos seguidos — e o Claude continua validando.
