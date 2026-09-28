#!/usr/bin/env python3
import os
import json
import requests
import feedparser
from dotenv import load_dotenv
import anthropic

load_dotenv()

CLAUDE_API_KEY = os.getenv("CLAUDE_API_KEY")
PINTEREST_PROFILE_ID = os.getenv("PINTEREST_PROFILE_ID")
PEXELS_API_KEY = os.getenv("PEXELS_API_KEY", "")
PINTEREST_COOKIES_STR = os.getenv("PINTEREST_COOKIES", "{}")

try:
    PINTEREST_COOKIES = json.loads(PINTEREST_COOKIES_STR)
except:
    PINTEREST_COOKIES = {}

MENTE_CURIOSA_RSS = "https://mentecuriosa.blog/feed"

def validate_config():
    print("🔍 Validando configurações...\n")
    missing = []
    if not CLAUDE_API_KEY:
        missing.append("❌ CLAUDE_API_KEY não configurada")
    else:
        print("✅ CLAUDE_API_KEY: configurada")
    if not PINTEREST_PROFILE_ID:
        missing.append("❌ PINTEREST_PROFILE_ID não configurado")
    else:
        print(f"✅ PINTEREST_PROFILE_ID: {PINTEREST_PROFILE_ID}")
    if not PINTEREST_COOKIES or "csrftoken" not in PINTEREST_COOKIES:
        missing.append("❌ PINTEREST_COOKIES inválidos")
    else:
        print("✅ PINTEREST_COOKIES: configurados")
    if missing:
        return False
    print("\n✨ Todas as configurações OK!\n")
    return True

def fetch_latest_post():
    print("📡 Buscando último post do RSS Mente Curiosa...")
    try:
        feed = feedparser.parse(MENTE_CURIOSA_RSS)
        if not feed.entries:
            return None
        entry = feed.entries[0]
        post = {
            "title": entry.title,
            "link": entry.link,
            "summary": entry.get("summary", "")[:200],
        }
        print(f"✅ Post encontrado: {post['title'][:60]}...\n")
        return post
    except:
        return None

def get_image(keyword):
    print(f"🖼️  Buscando imagem...")
    return "https://via.placeholder.com/1000x1000?text=Mente+Curiosa"

def generate_caption(title, summary):
    print("✍️  Gerando caption com Claude...\n")
    try:
        client = anthropic.Anthropic(api_key=CLAUDE_API_KEY)
        prompt = f"""Crie uma caption VIRAL para Pinterest:
Título: {title}
Resumo: {summary}
Máximo 150 caracteres, emoji, 3-4 hashtags. RETORNA SOMENTE A CAPTION."""
        message = client.messages.create(
            model="claude-opus-4-6",
            max_tokens=200,
            messages=[{"role": "user", "content": prompt}]
        )
        caption = message.content[0].text.strip()
        print(f"✅ Caption: {caption[:70]}...\n")
        return caption
    except:
        return f"🧠 {title[:80]}... #MenteCuriosa"

def post_to_pinterest(profile_id, image_url, caption, post_link):
    print("📌 POSTANDO NO PINTEREST\n")
    print(f"   Profile: {profile_id}")
    print(f"   Caption: {caption[:60]}...")
    print(f"   Link: {post_link}\n")
    
    session = requests.Session()
    session.cookies.update(PINTEREST_COOKIES)
    headers = {
        "User-Agent": "Mozilla/5.0",
        "X-CSRFToken": PINTEREST_COOKIES.get("csrftoken", ""),
    }
    pin_data = {
        "url": post_link,
        "description": caption,
        "image_url": image_url,
        "board_id": profile_id,
    }
    try:
        print("   → Enviando para Pinterest...")
        response = session.post(
            "https://api.pinterest.com/v3/create/pin/",
            headers=headers,
            json=pin_data,
            timeout=15
        )
        if response.status_code in [200, 201]:
            print(f"   ✅ PIN CRIADO!\n")
            return True
        else:
            print(f"   ⚠️ Erro: {response.status_code}\n")
            return False
    except Exception as e:
        print(f"   ❌ Erro: {str(e)}\n")
        return False

def main():
    print("\n" + "="*70)
    print("🚀 PINTEREST POSTER")
    print("="*70 + "\n")
    if not validate_config():
        return
    post = fetch_latest_post()
    if not post:
        post = {
            "title": "10 Curiosidades",
            "summary": "Curiosidades interessantes",
            "link": "https://mentecuriosa.blog"
        }
    image_url = get_image(post["title"])
    caption = generate_caption(post["title"], post["summary"])
    success = post_to_pinterest(PINTEREST_PROFILE_ID, image_url, caption, post["link"])
    print("="*70)
    if success:
        print("✨ SUCESSO!")
    else:
        print("⚠️  FALHOU")
    print("="*70 + "\n")

if __name__ == "__main__":
    main()
