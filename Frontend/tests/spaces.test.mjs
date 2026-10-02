// Espaços compartilhados no frontend: store, regras de apagar, escape e mensagens.
// `node --test "Frontend/tests/*.test.mjs"`
import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

const memoria = new Map();
globalThis.localStorage = {
  getItem: (k) => (memoria.has(k) ? memoria.get(k) : null),
  setItem: (k, v) => { memoria.set(k, String(v)); },
  removeItem: (k) => { memoria.delete(k); },
  clear: () => memoria.clear(),
};
globalThis.window = { addEventListener() {} };
globalThis.location = { hostname: 'localhost' };
globalThis.document = { addEventListener() {}, createElement: () => ({ content: {} }) };

// Servidor falso só para /spaces e /tasks
const srv = { online: true, espacos: [], tarefas: [], chamadas: [], proxId: 100 };
const json = (status, data) => ({ ok: status < 400, status, headers: new Map(), json: async () => data });
const espaco = (id, nome, dono, membros) => ({
  id, name: nome, owner_id: dono, invite_code: 'ABCD-EFGH', created_at: '2026-10-01T00:00:00Z',
  members: membros.map(([user_id, name]) => ({ user_id, name, is_owner: user_id === dono })),
});
globalThis.fetch = async (url, opts = {}) => {
  const metodo = opts.method || 'GET';
  const { pathname } = new URL(url);
  srv.chamadas.push({ metodo, pathname, corpo: opts.body ? JSON.parse(opts.body) : null });
  if (!srv.online) throw new TypeError('Failed to fetch');
  if (pathname === '/health') return json(200, { status: 'ok' });
  if (pathname === '/auth/me') return json(200, { id: 5, name: 'Ana', email: 'a@b.c', created_at: '2026-01-01T00:00:00Z' });
  if (pathname === '/spaces' && metodo === 'GET') return json(200, srv.espacos);
  if (pathname === '/spaces' && metodo === 'POST') {
    const e = espaco(7, JSON.parse(opts.body).name, 5, [[5, 'Ana']]);
    srv.espacos.push(e);
    return json(201, e);
  }
  if (pathname === '/spaces/join') {
    if (JSON.parse(opts.body).code.toUpperCase() !== 'ABCD-EFGH') return json(404, {});   // o backend normaliza
    const e = espaco(8, 'Equipe', 9, [[9, 'Caio Dono'], [5, 'Ana']]);
    srv.espacos.push(e);
    srv.tarefas.push({ id: 300, user_id: 9, title: 'Da equipe', category: 'trabalho', space_id: 8, author_name: 'Caio Dono', done: false });
    return json(200, e);
  }
  if (/^\/spaces\/\d+\/leave$/.test(pathname)) { srv.espacos = []; return json(204, null); }
  if (pathname === '/tasks' && metodo === 'GET') return json(200, srv.tarefas);
  if (pathname === '/tasks' && metodo === 'POST') {
    const t = { id: srv.proxId++, user_id: 5, done: false, created_at: new Date().toISOString(), ...JSON.parse(opts.body) };
    srv.tarefas.push(t);
    return json(201, t);
  }
  return json(404, {});
};
// 204 sem corpo: o request() do api.js lê res.status === 204 antes do json()

const STORAGE_KEY = 'menteleve.state.v1';
let n = 0;
const carregarStore = async () => (await import(`../js/store.js?instancia=${++n}`));
const semear = (extra = {}) => memoria.set(STORAGE_KEY, JSON.stringify({
  onboardingSeen: true, user: { name: 'Ana', email: 'a@b.c' }, userId: 5, token: 'jwt', tasks: [], pending: [], spaces: [], ...extra,
}));

beforeEach(() => { memoria.clear(); srv.online = true; srv.espacos = []; srv.tarefas = []; srv.chamadas = []; srv.proxId = 100; });

describe('esc (texto de outras pessoas nunca vira HTML)', () => {
  it('escapa & < > " \'', async () => {
    const { esc } = await import('../js/ui.js');
    assert.equal(esc('<img src=x onerror=alert(1)>'), '&lt;img src=x onerror=alert(1)&gt;');
    assert.equal(esc(`"a" & 'b'`), '&quot;a&quot; &amp; &#39;b&#39;');
    assert.equal(esc(null), '');
    assert.equal(esc(5), '5');
  });
});

