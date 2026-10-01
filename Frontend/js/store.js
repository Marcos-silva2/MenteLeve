/* ============================================================
   store.js — Estado global (cache local) + sincronização com o backend
   Estratégia local-first:
     - O estado local (localStorage) mantém a UI instantânea.
     - Quando o backend está online e o usuário logado, as mutações
       sincronizam (create aguarda o id real; toggle/delete em background).
     - Offline: opera 100% local (PWA resiliente).
   ============================================================ */

import * as api from './api.js';
import { resolveDue, resolveTime, todayKey, nextOccurrence, cleanPattern, cleanWeekdays, firstOccurrence } from './dates.js';
import { CATEGORIES, getCategory, normalizeCategory } from './categories.js';

export { CATEGORIES, getCategory };

const STORAGE_KEY = 'menteleve.state.v1';

// Níveis de prioridade (padrão: "media"). Alta também marca a tarefa como
// importante, mantendo compatibilidade com o backend (campo booleano `important`).
export const PRIORITIES = [
  { id: 'baixa', label: 'Baixa', dot: 'var(--color-soft-300)' },
  { id: 'media', label: 'Média', dot: 'var(--color-accent-hover)' },
  { id: 'alta',  label: 'Alta',  dot: 'var(--color-accent)' },
];

export const getPriority = (id) => PRIORITIES.find((p) => p.id === id) || PRIORITIES[1];

const defaultCycle = () => ({
  module: false,     // módulo opcional (Perfil): desligado, a Agenda nem mostra o botão
  enabled: false,    // camada visível na Agenda (só vale com o módulo ligado)
  lastStart: null,   // 'AAAA-MM-DD' do início da última menstruação
  cycleLength: 28,   // duração média do ciclo (dias)
  periodLength: 5,   // duração média da menstruação (dias)
});

const defaultState = () => ({
  onboardingSeen: false,
  user: null,        // { name, email }
  userId: null,      // id numérico do backend (null = só local)
  token: null,       // JWT de acesso (null = sessão não autenticada)
  soundLevel: 'tudo',  // 'tudo' | 'conclusoes' | 'silencio' — ver SOUND_LEVELS
  tasks: [],
  pending: [],       // fila de escritas que ainda não subiram (ver "Fila offline")
  cycle: defaultCycle(),
});

function seedTasks() {
  return [
    { id: uid(), title: 'Enviar relatório ao cliente', category: 'trabalho', due: '14:00',           done: false, important: false, priority: 'media', createdAt: Date.now() - 5000 },
    { id: uid(), title: 'Preparar pauta da reunião', category: 'reunioes', due: 'Hoje',            done: false, important: true,  priority: 'alta',  createdAt: Date.now() - 4000 },
    { id: uid(), title: 'Reunião de Equipe',        category: 'reunioes', due: 'Amanhã • 10:00',  done: true,  important: false, priority: 'media', createdAt: Date.now() - 3000 },
    { id: uid(), title: 'Consulta no dentista',       category: 'saude',    due: '12:00',           done: false, important: false, priority: 'baixa', createdAt: Date.now() - 2000 },
  ];
}

let state = load();

function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultState();
    const salvo = JSON.parse(raw);
    return migrar({ ...defaultState(), ...salvo }, salvo);
  } catch (_) { /* ignore */ }
  return defaultState();
}

/**
 * Ajusta estados salvos por versões anteriores do app.
 *
 * `salvo` é o objeto **cru** do localStorage, e é ele que decide. No estado já
 * mesclado todo campo novo aparece com o valor padrão, então perguntar "está
 * faltando?" ali sempre responde que não — e a migração nunca rodaria.
 */
