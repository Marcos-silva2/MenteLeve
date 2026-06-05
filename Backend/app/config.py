"""Configurações da aplicação (lidas de variáveis de ambiente)."""
from __future__ import annotations

import os
from functools import lru_cache
from pathlib import Path


def _load_dotenv() -> None:
    """Carrega `Backend/.env` (se existir) para o ambiente, sem dependências.

    Não sobrescreve variáveis já definidas no ambiente (precedência do SO).
    """
    env_path = Path(__file__).resolve().parents[1] / ".env"
    if not env_path.exists():
        return
    for line in env_path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, val = line.partition("=")
        os.environ.setdefault(key.strip(), val.strip().strip('"').strip("'"))


# Carrega o .env antes de a classe ler os.getenv (atributos avaliados no import).
_load_dotenv()


class Settings:
    """Configuração simples baseada em ambiente (sem dependências extras)."""

    # Banco — por padrão SQLite local. No Render, aponte para o disco persistente,
    # ex.: DATABASE_URL=sqlite:////var/data/menteleve.db
    DATABASE_URL: str = os.getenv("DATABASE_URL", "sqlite:///./menteleve.db")

    # CORS — origens permitidas (separadas por vírgula). "*" libera todas (dev).
    # Em produção, defina a URL do GitHub Pages, ex.:
    # CORS_ORIGINS=https://usuario.github.io
    CORS_ORIGINS: str = os.getenv("CORS_ORIGINS", "*")

    # --- IA (Google AI Studio / Gemini) ---
    # Chave da API do Google AI Studio. Sem ela, o /tasks/smart cai no
    # fallback (apenas normaliza o título, sem sugestões).
    GOOGLE_AI_API_KEY: str = os.getenv("GOOGLE_AI_API_KEY", "")
    # Modelo Gemini usado (rápido e barato por padrão).
    AI_MODEL: str = os.getenv("AI_MODEL", "gemini-2.5-flash")
    # Timeout (segundos) da chamada à IA — a resposta precisa ser rápida.
    AI_TIMEOUT: float = float(os.getenv("AI_TIMEOUT", "8"))

    # Metadados
    APP_NAME: str = "MenteLeve API"
    APP_VERSION: str = "0.3.0"

    @property
    def ai_enabled(self) -> bool:
        return bool(self.GOOGLE_AI_API_KEY.strip())

    @property
    def cors_origins_list(self) -> list[str]:
        if self.CORS_ORIGINS.strip() == "*":
            return ["*"]
        return [o.strip() for o in self.CORS_ORIGINS.split(",") if o.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
