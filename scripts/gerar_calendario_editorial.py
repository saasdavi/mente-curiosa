"""Gera dados/calendario_editorial.md a partir do calendário CSV e dos artigos do blog.

Uso: python scripts/gerar_calendario_editorial.py

Status de cada pauta (3 tipos):
- PUBLICADO: o slug está em src/content/artigos/ (no ar, com link e deploy)
- FALHA: o slug tem arquivo em dados/artigos_falhas/ (falhou; revisar erros)
- A PRODUZIR: pauta para o ChatGPT produzir (todo o resto)

O CSV continua sendo a fonte. O .md é gerado e não deve ser editado à mão.
"""

import csv
import os
import re

CSV_PATH = "dados/calendario_mente_curiosa.csv"
ARTIGOS_DIR = "src/content/artigos"
FALHAS_DIR = "dados/artigos_falhas"
SAIDA = "dados/calendario_editorial.md"

PUBLICADO, FALHA, A_PRODUZIR = "PUBLICADO", "FALHA", "A PRODUZIR"

# Índices das colunas do CSV (não há cabeçalho)
COL_CODIGO, COL_DATA, COL_ISO, COL_DIA, COL_HORARIO = 0, 1, 2, 3, 4
COL_TEMA, COL_TITULO, COL_CATEGORIA, COL_SLUG, COL_STATUS = 7, 8, 9, 15, 16


def celula(texto):
    return str(texto).replace("|", "\\|").replace("\n", " ").strip()


def ler_calendario():
    with open(CSV_PATH, encoding="utf-8", newline="") as f:
        return [r for r in csv.reader(f) if r and r[0].startswith("CAL")]


def ler_artigos():
    """Devolve {slug: {titulo, data, categoria}} lido do frontmatter de cada .md."""
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
            "data": campo("datePublished"),
            "categoria": campo("category"),
        }
    return artigos


def ler_falhas():
    """Devolve o conjunto de slugs com arquivo em dados/artigos_falhas/."""
    if not os.path.isdir(FALHAS_DIR):
        return set()
    return {nome[:-4] for nome in os.listdir(FALHAS_DIR) if nome.endswith(".txt")}


def status_da_pauta(linha, artigos, falhas):
    if linha[COL_SLUG] in artigos:
        return PUBLICADO
    if linha[COL_SLUG] in falhas:
        return FALHA
    return A_PRODUZIR


def gerar():
    calendario = ler_calendario()
    artigos = ler_artigos()
    falhas = ler_falhas()
    slugs_calendario = {r[COL_SLUG] for r in calendario}

    calendario.sort(key=lambda r: (r[COL_ISO], r[COL_HORARIO]))
    contagem = {PUBLICADO: 0, FALHA: 0, A_PRODUZIR: 0}
    linhas = []
    divergencias = []
    for r in calendario:
        status = status_da_pauta(r, artigos, falhas)
        contagem[status] += 1
        if status == PUBLICADO and r[COL_STATUS] != "publicado":
            divergencias.append(r)
        linhas.append(
            f"| {celula(r[COL_DATA])} | {celula(r[COL_DIA])} | {celula(r[COL_HORARIO])} "
            f"| {celula(r[COL_CODIGO])} | {celula(r[COL_TEMA])} | {celula(r[COL_TITULO])} "
            f"| {celula(r[COL_CATEGORIA])} | {celula(r[COL_SLUG])} | **{status}** |"
        )

    fora = sorted(
        ((slug, info) for slug, info in artigos.items() if slug not in slugs_calendario),
        key=lambda item: item[1]["data"],
    )

    partes = [
        "# Calendário editorial — Mente Curiosa",
        "",
        "Gerado por `scripts/gerar_calendario_editorial.py` a partir de "
        "`dados/calendario_mente_curiosa.csv` e `src/content/artigos/`. Não editar à mão.",
        "",
        "## Resumo",
        "",
        f"- Pautas no calendário: **{len(calendario)}**",
        f"- Publicados no total (no ar): **{len(artigos)}** "
        f"({contagem[PUBLICADO]} no calendário + {len(fora)} fora dele)",
        f"- PUBLICADO no calendário: **{contagem[PUBLICADO]}**",
        f"- A PRODUZIR (ChatGPT vai produzir): **{contagem[A_PRODUZIR]}**",
        f"- FALHA (revisar erros): **{contagem[FALHA]}**",
        f"- Publicados fora do calendário: **{len(fora)}** (seção no fim do arquivo)",
        "",
        "## Calendário",
        "",
        "| Data | Dia | Horário | Código | Tema | Título | Categoria | Slug | Status |",
        "|---|---|---|---|---|---|---|---|---|",
        *linhas,
        "",
    ]

    if divergencias:
        partes += [
            "## Divergências",
            "",
            "Pautas já publicadas no blog, mas ainda marcadas como `planejado` no CSV.",
            "Corrigir no CSV quando for conveniente.",
            "",
            "| Data | Código | Slug |",
            "|---|---|---|",
            *[f"| {celula(r[COL_DATA])} | {celula(r[COL_CODIGO])} | {celula(r[COL_SLUG])} |" for r in divergencias],
            "",
        ]

    partes += [
        "## Publicados fora do calendário",
        "",
        "| Data de publicação | Título | Categoria | Slug |",
        "|---|---|---|---|",
        *[
            f"| {celula(info['data'])} | {celula(info['titulo'])} | {celula(info['categoria'])} | {celula(slug)} |"
            for slug, info in fora
        ],
        "",
    ]

    with open(SAIDA, "w", encoding="utf-8", newline="\n") as f:
        f.write("\n".join(partes))
    print(f"Gerado {SAIDA}: {len(calendario)} pautas, {len(fora)} fora do calendário")


if __name__ == "__main__":
    gerar()