function migrar(s, salvo) {
  // O interruptor de som virou nível (tudo / conclusões / silêncio). Quem já
  // tinha desligado continua no silêncio; quem não mexeu, ouve tudo.
  if (salvo.soundLevel == null && typeof salvo.soundEnabled === 'boolean') {
    s.soundLevel = salvo.soundEnabled ? 'tudo' : 'silencio';
  }
  delete s.soundEnabled;
  // O calendário menstrual virou módulo opcional. Quem já o usava continua com ele ligado.
  if (salvo.cycle && salvo.cycle.module == null && (salvo.cycle.enabled || salvo.cycle.lastStart)) {
    s.cycle = { ...s.cycle, module: true };
  }
  // Categorias de antes da ampliação (filhos -> familia, relacionamento -> pessoal).
  // A fila offline guarda só ids; o `create` lê a tarefa daqui, já convertida.
  for (const t of s.tasks || []) t.category = normalizeCategory(t.category);
  return s;
}

function persist() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (_) { /* ignore */ }
}

export function uid() {
  return 'id-' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

// IDs locais (ainda não persistidos no backend) começam com "id-".
const isLocalId = (id) => typeof id === 'string' && id.startsWith('id-');

// ------- Getters -------
export const getState = () => state;
export const getUser = () => state.user;
export const getUserId = () => state.userId;
/** True quando existe um token salvo (sessão a ser revalidada no boot). */
export const hasSession = () => !!state.token;

// Sincronização de abertura: começa ligada quando há sessão salva, porque o
// boot vai mesmo buscar as tarefas no servidor. É o que permite à Home mostrar
// um esqueleto em vez de "sua mente está limpa" para quem, na verdade, ainda
// não recebeu a própria lista. `endBootSync()` é chamado pelo app.js quando a
// tentativa termina — inclusive quando falha, senão o esqueleto ficaria para
// sempre em quem está offline.
let _bootSyncing = !!state.token;
export const isSyncing = () => _bootSyncing;
export function endBootSync() { _bootSyncing = false; }
export const isOnboardingSeen = () => state.onboardingSeen;
export const getTasks = () => state.tasks;
// Tarefas principais (sem mãe) e subtarefas (filhos de uma tarefa).
export const getTopTasks = () => state.tasks.filter((t) => !t.parentId);
export const getSubtasks = (parentId) => state.tasks.filter((t) => t.parentId === parentId);

// ------- Onboarding -------
export function markOnboardingSeen() {
  state.onboardingSeen = true;
  persist();
}

// ------- Sessão / Auth -------
/** Aplica no estado (e persiste) o usuário autenticado devolvido pelo backend. */
function applySession(user) {
  state.user = { name: user.name || nameFromEmail(user.email), email: user.email };
  state.userId = user.id;
  state.token = api.getAuthToken();
  persist();
}

/** Baixa as tarefas do servidor (fonte de verdade) após autenticar. */
async function hydrateTasks({ onlyIfNotEmpty = false } = {}) {
  // Sobe o que ficou pendente ANTES de ler: o que subir agora volta na própria
  // resposta do servidor, sem virar duplicata.
  await flushPending();

  const remote = await api.apiListTasks();
  if (!remote) return;
  // No boot, só substitui se o servidor tiver tarefas — evita apagar o que foi
  // criado localmente enquanto o backend estava offline.
  if (onlyIfNotEmpty && !remote.length) return;

  // O que ainda está na fila não existe (ou não está atualizado) no servidor.
  // Substituir a lista pela resposta remota apagaria justamente essas tarefas.
  const naFila = pendingIds();
  const locais = state.tasks.filter((t) => naFila.has(t.id));
  const mantidos = new Set(locais.map((t) => t.id));
  state.tasks = [...locais, ...remote.filter((t) => !mantidos.has(t.id))];
  persist();
}

/** Entra em modo local (offline): dados de demonstração e re-tentativa em 2º plano. */
function startOfflineMode(email, name) {
  state.user = { name: name || nameFromEmail(email), email };
  state.userId = null;
  state.token = null;
  if (state.tasks.length === 0) state.tasks = seedTasks();
  persist();
}

/**
 * Login com e-mail + senha.
 * - Sucesso: guarda o token e hidrata as tarefas do servidor.
 * - Credencial errada: lança AuthError (a tela mostra o erro).
 * - Backend offline (cold start do Render): entra no modo local de demonstração.
 */
export async function login({ email, password }) {
  const user = await api.apiLogin(email, password);
  if (!user) {
    // Offline de verdade — nunca cai aqui por senha errada (isso lança AuthError).
    startOfflineMode(email);
    return state.user;
  }
  applySession(user);
  await hydrateTasks();
  return state.user;
}

/** Cadastro: cria a conta, já autentica e hidrata. Lança erro 409 se o e-mail existir. */
export async function register({ name, email, password }) {
  const user = await api.apiRegister(email, name, password);
  if (!user) {
    startOfflineMode(email, name);
    return state.user;
  }
  applySession(user);
  await hydrateTasks();
  return state.user;
}

/**
 * Restaura a sessão no boot (e após o cold start do Render).
 * Valida o token salvo com /auth/me: se estiver expirado/inválido, o `request()`
 * do api.js dispara o handler de sessão expirada (ver initSession).
 * Retorna true se revalidou (o caller pode re-renderizar).
 */
export async function restoreSession() {
  if (!state.token) return false;
  api.setAuthToken(state.token);

  let user;
  try {
    user = await api.apiMe();
  } catch (_) {
    return false; // AuthError já limpou a sessão via onSessionExpired
  }
  if (!user) return false; // ainda offline → segue 100% local

  applySession(user);
  await hydrateTasks({ onlyIfNotEmpty: true });
  return true;
}

/**
 * Liga o token salvo ao cliente HTTP e registra o handler de sessão expirada.
 * Chamado uma vez no boot, antes de qualquer chamada autenticada.
 */
export function initSession(onExpired) {
  if (state.token) api.setAuthToken(state.token);
  api.onSessionExpired(() => {
    clearSession();
    if (onExpired) onExpired();
  });
  // Conexão de volta: sobe o que ficou para trás. O evento `online` do navegador
  // só diz que existe rede, não que o backend respondeu — por isso o flush
  // revalida o /health antes de tentar (e o Render pode estar em cold start).
  try {
    window.addEventListener('online', () => { flushPending(); });
  } catch (_) { /* ignore */ }
}

/**
 * Limpa a sessão preservando o que não pertence à conta:
 * - `onboardingSeen`: evita repetir a introdução.
 * - `cycle`: os dados do ciclo menstrual são 100% locais e nunca vão ao
 *   backend. Apagá-los numa expiração de token (que acontece sozinha, sem
 *   ação da usuária) perderia o histórico para sempre.
 * - `soundLevel`: preferência do aparelho, não da conta.
 */
function clearSession() {
  _bootSyncing = false;   // sem sessão não há sync pendente: nada de esqueleto
  const { onboardingSeen, cycle, soundLevel } = state;
  state = defaultState();
  state.onboardingSeen = onboardingSeen;
  state.cycle = cycle;
  state.soundLevel = soundLevel;
  api.setAuthToken(null);
  persist();
  // A conversa da Bruna vive na memória da view. Registrada via callback para
  // o store não importar uma view (evita import circular).
  for (const fn of _onSessionCleared) {
    try { fn(); } catch (_) { /* ignore */ }
  }
}

// Handlers chamados quando a sessão é limpa (logout ou token expirado).
const _onSessionCleared = [];
export function onSessionCleared(fn) {
  _onSessionCleared.push(fn);
}

export function logout() {
  clearSession();
}

// ============================================================
// Fila de escrita offline → online
//
// Antes, uma tarefa criada sem conexão ficava só no localStorage e nunca subia:
// perda de dado silenciosa, no app cujo argumento é não deixar nada cair.
//
// Cada mutação que falha por falta de rede entra aqui e é reenviada quando a
// conexão volta. Três regras sustentam a corretude:
//
//   1. A fila é FIFO e para no primeiro erro. Assim o `create` de uma tarefa
//      sempre sobe antes do `done` dela.
//   2. Ao subir um `create`, o id local ("id-xxx") é trocado pelo id do servidor
//      em TODO lugar: na tarefa, nas subtarefas que a apontam e nas operações
//      que ainda estão na fila. É o que impede a mesma tarefa de ser criada duas
//      vezes — o sync casa por id.
//   3. Só existe uma operação por tarefa e por tipo. Alternar "concluída" cinco
//      vezes offline manda um estado, não cinco.
// ============================================================

// Uma operação rejeitada pelo servidor (uma tarefa já apagada lá, por exemplo)
// nunca teria sucesso e travaria a fila para sempre. Após este número de
// tentativas ela é descartada e a fila segue.
const PENDING_MAX_TRIES = 5;

let _flushing = false;

/** Ids de tarefas com alguma operação na fila. */
function pendingIds() {
  return new Set((state.pending || []).map((op) => op.id));
}

/** Quantas escritas aguardam conexão (para exibir na interface, se preciso). */
export const pendingCount = () => (state.pending || []).length;

function enqueue(op) {
  if (!state.pending) state.pending = [];
  if (op.kind === 'delete') {
    const criacaoPendente = state.pending.some((p) => p.id === op.id && p.kind === 'create');
    // Nunca chegou ao servidor: some com tudo e não manda nada.
    state.pending = state.pending.filter((p) => p.id !== op.id);
    if (criacaoPendente) { persist(); return; }
  } else {
    // Um `create` e um `done` por tarefa; o mais recente vence.
    state.pending = state.pending.filter((p) => !(p.id === op.id && p.kind === op.kind));
  }
  state.pending.push({ ...op, tries: 0 });
  persist();
}

/** Troca o id local pelo id do servidor em toda parte que o referencia. */
function remapId(localId, serverId) {
  for (const t of state.tasks) {
    if (t.parentId === localId) t.parentId = serverId;
  }
  for (const op of state.pending) {
    if (op.id === localId) op.id = serverId;
  }
}

/** Executa uma operação da fila. `false` significa "tente de novo depois". */
async function applyPending(op) {
  if (op.kind === 'create') {
    const idx = state.tasks.findIndex((t) => t.id === op.id);
    if (idx < 0) return true;                    // apagada localmente: nada a subir
    const local = state.tasks[idx];
    const saved = await api.apiCreateTask(local);
    if (!saved) return false;
    // O backend ainda não persiste a prioridade; preserva o valor local.
    state.tasks[idx] = { ...saved, priority: local.priority };
    remapId(op.id, saved.id);
    return true;
  }

  if (isLocalId(op.id)) return true;             // o `create` sumiu; não há o que atualizar

  if (op.kind === 'done') {
    const saved = await api.apiSetDone(op.id, op.done, op.today);
    if (!saved) return false;
    // Recorrente: o servidor decide a próxima data (várias conclusões offline
    // viram uma operação só). Adota a resposta.
    const t = state.tasks.find((x) => x.id === op.id);
    if (t && saved.isRecurring) { t.dueDate = saved.dueDate; t.done = saved.done; }
    return true;
  }
  if (op.kind === 'delete') return await api.apiDeleteTask(op.id);
  if (op.kind === 'update') {
    // Sobe o estado ATUAL da tarefa (a última edição vence), não o da hora da fila.
    const t = state.tasks.find((x) => x.id === op.id);
    if (!t) return true;
    const saved = await api.apiUpdateRecurrence(op.id, t);
    if (!saved) return false;
    adotarRecorrencia(t, saved);
    return true;
  }
  return true;
}

function adotarRecorrencia(t, saved) {
  t.isRecurring = saved.isRecurring;
  t.recurrencePattern = saved.recurrencePattern;
  t.recurrenceWeekdays = saved.recurrenceWeekdays;
  t.recurrenceUntil = saved.recurrenceUntil;
  t.dueDate = saved.dueDate;
  t.done = saved.done;
}

/** Campos de recorrência coerentes: dias só no semanal; tarefa comum não tem fim. */
function recorrenciaLimpa({ isRecurring, recurrencePattern, recurrenceWeekdays, recurrenceUntil }) {
  const pattern = isRecurring ? cleanPattern(recurrencePattern) : null;
  return {
    isRecurring: !!pattern,
    recurrencePattern: pattern,
    recurrenceWeekdays: pattern === 'weekly' ? cleanWeekdays(recurrenceWeekdays) : null,
    recurrenceUntil: pattern ? recurrenceUntil || null : null,
  };
}

/**
 * Reenvia a fila. Chamada no boot, ao voltar a conexão e antes de hidratar.
 * Silenciosa por natureza: falhar aqui apenas adia, nunca quebra a interface.
 */
export async function flushPending() {
  if (_flushing) return false;
  if (state.userId == null || !(state.pending || []).length) return false;
  if (!(await api.ensureOnline(true))) return false;

  _flushing = true;
  try {
    while (state.pending.length) {
      const op = state.pending[0];
      let ok = false;
      try {
        ok = await applyPending(op);
      } catch (_) { /* trata como falha de rede */ }

      if (!ok) {
        op.tries = (op.tries || 0) + 1;
        if (op.tries < PENDING_MAX_TRIES) { persist(); break; }
        // Esgotou: descarta e segue, para não bloquear as operações seguintes.
      }
      state.pending.shift();
      persist();
    }
  } finally {
    _flushing = false;
  }
  return true;
}

// ------- Tarefas -------
/**
 * Cria uma tarefa. Otimista localmente; se online, troca pelo registro
 * persistido (com id real) antes de retornar.
 */
export async function addTask(task) {
  const priority = task.priority || 'media';
  // Sem data estruturada vinda da IA/formulário, resolve o rótulo aqui mesmo.
  // Isso é o que mantém o calendário funcionando no modo offline, onde a
  // tarefa nunca chega ao backend.
  const dueDate = task.dueDate || resolveDue(task.due) || null;
  const local = {
    id: uid(),
    title: task.title,
    category: normalizeCategory(task.category),
    dueDate,
    dueTime: task.dueTime || resolveTime(task.due) || null,
    due: task.due || '',
    done: false,
    priority,
    important: task.important != null ? !!task.important : priority === 'alta',
    parentId: task.parentId != null ? String(task.parentId) : null,
    ...recorrenciaLimpa(task),
    createdAt: Date.now(),
  };
  state.tasks.unshift(local);
  persist();

  if (state.userId != null) {
    const saved = await api.apiCreateTask(local);
    if (saved) {
      const idx = state.tasks.findIndex((x) => x.id === local.id);
      if (idx >= 0) {
        // O backend ainda não persiste a prioridade; preserva o valor local.
        state.tasks[idx] = { ...saved, priority };
        remapId(local.id, saved.id);
        persist();
        return state.tasks[idx];
      }
    } else {
      // Sem rede (ou o servidor recusou): guarda para subir quando voltar.
      enqueue({ kind: 'create', id: local.id });
    }
  }
  return local;
}

export async function addTasks(list) {
  const out = [];
  for (const t of list) out.push(await addTask(t));
  return out;
}

/**
 * Insere/atualiza tarefas vindas do servidor, casando por id.
 *
 * Usado depois que a Bruna cria ou conclui algo pelo chat. Deliberadamente NÃO
 * substitui a lista inteira: isso apagaria tarefas criadas offline (que só
 * existem localmente) e rebaixaria a prioridade — o backend ainda não a
 * persiste, então `fromServer` sempre devolve "media" no lugar de "baixa".
 */
export function upsertTasks(list) {
  if (!Array.isArray(list) || !list.length) return;
  for (const t of list) {
    const idx = state.tasks.findIndex((x) => x.id === t.id);
    if (idx >= 0) {
      // Preserva a prioridade local (o servidor não a conhece).
      state.tasks[idx] = { ...t, priority: state.tasks[idx].priority };
    } else {
      state.tasks.unshift(t);
    }
  }
  persist();
}

export function toggleTask(id) {
  const t = state.tasks.find((x) => x.id === id);
  if (!t) return t;

  // Recorrente NÃO fecha: o prazo rola para a próxima ocorrência (dates.js →
  // nextOccurrence). Sem cópia nova, nada duplica ao sincronizar.
  const today = todayKey();
  // Série com fim: depois da última ocorrência, `next` é null e ela fecha normalmente.
  const next = t.isRecurring && t.recurrencePattern && !t.done
    ? nextOccurrence(t.dueDate, t.recurrencePattern, today, t.recurrenceWeekdays, t.recurrenceUntil)
    : null;
  const recorrente = next !== null;
  if (recorrente) {
    t.dueDate = next;
    t.due = '';   // o rótulo legado não vale mais para o novo prazo
  } else {
    t.done = !t.done;
  }
  persist();

  if (state.userId != null) {
    const enviarDone = recorrente ? true : t.done;
    const op = { kind: 'done', id, done: enviarDone, today };
    if (isLocalId(id)) {
      // Id local significa que o `create` ainda está na fila: enfileira o estado
      // para ir logo depois dele, já com o id que o servidor devolver.
      // Recorrente: o `create` já leva o prazo rolado; a conclusão faria rolar 2x.
      if (!recorrente) enqueue(op);
    } else {
      api.apiSetDone(id, enviarDone, today)
        .then((r) => {
          if (!r) { enqueue(op); return; }
          if (recorrente && r.isRecurring) {
            t.dueDate = r.dueDate;
            t.done = r.done;   // o servidor pode ter encerrado a série
            persist();
          }
        })
        .catch(() => enqueue(op));
    }
  }
  return t;
}

/**
 * Muda a repetição de uma tarefa já criada. `rec`: { isRecurring, recurrencePattern,
 * recurrenceWeekdays, recurrenceUntil }. Sem prazo, uma tarefa que passa a repetir
 * ganha a primeira ocorrência (hoje ou o primeiro dia escolhido).
 */
export function updateRecurrence(id, rec) {
  const t = state.tasks.find((x) => x.id === id);
  if (!t) return null;
  Object.assign(t, recorrenciaLimpa(rec));
  if (t.isRecurring && !t.dueDate) {
    t.dueDate = firstOccurrence('', t.recurrencePattern, todayKey(), t.recurrenceWeekdays);
  }
  persist();

  if (state.userId != null && !isLocalId(id)) {
    // Id local: o `create` na fila já leva a recorrência nova.
    api.apiUpdateRecurrence(id, t)
      .then((r) => {
        if (!r) { enqueue({ kind: 'update', id }); return; }
        adotarRecorrencia(t, r);
        persist();
      })
      .catch(() => enqueue({ kind: 'update', id }));
  }
  return t;
}

export function removeTask(id) {
  state.tasks = state.tasks.filter((x) => x.id !== id);
  persist();
  if (state.userId != null) {
    if (isLocalId(id)) {
      // Cancela a criação pendente: a tarefa nunca chegou ao servidor.
      enqueue({ kind: 'delete', id });
    } else {
      api.apiDeleteTask(id)
        .then((ok) => { if (!ok) enqueue({ kind: 'delete', id }); })
        .catch(() => enqueue({ kind: 'delete', id }));
    }
  }
}

// ------- Preferências -------
/**
 * Níveis de som.
 *
 * Havia só um liga/desliga, e ele misturava coisas diferentes: quem achava o
 * som do chat intrusivo desligava tudo — e perdia junto a recompensa de
 * concluir uma tarefa, que é justamente a que sustenta o hábito. O nível do
 * meio existe para essa pessoa.
 */
export const SOUND_LEVELS = [
  { id: 'tudo',       label: 'Todos os sons', hint: 'Conclusões, Bruna, toques e avisos.' },
  { id: 'conclusoes', label: 'Só conclusões', hint: 'Apenas a recompensa ao concluir e ao organizar.' },
  { id: 'silencio',   label: 'Silencioso',    hint: 'Nenhum som. O retorno fica só na tela.' },
];

const NIVEIS = SOUND_LEVELS.map((n) => n.id);

export function getSoundLevel() {
  return NIVEIS.includes(state.soundLevel) ? state.soundLevel : 'tudo';
}

export function setSoundLevel(nivel) {
  state.soundLevel = NIVEIS.includes(nivel) ? nivel : 'tudo';
  persist();
  return state.soundLevel;
}

/** Compatibilidade: "há algum som ligado?". */
export const isSoundEnabled = () => getSoundLevel() !== 'silencio';

// ------- Ciclo menstrual (100% local/privado) -------
function _ckey(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function _cparse(k) {
  const [y, m, d] = k.split('-').map(Number);
  return new Date(y, m - 1, d);
}
function _cdays(aKey, bKey) {
  return Math.round((_cparse(bKey) - _cparse(aKey)) / 86400000);
}

export const getCycle = () => ({ ...defaultCycle(), ...(state.cycle || {}) });

/** O módulo do calendário menstrual está ligado? (opcional; desligado por padrão) */
export const isCycleModuleOn = () => getCycle().module === true;

/** Liga/desliga o módulo. Desligar só esconde: os dados do ciclo ficam no aparelho. */
export function setCycleModule(on) {
  return setCycle(on ? { module: true } : { module: false, enabled: false });
}

export function setCycle(patch) {
  state.cycle = { ...defaultCycle(), ...(state.cycle || {}), ...patch };
  persist();
  return state.cycle;
}

export function logPeriodToday() {
  return setCycle({ enabled: true, lastStart: _ckey(new Date()) });
}

/** Fase do ciclo para uma data ('AAAA-MM-DD'): period | fertile | ovulation | null. */
export function cyclePhase(dateKey) {
  const c = getCycle();
  if (!c.enabled || !c.lastStart) return null;
  const len = c.cycleLength || 28;
  const plen = c.periodLength || 5;
  const diff = _cdays(c.lastStart, dateKey);
  const d = ((diff % len) + len) % len;          // dia do ciclo (0-based)
  const ov = Math.max(0, len - 14);              // ovulação ≈ 14 dias antes da próxima
  if (d < plen) return 'period';
  if (d === ov) return 'ovulation';
  if (d >= ov - 4 && d <= ov + 1) return 'fertile';
  return null;
}

/** Resumo do ciclo para hoje (fase, dia do ciclo, dias até a próxima menstruação). */
export function cycleSummary() {
  const c = getCycle();
  if (!c.enabled || !c.lastStart) return { configured: false };
  const len = c.cycleLength || 28;
  const today = _ckey(new Date());
  const diff = _cdays(c.lastStart, today);
  const d = ((diff % len) + len) % len;
  const daysUntilNext = (len - d) % len;
  const nextStartKey = _ckey(new Date(_cparse(today).getTime() + daysUntilNext * 86400000));
  return {
    configured: true,
    phaseToday: cyclePhase(today),
    dayInCycle: d + 1,
    cycleLength: len,
    periodLength: c.periodLength || 5,
    daysUntilNext,
    nextStartKey,
  };
}

function nameFromEmail(email) {
  if (!email) return 'Você';
  const local = email.split('@')[0].replace(/[._-]+/g, ' ');
  return local.charAt(0).toUpperCase() + local.slice(1);
}
