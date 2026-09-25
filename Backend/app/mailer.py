"""Envio de e-mail transacional (Resend) — código de verificação do login (A2F).

Assíncrono (httpx.AsyncClient), mesmo motivo de app/ai.py: a chamada de rede
não pode prender uma thread do pool compartilhado com /auth e /tasks.

Nome do módulo é `mailer`, não `email`, de propósito — evita qualquer confusão
com o pacote `email` da biblioteca padrão do Python.
"""
from __future__ import annotations

import logging

import httpx

from app.config import settings

_ENDPOINT = "https://api.resend.com/emails"


async def send_email(to: str, subject: str, html: str) -> bool:
    """True em sucesso. Sem RESEND_API_KEY, não tenta — ver settings.email_enabled."""
    if not settings.email_enabled:
        return False

    log = logging.getLogger("uvicorn.error")
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.post(
                _ENDPOINT,
                headers={"Authorization": f"Bearer {settings.RESEND_API_KEY}"},
                json={"from": settings.RESEND_FROM_EMAIL, "to": [to], "subject": subject, "html": html},
            )
            resp.raise_for_status()
            return True
    except httpx.HTTPStatusError as e:
        log.warning("Resend: erro HTTP %s ao enviar para %s.", e.response.status_code, to)
        return False
    except (httpx.HTTPError, OSError) as e:
        log.warning("Resend indisponível: %s", type(e).__name__)
        return False


def otp_email_html(code: str, ttl_seconds: int) -> str:
    minutos = max(1, ttl_seconds // 60)
    return (
        '<div style="font-family:sans-serif;max-width:420px;margin:0 auto">'
        '<h2 style="color:#590d22">MenteLeve</h2>'
        "<p>Seu código de verificação:</p>"
        f'<p style="font-size:32px;font-weight:bold;letter-spacing:8px;color:#590d22">{code}</p>'
        f'<p style="color:#836169;font-size:13px">Vale por {minutos} minutos. '
        "Se não foi você quem pediu, ignore este e-mail — sua senha continua segura.</p>"
        "</div>"
    )
