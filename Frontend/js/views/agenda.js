/* ============================================================
   Agenda / Calendário (Tela 5)
   - Calendário MENSAL navegável (‹ mês ›) + lista do dia.
   - Camada opcional de CICLO MENSTRUAL (fases nos dias + previsões).
     Dados do ciclo são 100% locais/privados (localStorage).
   ============================================================ */

import { h, $, $$, icons } from '../ui.js';
import {
  getTasks, getCategory,
  getCycle, setCycle, logPeriodToday, cyclePhase, cycleSummary,
} from '../store.js';
import { openTaskSheet } from '../components/taskSheet.js';

const MONTHS = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
const WEEKDAYS = ['DOM', 'SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB'];

const PHASE = {
  period:    { label: 'Menstruação',    color: '#c9184a', bg: 'bg-soft-200' },
  fertile:   { label: 'Período fértil',  color: '#ff8fa3', bg: '' },
  ovulation: { label: 'Ovulação',        color: '#ff4d6d', bg: '' },
};

export function renderAgenda(app) {
  const today = new Date();
  const todayKey = keyOf(today);
  let viewY = today.getFullYear();
  let viewM = today.getMonth();
  let selectedKey = todayKey;
  let showCycle = getCycle().enabled;   // mostra a camada de ciclo
  let cycleEdit = false;                // mostra o formulário de configuração

  const view = h(`
    <div class="h-full flex flex-col relative">
      <div class="content-wrap lg:max-w-2xl flex-1 overflow-y-auto">
        <header class="sticky top-0 z-20 bg-bg px-6 lg:px-0 pt-12 lg:pt-8 pb-2 flex items-center justify-between gap-2">
          <h1 id="month-label" class="font-serif font-bold text-bordeaux-900 text-[22px] lg:text-3xl truncate"></h1>
          <div class="flex items-center gap-1.5 shrink-0">
            <button id="cycle-toggle" class="text-xs font-semibold px-3 py-1.5 rounded-full border transition">🌸 Ciclo</button>
            <button id="today-btn" class="text-xs font-semibold text-bordeaux-700 px-3 py-1.5 rounded-full border border-soft-100 hover:bg-soft-100 transition">Hoje</button>
            <button id="prev" class="w-9 h-9 rounded-full grid place-items-center text-bordeaux-700 hover:bg-soft-100 transition rotate-180">${icons.chevron}</button>
            <button id="next" class="w-9 h-9 rounded-full grid place-items-center text-bordeaux-700 hover:bg-soft-100 transition">${icons.chevron}</button>
          </div>
        </header>

        <div class="px-5 lg:px-0">
          <div class="bg-white rounded-xl2 shadow-card border border-soft-100 p-3">
            <div class="grid grid-cols-7 mb-1">
              ${WEEKDAYS.map((w) => `<div class="text-center text-[10px] font-semibold text-soft-300 py-1">${w}</div>`).join('')}
            </div>
            <div id="grid" class="grid grid-cols-7 gap-1"></div>
          </div>
        </div>

        <div id="cyclepanel" class="px-5 lg:px-0 pt-3"></div>
        <div id="day" class="px-5 lg:px-0 pt-3 pb-2 safe-bottom"></div>
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
  const cycleEl = $('#cyclepanel', view);
  const toggleBtn = $('#cycle-toggle', view);

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
    toggleBtn.className = `text-xs font-semibold px-3 py-1.5 rounded-full border transition ${showCycle ? 'bg-accent text-white border-accent' : 'text-bordeaux-700 border-soft-100 hover:bg-soft-100'}`;

    // grade do mês
    const first = new Date(viewY, viewM, 1);
    const startPad = first.getDay();
    const daysInMonth = new Date(viewY, viewM + 1, 0).getDate();
    const cells = [];
    for (let i = 0; i < startPad; i++) cells.push('<div></div>');
    for (let d = 1; d <= daysInMonth; d++) {
      const date = new Date(viewY, viewM, d);
      const k = keyOf(date);
      const count = (byDay.get(k) || []).filter((t) => !t.done).length;
      const isToday = k === todayKey;
      const isSel = k === selectedKey;
      const phase = showCycle ? cyclePhase(k) : null;
      const ph = phase ? PHASE[phase] : null;
      const cycleRing = phase === 'ovulation' ? 'ring-2 ring-inset ring-accent' : '';

      const base = isSel
        ? 'bg-bordeaux-700 text-white border-bordeaux-700 shadow-card'
        : isToday
          ? 'bg-soft-100/70 text-bordeaux-900 border-soft-200'
          : (ph && ph.bg ? `${ph.bg} text-bordeaux-900 border-transparent` : 'text-bordeaux-800 border-transparent hover:bg-soft-100/60');

      cells.push(`
        <button data-date="${k}"
          class="relative aspect-square rounded-xl flex flex-col items-center justify-center gap-0.5 text-sm transition active:scale-90 border ${base} ${cycleRing}">
          ${ph ? `<span class="absolute top-1 right-1 w-1.5 h-1.5 rounded-full" style="background:${ph.color}"></span>` : ''}
          <span class="font-semibold leading-none">${d}</span>
          <span class="h-1.5 flex items-center">${count
            ? `<span class="w-1.5 h-1.5 rounded-full ${isSel ? 'bg-white' : 'bg-accent'}"></span>` : ''}</span>
        </button>`);
    }
    grid.innerHTML = cells.join('');
    $$('[data-date]', grid).forEach((b) =>
      b.addEventListener('click', () => { selectedKey = b.dataset.date; render(); })
    );

    renderCyclePanel();
    renderDayList(byDay, undated);
  }

  function renderDayList(byDay, undated) {
    const dayTasks = (byDay.get(selectedKey) || []).slice().sort((a, b) => Number(a.done) - Number(b.done));
    dayEl.innerHTML = `
      <h2 class="font-serif font-bold text-bordeaux-900 text-lg mb-2">${labelForKey(selectedKey, today)}</h2>
      ${dayTasks.length
        ? `<div class="stagger flex flex-col gap-2 mb-6">${dayTasks.map(taskRow).join('')}</div>`
        : `<div class="bg-white/60 border border-soft-100 rounded-2xl p-5 text-center mb-6">
             <p class="text-sm text-bordeaux-700">Nada agendado para este dia. Aproveite para respirar. 🌸</p>
           </div>`}
      ${undated.length
        ? `<h3 class="text-xs font-semibold text-soft-300 uppercase tracking-wide mb-2">Sem data definida</h3>
           <div class="flex flex-col gap-2 pb-4">${undated.slice().sort((a, b) => Number(a.done) - Number(b.done)).map(taskRow).join('')}</div>`
        : ''}
    `;
  }

  // ---------------- Ciclo menstrual ----------------
  function renderCyclePanel() {
    if (!showCycle) { cycleEl.innerHTML = ''; return; }
    const c = getCycle();

    if (!c.lastStart || cycleEdit) {
      const pref = c.lastStart || todayKey;
      cycleEl.innerHTML = `
        <div class="bg-white rounded-xl2 shadow-card border border-soft-100 p-4">
          <p class="font-serif font-bold text-bordeaux-900 mb-0.5">🌸 Ciclo menstrual</p>
          <p class="text-xs text-bordeaux-700 mb-3">Informe os dados para ver as previsões. Tudo fica só no seu aparelho. 🔒</p>
          <label class="block text-xs font-medium text-bordeaux-700 mb-1">Início da última menstruação</label>
          <input id="cy-last" type="date" max="${todayKey}" value="${pref}"
            class="w-full mb-3 px-3 py-2.5 rounded-2xl bg-white border border-soft-100 text-bordeaux-900 focus:border-accent focus:ring-4 focus:ring-accent/15 outline-none transition text-[15px]" />
          <div class="flex gap-2 mb-3">
            <div class="flex-1">
              <label class="block text-xs font-medium text-bordeaux-700 mb-1">Duração do ciclo</label>
              <input id="cy-cycle" type="number" min="20" max="45" value="${c.cycleLength}"
                class="w-full px-3 py-2.5 rounded-2xl bg-white border border-soft-100 text-bordeaux-900 focus:border-accent outline-none text-[15px]" />
            </div>
            <div class="flex-1">
              <label class="block text-xs font-medium text-bordeaux-700 mb-1">Dias de menstruação</label>
              <input id="cy-period" type="number" min="2" max="10" value="${c.periodLength}"
                class="w-full px-3 py-2.5 rounded-2xl bg-white border border-soft-100 text-bordeaux-900 focus:border-accent outline-none text-[15px]" />
            </div>
          </div>
          <button id="cy-save" class="cta-lift w-full py-3 rounded-full bg-accent hover:bg-accent-hover text-white font-semibold shadow-fab active:scale-[.98] transition">Salvar</button>
        </div>`;

      $('#cy-save', cycleEl).addEventListener('click', () => {
        const last = $('#cy-last', cycleEl).value || todayKey;
        const cycleLength = clampNum($('#cy-cycle', cycleEl).value, 20, 45, 28);
        const periodLength = clampNum($('#cy-period', cycleEl).value, 2, 10, 5);
        setCycle({ enabled: true, lastStart: last, cycleLength, periodLength });
        cycleEdit = false;
        render();
      });
      return;
    }

    const s = cycleSummary();
    const ph = s.phaseToday ? PHASE[s.phaseToday] : null;
    cycleEl.innerHTML = `
      <div class="bg-white rounded-xl2 shadow-card border border-soft-100 p-4">
        <div class="flex items-center justify-between mb-2">
          <p class="font-serif font-bold text-bordeaux-900">🌸 Seu ciclo</p>
          <button id="cy-edit" class="text-xs text-bordeaux-700 underline">ajustar</button>
        </div>
        <div class="flex items-center gap-2 mb-2 flex-wrap">
          ${ph
            ? `<span class="text-xs font-semibold text-white px-2.5 py-1 rounded-full" style="background:${ph.color}">${ph.label}</span>`
            : `<span class="text-xs font-semibold text-bordeaux-700 px-2.5 py-1 rounded-full bg-soft-100">Fase neutra</span>`}
          <span class="text-xs text-bordeaux-700">Dia ${s.dayInCycle} do ciclo</span>
        </div>
        <p class="text-sm text-bordeaux-900 mb-3">${s.daysUntilNext === 0
          ? 'A menstruação deve começar <b>hoje</b>.'
          : `Próxima menstruação em <b>${s.daysUntilNext} dia${s.daysUntilNext > 1 ? 's' : ''}</b> · ${formatBR(s.nextStartKey)}`}</p>
        <button id="cy-log" class="cta-lift w-full py-2.5 rounded-full bg-accent hover:bg-accent-hover text-white text-sm font-semibold shadow-fab active:scale-[.98] transition mb-3">
          Registrar menstruação hoje
        </button>
        <div class="flex items-center gap-3 text-[11px] text-bordeaux-700">
          ${legendDot('#c9184a', 'Menstruação')} ${legendDot('#ff8fa3', 'Fértil')} ${legendDot('#ff4d6d', 'Ovulação')}
        </div>
      </div>`;

    $('#cy-edit', cycleEl).addEventListener('click', () => { cycleEdit = true; render(); });
    $('#cy-log', cycleEl).addEventListener('click', () => { logPeriodToday(); cycleEdit = false; render(); app.toast('Menstruação registrada 🌸'); });
  }

  // eventos de navegação
  $('#prev', view).addEventListener('click', () => { viewM--; if (viewM < 0) { viewM = 11; viewY--; } render(); });
  $('#next', view).addEventListener('click', () => { viewM++; if (viewM > 11) { viewM = 0; viewY++; } render(); });
  $('#today-btn', view).addEventListener('click', () => { viewY = today.getFullYear(); viewM = today.getMonth(); selectedKey = todayKey; render(); });
  toggleBtn.addEventListener('click', () => { showCycle = !showCycle; setCycle({ enabled: showCycle }); cycleEdit = false; render(); });
  $('#fab', view).addEventListener('click', () => openTaskSheet(app, render));

  render();
  return view;
}

/* ---------------- helpers ---------------- */
function legendDot(color, label) {
  return `<span class="inline-flex items-center gap-1"><span class="w-2 h-2 rounded-full" style="background:${color}"></span>${label}</span>`;
}

function clampNum(v, min, max, fallback) {
  const n = parseInt(v, 10);
  if (isNaN(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

function taskRow(t) {
  const cat = getCategory(t.category);
  const done = t.done;
  const time = (t.due && t.due.match(/\d{1,2}:\d{2}/)) ? t.due.match(/\d{1,2}:\d{2}/)[0] : '';
  return `
    <div class="lift flex items-center gap-3 bg-white rounded-2xl shadow-card border border-soft-100 px-4 py-3">
      <span class="shrink-0 w-2.5 h-2.5 rounded-full" style="background:${cat ? cat.dot : '#ff4d6d'}"></span>
      <div class="min-w-0 flex-1">
        <p class="text-[15px] font-medium leading-tight ${done ? 'line-through text-soft-300' : 'text-bordeaux-900'}">${t.title}</p>
        <p class="text-xs text-bordeaux-700 mt-0.5">${cat ? cat.label : ''}${t.parentId ? ' • subtarefa' : ''}</p>
      </div>
      ${time ? `<span class="shrink-0 text-xs font-semibold text-bordeaux-700">${time}</span>` : ''}
    </div>`;
}

function keyOf(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function addDays(d, n) { const x = new Date(d); x.setDate(x.getDate() + n); return x; }
function formatBR(key) { const [, m, d] = key.split('-'); return `${d}/${m}`; }

function labelForKey(key, today) {
  const [y, m, d] = key.split('-').map(Number);
  const tk = keyOf(today);
  if (key === tk) return 'Hoje';
  if (key === keyOf(addDays(today, 1))) return 'Amanhã';
  if (key === keyOf(addDays(today, -1))) return 'Ontem';
  return `${d} de ${MONTHS[m - 1]}`;
}

function parseDueDate(due, base) {
  if (!due) return null;
  const t = due.toLowerCase();
  const today = new Date(base.getFullYear(), base.getMonth(), base.getDate());

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

  m = t.match(/dia\s+(\d{1,2})/);
  if (m) {
    const d = +m[1];
    let dt = new Date(today.getFullYear(), today.getMonth(), d);
    if (dt < today) dt = new Date(today.getFullYear(), today.getMonth() + 1, d);
    return dt;
  }

  const weekdays = [
    [/\bdomingo\b/, 0], [/\bsegunda\b/, 1], [/\bter[çc]a\b/, 2], [/\bquarta\b/, 3],
    [/\bquinta\b/, 4], [/\bsexta\b/, 5], [/\bs[áa]bado\b/, 6],
  ];
  for (const [re, idx] of weekdays) {
    if (re.test(t)) {
      let delta = (idx - today.getDay() + 7) % 7;
      if (delta === 0) delta = 7;
      return addDays(today, delta);
    }
  }

  if (/\d{1,2}[:h]\d{2}/.test(t)) return today;
  return null;
}
