"""Criptografa as linhas gravadas antes da criptografia. Rode UMA vez.

A leitura já aceita as duas formas (ver app/crypto.py), então o app funciona sem
este script — mas as linhas antigas continuariam em texto puro no banco para
sempre, que é justamente o que se quer eliminar.

Uso (a partir de Backend/, com o .env apontando para o banco de destino):

    .venv/Scripts/python.exe scripts/encrypt_existing.py            # simulação
    .venv/Scripts/python.exe scripts/encrypt_existing.py --aplicar  # grava

É idempotente: pula o que já começa com `v1:`. Rodar duas vezes não faz efeito.

Trabalha com SQL puro de propósito — se passasse pelo ORM, o TypeDecorator já
decifraria na leitura e não daria para distinguir o que ainda falta converter.
"""
from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from sqlalchemy import text  # noqa: E402

from app.crypto import encrypt, encryption_active, is_encrypted  # noqa: E402
from app.database import engine  # noqa: E402

# (tabela, coluna) — precisa espelhar database._WIDENED_COLUMNS.
ALVOS = (("tasks", "title"), ("users", "name"))


def main() -> int:
    aplicar = "--aplicar" in sys.argv

    if not encryption_active():
        print("ENCRYPTION_KEY não definida — nada a fazer.")
        print('Gere com: python -c "import secrets; print(secrets.token_hex(32))"')
        return 1

    total_pendente = 0

    for tabela, coluna in ALVOS:
        with engine.begin() as conn:
            linhas = conn.execute(
                text(f"SELECT id, {coluna} FROM {tabela} ORDER BY id")
            ).all()

            pendentes = [
                (rid, valor) for rid, valor in linhas
                if valor is not None and not is_encrypted(valor)
            ]
            total_pendente += len(pendentes)

            print(
                f"{tabela}.{coluna}: {len(linhas)} linha(s), "
                f"{len(pendentes)} em texto puro."
            )

            if not aplicar:
                continue

            for rid, valor in pendentes:
                conn.execute(
                    text(f"UPDATE {tabela} SET {coluna} = :v WHERE id = :id"),
                    {"v": encrypt(valor), "id": rid},
                )
            if pendentes:
                print(f"  -> {len(pendentes)} linha(s) criptografada(s).")

    if not aplicar and total_pendente:
        print(f"\nSimulação. Rode com --aplicar para converter {total_pendente} linha(s).")
    elif not total_pendente:
        print("\nNada pendente — tudo já está criptografado.")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
