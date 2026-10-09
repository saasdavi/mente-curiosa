"""Enriquece as pautas planejadas com dados reais da SerpAPI.

Para cada pauta `planejado` que ainda não tem briefing em dados/briefings/:
- busca no Google (organic_results, related_questions, related_searches);
- usa as buscas relacionadas da primeira página como long tails (sem autocomplete,
  para gastar 1 busca por pauta);
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


STOPWORDS = {
    "a", "o", "as", "os", "de", "da", "do", "das", "dos", "e", "em", "na", "no",
    "nas", "nos", "um", "uma", "por", "que", "para", "com", "se", "é", "ao", "à",
    "como", "porque", "pq", "the", "of", "and",
}
RUIDO_H2 = ("compartilh", "link copiado", "priorizar", "leia também", "newsletter",
            "cookie", "referências", "ver também", "conteúdos", "índice", "navegação")
DOMINIOS_FONTE = (".gov", ".gov.br", ".edu", ".edu.br", ".org", ".org.br", ".ac.uk", ".nasa.gov")


def tokens(texto):
    return {t for t in re.findall(r"\w+", texto.lower()) if t not in STOPWORDS and len(t) > 2}


def h2_limpos(h2s):
    return [h for h in h2s if len(h) <= 100 and not any(r in h.lower() for r in RUIDO_H2)][:8]


def long_tails_relevantes(palavra, relacionadas):
    base = tokens(palavra)
    return [
        q for q in relacionadas
        if len(tokens(q) & base) >= 1 and "wiki" not in q.lower()
    ]


def lacunas(perguntas, paginas):
    h2_tokens = [tokens(h) for p in paginas if p["info"] for h in p["info"]["h2"]]
    sem_resposta = []
    for q in perguntas:
        t = tokens(q)
        if not t:
            continue
        cobertura = max((len(t & h) / len(t) for h in h2_tokens), default=0)
        if cobertura < 0.6:
            sem_resposta.append(q)
    return sem_resposta


def fontes_candidatas(organicos_todos):
    return [
        {"titulo": o.get("title", ""), "link": o["link"]}
        for o in organicos_todos
        if o.get("link") and any(urllib.parse.urlparse(o["link"]).netloc.lower().endswith(d) for d in DOMINIOS_FONTE)
    ][:5]


def briefing(palavra, slug, chave):
    dados = serp({"engine": "google", "q": palavra, "gl": "br", "hl": "pt"}, chave)
    time.sleep(PAUSA)
    todos = dados.get("organic_results", [])
    organicos = [o for o in todos if o.get("link") and eh_concorrente(o["link"])][:5]
    paginas = []
    for item in organicos:
        info = analisar_pagina(item["link"])
        time.sleep(PAUSA)
        if info:
            info["h2"] = h2_limpos(info["h2"])
        paginas.append({"titulo": item.get("title", ""), "link": item["link"], "info": info})
    perguntas = [q["question"] for q in dados.get("related_questions", []) if q.get("question")]
    relacionadas = [q["query"] for q in dados.get("related_searches", []) if q.get("query")]
    return {
        "palavra": palavra,
        "slug": slug,
        "paginas": paginas,
        "perguntas": perguntas,
        "lacunas": lacunas(perguntas, paginas),
        "long_tails": long_tails_relevantes(palavra, relacionadas),
        "fontes": fontes_candidatas(todos),
    }


def escrever_md(b):
    """Briefing na ordem que o prompt mestre lê: concorrentes, perguntas, lacunas,
    long tails e fontes. Sem dados que o prompt não usa."""
    os.makedirs(BRIEFING_DIR, exist_ok=True)
    linhas = [
        f"# Briefing: {b['palavra']}",
        "",
        f"Coleta: {dt.date.today().isoformat()} (Google Brasil, primeira página)",
        "",
        "## Concorrentes (top 5, sem vídeo, rede social, loja ou Wikipédia)",
    ]
    for i, p in enumerate(b["paginas"], 1):
        if p["info"]:
            linhas.append(f"{i}. {p['titulo']} | {p['link']} | ~{p['info']['palavras']} palavras")
            for h in p["info"]["h2"]:
                linhas.append(f"   - H2: {h}")
        else:
            linhas.append(f"{i}. {p['titulo']} | {p['link']} | página não lida")
    linhas += ["", "## Perguntas do Google (PAA)"] + [f"- {q}" for q in b["perguntas"]]
    linhas += ["", "## Lacunas (perguntas que os concorrentes lidos não respondem)"] + (
        [f"- {q}" for q in b["lacunas"]] or ["(nenhuma)"])
    linhas += ["", "## Long tails (buscas relacionadas que contêm o tema)"] + [f"- {q}" for q in b["long_tails"]]
    linhas += ["", "## Fontes candidatas (instituições, órgãos e universidades da primeira página)"] + (
        [f"- {f['titulo']} | {f['link']}" for f in b["fontes"]] or ["(nenhuma)"])
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
        and not os.path.exists(os.path.join(BRIEFING_DIR, f"{r[COL_SLUG]}.falha.txt"))
    ][:limite]
    print(f"Pautas a enriquecer: {len(alvo)}")

    for r in alvo:
        palavra, slug = r[COL_KW], r[COL_SLUG]
        try:
            b = briefing(palavra, slug, chave)
            if not b["long_tails"]:
                raise RuntimeError("nenhuma long tail relevante na primeira página")
            escrever_md(b)
            print(f"OK    {palavra}: {len(b['paginas'])} páginas, "
                  f"{len(b['perguntas'])} PAA, {len(b['long_tails'])} long tails")
        except Exception as e:  # uma pauta falha sem parar as outras
            # Registra a falha para não gastar a busca de novo na próxima execução.
            # Para tentar de novo, apague o arquivo .falha.txt.
            os.makedirs(BRIEFING_DIR, exist_ok=True)
            with open(os.path.join(BRIEFING_DIR, f"{slug}.falha.txt"), "w", encoding="utf-8") as f:
                f.write(f"{dt.date.today().isoformat()} {palavra}: {e}\n")
            print(f"FALHA {palavra}: {e}")


if __name__ == "__main__":
    main()
