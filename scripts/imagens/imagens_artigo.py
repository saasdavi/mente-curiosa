"""Imagens com SEO para UM artigo: capa + Pins + fotos no corpo, todas com foto gratuita e crédito.

Uso:
  python3 scripts/imagens/imagens_artigo.py --slug por-que-o-ceu-e-azul \
      --capa-busca "blue sky clouds" --capa-alt "Céu azul com nuvens brancas em dia claro" \
      --foto "sunset orange sky | Pôr do sol alaranjado sobre o horizonte | O pôr do sol fica laranja porque a luz atravessa mais ar | 4" \
      --foto "distant blue mountains | Montanhas distantes com tom azulado | O ar entre você e a montanha também espalha luz azul | 5"

--foto  "busca em inglês | alt em português | legenda | seção"   (repetível; seção = nº do H2 ao fim do qual a foto entra)
--sem-capa  mantém a capa atual e só troca as fotos do corpo.
--fontes    ordem das fontes grátis (padrão pexels,nasa,openverse).

Regras de SEO aplicadas (ver IMAGENS.md):
  - nome de arquivo descritivo (vem do alt), WebP leve, largura/altura gravadas no frontmatter;
  - alt descritivo em português, legenda útil, crédito e licença rastreáveis;
  - a mesma foto nunca se repete no artigo; arquivos que deixaram de ser usados são apagados.
"""
import argparse, os, re, sys, unicodedata
import yaml

AQUI = os.path.dirname(os.path.abspath(__file__))
RAIZ = os.path.abspath(os.path.join(AQUI, '..', '..'))
sys.path.insert(0, AQUI)
import buscar as buscador  # noqa: E402
import gerar  # noqa: E402

CATEGORIAS = {
    'psicologia-e-comportamento': 'Psicologia e comportamento',
    'corpo-humano': 'Corpo humano',
    'universo-e-espaco': 'Universo e espaço',
    'animais': 'Animais',
    'ciencia-e-fenomenos': 'Ciência e fenômenos',
    'tecnologia-ia-e-ciencia': 'Tecnologia, IA e ciência',
}
VAZIAS = set('a o e de do da dos das um uma com em no na para por que sobre'.split())


def slugify(s, max_palavras=7):
    s = unicodedata.normalize('NFD', s.lower()).encode('ascii', 'ignore').decode()
    ps = [p for p in re.split(r'[^a-z0-9]+', s) if p and p not in VAZIAS]
    return '-'.join(ps[:max_palavras])[:60].strip('-') or 'foto'


def credito(r):
    c = {k: r[k] for k in ('author', 'source', 'url', 'license') if r.get(k)}
    if r.get('licenseUrl'):
        c['licenseUrl'] = r['licenseUrl']
    return c


def ler(caminho):
    txt = open(caminho, encoding='utf-8').read()
    m = re.match(r'^---\n(.*?)\n---\n', txt, re.S)
    return yaml.safe_load(m.group(1)), txt[m.end():]


def gravar(caminho, fm, corpo):
    y = yaml.safe_dump(fm, allow_unicode=True, sort_keys=False, width=1000)
    open(caminho, 'w', encoding='utf-8').write(f'---\n{y}---\n{corpo}')


def main():
    p = argparse.ArgumentParser()
    p.add_argument('--slug', required=True)
    p.add_argument('--capa-busca', default='')
    p.add_argument('--capa-alt', default='')
    p.add_argument('--sem-capa', action='store_true')
    p.add_argument('--foto', action='append', default=[])
    p.add_argument('--fontes', default='pexels,nasa,openverse')
    a = p.parse_args()
    fontes = [f.strip() for f in a.fontes.split(',') if f.strip()]

    caminho = os.path.join(RAIZ, 'src', 'content', 'artigos', f'{a.slug}.md')
    if not os.path.exists(caminho):
        sys.exit(f'artigo não encontrado: {caminho}')
    fm, corpo = ler(caminho)
    n_h2 = len(re.findall(r'^## ', corpo, re.M))
    usadas = set()
    if fm.get('imageCredit', {}).get('url') and a.sem_capa:
        usadas.add(fm['imageCredit']['url'])

    # --- Capa + Pins ---
    if not a.sem_capa:
        if not (a.capa_busca and a.capa_alt):
            sys.exit('capa: informe --capa-busca e --capa-alt (ou use --sem-capa)')
        r = buscador.buscar(a.capa_busca, fontes, '/tmp/capa.jpg', usadas)
        if not r:
            sys.exit('capa: nenhuma fonte encontrou imagem')
        usadas.add(r['url'])
        txt = f"Foto: {r['author']} / {r['source']}"
        gerar.capa(a.slug, fm['title'], CATEGORIAS[fm['category']], r['arquivo'], txt)
        for i, ang in enumerate(gerar.ANGULOS_PADRAO, 1):
            gerar.pin(a.slug, fm['title'], CATEGORIAS[fm['category']], ang, i, r['arquivo'], txt)
        fm['featuredImage'] = f'/images/{a.slug}/{a.slug}.webp'
        fm['featuredImageAlt'] = a.capa_alt
        fm['imageCredit'] = credito(r)

    # --- Fotos do corpo ---
    if a.foto:
        imagens, nomes = [], set()
        for i, linha in enumerate(a.foto, 1):
            partes = [x.strip() for x in linha.split('|')]
            if len(partes) != 4:
                sys.exit(f'--foto {i}: use "busca | alt | legenda | seção"')
            busca, alt, legenda, secao = partes
            secao = int(secao)
            if not 1 <= secao <= n_h2:
                sys.exit(f'--foto {i}: seção {secao} não existe (o artigo tem {n_h2} H2)')
            if len(alt) < 25:
                sys.exit(f'--foto {i}: alt curto demais — descreva o que aparece na foto (≥ 25 caracteres)')
            r = buscador.buscar(busca, fontes, f'/tmp/foto-{i}.jpg', usadas)
            if not r:
                sys.exit(f'--foto {i}: nenhuma fonte encontrou imagem para "{busca}"')
            usadas.add(r['url'])
            nome = slugify(alt)
            while nome in nomes or nome == a.slug:
                nome += f'-{i}'
            nomes.add(nome)
            _, w, h = gerar.foto_corpo(a.slug, r['arquivo'], nome)
            imagens.append({'src': f'/images/{a.slug}/{nome}.webp', 'alt': alt, 'caption': legenda,
                            'section': secao, 'width': w, 'height': h, 'credit': credito(r)})
        fm['images'] = imagens

    # Remove arquivos do artigo que não são mais usados (capa antiga, fotos trocadas).
    pasta = os.path.join(RAIZ, 'public', 'images', a.slug)
    em_uso = {fm['featuredImage']} | {im['src'] for im in fm.get('images', [])}
    for f in os.listdir(pasta):
        if f'/images/{a.slug}/{f}' not in em_uso:
            os.remove(os.path.join(pasta, f))
            print('removido:', f)

    gravar(caminho, fm, corpo)
    print(yaml.safe_dump({k: fm.get(k) for k in ('featuredImage', 'featuredImageAlt', 'imageCredit', 'images')},
                         allow_unicode=True, sort_keys=False, width=1000))


if __name__ == '__main__':
    main()
