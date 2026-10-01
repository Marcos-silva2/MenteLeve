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

// Dias da semana como no Python (`date.weekday()`): 0 = segunda ... 6 = domingo.
// NÃO é o `Date.getDay()` do JS (0 = domingo) — converta com `weekdayOf`.
export const WORKDAYS = [0, 1, 2, 3, 4];
const WD_SHORT = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];

/** Dia da semana de "AAAA-MM-DD" no padrão Python (0 = segunda). */
export function weekdayOf(key) {
  const d = dateFromKey(key);
  return d ? (d.getDay() + 6) % 7 : null;
}

/** [0..6] ordenado e sem repetição; aceita "0,2,4". Vazio, inválido ou os 7 dias → null. */
export function cleanWeekdays(value) {
  const arr = typeof value === 'string' ? value.split(',').filter((p) => p.trim()) : value;
  if (!Array.isArray(arr)) return null;
  const dias = new Set();
  for (const v of arr) {
    const n = Number(v);
    if (!Number.isInteger(n) || n < 0 || n > 6) return null;
    dias.add(n);
  }
  if (dias.size === 0 || dias.size === 7) return null;
  return [...dias].sort((a, b) => a - b);
}

/**
 * Próxima ocorrência; null quando a série terminou (passou de `until`).
 * `weekdays` (só weekly): o primeiro desses dias depois de hoje e do prazo.
 */
export function nextOccurrence(dueDate, pattern, today = todayKey(), weekdays = null, until = null) {
  if (!RECURRENCE_PATTERNS.includes(pattern)) return dueDate || null;
  let next;
  const dias = pattern === 'weekly' ? cleanWeekdays(weekdays) : null;
  if (dias) {
    let d = addDaysKey(dueDate && dueDate > today ? dueDate : today, 1);
    while (!dias.includes(weekdayOf(d))) d = addDaysKey(d, 1);
    next = d;
  } else {
    next = nextSimple(dueDate, pattern, today);
  }
  return until && next > until ? null : next;
}

/** 1ª ocorrência depois de `today` e do prazo (atrasada pula os ciclos perdidos; sem prazo conta de hoje). */
function nextSimple(dueDate, pattern, today) {
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
  ['weekly', new RegExp(`\\b(?:toda\\s+semana|cada\\s+semana|semanal(?:mente)?\\b|toda\\s+(?:${WD})|todas\\s+as\\s+(?:${WD})s|todo\\s+(?:sabado|domingo)|todos\\s+os\\s+(?:sabados|domingos)|dias?\\s+uteis|dia\\s+util|de\\s+(?:${WD})(?:[-\\s]feira)?\\s+a\\s+(?:${WD})|(?:as|nas)\\s+(?:${WD})s\\b)`)],
  ['daily', /\b(?:todo\s+dia|todos\s+os\s+dias|cada\s+dia|diari(?:o|a|amente)\b|toda\s+(?:manha|tarde|noite)|todas\s+as\s+(?:manhas|tardes|noites))/],
];

const fold = (text) => String(text || '').toLowerCase().normalize('NFD').replace(/\p{M}/gu, '');
const WD_INDEX = { segunda: 0, terca: 1, quarta: 2, quinta: 3, sexta: 4, sabado: 5, domingo: 6 };

/** "todo dia" / "toda segunda" / "todo dia 10" / "todo mês" / "dias úteis" → daily | weekly | monthly | null. */
export function detectRecurrence(text) {
  const t = fold(text);
  const hit = RECURRENCE_RES.find(([, re]) => re.test(t));
  return hit ? hit[0] : null;
}

/**
 * Dias específicos (espelha recurrence.detect_weekdays): "dias úteis" e "de segunda a
 * sexta" → [0..4]; "de terça a quinta" → [1,2,3]; "toda segunda e quarta" → [0,2].
 * Um dia só → null (o semanal simples cobre).
 */
