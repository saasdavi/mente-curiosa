"""Publica um artigo pronto (escrito fora do workflow) e atualiza o calendário.

Uso:
  python scripts/publicar_artigo.py              # próximo pronto na ordem do calendário
  python scripts/publicar_artigo.py --arquivo X.md

Sem IA de texto. As imagens (capa e fotos do corpo) vêm da API da Pexels, pelos termos
de imagensPlano. Depois de gravar o artigo, o arquivo original vai para PUBLICADOS/ e a
linha correspondente no calendário passa a PUBLICADO.

Sai com código 0 e sem publicar quando não há artigo pronto na fila.
"""

import argparse
import datetime
import os
import re
import shutil
import sys
from io import BytesIO

import requests
import yaml
from PIL import Image

PRONTOS_DIR = "dados/entrada/pautas-chat_01/GPT ARTIGOS PRONTOS"
PUBLICADOS_DIR = os.path.join(PRONTOS_DIR, "PUBLICADOS")
ARTIGO_DIR = "src/content/artigos"
IMAGENS_DIR = "public/images"
CALENDARIO = "dados/calendario_editorial.md"
CATEGORIAS_TS = "src/config/categories.ts"
# Ordem de tentativa para cada imagem: a primeira fonte com foto livre ainda não usada no artigo ganha.
FONTES = ["Pexels", "Pixabay", "Unsplash"]
LICENCAS = {
    "Pexels": {"license": "Licença Pexels", "licenseUrl": "https://www.pexels.com/license/"},
    "Pixabay": {"license": "Licença Pixabay", "licenseUrl": "https://pixabay.com/service/license-summary/"},
    "Unsplash": {"license": "Licença Unsplash", "licenseUrl": "https://unsplash.com/license"},
}


class FalhaPublicacao(Exception):
    pass


def categorias_validas():
    texto = open(CATEGORIAS_TS, encoding="utf-8").read()
    return set(re.findall(r"slug:\s*'([^']+)'", texto))


def le_artigo(caminho):
    texto = open(caminho, encoding="utf-8").read()
    if not texto.startswith("---"):
        raise FalhaPublicacao(f"{caminho}: sem frontmatter")
    _, fm_texto, corpo = texto.split("---", 2)
    fm = yaml.safe_load(fm_texto)
    return fm, corpo.lstrip("\n")


def valida(fm, caminho):
    faltando = [c for c in ("id", "slug", "title", "description", "category", "tags",
                            "keyword", "datePublished", "imagensPlano", "sources") if not fm.get(c)]
    if faltando:
        raise FalhaPublicacao(f"{caminho}: faltam campos {faltando}")
    if not re.fullmatch(r"ART\d{4}", str(fm["id"])):
        raise FalhaPublicacao(f"{caminho}: id deve ser ARTxxxx")
    if fm["category"] not in categorias_validas():
        raise FalhaPublicacao(f"{caminho}: categoria '{fm['category']}' não existe")
    plano = fm["imagensPlano"]
    if not plano.get("capa") or not plano.get("fotos"):
        raise FalhaPublicacao(f"{caminho}: imagensPlano precisa de capa e de ao menos 1 foto")
    if len(plano["fotos"]) > 3:
        raise FalhaPublicacao(f"{caminho}: no máximo 3 fotos no corpo")
    if len(plano["capa"]["alt"]) < 10:
        raise FalhaPublicacao(f"{caminho}: alt da capa curto demais")
    for i, f in enumerate(plano["fotos"], 1):
        if len(f["alt"]) < 25 or len(f["legenda"]) < 10:
            raise FalhaPublicacao(f"{caminho}: foto {i} com alt ou legenda curtos")


def chave(nome):
    return os.environ.get(nome, "").strip()


def candidatas_pexels(busca):
    r = requests.get("https://api.pexels.com/v1/search", headers={"Authorization": chave("PEXELS_API_KEY")},
                     params={"query": busca, "per_page": 15, "orientation": "landscape"}, timeout=30)
    r.raise_for_status()
    return [{"chave": f"Pexels-{p['id']}", "url": p["src"]["large"], "autor": p.get("photographer", "Pexels"),
             "pagina": p.get("url")} for p in r.json().get("photos", [])]


def candidatas_pixabay(busca):
    r = requests.get("https://pixabay.com/api/", params={
        "key": chave("PIXABAY_API_KEY"), "q": busca, "image_type": "photo", "orientation": "horizontal",
        "per_page": 20, "safesearch": "true", "lang": "pt"}, timeout=30)
    r.raise_for_status()
    return [{"chave": f"Pixabay-{h['id']}", "url": h["largeImageURL"], "autor": h.get("user", "Pixabay"),
             "pagina": h.get("pageURL")} for h in r.json().get("hits", [])]


