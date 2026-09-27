#!/usr/bin/env python3
import os
import json
import sys
from datetime import datetime
from google.auth.transport.requests import Request
from google.oauth2.service_account import Credentials
from google.auth.exceptions import DefaultCredentialsError
import anthropic
from googleapiclient.discovery import build

# Setup Google Sheets API
def get_sheets_service():
    creds_json = os.getenv('GOOGLE_SHEETS_API_KEY')
    if not creds_json:
        raise ValueError("GOOGLE_SHEETS_API_KEY not set")
    
    creds_dict = json.loads(creds_json)
    creds = Credentials.from_service_account_info(
        creds_dict,
        scopes=['https://www.googleapis.com/auth/spreadsheets.readonly']
    )
    return build('sheets', 'v4', credentials=creds)

# Fetch today's entry from Google Sheets
def get_todays_entry(service, sheet_id):
    today = datetime.now().strftime('%Y-%m-%d')
    range_name = "Mente Curiosa!A:H"
    
    result = service.spreadsheets().values().get(
        spreadsheetId=sheet_id,
        range=range_name
    ).execute()
    
    rows = result.get('values', [])
    
    for row in rows[1:]:  # Skip header
        if len(row) > 0 and row[0] == today:
            return {
                'date': row[0] if len(row) > 0 else '',
                'theme': row[1] if len(row) > 1 else '',
                'keywords': row[2] if len(row) > 2 else '',
                'category': row[3] if len(row) > 3 else '',
                'slug': row[4] if len(row) > 4 else '',
            }
    
    return None

# Generate article with Claude
def generate_article(theme, keywords, category):
    client = anthropic.Anthropic(api_key=os.getenv('ANTHROPIC_API_KEY'))
    
    keywords_list = [k.strip() for k in keywords.split(';')]
    
    prompt = f"""
Você é um escritor especialista em conteúdo sobre psicologia e curiosidades humanas.

Crie um artigo COMPLETO sobre: {theme}
Palavras-chave: {', '.join(keywords_list)}
Categoria: {category}

REGRAS OBRIGATÓRIAS:
- Tom conversacional, como um amigo explicando algo interessante
- Nunca acadêmico ou robótico
- Frases curtas alternadas com médias (máx 4-5 linhas por parágrafo)
- Fazer perguntas diretas ao leitor
- Exemplos do cotidiano brasileiro
- Título com gancho de curiosidade
- Introdução curta (2-3 frases)
- 3-5 subtítulos (H2) organizando o conteúdo
- Explicação com base em ciência/estudos reais, linguagem simples
- Conclusão com reflexão prática
- SEM usar frases clichê de IA ("neste artigo vamos explorar", "é importante ressaltar")
- SEO natural, sem forçar palavra-chave
- Não inventar estudos ou estatísticas

Retorne APENAS o conteúdo do artigo em Markdown (sem frontmatter YAML).
"""
    
    message = client.messages.create(
        model="claude-opus-4-6",
        max_tokens=2000,
        messages=[
            {"role": "user", "content": prompt}
        ]
    )
    
    return message.content[0].text

# Save article to file
def save_article(slug, theme, keywords, category, content):
    today = datetime.now().strftime('%Y-%m-%d')
    
    frontmatter = f"""---
title: "{theme}"
slug: {slug}
date: {today}
category: {category}
keywords: {keywords}
---

"""
    
    filepath = f"src/content/draft/{slug}.md"
    os.makedirs(os.path.dirname(filepath), exist_ok=True)
    
    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(frontmatter + content)
    
    print(f"✅ Artigo salvo em: {filepath}")
    return filepath

# Main
if __name__ == "__main__":
    try:
        sheet_id = os.getenv('SHEET_ID')
        if not sheet_id:
            raise ValueError("SHEET_ID not set")
        
        service = get_sheets_service()
        entry = get_todays_entry(service, sheet_id)
        
        if not entry:
            print("ℹ️ Nenhum artigo agendado para hoje")
            sys.exit(0)
        
        print(f"📝 Gerando artigo: {entry['theme']}")
        content = generate_article(entry['theme'], entry['keywords'], entry['category'])
        
        filepath = save_article(
            entry['slug'],
            entry['theme'],
            entry['keywords'],
            entry['category'],
            content
        )
        
        print("✅ Artigo gerado com sucesso!")
        
    except Exception as e:
        print(f"❌ Erro: {e}")
        sys.exit(1)
