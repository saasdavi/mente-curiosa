---
id: ART0910
title: Como funciona a criptografia?
slug: como-funciona-a-criptografia
description: "Como funciona a criptografia? Ela transforma uma mensagem legível em um texto cifrado que só quem tem a chave consegue ler. Entenda a diferença entre chave secreta e chave pública."
category: tecnologia-ia-e-ciencia
tags:
- criptografia
- chave pública
- segurança digital
- privacidade
keyword: como funciona a criptografia
author: Equipe Mente Curiosa
datePublished: 2026-10-23
dateModified: 2026-10-23
imagensPlano:
  capa:
    busca: "padlock digital data encryption code background"
    alt: "Cadeado sobre um fundo de código digital"
  fotos:
    - busca: "two keys symbol secret and public key illustration"
      alt: "Ilustração de duas chaves, uma de cada cor, lado a lado"
      legenda: "Na criptografia de chave pública, uma chave pode ser divulgada e a outra fica sigilosa"
      secao: 3
    - busca: "digital signature document verification illustration"
      alt: "Documento digital com um selo de assinatura eletrônica"
      legenda: "A assinatura digital permite verificar quem enviou a mensagem e se ela foi alterada"
      secao: 6
sources:
- title: "NIST Computer Security Resource Center — Key Management"
  url: https://csrc.nist.gov/projects/key-management
- title: "NIST CSRC — Glossário: Public Key Cryptography (PKC)"
  url: https://csrc.nist.gov/glossary/term/pkc
- title: "NIST Computer Security Handbook — capítulo de criptografia (rascunho, hospedado em universidade)"
  url: https://securityv.iri.isu.edu/isl/hk_crypt.html
draft: false
---

Como funciona a criptografia? Ela é um conjunto de métodos que transforma uma informação legível em um texto embaralhado, que só pode ser lido por quem tiver a chave certa. É isso que protege senhas, compras online e conversas em aplicativos.

A ideia é antiga, mas a criptografia moderna depende de matemática avançada. Para quem usa, porém, o princípio é simples: um algoritmo e uma chave.

## Explicado de forma simples

Imagine um cofre. O algoritmo é o mecanismo do cofre, que todo mundo pode conhecer. A chave é o segredo que abre a porta. Sem a chave, o mecanismo não serve para nada.

Na criptografia digital, a mensagem original se chama texto simples. Depois de cifrada, ela vira texto cifrado, que parece aleatório. A operação inversa, que recupera a mensagem, chama-se decifragem.

## Algoritmo e chave

Segundo o NIST, a criptografia depende de dois componentes básicos: um algoritmo, que é a metodologia, e uma chave. Nos sistemas modernos, o algoritmo é uma fórmula matemática complexa, e a chave é uma sequência de bits.

Para duas partes se comunicarem, elas precisam usar o mesmo algoritmo e, em alguns casos, a mesma chave. Muitas chaves precisam ser mantidas em segredo.

## Dois tipos de sistema

Segundo o NIST, existem dois tipos básicos de sistemas criptográficos: os de chave secreta, também chamados de simétricos, e os de chave pública, também chamados de assimétricos.

Esses dois tipos têm vantagens e desvantagens, e muitas vezes são combinados em um sistema híbrido, para aproveitar os pontos fortes de cada um.

## Chave secreta: a mesma chave para tudo

Na criptografia de chave secreta, duas ou mais partes compartilham a mesma chave. Essa chave serve tanto para cifrar quanto para decifrar os dados.

Por isso, a segurança depende de manter a chave em sigilo. Se ela for descoberta, a proteção é gravemente reduzida ou eliminada. Segundo o NIST, esse tipo de criptografia protege a informação contra terceiros, mas as partes que compartilham a chave precisam confiar uma na outra.

Um exemplo histórico é o padrão DES, publicado pelo NIST como FIPS 46-1. Segundo o manual do NIST, ele foi amplamente adotado no setor comercial.

## Chave pública: duas chaves por pessoa

Na criptografia de chave pública, cada pessoa tem um par de chaves. Uma é pública e pode ser divulgada, até em um diretório online. A outra é privada e deve ser conhecida apenas pelo dono.

Segundo o NIST, qualquer pessoa pode usar a chave pública de outra para enviar uma mensagem cifrada. Mas só quem tem a chave privada correspondente consegue decifrá-la.

O exemplo clássico tem duas pessoas, A e B. A usa a chave pública de B para cifrar a mensagem. Só B, com sua chave privada, consegue ler o conteúdo. Assim, a confidencialidade é garantida.

## Assinatura digital: provar quem enviou

A criptografia de chave pública também serve para provar a origem da mensagem. Segundo o NIST, a assinatura digital é feita com a chave privada do remetente, e qualquer pessoa pode verificá-la com a chave pública dele.

