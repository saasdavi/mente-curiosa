# Diretrizes editoriais globais — SEO, GEO e EAO

Estas regras valem para todos os redatores e modelos que produzam artigos para Mente Curiosa. Definem a qualidade editorial; o formato de cada projeto continua sendo definido pelo respectivo repositório/importador.

## SEO, GEO e EAO
- **SEO:** atender à intenção de busca, usar a palavra-chave naturalmente, criar título/descrição claros, estruturar subtítulos úteis e incluir links internos pertinentes.
- **GEO:** apresentar fatos verificáveis, contexto suficiente, conceitos nomeados com precisão e fontes primárias reconhecíveis, de modo que mecanismos generativos possam resumir/citar sem perder o sentido.
- **EAO:** responder à pergunta central no primeiro parágrafo; usar perguntas reais como subtítulos quando apropriado; incluir definições diretas, listas ou passos quando úteis.
- Não prometer posicionamento, citação por IA, tráfego ou aprovação. São práticas de qualidade, não garantias.

## Pesquisa e precisão
- Usar pelo menos **3 fontes diretas, confiáveis e pertinentes** por artigo; priorizar fontes primárias, órgãos públicos, universidades, sociedades profissionais e periódicos reconhecidos conforme o assunto.
- Fontes comerciais, lojas, páginas promocionais, fóruns e conteúdo sem autoria/lastro não sustentam afirmações factuais importantes.
- Não inventar números, datas, estudos, citações, URLs ou resultados. Cada afirmação relevante deve ter apoio em fonte que realmente trate do assunto.
- Registrar título e URL em `sources`. A validação editorial deve abrir os links e confirmar o suporte. O build não consegue provar sozinho que a página sustenta a frase.
- Se uma fonte não puder ser verificada, declarar a limitação e remover ou qualificar a afirmação.

## Redação neuro-humana
- Português brasileiro claro, voz ativa, ritmo variado e exemplos concretos.
- Resposta direta no primeiro parágrafo, em até 50 palavras.
- Parágrafos de até 50 palavras; média de até 22 palavras por frase; subtítulo a cada 300 palavras, no máximo.
- Explicar termos técnicos e mecanismos complexos em linguagem cotidiana; analogias só quando corretas e esclarecedoras.
- Cada seção acrescenta informação; não repetir para atingir extensão.
- Evitar transições mecânicas e expressões vazias como “neste artigo”, “vamos explorar”, “vale ressaltar”, “é importante destacar”, “em suma”, “concluindo”, “no cenário atual”, “jornada”, “ecossistema”, “desmistificar”, “orquestrar”, “tapeçaria”, “imersão”, “catalisador” e “farol”.
- Não prometer “milagre”, “resultado garantido” ou cura. Se um termo clínico for indispensável, contextualizá-lo sem prometer resultado.

## Requisitos editoriais mínimos
- Mínimo de **1.300 palavras reais**, sem contar frontmatter; nunca usar enchimento.
- Mínimo de 4 H2 e nenhum H1 manual no corpo.
- Palavra-chave natural no título/SEO title, descrição, primeiro parágrafo e slug; nos subtítulos e alts apenas quando fizer sentido. Densidade abaixo de 3%.
- Description entre 120 e 160 caracteres.
- Pelo menos 2 links internos relevantes para artigos publicados, com barra final.
- Incluir `## Resumindo`; conteúdos de saúde também incluem `## Quando procurar um médico`.
- Plano de imagens completo e coerente com as seções, conforme `ARTIGO_FORMATO.md`.

## Saúde, corpo e psicologia
- Informar que o conteúdo não substitui orientação profissional. Não diagnosticar, prescrever, indicar dose nem prometer resultados.
- Em temas sobre medicamentos, fitoterápicos, suplementos, hormônios, exames ou tratamentos, avaliar contraindicações e interações pertinentes. Considerar, quando aplicável, gestantes, lactantes, pessoas com hipertensão, doença renal ou hepática, diabetes e quem usa medicamentos contínuos. Não afirmar que todos têm a mesma contraindicação: explicar o que é conhecido e quando buscar avaliação profissional.
- Distinguir evidência robusta, limitada e incerta; não transformar associação em causalidade.
- “Quando procurar um médico” deve indicar sinais de alerta pertinentes sem criar pânico nem substituir triagem clínica.

## Avaliação editorial
Pontuação: fontes e suporte factual 2,0; segurança 2,0; precisão 1,5; intenção/profundidade/extensão 1,5; SEO on-page 1,0; estrutura/leitura 1,0; naturalidade/originalidade 1,0.
- Aprovação editorial: **mínimo 8,5/10**, sem falha crítica de segurança, fonte inventada, afirmação importante sem suporte ou formato incompatível. Na fila Astro, registrar `editorialScore`, `editorialVerdict: APROVADO`, `editorialSourcesVerified: true` e `editorialFactsVerified: true`; a automação exige esses campos e remove-os do artigo final. Eles são declarações do processo de revisão, não prova automática de que a revisão ocorreu.
- A avaliação deve citar trechos problemáticos, listar links não verificados e sugerir correções. Corrigir os problemas antes da entrega final.
- Nunca declarar que um link foi verificado sem tê-lo aberto de fato.

## Formato e publicação
- Estas regras são a camada editorial comum, não substituem o contrato técnico do projeto.
- Mente Curiosa/Astro: `src/content/artigos/<slug>.md`, frontmatter válido e Markdown conforme `ARTIGO_FORMATO.md` e `src/content.config.ts`.
- Outros blogs: seguir exatamente o contrato de importação correspondente; não transportar cabeçalhos, campos ou HTML de outro projeto.
- Nota editorial e auditoria técnica são gates diferentes. O deploy só deve ocorrer depois dos gates realmente implementados no fluxo.
