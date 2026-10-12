"""Gera dados/calendario_editorial.md: uma tabela só, com todas as pautas e publicados.

Uso: python scripts/gerar_calendario_editorial.py

Fontes:
- dados/calendario_mente_curiosa.csv: pautas do calendário (sem cabeçalho)
- src/content/artigos/*.md: artigos no ar (entram como PUBLICADO, mesmo sem pauta)
- dados/artigos_falhas/*.txt: pautas que falharam na publicação

Status (3 tipos):
- PUBLICADO: artigo no ar, com link e deploy
- FALHA: pauta com arquivo em dados/artigos_falhas/
- A PRODUZIR: pauta para o ChatGPT produzir (todo o resto)

O .md é gerado; não editar à mão.
"""

import csv
import datetime
import os
import re

CSV_PATH = "dados/calendario_mente_curiosa.csv"
ARTIGOS_DIR = "src/content/artigos"
FALHAS_DIR = "dados/artigos_falhas"
SAIDA = "dados/calendario_editorial.md"

PUBLICADO, FALHA, A_PRODUZIR = "PUBLICADO", "FALHA", "A PRODUZIR"
DIAS = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sab", "Dom"]

# Ritmo de publicação: 3 artigos por dia, a partir de INICIO_AGENDA.
# Vale para as pautas pendentes (A PRODUZIR e FALHA). Os PUBLICADO mantêm a data real.
INICIO_AGENDA = datetime.date(2026, 10, 14)
HORARIOS = ["09h", "12h", "20h"]

# Índices das colunas do CSV (não há cabeçalho)
COL_CODIGO, COL_DATA, COL_ISO, COL_DIA, COL_HORARIO = 0, 1, 2, 3, 4
COL_TEMA, COL_TITULO, COL_CATEGORIA, COL_SLUG = 7, 8, 9, 15


def celula(texto):
    return str(texto).replace("|", "\\|").replace("\n", " ").strip()


def ler_calendario():
    with open(CSV_PATH, encoding="utf-8", newline="") as f:
        return [r for r in csv.reader(f) if r and r[0].startswith("CAL")]


def ler_artigos():
    """Devolve {slug: {titulo, data (AAAA-MM-DD), categoria, tema}} do frontmatter."""
    artigos = {}
    for nome in sorted(os.listdir(ARTIGOS_DIR)):
        if not nome.endswith(".md"):
            continue
        with open(os.path.join(ARTIGOS_DIR, nome), encoding="utf-8") as f:
            texto = f.read()
        frontmatter = texto.split("---", 2)[1] if texto.startswith("---") else ""

        def campo(chave):
            m = re.search(rf"^{chave}:\s*\"?([^\"\n]*)\"?\s*$", frontmatter, re.MULTILINE)
            return m.group(1).strip() if m else ""

        slug = campo("slug") or nome[:-3]
        artigos[slug] = {
            "titulo": campo("title"),
            "data": campo("datePublished")[:10],
            "categoria": campo("category"),
            "tema": campo("keyword"),
        }
    return artigos


def ler_falhas():
    if not os.path.isdir(FALHAS_DIR):
        return set()
    return {nome[:-4] for nome in os.listdir(FALHAS_DIR) if nome.endswith(".txt")}


def linha_do_calendario(r, artigos, falhas):
    slug = r[COL_SLUG]
    if slug in artigos:
        status = PUBLICADO
    elif slug in falhas:
        status = FALHA
    else:
        status = A_PRODUZIR
    return {
        "iso": r[COL_ISO],
        "data": r[COL_DATA],
        "dia": r[COL_DIA],
        "horario": r[COL_HORARIO],
        "codigo": r[COL_CODIGO],
        "tema": r[COL_TEMA],
        "titulo": r[COL_TITULO],
        "categoria": r[COL_CATEGORIA],
        "slug": slug,
        "status": status,
    }


def linha_publicado_sem_pauta(slug, info):
    """Artigo no ar que não tem pauta no CSV: entra como PUBLICADO com a data de publicação."""
    d = datetime.date.fromisoformat(info["data"])
    return {
        "iso": info["data"],
        "data": d.strftime("%d/%m/%Y"),
        "dia": DIAS[d.weekday()],
        "horario": "—",
        "codigo": "—",
        "tema": info["tema"],
        "titulo": info["titulo"],
        "categoria": info["categoria"],
        "slug": slug,
        "status": PUBLICADO,
    }


def reagendar(pendentes):
    """Distribui as pautas pendentes 3 por dia, a partir de INICIO_AGENDA, na ordem do CSV."""
    pendentes.sort(key=lambda l: (l["iso"], l["horario"]))
    for i, l in enumerate(pendentes):
        d = INICIO_AGENDA + datetime.timedelta(days=i // len(HORARIOS))
        l["iso"] = d.isoformat()
        l["data"] = d.strftime("%d/%m/%Y")
        l["dia"] = DIAS[d.weekday()]
        l["horario"] = HORARIOS[i % len(HORARIOS)]
    return pendentes


def gerar():
    artigos = ler_artigos()
    falhas = ler_falhas()
    calendario = ler_calendario()

    linhas = [linha_do_calendario(r, artigos, falhas) for r in calendario]
    slugs_calendario = {l["slug"] for l in linhas}
    linhas += [
        linha_publicado_sem_pauta(slug, info)
        for slug, info in artigos.items()
        if slug not in slugs_calendario
    ]
    publicados = [l for l in linhas if l["status"] == PUBLICADO]
    pendentes = reagendar([l for l in linhas if l["status"] != PUBLICADO])
    linhas = publicados + pendentes
    linhas.sort(key=lambda l: (l["iso"], l["horario"]))

    contagem = {PUBLICADO: 0, FALHA: 0, A_PRODUZIR: 0}
    for l in linhas:
        contagem[l["status"]] += 1

    tabela = [
        f"| {celula(l['data'])} | {celula(l['dia'])} | {celula(l['horario'])} "
        f"| {celula(l['codigo'])} | {celula(l['tema'])} | {celula(l['titulo'])} "
        f"| {celula(l['categoria'])} | {celula(l['slug'])} | **{l['status']}** |"
        for l in linhas
    ]

    partes = [
        "# Calendário editorial — Mente Curiosa",
        "",
        "Gerado por `scripts/gerar_calendario_editorial.py`. Não editar à mão.",
        "",
        "## Resumo",
        "",
        f"- Total: **{len(linhas)}**",
        f"- PUBLICADO: **{contagem[PUBLICADO]}**",
        f"- A PRODUZIR: **{contagem[A_PRODUZIR]}**",
        f"- FALHA: **{contagem[FALHA]}**",
        "",
        "## Calendário",
        "",
        "| Data | Dia | Horário | Código | Tema | Título | Categoria | Slug | Status |",
        "|---|---|---|---|---|---|---|---|---|",
        *tabela,
        "",
    ]

    with open(SAIDA, "w", encoding="utf-8", newline="\n") as f:
        f.write("\n".join(partes))
    print(f"Gerado {SAIDA}: {len(linhas)} linhas — {contagem}")


if __name__ == "__main__":
    gerar()
