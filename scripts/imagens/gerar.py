"""Gerador de imagens da marca Mente Curiosa (gratuito, roda local ou no n8n).

Cria, a partir do título e (opcional) de uma foto de fundo:
  public/images/<slug>/<slug>.webp        1200×675  capa do artigo / Open Graph / Facebook
  public/images/<slug>/<nome>.webp        1200×800  fotos do corpo do artigo (foto_corpo)
  public/social/<slug>/pin-1.jpg … pin-5.jpg  1000×1500 Pins do Pinterest (um ângulo por Pin)
  public/social/<slug>/facebook.jpg       1200×675  post da fan page (JPEG: aceito por Facebook/Pinterest/n8n)

Uso:
  python3 scripts/imagens/gerar.py --slug por-que-o-ceu-e-azul \
      --titulo "Por que o céu é azul?" --categoria "Ciência e fenômenos" \
      [--fundo foto.jpg] [--credito "Foto: Fulano / Pexels"] [--sem-pins]

A foto de fundo vem de banco gratuito (Pexels/Pixabay) ou de IA gratuita — ver IMAGENS.md.
Sem foto, usa o fundo da marca (azul-noite com estrelas).
"""
import argparse, os, random, textwrap
from PIL import Image, ImageDraw, ImageFilter, ImageFont, ImageOps

AQUI = os.path.dirname(os.path.abspath(__file__))
RAIZ = os.path.abspath(os.path.join(AQUI, '..', '..'))
FONT = lambda peso, tam: ImageFont.truetype(os.path.join(AQUI, 'fonts', f'Poppins-{peso}.ttf'), tam)
LOGO = os.path.join(RAIZ, 'public', 'brand', 'logo-circulo-400.png')

NAVY = (3, 20, 36)
NAVY2 = (13, 44, 70)
GOLD = (232, 170, 59)
WHITE = (255, 255, 255)
SOFT = (201, 211, 222)

ANGULOS_PADRAO = [
    'A resposta simples',
    'Você sabia?',
    'Mito ou verdade?',
    'Em 3 pontos',
    'O que a ciência diz',
]


def fundo_marca(w, h, seed):
    """Azul-noite com gradiente e estrelas, como no logo."""
    rnd = random.Random(seed)
    img = Image.new('RGB', (w, h), NAVY)
    d = ImageDraw.Draw(img)
    for y in range(h):
        t = y / h
        d.line([(0, y), (w, y)], fill=tuple(int(NAVY2[i] * (1 - t) + NAVY[i] * t) for i in range(3)))
    for _ in range(int(w * h / 9000)):
        x, y, r = rnd.randrange(w), rnd.randrange(h), rnd.choice([1, 1, 1, 2])
        a = rnd.randint(90, 220)
        d.ellipse([x, y, x + r, y + r], fill=(a, a, min(255, a + 20)))
    return img


def fundo_foto(path, w, h):
    img = Image.open(path).convert('RGB')
    return ImageOps.fit(img, (w, h), Image.LANCZOS, centering=(0.5, 0.45))


def escurecer(img, de=0.0, ate=0.85, inicio=0.0):
    """Gradiente azul-noite por cima da foto para o texto ficar legível."""
    w, h = img.size
    over = Image.new('RGBA', (w, h))
    d = ImageDraw.Draw(over)
    for y in range(h):
        t = max(0.0, (y / h - inicio) / (1 - inicio)) if inicio < 1 else 0
        a = int(255 * (de + (ate - de) * t))
        d.line([(0, y), (w, y)], fill=NAVY + (a,))
    return Image.alpha_composite(img.convert('RGBA'), over)


def quebrar(draw, texto, fonte, largura):
    linhas, atual = [], ''
    for palavra in texto.split():
        teste = f'{atual} {palavra}'.strip()
        if draw.textlength(teste, font=fonte) <= largura:
            atual = teste
        else:
            if atual:
                linhas.append(atual)
            atual = palavra
    if atual:
        linhas.append(atual)
    return linhas


def texto_ajustado(draw, texto, peso, largura, max_linhas, tam_max, tam_min=28):
    """Maior fonte em que o texto cabe em `max_linhas` linhas."""
    for tam in range(tam_max, tam_min - 1, -2):
        f = FONT(peso, tam)
        linhas = quebrar(draw, texto, f, largura)
        if len(linhas) <= max_linhas:
            return f, linhas
    f = FONT(peso, tam_min)
    return f, quebrar(draw, texto, f, largura)[:max_linhas]


def colar_logo(img, tam, x, y):
    if os.path.exists(LOGO):
        logo = Image.open(LOGO).convert('RGBA').resize((tam, tam), Image.LANCZOS)
        img.alpha_composite(logo, (x, y))


