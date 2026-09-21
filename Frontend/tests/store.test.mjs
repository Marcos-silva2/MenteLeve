// Testes de sanidade de js/store.js — serialização, persistência no localStorage,
// fila offline e sincronização (upsert por id). Sem dependências nem navegador:
// `node --test "Frontend/tests/*.test.mjs"`. localStorage, window e fetch são substituídos por
// stubs em memória ANTES de importar o módulo (ele lê o localStorage ao carregar).
import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

// ---------------- stubs do ambiente de navegador ----------------
const memoria = new Map();
globalThis.localStorage = {
  getItem: (k) => (memoria.has(k) ? memoria.get(k) : null),
  setItem: (k, v) => { memoria.set(k, String(v)); },
  removeItem: (k) => { memoria.delete(k); },
  clear: () => memoria.clear(),
};
globalThis.window = { addEventListener() {} };
globalThis.location = { hostname: 'localhost' };

// Backend falso: guarda as tarefas "no servidor" e registra cada chamada.
const servidor = { online: true, chamadas: [], tarefas: new Map(), proximoId: 100 };
const json = (status, data) => ({ ok: status < 400, status, headers: new Map(), json: async () => data });

globalThis.fetch = async (url, opts = {}) => {
  const metodo = opts.method || 'GET';
  const { pathname, searchParams } = new URL(url);
  servidor.chamadas.push({ metodo, pathname, query: searchParams.get('today'), corpo: opts.body ? JSON.parse(opts.body) : null });
  if (!servidor.online) throw new TypeError('Failed to fetch');

  if (pathname === '/health') return json(200, { status: 'ok' });

  if (pathname === '/tasks' && metodo === 'POST') {
    const corpo = JSON.parse(opts.body);
    const t = { id: servidor.proximoId++, user_id: 5, done: false, created_at: new Date().toISOString(), ...corpo };
    servidor.tarefas.set(t.id, t);
    return json(201, t);
  }
  const m = pathname.match(/^\/tasks\/(\d+)\/(complete|uncomplete)$/);
  if (m && metodo === 'PUT') {
    const t = servidor.tarefas.get(Number(m[1]));
    if (!t) return json(404, {});
    if (m[2] === 'complete' && t.is_recurring) {
      // Mesma regra do backend (crud.set_task_done): rola o prazo e não fecha.
      const { nextOccurrence } = await import('../js/dates.js');
      t.due_date = nextOccurrence(t.due_date, t.recurrence_pattern, searchParams.get('today'));
    } else {
      t.done = m[2] === 'complete';
    }
    return json(200, t);
  }
  return json(404, {});
};

const { todayKey, addDaysKey } = await import('../js/dates.js');
const STORAGE_KEY = 'menteleve.state.v1';

let n = 0;
/** Carrega uma instância NOVA do store (o estado é lido do localStorage no import). */
const carregarStore = async () => (await import(`../js/store.js?instancia=${++n}`));
const estadoSalvo = () => JSON.parse(memoria.get(STORAGE_KEY));

/** Sessão "logada" pré-gravada, para exercitar a fila de sincronização. */
function semearSessao() {
  memoria.set(STORAGE_KEY, JSON.stringify({ onboardingSeen: true, user: { name: 'Ana', email: 'a@b.c' }, userId: 5, token: 'jwt-de-teste', tasks: [], pending: [] }));
}

beforeEach(() => {
  memoria.clear();
  servidor.online = true;
  servidor.chamadas = [];
  servidor.tarefas.clear();
  servidor.proximoId = 100;
});

