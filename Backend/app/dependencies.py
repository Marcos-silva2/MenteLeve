"""Dependencies compartilhadas do FastAPI."""
from __future__ import annotations

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app import crud, models, security
from app.database import get_db

# auto_error=False: no modo padrão o FastAPI responde 403 quando o header falta,
# e o frontend trata sessão expirada reagindo a 401. Levantamos 401 nós mesmos.
_bearer = HTTPBearer(auto_error=False)


def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(_bearer),
    db: Session = Depends(get_db),
) -> models.User:
    """Valida o token JWT do header `Authorization: Bearer <token>`."""
    unauthorized = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Sessão inválida ou expirada. Faça login novamente.",
        headers={"WWW-Authenticate": "Bearer"},
    )

    if credentials is None:
        raise unauthorized

    user_id = security.decode_access_token(credentials.credentials)
    if user_id is None:
        raise unauthorized

    user = crud.get_user(db, user_id)
    if user is None:
        raise unauthorized
    return user
