/* ============================================================
   store.js — Estado global (cache local) + sincronização com o backend
   Estratégia local-first:
     - O estado local (localStorage) mantém a UI instantânea.
     - Quando o backend está online e o usuário logado, as mutações
       sincronizam (create aguarda o id real; toggle/delete em background).
     - Offline: opera 100% local (PWA resiliente).
   ============================================================ */

import * as api from './api.js';

const STORAGE_KEY = 'menteleve.state.v1';

export const CATEGORIES = [
  { id: 'casa',           label: 'Casa',           dot: '#ff758f' },
  { id: 'filhos',         label: 'Filhos',         dot: '#c9184a' },
  { id: 'trabalho',       label: 'Trabalho',       dot: '#a4133c' },
  { id: 'saude',          label: 'Saúde',          dot: '#ff4d6d' },
  { id: 'financas',       label: 'Finanças',       dot: '#800f2f' },
  { id: 'relacionamento', label: 'Relacionamento', dot: '#ff8fa3' },
];

// Níveis de prioridade (padrão: "media"). Alta também marca a tarefa como
// importante, mantendo compatibilidade com o backend (campo booleano `important`).
export const PRIORITIES = [
  { id: 'baixa', label: 'Baixa', dot: '#ff8fa3' },
  { id: 'media', label: 'Média', dot: '#ff758f' },
  { id: 'alta',  label: 'Alta',  dot: '#ff4d6d' },
];

export const getPriority = (id) => PRIORITIES.find((p) => p.id === id) || PRIORITIES[1];

export const FREE_TASK_LIMIT = 50;

const defaultCycle = () => ({
  enabled: false,
  lastStart: null,   // 'AAAA-MM-DD' do início da última menstruação
  cycleLength: 28,   // duração média do ciclo (dias)
  periodLength: 5,   // duração média da menstruação (dias)
});

const defaultState = () => ({
  onboardingSeen: false,
  user: null,        // { name, email }
  userId: null,      // id numérico do backend (null = só local)
  token: null,       // JWT de acesso (null = sessão não autenticada)
  isPremium: false,
  tasks: [],
  cycle: defaultCycle(),
});

function seedTasks() {
  return [
    { id: uid(), title: 'Encomendar bolo p/ Leo',  category: 'filhos',   due: '14:00',           done: false, important: false, priority: 'media', createdAt: Date.now() - 5000 },
    { id: uid(), title: 'Mandar convites p/ Leo',   category: 'filhos',   due: 'Hoje',            done: false, important: true,  priority: 'alta',  createdAt: Date.now() - 4000 },
    { id: uid(), title: 'Reunião de Equipe',        category: 'trabalho', due: 'Amanhã • 10:00',  done: true,  important: false, priority: 'media', createdAt: Date.now() - 3000 },
    { id: uid(), title: 'Lanche c/ Família',        category: 'casa',     due: '12:00',           done: false, important: false, priority: 'baixa', createdAt: Date.now() - 2000 },
  ];
}

let state = load();

function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return { ...defaultState(), ...JSON.parse(raw) };
  } catch (_) { /* ignore */ }
  return defaultState();
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
export const isOnboardingSeen = () => state.onboardingSeen;
export const isPremium = () => state.isPremium;
export const getTasks = () => state.tasks;
// Tarefas principais (sem mãe) e subtarefas (filhos de uma tarefa).
export const getTopTasks = () => state.tasks.filter((t) => !t.parentId);
export const getSubtasks = (parentId) => state.tasks.filter((t) => t.parentId === parentId);
export const getCategory = (id) => CATEGORIES.find((c) => c.id === id) || null;

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
  state.isPremium = !!user.is_premium;
  state.token = api.getAuthToken();
  persist();
}

/** Baixa as tarefas do servidor (fonte de verdade) após autenticar. */
async function hydrateTasks({ onlyIfNotEmpty = false } = {}) {
  const remote = await api.apiListTasks();
  if (!remote) return;
  // No boot, só substitui se o servidor tiver tarefas — evita apagar o que foi
  // criado localmente enquanto o backend estava offline.
  if (onlyIfNotEmpty && !remote.length) return;
  state.tasks = remote;
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
}

/**
 * Limpa a sessão preservando o que não pertence à conta:
 * - `onboardingSeen`: evita repetir a introdução.
 * - `cycle`: os dados do ciclo menstrual são 100% locais e nunca vão ao
 *   backend. Apagá-los numa expiração de token (que acontece sozinha, sem
 *   ação da usuária) perderia o histórico para sempre.
 */
function clearSession() {
  const { onboardingSeen, cycle } = state;
  state = defaultState();
  state.onboardingSeen = onboardingSeen;
  state.cycle = cycle;
  api.setAuthToken(null);
  persist();
}

export function logout() {
  clearSession();
}

// ------- Tarefas -------
/**
 * Cria uma tarefa. Otimista localmente; se online, troca pelo registro
 * persistido (com id real) antes de retornar.
 */
export async function addTask(task) {
  const priority = task.priority || 'media';
  const local = {
    id: uid(),
    title: task.title,
    category: task.category || 'casa',
    due: task.due || '',
    done: false,
    priority,
    important: task.important != null ? !!task.important : priority === 'alta',
    parentId: task.parentId != null ? String(task.parentId) : null,
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
        persist();
        return state.tasks[idx];
      }
    }
  }
  return local;
}

export async function addTasks(list) {
  const out = [];
  for (const t of list) out.push(await addTask(t));
  return out;
}

export function toggleTask(id) {
  const t = state.tasks.find((x) => x.id === id);
  if (t) {
    t.done = !t.done;
    persist();
    if (state.userId != null && !isLocalId(id)) {
      api.apiSetDone(id, t.done).catch(() => {});
    }
  }
  return t;
}

export function removeTask(id) {
  state.tasks = state.tasks.filter((x) => x.id !== id);
  persist();
  if (state.userId != null && !isLocalId(id)) {
    api.apiDeleteTask(id).catch(() => {});
  }
}

export function reachedFreeLimit() {
  return !state.isPremium && state.tasks.length >= FREE_TASK_LIMIT;
}

export function setPremium(v) {
  state.isPremium = v;
  persist();
  if (state.userId != null) {
    api.apiSetPremium(v).catch(() => {});
  }
}

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
