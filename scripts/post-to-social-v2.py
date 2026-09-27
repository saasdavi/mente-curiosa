#!/usr/bin/env python3

"""
post-to-social-v2.py
Distribui 5 Pins no Pinterest (com delay entre cada) + 1 post no Facebook
Usa variações pré-geradas por Gemini API
"""

import json
import os
import time
import sys
import requests
from datetime import datetime

# Variáveis de ambiente
IFTTT_PINTEREST_WEBHOOK = os.getenv('IFTTT_PINTEREST_WEBHOOK')
IFTTT_FACEBOOK_WEBHOOK = os.getenv('IFTTT_FACEBOOK_WEBHOOK')
ARTICLE_SLUG = os.getenv('ARTICLE_SLUG')
ARTICLE_URL = os.getenv('ARTICLE_URL', 'https://mentecuriosa.blog')
VARIANTS_FILE = os.getenv('VARIANTS_FILE')
IMAGE_URLS = os.getenv('IMAGE_URLS', '').split('|')  # Múltiplas imagens separadas por |

# Validações
if not all([IFTTT_PINTEREST_WEBHOOK, IFTTT_FACEBOOK_WEBHOOK, ARTICLE_SLUG, VARIANTS_FILE]):
    print("❌ Faltam variáveis de ambiente necessárias")
    print("   Obrigatórias: IFTTT_PINTEREST_WEBHOOK, IFTTT_FACEBOOK_WEBHOOK, ARTICLE_SLUG, VARIANTS_FILE")
    sys.exit(1)

DELAY_BETWEEN_PINS = 3600  # 1 hora entre cada Pin (evita parecer bot)

def load_variants():
    """Carrega arquivo de variações gerado pelo Gemini"""
    try:
        with open(VARIANTS_FILE, 'r', encoding='utf-8') as f:
            return json.load(f)
    except FileNotFoundError:
        print(f"❌ Arquivo de variações não encontrado: {VARIANTS_FILE}")
        sys.exit(1)
    except json.JSONDecodeError:
        print(f"❌ Arquivo JSON inválido: {VARIANTS_FILE}")
        sys.exit(1)

def post_to_webhook(webhook_url, platform, title, description, image_url, article_url, hashtags):
    """Posta para webhook IFTTT"""
    
    payload = {
        'value1': title,
        'value2': description,
        'value3': article_url,
    }
    
    if image_url:
        payload['value4'] = image_url
    if hashtags:
        payload['value5'] = hashtags
    
    try:
        response = requests.post(webhook_url, json=payload, timeout=10)
        
        if response.status_code == 200:
            print(f"   ✅ {platform} OK")
            return True
        else:
            print(f"   ⚠️  {platform} retornou {response.status_code}")
            return False
    except Exception as e:
        print(f"   ❌ Erro: {str(e)}")
        return False

def main():
    print(f"\n🚀 Distribuição Social: 5 Pins Pinterest + 1 Post Facebook")
    print(f"   Artigo: {ARTICLE_SLUG}")
    print(f"   Horário início: {datetime.now().strftime('%H:%M:%S')}\n")
    
    # Carrega variações
    variants_data = load_variants()
    variations = variants_data.get('variations', [])
    
    if not variations or len(variations) != 5:
        print(f"❌ Esperava 5 variações, encontrou {len(variations)}")
        sys.exit(1)
    
    # URL completa do artigo
    full_article_url = f"{ARTICLE_URL}/blog/{ARTICLE_SLUG}"
    
    print(f"📌 Variações carregadas: {len(variations)}\n")
    
    pinterest_success = 0
    facebook_posted = False
    
    # ========== PINTEREST: 5 PINS COM DELAY ==========
    print("📍 PINTEREST (5 Pins com delay de 1h entre cada):\n")
    
    for i, var in enumerate(variations, 1):
        title = var.get('title', '')
        description = var.get('description', '')
        hashtags = var.get('hashtags', '')
        angle = var.get('angle', 'variação')
        
        # Seleciona imagem (usa a mesma ou varia se tiver múltiplas)
        image_url = IMAGE_URLS[i-1] if i-1 < len(IMAGE_URLS) else IMAGE_URLS[0]
        
        print(f"{i}️⃣  Pin {i} ({angle}):")
        print(f"   Título: {title[:60]}...")
        print(f"   Descrição: {description[:60]}...")
        
        success = post_to_webhook(
            IFTTT_PINTEREST_WEBHOOK,
            f"Pinterest Pin {i}",
            title,
            description,
            image_url,
            full_article_url,
            hashtags
        )
        
        if success:
            pinterest_success += 1
        
        # Delay entre pins (exceto no último)
        if i < 5:
            print(f"   ⏱️  Esperando {DELAY_BETWEEN_PINS}s antes do próximo Pin...\n")
            time.sleep(DELAY_BETWEEN_PINS)
        else:
            print()
    
    # ========== FACEBOOK: 1 POST (usa primeira variação) ==========
    print("📍 FACEBOOK (1 Post com primeira variação):\n")
    
    var_fb = variations[0]
    title_fb = var_fb.get('title', '')
    description_fb = var_fb.get('description', '')
    hashtags_fb = var_fb.get('hashtags', '')
    image_url_fb = IMAGE_URLS[0]
    
    print(f"1️⃣  Post Facebook:")
    print(f"   Título: {title_fb}")
    print(f"   Descrição: {description_fb}\n")
    
    facebook_posted = post_to_webhook(
        IFTTT_FACEBOOK_WEBHOOK,
        "Facebook",
        title_fb,
        description_fb,
        image_url_fb,
        full_article_url,
        hashtags_fb
    )
    
    # ========== RESUMO ==========
    print(f"\n{'='*60}")
    print(f"📊 RESUMO:")
    print(f"   Pinterest Pins: {pinterest_success}/5 ✅")
    print(f"   Facebook: {'✅' if facebook_posted else '❌'}")
    print(f"   Total: {pinterest_success + (1 if facebook_posted else 0)}/6")
    print(f"   Tempo total: ~{(pinterest_success - 1) * DELAY_BETWEEN_PINS}s (delays entre pins)")
    print(f"{'='*60}\n")
    
    if pinterest_success == 5 and facebook_posted:
        print("✅ Distribuição 100% concluída!")
        return 0
    else:
        print("⚠️  Distribuição parcial (cheque logs acima)")
        return 1

if __name__ == '__main__':
    sys.exit(main())