describe('espaços no store', () => {
  it('criar adiciona à lista e persiste', async () => {
    semear();
    const store = await carregarStore();
    store.initSession(() => {});
    const e = await store.createSpace('Casa');
    assert.equal(e.id, '7');
    assert.deepEqual(store.getSpaces().map((x) => x.name), ['Casa']);
    assert.equal(JSON.parse(memoria.get(STORAGE_KEY)).spaces[0].name, 'Casa');
  });

  it('entrar baixa as tarefas do espaço, com autor e espaço', async () => {
    semear();
    const store = await carregarStore();
    store.initSession(() => {});
    await store.joinSpace('abcd-efgh');
    const t = store.getTasks().find((x) => x.title === 'Da equipe');
    assert.ok(t, 'a tarefa da equipe chegou');
    assert.equal(t.spaceId, '8');
    assert.equal(t.authorName, 'Caio Dono');
    assert.equal(t.userId, 9);
  });

  it('código inválido lança ApiError 404 e não muda nada', async () => {
    semear();
    const store = await carregarStore();
    store.initSession(() => {});
    await assert.rejects(() => store.joinSpace('ZZZZ'), (e) => e.status === 404);
    assert.equal(store.getSpaces().length, 0);
  });

  it('sair tira o espaço e as tarefas dele do aparelho', async () => {
    semear();
    const store = await carregarStore();
    store.initSession(() => {});
    await store.joinSpace('ABCD-EFGH');
    await store.addTask({ title: 'Minha, pessoal' });
    await store.leaveSpace('8');
    assert.equal(store.getSpaces().length, 0);
    assert.deepEqual(store.getTasks().map((t) => t.title), ['Minha, pessoal']);
  });

  it('refreshSpaces descarta tarefas de um espaço de que a pessoa foi removida', async () => {
    semear({ spaces: [{ id: '8', name: 'Equipe', ownerId: 9, inviteCode: 'X', members: [] }],
      tasks: [{ id: '300', title: 'Da equipe', spaceId: '8', userId: 9, done: false }, { id: '301', title: 'Minha', spaceId: null, userId: 5, done: false }] });
    const store = await carregarStore();
    store.initSession(() => {});
    srv.espacos = [];   // o servidor não lista mais o espaço
    assert.equal(await store.refreshSpaces(), true);
    assert.deepEqual(store.getTasks().map((t) => t.title), ['Minha']);
  });

  it('offline mantém o cache dos espaços', async () => {
    semear({ spaces: [{ id: '8', name: 'Equipe', ownerId: 9, inviteCode: 'X', members: [] }] });
    const store = await carregarStore();
    store.initSession(() => {});
    srv.online = false;
    assert.equal(await store.refreshSpaces(), false);
    assert.equal(store.getSpaces().length, 1);
  });

  it('tarefa nova no espaço leva space_id; em espaço desconhecido vira pessoal', async () => {
    semear({ spaces: [{ id: '8', name: 'Equipe', ownerId: 9, inviteCode: 'X', members: [] }] });
    const store = await carregarStore();
    store.initSession(() => {});
    const a = await store.addTask({ title: 'Compartilhada', spaceId: '8' });
    const b = await store.addTask({ title: 'Fantasma', spaceId: '999' });
    assert.equal(a.spaceId, '8');
    assert.equal(b.spaceId, null);
    const post = srv.chamadas.find((c) => c.metodo === 'POST' && c.pathname === '/tasks' && c.corpo.title === 'Compartilhada');
    assert.equal(post.corpo.space_id, 8);
  });

  it('subtarefa herda o espaço da mãe, mesmo que se peça outro', async () => {
    semear({ spaces: [{ id: '8', name: 'Equipe', ownerId: 9, inviteCode: 'X', members: [] }] });
    const store = await carregarStore();
    store.initSession(() => {});
    const mae = await store.addTask({ title: 'Festa', spaceId: '8' });
    const filha = await store.addTask({ title: 'Bolo', parentId: mae.id });
    assert.equal(filha.spaceId, '8');
    const pessoal = await store.addTask({ title: 'Minha' });
    const f2 = await store.addTask({ title: 'Passo', parentId: pessoal.id, spaceId: '8' });
    assert.equal(f2.spaceId, null);
  });
});

describe('canDeleteTask (espelha o backend)', () => {
  it('pessoal, criada por mim ou sou dono do espaço', async () => {
    semear({ spaces: [
      { id: '8', name: 'Equipe', ownerId: 9, inviteCode: 'X', members: [] },
      { id: '9', name: 'Minha', ownerId: 5, inviteCode: 'Y', members: [] },
    ] });
    const store = await carregarStore();
    assert.equal(store.canDeleteTask({ spaceId: null, userId: 5 }), true);
    assert.equal(store.canDeleteTask({ spaceId: '8', userId: 5 }), true, 'criei');
    assert.equal(store.canDeleteTask({ spaceId: '8', userId: 9 }), false, 'de outro, em espaço de outro');
    assert.equal(store.canDeleteTask({ spaceId: '9', userId: 9 }), true, 'sou o dono do espaço');
    assert.equal(store.canDeleteTask(undefined), true);
  });
});

describe('mensagens da tela de Conexões', () => {
  it('spaceError explica 404, 409 e 403; o resto cai no friendlyError', async () => {
    const { spaceError, inviteMessage } = await import('../js/views/connections.js');
    assert.match(spaceError({ status: 404 }), /Código de convite inválido/);
    assert.match(spaceError({ status: 409 }), /cheio/);
    assert.match(spaceError({ status: 403 }), /dono/);
    assert.match(spaceError({ kind: 'network' }), /servidor|conexão/i);
    const msg = inviteMessage({ name: 'Equipe', inviteCode: 'ABCD-EFGH' }, 'https://app.exemplo');
    assert.ok(msg.includes('ABCD-EFGH') && msg.includes('https://app.exemplo') && msg.includes('Equipe'));
  });
});
