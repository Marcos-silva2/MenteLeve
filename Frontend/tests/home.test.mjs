// Agrupamento da Home em seções (Hoje / Rotinas Cíclicas / Mais Tarde / Concluídas):
// `node --test "Frontend/tests/*.test.mjs"`. Só a função pura — o DOM é coberto
// pela verificação no navegador descrita em DOCS_MELHORIAS_IMPLEMENTADAS.md.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

globalThis.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };
globalThis.window = { addEventListener() {} };
globalThis.location = { hostname: 'localhost' };

const { sectionOf, groupTasks } = await import('../js/views/home.js');

const HOJE = '2026-09-21';
const t = (id, extra = {}) => ({ id, title: id, done: false, ...extra });

describe('sectionOf', () => {
  it('prazo hoje → hoje', () => assert.equal(sectionOf(t('a', { dueDate: HOJE }), HOJE), 'hoje'));
  it('atrasada → hoje (pede atenção agora)', () => assert.equal(sectionOf(t('a', { dueDate: '2026-09-10' }), HOJE), 'hoje'));
  it('prazo futuro → depois', () => assert.equal(sectionOf(t('a', { dueDate: '2026-09-25' }), HOJE), 'depois'));
  it('sem prazo → depois', () => assert.equal(sectionOf(t('a'), HOJE), 'depois'));
  it('concluída → feitas, qualquer que seja o prazo', () => {
    assert.equal(sectionOf(t('a', { done: true, dueDate: HOJE }), HOJE), 'feitas');
    assert.equal(sectionOf(t('b', { done: true }), HOJE), 'feitas');
  });
  it('recorrente com prazo futuro → rotinas', () => {
    assert.equal(sectionOf(t('a', { dueDate: '2026-09-22', isRecurring: true, recurrencePattern: 'daily' }), HOJE), 'rotinas');
  });
  it('recorrente sem prazo → rotinas', () => {
    assert.equal(sectionOf(t('a', { isRecurring: true, recurrencePattern: 'weekly' }), HOJE), 'rotinas');
  });
  it('recorrente com prazo hoje → hoje (Rotinas é só o que NÃO caiu em Hoje)', () => {
    assert.equal(sectionOf(t('a', { dueDate: HOJE, isRecurring: true, recurrencePattern: 'daily' }), HOJE), 'hoje');
  });
  it('flag sem padrão não conta como recorrente', () => {
    assert.equal(sectionOf(t('a', { dueDate: '2026-09-25', isRecurring: true }), HOJE), 'depois');
  });
  it('tarefa antiga só com o rótulo "Hoje" cai em hoje', () => {
    assert.equal(sectionOf(t('a', { due: 'Hoje' }), HOJE), 'hoje');
  });
});

describe('groupTasks', () => {
  const tarefas = [
    t('hoje1', { dueDate: HOJE }),
    t('atrasada', { dueDate: '2026-09-01' }),
    t('futura', { dueDate: '2026-10-01' }),
    t('semdata'),
    t('rotina', { dueDate: '2026-09-22', isRecurring: true, recurrencePattern: 'daily' }),
    t('feita', { done: true, dueDate: HOJE }),
  ];
  const g = groupTasks(tarefas, HOJE);

  it('distribui cada tarefa na seção certa', () => {
    assert.deepEqual(g.hoje.map((x) => x.id), ['hoje1', 'atrasada']);
    assert.deepEqual(g.rotinas.map((x) => x.id), ['rotina']);
    assert.deepEqual(g.depois.map((x) => x.id), ['futura', 'semdata']);
    assert.deepEqual(g.feitas.map((x) => x.id), ['feita']);
  });

  it('cada tarefa aparece em UMA só seção (sem duplicar nem perder)', () => {
    const todas = Object.values(g).flat().map((x) => x.id).sort();
    assert.deepEqual(todas, tarefas.map((x) => x.id).sort());
  });

  it('não altera os dados das tarefas', () => {
    const copia = JSON.parse(JSON.stringify(tarefas));
    groupTasks(tarefas, HOJE);
    assert.deepEqual(tarefas, copia);
  });

  it('mantém a ordem original dentro de cada seção', () => {
    const inv = groupTasks([...tarefas].reverse(), HOJE);
    assert.deepEqual(inv.hoje.map((x) => x.id), ['atrasada', 'hoje1']);
  });

  it('lista vazia → seções vazias', () => {
    assert.deepEqual(groupTasks([], HOJE), { hoje: [], rotinas: [], depois: [], feitas: [] });
  });
});
