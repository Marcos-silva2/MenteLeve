"""Rotas de notificação push: inscrição do aparelho e varredura de lembretes.

`/push/subscribe` e `/push/unsubscribe` são como qualquer rota autenticada.
`/push/scan` é diferente de propósito: não tem usuária logada — é chamada por um
cron externo (mesmo padrão do ping em `/health`, ver docs/README.md), por isso
usa um segredo compartilhado (`X-Scan-Secret`) em vez de JWT.
"""
from __future__ import annotations

import asyncio
import hmac
from datetime import date, datetime, timedelta, timezone

from fastapi import APIRouter, Depends, Header, HTTPException, status
from sqlalchemy.orm import Session

from app import crud, push, schemas
from app.config import settings
from app.database import get_db
from app.dependencies import get_current_user
from app.models import User

router = APIRouter(prefix="/push", tags=["push"])

# Brasil não observa horário de verão desde 2019: UTC-3 fixo é uma simplificação
# deliberada, não um descuido — o app não guarda fuso por usuária (devido a isso,
# devices fora do fuso de Brasília teriam o lembrete na hora errada; aceitável
# para o público-alvo atual do produto).
_BRAZIL_TZ = timezone(timedelta(hours=-3))


@router.get("/public-key", response_model=schemas.PushPublicKeyOut)
def public_key(_user: User = Depends(get_current_user)) -> schemas.PushPublicKeyOut:
    """Chave pública VAPID que o navegador usa para criar a inscrição.

    Não é segredo (é enviada para o serviço de push do navegador de qualquer
    forma), mas exigimos sessão para não expor nem esse detalhe a quem não
    passou pelo login — mesma postura do resto da API.
    """
    return schemas.PushPublicKeyOut(
        public_key=settings.VAPID_PUBLIC_KEY if settings.push_enabled else "",
        enabled=settings.push_enabled,
    )


@router.post("/subscribe", status_code=status.HTTP_204_NO_CONTENT)
def subscribe(
    data: schemas.PushSubscriptionIn,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> None:
    crud.upsert_push_subscription(db, user.id, data.endpoint, data.keys.p256dh, data.keys.auth)


@router.post("/unsubscribe", status_code=status.HTTP_204_NO_CONTENT)
def unsubscribe(
    data: schemas.PushUnsubscribeIn,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> None:
    # Idempotente de propósito: desativar dos dois lados (navegador e servidor)
    # mesmo se um dos dois já não tiver mais a inscrição não é um erro.
    crud.delete_push_subscription(db, user.id, data.endpoint)


def _check_scan_secret(x_scan_secret: str | None) -> None:
    if not settings.PUSH_SCAN_SECRET:
        # Sem segredo configurado, a rota fica fechada — nunca aberta por
        # omissão. Ver PUSH_SCAN_SECRET em config.py.
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, "Varredura de push não configurada.")
    if not x_scan_secret or not hmac.compare_digest(x_scan_secret, settings.PUSH_SCAN_SECRET):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Segredo inválido.")


def _run_scan(db: Session) -> dict:
    """Parte síncrona da varredura (toca o banco e envia push) — ver chamador."""
    now = datetime.now(_BRAZIL_TZ)
    until = now + timedelta(minutes=settings.PUSH_REMINDER_WINDOW_MINUTES)
    today: date = now.date()

    tasks = crud.tasks_due_for_reminder(db, today, now.strftime("%H:%M"), until.strftime("%H:%M"))

    notified = 0
    for task in tasks:
        sent = push.send_to_user(
            db,
            task.user_id,
            title="MenteLeve ⏰",
            body=f"{task.title} — {task.due_time}",
            tag=f"task-{task.id}",
        )
        crud.mark_reminder_sent(db, task)
        if sent:
            notified += 1

    return {"scanned": len(tasks), "notified": notified}


@router.post("/scan")
async def scan(
    db: Session = Depends(get_db),
    x_scan_secret: str | None = Header(default=None),
) -> dict:
    """Varre tarefas prestes a vencer e dispara o lembrete push.

    Chamada por um cron externo a cada poucos minutos — não por uma usuária.
    `async` só para poder rodar a parte síncrona em `asyncio.to_thread`, pelo
    mesmo motivo das rotas de IA (ver ai_chat.py): não seria estritamente
    necessário aqui (não há chamada de IA no caminho), mas mantém o mesmo
    padrão em toda rota que faz E/S potencialmente lenta.
    """
    _check_scan_secret(x_scan_secret)
    if not settings.push_enabled:
        return {"scanned": 0, "notified": 0, "motivo": "push desligado (sem VAPID configurada)"}

    return await asyncio.to_thread(_run_scan, db)
