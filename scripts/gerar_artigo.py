"""Gera um artigo por pauta com o Gemini (fallback: Claude) e grava em src/content/artigos/.

Mesma lógica do gerador do modelo (automacao_seo_ia/scripts/gerar_artigo_gemini.py):
- Gemini primeiro, com novas tentativas e troca de modelo quando está ocupado;
- se o artigo reprova na validação, reescreve com a lista exata do que falhou;
- Claude assume quando o Gemini falha de vez.

Entrada: pauta `planejado` na planilha, com briefing em dados/briefings/<slug>.md.
Saída: src/content/artigos/<slug>.md, só se passar em todas as validações e a nota
for 9,0 ou mais, com a foto de capa baixada da Pexels. Falha grava
dados/artigos_falhas/<slug>.txt com o motivo.

Uso: GEMINI_API_KEY=... CLAUDE_API_KEY=... PEXELS_API_KEY=... LIMITE=1 python scripts/gerar_artigo.py
"""

import csv
import datetime as dt
import json
import os
import random
import re
import sys
import time
import unicodedata
from concurrent.futures import ThreadPoolExecutor
from zoneinfo import ZoneInfo

import requests

CSV_PATH = "dados/calendario_mente_curiosa.csv"
BRIEFING_DIR = "dados/briefings"
FALHA_DIR = "dados/artigos_falhas"
PROMPT_PATH = "prompts/prompt_mestre_mente_curiosa.md"
ARTIGO_DIR = "src/content/artigos"
CATEGORIAS_TS = "src/config/categories.ts"
ESTADO_PATH = "dados/llm_estado.json"

API_GEMINI = "https://generativelanguage.googleapis.com/v1beta"
URL_ANTHROPIC = "https://api.anthropic.com/v1/messages"
GEMINI_MODEL = os.environ.get("GEMINI_MODEL", "gemini-3.8-flash")
CLAUDE_MODEL = os.environ.get("CLAUDE_MODEL", "claude-haiku-5-5")
RODADAS_REESCRITA = int(os.environ.get("RODADAS_REESCRITA") or 1)
PAUSA_ENTRE_CHAMADAS = float(os.environ.get("PAUSA_ENTRE_CHAMADAS") or 15)
NOTA_MINIMA = 9.0
COLS = 23
COL_ART, COL_KW, COL_H1, COL_CAT, COL_CLUSTER, COL_SLUG, COL_STATUS = 5, 7, 8, 9, 10, 15, 16


def hoje():
    return dt.datetime.now(ZoneInfo("America/Sao_Paulo")).date().isoformat()


def normaliza(s):
    s = unicodedata.normalize("NFKD", s).encode("ascii", "ignore").decode()
    return re.sub(r"[^a-z0-9]+", "-", s.lower()).strip("-")


def categorias_validas():
    """Lê os slugs de src/config/categories.ts para não duplicar a lista."""
    return re.findall(r"slug:\s*'([^']+)'", open(CATEGORIAS_TS, encoding="utf-8").read())


# ---------- Geração (mesma lógica do modelo) ----------

def pausa():
    if PAUSA_ENTRE_CHAMADAS:
        time.sleep(PAUSA_ENTRE_CHAMADAS)


def chamar_gemini(prompt, chave, modelo):
    pausa()
    r = requests.post(
        f"{API_GEMINI}/models/{modelo}:generateContent",
        headers={"x-goog-api-key": chave, "Content-Type": "application/json"},
        json={"contents": [{"parts": [{"text": prompt}]}]},
        timeout=180,
    )
    if r.status_code != 200:
        raise RuntimeError(f"HTTP {r.status_code}: {r.text[:200]}")
    partes = r.json().get("candidates", [{}])[0].get("content", {}).get("parts", [])
    texto = "".join(p.get("text", "") for p in partes).strip()
    if not texto:
        raise RuntimeError("resposta vazia")
    return texto


