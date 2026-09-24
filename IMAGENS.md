# Imagens — fontes gratuitas e gerador da marca

Toda imagem sai do gerador `scripts/imagens/gerar.py` (capa 1200×675 + 5 Pins 1000×1500, com logo,
cores e título). A foto de fundo vem de uma das fontes abaixo — ou nenhuma (fundo da marca).

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
Requer Python 3 + Pillow. Pins saem em `social/<slug>/` (fora do site).
