"""Enriquece as pautas planejadas com dados reais da SerpAPI.

Para cada pauta `planejado` que ainda não tem briefing em dados/briefings/:
- busca no Google (organic_results, related_questions, related_searches);
- busca o autocomplete (long tails reais);
- lê o H2 das 5 primeiras páginas, só se o robots.txt permitir;
- grava o briefing em dados/briefings/<slug>.md;
A planilha não é alterada: o briefing é o que a IA lê para escrever.

Uso: SERP_API_KEY=... LIMITE=10 python scripts/enriquecer_serp.py
"""

import csv
import datetime as dt
import os
import re
import sys
import time
import urllib.robotparser
import urllib.parse
from html.parser import HTMLParser

import requests

CSV_PATH = "dados/calendario_mente_curiosa.csv"
BRIEFING_DIR = "dados/briefings"
SERP_URL = "https://serpapi.com/search.json"
UA = "MenteCuriosaBot/1.0 (+https://www.mentecuriosa.blog)"
PAUSA = 2  # segundos entre chamadas, para não estourar a cota

# Índices das colunas (a planilha não tem cabeçalho)
COL_KW, COL_SLUG, COL_STATUS = 7, 15, 16
COLUNAS = 23


class H2Parser(HTMLParser):
    def __init__(self):
        super().__init__()
        self.em_h2 = False
        self.h2 = []
        self.texto = []

    def handle_starttag(self, tag, attrs):
        if tag == "h2":
            self.em_h2 = True

    def handle_endtag(self, tag):
        if tag == "h2":
            self.em_h2 = False

    def handle_data(self, data):
        if self.em_h2 and data.strip():
            self.h2.append(data.strip())
        self.texto.append(data)


# Fora dos concorrentes: vídeo, rede social, loja, buscador e enciclopédia.
# Não são blog nem site de conteúdo, e não servem de fonte para o artigo.
EXCLUIDOS = (
    "youtube.com", "youtu.be", "instagram.com", "facebook.com", "tiktok.com",
    "twitter.com", "x.com", "reddit.com", "linkedin.com", "pinterest.com",
    "wikipedia.org", "wikipédia", "amazon.", "mercadolivre.", "shopee.",
    "google.", "bing.com", "duckduckgo.com",
)


def eh_concorrente(link):
    host = urllib.parse.urlparse(link).netloc.lower()
    return not any(x in host for x in EXCLUIDOS)


def pode_ler(url):
    """Lê o robots.txt com o mesmo User-Agent usado no acesso à página."""
    partes = urllib.parse.urlparse(url)
    robots = urllib.robotparser.RobotFileParser()
    try:
        r = requests.get(
            f"{partes.scheme}://{partes.netloc}/robots.txt",
            headers={"User-Agent": UA},
            timeout=10,
        )
    except requests.RequestException:
        return False  # sem robots.txt legível, não lê a página
    if r.status_code != 200:
        return r.status_code == 404  # 404 = sem restrição declarada
    robots.parse(r.text.splitlines())
    return robots.can_fetch(UA, url)


def analisar_pagina(url):
    if not pode_ler(url):
        return None
    try:
        r = requests.get(url, headers={"User-Agent": UA}, timeout=15)
        r.raise_for_status()
    except requests.RequestException:
        return None
    p = H2Parser()
    p.feed(r.text)
    palavras = len(" ".join(p.texto).split())
    return {"h2": p.h2[:15], "palavras": palavras}


def serp(params, chave):
    params = {**params, "api_key": chave}
    r = requests.get(SERP_URL, params=params, timeout=60)
    r.raise_for_status()
    dados = r.json()
    if dados.get("search_metadata", {}).get("status") != "Success":
        raise RuntimeError(dados.get("error", "resposta sem status Success"))
    return dados


def autocomplete(palavra, chave):
    dados = serp(
        {"engine": "google_autocomplete", "q": palavra, "gl": "br", "hl": "pt"},
        chave,
    )
    sugestoes = sorted(
        dados.get("suggestions", []),
        key=lambda s: s.get("relevance", 0),
        reverse=True,
    )
    return [s["value"] for s in sugestoes if s.get("value")][:10]


def briefing(palavra, slug, chave):
    dados = serp({"engine": "google", "q": palavra, "gl": "br", "hl": "pt"}, chave)
    time.sleep(PAUSA)
    organicos = [o for o in dados.get("organic_results", []) if o.get("link") and eh_concorrente(o["link"])][:5]
    paginas = []
    for item in organicos:
        info = analisar_pagina(item["link"])
        time.sleep(PAUSA)
        paginas.append({"titulo": item.get("title", ""), "link": item["link"], "info": info})
    perguntas = [q["question"] for q in dados.get("related_questions", []) if q.get("question")]
    relacionadas = [q["query"] for q in dados.get("related_searches", []) if q.get("query")]
    long_tails = autocomplete(palavra, chave)
    time.sleep(PAUSA)
    return {
        "palavra": palavra,
        "slug": slug,
        "paginas": paginas,
        "perguntas": perguntas,
        "relacionadas": relacionadas,
        "long_tails": long_tails,
    }


def escrever_md(b):
    os.makedirs(BRIEFING_DIR, exist_ok=True)
    linhas = [
        f"# Briefing: {b['palavra']}",
        "",
        f"Data da coleta: {dt.date.today().isoformat()}",
        "",
        "## Top 5 do Google",
    ]
    for i, p in enumerate(b["paginas"], 1):
        linhas.append(f"{i}. [{p['titulo']}]({p['link']})")
        if p["info"]:
            linhas.append(f"   - Palavras: {p['info']['palavras']}")
            for h in p["info"]["h2"]:
                linhas.append(f"   - H2: {h}")
        else:
            linhas.append("   - Página não lida (robots.txt ou erro de acesso)")
    linhas += ["", "## Perguntas do Google (PAA)"] + [f"- {q}" for q in b["perguntas"]]
    linhas += ["", "## Buscas relacionadas"] + [f"- {q}" for q in b["relacionadas"]]
    linhas += ["", "## Long tails (autocomplete)"] + [f"- {q}" for q in b["long_tails"]]
    caminho = os.path.join(BRIEFING_DIR, f"{b['slug']}.md")
    with open(caminho, "w", encoding="utf-8") as f:
        f.write("\n".join(linhas) + "\n")
    return caminho


def main():
    chave = os.environ.get("SERP_API_KEY", "").strip()
    if not chave:
        sys.exit("SERP_API_KEY não definida")
    limite = int(os.environ.get("LIMITE", "10"))

    with open(CSV_PATH, encoding="utf-8", newline="") as f:
        linhas = list(csv.reader(f))

    alvo = [
        r for r in linhas
        if len(r) >= COLUNAS
        and r[COL_STATUS] == "planejado"
        and not os.path.exists(os.path.join(BRIEFING_DIR, f"{r[COL_SLUG]}.md"))
    ][:limite]
    print(f"Pautas a enriquecer: {len(alvo)}")

    for r in alvo:
        palavra, slug = r[COL_KW], r[COL_SLUG]
        try:
            b = briefing(palavra, slug, chave)
            if not b["long_tails"]:
                raise RuntimeError("sem long tails do autocomplete")
            escrever_md(b)
            print(f"OK    {palavra}: {len(b['paginas'])} páginas, "
                  f"{len(b['perguntas'])} PAA, {len(b['long_tails'])} long tails")
        except Exception as e:  # uma pauta falha sem parar as outras
            print(f"FALHA {palavra}: {e}")


if __name__ == "__main__":
    main()
