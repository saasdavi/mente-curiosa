# Auditoria automática — regras para publicar sem revisão manual

Este documento define **quando um artigo pode ir ao ar sozinho**. A automação só publica se o artigo passar em
**todos** os portões abaixo. Se falhar em qualquer um, o artigo **não vai ao ar**: fica parado com o motivo registrado
na planilha (coluna "PR / Log da automação"), e o ritmo segue com as outras pautas.

Tudo é decidido por regra. Nenhuma etapa depende de alguém ler o texto.

```
Planilha (planejado) → [P1 pauta] → REDATOR (Claude) escreve
  → [P2 estrutura e SEO] → [P3 fontes] → [P4 fatos] → [P5 validador independente]
  → [P6 exclusividade] → [P7 imagens] → [P8 segurança] → [P9 build]
  → tudo aprovado?  SIM → publica (merge) e marca "agendado/publicado"
                    NÃO → não publica, registra o motivo, abre aviso
```

## Portões (todos obrigatórios)

| # | Portão | Passa quando | Se falhar |
|---|---|---|---|
| **P1** | Pauta válida | status `planejado`; data até hoje + 2 dias; ID, slug e palavra-chave **não existem** no site, em branch ou em PR aberto | pula a pauta |
| **P2** | Estrutura e SEO | schema do site válido; 1.000 a 1.600 palavras; mínimo 4 seções `##`; sem `#` no corpo; 1º parágrafo com até 50 palavras e com a palavra-chave; parágrafos até 50 palavras; frases até 22 palavras em média; nenhuma frase proibida (REGRAS_OURO 13); nenhum resto de texto de IA; **nota da auditoria ≥ 9,0 (escala de 0 a 10) e nenhum bloqueante** | reescreve (até 2 voltas); persistindo, não publica |
| **P3** | Fontes | ao menos 3 citadas; **ao menos 2 abrem de verdade** (HTTP 200) e são fontes primárias (instituições, universidades, periódicos, órgãos públicos); nenhuma Wikipédia, blog, fórum ou rede social | reescreve com fontes novas; persistindo, não publica |
| **P4** | Fatos conferidos | todo **número, data e nome de estudo** do texto aparece no texto das fontes lidas. Se a fonte não pôde ser lida (site bloqueia robô), o artigo **não** publica sozinho | reescreve retirando o dado; persistindo, não publica |
| **P5** | Validador independente | um segundo Claude, com instruções próprias, confere V1 a V8 (REGRAS_OURO) e responde `APROVADO`. Qualquer `DEVOLVER` volta ao redator com os motivos | reescreve (até 2 voltas); persistindo, não publica |
| **P6** | Conteúdo exclusivo | semelhança de texto com qualquer artigo do site **abaixo de 55%**; título não quase-igual a outro; **no máximo 3% de trechos copiados** (sequências de 8 palavras) de qualquer fonte | reescreve; persistindo, não publica |
| **P7** | Imagens | capa + fotos no corpo obtidas de banco com licença (Pexels, NASA); nenhuma foto usada em outro artigo; `alt` com 25+ caracteres; **a foto é olhada por IA e confere com o `alt`**; autor, link e licença registrados | troca de foto (até 3 candidatas); sem foto boa, não publica |
| **P8** | Segurança | categorias de saúde (corpo humano, psicologia) têm o aviso de que não substitui profissional e **não têm** diagnóstico, dose ou tratamento; nada perigoso | não publica |
| **P9** | Build completo | `npm run build` passa: auditoria de SEO, geração do site e checagem de links internos (todo link interno precisa existir) | não publica |

## Ritmo e freios (valem sempre)

- **Nunca publica em lote.** Cada artigo tem data fixa na planilha. Se um dia falhar, a pauta daquele dia simplesmente não sai.
- **Ritmo por fase:** outubro de 2026 = 1 por dia; novembro = 2 por dia; de dezembro em diante = 3 por dia.
- **Nos dois primeiros meses só saem** Universo, Animais, Ciência e Tecnologia. Corpo humano e Psicologia entram depois.
- **Freio automático:** 3 artigos seguidos reprovados no mesmo dia, ou 5 no total em 7 dias, **pausam a geração** e abrem um aviso no GitHub.
- **Pausa manual:** a variável `PAUSAR=true` (Settings → Variables → Actions) para tudo imediatamente.
- **Teste de indexação (dia 30):** se mais de 30% dos artigos publicados não estiverem indexados no Search Console, pausar e revisar a qualidade antes de continuar.

## Publicação sem revisão: a chave `AUTO_MERGE`

- `AUTO_MERGE=true`: o artigo que passou em todos os portões é publicado **sozinho**.
- `AUTO_MERGE=false` (padrão até você ligar): o artigo que passou abre um PR e espera **1 clique** seu.
- Artigo que falhou em algum portão **nunca** é publicado, qualquer que seja o valor.

**Recomendação:** manter `false` nas primeiras 2 semanas e até o AdSense aprovar o site, para conferir na prática se os portões estão pegando tudo. Depois disso, ligar `true`.

## O que este sistema não garante

- Pode deixar passar um erro de fato sutil que as fontes não contradizem.
- O Google e o AdSense podem recusar conteúdo gerado em escala mesmo com todos os portões aprovados.
- Por isso existem o ritmo gradual, o teste de indexação, a pausa e o registro de tudo na planilha.
