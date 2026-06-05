/* ============================================================
   Agenda / Calendário (Tela 5)
   Calendário MENSAL navegável (‹ mês ›) + lista do dia selecionado.
   As datas vêm do campo `due` (texto livre), interpretado por parseDueDate.
   ============================================================ */

import { h, $, $$, icons } from '../ui.js';
import { getTasks, getCategory } from '../store.js';
import { openTaskSheet } from '../components/taskSheet.js';

const MONTHS = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
const WEEKDAYS = ['DOM', 'SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB'];

export function renderAgenda(app) {
  const today = new Date();
  const todayKey = keyOf(today);
  // Mês em exibição (1º dia) e dia selecionado.
  let viewY = today.getFullYear();
  let viewM = today.getMonth();
  let selectedKey = todayKey;

  const view = h(`
    <div class="h-full flex flex-col relative">
      <div class="content-wrap lg:max-w-2xl flex-1 flex flex-col overflow-hidden">
        <header class="px-6 lg:px-0 pt-12 lg:pt-8 pb-2 flex items-center justify-between">
          <h1 id="month-label" class="font-serif font-bold text-bordeaux-900 text-[24px] lg:text-3xl"></h1>
          <div class="flex items-center gap-1.5">
            <button id="today-btn" class="text-xs font-semibold text-bordeaux-700 px-3 py-1.5 rounded-full border border-soft-100 hover:bg-soft-100 transition">Hoje</button>
            <button id="prev" class="w-9 h-9 rounded-full grid place-items-center text-bordeaux-700 hover:bg-soft-100 transition rotate-180">${icons.chevron}</button>
            <button id="next" class="w-9 h-9 rounded-full grid place-items-center text-bordeaux-700 hover:bg-soft-100 transition">${icons.chevron}</button>
          </div>
        </header>

        <div class="px-5 lg:px-0">
          <!-- cabeçalho dos dias da semana -->
          <div class="grid grid-cols-7 mb-1">
            ${WEEKDAYS.map((w) => `<div class="text-center text-[10px] font-semibold text-soft-300 py-1">${w}</div>`).join('')}
          </div>
          <!-- grade do mês -->
          <div id="grid" class="grid grid-cols-7 gap-1"></div>
        </div>

        <!-- lista do dia selecionado + sem data -->
        <div id="day" class="flex-1 overflow-y-auto px-5 lg:px-0 pt-4 safe-bottom"></div>
      </div>

      <button id="fab"
        class="fab absolute right-5 bottom-24 lg:bottom-10 w-16 h-16 rounded-full bg-accent text-white grid place-items-center shadow-fab fab-pulse active:scale-95 transition-transform z-30">
        ${icons.plus}
      </button>
    </div>
  `);

  const monthLabel = $('#month-label', view);
  const grid = $('#grid', view);
  const dayEl = $('#day', view);

  // ---- índice: dateKey -> tarefas (com data) + lista sem data ----
  function buildIndex() {
    const byDay = new Map();
    const undated = [];
    for (const t of getTasks()) {
      const d = parseDueDate(t.due, today);
      if (!d) { undated.push(t); continue; }
      const k = keyOf(d);
      if (!byDay.has(k)) byDay.set(k, []);
      byDay.get(k).push(t);
    }
    return { byDay, undated };
  }

  function render() {
    const { byDay, undated } = buildIndex();
    monthLabel.textContent = `${MONTHS[viewM]} ${viewY}`;

    // grade do mês
    const first = new Date(viewY, viewM, 1);
    const startPad = first.getDay();           // quantos dias vazios antes do dia 1
    const daysInMonth = new Date(viewY, viewM + 1, 0).getDate();
    const cells = [];
    for (let i = 0; i < startPad; i++) cells.push('<div></div>');
    for (let d = 1; d <= daysInMonth; d++) {
      const date = new Date(viewY, viewM, d);
      const k = keyOf(date);
      const count = (byDay.get(k) || []).filter((t) => !t.done).length;
      const isToday = k === todayKey;
      const isSel = k === selectedKey;
      cells.push(`
        <button data-date="${k}"
          class="aspect-square rounded-xl flex flex-col items-center justify-center gap-0.5 text-sm transition border
                 ${isSel ? 'bg-bordeaux-700 text-white border-bordeaux-700 shadow-card'
                          : isToday ? 'bg-soft-100/70 text-bordeaux-900 border-soft-200'
                                    : 'text-bordeaux-800 border-transparent hover:bg-soft-100/60'}">
          <span class="font-semibold leading-none">${d}</span>
          <span class="h-1.5 flex items-center">${count
            ? `<span class="w-1.5 h-1.5 rounded-full ${isSel ? 'bg-white' : 'bg-accent'}"></span>` : ''}</span>
        </button>`);
    }
    grid.innerHTML = cells.join('');
    $$('[data-date]', grid).forEach((b) =>
      b.addEventListener('click', () => { selectedKey = b.dataset.date; render(); })
    );

    // lista do dia + sem data
    const dayTasks = (byDay.get(selectedKey) || []).slice().sort((a, b) => Number(a.done) - Number(b.done));
    dayEl.innerHTML = `
      <h2 class="font-serif font-bold text-bordeaux-900 text-lg mb-2">${labelForKey(selectedKey, today)}</h2>
      ${dayTasks.length
        ? `<div class="flex flex-col gap-2 mb-6">${dayTasks.map(taskRow).join('')}</div>`
        : `<div class="bg-white/60 border border-soft-100 rounded-2xl p-5 text-center mb-6">
             <p class="text-sm text-bordeaux-700">Nada agendado para este dia. Aproveite para respirar. 🌸</p>
           </div>`}
      ${undated.length
        ? `<h3 class="text-xs font-semibold text-soft-300 uppercase tracking-wide mb-2">Sem data definida</h3>
           <div class="flex flex-col gap-2 pb-4">${undated.slice().sort((a, b) => Number(a.done) - Number(b.done)).map(taskRow).join('')}</div>`
        : ''}
    `;
  }

  $('#prev', view).addEventListener('click', () => { viewM--; if (viewM < 0) { viewM = 11; viewY--; } render(); });
  $('#next', view).addEventListener('click', () => { viewM++; if (viewM > 11) { viewM = 0; viewY++; } render(); });
  $('#today-btn', view).addEventListener('click', () => {
    viewY = today.getFullYear(); viewM = today.getMonth(); selectedKey = todayKey; render();
  });
  $('#fab', view).addEventListener('click', () => openTaskSheet(app, render));

  render();
  return view;
}

