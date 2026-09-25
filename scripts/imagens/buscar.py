"""Busca uma foto gratuita para fundo de capa e devolve o arquivo + crédito/licença.

Fontes (na ordem pedida, cai para a próxima se não achar):
  pexels    — precisa de PEXELS_API_KEY no ambiente
  nasa      — NASA Image and Video Library, sem chave (domínio público, na maioria)
  openverse — Openverse, sem chave; só CC0, domínio público ou CC BY (com crédito)

Uso: python3 scripts/imagens/buscar.py "blue sky clouds" --fontes pexels,nasa,openverse --saida /tmp/fundo.jpg
Imprime JSON: {"arquivo", "author", "source", "url", "license", "licenseUrl", "descricao"}
"""
import argparse, json, os, sys, urllib.parse, urllib.request

UA = {'User-Agent': 'MenteCuriosaBot/1.0 (+https://www.mentecuriosa.blog)'}


def get_json(url, headers=None):
    req = urllib.request.Request(url, headers={**UA, **(headers or {})})
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.load(r)


def baixar(url, destino):
    req = urllib.request.Request(url, headers=UA)
    with urllib.request.urlopen(req, timeout=60) as r, open(destino, 'wb') as f:
        f.write(r.read())
    return destino


def pexels(q, evitar=()):
    key = os.environ.get('PEXELS_API_KEY')
    if not key:
        print('pexels: PEXELS_API_KEY não definida, pulando', file=sys.stderr)
        return None
    qs = urllib.parse.urlencode({'query': q, 'orientation': 'landscape', 'size': 'large', 'per_page': 5})
    fotos = get_json(f'https://api.pexels.com/v1/search?{qs}', {'Authorization': key}).get('photos', [])
    for p in fotos:
        if p['url'] in evitar:
            continue
        return {'img': p['src'].get('large2x') or p['src']['original'], 'author': p['photographer'],
                'source': 'Pexels', 'url': p['url'], 'license': 'Licença Pexels',
                'licenseUrl': 'https://www.pexels.com/license/', 'descricao': p.get('alt') or ''}
    return None


def nasa(q, evitar=()):
    qs = urllib.parse.urlencode({'q': q, 'media_type': 'image'})
    itens = get_json(f'https://images-api.nasa.gov/search?{qs}')['collection']['items']
    for it in itens[:10]:
        meta = it['data'][0]
        if f"https://images.nasa.gov/details/{meta['nasa_id']}" in evitar:
            continue
        arquivos = get_json(it['href'])  # lista de tamanhos da mesma imagem
        grandes = [a for a in arquivos if a.endswith(('~large.jpg', '~orig.jpg', '~medium.jpg'))]
        if not grandes:
            continue
        img = sorted(grandes, key=lambda a: ('~large' not in a, '~orig' not in a))[0]
        autor = meta.get('photographer') or meta.get('secondary_creator') or 'NASA'
        return {'img': img.replace('http://', 'https://'), 'author': f"{autor} / NASA" if autor != 'NASA' else 'NASA',
                'source': 'NASA', 'url': f"https://images.nasa.gov/details/{meta['nasa_id']}",
                'license': 'Domínio público (NASA)',
                'licenseUrl': 'https://www.nasa.gov/nasa-brand-center/images-and-media/',
                'descricao': meta.get('title') or ''}
    return None


def openverse(q, evitar=()):
    qs = urllib.parse.urlencode({'q': q, 'license': 'cc0,pdm,by', 'aspect_ratio': 'wide', 'page_size': 5})
    res = get_json(f'https://api.openverse.org/v1/images/?{qs}').get('results', [])
    for r in res:
        pagina = r.get('foreign_landing_url') or r['url']
        if pagina in evitar:
            continue
        lic = f"{r['license'].upper()} {r.get('license_version') or ''}".strip()
        return {'img': r['url'], 'author': r.get('creator') or 'Autor desconhecido', 'source': 'Openverse',
                'url': pagina, 'license': lic, 'licenseUrl': r.get('license_url') or '',
                'descricao': r.get('title') or ''}
    return None


FONTES = {'pexels': pexels, 'nasa': nasa, 'openverse': openverse}


def buscar(q, fontes, saida, evitar=()):
    """evitar: URLs de páginas de fotos já usadas no artigo (não repetir a mesma foto)."""
    for nome in fontes:
        try:
            achado = FONTES[nome](q, evitar)
        except Exception as e:  # uma fonte fora do ar não derruba as outras
            print(f'{nome}: erro {e}', file=sys.stderr)
            continue
        if achado:
            baixar(achado.pop('img'), saida)
            return {'arquivo': saida, **achado}
        print(f'{nome}: nada encontrado para "{q}"', file=sys.stderr)
    return None


if __name__ == '__main__':
    p = argparse.ArgumentParser()
    p.add_argument('busca')
    p.add_argument('--fontes', default='pexels,nasa,openverse')
    p.add_argument('--saida', default='/tmp/fundo.jpg')
    a = p.parse_args()
    r = buscar(a.busca, [f.strip() for f in a.fontes.split(',') if f.strip()], a.saida)
    if not r:
        sys.exit('nenhuma fonte encontrou imagem')
    print(json.dumps(r, ensure_ascii=False))
