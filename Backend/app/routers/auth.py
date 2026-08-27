"""Rotas de autenticação (cadastro e login com senha + token JWT)."""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app import crud, schemas, security
from app.database import get_db
from app.dependencies import get_current_user
from app.models import User

router = APIRouter(prefix="/auth", tags=["auth"])


def _token_response(user: User) -> schemas.TokenOut:
    return schemas.TokenOut(
        access_token=security.create_access_token(user.id),
        user=schemas.UserOut.model_validate(user),
    )


@router.post("/register", response_model=schemas.TokenOut, status_code=status.HTTP_201_CREATED)
def register(data: schemas.UserCreate, db: Session = Depends(get_db)) -> schemas.TokenOut:
    """Cria a conta e já devolve o token (evita um segundo round-trip de login)."""
    user = crud.create_user(db, data)
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Este e-mail já está cadastrado.",
        )
    return _token_response(user)


@router.post("/login", response_model=schemas.TokenOut)
def login(data: schemas.UserLogin, db: Session = Depends(get_db)) -> schemas.TokenOut:
    """Autentica por e-mail + senha e devolve o token de acesso."""
    user = crud.authenticate_user(db, data.email, data.password)
    if user is None:
        # Mensagem genérica de propósito: não revela se o e-mail existe.
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="E-mail ou senha incorretos.",
        )
    return _token_response(user)


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
