import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TOPICS, ARTICLES, articlesByTopic, findArticle } from '../js/knowledge.js';

test('todo artigo tem id único, tema válido e texto', () => {
  const ids = new Set();
  for (const a of ARTICLES) {
    assert.ok(!ids.has(a.id), `id repetido: ${a.id}`);
    ids.add(a.id);
    assert.ok(TOPICS.some((t) => t.id === a.topic), `${a.id}: tema inválido`);
    assert.ok(a.title && a.summary && a.practice, `${a.id}: falta título/resumo/prática`);
    assert.ok(a.body.length >= 2, `${a.id}: corpo curto demais`);
    assert.ok(a.minutes >= 1 && a.minutes <= 5, `${a.id}: tempo de leitura`);
  }
});

test('todo artigo cita ao menos uma fonte com link https', () => {
  for (const a of ARTICLES) {
    assert.ok(a.sources.length >= 1, `${a.id}: sem fontes`);
    for (const s of a.sources) {
      assert.ok(s.label.length > 10, `${a.id}: fonte sem descrição`);
      assert.match(s.url, /^https:\/\/[^\s"'<>]+$/, `${a.id}: link inválido ${s.url}`);
    }
  }
});

test('todo tema tem artigos e o filtro funciona', () => {
  assert.equal(articlesByTopic('tudo').length, ARTICLES.length);
  for (const t of TOPICS) {
    const lista = articlesByTopic(t.id);
    assert.ok(lista.length >= 2, `${t.id}: poucos artigos`);
    assert.ok(lista.every((a) => a.topic === t.id));
  }
});

test('findArticle acha por id e devolve null para id desconhecido', () => {
  assert.equal(findArticle('burnout').id, 'burnout');
  assert.equal(findArticle('nao-existe'), null);
});
