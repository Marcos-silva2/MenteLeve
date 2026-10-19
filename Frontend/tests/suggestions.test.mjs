// Sugestões da Bruna: qualidade antes de quantidade, sem inventar, com contexto da agenda.
// `node --test "Frontend/tests/*.test.mjs"`
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

globalThis.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };
globalThis.location = { hostname: 'localhost' };
globalThis.window = { addEventListener() {} };

const {
  buildSuggestions, quandoLembrar, regraPara, clip, ehEnchimento,
  MAX_STEPS, MAX_STEP_LEN, MAX_TEXT_LEN,
} = await import('../js/suggestions.js');
const { decomposeTask } = await import('../js/api.js');

const HOJE = '2026-10-19';          // segunda-feira
const NOW = 9 * 60;                 // 09:00
const r0 = (extra = {}) => ({ title: 'X', category: 'casa', dueDate: null, dueTime: null, endTime: null, subtasks: [], suggestion: null, ...extra });
const build = (r, ctx = {}) => buildSuggestions(r, { today: HOJE, nowMinutes: NOW, tasks: [], spaces: [], ...ctx });
const textos = (r) => r.steps.map((s) => s.text);
const tk = (id, title, extra = {}) => ({ id, title, dueDate: HOJE, dueTime: null, endTime: null, done: false, parentId: null, ...extra });

describe('os exemplos pedidos', () => {
  it('entrega de relatório "na próxima semana" (sem dia certo): passos úteis, sem inventar data nem lembrete', () => {
    const r = build(r0({ title: 'Entregar relatório', category: 'trabalho', dueDate: null }));
    assert.deepEqual(textos(r), ['Reunir os dados', 'Elaborar o relatório', 'Revisar o documento']);
    assert.equal(r.reminder, null, 'sem data não há lembrete');
    assert.deepEqual(r.notes, []);
  });

  it('"organizar minha casa": divisão simples por ambientes e NADA marcado — a pessoa escolhe por onde começar', () => {
    const r = build(r0({ title: 'Organizar minha casa', category: 'casa' }));
    assert.deepEqual(textos(r), ['Organizar a cozinha', 'Organizar os quartos', 'Organizar o banheiro']);
    assert.ok(r.steps.every((s) => s.checked === false));
    assert.equal(r.reminder, null);
  });

  it('entrevista amanhã: passos de preparação e lembrete na véspera (hoje)', () => {
    const r = build(r0({ title: 'Entrevista de emprego', category: 'carreira', dueDate: '2026-10-20' }));
    assert.deepEqual(textos(r), ['Pesquisar sobre a vaga', 'Preparar exemplos profissionais', 'Conferir horário e local ou link']);
    assert.ok(r.steps.every((s) => s.checked), 'sugestões marcadas, mas a pessoa pode desmarcar');
    assert.equal(r.reminder.kind, 'preparo');
    assert.equal(r.reminder.action.dueDate, '2026-10-19');
    assert.equal(r.reminder.action.dueTime, null, 'a véspera não ganha horário inventado');
  });

  it('apresentar o projeto na reunião de sexta: vence a regra de apresentação, não a de reunião nem a de projeto', () => {
    const r = build(r0({ title: 'Apresentar o projeto na reunião de sexta-feira', category: 'reunioes', dueDate: '2026-10-23' }));
    assert.deepEqual(textos(r), ['Revisar os slides', 'Conferir os dados', 'Preparar os pontos principais']);
    assert.equal(r.reminder.action.dueDate, '2026-10-22');
  });
});

describe('tarefa simples fica sem passos artificiais', () => {
  for (const [title, category] of [
    ['Comprar pão', 'casa'], ['Ligar para o João', 'pessoal'], ['Beber água', 'saude'],
    ['Treino de perna', 'saude'], ['Responder e-mails', 'trabalho'], ['Regar as plantas', 'casa'],
  ]) {
    it(title, () => {
      const r = build(r0({ title, category, dueDate: HOJE }));
      assert.deepEqual([r.steps, r.reminder, r.notes], [[], null, []]);
    });
  }

  it('mas "pagar boleto" tem um passo que importa: conferir valor e vencimento', () => {
    assert.deepEqual(textos(build(r0({ title: 'Pagar o boleto da internet', category: 'financas' }))), ['Conferir valor e vencimento']);
  });

  it('nenhum passo padrão genérico de "qualquer tarefa" sobrou', () => {
    for (const cat of ['trabalho', 'reunioes', 'carreira', 'estudos', 'casa', 'familia', 'saude', 'financas', 'pessoal']) {
      const r = build(r0({ title: 'Alguma coisa qualquer', category: cat }));
      assert.deepEqual(r.steps, [], cat);
    }
  });
});

