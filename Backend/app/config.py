"""Configurações da aplicação (lidas de variáveis de ambiente)."""
from __future__ import annotations

import os
import secrets
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
    # Em produção, defina a URL do frontend na Vercel, ex.:
    # CORS_ORIGINS=https://mente-leve-teal.vercel.app
    CORS_ORIGINS: str = os.getenv("CORS_ORIGINS", "*")

    # --- Autenticação (JWT) ---
    # Chave usada para assinar os tokens. Em produção PRECISA ser uma variável de
    # ambiente fixa: sem ela, o fallback aleatório invalida todos os tokens a cada
    # restart do processo (no Render free isso acontece a cada cold start).
    SECRET_KEY: str = os.getenv("SECRET_KEY", "") or secrets.token_hex(32)
    JWT_ALGORITHM: str = os.getenv("JWT_ALGORITHM", "HS256")
    ACCESS_TOKEN_EXPIRE_MINUTES: int = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", str(60 * 24 * 30)))

    # --- IA (Google AI Studio / Gemini) ---
    # Chave da API do Google AI Studio. Sem ela, o /tasks/smart cai no
    # fallback (apenas normaliza o título, sem sugestões).
    GOOGLE_AI_API_KEY: str = os.getenv("GOOGLE_AI_API_KEY", "")
    # Modelo Gemini usado (rápido e barato por padrão).
    AI_MODEL: str = os.getenv("AI_MODEL", "gemini-2.5-flash")
    # Timeout (segundos) da chamada à IA — a resposta precisa ser rápida.
    AI_TIMEOUT: float = float(os.getenv("AI_TIMEOUT", "8"))
    # O chat da Bruna pode fazer duas idas ao modelo (function calling), então
    # tem um teto próprio, por chamada. Medido: ~1s quente, mas a API tem picos
    # de dezenas de segundos — 12s derrubava turnos válidos para o fallback.
    AI_CHAT_TIMEOUT: float = float(os.getenv("AI_CHAT_TIMEOUT", "25"))

    # --- IA de reserva (Groq) ---
    # Usada quando o Gemini falha ou estoura a cota (429). O plano gratuito do
    # Gemini permite ~20 req/min, o que é fácil de atingir.
    GROQ_API_KEY: str = os.getenv("GROQ_API_KEY", "")
    # Modelos disponíveis variam por conta — confira em /openai/v1/models.
    GROQ_MODEL: str = os.getenv("GROQ_MODEL", "openai/gpt-oss-120b")

    # Metadados
    APP_NAME: str = "MenteLeve API"
    APP_VERSION: str = "0.3.0"

    @property
    def ai_enabled(self) -> bool:
        return bool(self.GOOGLE_AI_API_KEY.strip())

    @property
    def groq_enabled(self) -> bool:
        return bool(self.GROQ_API_KEY.strip())

    @property
    def secret_key_is_ephemeral(self) -> bool:
        """True quando SECRET_KEY não veio do ambiente (fallback aleatório)."""
        return not os.getenv("SECRET_KEY", "").strip()

    @property
    def cors_origins_list(self) -> list[str]:
        if self.CORS_ORIGINS.strip() == "*":
            return ["*"]
        return [o.strip() for o in self.CORS_ORIGINS.split(",") if o.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
