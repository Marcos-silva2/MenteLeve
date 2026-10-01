// Temas de cor: `node --test "Frontend/tests/*.test.mjs"`.
import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const mem = new Map();
globalThis.localStorage = {
  getItem: (k) => (mem.has(k) ? mem.get(k) : null),
  setItem: (k, v) => mem.set(k, String(v)),
  removeItem: (k) => mem.delete(k),
};

const { THEMES, DEFAULT_THEME, isValidTheme, getTheme, setTheme } = await import('../js/theme.js');
const css = readFileSync(new URL('../css/styles.css', import.meta.url), 'utf8').replaceAll('\r\n', '\n');

const lum = (hex) => {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const contraste = (a, b) => {
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
};
const toHex = (rgb) => '#' + rgb.trim().split(/\s+/).map((n) => Number(n).toString(16).padStart(2, '0')).join('');

/** Canais --rgb-* de um tema, lidos do CSS real. */
function tokens(id) {
  const sel = id === DEFAULT_THEME ? ':root { /* Grafite */' : `:root[data-theme="${id}"] {`;
  const ini = css.indexOf(sel);
  assert.ok(ini >= 0, `bloco do tema ${id} não encontrado no CSS`);
  const bloco = css.slice(ini, css.indexOf('}', ini));
  return Object.fromEntries([...bloco.matchAll(/--rgb-([a-z0-9-]+):\s*([\d ]+);/g)].map((m) => [m[1], toHex(m[2])]));
}

describe('temas', () => {
  it('o padrão é o Grafite e há 5 temas', () => {
    assert.equal(DEFAULT_THEME, 'grafite');
    assert.equal(THEMES.length, 5);
  });

  for (const t of THEMES) {
    it(`${t.id}: tem bloco no CSS com todos os tokens e a amostra bate com ele`, () => {
      const k = tokens(t.id);
      for (const n of ['bg', 'primary-900', 'primary-800', 'primary-700', 'primary-600', 'accent', 'accent-hover',
        'soft-300', 'soft-200', 'soft-100', 'soft-50', 'muted', 'surface']) {
        assert.match(k[n] || '', /^#[0-9a-f]{6}$/, `${t.id} sem --rgb-${n}`);
      }
      assert.deepEqual(t.swatch, [k.bg, k['primary-900'], k.accent]);
    });

    it(`${t.id}: contraste AA (4,5:1) no texto`, () => {
      const k = tokens(t.id);
      assert.ok(contraste(k['primary-900'], k.bg) >= 4.5, 'texto principal sobre o fundo');
      assert.ok(contraste(k.muted, k.bg) >= 4.5, 'texto secundário sobre o fundo');
      assert.ok(contraste(k.muted, k.surface) >= 4.5, 'texto secundário sobre o branco');
      assert.ok(contraste(k['primary-600'], k.bg) >= 4.5, 'links/ações sobre o fundo');
      assert.ok(contraste(k['primary-800'], k['soft-100']) >= 4.5, 'texto sobre a pílula ativa');
      assert.ok(contraste('#ffffff', k.accent) >= 4.5, 'texto branco no botão principal');
      assert.ok(contraste('#ffffff', k['accent-hover']) >= 4.5, 'texto branco no botão principal (hover)');
    });
  }
});

describe('escolha do tema', () => {
  beforeEach(() => mem.clear());

  it('começa no padrão e persiste a escolha', () => {
    assert.equal(getTheme(), DEFAULT_THEME);
    assert.equal(setTheme('oceano'), 'oceano');
    assert.equal(getTheme(), 'oceano');
    assert.equal(mem.get('menteleve.theme'), 'oceano');
  });

  it('voltar ao padrão limpa o storage', () => {
    setTheme('lavanda');
    setTheme('grafite');
    assert.equal(mem.has('menteleve.theme'), false);
  });

  it('valor inválido no storage cai no padrão', () => {
    mem.set('menteleve.theme', 'neon');
    assert.equal(getTheme(), DEFAULT_THEME);
    assert.equal(isValidTheme('neon'), false);
    assert.equal(setTheme('neon'), DEFAULT_THEME);
  });
});
