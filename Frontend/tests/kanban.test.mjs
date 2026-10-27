import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  LABELS, BOARD_COLORS, LIMITS, emptyData, createBoard, getBoard, renameBoard, setBoardColor, removeBoard,
  addList, renameList, removeList, moveList, addCard, findCard, updateCard, toggleLabel, removeCard, moveCard,
  addCheckItem, toggleCheckItem, removeCheckItem, checklistProgress, dueStatus, filterCards, countCards,
  sanitize, loadKanban, saveKanban,
} from '../js/kanban.js';

const titulos = (l) => l.cards.map((c) => c.title);

function quadro() {
  const data = emptyData();
  const b = createBoard(data, 'Projeto');
  const [afazer, fazendo, feito] = b.lists;
  ['A', 'B', 'C'].forEach((t) => addCard(b, afazer.id, t));
  return { data, b, afazer, fazendo, feito };
}

test('quadro novo vem com A fazer / Fazendo / Feito e cor válida', () => {
  const data = emptyData();
  const b = createBoard(data, '  Lançamento   do site ', '#nao-existe');
  assert.equal(b.title, 'Lançamento do site');
  assert.deepEqual(b.lists.map((l) => l.title), ['A fazer', 'Fazendo', 'Feito']);
  assert.equal(b.color, BOARD_COLORS[0]);
  assert.equal(getBoard(data, b.id), b);
  assert.equal(createBoard(data, 'Vazio', BOARD_COLORS[2], false).lists.length, 0);
});

test('quadro sem título é recusado; renomear e trocar cor validam', () => {
  const data = emptyData();
  assert.throws(() => createBoard(data, '   '));
  const b = createBoard(data, 'X');
  renameBoard(data, b.id, '   ');
  assert.equal(b.title, 'X');
  renameBoard(data, b.id, 'Y'.repeat(200));
  assert.equal(b.title.length, LIMITS.boardTitle);
  setBoardColor(data, b.id, 'red');
  assert.equal(b.color, BOARD_COLORS[0]);
  setBoardColor(data, b.id, BOARD_COLORS[3]);
  assert.equal(b.color, BOARD_COLORS[3]);
});

test('excluir o quadro aberto limpa o activeBoardId', () => {
  const { data, b } = quadro();
  data.activeBoardId = b.id;
  removeBoard(data, b.id);
  assert.equal(data.boards.length, 0);
  assert.equal(data.activeBoardId, null);
});

test('listas: adicionar, renomear, mover e excluir', () => {
  const { b, afazer, feito } = quadro();
  const nova = addList(b, 'Revisão');
  assert.equal(b.lists.at(-1), nova);
  renameList(b, nova.id, 'Em revisão');
  assert.equal(nova.title, 'Em revisão');
  assert.equal(moveList(b, nova.id, 0), true);
  assert.equal(b.lists[0], nova);
  moveList(b, nova.id, 99);          // passa do fim: vai para a última posição
  assert.equal(b.lists.at(-1), nova);
  removeList(b, feito.id);
  assert.ok(!b.lists.includes(feito));
  assert.throws(() => addList(b, ''));
  assert.equal(b.lists[0], afazer);
});

test('cartões: adicionar no fim, achar, atualizar com validação e excluir', () => {
  const { b, afazer } = quadro();
  assert.deepEqual(titulos(afazer), ['A', 'B', 'C']);
  const c = afazer.cards[1];
  assert.equal(findCard(b, c.id).index, 1);
  updateCard(b, c.id, { title: '  ', description: 'detalhes', due: '2026-13-99', labels: ['azul', 'xxx', 'vermelho'], hack: 1 });
  assert.equal(c.title, 'B');                     // título vazio é ignorado
  assert.equal(c.description, 'detalhes');
  assert.equal(c.due, null);                      // data inválida vira null
  assert.deepEqual(c.labels, ['vermelho', 'azul']); // só etiquetas conhecidas, na ordem de LABELS
  assert.equal(c.hack, undefined);
  updateCard(b, c.id, { due: '2026-11-03' });
  assert.equal(c.due, '2026-11-03');
  assert.equal(removeCard(b, c.id), true);
  assert.deepEqual(titulos(afazer), ['A', 'C']);
  assert.equal(removeCard(b, 'nao-existe'), false);
});

test('toggleLabel liga e desliga', () => {
  const { b, afazer } = quadro();
  const c = afazer.cards[0];
  toggleLabel(b, c.id, 'verde');
  assert.deepEqual(c.labels, ['verde']);
  toggleLabel(b, c.id, 'verde');
  assert.deepEqual(c.labels, []);
  assert.equal(toggleLabel(b, c.id, 'inexistente'), null);
});

test('moveCard: reordenar na mesma lista e mover entre listas', () => {
  const { b, afazer, fazendo } = quadro();
  const [a, , c] = afazer.cards;
  assert.equal(moveCard(b, c.id, afazer.id, 0), true);
  assert.deepEqual(titulos(afazer), ['C', 'A', 'B']);
  assert.equal(moveCard(b, a.id, fazendo.id, 0), true);
  assert.deepEqual(titulos(afazer), ['C', 'B']);
  assert.deepEqual(titulos(fazendo), ['A']);
  moveCard(b, c.id, fazendo.id, 99);              // índice além do fim → vai para o fim
  assert.deepEqual(titulos(fazendo), ['A', 'C']);
  assert.equal(moveCard(b, a.id, fazendo.id, 0), false); // já estava ali: sem mudança
  assert.equal(moveCard(b, a.id, 'lista-x', 0), false);
});