describe('base de conhecimento', () => {
  it('a categoria desambigua: "exame" de saúde não vira prova, e vice-versa', () => {
    assert.equal(regraPara('Exame de sangue', 'saude').id, 'consulta');
    assert.equal(regraPara('Exame final de cálculo', 'estudos').id, 'prova');
    assert.equal(regraPara('Exame de sangue', 'casa'), null);
  });

  it('"entregar o presente" não é entrega de trabalho (sem "revisar antes de enviar")', () => {
    assert.equal(regraPara('Entregar o presente da Ana', 'trabalho'), null);
    assert.equal(regraPara('Entregar o relatório', 'trabalho').id, 'relatorio');
    assert.equal(regraPara('Entrega do projeto final', 'estudos').id, 'entrega');
  });

  it('reunião: marcar uma pede convite; participar de uma só pede os pontos a tratar', () => {
    assert.equal(regraPara('Marcar reunião com o time', 'reunioes').id, 'reuniao-organizar');
    assert.equal(regraPara('Reunião com o cliente', 'reunioes').id, 'reuniao');
  });

  it('projeto grande sugere dividir, sem inventar as etapas', () => {
    assert.deepEqual(textos(build(r0({ title: 'Projeto de mudança de casa', category: 'casa' }))).length, 2);
    assert.deepEqual(textos(build(r0({ title: 'Escrever o TCC', category: 'estudos' }))), ['Listar as etapas principais', 'Definir o primeiro passo']);
  });

  it('todos os passos da base respeitam o limite de tamanho e de quantidade', () => {
    for (const t of ['Entrevista', 'Apresentar o projeto', 'Viagem a trabalho', 'Consulta', 'Prova final', 'Relatório', 'Proposta comercial',
      'Marcar reunião', 'Reunião', 'Pagar fatura', 'Organizar a casa', 'Mercado', 'Organizar festa', 'Atualizar currículo', 'Pedir aumento']) {
      for (const cat of ['trabalho', 'reunioes', 'carreira', 'estudos', 'casa', 'familia', 'saude', 'financas', 'pessoal']) {
        const r = build(r0({ title: t, category: cat, dueDate: '2026-10-25' }));
        assert.ok(r.steps.length <= MAX_STEPS, `${t}/${cat}`);
        for (const s of r.steps) assert.ok(s.text.length <= MAX_STEP_LEN && !ehEnchimento(s.text), s.text);
        if (r.reminder) assert.ok(r.reminder.text.length <= MAX_TEXT_LEN);
      }
    }
  });
});

describe('lembretes: preparo × início, sem inventar momento', () => {
  const lemb = (extra, ctx) => buildSuggestions(r0({ title: 'Entrevista de emprego', category: 'carreira', ...extra }), { today: HOJE, nowMinutes: NOW, tasks: [], ...ctx }).reminder;

  it('data futura: véspera, sem horário', () => {
    assert.deepEqual([lemb({ dueDate: '2026-10-25' }).kind, lemb({ dueDate: '2026-10-25' }).action.dueDate], ['preparo', '2026-10-24']);
  });
  it('hoje com horário ainda por vir: não há véspera; o aviso vira "início", 30 min antes', () => {
    const l = lemb({ dueDate: HOJE, dueTime: '15:00' });
    assert.deepEqual([l.kind, l.action.dueDate, l.action.dueTime], ['inicio', HOJE, '14:30']);
    assert.match(l.text, /30 min antes/);
  });
  it('hoje com horário daqui a menos de 30 min: o aviso já passou, nada a sugerir', () => {
    assert.equal(lemb({ dueDate: HOJE, dueTime: '09:20' }), null);
  });
  it('hoje sem horário, data passada e sem data: nenhum lembrete', () => {
    assert.equal(lemb({ dueDate: HOJE }), null);
    assert.equal(lemb({ dueDate: '2026-10-10', dueTime: '10:00' }), null);
    assert.equal(lemb({ dueDate: null }), null);
  });
  it('quandoLembrar: início exige horário e não vai para antes da meia-noite', () => {
    const c = { today: HOJE, nowMinutes: NOW };
    assert.equal(quandoLembrar('inicio', { dueDate: '2026-10-25', dueTime: null }, c), null);
    assert.equal(quandoLembrar('inicio', { dueDate: '2026-10-25', dueTime: '00:10' }, c), null);
    assert.deepEqual(quandoLembrar('inicio', { dueDate: '2026-10-25', dueTime: '08:00' }, c), { kind: 'inicio', dueDate: '2026-10-25', dueTime: '07:30' });
    assert.deepEqual(quandoLembrar('preparo', { dueDate: '2026-10-25', dueTime: '08:00' }, c), { kind: 'preparo', dueDate: '2026-10-24', dueTime: null });
  });
  it('tarefa sem lembrete na base (ex.: mercado) não ganha um', () => {
    assert.equal(build(r0({ title: 'Ir ao mercado', category: 'casa', dueDate: '2026-10-25' })).reminder, null);
  });
});

