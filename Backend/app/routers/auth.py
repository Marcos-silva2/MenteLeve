"""Rotas de autenticação (MVP simplificado: login/registro por e-mail)."""
from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app import crud, schemas
from app.database import get_db
from app.dependencies import get_current_user
from app.models import User

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/login", response_model=schemas.UserOut)
def login(data: schemas.UserCreate, db: Session = Depends(get_db)) -> User:
    """Login/registro sem atrito: cria o usuário se não existir, senão recupera.

    Retorna o usuário (incluindo `id`), que o frontend deve guardar e enviar
    no header `X-User-Id` nas próximas chamadas.
    """
    return crud.get_or_create_user(db, data)


@router.get("/me", response_model=schemas.UserOut)
def me(user: User = Depends(get_current_user)) -> User:
    return user


@router.post("/me/premium", response_model=schemas.UserOut)
def set_premium(
    is_premium: bool = True,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> User:
    """Ativa/desativa o Premium (MVP: chamado após a compra simulada no front)."""
    return crud.set_user_premium(db, user, is_premium)
