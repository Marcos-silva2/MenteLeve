"""Categorias de tarefa — fonte única no backend (o frontend espelha em js/categories.js)."""
from __future__ import annotations

# Trabalho
WORK = ("trabalho", "reunioes", "carreira", "estudos")
# Vida pessoal
LIFE = ("casa", "familia", "saude", "financas", "pessoal")

CATEGORIES = WORK + LIFE
DEFAULT_CATEGORY = "casa"

# Categorias do app antes da ampliação para vida + trabalho -> equivalente atual.
# Clientes com cache antigo e filas offline ainda podem enviá-las.
LEGACY_CATEGORIES = {
    "filhos": "familia",
    "relacionamento": "pessoal",
}


def normalize_category(value):
    """Converte categorias antigas para as atuais; o que não é conhecido volta intacto
    (a validação do schema recusa)."""
    if isinstance(value, str):
        return LEGACY_CATEGORIES.get(value, value)
    return value
