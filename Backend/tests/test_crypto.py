"""Cifragem em repouso (AES-256-GCM) — app/crypto.py."""
from __future__ import annotations

import base64

import pytest
from sqlalchemy import text

from app import crypto
from app.config import settings
from app.crypto import EncryptionKeyError, decrypt, encrypt, is_encrypted
from app.database import SessionLocal
from app.models import Task, User


@pytest.fixture()
def chave(monkeypatch):
    """Troca a chave e limpa o cache do cifrador (e o restaura ao final)."""
    def _usar(hex_key: str):
        monkeypatch.setattr(settings, "ENCRYPTION_KEY", hex_key)
        crypto._cipher.cache_clear()

    yield _usar
    monkeypatch.undo()
    crypto._cipher.cache_clear()


def test_cifra_e_decifra_ida_e_volta():
    original = "Vacina do Léo — dia 15 🎂"
    cifrado = encrypt(original)
    assert cifrado != original
    assert is_encrypted(cifrado)
    assert cifrado.startswith("v1:")
    assert decrypt(cifrado) == original


def test_texto_cifrado_nao_contem_o_original():
    cifrado = encrypt("segredo importante")
    assert "segredo" not in cifrado


def test_nonce_aleatorio_mesmo_texto_gera_valores_diferentes():
    a, b = encrypt("mesma coisa"), encrypt("mesma coisa")
    assert a != b
    assert decrypt(a) == decrypt(b) == "mesma coisa"


def test_envelope_tem_nonce_de_96_bits_e_tag_de_128():
    blob = base64.urlsafe_b64decode(encrypt("abc")[3:])
    # 12 (nonce) + 3 (texto) + 16 (tag GCM)
    assert len(blob) == 12 + 3 + 16


def test_none_passa_direto():
    assert encrypt(None) is None
    assert decrypt(None) is None


def test_valor_legado_sem_prefixo_e_lido_como_esta():
    assert decrypt("titulo antigo em texto puro") == "titulo antigo em texto puro"


def test_adulteracao_e_detectada():
    cifrado = encrypt("intacto")
    blob = bytearray(base64.urlsafe_b64decode(cifrado[3:]))
    blob[-1] ^= 0x01  # vira um bit da tag de autenticação
    adulterado = "v1:" + base64.urlsafe_b64encode(bytes(blob)).decode()
    with pytest.raises(EncryptionKeyError):
        decrypt(adulterado)


def test_chave_errada_nao_decifra(chave):
    cifrado = encrypt("meu segredo")
    chave("cd" * 32)
    with pytest.raises(EncryptionKeyError):
        decrypt(cifrado)


def test_sem_chave_dado_cifrado_falha_alto_e_texto_novo_fica_puro(chave):
    cifrado = encrypt("meu segredo")
    chave("")
    assert encrypt("texto") == "texto"  # sem chave: modo texto puro (dev)
    with pytest.raises(EncryptionKeyError):
        decrypt(cifrado)


@pytest.mark.parametrize("ruim", ["nao-e-hex", "abcd", "ab" * 16])
def test_chave_malformada_e_recusada(chave, ruim):
    chave(ruim)
    with pytest.raises(EncryptionKeyError):
        encrypt("x")


def test_banco_guarda_ciphertext_e_a_aplicacao_ve_texto_puro():
    """EncryptedText: título/nome cifrados no disco, texto puro no ORM."""
    with SessionLocal() as db:
        user = User(email="c@example.com", name="Carla Souza", hashed_password="x")
        db.add(user)
        db.commit()
        task = Task(user_id=user.id, title="Consulta da Bia")
        db.add(task)
        db.commit()
        task_id, user_id = task.id, user.id

        bruto_titulo = db.execute(text("SELECT title FROM tasks WHERE id = :i"), {"i": task_id}).scalar_one()
        bruto_nome = db.execute(text("SELECT name FROM users WHERE id = :i"), {"i": user_id}).scalar_one()
        assert bruto_titulo.startswith("v1:") and "Consulta" not in bruto_titulo
        assert bruto_nome.startswith("v1:") and "Carla" not in bruto_nome

        db.expire_all()
        assert db.get(Task, task_id).title == "Consulta da Bia"
        assert db.get(User, user_id).name == "Carla Souza"
