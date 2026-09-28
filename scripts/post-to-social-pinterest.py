#!/usr/bin/env python3
"""
Mente Curiosa - Pinterest Distribution
Posta artigos nos 5 perfis Pinterest via py3-pinterest
Rodas via GitHub Actions 3x/dia
"""

import os
import sys
import time
import json
from datetime import datetime
from pathlib import Path
from typing import List, Dict, Optional

# Bibliotecas externas
try:
    from pinterest import Pinterest
    from google.oauth2.service_account import Credentials
    from google.auth.transport.requests import Request
    from googleapiclient.discovery import build
except ImportError as e:
    print(f"❌ Erro ao importar: {e}")
    print("Execute: pip install py3-pinterest google-auth-oauthlib google-auth-httplib2 google-api-python-client")
    sys.exit(1)


class PinterestDistributor:
    """Distribuidor de artigos Mente Curiosa pra Pinterest"""

    # Credenciais dos 5 perfis Pinterest
    PINTEREST_ACCOUNTS = [
        {
            "username": "daviestreladamanha2",
            "email": "daviestreladamanha2@gmail.com",
            "password": os.getenv("PINTEREST_PASS_1"),
            "board": "Curiosidades e Psicologia",
        },
        {
            "username": "davicafemarita",
            "email": "davicafemarita@gmail.com",
            "password": os.getenv("PINTEREST_PASS_2"),
            "board": "Psicologia Humana",
        },
        {
            "username": "bitcointraderdavi",
            "email": "bitcointraderdavi@gmail.com",
            "password": os.getenv("PINTEREST_PASS_3"),
            "board": "Mente e Comportamento",
        },
        {
            "username": "daviburatocustodio",
            "email": "ftbbankscdiretoria@gmail.com",
            "password": os.getenv("PINTEREST_PASS_4"),
            "board": "Descobertas Curiosas",
        },
        {
            "username": "elianamarita777",
            "email": "elianamarita777@gmail.com",
            "password": os.getenv("PINTEREST_PASS_5"),
            "board": "Psicologia e Saúde Mental",
        },
    ]

    def __init__(self, spreadsheet_id: str, worksheet_name: str):
        """Inicializa distribuidor"""
        self.spreadsheet_id = spreadsheet_id
        self.worksheet_name = worksheet_name
        self.sheets_service = None
        self.pinterest_sessions = {}

    def auth_google_sheets(self):
        """Autentica com Google Sheets usando API Key"""
        # Usando Google Sheets API diretamente com API Key (para leitura simples)
        from googleapiclient.discovery import build

        api_key = os.getenv("GOOGLE_API_KEY")
        if not api_key:
            raise ValueError("GOOGLE_API_KEY não configurada em GitHub Secrets")

        self.sheets_service = build("sheets", "v4", developerKey=api_key)
        print("✅ Autenticado com Google Sheets")

    def get_articles_from_sheets(self, limit: int = 3) -> List[Dict]:
        """Busca artigos da planilha que ainda não foram postados no Pinterest"""
        if not self.sheets_service:
            self.auth_google_sheets()

        # Range: pautas-modelo_pautas!A:L (colunas até Palavras)
        range_name = f"{self.worksheet_name}!A:L"

        try:
            result = (
                self.sheets_service.spreadsheets()
                .values()
                .get(spreadsheetId=self.spreadsheet_id, range=range_name)
                .execute()
            )

            rows = result.get("values", [])
            if not rows:
                print("⚠️  Nenhum artigo encontrado na planilha")
                return []

            # Headers da planilha
            headers = rows[0]
            articles = []

            # Processa linhas (pula header)
            for row in rows[1:]:
                if not row or not row[0]:  # Ignora linhas vazias
                    continue

                # Mapeia colunas
                article = {
                    "id": row[0] if len(row) > 0 else "",
                    "pauta": row[1] if len(row) > 1 else "",
                    "cluster": row[2] if len(row) > 2 else "",
                    "keyword": row[3] if len(row) > 3 else "",
                    "long_tail": row[4] if len(row) > 4 else "",
                    "image_url": row[5] if len(row) > 5 else "",
                    "image_credit": row[6] if len(row) > 6 else "",
                    "status": row[7] if len(row) > 7 else "",
                    "slug": row[8] if len(row) > 8 else "",
                    "url": row[9] if len(row) > 9 else "",
                    "published": row[10] if len(row) > 10 else None,
                    "words": row[11] if len(row) > 11 else "",
                }

                # Filtra: status "rascunho" ou "publicado", e ainda não foi postado no Pinterest
                if article["status"] in ["rascunho", "publicado"] and not article["published"]:
                    articles.append(article)
                    if len(articles) >= limit:
                        break

            print(f"✅ {len(articles)} artigos encontrados para distribuição")
            return articles

        except Exception as e:
            print(f"❌ Erro ao buscar artigos: {e}")
            return []

    def login_pinterest(self, account: Dict) -> Optional[Pinterest]:
        """Faz login em um perfil Pinterest"""
        try:
            print(f"  🔑 Autenticando {account['email']}...")

            # Cria sessão Pinterest
            # Requer pasta local pra armazenar cookies (GitHub Actions usa /tmp)
            cred_root = "/tmp/pinterest_creds"
            os.makedirs(cred_root, exist_ok=True)

            pinterest = Pinterest(
                email=account["email"],
                password=account["password"],
                username=account["username"],
                cred_root=cred_root,
            )

            print(f"  ✅ {account['username']} autenticado")
            return pinterest

        except Exception as e:
            print(f"  ❌ Erro ao autenticar {account['email']}: {e}")
            return None

    def post_to_pinterest(self, article: Dict) -> bool:
        """Posta artigo nos 5 perfis Pinterest"""
        print(f"
📌 Postando: {article['pauta']}")
        print(f"   URL: {article['url']}")
        print(f"   Imagem: {article['image_url']}")

        success_count = 0

        for i, account in enumerate(self.PINTEREST_ACCOUNTS, 1):
            try:
                # Login
                if account["username"] not in self.pinterest_sessions:
                    pinterest = self.login_pinterest(account)
                    if not pinterest:
                        continue
                    self.pinterest_sessions[account["username"]] = pinterest
                else:
                    pinterest = self.pinterest_sessions[account["username"]]

                # Busca board
                boards = pinterest.boards(username=account["username"])
                board_id = None
                
                print(f"  📋 Boards encontrados em {account['username']}:")
                for board in boards:
                    board_name = board.get("name", "")
                    print(f"     - {board_name}")
                    if account["board"] in board_name:
                        board_id = board.get("id")
                        print(f"     ✅ Match encontrado: {board_name}")

                if not board_id:
                    print(
                        f"  ❌ Board '{account['board']}' não encontrado para {account['username']}"
                    )
                    print(f"     Procurando por: '{account['board']}'")
                    continue

                # Posta pin
                description = f"{article['pauta']}

{article['keyword']}

{article['url']}"

                pin_response = pinterest.upload_pin(
                    board_id=board_id,
                    image_url=article["image_url"],
                    description=description,
                    title=article["pauta"],
                    link=article["url"],
                )

                print(f"  ✅ Pin postado em {account['username']}")
                success_count += 1

                # Rate limit: aguarda entre posts
                time.sleep(5)

            except Exception as e:
                print(f"  ❌ Erro ao postar em {account['username']}: {e}")

        return success_count > 0

    def mark_as_posted(self, article_id: str):
        """Marca artigo como postado na planilha (coluna 'Publicado em')"""
        # Atualiza Google Sheets
        timestamp = datetime.now().isoformat()

        # Find row by ID
        if not self.sheets_service:
            self.auth_google_sheets()

        try:
            # Busca todas as linhas
            range_name = f"{self.worksheet_name}!A:K"
            result = (
                self.sheets_service.spreadsheets()
                .values()
                .get(spreadsheetId=self.spreadsheet_id, range=range_name)
                .execute()
            )

            rows = result.get("values", [])
            row_index = None

            # Encontra linha do artigo
            for idx, row in enumerate(rows):
                if row and row[0] == article_id:
                    row_index = idx + 1  # +1 pq sheets começa em 1
                    break

            if row_index:
                # Atualiza coluna K (Publicado em)
                update_range = f"{self.worksheet_name}!K{row_index}"
                self.sheets_service.spreadsheets().values().update(
                    spreadsheetId=self.spreadsheet_id,
                    range=update_range,
                    valueInputOption="USER_ENTERED",
                    body={"values": [[timestamp]]},
                ).execute()

                print(f"  ✅ Artigo marcado como postado na planilha")

        except Exception as e:
            print(f"  ⚠️  Erro ao atualizar planilha: {e}")

    def run(self):
        """Executa distribuição completa"""
        print("=" * 60)
        print("📱 Mente Curiosa - Pinterest Distribution")
        print("=" * 60)

        try:
            # 1. Busca artigos
            articles = self.get_articles_from_sheets(limit=3)
            if not articles:
                print("⏭️  Nenhum artigo novo pra postar")
                return

            # 2. Posta cada artigo nos 5 perfis
            for article in articles:
                success = self.post_to_pinterest(article)
                if success:
                    self.mark_as_posted(article["id"])
                time.sleep(10)  # Intervalo entre artigos

            print("
" + "=" * 60)
            print("✅ Distribuição concluída!")
            print("=" * 60)

        except Exception as e:
            print(f"
❌ Erro crítico: {e}")
            sys.exit(1)


def main():
    """Ponto de entrada"""
    # Parâmetros da planilha
    spreadsheet_id = os.getenv(
        "GOOGLE_SHEETS_ID", "1nKWhHXTHjXK1d-yH5kj9Ie3gBQLE-CpO0MFhh1ZJgI0"
    )
    worksheet_name = os.getenv("WORKSHEET_NAME", "pautas-modelo_pautas")

    # Verifica credenciais Pinterest
    required_envs = [
        "PINTEREST_PASS_1",
        "PINTEREST_PASS_2",
        "PINTEREST_PASS_3",
        "PINTEREST_PASS_4",
        "PINTEREST_PASS_5",
        "GOOGLE_API_KEY",
    ]

    missing = [e for e in required_envs if not os.getenv(e)]
    if missing:
        print(f"❌ Variáveis de ambiente faltando: {', '.join(missing)}")
        print("
Adicione em GitHub Settings → Secrets and variables → Actions:")
        for env in missing:
            print(f"  - {env}")
        sys.exit(1)

    # Executa distribuidor
    distributor = PinterestDistributor(spreadsheet_id, worksheet_name)
    distributor.run()


if __name__ == "__main__":
    main()