def gerar_gemini(prompt, chave):
    """Uma única chamada. Qualquer erro (cota, permissão, indisponível) passa ao Claude."""
    return chamar_gemini(prompt, chave, GEMINI_MODEL)


def chamar_claude(prompt, chave):
    r = requests.post(
        URL_ANTHROPIC,
        headers={"x-api-key": chave, "anthropic-version": "2023-06-01", "content-type": "application/json"},
        json={"model": CLAUDE_MODEL, "max_tokens": 16000, "messages": [{"role": "user", "content": prompt}]},
        timeout=300,
    )
    if r.status_code != 200:
        raise RuntimeError(f"Claude HTTP {r.status_code}: {r.text[:200]}")
    return "".join(b.get("text", "") for b in r.json().get("content", []) if b.get("type") == "text").strip()


# Depois que o Gemini falha de vez (ex.: limite 429), a pauta inteira segue no Claude.
# Reinicia a cada pauta, em gera_validado.
usar_claude = False


def le_estado():
    """Se o Gemini falhou hoje, o provedor do dia fica 'claude' até a virada do dia."""
    try:
        with open(ESTADO_PATH, encoding="utf-8") as f:
            est = json.load(f)
        return est.get("provedor") if est.get("data") == hoje() else None
    except (OSError, ValueError):
        return None


def grava_estado(provedor):
    os.makedirs(os.path.dirname(ESTADO_PATH), exist_ok=True)
    with open(ESTADO_PATH, "w", encoding="utf-8") as f:
        json.dump({"data": hoje(), "provedor": provedor}, f)


def gerar_uma(prompt):
    """Gemini primeiro; se falhar de vez, Claude assume e fica com a pauta. Devolve (texto, provedor)."""
    global usar_claude
    gem = os.environ.get("GEMINI_API_KEY", "").strip()
    cla = os.environ.get("CLAUDE_API_KEY", "").strip()
    erro = None
    if gem and not usar_claude:
        try:
            return gerar_gemini(prompt, gem), "gemini"
        except (RuntimeError, requests.RequestException) as e:
            erro = e
            usar_claude = True
            grava_estado("claude")
            print(f"↪️ Gemini falhou, pauta segue no Claude: {e}")
    if not cla:
        raise RuntimeError(f"sem fallback (CLAUDE_API_KEY ausente). Gemini: {erro}")
    return chamar_claude(prompt, cla), "claude"


def montar_reescrita(prompt, anterior, problemas):
    """Mensagem de correção: o artigo anterior e a lista exata do que reprovou."""
    return (
        f"{prompt}\n\n=================== REESCRITA ===================\n"
        "O artigo abaixo foi reprovado na validação. Corrija SOMENTE os problemas listados e mantenha o que já estava bom.\n"
        "Devolva o artigo completo em Markdown com frontmatter e, depois, a análise de pontuação.\n\n"
        "PROBLEMAS A CORRIGIR:\n" + "\n".join(f"- {p}" for p in problemas) + "\n\n"
        "ARTIGO REPROVADO:\n" + (anterior or "(sem resposta válida)")
    )


# ---------- Interpretação e validação ----------

def separa_frontmatter(texto):
    # Tira cerca de código (```markdown ... ```) e texto antes do frontmatter, se o modelo puser
    texto = re.sub(r"^.*?(?=^---\s*$)", "", texto.strip(), count=1, flags=re.S | re.M)
    texto = re.sub(r"^```\w*\s*$|^```\s*$", "", texto, flags=re.M).strip() + "\n"
    m = re.match(r"\s*---\n(.*?)\n---\n(.*)", texto, flags=re.S)
    if not m:
        raise RuntimeError("resposta sem frontmatter")
    fm = {}
    for linha in m.group(1).splitlines():
        if ":" in linha and not linha.startswith(" "):
            chave, valor = linha.split(":", 1)
            fm[chave.strip()] = valor.strip()
    fm["tags"] = [t.strip() for t in re.findall(r"^\s+-\s+(.+)$", m.group(1), flags=re.M)]
    return fm, m.group(2)


