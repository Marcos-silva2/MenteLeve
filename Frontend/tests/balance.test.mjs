// Equilíbrio Trabalho × Pessoal: `node --test "Frontend/tests/*.test.mjs"`
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

globalThis.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };
const { weekBalance, formatMinutes } = await import('../js/balance.js');

// semana de 28/09/2026 (segunda) a 04/10/2026 (domingo)
const W = '2026-09-28';
const tk = (id, category, dueDate, dueTime = null, endTime = null, extra = {}) =>
  ({ id, category, dueDate, dueTime, endTime, done: false, ...extra });

describe('weekBalance', () => {
  it('soma o tempo por grupo e conta tarefas e concluídas', () => {
    const b = weekBalance([
      tk('a', 'reunioes', '2026-09-29', '10:00', '12:00'),             // trabalho 2h
      tk('b', 'trabalho', '2026-09-30', '14:00', '15:00', { done: true }), // trabalho 1h, feita
      tk('c', 'saude', '2026-10-01', '07:00', '08:00'),                // vida 1h
      tk('d', 'casa', '2026-10-02'),                                   // vida, sem horário
    ], W);
    assert.equal(b.trabalho.minutes, 180);
    assert.equal(b.vida.minutes, 60);
    assert.deepEqual([b.trabalho.count, b.trabalho.done, b.vida.count, b.vida.done], [2, 1, 2, 0]);
    assert.equal(b.vida.timed, 1);
    assert.equal(b.totalMinutes, 240);
    assert.equal(b.share, 0.75);
  });

  it('só olha a semana pedida (segunda a domingo, inclusive as pontas)', () => {
    const b = weekBalance([
      tk('antes', 'trabalho', '2026-09-27', '09:00', '10:00'),
      tk('seg', 'trabalho', '2026-09-28', '09:00', '10:00'),
      tk('dom', 'trabalho', '2026-10-04', '09:00', '10:00'),
      tk('depois', 'trabalho', '2026-10-05', '09:00', '10:00'),
    ], W);
    assert.equal(b.trabalho.count, 2);
  });

  it('ignora subtarefas e tarefas sem data', () => {
    const b = weekBalance([
      tk('a', 'trabalho', '2026-09-29', '09:00', '10:00', { parentId: 'x' }),
      tk('b', 'trabalho', null, '09:00', '10:00'),
    ], W);
    assert.equal(b.trabalho.count + b.vida.count, 0);
  });

  it('sem fim, conta 30 min; categoria antiga e desconhecida entram em Vida', () => {
    const b = weekBalance([tk('a', 'filhos', '2026-09-29', '09:00'), tk('b', 'xyz', '2026-09-29', '10:00')], W);
    assert.equal(b.vida.minutes, 60);
    assert.equal(b.trabalho.count, 0);
  });

  it('dia mais carregado', () => {
    const b = weekBalance([
      tk('a', 'trabalho', '2026-09-29', '09:00', '10:00'),
      tk('b', 'casa', '2026-09-30', '09:00', '12:00'),
      tk('c', 'trabalho', '2026-09-30', '13:00', '14:00'),
    ], W);
    assert.deepEqual(b.busiest, { key: '2026-09-30', minutes: 240 });
  });

  it('mensagens: vazia, sem horário, trabalho demais, vida demais, equilibrada', () => {
    assert.match(weekBalance([], W).mensagem, /Semana livre/);
    assert.match(weekBalance([tk('a', 'casa', '2026-09-29')], W).mensagem, /Ainda sem horários/);
    assert.match(weekBalance([tk('a', 'trabalho', '2026-09-29', '08:00', '17:00'), tk('b', 'casa', '2026-09-29', '18:00', '19:00')], W).mensagem, /maior parte/);
    assert.match(weekBalance([tk('a', 'casa', '2026-09-29', '08:00', '17:00'), tk('b', 'trabalho', '2026-09-29', '18:00', '19:00')], W).mensagem, /vida pessoal/);
    assert.match(weekBalance([tk('a', 'casa', '2026-09-29', '08:00', '10:00'), tk('b', 'trabalho', '2026-09-29', '10:00', '12:00')], W).mensagem, /Boa divisão/);
  });

  it('share é null sem nenhum horário', () => {
    assert.equal(weekBalance([tk('a', 'casa', '2026-09-29')], W).share, null);
  });
});

describe('formatMinutes', () => {
  for (const [min, txt] of [[0, '0 min'], [45, '45 min'], [60, '1h'], [90, '1h30'], [125, '2h05'], [120, '2h']]) {
    it(`${min} → ${txt}`, () => assert.equal(formatMinutes(min), txt));
  }
});
