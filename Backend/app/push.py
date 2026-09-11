"""Envio de notificações push (Web Push + VAPID).

Usado pela varredura de tarefas (POST /push/scan) para lembrar a usuária de um
compromisso próximo, mesmo com o app fechado. Síncrono de propósito: chamado só
a partir de `_execute_reminder_scan`, que já roda em `asyncio.to_thread` (ver
routers/push.py) — os mesmos motivos de app/ai.py sobre não bloquear o event
loop não se aplicam aqui porque não há chamada de IA no caminho, mas manter o
envio em thread evita que uma varredura com muitas usuárias prenda requisições
simultâneas de qualquer jeito.

Sem `VAPID_PUBLIC_KEY`/`VAPID_PRIVATE_KEY` configuradas, `send_to_user` não faz
nada (ver `settings.push_enabled`) — mesma filosofia de app/ai.py e crypto.py:
a ausência da chave desliga o recurso, não derruba o boot.
"""
from __future__ import annotations

import json
import logging

from pywebpush import WebPushException, webpush
from sqlalchemy.orm import Session

from app import crud, models
from app.config import settings


def _vapid_claims() -> dict:
    return {"sub": f"mailto:{settings.VAPID_CONTACT_EMAIL or 'contato@menteleve.app'}"}


def _send_one(sub: models.PushSubscription, payload: dict) -> bool:
    """Envia para uma inscrição. True em sucesso (ou falha transitória — não é
    motivo para apagar); False se a inscrição está morta e deve ser removida.

    Uma subscription com chave malformada (navegador antigo, dado corrompido)
    não pode derrubar a varredura inteira: `webpush()` pode levantar bem antes
    de tocar a rede (ex.: `cryptography.ValueError` ao decodificar uma chave
    pública inválida durante a cifragem do payload) — por isso o `except` é
    amplo, não só `WebPushException`. O que importa aqui é isolar por
    inscrição, para as demais usuárias do lote continuarem sendo notificadas.
    """
    log = logging.getLogger("uvicorn.error")
    try:
        webpush(
            subscription_info={
                "endpoint": sub.endpoint,
                "keys": {"p256dh": sub.p256dh, "auth": sub.auth},
            },
            data=json.dumps(payload),
            vapid_private_key=settings.VAPID_PRIVATE_KEY,
            vapid_claims=_vapid_claims(),
            timeout=10,
        )
        return True
    except WebPushException as e:
        status = getattr(e.response, "status_code", None)
        if status in (404, 410):
            return False  # inscrição expirada/revogada — chamador limpa
        log.warning("Push: falha ao enviar (%s).", status or type(e).__name__)
        return True  # falha transitória: não é motivo para apagar a inscrição
    except Exception as e:
        # Chave malformada, payload que a lib não conseguiu cifrar, etc. — a
        # inscrição está claramente quebrada; remover evita tentar de novo a
        # cada varredura para sempre.
        log.warning("Push: inscrição inválida, removendo (%s).", type(e).__name__)
        return False


def send_to_user(db: Session, user_id: int, title: str, body: str, tag: str = "") -> int:
    """Envia a notificação para todos os aparelhos inscritos da usuária.

    Devolve quantas inscrições receberam (ou tentaram receber, em falha
    transitória) — inscrições mortas são removidas no caminho, não contadas.
    """
    if not settings.push_enabled:
        return 0

    payload = {"title": title, "body": body, "tag": tag}
    subs = crud.list_push_subscriptions(db, user_id)
    sent = 0
    for sub in subs:
        if _send_one(sub, payload):
            sent += 1
        else:
            crud.delete_push_subscription_by_endpoint(db, sub.endpoint)
    return sent
