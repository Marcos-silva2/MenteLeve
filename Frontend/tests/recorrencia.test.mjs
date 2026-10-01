// Recorrência avançada em dates.js — espelha Backend/tests/test_recurrence_avancada.py.
// `node --test "Frontend/tests/*.test.mjs"`
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

const {
  cleanWeekdays, nextOccurrence, firstOccurrence, detectWeekdays, detectUntil, detectRecurrence,
  recurrenceLabel, weekdayOf,
} = await import('../js/dates.js');

// 01/10/2026 é uma quinta-feira (weekday 3, padrão Python).
const QUI = '2026-10-01', SEX = '2026-10-02', SAB = '2026-10-03', SEG = '2026-10-05', TER = '2026-10-06', QUA = '2026-10-07';
const UTEIS = [0, 1, 2, 3, 4];

describe('weekdayOf usa o padrão do Python (0 = segunda)', () => {
  it('quinta = 3, segunda = 0, domingo = 6', () => {
    assert.equal(weekdayOf(QUI), 3);
    assert.equal(weekdayOf(SEG), 0);
    assert.equal(weekdayOf('2026-10-04'), 6);
  });
});

describe('cleanWeekdays', () => {
  for (const [entrada, esperado] of [
    [[4, 0, 2, 2], [0, 2, 4]], ['0,2,4', [0, 2, 4]], [[], null], ['', null],
    [[0, 1, 2, 3, 4, 5, 6], null], [[7], null], [['x'], null], [null, null],
  ]) {
    it(JSON.stringify(entrada), () => assert.deepEqual(cleanWeekdays(entrada), esperado));
  }
});

describe('nextOccurrence com dias e fim', () => {
  it('dias úteis: quinta → sexta, sexta → segunda', () => {
    assert.equal(nextOccurrence(QUI, 'weekly', QUI, UTEIS), SEX);
    assert.equal(nextOccurrence(SEX, 'weekly', SEX, UTEIS), SEG);
  });
  it('seg/qua/sex', () => {
    assert.equal(nextOccurrence(SEG, 'weekly', SEG, [0, 2, 4]), QUA);
    assert.equal(nextOccurrence(QUA, 'weekly', QUA, [0, 2, 4]), '2026-10-09');
    assert.equal(nextOccurrence('2026-10-09', 'weekly', '2026-10-09', [0, 2, 4]), '2026-10-12');
  });
  it('atrasada e adiantada', () => {
    assert.equal(nextOccurrence('2026-09-28', 'weekly', QUI, UTEIS), SEX);
    assert.equal(nextOccurrence(SEG, 'weekly', QUI, UTEIS), TER);
  });
  it('semanal simples não muda', () => {
    assert.equal(nextOccurrence(QUI, 'weekly', QUI), '2026-10-08');
    assert.equal(nextOccurrence(QUI, 'weekly', QUI, null), '2026-10-08');
  });
  it('fim da série', () => {
    assert.equal(nextOccurrence(QUI, 'daily', QUI, null, SEX), SEX);
    assert.equal(nextOccurrence(SEX, 'daily', SEX, null, SEX), null);
    assert.equal(nextOccurrence(SEX, 'weekly', SEX, UTEIS, SAB), null);
    assert.equal(nextOccurrence(QUI, 'monthly', QUI, null, '2026-10-31'), null);
  });
});

describe('firstOccurrence com dias', () => {
  it('hoje vale; sábado cai na segunda', () => {
    assert.equal(firstOccurrence('', 'weekly', QUI, UTEIS), QUI);
    assert.equal(firstOccurrence('', 'weekly', SAB, UTEIS), SEG);
    assert.equal(firstOccurrence('', 'weekly', QUI, [0, 2]), SEG);
  });
});

describe('detecção (mesmos casos do Python)', () => {
  for (const [texto, dias] of [
    ['daily às 9h nos dias úteis', UTEIS],
    ['Responder e-mails todo dia útil', UTEIS],
    ['academia de segunda a sexta', UTEIS],
    ['aula de inglês de terça a quinta', [1, 2, 3]],
    ['plantão de sexta a domingo', [4, 5, 6]],
    ['reunião toda segunda e quarta', [0, 2]],
    ['treino às segundas, quartas e sextas', [0, 2, 4]],
    ['pilates todas as terças e quintas', [1, 3]],
  ]) {
    it(texto, () => {
      assert.deepEqual(detectWeekdays(texto), dias);
      assert.equal(detectRecurrence(texto), 'weekly');
    });
  }
  for (const texto of ['reunião toda segunda às 9h', 'comprar pão', 'ligar para a mãe na segunda', 'entregar relatório segunda e sexta']) {
    it(`não inventa dias: ${texto}`, () => assert.equal(detectWeekdays(texto), null));
  }
  for (const [texto, fim] of [
    ['academia todo dia até 20/12', '2026-12-20'],
    ['tomar remédio todo dia até 5/10', '2026-10-05'],
    ['aula toda terça até 10/03', '2027-03-10'],
    ['estágio de segunda a sexta até 31/01/2027', '2027-01-31'],
    ['curso toda quarta até 15 de dezembro', '2026-12-15'],
    ['plantão todo sábado até dezembro', '2026-12-31'],
    ['revisão mensal até fevereiro de 2027', '2027-02-28'],
  ]) {
    it(`fim: ${texto}`, () => assert.equal(detectUntil(texto, QUI), fim));
  }
  it('sem fim dito', () => {
    assert.equal(detectUntil('reunião toda segunda', QUI), null);
    assert.equal(detectUntil('até amanhã', QUI), null);
  });
});

describe('recurrenceLabel', () => {
  const r = (extra) => recurrenceLabel({ isRecurring: true, ...extra });
  it('rótulos', () => {
    assert.equal(r({ recurrencePattern: 'daily' }), 'Todo dia');
    assert.equal(r({ recurrencePattern: 'weekly', recurrenceWeekdays: UTEIS }), 'Dias úteis');
    assert.equal(r({ recurrencePattern: 'weekly', recurrenceWeekdays: [0, 2, 4] }), 'Seg, Qua, Sex');
    assert.equal(r({ recurrencePattern: 'monthly', recurrenceUntil: '2026-12-20' }), 'Todo mês · até 20/12');
    assert.equal(recurrenceLabel({ isRecurring: false }), '');
  });
});
