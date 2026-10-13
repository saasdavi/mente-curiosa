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
PEXELS_URL = "https://api.pexels.com/v1/search"
LICENCA = {"license": "Licença Pexels", "licenseUrl": "https://www.pexels.com/license/"}


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


def busca_foto(busca, usadas):
    """Primeira foto em paisagem da Pexels que ainda não foi usada no artigo."""
    chave = os.environ.get("PEXELS_API_KEY", "").strip()
    r = requests.get(PEXELS_URL, headers={"Authorization": chave},
                     params={"query": busca, "per_page": 15, "orientation": "landscape"}, timeout=30)
    if r.status_code != 200:
        raise FalhaPublicacao(f"Pexels HTTP {r.status_code} para '{busca}'")
    for foto in r.json().get("photos", []):
        if foto["id"] not in usadas:
            usadas.add(foto["id"])
            return foto
    raise FalhaPublicacao(f"Pexels sem foto disponível para '{busca}'")


def salva_webp(foto, caminho_base):
    """Baixa a foto, grava em .webp (1200 px) e devolve largura e altura reais."""
    bruta = requests.get(foto["src"]["large"], timeout=60).content
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
    salva_webp(capa_foto, os.path.join(pasta, slug))
    capa_pequena = Image.open(os.path.join(pasta, slug + ".webp"))
    capa_pequena.thumbnail((640, 640))
    capa_pequena.save(os.path.join(pasta, slug + "-640.webp"), "WEBP", quality=80)
    credito_capa = {"author": capa_foto.get("photographer", "Pexels"), "source": "Pexels",
                    "url": capa_foto.get("url"), **LICENCA}

    imagens = []
    for i, f in enumerate(plano["fotos"], 1):
        foto = busca_foto(f["busca"], usadas)
        nome = f"{slug}-foto-{i}"
        largura, altura = salva_webp(foto, os.path.join(pasta, nome))
        imagens.append({
            "src": f"/images/{slug}/{nome}.webp",
            "alt": f["alt"],
            "caption": f["legenda"],
            "section": int(f["secao"]),
            "width": largura,
            "height": altura,
            "credit": {"author": foto.get("photographer", "Pexels"), "source": "Pexels",
                       "url": foto.get("url"), **LICENCA},
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


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--arquivo", help="nome do .md em GPT ARTIGOS PRONTOS (padrão: próximo da fila)")
    args = ap.parse_args()

    if not os.environ.get("PEXELS_API_KEY", "").strip():
        print("erro: PEXELS_API_KEY não configurada", file=sys.stderr)
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