def separa_analise(corpo):
    """A análise de pontuação vem depois de uma linha '---' e não é publicada."""
    partes = re.split(r"\n---\n", corpo)
    if len(partes) > 1 and re.search(r"Nota final", partes[-1]):
        corpo = "\n---\n".join(partes[:-1])
    nota = re.search(r"Nota final:\s*\**\s*(\d+[,.]\d)", corpo + partes[-1] if len(partes) > 1 else corpo)
    return corpo.strip() + "\n", float(nota.group(1).replace(",", ".")) if nota else None


def verifica_link(url):
    try:
        r = requests.get(url, headers={"User-Agent": "MenteCuriosaBot/1.0"}, timeout=8, allow_redirects=True)
        return r.status_code == 200
    except requests.RequestException:
        return False


def fontes_do_corpo(corpo):
    """Pega a seção '## Fontes' e extrai título e URL de cada linha com link."""
    m = re.search(r"^## Fontes\s*$(.*)", corpo, flags=re.M | re.S)
    if not m:
        return []
    fontes = []
    for linha in m.group(1).splitlines():
        url = re.search(r"https?://[^\s)>\]]+", linha)
        if not url:
            continue
        titulo = re.sub(r"\[|\]|\(.*", "", linha.replace(url.group(0), "")).strip(" -*:|")
        fontes.append({"title": titulo or url.group(0), "url": url.group(0)})
    return fontes


def valida(fm, corpo, nota):
    """Lista o que impede publicar. Lista vazia = aprovado."""
    problemas = []
    if nota is None or nota < NOTA_MINIMA:
        problemas.append(f"nota {nota} (mínimo {NOTA_MINIMA})")
    sem_marcadores = re.sub(r"<img\b[^>]*>", "", corpo)
    palavras = len(sem_marcadores.split())
    if not 1000 <= palavras <= 1600:
        problemas.append(f"{palavras} palavras no corpo (1.000 a 1.600)")
    if re.search(r"^# ", corpo, flags=re.M):
        problemas.append("H1 no corpo (o título vem do frontmatter)")
    if len(re.findall(r"^## ", corpo, flags=re.M)) < 4:
        problemas.append("menos de 4 seções ##")
    if not re.search(r"^## Resumindo", corpo, flags=re.M):
        problemas.append("falta a seção Resumindo")
    if not re.search(r"^## Fontes", corpo, flags=re.M):
        problemas.append("falta a seção Fontes")
    primeiro = next((p for p in corpo.split("\n\n") if p.strip() and not p.lstrip().startswith("#")), "")
    if len(primeiro.split()) > 50:
        problemas.append("primeiro parágrafo com mais de 50 palavras")
    if re.search(r"\bCRM\b|\bcura\b", corpo, flags=re.I):
        problemas.append("palavra proibida (CRM ou cura)")
    fontes = fontes_do_corpo(corpo)
    if len(fontes) < 3:
        problemas.append(f"{len(fontes)} fontes com link (mínimo 3)")
    else:
        with ThreadPoolExecutor(max_workers=6) as pool:
            abertas = sum(pool.map(verifica_link, [f["url"] for f in fontes[:6]]))
        if abertas < 2:
            problemas.append(f"só {abertas} fonte(s) abrem (mínimo 2)")
    if not (10 <= len(fm.get("title", "")) <= 110):
        problemas.append("título fora de 10 a 110 caracteres")
    if not (70 <= len(fm.get("description", "")) <= 160):
        problemas.append("descrição fora de 70 a 160 caracteres")
    return problemas


def planos_de_imagem(corpo):
    """Converte os marcadores <img data-pexels> em plano de imagens e remove do corpo."""
    fotos, secao, saida = [], 0, []
    for linha in corpo.splitlines():
        if linha.startswith("## "):
            secao += 1
        for m in re.finditer(r'<img\b[^>]*data-pexels="([^"]+)"[^>]*alt="([^"]+)"[^>]*>', linha):
            fotos.append({"busca": m.group(1), "alt": m.group(2), "secao": max(secao, 1)})
        saida.append(re.sub(r"<img\b[^>]*>", "", linha).rstrip())
    if not fotos:
        raise RuntimeError("sem marcadores <img data-pexels> no corpo")
    corpo_limpo = re.sub(r"\n{3,}", "\n\n", "\n".join(saida)).strip() + "\n"
    return corpo_limpo, fotos[0]