def candidatas_unsplash(busca):
    r = requests.get("https://api.unsplash.com/search/photos",
                     headers={"Authorization": f"Client-ID {chave('UNSPLASH_API_KEY')}", "Accept-Version": "v1"},
                     params={"query": busca, "per_page": 20, "orientation": "landscape"}, timeout=30)
    r.raise_for_status()
    return [{"chave": f"Unsplash-{u['id']}", "url": u["urls"]["regular"], "autor": u["user"].get("name", "Unsplash"),
             "pagina": u["links"].get("html"), "download": u["links"].get("download_location")}
            for u in r.json().get("results", [])]


BUSCAS = {"Pexels": candidatas_pexels, "Pixabay": candidatas_pixabay, "Unsplash": candidatas_unsplash}
CHAVES = {"Pexels": "PEXELS_API_KEY", "Pixabay": "PIXABAY_API_KEY", "Unsplash": "UNSPLASH_API_KEY"}


TERMO_GENERICO = "science nature"


def busca_em_fontes(busca, usadas, erros):
    """Tenta Pexels, Pixabay e Unsplash, nessa ordem, até achar foto livre ainda não usada no artigo."""
    for fonte in FONTES:
        if not chave(CHAVES[fonte]):
            erros.append(f"{fonte}: sem chave")
            continue
        try:
            opcoes = BUSCAS[fonte](busca)
        except requests.RequestException as e:
            erros.append(f"{fonte} '{busca}': {e}")
            continue
        for foto in opcoes:
            if foto["chave"] not in usadas:
                usadas.add(foto["chave"])
                foto["fonte"] = fonte
                if fonte == "Unsplash" and foto.get("download"):
                    # Regra da Unsplash: avisar o download pelo link de tracking. Falha aqui não derruba a publicação.
                    try:
                        requests.get(foto["download"], headers={"Authorization": f"Client-ID {chave('UNSPLASH_API_KEY')}"},
                                     timeout=15)
                    except requests.RequestException:
                        pass
                return foto
        erros.append(f"{fonte} '{busca}': sem foto livre")
    return None


def busca_foto(busca, usadas):
    """Garante uma foto: termo completo, depois termo curto e, por último, termo genérico."""
    erros = []
    palavras = busca.split()
    tentativas = [busca, " ".join(palavras[:2]), TERMO_GENERICO]
    for termo in dict.fromkeys(tentativas):
        foto = busca_em_fontes(termo, usadas, erros)
        if foto:
            return foto
    raise FalhaPublicacao("sem imagem para '" + busca + "': " + "; ".join(erros))


def credito(foto):
    return {"author": foto["autor"], "source": foto["fonte"], "url": foto["pagina"], **LICENCAS[foto["fonte"]]}


def salva_webp(url, caminho_base):
    """Baixa a imagem, grava em .webp (1200 px) e devolve largura e altura reais."""
    bruta = requests.get(url, timeout=60).content
    im = Image.open(BytesIO(bruta)).convert("RGB")
    im.thumbnail((1200, 1200))
    im.save(caminho_base + ".webp", "WEBP", quality=82)
    return im.width, im.height


def gera_imagens(slug, plano):
    """Capa e fotos do corpo. Falha antes de tocar nos arquivos do artigo se alguma não existir."""
    pasta = os.path.join(IMAGENS_DIR, slug)
    os.makedirs(pasta, exist_ok=True)
    usadas = set()

    capa_foto = busca_foto(plano["capa"]["busca"], usadas)
    capa_src = f"/images/{slug}/{slug}.webp"
    salva_webp(capa_foto["url"], os.path.join(pasta, slug))
    capa_pequena = Image.open(os.path.join(pasta, slug + ".webp"))
    capa_pequena.thumbnail((640, 640))
    capa_pequena.save(os.path.join(pasta, slug + "-640.webp"), "WEBP", quality=80)
    credito_capa = credito(capa_foto)

    imagens = []
    for i, f in enumerate(plano["fotos"], 1):
        foto = busca_foto(f["busca"], usadas)
        nome = f"{slug}-foto-{i}"
        largura, altura = salva_webp(foto["url"], os.path.join(pasta, nome))
        imagens.append({
            "src": f"/images/{slug}/{nome}.webp",
            "alt": f["alt"],
            "caption": f["legenda"],
            "section": int(f["secao"]),
            "width": largura,
            "height": altura,
            "credit": credito(foto),
        })
    return capa_src, plano["capa"]["alt"], credito_capa, imagens


