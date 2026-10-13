---
id: ART2252
title: "Criptografia de ponta a ponta explicada"
slug: como-funciona-a-criptografia-de-ponta-a-ponta
description: "Como funciona a criptografia de ponta a ponta? Só o remetente e o destinatário conseguem ler a mensagem, porque as chaves ficam nos dispositivos de cada um. Entenda chaves, sigilo futuro e os limites da proteção."
category: tecnologia-ia-e-ciencia
tags:
- criptografia de ponta a ponta
- E2EE
- chaves criptográficas
- privacidade
keyword: criptografia de ponta a ponta
author: Equipe Mente Curiosa
datePublished: 2026-11-01
dateModified: 2026-11-01
imagensPlano:
  capa:
    busca: "smartphone encrypted messages padlock secure chat"
    alt: "Celular com mensagens protegidas por um cadeado"
  fotos:
    - busca: "public key private key encryption illustration keys"
      alt: "Ilustração de duas chaves, uma pública e uma privada"
      legenda: "Cada pessoa tem uma chave pública, que pode ser divulgada, e uma chave privada, que fica em segredo"
      secao: 3
    - busca: "server data center messages passing through network diagram"
      alt: "Diagrama de mensagens passando por servidores em uma rede"
      legenda: "Na criptografia de ponta a ponta, os servidores no meio do caminho não conseguem ler o conteúdo"
      secao: 5
sources:
- title: "Knodel, Celi, Kolkman e Grover — Definition of End-to-end Encryption (IACR ePrint 2024/2085; NYU, Brave e Internet Society)"
  url: https://eprint.iacr.org/2024/2085.pdf
- title: "Definition of End-to-end Encryption — rascunho do IETF (draft-knodel-e2ee-definition-11)"
  url: https://www.ietf.org/archive/id/draft-knodel-e2ee-definition-11.html
draft: false
---

Como funciona a criptografia de ponta a ponta? Ela garante que só o remetente e o destinatário consigam ler uma mensagem. Nenhum servidor, provedor ou outro sistema no caminho deve ter acesso ao conteúdo.

Segundo um artigo técnico de Mallory Knodel e colegas, da Universidade de Nova York, da Brave e da Internet Society, publicado na IACR, a criptografia de ponta a ponta é uma aplicação de mecanismos criptográficos para dar segurança e privacidade à comunicação entre pontos finais.

## Explicado de forma simples

Imagine duas pessoas que querem conversar por um correio que pertence a outra empresa. Se a carta for lida por qualquer funcionário no meio do caminho, a privacidade se perde.

Nesse modelo, a mensagem é trancada no celular de quem envia e só pode ser aberta no celular de quem recebe. O correio, ou seja, o servidor que transporta a mensagem, só carrega um envelope que não consegue abrir.

## Quem são os pontos finais

Segundo o artigo, um "ponto final" é quem envia ou recebe mensagens, geralmente as duas coisas. Os outros sistemas do caminho podem ajudar a entregar a mensagem, mas não são pontos finais.

Segundo os autores, definir um ponto final nem sempre é simples. Ele pode ser um aparelho da própria pessoa ou um conjunto de aparelhos que ela controla ao mesmo tempo.

## Chaves públicas e privadas

A base técnica é a criptografia de chave pública. Cada pessoa tem duas chaves: uma pública, que pode ser divulgada, e uma privada, que fica guardada no aparelho e não deve ser compartilhada.

Na prática, quem quer enviar uma mensagem usa a chave pública do destinatário para trancá-la. Só a chave privada correspondente consegue abri-la. Aplicativos modernos de mensagens combinam esses métodos com algoritmos de chave simétrica, que são mais rápidos para criptografar o conteúdo.

Segundo o artigo, o protocolo OpenPGP, usado sobretudo em e-mails, também funciona com chaves trocadas entre os pontos finais. Já o algoritmo de dupla catraca, usado por muitos aplicativos de mensagens, combina autenticação e troca de chaves.

## Onde a mensagem fica protegida

Segundo o artigo, a confidencialidade é quebrada se o conteúdo puder ser decifrado em qualquer ponto intermediário. Por isso, a mensagem deve chegar ao destinatário sem ser aberta por servidores, provedores ou outros sistemas no meio do caminho.

Essa é a diferença em relação à criptografia apenas em trânsito, que protege os dados enquanto eles viajam pela rede, mas não impede que o provedor do serviço leia o conteúdo ao recebê-lo.

## As quatro propriedades principais

Segundo o artigo, um sistema de ponta a ponta precisa oferecer quatro propriedades básicas: confidencialidade, integridade, autenticidade e sigilo futuro.

A confidencialidade significa que só o remetente e o destinatário podem ler o texto da mensagem. A integridade significa que qualquer alteração feita no trajeto deve ser detectada pelo destinatário. A autenticidade significa que as duas partes conseguem verificar a identidade uma da outra.

## O sigilo futuro

