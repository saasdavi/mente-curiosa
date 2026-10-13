---
id: ART2024
title: Como funciona o blockchain?
slug: como-funciona-o-blockchain
description: "Como funciona o blockchain? É um registro digital distribuído, em que cada bloco é preso ao anterior por um código de hash. Entenda blocos, hash, consenso e por que a cadeia é difícil de alterar."
category: tecnologia-ia-e-ciencia
tags:
- blockchain
- criptografia
- consenso
- registros distribuídos
keyword: como funciona o blockchain
author: Equipe Mente Curiosa
datePublished: 2026-10-24
dateModified: 2026-10-24
imagensPlano:
  capa:
    busca: "blockchain network nodes digital ledger illustration"
    alt: "Ilustração de uma rede de blocos conectados em cadeia"
  fotos:
    - busca: "blocks chained together hash digital illustration"
      alt: "Blocos digitais ligados uns aos outros em sequência"
      legenda: "Cada bloco guarda o código de hash do bloco anterior, formando a cadeia"
      secao: 2
    - busca: "computer nodes network distributed copies ledger"
      alt: "Vários computadores conectados em rede, cada um com uma cópia do registro"
      legenda: "Em uma rede distribuída, cada participante pode manter uma cópia do registro"
      secao: 5
sources:
- title: "NIST — NISTIR 8202 (rascunho): Blockchain Technology Overview (janeiro de 2018)"
  url: https://csrc.nist.gov/csrc/media/publications/nistir/8202/draft/documents/nistir8202-draft.pdf
- title: "John Kelsey (NIST) — Introduction to Blockchains, slides de curso (Bryn Mawr College, 2018)"
  url: https://www.cs.brynmawr.edu/Courses/cs113/spring2018/24/blockchains.pdf
draft: false
---

Como funciona o blockchain? É um registro digital de transações, mantido por muitos computadores ao mesmo tempo, em que cada bloco fica preso ao anterior por um código criptográfico chamado hash.

Segundo o NIST, o Instituto Nacional de Padrões e Tecnologia dos Estados Unidos, o resultado é um registro em que nenhuma transação pode ser alterada depois de publicada, em condições normais de funcionamento da rede.

A ideia não depende de um banco ou de outra entidade central para dizer o que é verdade. Quem decide é a própria rede, seguindo regras.

## Explicado de forma simples

Pense em um livro-caixa que é copiado para várias pessoas ao mesmo tempo. Quando uma página nova é escrita, ela é conferida pelos outros e fica colada à anterior, de modo que mudar uma página antiga exigiria refazer todas as seguintes. Todos os participantes percebem a tentativa.

O blockchain faz algo parecido, mas com computadores, criptografia e regras automáticas no lugar do papel.

## A ideia de "concordar sobre o passado"

Segundo John Kelsey, pesquisador do NIST, em slides de um curso universitário, a dificuldade é que os participantes não confiam uma no outro.

Ele usa a imagem de duas pessoas jogando xadrez por correspondência. Para continuar a partida, elas precisam concordar com a sequência de jogadas anteriores, porque é ela que define o estado atual do tabuleiro.

Segundo Kelsey, um blockchain registra o histórico de transações. Se todos concordam com esse histórico, concordam também com o estado atual do sistema, sem precisar de um árbitro de confiança.

## O que é um hash

Um dos blocos fundamentais é a função de hash. Segundo o NIST, ela recebe uma entrada de qualquer tamanho, como um arquivo, um texto ou uma imagem, e produz uma saída de tamanho fixo, chamada de digest, ou "impressão digital".

Duas características são essenciais. Uma pequena mudança na entrada, até mesmo de um único bit, gera uma saída completamente diferente. E é computacionalmente inviável encontrar duas entradas diferentes que produzam o mesmo resultado.

O NIST cita o SHA-256, que gera saídas de 256 bits, como um dos algoritmos usados em blockchains. Segundo o mesmo documento, encontrar uma colisão nesse algoritmo exigiria, em média, cerca de 2^128 execuções.

## Transações, chaves e assinaturas

Uma transação é o registro de uma transferência de ativos entre partes. Segundo o NIST, ela contém pelo menos o valor transferido, as origens dos recursos, os destinatários e um identificador único.

Essas transações são assinadas com criptografia de chave pública. Cada usuário tem uma chave privada, mantida em segredo, e uma chave pública, que pode ser divulgada. Segundo o NIST, a assinatura é feita com a chave privada, e qualquer pessoa pode verificá-la com a chave pública correspondente.

Segundo o NIST, ter a chave privada é o que comprova que a pessoa tem direito sobre o valor. Por isso, quem perde a chave privada perde o acesso ao que ela controla.

## Blocos e a cadeia

Um bloco reúne um conjunto de transações validadas. Segundo o NIST, cada bloco contém, entre outras informações, o número do bloco, o hash do próprio bloco, o hash do bloco anterior, um carimbo de data e hora e a lista de transações.

As transações não são resumidas uma a uma no cabeçalho.

Em vez disso, o blockchain usa uma árvore de Merkle, que combina os hashes das transações até gerar um único valor, chamado de raiz. Segundo o NIST, esse valor resume o conjunto de transações e permite verificar se uma transação faz parte do bloco.