# ---------- Capa e escrita ----------

def baixa_capa(slug, busca, alt):
    """Busca a foto na Pexels, converte para .webp em public/images/<slug>/ e devolve os campos da capa."""
    from io import BytesIO
    from PIL import Image

    chave = os.environ.get("PEXELS_API_KEY", "").strip()
    if not chave:
        raise RuntimeError("sem PEXELS_API_KEY: capa não pode ser baixada")
    r = requests.get(
        "https://api.pexels.com/v1/search",
        headers={"Authorization": chave},
        params={"query": busca, "per_page": 5, "orientation": "landscape"},
        timeout=30,
    )
    if r.status_code != 200:
        raise RuntimeError(f"Pexels HTTP {r.status_code}")
    fotos = r.json().get("photos", [])
    if not fotos:
        raise RuntimeError(f"Pexels sem foto para: {busca}")
    foto = fotos[0]
    bruta = requests.get(foto["src"]["large"], timeout=60).content
    im = Image.open(BytesIO(bruta)).convert("RGB")
    im.thumbnail((1200, 1200))
    pasta = os.path.join("public", "images", slug)
    os.makedirs(pasta, exist_ok=True)
    arquivo = f"{slug}.webp"
    im.save(os.path.join(pasta, arquivo), "WEBP", quality=82)
    return {
        "src": f"/images/{slug}/{arquivo}",
        "alt": alt,
        "credit": {
            "author": foto.get("photographer", "Pexels"),
            "url": foto.get("url"),
        },
    }


def escreve_artigo(slug, fm, corpo, capa, fontes):
    def q(v):
        return json.dumps(v, ensure_ascii=False)

    data = hoje()
    linhas = [
        "---",
        f"id: {fm['id']}",
        f"title: {q(fm['title'])}",
        f"slug: {slug}",
        f"description: {q(fm['description'])}",
        f"category: {fm['category']}",
        "tags:",
        *[f"  - {q(t)}" for t in fm["tags"]],
        f"keyword: {q(fm['keyword'])}",
        "author: Equipe Mente Curiosa",
        f"datePublished: {data}",
        f"dateModified: {data}",
        f"featuredImage: {capa['src']}",
        f"featuredImageAlt: {q(capa['alt'])}",
        "imageCredit:",
        "  author: " + q(capa["credit"]["author"]),
        "  source: Pexels",
        f"  url: {capa['credit']['url']}",
        '  license: "Licença Pexels"',
        "  licenseUrl: https://www.pexels.com/license/",
        "sources:",
    ]
    for f in fontes:
        linhas += [f"  - title: {q(f['title'])}", f"    url: {q(f['url'])}"]
    linhas += ["---", ""]
    os.makedirs(ARTIGO_DIR, exist_ok=True)
    caminho = os.path.join(ARTIGO_DIR, f"{slug}.md")
    with open(caminho, "w", encoding="utf-8") as f:
        f.write("\n".join(linhas) + corpo)
    return caminho


def registra_falha(slug, motivo):
    os.makedirs(FALHA_DIR, exist_ok=True)
    with open(os.path.join(FALHA_DIR, f"{slug}.txt"), "w", encoding="utf-8") as f:
        f.write(f"{hoje()} {motivo}\n")


def candidatas(linhas):
    for r in linhas:
        if len(r) < COLS or r[COL_STATUS] != "planejado":
            continue
        slug = r[COL_SLUG]
        if not os.path.exists(os.path.join(BRIEFING_DIR, f"{slug}.md")):
            continue
        if os.path.exists(os.path.join(ARTIGO_DIR, f"{slug}.md")):
            continue
        if os.path.exists(os.path.join(FALHA_DIR, f"{slug}.txt")):
            continue
        yield r


