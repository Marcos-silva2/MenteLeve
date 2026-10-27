/* ============================================================
   kanban.js — Modelo dos quadros Kanban (estilo Trello)
   Quadro → listas (colunas) → cartões. Funções puras sobre o objeto de dados
   (fáceis de testar) + carregar/salvar no localStorage, separado por conta.
   Os quadros ficam só neste aparelho (não sobem para o servidor).
   ============================================================ */

export const KANBAN_VERSION = 1;

/** Etiquetas fixas, como no Trello: cor + nome curto. Tons escuros o bastante para texto branco (≥ 4,5:1). */
export const LABELS = [
  { id: 'vermelho', name: 'Urgente', color: '#c4232a' },
  { id: 'laranja', name: 'Importante', color: '#b84a00' },
  { id: 'amarelo', name: 'Aguardando', color: '#8a6100' },
  { id: 'verde', name: 'Pessoal', color: '#18794e' },
  { id: 'azul', name: 'Trabalho', color: '#0b68bd' },
  { id: 'roxo', name: 'Ideia', color: '#7a3eb0' },
];

/** Fundos de quadro (cor do cabeçalho e da miniatura). */
export const BOARD_COLORS = ['#3f3f46', '#0079bf', '#519839', '#b04632', '#89609e', '#cd5a91', '#00838f', '#d29034'];

export const LIMITS = { boardTitle: 60, listTitle: 50, cardTitle: 200, description: 4000, checkItem: 160, boards: 50, lists: 30, cards: 500 };