O sigilo futuro, em inglês *forward secrecy*, é a propriedade que impede um atacante de decifrar mensagens antigas que ele tenha capturado, mesmo que depois consiga comprometer um dos aparelhos.

Segundo o artigo, essa proteção costuma ser alcançada trocando chaves de forma regular e destruindo as antigas, que não são mais necessárias. Assim, cada conversa passa a depender de chaves que já não existem depois de algum tempo.

## O que a criptografia não protege

Segundo o artigo, essa proteção não resolve tudo. Se um dos aparelhos for comprometido, por exemplo por um vírus, o atacante pode ter acesso ao conteúdo que aparece na tela e às chaves armazenadas ali.

Segundo os autores, o sigilo futuro não protege contra atacantes ativos que comprometem um ponto final. Isso significa que a segurança do aparelho continua sendo parte essencial da proteção.

## Metadados: o que continua visível

Segundo o artigo, a comunicação digital gera dados além do conteúdo, chamados de metadados. Entre eles estão endereços IP, identificadores de usuário, horários, tamanho das mensagens e a frequência de contato.

Segundo os autores, os metadados podem ser tão sensíveis quanto o conteúdo e são difíceis de ocultar completamente. Por isso, um sistema pode proteger o texto e ainda assim revelar com quem e quando alguém se comunica.

## Desafios práticos

Segundo o artigo, um dos maiores desafios é a verificação das chaves públicas. Para ter certeza de que está falando com a pessoa certa, o usuário precisa confirmar que a chave pertence a ela, algo que é difícil de fazer sem ajuda de ferramentas.

Outro desafio é trocar de aparelho. Segundo o artigo, mover a chave privada para outro dispositivo pode colocar em risco a segurança do sistema, porque abre espaço para ataques em que alguém se faz passar pelo usuário.

Os grupos também são um desafio. Segundo os autores, a escala de conversas em grupo exige protocolos específicos. Há também limites para mensagens temporárias: mesmo que o aplicativo apague uma mensagem, a pessoa pode copiá-la ou fotografá-la antes.

## Acesso de terceiros e o debate

Segundo o artigo, o acesso de terceiros ao conteúdo viola a expectativa de quem usa essa proteção. Isso vale para varreduras no aparelho do usuário, para acessos no servidor e para "portas dos fundos" criadas por chaves de recuperação.

Segundo os autores, um sistema realmente confiável reduz a necessidade de confiar no provedor, mas essa garantia depende de o software funcionar de acordo com a especificação. Por isso, eles defendem código aberto e auditorias públicas.

## Mitos sobre essa proteção

**"Se o aplicativo diz que usa essa proteção, ninguém pode ler a mensagem."** Mito. Segundo o artigo, a proteção depende também da segurança dos aparelhos, dos metadados e da forma como a verificação de chaves é feita.

**"O provedor não tem nenhuma informação sobre a conversa."** Mito parcial. Segundo o artigo, o provedor ainda pode ver metadados, como horários e frequência de contato, mesmo sem acesso ao conteúdo.

**"Mensagens apagadas desaparecem para sempre."** Mito. Segundo o artigo, as opções de apagar mensagens protegem contra um atacante que comprometa um dispositivo depois, mas não impedem que alguém copie ou fotografe o conteúdo antes.

## Perguntas frequentes

### O cadeado do site é a mesma coisa?

Não. O cadeado de um site protege a comunicação entre o navegador e o servidor, mas o servidor pode ler o conteúdo. Na criptografia de ponta a ponta, só os aparelhos das pontas têm as chaves para ler a mensagem.

### Por que essa proteção importa para a privacidade?

Segundo o artigo, ela reduz a necessidade de confiar no provedor. Como o conteúdo não pode ser lido no meio do caminho, a privacidade das conversas não depende de promessas da empresa que mantém o serviço.

## Resumindo

- Nesse modelo, só o remetente e o destinatário conseguem ler a mensagem.
- As chaves ficam nos aparelhos das pontas, e servidores no meio do caminho não conseguem decifrar o conteúdo.
- Segundo o artigo, as propriedades básicas são confidencialidade, integridade, autenticidade e sigilo futuro.
- A proteção não cobre um aparelho comprometido, e os metadados podem continuar visíveis.
- Verificar chaves e proteger os aparelhos são partes essenciais da segurança.

Veja também como [funciona a criptografia](/como-funciona-a-criptografia/), que explica a base dessa tecnologia, e como [funciona o blockchain](/como-funciona-o-blockchain/), que também usa funções de hash e chaves.

## Fontes

- Mallory Knodel, Sofía Celi, Olaf Kolkman e Gurshabad Grover, Definition of End-to-end Encryption, IACR ePrint 2024/2085: https://eprint.iacr.org/2024/2085.pdf
- Definition of End-to-end Encryption, rascunho do IETF, draft-knodel-e2ee-definition-11: https://www.ietf.org/archive/id/draft-knodel-e2ee-definition-11.html