describe('quando vem da IA', () => {
  const ia = (extra) => build(r0({ title: 'Entregar relatório', category: 'trabalho', dueDate: '2026-10-25', ...extra }));

  it('os passos da IA valem (na ordem), sem enchimento, sem repetir e no máximo 3', () => {
    const r = ia({ subtasks: ['Definir o próximo passo', 'Reunir números', 'reunir números', 'Escrever', 'Revisar', 'Enviar'] });
    assert.deepEqual(textos(r), ['Reunir números', 'Escrever', 'Revisar']);
  });
  it('a IA mandou vazio e o compromisso é reconhecido: entra a base; se não é reconhecido, fica sem nada', () => {
    assert.equal(textos(ia({ subtasks: [] })).length, 3);
    assert.deepEqual(build(r0({ title: 'Ligar para a Ana', subtasks: [] })).steps, []);
  });
  it('passo longo é cortado sem partir palavra', () => {
    const longo = 'Preparar uma apresentação muito detalhada, com todos os gráficos do trimestre.';
    const [p] = textos(ia({ subtasks: [longo] }));
    assert.ok(p.length <= MAX_STEP_LEN && longo.startsWith(p) && !/[.,;: ]$/.test(p), p);
  });
  it('o lembrete da IA mantém texto e título (curtos), mas as DATAS são sempre as calculadas', () => {
    const r = ia({ suggestion: {
      kind: 'preparo',
      text: 'Quer um lembrete na véspera para revisar os números com bastante calma antes de enviar tudo?',
      action: { title: 'Revisar com atenção todos os números e gráficos do relatório', category: 'trabalho', dueDate: '2026-01-01', dueTime: '03:00' },
    } });
    assert.ok(r.reminder.text.length <= MAX_TEXT_LEN && r.reminder.action.title.length <= MAX_STEP_LEN);
    assert.equal(r.reminder.action.dueDate, '2026-10-24');
    assert.equal(r.reminder.action.dueTime, null);
  });
  it('a IA pode pedir aviso de início; ele só existe se a tarefa tem horário', () => {
    const sug = { kind: 'inicio', text: 'Quer um aviso antes de começar?', action: { title: 'Começar a reunião', category: 'reunioes' } };
    assert.equal(ia({ suggestion: sug }).reminder, null);
    assert.equal(ia({ suggestion: sug, dueTime: '14:00' }).reminder.action.dueTime, '13:30');
  });
  it('lembrete da IA sem ação vira só texto (não dá para adicionar)', () => {
    assert.equal(ia({ suggestion: { kind: 'preparo', text: 'Quer um lembrete?', action: null } }).reminder.action, null);
  });
  it('texto vazio da IA não vira lembrete e cai no da base', () => {
    assert.match(ia({ suggestion: { text: '  ', action: null } }).reminder.text, /^Quer um lembrete na véspera para a revisão final/);
  });
});

