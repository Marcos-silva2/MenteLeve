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

const defaultState = () => ({
  onboardingSeen: false,
  user: null,        // { name, email }
  userId: null,      // id numérico do backend (null = só local)
  isPremium: false,
  tasks: [],
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
/**
 * Login: registra localmente e tenta autenticar no backend.
 * Se online, hidrata as tarefas a partir do servidor (fonte de verdade).
 * Se offline, mantém/inicia o estado local (com seed de demonstração).
 */
export async function login({ name, email }) {
  state.user = { name: name || nameFromEmail(email), email };
  persist();

  const user = await api.apiLogin(email, state.user.name);
  if (user) {
    state.userId = user.id;
    state.isPremium = !!user.is_premium;
    state.user.name = user.name || state.user.name;
    persist();

    const remote = await api.apiListTasks();
    if (remote) {
      state.tasks = remote; // backend é a fonte de verdade
      persist();
    }
  } else {
    // offline: experiência local com dados de demonstração
    state.userId = null;
    if (state.tasks.length === 0) state.tasks = seedTasks();
    persist();
  }
  return state.user;
}

/** Restaura a sessão no boot: reativa o header e re-hidrata se online.
 *
 * Se o login anterior foi offline (cold start do Render), `userId` fica nulo;
 * aqui tentamos autenticar de novo assim que o backend responde, para que a
 * IA/Bruna e o sync voltem a funcionar.
 */
export async function restoreSession() {
  if (!state.user) return false;

  // Sempre re-autentica quando online: garante um `userId` VÁLIDO mesmo se o
  // login anterior foi offline (cold start) ou se o banco do Render reiniciou
  // (free tier), caso em que o id antigo deixaria de existir (401 na IA/sync).
  const user = await api.apiLogin(state.user.email, state.user.name);
  if (!user) return false; // ainda offline → segue 100% local

  state.userId = user.id;
  state.isPremium = !!user.is_premium;
  if (user.name) state.user.name = user.name;
  persist();

  const remote = await api.apiListTasks();
  // Só substitui pelo servidor se ele tiver tarefas — evita apagar o que foi
  // criado localmente enquanto o backend estava offline.
  if (remote && remote.length) {
    state.tasks = remote;
    persist();
  }
  return true; // re-autenticou → caller pode re-renderizar (premium/nome/sync)
}

export function logout() {
  state = defaultState();
  api.setAuthUserId(null);
  persist();
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

function nameFromEmail(email) {
  if (!email) return 'Você';
  const local = email.split('@')[0].replace(/[._-]+/g, ' ');
  return local.charAt(0).toUpperCase() + local.slice(1);
}