É a inclusão do hash do bloco anterior que forma a cadeia. Se alguém alterar um bloco antigo, seu hash muda.

Isso muda o hash que o bloco seguinte guardou, e a alteração se propaga para todos os blocos seguintes. Segundo o NIST, é assim que a rede consegue detectar e rejeitar alterações em blocos já publicados.

## Quem decide qual bloco entra

Se não há um dono do registro, alguém precisa decidir qual bloco será o próximo. Essa decisão é o consenso. Segundo o NIST, os participantes precisam concordar sobre quais transações são válidas e qual cadeia de blocos vale.

Um dos modelos mais conhecidos é a prova de trabalho, usada pelo Bitcoin.

Nela, os mineradores competem para encontrar um valor chamado nonce, que, combinado aos dados do bloco, gera um hash abaixo de um limite. Segundo o NIST, isso exige muitas tentativas, mas a verificação do resultado é rápida: basta uma única conta.

O NIST dá um exemplo simples. Ao calcular o hash de "blockchain" seguido de um número, encontrar um resultado que comece com seis zeros exigiu 10.730.896 tentativas. Com mais um zero no alvo, foram necessárias 934.224.175 tentativas.

O documento também explica que o Bitcoin ajusta a dificuldade a cada duas semanas para que um novo bloco saia, em média, a cada dez minutos.

## Outros modelos de consenso

A prova de trabalho não é a única opção. Segundo o NIST, na prova de participação, a chance de um participante criar o bloco é proporcional à quantia de moedas que ele mantém travadas na rede. Não há cálculos intensivos.

Segundo o mesmo documento, quem tem mais participação tem mais chance, mas obter a maioria para controlar a rede costuma ser proibitivamente caro.

Em redes privadas, em que os participantes já se conhecem e confiam em certo grau uns nos outros, o NIST cita o modelo de revezamento. Nele, os nós criam blocos em turnos.

Segundo o NIST, quando dois nós publicam blocos diferentes ao mesmo tempo, a rede forma duas versões temporárias da cadeia. A regra comum é adotar a cadeia mais longa, que recebeu o próximo bloco válido. As transações do outro ramo voltam a ficar pendentes.

## Públicos ou privados

Segundo o NIST, os blockchains são classificados pelo modelo de permissão. Em um blockchain sem permissão, qualquer pessoa pode ler e escrever. Em um blockchain com permissão, apenas participantes escolhidos podem fazer isso.

Um blockchain com permissão é parecido com uma intranet controlada. Ele pode ser usado por bancos, empresas e órgãos que querem registrar transações compartilhadas sem confiar totalmente uns nos outros.

## Mitos sobre o blockchain

**"Blockchain e Bitcoin são a mesma coisa."** Mito. Segundo o NIST, o blockchain surgiu ligado ao Bitcoin, mas a tecnologia é mais ampla e tem outras aplicações.

**"Blockchain não precisa de confiança."** Mito. Segundo o NIST, não há uma terceira parte certificando as transações nos blockchains sem permissão. Mesmo assim, é preciso confiar na criptografia, nos desenvolvedores e na ausência de conluio entre a maioria dos participantes.

**"Tudo fica guardado no blockchain."** Mito. Segundo o NIST, blockchains têm limite de tamanho para as transações. Dados grandes costumam ficar fora da cadeia, e apenas referências ou hashes deles são registrados.

## Perguntas frequentes

### Se alguém perder a chave privada, o dinheiro pode ser recuperado?

Segundo o NIST, não há um "esqueci minha senha" em blockchains. Se a chave privada for perdida, os ativos ligados a ela ficam inacessíveis. Por isso, o armazenamento seguro das chaves é tão importante.

### Um blockchain resolve problemas de identidade?

Não diretamente. Segundo o NIST, a assinatura de transações mostra que quem assinou tem a chave privada, mas não associa essa chave a uma identidade real. Essa ligação é feita por processos fora do blockchain.

## Resumindo

- Um blockchain é um registro distribuído de transações assinadas, organizado em blocos.
- Cada bloco guarda o hash do anterior, e alterar um bloco antigo muda todos os seguintes.
- O consenso define quais transações são válidas e qual cadeia é aceita, sem uma autoridade central.
- Modelos como prova de trabalho e prova de participação resolvem a escolha do próximo bloco de maneiras diferentes.
- Segundo o NIST, a tecnologia não é mágica, não elimina a necessidade de confiança e não resolve sozinha problemas de identidade.

Veja também como [funciona a criptografia](/como-funciona-a-criptografia/), que é a base de muitos princípios usados pelos blockchains, e como [funciona o 5G](/como-funciona-o-5g/), outra tecnologia de redes digitais explicada de forma simples.

## Fontes

- NIST, NISTIR 8202 (rascunho), Blockchain Technology Overview, janeiro de 2018: https://csrc.nist.gov/csrc/media/publications/nistir/8202/draft/documents/nistir8202-draft.pdf
- John Kelsey (NIST), Introduction to Blockchains, slides de curso, Bryn Mawr College, 2018: https://www.cs.brynmawr.edu/Courses/cs113/spring2018/24/blockchains.pdf
