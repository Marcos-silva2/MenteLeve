"""Gera o par de chaves VAPID para notificações push. Rode UMA vez por ambiente.

As duas chaves são independentes de `SECRET_KEY`/`ENCRYPTION_KEY` e servem só
para o Web Push: identificam o servidor perante o serviço de push do navegador
(FCM no Chrome/Android, Apple Push no Safari/iOS). Perder a privada não é
catastrófico como perder a `ENCRYPTION_KEY` — só invalida as inscrições
existentes, que se recriam sozinhas na próxima vez que a usuária abrir o app.

Uso:
    python scripts/generate_vapid_keys.py

Copie as duas linhas impressas para `VAPID_PUBLIC_KEY` e `VAPID_PRIVATE_KEY` no
`.env` (local) e nas variáveis de ambiente do Render (produção). Defina também
`VAPID_CONTACT_EMAIL` (e-mail de contato exigido pelo protocolo Web Push) e
`PUSH_SCAN_SECRET` — gere este último como qualquer outro segredo:
`python -c "import secrets; print(secrets.token_hex(32))"`.
"""
from __future__ import annotations

import base64

from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric import ec


def _b64url(raw: bytes) -> str:
    return base64.urlsafe_b64encode(raw).rstrip(b"=").decode("ascii")


def main() -> int:
    private_key = ec.generate_private_key(ec.SECP256R1())
    public_key = private_key.public_key()

    private_value = private_key.private_numbers().private_value
    private_b64 = _b64url(private_value.to_bytes(32, "big"))

    public_bytes = public_key.public_bytes(
        encoding=serialization.Encoding.X962,
        format=serialization.PublicFormat.UncompressedPoint,
    )
    public_b64 = _b64url(public_bytes)

    print("Adicione ao .env / variáveis de ambiente:\n")
    print(f"VAPID_PUBLIC_KEY={public_b64}")
    print(f"VAPID_PRIVATE_KEY={private_b64}")
    print("\nDefina também (não geradas por este script):")
    print("VAPID_CONTACT_EMAIL=seu-email@exemplo.com")
    print("PUSH_SCAN_SECRET=<gere com: python -c \"import secrets; print(secrets.token_hex(32))\">")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
