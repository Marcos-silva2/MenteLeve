// Testes de sanidade de js/dates.js — sem dependências: `node --test "Frontend/tests/*.test.mjs"`
// (Node >= 18). As tabelas de recorrência são as MESMAS de Backend/tests/test_recurrence.py:
// cliente (offline) e servidor (ao sincronizar) precisam calcular o mesmo prazo.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  todayKey, keyOf, dateFromKey, addDaysKey, resolveDue, resolveTime, labelForKey,
  formatDue, isOverdue, nextOccurrence, detectRecurrence, firstOccurrence, cleanPattern,
} from '../js/dates.js';

// 2026-09-21 é segunda-feira.
const HOJE = '2026-09-21';

describe('chaves de data', () => {
  it('todayKey tem o formato AAAA-MM-DD e bate com a data local', () => {
    const k = todayKey();
    assert.match(k, /^\d{4}-\d{2}-\d{2}$/);
    assert.equal(k, keyOf(new Date()));
  });

  it('keyOf completa mês e dia com zero', () => {
    assert.equal(keyOf(new Date(2026, 0, 5)), '2026-01-05');
  });

  it('dateFromKey cria data LOCAL (não volta um dia por causa do UTC)', () => {
    const d = dateFromKey('2026-08-27');
    assert.equal(d.getDate(), 27);
    assert.equal(d.getMonth(), 7);
    assert.equal(d.getHours(), 0);
  });

  it('dateFromKey rejeita entrada inválida', () => {
    assert.equal(dateFromKey(''), null);
    assert.equal(dateFromKey(null), null);
    assert.equal(dateFromKey('lixo'), null);
  });

  it('addDaysKey atravessa mês, ano e bissexto', () => {
    assert.equal(addDaysKey('2026-01-31', 1), '2026-02-01');
    assert.equal(addDaysKey('2026-12-31', 1), '2027-01-01');
    assert.equal(addDaysKey('2028-02-28', 1), '2028-02-29');
    assert.equal(addDaysKey('2026-03-01', -1), '2026-02-28');
    assert.equal(addDaysKey('2026-09-21', 0), '2026-09-21');
  });
});

describe('resolveDue / resolveTime', () => {
  it('rótulos relativos', () => {
    assert.equal(resolveDue('Hoje', HOJE), '2026-09-21');
    assert.equal(resolveDue('Amanhã', HOJE), '2026-09-22');
    assert.equal(resolveDue('depois de amanhã', HOJE), '2026-09-23');
    assert.equal(resolveDue('Véspera', HOJE), '2026-09-20');
  });

  it('"esta semana" ancora no fim da semana: sábado (o comentário em dates.js diz domingo, mas a conta é 6 - getDay())', () => {
    assert.equal(resolveDue('Esta semana', HOJE), '2026-09-26');
    assert.equal(resolveDue('Esta semana', '2026-09-26'), '2026-09-26'); // no sábado, fica no próprio dia
  });

  it('dd/mm e dd/mm/aaaa', () => {
    assert.equal(resolveDue('15/10', HOJE), '2026-10-15');
    assert.equal(resolveDue('05/03/2027', HOJE), '2027-03-05');
  });

  it('"dia N": este mês se ainda não passou, senão o próximo', () => {
    assert.equal(resolveDue('dia 25', HOJE), '2026-09-25');
    assert.equal(resolveDue('dia 10', HOJE), '2026-10-10');
  });

  it('dia da semana: próxima ocorrência (nunca hoje)', () => {
    assert.equal(resolveDue('sexta', HOJE), '2026-09-25');
    assert.equal(resolveDue('segunda', HOJE), '2026-09-28');
    assert.equal(resolveDue('terça', HOJE), '2026-09-22');
  });

  it('vazio ou sem data reconhecível → null', () => {
    assert.equal(resolveDue('', HOJE), null);
    assert.equal(resolveDue('qualquer coisa', HOJE), null);
  });

  it('resolveTime extrai HH:MM', () => {
    assert.equal(resolveTime('Amanhã • 10:00'), '10:00');
    assert.equal(resolveTime('às 8h30'), '08:30');
    assert.equal(resolveTime('sem horário'), null);
  });
});

describe('exibição do prazo', () => {
  it('labelForKey', () => {
    assert.equal(labelForKey(HOJE, HOJE), 'Hoje');
    assert.equal(labelForKey('2026-09-22', HOJE), 'Amanhã');
    assert.equal(labelForKey('2026-09-20', HOJE), 'Ontem');
    assert.equal(labelForKey('2026-10-15', HOJE), '15 de outubro');
    assert.equal(labelForKey('2027-03-05', HOJE), '5 de março de 2027');
  });

  it('formatDue usa a data estruturada e cai no rótulo legado', () => {
    assert.equal(formatDue({ dueDate: '2026-09-22', dueTime: '10:00' }, HOJE), 'Amanhã • 10:00');
    assert.equal(formatDue({ dueDate: '2026-09-22' }, HOJE), 'Amanhã');
    assert.equal(formatDue({ due: 'Toda semana' }, HOJE), 'Toda semana');
    assert.equal(formatDue(null, HOJE), '');
  });

  it('isOverdue só vale para tarefa em aberto com data passada', () => {
    assert.equal(isOverdue({ dueDate: '2026-09-20', done: false }, HOJE), true);
    assert.equal(isOverdue({ dueDate: '2026-09-20', done: true }, HOJE), false);
    assert.equal(isOverdue({ dueDate: HOJE, done: false }, HOJE), false);
    assert.equal(isOverdue({ done: false }, HOJE), false);
  });
});

