# Imagens — padrão SEO, fontes gratuitas e gerador da marca

## Padrão de imagem com SEO (todo artigo)

| Item | Regra | Quem garante |
|---|---|---|
| Capa | 1200×675 WebP, arquivo `/images/<slug>/<slug>.webp`, título + marca | gerador |
| Fotos no corpo | 1 a 3 (mín. 1; 2 se o artigo tiver ≥ 1200 palavras), 1200×800 WebP, uma por seção relevante | auditoria I02/I05 |
| Nome do arquivo | descritivo, vem do alt (`por-do-sol-alaranjado-horizonte.webp`), nunca `capa.webp`/`img1.webp` | gerador + I03 |
| Alt | português, descreve o que **aparece** na foto (≥ 25 caracteres) — conferido olhando a foto depois de gerada; sem “imagem de”; keyword só se couber natural | schema + I01 + revisão |
| Legenda | explica a relação da foto com o texto (é o texto mais lido da página depois do título) | schema |
| Crédito e licença | autor, fonte, link da foto e da licença em toda imagem | schema + I04 |
| Performance | `width`/`height` (sem CLS), capa com `fetchpriority=high`, corpo com `loading=lazy` | template |
| Google Imagens | ImageObject com creditText/license/acquireLicensePage + sitemap de imagens | template |
| Repetição | a mesma foto nunca aparece duas vezes no artigo | gerador + schema |

No frontmatter as fotos do corpo ficam em `images` (a posição é `section`: a foto entra no fim da seção H2 nº N):

```yaml
images:
  - src: /images/por-que-o-ceu-e-azul/por-do-sol-alaranjado-horizonte.webp
    alt: "Pôr do sol alaranjado sobre o horizonte do mar"
    caption: "No fim da tarde a luz atravessa mais ar e o azul se perde"
    section: 4
    width: 1200
    height: 800
    credit: { author: "Nome", source: Pexels, url: https://www.pexels.com/photo/..., license: "Licença Pexels", licenseUrl: https://www.pexels.com/license/ }
```

Não precisa escrever isso à mão. **Regra automática:** o artigo sobe com o bloco `imagensPlano`
(ver ARTIGO_FORMATO.md) e o workflow **Imagens automáticas** roda sozinho no push: busca as fotos, gera os
arquivos, preenche o frontmatter, apaga o plano e publica. Sem capa o artigo não vai ao ar.

Para refazer as imagens de um artigo já publicado, use o workflow manual **Imagens do artigo**. Entradas:

- `slug` · `capa_busca` (inglês) · `capa_alt` (português)
- `fotos`: `busca | alt | legenda | seção`, várias separadas por `;;`

Localmente: `python3 scripts/imagens/imagens_artigo.py --slug … --capa-busca … --capa-alt … --foto "busca | alt | legenda | 4"`.

Toda imagem sai do gerador `scripts/imagens/gerar.py` (capa 1200×675 com logo, cores e título; 5 Pins 1000×1500; fotos do corpo 1200×800). A foto de fundo vem de uma das fontes abaixo — ou nenhuma (fundo da marca).

## Ordem de busca por cluster

| Cluster | 1ª opção | 2ª | 3ª |
|---|---|---|---|
| Universo e espaço | NASA Image Library | Pexels | IA |
| Animais · Corpo humano · Ciência e fenômenos | Pexels | Pixabay | Openverse |
| Psicologia · Tecnologia/IA (temas abstratos) | IA | Pexels | fundo da marca |

## Bancos de imagens (grátis, uso comercial)

| API | Chave | Limite gratuito | Regras que importam |
|---|---|---|---|
| **Pexels** | `PEXELS_API_KEY` | 200 req/hora, 20.000/mês | Creditar fotógrafo + link Pexels |
| **Pixabay** | `PIXABAY_API_KEY` | 100 req/minuto | Baixar a imagem (não usar link direto); guardar resultados de busca por 24h |
| **NASA Image and Video Library** | não precisa | — | Maioria em domínio público; não usar logos da NASA nem sugerir endosso |
| **Openverse** (WordPress) | não precisa | limite anônimo | Só aceitar CC0 ou CC BY (creditar) |
| Unsplash | `UNSPLASH_ACCESS_KEY` | 50 req/hora (demo) | Exige exibir a imagem pelo servidor deles → não combina com nosso /images; usar só em último caso |

## IA gratuita (quando não houver foto boa)

| Serviço | Chave | Limite | Observação |
|---|---|---|---|
| **Cloudflare Workers AI** (FLUX.1 schnell) | `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_API_TOKEN` | 10.000 neurons/dia grátis | Principal opção de IA |
| Pollinations | não precisa | sem garantia | Reserva; qualidade e disponibilidade variam |

Regras para IA: nada de pessoas reais, marcas, logos ou texto dentro da imagem (o texto vem do template).
Imagem de IA é registrada com `source: IA`.

## Registro de licença (obrigatório)

Cada artigo com foto preenche no frontmatter:

```yaml
imageCredit:
  author: "Nome do fotógrafo"
  source: Pexels          # Pexels · Pixabay · Unsplash · NASA · Openverse · IA · Próprio
  url: https://www.pexels.com/photo/...
  license: "Licença Pexels"
```

O crédito aparece abaixo da capa, e a mesma informação vai para o banco editorial.

## Chaves

Nunca no código nem no chat. Cadastrar como credencial no n8n e/ou variável de ambiente
(os nomes acima). O gerador e os fluxos só leem os nomes.

## Comando

```
python3 scripts/imagens/gerar.py --slug <slug> --titulo "<título>" --categoria "<categoria>" \
    [--fundo foto.jpg] [--credito "Foto: Nome / Pexels"]
```
Requer Python 3 + Pillow.

## Peças para as redes (Facebook e Pinterest via n8n)

O gerador também publica, em `public/social/<slug>/`:

- `facebook.jpg` — 1200×675, post da fan page;
- `pin-1.jpg` … `pin-5.jpg` — 1000×1500, um ângulo por Pin (resposta simples, você sabia?, mito ou verdade?, em 3 pontos, o que a ciência diz).

O n8n lê essas peças prontas em dois lugares (use um deles):

- **`/social.json`** — por artigo: imagem + texto da fan page, 5 Pins com título, descrição, alt, pasta (categoria) e link com UTM;
- **`/feed.xml`** — RSS com `enclosure` (imagem do Facebook) e `media:content` (capa + Pins).

Quando publicar (regra dos 60 dias, ordem dos ângulos) fica na aba FILA_DISTRIBUICAO do banco editorial.