def capa(slug, titulo, categoria, fundo=None, credito=None):
    W, H = 1200, 675
    base = fundo_foto(fundo, W, H) if fundo else fundo_marca(W, H, slug)
    img = escurecer(base, 0.15 if fundo else 0.0, 0.92 if fundo else 0.35, 0.25 if fundo else 0.0)
    d = ImageDraw.Draw(img)
    m = 64
    colar_logo(img, 88, W - m - 88, m - 16)
    f, linhas = texto_ajustado(d, titulo, 'Bold', W - 2 * m, 3, 64, 40)
    lh = int(f.size * 1.18)
    y = H - 96 - lh * len(linhas)          # bloco do título termina acima do rodapé
    d.text((m, y - 62), categoria.upper(), font=FONT('Bold', 24), fill=GOLD)
    d.rectangle([m, y - 24, m + 72, y - 18], fill=GOLD)
    for l in linhas:
        d.text((m, y), l, font=f, fill=WHITE)
        y += lh
    d.text((m, H - 44), 'mentecuriosa.blog', font=FONT('Medium', 20), fill=SOFT)
    if credito:
        fc = FONT('Regular', 16)
        d.text((W - m - d.textlength(credito, font=fc), H - 40), credito, font=fc, fill=SOFT)
    out = os.path.join(RAIZ, 'public', 'images', slug, f'{slug}.webp')  # nome descritivo = SEO de imagem
    os.makedirs(os.path.dirname(out), exist_ok=True)
    img.convert('RGB').save(out, 'WEBP', quality=82, method=6)
    fb = os.path.join(RAIZ, 'public', 'social', slug, 'facebook.jpg')
    os.makedirs(os.path.dirname(fb), exist_ok=True)
    img.convert('RGB').save(fb, 'JPEG', quality=86, optimize=True, progressive=True)
    return out


def foto_corpo(slug, fundo, nome, W=1200, H=800):
    """Foto do corpo do artigo: recorte 3:2, WebP leve, sem texto por cima (o texto fica no alt/legenda)."""
    img = ImageOps.fit(Image.open(fundo).convert('RGB'), (W, H), Image.LANCZOS, centering=(0.5, 0.5))
    out = os.path.join(RAIZ, 'public', 'images', slug, f'{nome}.webp')
    os.makedirs(os.path.dirname(out), exist_ok=True)
    img.save(out, 'WEBP', quality=80, method=6)
    return out, W, H


def pin(slug, titulo, categoria, angulo, n, fundo=None, credito=None):
    W, H = 1000, 1500
    topo_h = 860
    img = Image.new('RGBA', (W, H), NAVY + (255,))
    base = fundo_foto(fundo, W, topo_h) if fundo else fundo_marca(W, topo_h, f'{slug}-{n}')
    img.paste(escurecer(base, 0.0, 0.55, 0.4), (0, 0))
    d = ImageDraw.Draw(img)
    m = 70
    d.rectangle([0, topo_h - 4, W, topo_h], fill=GOLD)
    colar_logo(img, 120, (W - 120) // 2, topo_h - 60)
    f_ang = FONT('Bold', 44)
    d.text((W // 2, topo_h + 100), angulo.upper(), font=f_ang, fill=GOLD, anchor='mm')
    f, linhas = texto_ajustado(d, titulo, 'Bold', W - 2 * m, 4, 76, 44)
    lh = int(f.size * 1.2)
    area_ini, area_fim = topo_h + 150, H - 150   # centraliza o título entre o ângulo e o rodapé
    y = area_ini + (area_fim - area_ini - lh * len(linhas)) // 2
    for l in linhas:
        d.text((W // 2, y), l, font=f, fill=WHITE, anchor='ma')
        y += lh
    d.text((W // 2, H - 110), categoria, font=FONT('Medium', 28), fill=SOFT, anchor='mm')
    d.text((W // 2, H - 62), 'Leia em mentecuriosa.blog', font=FONT('Bold', 30), fill=GOLD, anchor='mm')
    if credito:
        d.text((W - 24, topo_h - 24), credito, font=FONT('Regular', 18), fill=SOFT, anchor='rd')
    out = os.path.join(RAIZ, 'public', 'social', slug, f'pin-{n}.jpg')
    os.makedirs(os.path.dirname(out), exist_ok=True)
    img.convert('RGB').save(out, 'JPEG', quality=86, optimize=True, progressive=True)
    return out


if __name__ == '__main__':
    p = argparse.ArgumentParser()
    p.add_argument('--slug', required=True)
    p.add_argument('--titulo', required=True)
    p.add_argument('--categoria', required=True)
    p.add_argument('--fundo')
    p.add_argument('--credito')
    p.add_argument('--angulos', help='5 ângulos separados por |')
    p.add_argument('--sem-pins', action='store_true')
    a = p.parse_args()
    print(capa(a.slug, a.titulo, a.categoria, a.fundo, a.credito))
    if not a.sem_pins:
        angulos = a.angulos.split('|') if a.angulos else ANGULOS_PADRAO
        for i, ang in enumerate(angulos[:5], 1):
            print(pin(a.slug, a.titulo, a.categoria, ang, i, a.fundo, a.credito))
