"""Rota de conversa com a IA (Bruna)."""
from __future__ import annotations

from fastapi import APIRouter, Depends

from app import ai, schemas
from app.dependencies import get_current_user
from app.models import User

router = APIRouter(prefix="/ai", tags=["ai"])

_FALLBACK = (
    "Estou com um probleminha para pensar agora 😅. Tenta de novo daqui a "
    "pouco? Enquanto isso, toque no + para registrar o que está na sua mente."
)


@router.post("/chat", response_model=schemas.ChatOut)
def chat(
    data: schemas.ChatIn,
    _user: User = Depends(get_current_user),
):
    """Conversa com a Bruna. Recebe o histórico e devolve a resposta dela.

    Sem `GOOGLE_AI_API_KEY` (ou em falha da IA), devolve uma mensagem de
    fallback gentil para a conversa não quebrar.
    """
    history = [{"role": m.role, "content": m.content} for m in data.messages]
    reply = ai.chat(history)
    return schemas.ChatOut(reply=reply or _FALLBACK)