test('checklist: adicionar, marcar, remover e progresso', () => {
  const { b, afazer } = quadro();
  const c = afazer.cards[0];
  const i1 = addCheckItem(b, c.id, 'Rascunho');
  addCheckItem(b, c.id, 'Revisar');
  assert.equal(addCheckItem(b, c.id, '   '), null);
  toggleCheckItem(b, c.id, i1.id);
  assert.deepEqual(checklistProgress(c), { done: 1, total: 2 });
  removeCheckItem(b, c.id, i1.id);
  assert.deepEqual(checklistProgress(c), { done: 0, total: 1 });
});

test('dueStatus classifica o prazo', () => {
  const hoje = '2026-10-26';
  assert.equal(dueStatus({ due: null }, hoje), null);
  assert.equal(dueStatus({ due: '2026-10-25' }, hoje), 'atrasado');
  assert.equal(dueStatus({ due: '2026-10-26' }, hoje), 'hoje');
  assert.equal(dueStatus({ due: '2026-10-28' }, hoje), 'breve');
  assert.equal(dueStatus({ due: '2026-11-10' }, hoje), 'ok');
});

test('filterCards por texto (título e descrição) e etiqueta', () => {
  const { b, afazer } = quadro();
  updateCard(b, afazer.cards[0].id, { description: 'falar com o cliente', labels: ['azul'] });
  assert.deepEqual(filterCards(afazer, { text: 'CLIENTE' }).map((c) => c.title), ['A']);
  assert.deepEqual(filterCards(afazer, { label: 'azul' }).map((c) => c.title), ['A']);
  assert.deepEqual(filterCards(afazer, { text: 'b' }).map((c) => c.title), ['B']);
  assert.equal(filterCards(afazer, {}).length, 3);
});

test('limite de cartões por quadro', () => {
  const data = emptyData();
  const b = createBoard(data, 'Cheio');
  for (let i = 0; i < LIMITS.cards; i++) addCard(b, b.lists[i % 3].id, 'c' + i);
  assert.equal(countCards(b), LIMITS.cards);
  assert.throws(() => addCard(b, b.lists[0].id, 'mais um'), /limite/);
});

test('sanitize descarta dados malformados sem quebrar', () => {
  assert.deepEqual(sanitize(null).boards, []);
  assert.deepEqual(sanitize({ boards: 'x' }).boards, []);
  const d = sanitize({
    activeBoardId: 'b1',
    boards: [
      { id: 'b1', title: 'Ok', color: 'red', lists: [
        { id: 'l1', title: '', cards: [
          { id: 'c1', title: '<b>x</b>', labels: ['azul', 'nada'], due: 'ontem', checklist: [{ id: 'i', text: 't', done: 1 }, { text: 'sem id' }] },
          { id: 'c2', title: '   ' },
          null,
        ] },
        'lixo',
      ] },
      { title: 'sem id' },
    ],
  });
  assert.equal(d.boards.length, 1);
  assert.equal(d.activeBoardId, 'b1');
  const b = d.boards[0];
  assert.equal(b.color, BOARD_COLORS[0]);
  assert.equal(b.lists.length, 1);
  assert.equal(b.lists[0].title, 'Lista');
  assert.equal(b.lists[0].cards.length, 1);
  const c = b.lists[0].cards[0];
  assert.equal(c.title, '<b>x</b>');           // texto preservado; a view é que escapa
  assert.deepEqual(c.labels, ['azul']);
  assert.equal(c.due, null);
  assert.deepEqual(c.checklist, [{ id: 'i', text: 't', done: true }]);
  assert.equal(sanitize({ boards: [], activeBoardId: 'fantasma' }).activeBoardId, null);
});

test('salvar e carregar por conta, e JSON corrompido vira vazio', () => {
  const mem = new Map();
  const storage = { getItem: (k) => mem.get(k) ?? null, setItem: (k, v) => mem.set(k, v) };
  const { data } = quadro();
  assert.equal(saveKanban(7, data, storage), true);
  assert.equal(loadKanban(7, storage).boards[0].lists[0].cards.length, 3);
  assert.equal(loadKanban(8, storage).boards.length, 0);        // outra conta não vê
  mem.set('menteleve.kanban.v1:9', '{quebrado');
  assert.deepEqual(loadKanban(9, storage).boards, []);
  const cheio = { getItem: () => null, setItem: () => { throw new Error('QuotaExceeded'); } };
  assert.equal(saveKanban(1, data, cheio), false);
});

test('etiquetas têm ids únicos e cor hex', () => {
  assert.equal(new Set(LABELS.map((l) => l.id)).size, LABELS.length);
  LABELS.forEach((l) => assert.match(l.color, /^#[0-9a-f]{6}$/i));
});