describe('persistência local (sem conta)', () => {
  it('addTask grava a tarefa, com recorrência, no localStorage', async () => {
    const store = await carregarStore();
    const t = await store.addTask({ title: 'Tomar vitamina', category: 'saude', dueDate: '2026-09-21', dueTime: '08:00', isRecurring: true, recurrencePattern: 'daily' });

    assert.match(t.id, /^id-/);
    const salvo = estadoSalvo().tasks;
    assert.equal(salvo.length, 1);
    assert.equal(salvo[0].title, 'Tomar vitamina');
    assert.equal(salvo[0].dueDate, '2026-09-21');
    assert.equal(salvo[0].dueTime, '08:00');
    assert.equal(salvo[0].isRecurring, true);
    assert.equal(salvo[0].recurrencePattern, 'daily');
    assert.equal(servidor.chamadas.length, 0, 'sem conta nada vai à rede');
  });

  it('os campos sobrevivem a recarregar o app (JSON ida e volta)', async () => {
    const a = await carregarStore();
    await a.addTask({ title: 'Regar as plantas', isRecurring: true, recurrencePattern: 'weekly', dueDate: '2026-09-22', priority: 'alta' });

    const b = await carregarStore();   // "reabriu o app"
    const [t] = b.getTasks();
    assert.equal(t.title, 'Regar as plantas');
    assert.equal(t.isRecurring, true);
    assert.equal(t.recurrencePattern, 'weekly');
    assert.equal(t.dueDate, '2026-09-22');
    assert.equal(t.priority, 'alta');
    assert.equal(t.important, true, 'prioridade alta marca importante');
  });

  it('padrão inválido ou ausente não cria tarefa recorrente', async () => {
    const store = await carregarStore();
    const a = await store.addTask({ title: 'A', isRecurring: true, recurrencePattern: 'yearly' });
    const b = await store.addTask({ title: 'B', isRecurring: true });
    const c = await store.addTask({ title: 'C', recurrencePattern: 'daily' });   // padrão sem a flag
    for (const t of [a, b, c]) {
      assert.equal(t.isRecurring, false);
      assert.equal(t.recurrencePattern, null);
    }
  });

  it('tarefa antiga salva sem os campos novos continua legível', async () => {
    memoria.set(STORAGE_KEY, JSON.stringify({
      onboardingSeen: true, user: { name: 'Ana', email: 'a@b.c' },
      tasks: [{ id: 'id-velho', title: 'Antiga', category: 'casa', due: 'Hoje', done: false, important: false, priority: 'media', createdAt: 1 }],
    }));
    const store = await carregarStore();
    const [t] = store.getTasks();
    assert.equal(t.title, 'Antiga');
    assert.ok(!t.isRecurring);
    assert.equal(store.toggleTask('id-velho').done, true);   // comportamento comum preservado
  });

  it('migra soundEnabled (versão antiga) para soundLevel', async () => {
    memoria.set(STORAGE_KEY, JSON.stringify({ soundEnabled: false }));
    assert.equal((await carregarStore()).getSoundLevel(), 'silencio');
    memoria.set(STORAGE_KEY, JSON.stringify({ soundEnabled: true }));
    assert.equal((await carregarStore()).getSoundLevel(), 'tudo');
  });

  it('JSON corrompido no localStorage cai no estado padrão em vez de quebrar', async () => {
    memoria.set(STORAGE_KEY, '{isso não é json');
    const store = await carregarStore();
    assert.deepEqual(store.getTasks(), []);
  });
});

describe('toggleTask e removeTask', () => {
  it('tarefa comum alterna concluída e persiste', async () => {
    const store = await carregarStore();
    const t = await store.addTask({ title: 'Comprar pão' });
    assert.equal(store.toggleTask(t.id).done, true);
    assert.equal(estadoSalvo().tasks[0].done, true);
    assert.equal(store.toggleTask(t.id).done, false);
  });

  it('recorrente NÃO fecha: o prazo rola para a próxima ocorrência (sem cópia)', async () => {
    const store = await carregarStore();
    const hoje = todayKey();
    const t = await store.addTask({ title: 'Tomar vitamina', dueDate: hoje, isRecurring: true, recurrencePattern: 'daily' });

    const depois = store.toggleTask(t.id);
    assert.equal(depois.done, false);
    assert.equal(depois.dueDate, addDaysKey(hoje, 1));
    assert.equal(store.getTasks().length, 1, 'nenhuma tarefa nova');
    assert.equal(estadoSalvo().tasks[0].dueDate, addDaysKey(hoje, 1));

    // Concluída de novo (adiantada: o prazo já está no futuro) → mais um ciclo.
    store.toggleTask(t.id);
    assert.equal(store.getTasks()[0].dueDate, addDaysKey(hoje, 2));
  });

  it('removeTask tira do estado e do localStorage', async () => {
    const store = await carregarStore();
    const t = await store.addTask({ title: 'Some' });
    store.removeTask(t.id);
    assert.deepEqual(store.getTasks(), []);
    assert.deepEqual(estadoSalvo().tasks, []);
  });
});

describe('upsertTasks (sincronização por id)', () => {
  it('atualiza a tarefa existente em vez de duplicar e preserva a prioridade local', async () => {
    const store = await carregarStore();
    memoria.clear();
    const local = { id: '42', title: 'Do servidor', priority: 'baixa', done: false };
    store.upsertTasks([local]);
    store.upsertTasks([{ ...local, done: true, priority: 'media', isRecurring: true, recurrencePattern: 'monthly' }]);

    const tarefas = store.getTasks();
    assert.equal(tarefas.length, 1);
    assert.equal(tarefas[0].done, true);
    assert.equal(tarefas[0].priority, 'baixa', 'o servidor não conhece a prioridade');
    assert.equal(tarefas[0].recurrencePattern, 'monthly');
  });
});

