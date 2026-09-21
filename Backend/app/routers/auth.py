"""Rotas de autenticação (cadastro e login com senha + token JWT)."""
from __future__ import annotations

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

from app import crud, mailer, schemas, security
from app.config import settings
from app.database import get_db
from app.dependencies import get_current_user
from app.models import User
from app.ratelimit import SlidingWindowLimiter

router = APIRouter(prefix="/auth", tags=["auth"])

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


# Recuperação de senha: aqui todo PEDIDO conta (não só falhas), porque cada um
# pode disparar um e-mail — ver settings.RESET_MAX_REQUESTS.
_reset_by_email = SlidingWindowLimiter(settings.RESET_MAX_REQUESTS, settings.RESET_WINDOW_SECONDS)
_reset_by_ip = SlidingWindowLimiter(settings.RESET_MAX_REQUESTS_PER_IP, settings.RESET_WINDOW_SECONDS)

# Resposta única para "pedi a recuperação", exista a conta ou não.
_FORGOT_MESSAGE = (
    "Se este e-mail tiver uma conta, enviaremos um link para criar uma nova senha. "
    "Confira também a caixa de spam."
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
        access_token=security.create_access_token(user.id, user.token_version),
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
def login(
    data: schemas.UserLogin,
    request: Request,
    db: Session = Depends(get_db),
) -> schemas.TokenOut:
    """Autentica por e-mail + senha e devolve o token de acesso.

    Tentativas malsucedidas são limitadas por e-mail e por IP. O custo do bcrypt
    (~250 ms) já freia força bruta, mas não é uma trava — isto é.
    """
    email_key = f"email:{data.email.strip().lower()}"
    ip_key = f"ip:{_client_ip(request)}"

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
    return _token_response(user)


@router.post(
    "/forgot-password",
    response_model=schemas.MessageOut,
    status_code=status.HTTP_202_ACCEPTED,
)
def forgot_password(
    data: schemas.ForgotPasswordIn,
    request: Request,
    background: BackgroundTasks,
    db: Session = Depends(get_db),
) -> schemas.MessageOut:
    """Pede o link de recuperação de senha.

    Responde igual exista a conta ou não (não revela quais e-mails têm cadastro).
    O e-mail sai em segundo plano para o tempo de resposta também não denunciar.
    """
    email_key = f"email:{data.email.strip().lower()}"
    ip_key = f"ip:{_client_ip(request)}"

    espera = max(_reset_by_email.retry_after(email_key), _reset_by_ip.retry_after(ip_key))
    if espera:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Você já pediu o link algumas vezes. Aguarde um pouco e tente de novo.",
            headers={"Retry-After": str(espera)},
        )
    _reset_by_email.record(email_key)
    _reset_by_ip.record(ip_key)

    user = crud.get_user_by_email(db, data.email)
    if user is not None:
        token = crud.create_password_reset_token(db, user)
        background.add_task(mailer.send_password_reset, user.email, token)
    return schemas.MessageOut(message=_FORGOT_MESSAGE)


@router.post("/reset-password", response_model=schemas.MessageOut)
def reset_password(
    data: schemas.ResetPasswordIn, db: Session = Depends(get_db)
) -> schemas.MessageOut:
    """Define a nova senha a partir do token recebido por e-mail.

    Token inexistente, expirado e já usado dão a MESMA resposta (400). Ao
    concluir, todas as sessões anteriores da conta deixam de valer.
    """
    user = crud.reset_password_with_token(db, data.token, data.new_password)
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Este link expirou ou já foi usado. Peça um novo link para continuar.",
        )
    return schemas.MessageOut(message="Senha atualizada. Entre com a nova senha.")


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