def gera_validado(prompt, slug, kw, cat, art_id):
    """Gera, valida e reescreve até RODADAS_REESCRITA vezes. Devolve os dados prontos para gravar."""
    global usar_claude
    usar_claude = le_estado() == "claude"
    anterior, problemas = None, None
    restam = RODADAS_REESCRITA
    while True:
        atual = prompt if anterior is None else montar_reescrita(prompt, anterior, problemas)
        if anterior is not None:
            print(f"✏️ {slug}: reescrita com a lista de problemas")
        texto, provedor = gerar_uma(atual)
        try:
            fm, corpo = separa_frontmatter(texto)
            fm["id"], fm["category"], fm["keyword"] = art_id, cat, kw
            corpo, nota = separa_analise(corpo)
            corpo, plano = planos_de_imagem(corpo)
            problemas = valida(fm, corpo, nota)
        except RuntimeError as e:
            problemas = [str(e)]
        if not problemas:
            return fm, corpo, nota, plano, provedor
        print(f"↪️ {provedor} reprovado: {'; '.join(problemas)}")
        if provedor == "gemini" and not usar_claude:
            # Gemini reprovado na validação: Claude assume a pauta e o restante do dia
            # (mesma regra de erro de API). Recomeça do prompt original, sem reescrita do Gemini.
            usar_claude = True
            grava_estado("claude")
            anterior, problemas = None, None
            restam = RODADAS_REESCRITA  # o Claude tem as suas próprias reescritas
            print("↪️ pauta e restante do dia seguem no Claude")
            continue
        if restam == 0:
            raise RuntimeError("; ".join(problemas))
        restam -= 1
        anterior = texto  # Claude (ou Gemini já trocado) corrige o próprio texto


def main():
    limite = int(os.environ.get("LIMITE", "1") or 1)
    cats = categorias_validas()
    linhas = list(csv.reader(open(CSV_PATH, encoding="utf-8", newline="")))
    modelo = open(PROMPT_PATH, encoding="utf-8").read().replace("{{DATA_HOJE}}", hoje())
    feitos = 0

    tentadas = 0
    for r in candidatas(linhas):
        # Conta tentativas, não só sucessos: senão uma pauta que falha faz o run
        # passar pela fila inteira (com limite 1, testou as 10).
        if tentadas >= limite:
            break
        tentadas += 1
        slug, kw = r[COL_SLUG], r[COL_KW]
        cat = normaliza(r[COL_CAT])
        if cat not in cats:
            registra_falha(slug, f"categoria da planilha não existe no site: {r[COL_CAT]}")
            print(f"FALHA {slug}: categoria {r[COL_CAT]}")
            continue
        briefing = open(os.path.join(BRIEFING_DIR, f"{slug}.md"), encoding="utf-8").read()
        prompt = modelo + (
            f"\n\n## Pauta\n- id: {r[COL_ART]}\n- palavra-chave: {kw}\n- H1 sugerido: {r[COL_H1]}\n"
            f"- categoria (slug): {cat}\n- slug: {slug}\n- tags sugeridas: {r[COL_CLUSTER]}\n"
            f"\n## Briefing SERP\n{briefing}\n"
        )
        try:
            fm, corpo, nota, plano, provedor = gera_validado(prompt, slug, kw, cat, r[COL_ART])
            capa = baixa_capa(slug, plano["busca"], plano["alt"])
            caminho = escreve_artigo(slug, fm, corpo, capa, fontes_do_corpo(corpo))
            print(f"OK    {slug} ({provedor}, nota {nota}) -> {caminho}")
            feitos += 1
        except Exception as e:  # uma pauta falha sem parar as outras
            registra_falha(slug, str(e)[:500])
            print(f"FALHA {slug}: {e}")
    print(f"Artigos gerados: {feitos}")


if __name__ == "__main__":
    sys.exit(main())
