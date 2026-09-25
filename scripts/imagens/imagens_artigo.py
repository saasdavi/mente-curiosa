"""Imagens com SEO para UM artigo: capa + Pins + fotos no corpo, todas com foto gratuita e crédito.

Uso:
  python3 scripts/imagens/imagens_artigo.py --slug por-que-o-ceu-e-azul \
      --capa-busca "blue sky clouds" --capa-alt "Céu azul com nuvens brancas em dia claro" \
      --foto "sunset orange sky | Pôr do sol alaranjado sobre o horizonte | O pôr do sol fica laranja porque a luz atravessa mais ar | 4" \
      --foto "distant blue mountains | Montanhas distantes com tom azulado | O ar entre você e a montanha também espalha luz azul | 5"

--foto  "busca em inglês | alt em português | legenda | seção"   (repetível; seção = nº do H2 ao fim do qual a foto entra)
--sem-capa  mantém a capa atual e só troca as fotos do corpo.
--pendentes processa todo artigo que tenha o bloco imagensPlano (usado pela automação no push).
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


def resumo(linha):
    """Relatório para conferir o alt (vai para o resumo do GitHub Actions)."""
    print(linha)
    if os.environ.get('GITHUB_STEP_SUMMARY'):
        with open(os.environ['GITHUB_STEP_SUMMARY'], 'a', encoding='utf-8') as f:
            f.write(linha + '\n')


def processar(slug, capa=None, fotos=(), fontes=('pexels', 'nasa', 'openverse'), caminho=None):
    """capa = (busca, alt) ou None para manter a atual; fotos = [(busca, alt, legenda, seção), ...]."""
    caminho = caminho or os.path.join(RAIZ, 'src', 'content', 'artigos', f'{slug}.md')
    if not os.path.exists(caminho):
        sys.exit(f'artigo não encontrado: {caminho}')
    fm, corpo = ler(caminho)
    n_h2 = len(re.findall(r'^## ', corpo, re.M))
    usadas = set()
    if not capa:
        if not fm.get('featuredImage'):
            sys.exit(f'{slug}: sem capa — informe a busca e o alt da capa')
        if fm.get('imageCredit', {}).get('url'):
            usadas.add(fm['imageCredit']['url'])
    resumo(f'\n### {slug}\n\n| Imagem | Alt escrito | O que a fonte diz da foto | Link |\n|---|---|---|---|')

    # --- Capa + Pins ---
    if capa:
        busca, alt = capa
        if len(alt) < 25:
            sys.exit(f'{slug}: alt da capa curto demais (≥ 25 caracteres)')
        r = buscador.buscar(busca, fontes, '/tmp/capa.jpg', usadas)
        if not r:
            sys.exit(f'{slug}: capa — nenhuma fonte encontrou imagem para "{busca}"')
        usadas.add(r['url'])
        txt = f"Foto: {r['author']} / {r['source']}"
        gerar.capa(slug, fm['title'], CATEGORIAS[fm['category']], r['arquivo'], txt)
        for i, ang in enumerate(gerar.ANGULOS_PADRAO, 1):
            gerar.pin(slug, fm['title'], CATEGORIAS[fm['category']], ang, i, r['arquivo'], txt)
        fm['featuredImage'] = f'/images/{slug}/{slug}.webp'
        fm['featuredImageAlt'] = alt
        fm['imageCredit'] = credito(r)
        resumo(f"| capa | {alt} | {r.get('descricao', '')} | {r['url']} |")

    # --- Fotos do corpo ---
    if fotos:
        imagens, nomes = [], set()
        for i, (busca, alt, legenda, secao) in enumerate(fotos, 1):
            secao = int(secao)
            if not 1 <= secao <= n_h2:
                sys.exit(f'{slug}: foto {i} — seção {secao} não existe (o artigo tem {n_h2} H2)')
            if len(alt) < 25:
                sys.exit(f'{slug}: foto {i} — alt curto demais, descreva o que aparece (≥ 25 caracteres)')
            r = buscador.buscar(busca, fontes, f'/tmp/foto-{i}.jpg', usadas)
            if not r:
                sys.exit(f'{slug}: foto {i} — nenhuma fonte encontrou imagem para "{busca}"')
            usadas.add(r['url'])
            nome = slugify(alt)
            while nome in nomes or nome == slug:
                nome += f'-{i}'
            nomes.add(nome)
            _, w, h = gerar.foto_corpo(slug, r['arquivo'], nome)
            imagens.append({'src': f'/images/{slug}/{nome}.webp', 'alt': alt, 'caption': legenda,
                            'section': secao, 'width': w, 'height': h, 'credit': credito(r)})
            resumo(f"| foto {i} | {alt} | {r.get('descricao', '')} | {r['url']} |")
        fm['images'] = imagens

    # Remove arquivos do artigo que não são mais usados (capa antiga, fotos trocadas).
    pasta = os.path.join(RAIZ, 'public', 'images', slug)
    os.makedirs(pasta, exist_ok=True)
    em_uso = {fm['featuredImage']} | {im['src'] for im in fm.get('images', [])}
    for f in os.listdir(pasta):
        if f'/images/{slug}/{f}' not in em_uso:
            os.remove(os.path.join(pasta, f))
            print('removido:', f)

    # O plano já foi executado; o alt foi escrito sem ver a foto → fica pendente de conferência.
    fm.pop('imagensPlano', None)
    fm['altConferido'] = False
    gravar(caminho, fm, corpo)


def pendentes():
    """Artigos com imagensPlano no frontmatter (escritos e ainda sem imagens)."""
    pasta = os.path.join(RAIZ, 'src', 'content', 'artigos')
    for f in sorted(os.listdir(pasta)):
        if f.endswith('.md'):
            fm, _ = ler(os.path.join(pasta, f))
            if fm.get('imagensPlano'):
                yield fm['slug'], fm['imagensPlano'], os.path.join(pasta, f)


def main():
    p = argparse.ArgumentParser()
    p.add_argument('--slug')
    p.add_argument('--pendentes', action='store_true', help='processa todo artigo com imagensPlano')
    p.add_argument('--capa-busca', default='')
    p.add_argument('--capa-alt', default='')
    p.add_argument('--sem-capa', action='store_true')
    p.add_argument('--foto', action='append', default=[])
    p.add_argument('--fontes', default='pexels,nasa,openverse')
    a = p.parse_args()
    fontes = [f.strip() for f in a.fontes.split(',') if f.strip()]

    if a.pendentes:
        feitos = 0
        for slug, plano, caminho in pendentes():
            c = plano.get('capa')
            capa = (c['busca'], c['alt']) if c else None
            fotos = [(x['busca'], x['alt'], x['legenda'], x['secao']) for x in plano.get('fotos', [])]
            processar(slug, capa, fotos, fontes, caminho)
            feitos += 1
        print(f'{feitos} artigo(s) processado(s)')
        return

    if not a.slug:
        sys.exit('informe --slug ou --pendentes')
    if not a.sem_capa and not (a.capa_busca and a.capa_alt):
        sys.exit('capa: informe --capa-busca e --capa-alt (ou use --sem-capa)')
    fotos = []
    for i, linha in enumerate(a.foto, 1):
        partes = [x.strip() for x in linha.split('|')]
        if len(partes) != 4:
            sys.exit(f'--foto {i}: use "busca | alt | legenda | seção"')
        fotos.append(tuple(partes))
    processar(a.slug, None if a.sem_capa else (a.capa_busca, a.capa_alt), fotos, fontes)


if __name__ == '__main__':
    main()