describe('recorrência — nextOccurrence (mesma tabela do backend)', () => {
  const casos = [
    // em dia
    ['2026-09-21', 'daily', '2026-09-21', '2026-09-22'],
    ['2026-09-21', 'weekly', '2026-09-21', '2026-09-28'],
    ['2026-09-10', 'monthly', '2026-09-10', '2026-10-10'],
    // adiantada
    ['2026-09-25', 'daily', '2026-09-21', '2026-09-26'],
    ['2026-09-25', 'weekly', '2026-09-21', '2026-10-02'],
    // atrasada: pula os ciclos perdidos
    ['2026-09-10', 'daily', '2026-09-21', '2026-09-22'],
    ['2026-09-10', 'weekly', '2026-09-21', '2026-09-24'],
    ['2026-06-15', 'monthly', '2026-09-21', '2026-10-15'],
    // sem prazo
    [null, 'daily', '2026-09-21', '2026-09-22'],
    [null, 'weekly', '2026-09-21', '2026-09-28'],
    // fim de mês
    ['2026-01-31', 'monthly', '2026-01-31', '2026-02-28'],
    ['2028-01-31', 'monthly', '2028-01-31', '2028-02-29'],
    ['2026-03-31', 'monthly', '2026-05-02', '2026-05-31'],
    // virada de ano
    ['2026-12-31', 'daily', '2026-12-31', '2027-01-01'],
    ['2026-12-15', 'monthly', '2026-12-15', '2027-01-15'],
  ];
  for (const [prazo, padrao, hoje, esperado] of casos) {
    it(`${prazo} ${padrao} (hoje ${hoje}) → ${esperado}`, () => {
      assert.equal(nextOccurrence(prazo, padrao, hoje), esperado);
    });
  }

  it('sempre devolve uma data depois de hoje', () => {
    for (const padrao of ['daily', 'weekly', 'monthly']) {
      for (const prazo of ['2026-01-01', HOJE, '2027-05-05']) {
        assert.ok(nextOccurrence(prazo, padrao, HOJE) > HOJE);
      }
    }
  });

  it('padrão inválido não mexe no prazo', () => {
    assert.equal(nextOccurrence('2026-09-21', 'yearly', HOJE), '2026-09-21');
  });
});

describe('recorrência — detectRecurrence (subconjunto compartilhado com o backend)', () => {
  const casos = [
    ['Tomar vitamina todo dia às 08:00', 'daily'],
    ['Tomar vitamina todos os dias', 'daily'],
    ['Regar as plantas diariamente', 'daily'],
    ['Alongar toda manhã', 'daily'],
    ['Toda segunda-feira levar o Léo na natação', 'weekly'],
    ['Reunião toda terça', 'weekly'],
    ['Aula de inglês toda sexta às 19h', 'weekly'],
    ['Feira todo sábado', 'weekly'],
    ['Yoga todas as quartas', 'weekly'],
    ['Faxina toda semana', 'weekly'],
    ['Pagar aluguel todo dia 10', 'monthly'],
    ['Pagar a escola todo dia 5 do mês', 'monthly'],
    ['Pagar condomínio todo mês', 'monthly'],
    ['Revisar orçamento mensalmente', 'monthly'],
    ['Comprar leite amanhã', null],
    ['Dentista sexta 15h', null],
    ['Ligar para a vovó dia 15', null],
    ['', null],
    ['Tomar remédio todo dia 8h', 'daily'],
    ['Tomar remédio todo dia 08:30', 'daily'],
    ['Estudar todo dia 45', 'daily'],
    ['Contratar diarista', null],
    ['Pagar a mensalidade da escola', null],
  ];
  for (const [texto, esperado] of casos) {
    it(`"${texto}" → ${esperado}`, () => {
      assert.equal(detectRecurrence(texto), esperado);
    });
  }
});

describe('recorrência — firstOccurrence e cleanPattern', () => {
  it('diário e sem pista começam hoje', () => {
    assert.equal(firstOccurrence('Tomar vitamina todo dia 8h', 'daily', HOJE), HOJE);
    assert.equal(firstOccurrence('Revisar orçamento todo mês', 'monthly', HOJE), HOJE);
  });

  it('semanal e mensal usam o dia dito no texto', () => {
    assert.equal(firstOccurrence('Reunião toda quarta', 'weekly', HOJE), '2026-09-23');
    assert.equal(firstOccurrence('Pagar aluguel todo dia 10', 'monthly', HOJE), '2026-10-10');
    assert.equal(firstOccurrence('Pagar aluguel todo dia 25', 'monthly', HOJE), '2026-09-25');
  });

  it('cleanPattern aceita só daily | weekly | monthly', () => {
    assert.equal(cleanPattern('daily'), 'daily');
    assert.equal(cleanPattern(' WEEKLY '), 'weekly');
    assert.equal(cleanPattern('yearly'), null);
    assert.equal(cleanPattern(undefined), null);
    assert.equal(cleanPattern(3), null);
  });
});