describe('contexto da agenda', () => {
  it('tarefa repetida: avisa e não empilha sugestões', () => {
    const r = build(r0({ title: 'Entrevista de emprego', category: 'carreira', dueDate: '2026-10-20' }), { tasks: [tk(1, 'entrevista de emprego', { dueDate: '2026-10-20' })] });
    assert.deepEqual([r.steps, r.reminder], [[], null]);
    assert.match(r.notes[0], /Você já tem uma tarefa parecida: “entrevista de emprego”/);
  });
  it('não conta concluída, subtarefa nem a mesma tarefa em outro dia', () => {
    const t = (extra) => build(r0({ title: 'Dentista', category: 'saude', dueDate: '2026-10-20' }), { tasks: [tk(1, 'Dentista', { dueDate: '2026-10-20', ...extra })] }).notes;
    assert.deepEqual(t({ done: true }), []);
    assert.deepEqual(t({ parentId: '9' }), []);
    assert.deepEqual(t({ dueDate: '2026-10-27' }), []);
    assert.equal(t({}).length, 1);
  });
  it('conflito de horário cita a tarefa e o horário', () => {
    const r = build(r0({ title: 'Reunião com o time', category: 'reunioes', dueDate: HOJE, dueTime: '10:30' }),
      { tasks: [tk(1, 'Reunião com o cliente', { dueTime: '10:00', endTime: '11:00' })] });
    assert.match(r.notes[0], /^Conflito de horário: você já tem “Reunião com o cliente” às 10:00\./);
  });
  it('horários que apenas se encostam não são conflito', () => {
    const r = build(r0({ title: 'Reunião com o time', category: 'reunioes', dueDate: HOJE, dueTime: '11:00' }),
      { tasks: [tk(1, 'Reunião com o cliente', { dueTime: '10:00', endTime: '11:00' })] });
    assert.deepEqual(r.notes, []);
  });
  it('dia cheio: aviso, no máximo 1 passo e nenhum lembrete — não aumenta a carga', () => {
    const cheio = [1, 2, 3, 4, 5].map((i) => tk(i, `Tarefa ${i}`));
    const r = build(r0({ title: 'Entrevista de emprego', category: 'carreira', dueDate: HOJE }), { tasks: cheio });
    assert.match(r.notes[0], /^Este dia já está cheio \(5 tarefas\)\./);
    assert.equal(r.steps.length, 1);
    assert.equal(r.reminder, null);
  });
  it('dia cheio por horas (≥ 6 h agendadas), mesmo com poucas tarefas', () => {
    const r = build(r0({ title: 'Algo', dueDate: HOJE }), { tasks: [tk(1, 'A', { dueTime: '08:00', endTime: '12:00' }), tk(2, 'B', { dueTime: '13:00', endTime: '15:00' })] });
    assert.match(r.notes[0], /dia já está cheio/);
  });
  it('dia cheio e um dia próximo bem mais livre: sugere esse dia', () => {
    const cheio = [1, 2, 3, 4, 5].map((i) => tk(i, `Tarefa ${i}`));
    const r = build(r0({ title: 'Algo', dueDate: HOJE }), { tasks: cheio });
    assert.match(r.notes[0], /O dia 20\/10 está mais livre\./);
  });
  it('dia cheio sem dia mais livre, e a pessoa tem um espaço: sugere dividir', () => {
    const tarefas = [0, 1, 2, 3].flatMap((d) => [1, 2, 3, 4, 5].map((i) => tk(`${d}-${i}`, `T${d}${i}`, { dueDate: `2026-10-${19 + d}` })));
    const r = build(r0({ title: 'Algo', dueDate: HOJE }), { tasks: tarefas, spaces: [{ id: '1', name: 'Equipe' }] });
    assert.match(r.notes[0], /Se der, divida com “Equipe”\./);
    assert.doesNotMatch(r.notes[0], /mais livre/);
  });
  it('4 tarefas no dia ainda não é "cheio"', () => {
    assert.deepEqual(build(r0({ title: 'Algo', dueDate: HOJE }), { tasks: [1, 2, 3, 4].map((i) => tk(i, `T${i}`)) }).notes, []);
  });
  it('um passo que já existe como tarefa no mesmo dia não é sugerido de novo', () => {
    const r = build(r0({ title: 'Reunião com o cliente', category: 'reunioes', dueDate: HOJE }), { tasks: [tk(1, 'Preparar os pontos a tratar')] });
    assert.deepEqual(r.steps, []);
  });
  it('não altera o objeto original', () => {
    const entrada = r0({ title: 'Entregar relatório', category: 'trabalho', subtasks: ['A', 'B', 'C', 'D'], dueDate: '2026-10-25' });
    const copia = JSON.stringify(entrada);
    build(entrada);
    assert.equal(JSON.stringify(entrada), copia);
  });
});

describe('heurística sem IA', () => {
  it('decomposeTask só interpreta o texto: passos e lembretes vêm de buildSuggestions', () => {
    const r = decomposeTask('Entrevista de emprego amanhã às 10h');
    assert.deepEqual([r.subtasks, r.suggestion], [[], null]);
    assert.equal(r.category, 'carreira');
    assert.equal(r.dueTime, '10:00');
  });
  it('de ponta a ponta sem IA: a entrevista recebe os passos e o lembrete', () => {
    const d = decomposeTask('Entrevista de emprego dia 25');
    const r = build({ ...d, dueDate: '2026-10-25' });
    assert.equal(r.steps.length, 3);
    assert.equal(r.reminder.action.dueDate, '2026-10-24');
  });
});

describe('clip e enchimento', () => {
  it('clip respeita o limite, não parte palavra e tira pontuação', () => {
    assert.equal(clip('Revisar o relatório mensal agora, por favor', 25), 'Revisar o relatório');
    assert.equal(clip('Ok.', 40), 'Ok');
    assert.equal(clip('  muitos   espaços  ', 40), 'muitos espaços');
    assert.equal(clip('', 10), '');
    assert.equal(clip('Abcdefghijklmnop', 5), 'Abcde');
  });
  it('enchimento: o passo inteiro, não qualquer um que comece igual', () => {
    for (const f of ['Definir o próximo passo', 'Reservar um horário', 'Começar', 'Finalizar.', 'Concluir a tarefa', 'Planejar']) assert.ok(ehEnchimento(f), f);
    for (const ok of ['Finalizar a apresentação do trimestre', 'Planejar a viagem de férias', 'Concluir a revisão dos números']) assert.ok(!ehEnchimento(ok), ok);
  });
});