def monta_artigo(fm, corpo, capa_src, capa_alt, credito_capa, imagens):
    novo = {k: v for k, v in fm.items() if k != "imagensPlano"}
    novo["featuredImage"] = capa_src
    novo["featuredImageAlt"] = capa_alt
    novo["imageCredit"] = credito_capa
    novo["images"] = imagens
    cabeca = yaml.safe_dump(novo, allow_unicode=True, sort_keys=False, default_flow_style=False, width=1000)
    return f"---\n{cabeca}---\n\n{corpo.rstrip()}\n"


def atualiza_calendario(slug, data_br, dia):
    """Marca a linha do slug como PUBLICADO e põe a data real. Devolve False se não achar a linha."""
    linhas = open(CALENDARIO, encoding="utf-8").read().split("\n")
    achou = False
    for i, linha in enumerate(linhas):
        if not linha.startswith("| ") or f"| {slug} |" not in linha:
            continue
        partes = linha.split("|")
        if partes[8].strip() != slug:
            continue
        partes[1] = f" {data_br} "
        partes[2] = f" {dia} "
        partes[9] = " **PUBLICADO** "
        linhas[i] = "|".join(partes)
        achou = True
        break
    if achou:
        open(CALENDARIO, "w", encoding="utf-8", newline="\n").write("\n".join(linhas))
    return achou


def proxima_pronta():
    """Próximo artigo pronto na ordem do calendário (pautas não publicadas), ou None."""
    prontos = {f[:-3]: f for f in os.listdir(PRONTOS_DIR) if f.endswith(".md")}
    with open(CALENDARIO, encoding="utf-8") as f:
        for linha in f:
            if not linha.startswith("| ") or "**PUBLICADO**" in linha:
                continue
            slug = [c.strip() for c in linha.split("|")][8]
            if slug in prontos:
                return prontos[slug]
    return None


def publica(nome):
    origem = os.path.join(PRONTOS_DIR, nome)
    fm, corpo = le_artigo(origem)
    valida(fm, origem)
    slug = fm["slug"]
    if os.path.exists(os.path.join(ARTIGO_DIR, slug + ".md")):
        raise FalhaPublicacao(f"{slug}: já existe em {ARTIGO_DIR}")

    capa_src, capa_alt, credito_capa, imagens = gera_imagens(slug, fm["imagensPlano"])
    texto = monta_artigo(fm, corpo, capa_src, capa_alt, credito_capa, imagens)
    with open(os.path.join(ARTIGO_DIR, slug + ".md"), "w", encoding="utf-8", newline="\n") as f:
        f.write(texto)

    data = fm["datePublished"]
    if isinstance(data, str):
        data = datetime.date.fromisoformat(data)
    dias = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sab", "Dom"]
    if not atualiza_calendario(slug, data.strftime("%d/%m/%Y"), dias[data.weekday()]):
        print(f"aviso: {slug} não está na tabela do calendário; status não atualizado")

    os.makedirs(PUBLICADOS_DIR, exist_ok=True)
    shutil.move(origem, os.path.join(PUBLICADOS_DIR, nome))
    print(f"publicado: {slug} ({len(imagens)} fotos no corpo + capa)")
    return slug


def testar_imagens():
    """Consulta cada fonte com uma busca de teste e mostra o resultado. Não grava nada."""
    erros = 0
    for fonte in FONTES:
        if not chave(CHAVES[fonte]):
            print(f"{fonte}: CHAVE NÃO CONFIGURADA")
            erros += 1
            continue
        try:
            opcoes = BUSCAS[fonte]("coffee cup")
        except requests.RequestException as e:
            print(f"{fonte}: ERRO {e}")
            erros += 1
            continue
        if not opcoes:
            print(f"{fonte}: resposta sem fotos")
            erros += 1
            continue
        print(f"{fonte}: OK, {len(opcoes)} fotos. Exemplo: {opcoes[0]['url']}")
    return 1 if erros else 0


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--arquivo", help="nome do .md em GPT ARTIGOS PRONTOS (padrão: próximo da fila)")
    ap.add_argument("--testar-imagens", action="store_true", help="só testa as APIs de imagem, sem publicar")
    args = ap.parse_args()

    if args.testar_imagens:
        return testar_imagens()

    if not any(chave(c) for c in CHAVES.values()):
        print("erro: nenhuma chave de imagem configurada (Pexels, Pixabay ou Unsplash)", file=sys.stderr)
        return 1
    nome = args.arquivo or proxima_pronta()
    if not nome:
        print("sem artigo pronto na fila: nada publicado")
        return 0
    if not os.path.exists(os.path.join(PRONTOS_DIR, nome)):
        print(f"erro: {nome} não está em {PRONTOS_DIR}", file=sys.stderr)
        return 1
    try:
        publica(nome)
    except FalhaPublicacao as e:
        print(f"falha: {e}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