/* ---------------- helpers ---------------- */
function taskRow(t) {
  const cat = getCategory(t.category);
  const done = t.done;
  const time = (t.due && t.due.match(/\d{1,2}:\d{2}/)) ? t.due.match(/\d{1,2}:\d{2}/)[0] : '';
  return `
    <div class="flex items-center gap-3 bg-white rounded-2xl shadow-card border border-soft-100 px-4 py-3">
      <span class="shrink-0 w-2.5 h-2.5 rounded-full" style="background:${cat ? cat.dot : '#ff4d6d'}"></span>
      <div class="min-w-0 flex-1">
        <p class="text-[15px] font-medium leading-tight ${done ? 'line-through text-soft-300' : 'text-bordeaux-900'}">${t.title}</p>
        <p class="text-xs text-bordeaux-700 mt-0.5">${cat ? cat.label : ''}${t.parentId ? ' • subtarefa' : ''}</p>
      </div>
      ${time ? `<span class="shrink-0 text-xs font-semibold text-bordeaux-700">${time}</span>` : ''}
    </div>`;
}

/** Chave local AAAA-MM-DD (sem fuso). */
function keyOf(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function addDays(d, n) {
  const x = new Date(d); x.setDate(x.getDate() + n); return x;
}

function labelForKey(key, today) {
  const [y, m, d] = key.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  const tk = keyOf(today);
  if (key === tk) return 'Hoje';
  if (key === keyOf(addDays(today, 1))) return 'Amanhã';
  if (key === keyOf(addDays(today, -1))) return 'Ontem';
  return `${d} de ${MONTHS[m - 1]}`;
}

/**
 * Interpreta o `due` (texto livre) em uma Date, ou null se não houver data.
 * Suporta: Hoje, Amanhã, Depois de amanhã, dias da semana, DD/MM(/AAAA),
 * "Dia DD" e horários (assume hoje). Coisas como "Esta semana"/"Mensal"
 * ficam sem data definida.
 */
function parseDueDate(due, base) {
  if (!due) return null;
  const t = due.toLowerCase();
  const today = new Date(base.getFullYear(), base.getMonth(), base.getDate());

  // DD/MM ou DD/MM/AAAA
  let m = t.match(/(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?/);
  if (m) {
    const d = +m[1], mo = +m[2] - 1;
    let y = m[3] ? +m[3] : base.getFullYear();
    if (y < 100) y += 2000;
    const dt = new Date(y, mo, d);
    if (!isNaN(dt.getTime())) return dt;
  }

  if (/depois de amanh/.test(t)) return addDays(today, 2);
  if (/amanh/.test(t)) return addDays(today, 1);
  if (/hoje/.test(t)) return today;
  if (/v[eé]spera|ontem/.test(t)) return addDays(today, -1);

  // "dia DD" (deste mês; se já passou, próximo mês)
  m = t.match(/dia\s+(\d{1,2})/);
  if (m) {
    const d = +m[1];
    let dt = new Date(today.getFullYear(), today.getMonth(), d);
    if (dt < today) dt = new Date(today.getFullYear(), today.getMonth() + 1, d);
    return dt;
  }

  // dia da semana → próxima ocorrência (a partir de hoje)
  const weekdays = [
    [/\bdomingo\b/, 0], [/\bsegunda\b/, 1], [/\bter[çc]a\b/, 2], [/\bquarta\b/, 3],
    [/\bquinta\b/, 4], [/\bsexta\b/, 5], [/\bs[áa]bado\b/, 6],
  ];
  for (const [re, idx] of weekdays) {
    if (re.test(t)) {
      let delta = (idx - today.getDay() + 7) % 7;
      if (delta === 0) delta = 7; // "próxima" ocorrência
      return addDays(today, delta);
    }
  }

  // só horário (ex.: 14:00) → hoje
  if (/\d{1,2}[:h]\d{2}/.test(t)) return today;

  return null; // "Esta semana", "Mensal", etc. → sem data definida
}
