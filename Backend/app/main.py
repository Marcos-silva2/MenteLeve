"""Ponto de entrada da API do MenteLeve (FastAPI)."""
from __future__ import annotations

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.database import init_db
from app.routers import ai_chat, auth, tasks


@asynccontextmanager
async def lifespan(_app: FastAPI):
    # Cria as tabelas no startup (MVP sem migrações).
    init_db()
    if settings.secret_key_is_ephemeral:
        logging.getLogger("uvicorn.error").warning(
            "SECRET_KEY não definida: usando uma chave aleatória. Todos os tokens "
            "serão invalidados no próximo restart — defina SECRET_KEY no ambiente."
        )
    yield


app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    description="API do MenteLeve — gestão de carga mental com IA (Google AI Studio / Gemini).",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(tasks.router)
app.include_router(ai_chat.router)


@app.get("/health", tags=["health"])
def health() -> dict[str, str]:
    """Ping usado pelo frontend para detectar se o backend está no ar."""
    return {"status": "ok", "version": settings.APP_VERSION}


@app.get("/", tags=["health"])
def root() -> dict[str, str]:
    return {"app": settings.APP_NAME, "docs": "/docs"}
