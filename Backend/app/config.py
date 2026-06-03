"""Configurações da aplicação (lidas de variáveis de ambiente)."""
from __future__ import annotations

import os
from functools import lru_cache


class Settings:
    """Configuração simples baseada em ambiente (sem dependências extras)."""

    # Banco — por padrão SQLite local. No Render, aponte para o disco persistente,
    # ex.: DATABASE_URL=sqlite:////var/data/menteleve.db
    DATABASE_URL: str = os.getenv("DATABASE_URL", "sqlite:///./menteleve.db")

    # CORS — origens permitidas (separadas por vírgula). "*" libera todas (dev).
    # Em produção, defina a URL do GitHub Pages, ex.:
    # CORS_ORIGINS=https://usuario.github.io
    CORS_ORIGINS: str = os.getenv("CORS_ORIGINS", "*")

    # Metadados
    APP_NAME: str = "MenteLeve API"
    APP_VERSION: str = "0.1.0"

    @property
    def cors_origins_list(self) -> list[str]:
        if self.CORS_ORIGINS.strip() == "*":
            return ["*"]
        return [o.strip() for o in self.CORS_ORIGINS.split(",") if o.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