export function detectWeekdays(text) {
  const t = fold(text);
  if (/\bdias?\s+uteis\b|\bdia\s+util\b/.test(t)) return [...WORKDAYS];
  const r = new RegExp(`\\bde\\s+(${WD})(?:[-\\s]feira)?\\s+a\\s+(${WD})\\b`).exec(t);
  if (r) {
    const a = WD_INDEX[r[1]]; const b = WD_INDEX[r[2]];
    const n = ((b - a + 7) % 7) + 1;
    return cleanWeekdays(Array.from({ length: n }, (_, i) => (a + i) % 7));
  }
  if (detectRecurrence(t) !== 'weekly') return null;
  const nomes = new Set([...t.matchAll(new RegExp(`\\b(${WD})s?\\b`, 'g'))].map((m) => WD_INDEX[m[1]]));
  return nomes.size >= 2 ? cleanWeekdays([...nomes]) : null;
}

const MESES = ['janeiro', 'fevereiro', 'marco', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];

/** Fim da série dito no texto (espelha recurrence.detect_until): "até 20/12", "até 15 de março", "até dezembro". */
export function detectUntil(text, today = todayKey()) {
  const t = fold(text);
  let m = /\bate\s+(?:o\s+)?(?:dia\s+)?(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?\b/.exec(t);
  if (m) {
    let ano = m[3] ? Number(m[3]) : null;
    if (ano !== null && ano < 100) ano += 2000;
    return dataFutura(Number(m[1]), Number(m[2]), ano, today);
  }
  m = new RegExp(`\\bate\\s+(?:o\\s+)?(?:(?:dia\\s+)?(\\d{1,2})\\s+de\\s+)?(${MESES.join('|')})(?:\\s+de\\s+(\\d{4}))?\\b`).exec(t);
  if (m) return dataFutura(m[1] ? Number(m[1]) : null, MESES.indexOf(m[2]) + 1, m[3] ? Number(m[3]) : null, today);
  return null;
}

function dataFutura(dia, mes, ano, today) {
  if (mes < 1 || mes > 12) return null;
  const hojeAno = Number(today.slice(0, 4));
  for (const a of ano ? [ano] : [hojeAno, hojeAno + 1]) {
    const ultimo = new Date(a, mes, 0).getDate();
    const d = dia === null ? ultimo : dia;
    if (d < 1 || d > ultimo) return null;
    const key = `${a}-${String(mes).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    if (ano || key >= today) return key;
  }
  return null;
}

/** 1ª ocorrência sem data explícita: dias específicos → o 1º deles a partir de hoje;
 *  semanal/mensal usam o dia dito ("segunda", "dia 10"); senão, hoje. */
export function firstOccurrence(text, pattern, today = todayKey(), weekdays = null) {
  const dias = pattern === 'weekly' ? cleanWeekdays(weekdays) : null;
  if (dias) {
    let d = today;
    while (!dias.includes(weekdayOf(d))) d = addDaysKey(d, 1);
    return d;
  }
  return (pattern !== 'daily' && resolveDue(text, today)) || today;
}

/** Rótulo curto da repetição: "Todo dia", "Dias úteis", "Seg, Qua", "Todo mês · até 20/12". */
export function recurrenceLabel(task) {
  if (!task || !task.isRecurring || !cleanPattern(task.recurrencePattern)) return '';
  const dias = task.recurrencePattern === 'weekly' ? cleanWeekdays(task.recurrenceWeekdays) : null;
  let base = RECURRENCE_LABELS[task.recurrencePattern];
  if (dias) base = dias.join(',') === WORKDAYS.join(',') ? 'Dias úteis' : dias.map((d) => WD_SHORT[d]).join(', ');
  if (task.recurrenceUntil) {
    const [, mm, dd] = task.recurrenceUntil.split('-');
    base += ` · até ${dd}/${mm}`;
  }
  return base;
}