let _seq = 0;
export function kid(prefix = 'k') {
  _seq = (_seq + 1) % 1e6;
  return `${prefix}-${Date.now().toString(36)}${_seq.toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

const clip = (s, n) => String(s ?? '').replace(/\s+/g, ' ').trim().slice(0, n);
/** 'AAAA-MM-DD' de um dia que existe (rejeita 2026-13-99, 2026-02-30…). */
const isDate = (s) => {
  if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = new Date(s + 'T00:00:00Z');
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
};

export function emptyData() {
  return { version: KANBAN_VERSION, boards: [], activeBoardId: null };
}

// ---------------- Quadros ----------------

/** Cria um quadro já com as listas "A fazer / Fazendo / Feito" (como o modelo básico do Trello). */
export function createBoard(data, title, color = BOARD_COLORS[0], withDefaultLists = true) {
  const t = clip(title, LIMITS.boardTitle);
  if (!t) throw new Error('titulo');
  if (data.boards.length >= LIMITS.boards) throw new Error('limite');
  const board = {
    id: kid('b'), title: t, color: BOARD_COLORS.includes(color) ? color : BOARD_COLORS[0],
    createdAt: Date.now(), lists: [],
  };
  if (withDefaultLists) ['A fazer', 'Fazendo', 'Feito'].forEach((n) => board.lists.push(newList(n)));
  data.boards.push(board);
  return board;
}

export const getBoard = (data, id) => data.boards.find((b) => b.id === id) || null;

export function renameBoard(data, id, title) {
  const b = getBoard(data, id);
  const t = clip(title, LIMITS.boardTitle);
  if (b && t) b.title = t;
  return b;
}

export function setBoardColor(data, id, color) {
  const b = getBoard(data, id);
  if (b && BOARD_COLORS.includes(color)) b.color = color;
  return b;
}

export function removeBoard(data, id) {
  data.boards = data.boards.filter((b) => b.id !== id);
  if (data.activeBoardId === id) data.activeBoardId = null;
}

// ---------------- Listas ----------------

function newList(title) {
  return { id: kid('l'), title: clip(title, LIMITS.listTitle), cards: [] };
}

export function addList(board, title) {
  const t = clip(title, LIMITS.listTitle);
  if (!t) throw new Error('titulo');
  if (board.lists.length >= LIMITS.lists) throw new Error('limite');
  const l = newList(t);
  board.lists.push(l);
  return l;
}

export const getList = (board, id) => board.lists.find((l) => l.id === id) || null;

export function renameList(board, id, title) {
  const l = getList(board, id);
  const t = clip(title, LIMITS.listTitle);
  if (l && t) l.title = t;
  return l;
}

export function removeList(board, id) {
  board.lists = board.lists.filter((l) => l.id !== id);
}

/** Move a lista para a posição `toIndex` (limitada às pontas). */
export function moveList(board, id, toIndex) {
  const from = board.lists.findIndex((l) => l.id === id);
  if (from < 0) return false;
  const [l] = board.lists.splice(from, 1);
  const to = Math.max(0, Math.min(board.lists.length, toIndex));
  board.lists.splice(to, 0, l);
  return from !== to;
}

// ---------------- Cartões ----------------

export function countCards(board) {
  return board.lists.reduce((n, l) => n + l.cards.length, 0);
}

export function addCard(board, listId, title) {
  const l = getList(board, listId);
  const t = clip(title, LIMITS.cardTitle);
  if (!l || !t) throw new Error('titulo');
  if (countCards(board) >= LIMITS.cards) throw new Error('limite');
  const c = { id: kid('c'), title: t, description: '', labels: [], due: null, checklist: [], createdAt: Date.now() };
  l.cards.push(c);
  return c;
}

/** Acha o cartão e a lista em que ele está. */
export function findCard(board, cardId) {
  for (const list of board.lists) {
    const index = list.cards.findIndex((c) => c.id === cardId);
    if (index >= 0) return { card: list.cards[index], list, index };
  }
  return null;
}

/** Atualiza campos do cartão, validando cada um. Campos desconhecidos são ignorados. */
export function updateCard(board, cardId, patch) {
  const f = findCard(board, cardId);
  if (!f) return null;
  const c = f.card;
  if ('title' in patch) { const t = clip(patch.title, LIMITS.cardTitle); if (t) c.title = t; }
  if ('description' in patch) c.description = String(patch.description ?? '').slice(0, LIMITS.description);
  if ('due' in patch) c.due = isDate(patch.due) ? patch.due : null;
  if ('labels' in patch && Array.isArray(patch.labels)) {
    c.labels = LABELS.map((x) => x.id).filter((id) => patch.labels.includes(id));
  }
  return c;
}

export function toggleLabel(board, cardId, labelId) {
  const f = findCard(board, cardId);
  if (!f || !LABELS.some((l) => l.id === labelId)) return null;
  const tem = f.card.labels.includes(labelId);
  return updateCard(board, cardId, { labels: tem ? f.card.labels.filter((x) => x !== labelId) : [...f.card.labels, labelId] });
}

export function removeCard(board, cardId) {
  const f = findCard(board, cardId);
  if (f) f.list.cards.splice(f.index, 1);
  return !!f;
}

/**
 * Move o cartão para a lista `toListId`, na posição `toIndex` (contada SEM o
 * próprio cartão — é o índice que ele terá depois de movido).
 */
export function moveCard(board, cardId, toListId, toIndex) {
  const f = findCard(board, cardId);
  const destino = getList(board, toListId);
  if (!f || !destino) return false;
  f.list.cards.splice(f.index, 1);
  const to = Math.max(0, Math.min(destino.cards.length, toIndex));
  destino.cards.splice(to, 0, f.card);
  return !(f.list === destino && f.index === to);
}

// ---------------- Checklist ----------------

export function addCheckItem(board, cardId, text) {
  const f = findCard(board, cardId);
  const t = clip(text, LIMITS.checkItem);
  if (!f || !t) return null;
  const item = { id: kid('i'), text: t, done: false };
  f.card.checklist.push(item);
  return item;
}

export function toggleCheckItem(board, cardId, itemId) {
  const f = findCard(board, cardId);
  const it = f && f.card.checklist.find((i) => i.id === itemId);
  if (it) it.done = !it.done;
  return it || null;
}

export function removeCheckItem(board, cardId, itemId) {
  const f = findCard(board, cardId);
  if (f) f.card.checklist = f.card.checklist.filter((i) => i.id !== itemId);
}

export function checklistProgress(card) {
  const total = card.checklist.length;
  return { done: card.checklist.filter((i) => i.done).length, total };
}

/** Situação do prazo: 'atrasado' | 'hoje' | 'breve' (até 2 dias) | 'ok' | null. */
export function dueStatus(card, today) {
  if (!card.due) return null;
  if (card.due < today) return 'atrasado';
  if (card.due === today) return 'hoje';
  const d = (Date.parse(card.due + 'T00:00:00Z') - Date.parse(today + 'T00:00:00Z')) / 86400000;
  return d <= 2 ? 'breve' : 'ok';
}

/** Filtra os cartões de cada lista por texto e/ou etiqueta (não altera o quadro). */
export function filterCards(list, { text = '', label = null } = {}) {
  const q = text.trim().toLowerCase();
  return list.cards.filter((c) =>
    (!q || c.title.toLowerCase().includes(q) || c.description.toLowerCase().includes(q)) &&
    (!label || c.labels.includes(label)));
}

// ---------------- Persistência ----------------

/**
 * Normaliza dados vindos do armazenamento: descarta o que não tem a forma
 * esperada, para um JSON corrompido ou antigo não derrubar a tela.
 */
export function sanitize(raw) {
  const data = emptyData();
  if (!raw || typeof raw !== 'object' || !Array.isArray(raw.boards)) return data;
  for (const b of raw.boards.slice(0, LIMITS.boards)) {
    if (!b || typeof b.id !== 'string' || !clip(b.title, LIMITS.boardTitle)) continue;
    const board = {
      id: b.id, title: clip(b.title, LIMITS.boardTitle),
      color: BOARD_COLORS.includes(b.color) ? b.color : BOARD_COLORS[0],
      createdAt: Number(b.createdAt) || Date.now(), lists: [],
    };
    for (const l of (Array.isArray(b.lists) ? b.lists : []).slice(0, LIMITS.lists)) {
      if (!l || typeof l.id !== 'string') continue;
      const list = { id: l.id, title: clip(l.title, LIMITS.listTitle) || 'Lista', cards: [] };
      for (const c of Array.isArray(l.cards) ? l.cards : []) {
        if (!c || typeof c.id !== 'string' || !clip(c.title, LIMITS.cardTitle)) continue;
        list.cards.push({
          id: c.id, title: clip(c.title, LIMITS.cardTitle),
          description: String(c.description ?? '').slice(0, LIMITS.description),
          labels: LABELS.map((x) => x.id).filter((id) => Array.isArray(c.labels) && c.labels.includes(id)),
          due: isDate(c.due) ? c.due : null,
          checklist: (Array.isArray(c.checklist) ? c.checklist : [])
            .filter((i) => i && typeof i.id === 'string' && clip(i.text, LIMITS.checkItem))
            .map((i) => ({ id: i.id, text: clip(i.text, LIMITS.checkItem), done: !!i.done })),
          createdAt: Number(c.createdAt) || Date.now(),
        });
      }
      board.lists.push(list);
    }
    data.boards.push(board);
  }
  data.activeBoardId = data.boards.some((b) => b.id === raw.activeBoardId) ? raw.activeBoardId : null;
  return data;
}

const storageKey = (owner) => `menteleve.kanban.v1:${owner || 'local'}`;

export function loadKanban(owner, storage = globalThis.localStorage) {
  try {
    const raw = storage && storage.getItem(storageKey(owner));
    return sanitize(raw ? JSON.parse(raw) : null);
  } catch (_) {
    return emptyData();
  }
}

export function saveKanban(owner, data, storage = globalThis.localStorage) {
  try {
    storage.setItem(storageKey(owner), JSON.stringify(data));
    return true;
  } catch (_) {
    return false; // armazenamento cheio ou bloqueado
  }
}
