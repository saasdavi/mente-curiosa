# Pipeline do blog: do tema ao artigo no ar

Tudo é automático. Cada etapa tem um responsável, um critério de "deu certo" e uma ação quando falha.

| # | Etapa | Quem faz | Deu certo quando | Se falhar |
|---|---|---|---|---|
| 1 | **Ler o calendário** | Workflow "Gerar artigos do dia" (05:30 BRT) | Pega pautas com status `planejado` até 2 dias à frente | Workflow vermelho e e-mail do GitHub |
| 2 | **Escrever** | Claude (API) | Devolve META + CORPO no formato | Tenta de novo com os motivos |
| 3 | **Auditar** | Robô (9 portões) | P2 SEO, P3 fontes, P4 fatos, P6 cópia, P8 segurança, P9 links passam | Devolve ao redator com a lista do que corrigir (até 4 tentativas) |
| 4 | **Validar** | 2º Claude, independente | P5 aprova o texto contra as fontes | Idem |
| 5 | **Imagens** | Robô + Pexels | P7: fotos baixam e combinam com o texto | Tema reprovado |
| 6 | **Trocar de tema** | Robô | Tema reprovado vira `revisar`; o robô tenta o próximo | 3 reprovações no dia: para e abre Issue |
| 7 | **Publicar** | Robô | PR aberto (ou merge se `AUTO_MERGE=true`); status `em revisão` ou `agendado` | Status não muda; workflow vermelho |
| 8 | **Deploy** | Workflow "Publicar no ar" (06:05 BRT) | Vercel publica o site com os artigos que chegaram na data | Workflow vermelho e e-mail |
| 9 | **Confirmar no ar** | Robô, logo após o deploy | Abre o link: 200, título, texto, imagens carregam, está no sitemap | Status continua `agendado`, Issue aberta |
| 10 | **Planilha** | Robô | Só aqui o status vira **`publicado`**, com o link na coluna "PR / Log da automação" | — |

## Regras que evitam erro

- **Nada é publicado sem passar pelas etapas 3, 4 e 5.** Reprovado não vai para o blog.
- **Sem loop:** cada tema tem até 4 tentativas; depois sai da fila (`revisar`) e o robô passa ao próximo. Falha de API (429, 5xx) não queima o tema.
- **Sem duplicar:** só entra na fila pauta `planejado` cujo slug, ID e palavra-chave ainda não existem no blog nem em PR aberto.
- **"Publicado" só com prova:** o status muda depois de o link ser aberto e conferido, nunca só pela data.
- **Falha nunca parece sucesso:** workflow vermelho quando a meta do dia não é cumprida; Issue aberta com o motivo.

## Como acompanhar

- Aba **Actions** do GitHub: "Gerar artigos do dia" e "Publicar no ar (deploy diário)". O resumo de cada execução lista os artigos e os links.
- Planilha, coluna **PR / Log da automação**: `NO AR ✓ data: link`, `NÃO CONFIRMADO ...` ou `FALHA ...`.
- Freios: 5 falhas em 7 dias pausam a geração (`PAUSAR=true` pausa na hora).
