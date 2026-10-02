"""Espaços compartilhados: criar, entrar por código, sair, resetar o convite, remover membro."""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

from app import crud, schemas, spaces
from app.database import get_db
from app.dependencies import get_current_user
from app.models import Space, User
from app.ratelimit import SlidingWindowLimiter

router = APIRouter(prefix="/spaces", tags=["spaces"])

# Entrar por código é uma busca por adivinhação: só falhas contam, por usuário e por IP.
# 8 caracteres de um alfabeto de 31 dão ~8,5 × 10^11 combinações; com 10 erros por 10 min
# a força bruta é inviável.
_join_by_user = SlidingWindowLimiter(max_hits=10, window_seconds=600)
_join_by_ip = SlidingWindowLimiter(max_hits=30, window_seconds=600)


def _ip(request: Request) -> str:
    fwd = request.headers.get("x-forwarded-for")
    if fwd:
        return fwd.split(",")[0].strip()
    return request.client.host if request.client else "?"


def _out(space: Space) -> schemas.SpaceOut:
    return schemas.SpaceOut(
        id=space.id,
        name=space.name,
        owner_id=space.owner_id,
        invite_code=spaces.format_code(space.invite_code),
        members=[
            schemas.SpaceMemberOut(user_id=m.user_id, name=m.user.name, is_owner=m.user_id == space.owner_id)
            for m in space.members
        ],
        created_at=space.created_at,
    )


def _my_space(space_id: int, user: User, db: Session) -> Space:
    """O espaço, se o usuário participa dele; 404 caso contrário (não confirma que existe)."""
    space = crud.get_space(db, space_id)
    if space is None or not crud.is_member(db, space_id, user.id):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Espaço não encontrado.")
    return space


def _only_owner(space: Space, user: User) -> None:
    if space.owner_id != user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Só o dono do espaço pode fazer isso.")


@router.get("", response_model=list[schemas.SpaceOut])
def list_spaces(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return [_out(s) for s in crud.list_spaces(db, user.id)]


@router.post("", response_model=schemas.SpaceOut, status_code=status.HTTP_201_CREATED)
def create_space(
    data: schemas.SpaceCreate, user: User = Depends(get_current_user), db: Session = Depends(get_db)
):
    if len(crud.member_space_ids(db, user.id)) >= spaces.MAX_SPACES_PER_USER:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Você já participa de {spaces.MAX_SPACES_PER_USER} espaços. Saia de algum para criar outro.",
        )
    return _out(crud.create_space(db, user.id, data.name))


@router.post("/join", response_model=schemas.SpaceOut)
def join_space(
    data: schemas.SpaceJoin,
    request: Request,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    user_key, ip_key = f"user:{user.id}", f"ip:{_ip(request)}"
    espera = max(_join_by_user.retry_after(user_key), _join_by_ip.retry_after(ip_key))
    if espera:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Muitas tentativas com código inválido. Aguarde alguns minutos.",
            headers={"Retry-After": str(espera)},
        )

    space = crud.get_space_by_code(db, data.code)
    if space is None:
        _join_by_user.record(user_key)
        _join_by_ip.record(ip_key)
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Código de convite inválido.")

    if not crud.is_member(db, space.id, user.id):   # entrar de novo é inofensivo (idempotente)
        if len(space.members) >= spaces.MAX_MEMBERS_PER_SPACE:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Este espaço já está cheio.")
        if len(crud.member_space_ids(db, user.id)) >= spaces.MAX_SPACES_PER_USER:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Você já participa de {spaces.MAX_SPACES_PER_USER} espaços. Saia de algum para entrar neste.",
            )
        crud.add_member(db, space, user.id)
    _join_by_user.reset(user_key)
    return _out(space)


@router.post("/{space_id}/leave", status_code=status.HTTP_204_NO_CONTENT)
def leave_space(space_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    space = _my_space(space_id, user, db)
    crud.remove_member(db, space, user.id)


@router.post("/{space_id}/invite/reset", response_model=schemas.SpaceOut)
def reset_invite(space_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Gera outro código e invalida o antigo — útil quando o convite foi parar em quem não devia."""
    space = _my_space(space_id, user, db)
    _only_owner(space, user)
    return _out(crud.reset_invite_code(db, space))


@router.delete("/{space_id}/members/{member_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove_member(
    space_id: int, member_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)
):
    space = _my_space(space_id, user, db)
    _only_owner(space, user)
    if member_id == user.id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Para sair, use \"Sair do espaço\".")
    if not crud.is_member(db, space_id, member_id):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Essa pessoa não está no espaço.")
    crud.remove_member(db, space, member_id)