Se a verificação der certo, quem recebeu tem confiança de que o dado não foi alterado depois de assinado e de que foi assinado pelo dono da chave pública. Além disso, o remetente não consegue negar, de forma falsa, que assinou a mensagem.

## Por que usar os dois tipos juntos

A criptografia pública parece mais versátil, mas é muito mais lenta. Segundo o NIST, implementações equivalentes de criptografia de chave secreta podem ser de 1.000 a 10.000 vezes mais rápidas que as de chave pública.

Por isso, os sistemas híbridos usam os dois tipos em conjunto. A chave secreta cifra os dados em grande volume, que é a parte mais pesada. A chave pública cuida de tarefas menores, como distribuir com segurança a chave secreta usada na comunicação.

## Verificar se a mensagem foi alterada

A criptografia também ajuda a detectar modificações.

Segundo o NIST, um código de autenticação de mensagem, ou MAC, é calculado com uma chave secreta e anexado aos dados. Quem tem a mesma chave recalcula o código. Se ele for igual ao original, há confiança de que os dados não foram alterados.

Isso é importante porque uma pequena troca pode mudar completamente o sentido de uma informação. Segundo o manual do NIST, uma palavra como "faça" pode virar "não faça", e um valor de R$ 1.000 pode virar R$ 10.000.

## A gestão das chaves

Segundo o NIST, a segurança da criptografia depende diretamente da proteção das chaves. A gestão de chaves envolve a geração, a distribuição, o armazenamento, o uso e a destruição ou o arquivamento de cada uma delas.

Esse é o ponto mais difícil.

Nos sistemas de chave secreta, a chave precisa ser distribuída com segurança para cada parte.

Nos sistemas de chave pública, é preciso vincular o par de chaves a uma pessoa ou organização. Segundo o manual do NIST, isso é feito por uma autoridade certificadora, que confirma a identidade antes de certificar a chave pública.

Segundo o NIST, todas as chaves precisam de proteção contra alterações, e algumas também precisam ser mantidas em segredo.

## Autenticação de usuários

A criptografia também fortalece a autenticação de usuários. Segundo o manual do NIST, senhas costumam ser guardadas cifradas nos sistemas.

Além disso, em vez de enviar a senha pela rede, um sistema pode desafiar o usuário com um número aleatório cifrado. Só quem tem a chave correta consegue responder. Esse procedimento é chamado de aperto de mão criptográfico.

## Mitos sobre a criptografia

**"Se a mensagem está cifrada, ninguém consegue ler nada."** Parcialmente verdadeiro, mas enganoso. A criptografia protege o conteúdo, mas se a chave for descoberta ou mal guardada, a proteção deixa de existir.

**"A chave pública pode ser usada para decifrar qualquer coisa."** Mito. A chave pública cifra ou verifica assinaturas, enquanto a decifragem exige a chave privada correspondente.

**"Criptografia é só para espionagem."** Mito. Segundo o NIST, ela também garante integridade dos dados, autenticação e a impossibilidade de negar a autoria de uma mensagem.

## Perguntas frequentes

### A criptografia impede que alguém veja que eu enviei uma mensagem?

Não necessariamente. A criptografia protege o conteúdo, mas o texto cifrado pode revelar informações como o tamanho aproximado da mensagem.

### Por que as senhas são guardadas de forma cifrada?

Segundo o NIST, muitos sistemas guardam as senhas cifradas para protegê-las caso alguém tenha acesso ao sistema. Isso reduz o risco de divulgação.

## Resumindo

- A criptografia transforma uma mensagem legível em texto cifrado, que só pode ser lido com a chave certa.
- Na chave secreta, a mesma chave cifra e decifra. Na chave pública, há um par de chaves: uma pública e uma privada.
- A assinatura digital usa a chave privada do remetente e pode ser verificada com a chave pública.
- A criptografia de chave secreta é muito mais rápida, por isso os sistemas híbridos combinam os dois tipos.
- A segurança depende da proteção das chaves ao longo de toda a sua vida, da geração à destruição.

Veja também como [funciona o Wi-Fi](/como-funciona-o-wi-fi/) e [como funciona o Bluetooth](/como-funciona-o-bluetooth/), outros temas de tecnologia explicados de forma simples.

## Fontes

- NIST, Computer Security Resource Center, Key Management: https://csrc.nist.gov/projects/key-management
- NIST, CSRC Glossary, Public Key Cryptography (PKC): https://csrc.nist.gov/glossary/term/pkc
- NIST, Computer Security Handbook, capítulo de criptografia (rascunho, hospedado em universidade): https://securityv.iri.isu.edu/isl/hk_crypt.html
