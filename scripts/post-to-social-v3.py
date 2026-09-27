#!/usr/bin/env python3
"""
Posta 15 pins/dia em 5 perfis Pinterest
- 3 artigos × 5 variações (imagem + copy ÚNICOS por perfil)
- Distribuição: artigo_1_perfil_1, artigo_1_perfil_2, ..., artigo_3_perfil_5

Usa:
- PEXELS_API_KEY (5 imagens diferentes por artigo)
- GEMINI_API_KEY (5 copies diferentes por artigo)
- IFTTT_PINTEREST_PROFILE_1..5 (webhooks para cada perfil)
"""

import os
import json
import requests
import time
from datetime import datetime

# Config
PEXELS_API_KEY = os.getenv("PEXELS_API_KEY")
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
IFTTT_WEBHOOKS = {
    1: os.getenv("IFTTT_PINTEREST_PROFILE_1"),
    2: os.getenv("IFTTT_PINTEREST_PROFILE_2"),
    3: os.getenv("IFTTT_PINTEREST_PROFILE_3"),
    4: os.getenv("IFTTT_PINTEREST_PROFILE_4"),
    5: os.getenv("IFTTT_PINTEREST_PROFILE_5"),
}

PEXELS_URL = "https://api.pexels.com/v1/search"
GEMINI_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent"

def fetch_pexels_image(query, page=1):
    """Busca 1 imagem diferente do Pexels"""
    headers = {"Authorization": PEXELS_API_KEY}
    params = {"query": query, "per_page": 1, "page": page}
    
    response = requests.get(PEXELS_URL, headers=headers, params=params)
    response.raise_for_status()
    
    data = response.json()
    if not data.get("photos"):
        return None
    
    photo = data["photos"][0]
    return photo["src"]["large"]

def post_to_ifttt(profile_num, image_url, title, description, hashtags, article_slug):
    """Posta 1 pin em 1 perfil via webhook IFTTT"""
    webhook_url = IFTTT_WEBHOOKS[profile_num]
    if not webhook_url:
        print(f"❌ IFTTT_PINTEREST_PROFILE_{profile_num} não configurada")
        return False
    
    payload = {
        "value1": title,
        "value2": f"{description} {hashtags}",
        "value3": f"https://mentecuriosa.blog/{article_slug}",
        "value4": image_url,
        "value5": hashtags,
    }
    
    try:
        response = requests.post(webhook_url.replace("{event}", "pinterest_post"), json=payload)
        response.raise_for_status()
        print(f"✅ Pin postado no Perfil {profile_num}")
        return True
    except Exception as e:
        print(f"❌ Erro ao postar no Perfil {profile_num}: {e}")
        return False

def process_article(article_data):
    """
    Processa 1 artigo:
    - Busca 5 imagens diferentes (uma por perfil)
    - Gera 5 copies diferentes (uma por perfil)
    - Posta em cada um dos 5 perfis
    """
    title = article_data["title"]
    slug = article_data["slug"]
    excerpt = article_data.get("excerpt", "")
    
    print(f"\n📝 Processando: {title}")
    
    # Buscar 5 imagens diferentes
    images = []
    for i in range(1, 6):
        print(f"  🖼️ Buscando imagem {i}...")
        img = fetch_pexels_image(title, page=i)
        if img:
            images.append(img)
            time.sleep(0.5)  # Respeitar rate limit
        else:
            print(f"  ⚠️ Imagem {i} não encontrada, usando fallback")
            images.append(None)
    
    # Gerar 5 copies diferentes via Gemini
    print(f"  ✍️ Gerando 5 variações de copy...")
    copies = generate_variants(title, slug, excerpt)
    
    # Postar em cada perfil
    for profile_num in range(1, 6):
        print(f"  📌 Postando no Perfil {profile_num}...")
        
        image = images[profile_num - 1] or images[0]  # Fallback
        copy_data = copies.get(f"profile_{profile_num}", {})
        
        post_to_ifttt(
            profile_num,
            image,
            copy_data.get("title", title),
            copy_data.get("description", excerpt),
            copy_data.get("hashtags", "#mentecuriosa"),
            slug
        )
        
        time.sleep(1)  # Delay entre posts (1s por perfil)

def generate_variants(title, slug, excerpt):
    """Gera 5 variações via Gemini (ou retorna mock)"""
    # Mock para teste (substitua com chamada real do Gemini se necessário)
    return {
        "profile_1": {
            "title": f"{title} - Curiosidade",
            "description": f"{excerpt} Saiba mais neste artigo.",
            "hashtags": "#curiosidade #ciencia"
        },
        "profile_2": {
            "title": f"{title} - Você sabia?",
            "description": f"Fato surpreendente: {excerpt}",
            "hashtags": "#fato #psicologia"
        },
        "profile_3": {
            "title": f"{title} - Descubra",
            "description": f"Explore: {excerpt}",
            "hashtags": "#descoberta #conhecimento"
        },
        "profile_4": {
            "title": f"{title} - Por que?",
            "description": f"A resposta: {excerpt}",
            "hashtags": "#pergunta #resposta"
        },
        "profile_5": {
            "title": f"{title} - Saiba tudo",
            "description": f"Guia completo: {excerpt}",
            "hashtags": "#guia #completo"
        },
    }

def main():
    """Processa 3 artigos (entrada via env ou hardcoded)"""
    
    # Mock articles (substitua com dados reais do blog)
    articles = [
        {
            "title": "Por que bocejamos?",
            "slug": "por-que-bocejamos",
            "excerpt": "A ciência por trás de um dos maiores mistérios do corpo humano"
        },
        {
            "title": "Efeito Mandela",
            "slug": "efeito-mandela-memoria-falsa",
            "excerpt": "Por que tantas pessoas compartilham as mesmas memórias falsas"
        },
        {
            "title": "Por que sonhamos?",
            "slug": "por-que-sonhamos",
            "excerpt": "O que a ciência já sabe e o que ainda é mistério"
        },
    ]
    
    print(f"\n🚀 Iniciando distribuição: {datetime.now()}")
    print(f"📊 {len(articles)} artigos × 5 perfis = 15 pins")
    
    for article in articles:
        process_article(article)
    
    print(f"\n✅ Distribuição concluída!")

if __name__ == "__main__":
    main()
