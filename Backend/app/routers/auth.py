"""Rotas de autenticação (cadastro e login com senha + token JWT, A2F por e-mail)."""
from __future__ import annotations

import asyncio
import logging

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

from app import crud, mailer, schemas, security
from app.config import settings
from app.database import get_db
from app.dependencies import get_current_user
from app.models import User
from app.otp import LoginOtpStore
from app.ratelimit import SlidingWindowLimiter

router = APIRouter(prefix="/auth", tags=["auth"])

# Estado em memória, mesma ressalva de _login_by_email/_login_by_ip abaixo:
# vale por processo (um único worker no Render free — ver Procfile).
_login_otp = LoginOtpStore(
    settings.LOGIN_OTP_LENGTH, settings.LOGIN_OTP_TTL_SECONDS, settings.LOGIN_OTP_MAX_ATTEMPTS
)

# Duas janelas, propósitos diferentes: a de e-mail protege UMA conta de ser
# martelada; a de IP protege o servidor de alguém varrendo muitas contas a
# partir do mesmo lugar. Por isso o teto por IP é bem mais alto — uma rede
# compartilhada não pode travar quem está do lado.
_login_by_email = SlidingWindowLimiter(
    settings.LOGIN_MAX_ATTEMPTS, settings.LOGIN_ATTEMPT_WINDOW_SECONDS
)
_login_by_ip = SlidingWindowLimiter(
    settings.LOGIN_MAX_ATTEMPTS_PER_IP, settings.LOGIN_ATTEMPT_WINDOW_SECONDS
)


def _client_ip(request: Request) -> str:
    """IP de origem, respeitando o proxy do Render (`X-Forwarded-For`)."""
    fwd = request.headers.get("x-forwarded-for", "")
    if fwd:
        # O primeiro da lista é o cliente; os seguintes são proxies.
        return fwd.split(",")[0].strip()
    return request.client.host if request.client else "desconhecido"


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


def _authenticate_sync(data: schemas.UserLogin, ip: str, db: Session) -> User:
    """Parte síncrona do login (banco + rate limiter). Levanta HTTPException em
    qualquer recusa. Isolada numa função própria para poder rodar em
    `asyncio.to_thread` — ver o chamador (`login`, `async`) para o porquê.
    """
    email_key = f"email:{data.email.strip().lower()}"
    ip_key = f"ip:{ip}"

    espera = max(_login_by_email.retry_after(email_key), _login_by_ip.retry_after(ip_key))
    if espera:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Muitas tentativas de acesso. Aguarde alguns minutos e tente de novo.",
            headers={"Retry-After": str(espera)},
        )

    user = crud.authenticate_user(db, data.email, data.password)
    if user is None:
        _login_by_email.record(email_key)
        _login_by_ip.record(ip_key)
        # Mensagem genérica de propósito: não revela se o e-mail existe.
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="E-mail ou senha incorretos.",
        )

    # Acertou: zera a contagem para que erros anteriores não penalizem a sessão.
    _login_by_email.reset(email_key)
    _login_by_ip.reset(ip_key)
    return user


@router.post("/login", response_model=schemas.TokenOut | schemas.LoginChallengeOut)
async def login(
    data: schemas.UserLogin,
    request: Request,
    db: Session = Depends(get_db),
):
    """Autentica por e-mail + senha.

    Sem A2F configurada (`RESEND_API_KEY` ausente — ver `settings.email_enabled`),
    devolve o token direto, como sempre foi. Com A2F ativa, a senha correta só
    dispara o código por e-mail; o token sai de `POST /auth/login/verify`.

    Tentativas malsucedidas são limitadas por e-mail e por IP. O custo do bcrypt
    (~250 ms) já freia força bruta, mas não é uma trava — isto é.

    `async`: o envio do código (Resend) é uma chamada de rede que não pode
    prender uma thread do pool compartilhado com as demais rotas — mesmo
    motivo de app/ai.py. A parte síncrona (banco + rate limiter) roda em
    `asyncio.to_thread`.
    """
    user = await asyncio.to_thread(_authenticate_sync, data, _client_ip(request), db)

    if not settings.email_enabled:
        return _token_response(user)

    code = _login_otp.generate(user.email)
    enviado = await mailer.send_email(
        user.email, "Seu código MenteLeve",
        mailer.otp_email_html(code, settings.LOGIN_OTP_TTL_SECONDS),
    )
    if not enviado:
        # A senha está certa, mas ninguém recebe o código: travar a usuária
        # num limbo por causa do Resend fora do ar é pior que pular a A2F
        # desta vez. O boot já avisa no log quando a chave nem está configurada;
        # isto aqui cobre a chave configurada mas o envio falhando na hora.
        logging.getLogger("uvicorn.error").warning(
            "A2F: falha ao enviar código para %s — login liberado sem A2F.", user.email
        )
        return _token_response(user)

    return schemas.LoginChallengeOut(email=user.email)


@router.post("/login/verify", response_model=schemas.TokenOut)
def verify_login_code(data: schemas.LoginVerifyIn, db: Session = Depends(get_db)) -> schemas.TokenOut:
    """Segunda etapa do login com A2F: troca o código pelo token.

    Não repete a senha — a primeira etapa (`/auth/login`) já autenticou; este
    código só prova que a usuária tem acesso ao e-mail da conta.
    """
    user = crud.get_user_by_email(db, data.email)
    if user is None or not _login_otp.verify(user.email, data.code.strip()):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Código inválido ou expirado.",
        )
    return _token_response(user)


@router.get("/me", response_model=schemas.UserOut)
def me(user: User = Depends(get_current_user)) -> User:
    return user


# ----------------------- Premium -----------------------
# A rota antiga era `POST /auth/me/premium?is_premium=<bool>`: o valor vinha do
# cliente, então qualquer usuária autenticada se concedia Premium. Inofensivo
# enquanto a cobrança é simulada, bloqueante no dia em que não for.
#
# Agora a concessão tem rota própria, explicitamente nomeada como simulação e
# fechada por configuração (SIMULATED_CHECKOUT). Quando houver cobrança real,
# basta desligar a variável: o caminho de concessão passa a ser exclusivamente
# a confirmação de pagamento no servidor, sem alterar o cliente.


@router.post("/me/premium/simulate", response_model=schemas.UserOut)
def activate_premium_simulated(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> User:
    """Ativa o Premium pela compra SIMULADA do MVP (sem cobrança)."""
    if not settings.SIMULATED_CHECKOUT:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="A assinatura só pode ser ativada por uma confirmação de pagamento.",
        )
    return crud.set_user_premium(db, user, True)


@router.delete("/me/premium", response_model=schemas.UserOut)
def cancel_premium(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> User:
    """Desativa o Premium da própria conta.

    Sempre permitido, inclusive com a cobrança real ligada: cancelar o próprio
    acesso não é escalada de privilégio.
    """
    return crud.set_user_premium(db, user, False)