describe('fila offline → online (conta logada)', () => {
  it('criada offline sobe depois, uma vez só, com os campos de recorrência', async () => {
    semearSessao();
    const store = await carregarStore();
    store.initSession(() => {});
    servidor.online = false;

    const t = await store.addTask({ title: 'Tomar vitamina', category: 'saude', dueDate: '2026-09-21', dueTime: '08:00', isRecurring: true, recurrencePattern: 'daily' });
    assert.match(t.id, /^id-/, 'offline: id local');
    assert.equal(store.pendingCount(), 1);
    assert.equal(estadoSalvo().pending[0].kind, 'create');
    assert.equal(estadoSalvo().tasks[0].isRecurring, true, 'sobreviveu offline, no localStorage');

    servidor.online = true;
    servidor.chamadas = [];
    await store.flushPending();

    const posts = servidor.chamadas.filter((c) => c.metodo === 'POST' && c.pathname === '/tasks');
    assert.equal(posts.length, 1, 'uma criação só');
    assert.equal(posts[0].corpo.is_recurring, true);
    assert.equal(posts[0].corpo.recurrence_pattern, 'daily');
    assert.equal(posts[0].corpo.due_date, '2026-09-21');
    assert.equal(posts[0].corpo.due_time, '08:00');

    assert.equal(store.pendingCount(), 0);
    const tarefas = store.getTasks();
    assert.equal(tarefas.length, 1, 'sem duplicata');
    assert.equal(tarefas[0].id, '100', 'id local trocado pelo do servidor');
    assert.equal(tarefas[0].isRecurring, true);
    assert.equal(tarefas[0].recurrencePattern, 'daily');
  });

  it('subtarefas offline seguem a mãe quando o id local vira o do servidor', async () => {
    semearSessao();
    const store = await carregarStore();
    store.initSession(() => {});
    servidor.online = false;

    const mae = await store.addTask({ title: 'Festa do Léo' });
    await store.addTask({ title: 'Encomendar bolo', parentId: mae.id });
    servidor.online = true;
    await store.flushPending();

    const tarefas = store.getTasks();
    assert.equal(tarefas.length, 2);
    const filha = tarefas.find((t) => t.title === 'Encomendar bolo');
    const maeSalva = tarefas.find((t) => t.title === 'Festa do Léo');
    assert.equal(filha.parentId, maeSalva.id);
    assert.ok(!maeSalva.id.startsWith('id-'));
  });

  it('recorrente concluída ANTES de sincronizar não rola duas vezes', async () => {
    semearSessao();
    const store = await carregarStore();
    store.initSession(() => {});
    servidor.online = false;
    const hoje = todayKey();

    const t = await store.addTask({ title: 'Tomar vitamina', dueDate: hoje, isRecurring: true, recurrencePattern: 'daily' });
    store.toggleTask(t.id);                       // conclui offline: prazo local vira amanhã
    assert.equal(store.getTasks()[0].dueDate, addDaysKey(hoje, 1));
    assert.equal(store.pendingCount(), 1, 'só o create; a conclusão já está embutida nele');

    servidor.online = true;
    servidor.chamadas = [];
    await store.flushPending();

    assert.equal(servidor.chamadas.filter((c) => c.metodo === 'PUT').length, 0, 'nenhuma conclusão extra');
    const [salva] = store.getTasks();
    assert.equal(salva.dueDate, addDaysKey(hoje, 1), 'servidor e aparelho concordam');
    assert.equal(salva.done, false);
    assert.equal(store.getTasks().length, 1);
  });

  it('recorrente já sincronizada: o servidor rola o prazo e o aparelho adota a data dele', async () => {
    semearSessao();
    const store = await carregarStore();
    store.initSession(() => {});
    const hoje = todayKey();

    const t = await store.addTask({ title: 'Tomar vitamina', dueDate: hoje, isRecurring: true, recurrencePattern: 'daily' });
    assert.equal(t.id, '100', 'online: criada direto no servidor');

    store.toggleTask(t.id);
    await new Promise((r) => setTimeout(r, 20));   // a chamada é em segundo plano

    const put = servidor.chamadas.find((c) => c.metodo === 'PUT');
    assert.equal(put.pathname, '/tasks/100/complete');
    assert.equal(put.query, hoje, 'manda a data local, não a do servidor (UTC)');
    assert.equal(servidor.tarefas.get(100).due_date, addDaysKey(hoje, 1));
    assert.equal(store.getTasks()[0].dueDate, addDaysKey(hoje, 1));
    assert.equal(store.getTasks()[0].done, false);
    assert.equal(servidor.tarefas.size, 1, 'sem tarefa duplicada no servidor');
  });

  it('conclusão de tarefa comum feita offline entra na fila e sobe depois', async () => {
    semearSessao();
    const store = await carregarStore();
    store.initSession(() => {});
    const t = await store.addTask({ title: 'Comprar pão' });     // online: id 100
    servidor.online = false;
    store.toggleTask(t.id);
    await new Promise((r) => setTimeout(r, 20));
    assert.equal(store.pendingCount(), 1);
    assert.equal(estadoSalvo().pending[0].kind, 'done');

    servidor.online = true;
    await store.flushPending();
    assert.equal(store.pendingCount(), 0);
    assert.equal(servidor.tarefas.get(100).done, true);
  });

  it('criar e apagar offline antes de sincronizar não manda nada ao servidor', async () => {
    semearSessao();
    const store = await carregarStore();
    store.initSession(() => {});
    servidor.online = false;
    const t = await store.addTask({ title: 'Efêmera' });
    store.removeTask(t.id);
    assert.equal(store.pendingCount(), 0);
    servidor.online = true;
    servidor.chamadas = [];
    await store.flushPending();
    assert.equal(servidor.chamadas.filter((c) => c.pathname === '/tasks').length, 0);
  });
});
