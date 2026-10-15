"""Prepara artigo pronto para deploy e finaliza o calendário somente após sucesso.

Uso:
  python scripts/publicar_artigo.py [--arquivo X.md] --github-output "$GITHUB_OUTPUT"
  python scripts/publicar_artigo.py --finalizar X.md
  python scripts/publicar_artigo.py --falha X.md

A preparação grava conteúdo/imagens, mas não move a origem nem altera o calendário.
O workflow confirma o deploy da Vercel antes de chamar --finalizar.
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


def atualiza_calendario(slug, status, data_br=None, dia=None):
    """Atualiza status da pauta e os totais do resumo; não inventa linha se slug não existe."""
    with open(CALENDARIO, encoding="utf-8") as f:
        linhas = f.read().splitlines()

    achou = False
    for i, linha in enumerate(linhas):
        if not linha.startswith("| ") or linha.startswith("|---"):
            continue
        partes = linha.split("|")
        if len(partes) < 11 or partes[8].strip() != slug:
            continue
        if data_br:
            partes[1] = f" {data_br} "
        if dia:
            partes[2] = f" {dia} "
        partes[9] = f" **{status}** "
        linhas[i] = "|".join(partes)
        achou = True
        break

    if not achou:
        return False

    contagens = {"PUBLICADO": 0, "A PRODUZIR": 0, "GERAR ARTIGO": 0, "FALHA": 0}
    for linha in linhas:
        if not linha.startswith("| ") or linha.startswith("|---"):
            continue
        partes = linha.split("|")
        if len(partes) < 11:
            continue
        estado = partes[9].strip().replace("**", "")
        if estado in contagens:
            contagens[estado] += 1

    texto = "\n".join(linhas) + "\n"
    for estado, total in contagens.items():
        texto, n = re.subn(
            rf"(?m)^- {re.escape(estado)}: \*\*\d+\*\*$",
            f"- {estado}: **{total}**",
            texto,
            count=1,
        )
        if n == 0:
            raise FalhaPublicacao(f"resumo do calendário não contém a linha para {estado}")

    with open(CALENDARIO, "w", encoding="utf-8", newline="\n") as f:
        f.write(texto)
    return True

def proxima_pronta():
    """Próximo artigo pronto na ordem do calendário; inclui FALHA para permitir nova tentativa."""
    if not os.path.isdir(PRONTOS_DIR):
        raise FalhaPublicacao(f"pasta de artigos prontos não existe: {PRONTOS_DIR}")
    prontos = {f[:-3]: f for f in os.listdir(PRONTOS_DIR) if f.endswith(".md")}
    with open(CALENDARIO, encoding="utf-8") as f:
        for linha in f:
            if not linha.startswith("| ") or linha.startswith("|---"):
                continue
            partes = linha.split("|")
            if len(partes) < 11:
                continue
            slug = partes[8].strip()
            status = partes[9].strip().replace("**", "")
            if status == "PUBLICADO":
                continue
            if slug in prontos:
                return prontos[slug]
    return None

def escreve_github_output(caminho, valores):
    """Expõe metadados do artigo para etapas posteriores do GitHub Actions."""
    if not caminho:
        return
    with open(caminho, "a", encoding="utf-8") as f:
        for chave_saida, valor in valores.items():
            f.write(f"{chave_saida}={valor or ''}\n")


def publica(nome):
    """Prepara artigo e imagens, sem marcar status nem mover o arquivo de origem."""
    origem = os.path.join(PRONTOS_DIR, nome)
    if not os.path.isfile(origem):
        raise FalhaPublicacao(f"{nome} não está em {PRONTOS_DIR}")

    fm, corpo = le_artigo(origem)
    valida(fm, origem)
    slug = fm["slug"]
    destino = os.path.join(ARTIGO_DIR, slug + ".md")

    # Se o conteúdo já foi enviado ao repositório numa tentativa anterior cujo deploy
    # falhou, reutiliza-o e permite tentar o build/deploy novamente.
    if os.path.exists(destino):
        print(f"tentativa de recuperação: artigo já existe em {ARTIGO_DIR}: {slug}")
        return slug

    capa_src, capa_alt, credito_capa, imagens = gera_imagens(slug, fm["imagensPlano"])
    texto = monta_artigo(fm, corpo, capa_src, capa_alt, credito_capa, imagens)
    os.makedirs(ARTIGO_DIR, exist_ok=True)
    with open(destino, "w", encoding="utf-8", newline="\n") as f:
        f.write(texto)

    print(f"artigo preparado: {slug} ({len(imagens)} fotos no corpo + capa)")
    return slug


def finalizar(nome):
    """Marca PUBLICADO e arquiva a origem; só chamar após deploy confirmado."""
    origem = os.path.join(PRONTOS_DIR, nome)
    arquivada = os.path.join(PUBLICADOS_DIR, nome)
    caminho = origem if os.path.isfile(origem) else arquivada
    if not os.path.isfile(caminho):
        raise FalhaPublicacao(f"não encontrei o arquivo de origem {nome} em prontos nem PUBLICADOS")

    fm, _ = le_artigo(caminho)
    slug = fm.get("slug")
    if not slug:
        raise FalhaPublicacao(f"{caminho}: frontmatter sem slug")

    data = fm.get("datePublished")
    data_br = dia = None
    if data:
        if isinstance(data, str):
            data = datetime.date.fromisoformat(data)
        data_br = data.strftime("%d/%m/%Y")
        dias = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sab", "Dom"]
        dia = dias[data.weekday()]

    if not atualiza_calendario(slug, "PUBLICADO", data_br, dia):
        raise FalhaPublicacao(f"{slug} não foi encontrado no calendário; não foi marcado PUBLICADO")

    if caminho == origem:
        os.makedirs(PUBLICADOS_DIR, exist_ok=True)
        shutil.move(origem, arquivada)
    print(f"finalizado após deploy confirmado: {slug}")


def marca_falha(nome):
    """Registra FALHA sem mover o arquivo pronto, para preservar a possibilidade de retry."""
    origem = os.path.join(PRONTOS_DIR, nome)
    if not os.path.isfile(origem):
        raise FalhaPublicacao(f"não encontrei {nome} na pasta de artigos prontos para registrar FALHA")
    fm, _ = le_artigo(origem)
    slug = fm.get("slug")
    if not slug:
        raise FalhaPublicacao(f"{origem}: frontmatter sem slug")
    if not atualiza_calendario(slug, "FALHA"):
        raise FalhaPublicacao(f"{slug} não foi encontrado no calendário; status FALHA não registrado")
    print(f"status FALHA registrado para {slug}; artigo de origem preservado")

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--arquivo", help="nome do .md em GPT ARTIGOS PRONTOS (padrão: próximo da fila)")
    ap.add_argument("--github-output", help="caminho do arquivo GITHUB_OUTPUT")
    ap.add_argument("--finalizar", help="finaliza o artigo após confirmação de deploy")
    ap.add_argument("--falha", help="marca FALHA sem mover o artigo pronto")
    args = ap.parse_args()

    try:
        if args.finalizar:
            finalizar(args.finalizar)
            return 0
        if args.falha:
            marca_falha(args.falha)
            return 0

        if not any(chave(c) for c in CHAVES.values()):
            raise FalhaPublicacao("nenhuma chave de imagem configurada (Pexels, Pixabay ou Unsplash)")

        nome = args.arquivo or proxima_pronta()
        if not nome:
            escreve_github_output(args.github_output, {"novo": "false", "slug": "", "arquivo": ""})
            print("sem artigo pronto na fila: nada a publicar")
            return 0

        origem = os.path.join(PRONTOS_DIR, nome)
        if not os.path.isfile(origem):
            raise FalhaPublicacao(f"{nome} não está em {PRONTOS_DIR}")

        # Registra os dados antes de validar/baixar imagens para que o workflow possa
        # identificar a pauta e marcar FALHA caso uma etapa posterior dê erro.
        fm, _ = le_artigo(origem)
        slug = fm.get("slug", "")
        escreve_github_output(args.github_output, {"novo": "true", "slug": slug, "arquivo": nome})
        publica(nome)
        return 0
    except FalhaPublicacao as e:
        print(f"falha: {e}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    sys.exit(main())
