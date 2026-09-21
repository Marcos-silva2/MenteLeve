/* ============================================================
   dates.js — Prazo das tarefas (data estruturada)

   A data da tarefa é guardada em `dueDate` ("AAAA-MM-DD") + `dueTime` ("HH:MM").
   O texto amigável ("Hoje", "Amanhã • 10:00") é DERIVADO daqui na hora de exibir
   — nunca armazenado. Guardar o rótulo criava duas fontes de verdade: uma tarefa
   salva como "Amanhã" continuava exibindo "Amanhã" para sempre e andava um dia
   no calendário a cada dia que passava, sem nunca ficar atrasada.

   O campo legado `due` (texto livre) só é usado como fallback de exibição para
   tarefas criadas antes desta mudança.
   ============================================================ */

const WEEKDAYS = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];
const MONTHS = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
  'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];

/** Data de HOJE no fuso local, como "AAAA-MM-DD".
 *  Não usar toISOString(): ele converte para UTC e, à noite no Brasil, devolve
 *  o dia seguinte. */
export function todayKey() {
  return keyOf(new Date());
}

/** Converte um Date (local) em "AAAA-MM-DD". */
export function keyOf(d) {
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mm}-${dd}`;
}

/** Constrói um Date LOCAL a partir de "AAAA-MM-DD".
 *  `new Date('2026-08-27')` seria interpretado como meia-noite UTC e, no Brasil,
 *  voltaria um dia (26). */
export function dateFromKey(key) {
  if (!key) return null;
  const [y, m, d] = String(key).split('-').map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
}

/** Soma dias a uma chave "AAAA-MM-DD" e devolve a nova chave. */
export function addDaysKey(key, days) {
  const d = dateFromKey(key);
  if (!d) return null;
  d.setDate(d.getDate() + days);
  return keyOf(d);
}

/**
 * Resolve um rótulo de data ("Hoje", "Amanhã", "Esta semana") em "AAAA-MM-DD".
 * Usado na criação da tarefa — inclusive offline, quando o backend (e a IA)
 * não estão disponíveis para resolver a data.
 */
export function resolveDue(label, today = todayKey()) {
  if (!label) return null;
  const t = String(label).toLowerCase().trim();

  if (/depois de amanh/.test(t)) return addDaysKey(today, 2);
  if (/amanh/.test(t)) return addDaysKey(today, 1);
  if (/hoje/.test(t)) return today;
  if (/v[eé]spera|ontem/.test(t)) return addDaysKey(today, -1);
  // "Esta semana" não tinha data alguma antes e sumia do calendário:
  // ancoramos no domingo (fim da semana corrente).
  if (/esta semana|essa semana/.test(t)) {
    const d = dateFromKey(today);
    return addDaysKey(today, (6 - d.getDay() + 7) % 7);
  }

  // dd/mm(/aaaa)
  let m = t.match(/(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?/);
  if (m) {
    let y = m[3] ? Number(m[3]) : dateFromKey(today).getFullYear();
    if (y < 100) y += 2000;
    return keyOf(new Date(y, Number(m[2]) - 1, Number(m[1])));
  }

  // "dia 15" — se já passou neste mês, assume o mês seguinte
  m = t.match(/dia\s+(\d{1,2})/);
  if (m) {
    const base = dateFromKey(today);
    let dt = new Date(base.getFullYear(), base.getMonth(), Number(m[1]));
    if (dt < base) dt = new Date(base.getFullYear(), base.getMonth() + 1, Number(m[1]));
    return keyOf(dt);
  }

  // dias da semana → próxima ocorrência
  for (let i = 0; i < WEEKDAYS.length; i++) {
    const re = new RegExp(`\\b${WEEKDAYS[i].replace('ç', '[çc]').replace('á', '[áa]')}\\b`);
    if (re.test(t)) {
      const base = dateFromKey(today);
      let delta = (i - base.getDay() + 7) % 7;
      if (delta === 0) delta = 7;
      return addDaysKey(today, delta);
    }
  }
  return null;
}

/** Extrai "HH:MM" de um texto livre ("Amanhã • 10:00" → "10:00"). */
export function resolveTime(label) {
  const m = String(label || '').match(/\b(\d{1,2})[:h](\d{2})\b/);
  if (!m) return null;
  const hh = String(Math.min(23, Number(m[1]))).padStart(2, '0');
  return `${hh}:${m[2]}`;
}

/** Rótulo amigável de uma data ("Hoje", "Amanhã", "15 de junho"). */
export function labelForKey(key, today = todayKey()) {
  if (!key) return '';
  if (key === today) return 'Hoje';
  if (key === addDaysKey(today, 1)) return 'Amanhã';
  if (key === addDaysKey(today, -1)) return 'Ontem';
  const d = dateFromKey(key);
  if (!d) return '';
  const sameYear = d.getFullYear() === dateFromKey(today).getFullYear();
  const base = `${d.getDate()} de ${MONTHS[d.getMonth()]}`;
  return sameYear ? base : `${base} de ${d.getFullYear()}`;
}

/**
 * Texto do prazo para exibição. Deriva de dueDate/dueTime; cai no campo
 * legado `due` apenas quando a tarefa não tem data estruturada.
 */
export function formatDue(task, today = todayKey()) {
  if (!task) return '';
  if (task.dueDate) {
    const label = labelForKey(task.dueDate, today);
    return task.dueTime ? `${label} • ${task.dueTime}` : label;
  }
  return task.due || '';
}

/** True se a tarefa está atrasada (só faz sentido com data estruturada). */
export function isOverdue(task, today = todayKey()) {
  return !!(task && task.dueDate && !task.done && task.dueDate < today);
}

/* Recorrência — espelha Backend/app/recurrence.py. Concluir NÃO fecha nem copia a
   tarefa: o prazo rola para a próxima ocorrência (cliente e servidor, mesma data). */

export const RECURRENCE_PATTERNS = ['daily', 'weekly', 'monthly'];

export const RECURRENCE_LABELS = { daily: 'Todo dia', weekly: 'Toda semana', monthly: 'Todo mês' };

/** daily | weekly | monthly, senão null. */
export function cleanPattern(value) {
  const v = typeof value === 'string' ? value.trim().toLowerCase() : '';
  return RECURRENCE_PATTERNS.includes(v) ? v : null;
}

/** Chave + N meses, limitando ao último dia do mês (31/jan + 1 = 28/fev). */
function addMonthsKey(key, months) {
  const d = dateFromKey(key);
  if (!d) return null;
  const idx = d.getFullYear() * 12 + d.getMonth() + months;
  const y = Math.floor(idx / 12);
  const m = idx - y * 12;
  return keyOf(new Date(y, m, Math.min(d.getDate(), new Date(y, m + 1, 0).getDate())));
}

/** 1ª ocorrência depois de `today` e do prazo (atrasada pula os ciclos perdidos; sem prazo conta de hoje). */
export function nextOccurrence(dueDate, pattern, today = todayKey()) {
  if (!RECURRENCE_PATTERNS.includes(pattern)) return dueDate || null;
  const start = dueDate || today;
  const step = (k) => (pattern === 'daily' ? addDaysKey(start, k)
    : pattern === 'weekly' ? addDaysKey(start, 7 * k) : addMonthsKey(start, k));
  let k = 1;
  let next = step(k);
  while (next <= today) next = step(++k);   // "AAAA-MM-DD" compara certo como texto
  return next;
}

const WD = 'segunda|terca|quarta|quinta|sexta|sabado|domingo';
const RECURRENCE_RES = [
  ['monthly', /\btod[oa]s?\s+(?:os\s+)?dias?\s+(?:[12]\d|3[01]|[1-9])(?![\d:h]|\s*horas?)|\b(?:todo\s+mes|todos\s+os\s+meses|cada\s+mes|mensal(?:mente)?\b)/],
  ['weekly', new RegExp(`\\b(?:toda\\s+semana|cada\\s+semana|semanal(?:mente)?\\b|toda\\s+(?:${WD})|todas\\s+as\\s+(?:${WD})s|todo\\s+(?:sabado|domingo)|todos\\s+os\\s+(?:sabados|domingos))`)],
  ['daily', /\b(?:todo\s+dia|todos\s+os\s+dias|cada\s+dia|diari(?:o|a|amente)\b|toda\s+(?:manha|tarde|noite)|todas\s+as\s+(?:manhas|tardes|noites))/],
];

/** "todo dia" / "toda segunda" / "todo dia 10" / "todo mês" → daily | weekly | monthly | null. */
export function detectRecurrence(text) {
  const t = String(text || '').toLowerCase().normalize('NFD').replace(/\p{M}/gu, '');
  const hit = RECURRENCE_RES.find(([, re]) => re.test(t));
  return hit ? hit[0] : null;
}

/** 1ª ocorrência sem data explícita: semanal/mensal usam o dia dito ("segunda", "dia 10"); senão, hoje. */
export function firstOccurrence(text, pattern, today = todayKey()) {
  return (pattern !== 'daily' && resolveDue(text, today)) || today;
}
