"""Envio de e-mail transacional (Resend, por HTTP).

Só o e-mail de recuperação de senha passa por aqui. Escolhas:

- HTTP e não SMTP: o plano gratuito do Render bloqueia as portas SMTP de saída,
  e `httpx` já é dependência do projeto — nada novo a instalar.
- Sem `RESEND_API_KEY`, `send_password_reset` NÃO envia e devolve False. Não há
  modo "de mentira" que finja o envio: quem opera o servidor precisa saber que o
  e-mail não saiu.
- O token nunca aparece no log — só o resultado do envio. O token dá acesso à
  conta; um log é um lugar que outras pessoas leem.
"""
from __future__ import annotations

import html
import logging

import httpx

from app.config import settings

_RESEND_ENDPOINT = "https://api.resend.com/emails"
_TIMEOUT = 10.0

log = logging.getLogger("uvicorn.error")


def build_reset_link(token: str) -> str:
    # Fragmento (#), não query: o fragmento não é enviado ao servidor que
    # hospeda o frontend, então o token não cai nos logs de acesso da Vercel.
    return f"{settings.FRONTEND_URL}/#reset={token}"


def _render(link: str, minutes: int) -> tuple[str, str]:
    safe = html.escape(link, quote=True)
    text = (
        "Olá!\n\n"
        "Recebemos um pedido para redefinir a senha da sua conta no MenteLeve.\n"
        f"Use este link (vale por {minutes} minutos e só funciona uma vez):\n\n"
        f"{link}\n\n"
        "Se não foi você, ignore esta mensagem — sua senha continua a mesma."
    )
    body = (
        '<div style="font-family:Arial,sans-serif;color:#590d22;max-width:480px">'
        "<h2>Redefinir sua senha</h2>"
        "<p>Recebemos um pedido para redefinir a senha da sua conta no MenteLeve.</p>"
        f'<p><a href="{safe}" style="display:inline-block;background:#c9184a;color:#fff;'
        'padding:12px 24px;border-radius:999px;text-decoration:none;font-weight:bold">'
        "Criar nova senha</a></p>"
        f"<p>O link vale por {minutes} minutos e só funciona uma vez.</p>"
        "<p>Se não foi você, ignore esta mensagem — sua senha continua a mesma.</p>"
        "</div>"
    )
    return text, body


def send_password_reset(email: str, token: str) -> bool:
    """Envia o link de recuperação. True somente se o provedor aceitou o envio.

    Síncrona (chamada em BackgroundTasks, que roda no threadpool); nunca levanta
    exceção — falha de e-mail não pode derrubar a rota nem revelar se a conta existe.
    """
    if not settings.mail_enabled:
        log.warning(
            "Recuperação de senha pedida, mas RESEND_API_KEY não está definida: "
            "NENHUM e-mail foi enviado. Configure o envio (ver Backend/.env.example)."
        )
        return False

    text, body = _render(build_reset_link(token), settings.PASSWORD_RESET_TOKEN_MINUTES)
    try:
        resp = httpx.post(
            _RESEND_ENDPOINT,
            headers={"Authorization": f"Bearer {settings.RESEND_API_KEY}"},
            json={
                "from": settings.MAIL_FROM,
                "to": [email],
                "subject": "Redefinir sua senha do MenteLeve",
                "text": text,
                "html": body,
            },
            timeout=_TIMEOUT,
        )
        resp.raise_for_status()
        return True
    except httpx.HTTPStatusError as e:
        # Sem o corpo da resposta no log: pode ecoar o endereço da usuária.
        log.warning("Resend recusou o envio (HTTP %s).", e.response.status_code)
    except (httpx.HTTPError, OSError) as e:
        log.warning("Resend indisponível: %s", type(e).__name__)
    return False
