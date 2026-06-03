"""Dependencies compartilhadas do FastAPI."""
from __future__ import annotations

from fastapi import Depends, Header, HTTPException, status
from sqlalchemy.orm import Session

from app import crud, models
from app.database import get_db


def get_current_user(
    x_user_id: int | None = Header(default=None, alias="X-User-Id"),
    db: Session = Depends(get_db),
) -> models.User:
    """Autenticação leve do MVP.

    O frontend guarda o `id` do usuário (retornado por /auth/login) e o envia
    no header `X-User-Id` a cada requisição. Sem OAuth/senha nesta fase.
    """
    if x_user_id is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Header X-User-Id ausente. Faça login em /auth/login.",
        )
    user = crud.get_user(db, x_user_id)
    if user is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Usuário inválido.")
    return user
