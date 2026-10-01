// Linha do tempo (duração, conflitos e layout do dia) + detecção do término no texto.
// `node --test "Frontend/tests/*.test.mjs"`
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

const {
  toMinutes, cleanEndTime, intervalOf, rangeLabel, conflictIds, layoutDay, hourRange,
} = await import('../js/timeline.js');
const { detectEndTime } = await import('../js/dates.js');

const D = '2026-10-01';
const tk = (id, dueTime, endTime = null, extra = {}) => ({ id, dueDate: D, dueTime, endTime, done: false, ...extra });

describe('intervalos', () => {
  it('fim válido, inválido e padrão de 30 min', () => {
    assert.deepEqual(intervalOf(tk('a', '10:00', '11:30')), [600, 690]);
    assert.deepEqual(intervalOf(tk('a', '10:00', '09:00')), [600, 630]);   // fim antes do início é ignorado
    assert.deepEqual(intervalOf(tk('a', '10:00')), [600, 630]);
    assert.deepEqual(intervalOf(tk('a', '23:50')), [1430, 1440]);          // não passa da meia-noite
    assert.equal(intervalOf(tk('a', null)), null);
  });
  it('rótulos', () => {
    assert.equal(rangeLabel(tk('a', '10:00', '11:30')), '10:00–11:30');
    assert.equal(rangeLabel(tk('a', '10:00')), '10:00');
    assert.equal(rangeLabel(tk('a', null)), '');
  });
  it('cleanEndTime e toMinutes', () => {
    assert.equal(cleanEndTime('10:00', '10:30'), '10:30');
    assert.equal(cleanEndTime('10:00', '10:00'), null);
    assert.equal(cleanEndTime(null, '10:30'), null);
    assert.equal(toMinutes('24:00'), null);
  });
});

describe('conflitos', () => {
  it('sobreposição é conflito; encostar não é', () => {
    const c = conflictIds([tk('a', '10:00', '11:00'), tk('b', '10:30', '11:30'), tk('c', '11:30', '12:00')]);
    assert.deepEqual([...c].sort(), ['a', 'b']);
  });
  it('sem fim conta como 30 min', () => {
    assert.deepEqual([...conflictIds([tk('a', '10:00'), tk('b', '10:20')])].sort(), ['a', 'b']);
    assert.equal(conflictIds([tk('a', '10:00'), tk('b', '10:30')]).size, 0);
  });
  it('ignora concluídas, sem horário e dias diferentes', () => {
    const c = conflictIds([
      tk('a', '10:00', '11:00'),
      tk('b', '10:00', '11:00', { done: true }),
      tk('c', null),
      tk('d', '10:00', '11:00', { dueDate: '2026-10-02' }),
    ]);
    assert.equal(c.size, 0);
  });
  it('uma tarefa longa conflita com várias', () => {
    const c = conflictIds([tk('a', '09:00', '12:00'), tk('b', '09:30', '10:00'), tk('c', '11:00', '11:30')]);
    assert.deepEqual([...c].sort(), ['a', 'b', 'c']);
  });
});

describe('layout do dia', () => {
  it('sem sobreposição: uma coluna', () => {
    const l = layoutDay([tk('a', '09:00', '10:00'), tk('b', '10:00', '11:00')]);
    assert.deepEqual(l.map((b) => [b.task.id, b.col, b.cols]), [['a', 0, 1], ['b', 0, 1]]);
  });
  it('sobrepostas dividem a largura e reaproveitam coluna livre', () => {
    const l = layoutDay([tk('a', '09:00', '12:00'), tk('b', '09:30', '10:00'), tk('c', '10:30', '11:00')]);
    const por = Object.fromEntries(l.map((b) => [b.task.id, [b.col, b.cols]]));
    assert.deepEqual(por, { a: [0, 2], b: [1, 2], c: [1, 2] });
  });
  it('ignora tarefas sem horário', () => {
    assert.equal(layoutDay([tk('a', null)]).length, 0);
  });
  it('faixa de horas padrão 07–20, ampliada quando preciso', () => {
    assert.deepEqual(hourRange([]), [7, 20]);
    assert.deepEqual(hourRange(layoutDay([tk('a', '06:30', '07:00'), tk('b', '21:00', '22:15')])), [6, 23]);
  });
});

describe('detectEndTime (mesmos casos do Python)', () => {
  for (const [texto, inicio, fim] of [
    ['reunião das 10h às 11h30', '10:00', '11:30'],
    ['das 9 às 18', '09:00', '18:00'],
    ['call de 14h às 15h', '14:00', '15:00'],
    ['call de 1h', '14:00', '15:00'],
    ['treino por 45 min', '07:00', '07:45'],
    ['aula de 1h30', '19:00', '20:30'],
    ['apresentação de 2 horas', '16:00', '18:00'],
  ]) {
    it(texto, () => assert.equal(detectEndTime(texto, inicio), fim));
  }
  for (const [texto, inicio] of [
    ['consulta 15h', '15:00'], ['reunião de equipe', '09:00'], ['viagem de 15 a 20 de outubro', '10:00'],
    ['das 23h às 1h', '23:00'], ['call de 1h', null],
  ]) {
    it(`não inventa: ${texto}`, () => assert.equal(detectEndTime(texto, inicio), null));
  }
});
