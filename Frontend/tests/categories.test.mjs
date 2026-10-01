// Categorias vida + trabalho: `node --test "Frontend/tests/*.test.mjs"`.
import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

const mem = new Map();
globalThis.localStorage = {
  getItem: (k) => (mem.has(k) ? mem.get(k) : null),
  setItem: (k, v) => mem.set(k, String(v)),
  removeItem: (k) => mem.delete(k),
};

const {
  CATEGORIES, GROUPS, DEFAULT_CATEGORY, normalizeCategory, getCategory, categoriesOf,
  inGroup, getGroupFilter, setGroupFilter,
} = await import('../js/categories.js');

describe('categorias', () => {
  it('são as 9 do plano: 4 de trabalho e 5 de vida', () => {
    assert.deepEqual(categoriesOf('trabalho').map((c) => c.id), ['trabalho', 'reunioes', 'carreira', 'estudos']);
    assert.deepEqual(categoriesOf('vida').map((c) => c.id), ['casa', 'familia', 'saude', 'financas', 'pessoal']);
    assert.equal(CATEGORIES.length, 9);
  });

  it('ids são únicos e todo grupo existe', () => {
    assert.equal(new Set(CATEGORIES.map((c) => c.id)).size, CATEGORIES.length);
    for (const c of CATEGORIES) assert.ok(GROUPS.some((g) => g.id === c.group), c.id);
  });

  it('categorias antigas viram as atuais', () => {
    assert.equal(normalizeCategory('filhos'), 'familia');
    assert.equal(normalizeCategory('relacionamento'), 'pessoal');
    assert.equal(getCategory('filhos').id, 'familia');
  });

  it('desconhecida ou ausente vira a padrão; getCategory devolve null', () => {
    assert.equal(normalizeCategory('xyz'), DEFAULT_CATEGORY);
    assert.equal(normalizeCategory(undefined), DEFAULT_CATEGORY);
    assert.equal(getCategory('xyz'), null);
  });

  it('as cores são tokens do tema, nunca hex fixo', () => {
    for (const c of CATEGORIES) assert.match(c.dot, /^var\(--color-[a-z0-9-]+\)$/, c.id);
  });
});

describe('inGroup', () => {
  it('separa trabalho de vida e "tudo" aceita tudo', () => {
    assert.equal(inGroup({ category: 'reunioes' }, 'trabalho'), true);
    assert.equal(inGroup({ category: 'reunioes' }, 'vida'), false);
    assert.equal(inGroup({ category: 'saude' }, 'vida'), true);
    assert.equal(inGroup({ category: 'saude' }, 'tudo'), true);
  });

  it('tarefa antiga (filhos) cai em vida; categoria desconhecida também (padrão: casa)', () => {
    assert.equal(inGroup({ category: 'filhos' }, 'vida'), true);
    assert.equal(inGroup({ category: 'filhos' }, 'trabalho'), false);
    assert.equal(inGroup({ category: 'xyz' }, 'vida'), true);
  });
});

describe('grupo escolhido', () => {
  beforeEach(() => mem.clear());

  it('começa em "tudo" e lembra a escolha', () => {
    assert.equal(getGroupFilter(), 'tudo');
    assert.equal(setGroupFilter('trabalho'), 'trabalho');
    assert.equal(getGroupFilter(), 'trabalho');
    assert.equal(setGroupFilter('tudo'), 'tudo');
    assert.equal(getGroupFilter(), 'tudo');
  });

  it('valor inválido volta a "tudo"', () => {
    mem.set('menteleve.group', 'lixo');
    assert.equal(getGroupFilter(), 'tudo');
    assert.equal(setGroupFilter('lixo'), 'tudo');
  });
});
