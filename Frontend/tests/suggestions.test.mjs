// Sugestões da Bruna: toda tarefa recebe, e sempre simples.
// `node --test "Frontend/tests/*.test.mjs"`
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

globalThis.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };
globalThis.location = { hostname: 'localhost' };
globalThis.window = { addEventListener() {} };

const { simplifySuggestions, clip, MAX_STEPS, MAX_STEP_LEN, MAX_TEXT_LEN } = await import('../js/suggestions.js');
const { CATEGORIES } = await import('../js/categories.js');
const { decomposeTask } = await import('../js/api.js');

const HOJE = '2026-10-01';
const base = (extra = {}) => ({ title: 'Alguma coisa', category: 'casa', dueDate: null, dueTime: null, subtasks: [], suggestion: null, ...extra });

describe('toda tarefa recebe sugestão', () => {
  for (const c of CATEGORIES) {
    it(`${c.id}: sem nada da IA, entram 2 passos curtos`, () => {
      const r = simplifySuggestions(base({ category: c.id }), { today: HOJE });
      assert.equal(r.subtasks.length, MAX_STEPS);
      for (const s of r.subtasks) assert.ok(s.length > 0 && s.length <= MAX_STEP_LEN, s);
    });
  }

  it('categoria antiga ou desconhecida usa o padrão da categoria padrão', () => {
    assert.equal(simplifySuggestions(base({ category: 'xyz' }), { today: HOJE }).subtasks.length, MAX_STEPS);
    assert.equal(simplifySuggestions(base({ category: 'filhos' }), { today: HOJE }).subtasks[0], 'Combinar os detalhes');
  });

  it('com data futura ganha lembrete na véspera; sem data ou para hoje, não', () => {
    const futuro = simplifySuggestions(base({ category: 'reunioes', dueDate: '2026-10-05' }), { today: HOJE });
    assert.match(futuro.suggestion.text, /véspera para rever a pauta/);
    assert.equal(futuro.suggestion.action.dueDate, '2026-10-04');
    assert.equal(futuro.suggestion.action.category, 'reunioes');
    assert.equal(simplifySuggestions(base({ dueDate: HOJE }), { today: HOJE }).suggestion, null);
    assert.equal(simplifySuggestions(base(), { today: HOJE }).suggestion, null);
  });

  it('a heurística sem IA também cobre frases sem nenhuma palavra-chave', () => {
    for (const frase of ['Pensar no assunto', 'Ver aquilo amanhã', 'xyz']) {
      const r = simplifySuggestions(decomposeTask(frase), { today: HOJE });
      assert.ok(r.subtasks.length >= 1, frase);
    }
  });
});

describe('sempre simples', () => {
  it('corta para 2 passos e preserva a ordem', () => {
    const r = simplifySuggestions(base({ subtasks: ['A', 'B', 'C', 'D'] }), { today: HOJE });
    assert.deepEqual(r.subtasks, ['A', 'B']);
  });

  it('passo longo é cortado sem partir palavra e sem pontuação no fim', () => {
    const longo = 'Preparar uma apresentação muito detalhada, com todos os gráficos do trimestre.';
    const [p] = simplifySuggestions(base({ subtasks: [longo] }), { today: HOJE }).subtasks;
    assert.ok(p.length <= MAX_STEP_LEN && longo.startsWith(p) && !/[.,;: ]$/.test(p), p);
  });

  it('os da IA valem; os padrão só entram se ela não mandou nenhum aproveitável', () => {
    assert.deepEqual(simplifySuggestions(base({ subtasks: ['Ligar para o João'] }), { today: HOJE }).subtasks, ['Ligar para o João']);
    const r = simplifySuggestions(base({ title: 'Fazer uma lista', subtasks: ['fazer uma lista'] }), { today: HOJE });
    assert.equal(r.subtasks.length, 1, 'o passo igual ao título some e o padrão que sobra entra');
    assert.notEqual(r.subtasks[0].toLowerCase(), 'fazer uma lista');
  });

  it('sem repetir passos entre si', () => {
    const r = simplifySuggestions(base({ subtasks: ['Ligar', 'ligar', 'Ligar ', 'Enviar'] }), { today: HOJE });
    assert.deepEqual(r.subtasks, ['Ligar', 'Enviar']);
  });

  it('lembrete da IA: frase curta e título curto; sem texto, vira o padrão', () => {
    const r = simplifySuggestions(base({
      dueDate: '2026-10-09',
      suggestion: { text: 'Notei que esta é uma tarefa importante e por isso quero muito te ajudar a lembrar dela antes do dia', action: { title: 'Revisar com atenção todos os números e gráficos do relatório', dueDate: '2026-10-08' } },
    }), { today: HOJE });
    assert.ok(r.suggestion.text.length <= MAX_TEXT_LEN);
    assert.ok(r.suggestion.action.title.length <= MAX_STEP_LEN);
    assert.equal(r.suggestion.action.dueDate, '2026-10-08', 'a data que a IA escolheu é mantida');
    const vazio = simplifySuggestions(base({ dueDate: '2026-10-09', suggestion: { text: '  ', action: null } }), { today: HOJE });
    assert.match(vazio.suggestion.text, /^Quer um lembrete na véspera/);
  });

  it('lembrete "Véspera" da heurística vira o dia anterior à data final da tarefa', () => {
    const sug = { text: 'Quer um lembrete?', action: { title: 'Comprar antitérmico', category: 'saude', due: 'Véspera', dueDate: '2026-10-01' } };
    const r = simplifySuggestions(base({ category: 'saude', dueDate: '2026-10-06', suggestion: sug }), { today: HOJE });
    assert.equal(r.suggestion.action.dueDate, '2026-10-05');
    assert.equal(r.suggestion.action.due, '');
    // tarefa para amanhã: a véspera é hoje; para hoje, nunca antes de hoje
    assert.equal(simplifySuggestions(base({ dueDate: '2026-10-02', suggestion: sug }), { today: HOJE }).suggestion.action.dueDate, HOJE);
    assert.equal(simplifySuggestions(base({ dueDate: HOJE, suggestion: sug }), { today: HOJE }).suggestion.action.dueDate, HOJE);
  });

  it('não altera o objeto original', () => {
    const entrada = base({ subtasks: ['A', 'B', 'C'] });
    simplifySuggestions(entrada, { today: HOJE });
    assert.deepEqual(entrada.subtasks, ['A', 'B', 'C']);
  });
});

describe('clip', () => {
  it('respeita o limite, não parte palavra e tira pontuação', () => {
    assert.equal(clip('Revisar o relatório mensal agora, por favor', 25), 'Revisar o relatório');
    assert.equal(clip('Ok.', 40), 'Ok');
    assert.equal(clip('  muitos   espaços  ', 40), 'muitos espaços');
    assert.equal(clip('', 10), '');
    assert.equal(clip('Abcdefghijklmnop', 5), 'Abcde', 'palavra única maior que o limite é cortada');
  });
});
