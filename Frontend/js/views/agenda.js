/* ============================================================
   Agenda / Calendário (Tela 5)
   Mobile : "Agenda do Dia" — tira semanal + timeline vertical (o agora)
   Desktop: "Visão Semanal" — 7 colunas lado a lado (planejamento)
   ============================================================ */

import { h, $, $$, icons, isDesktop } from '../ui.js';
import { getTasks, getCategory } from '../store.js';
import { openTaskSheet } from '../components/taskSheet.js';

const MONTHS = ['JANEIRO', 'FEVEREIRO', 'MARÇO', 'ABRIL', 'MAIO', 'JUNHO', 'JULHO', 'AGOSTO', 'SETEMBRO', 'OUTUBRO', 'NOVEMBRO', 'DEZEMBRO'];
const WEEKDAYS = ['DOM', 'SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB'];

export function renderAgenda(app) {
  const today = new Date();
  let selected = today.getDate();

  const view = h(`
    <div class="h-full flex flex-col relative">
      <div class="content-wrap flex-1 flex flex-col overflow-hidden">
        <header class="px-6 lg:px-0 pt-12 lg:pt-8 pb-3">
          <h1 class="font-serif font-bold text-bordeaux-900 text-[26px] lg:text-3xl">${MONTHS[today.getMonth()]} ${today.getFullYear()}</h1>
        </header>

        <!-- MOBILE: tira semanal + timeline -->
        <div class="lg:hidden flex flex-col flex-1 overflow-hidden">
          <div id="week" class="px-5 overflow-x-auto no-scrollbar">
            <div class="flex gap-2 w-max pb-2"></div>
          </div>
          <div id="timeline" class="flex-1 overflow-y-auto px-5 pt-4 safe-bottom"></div>
        </div>

        <!-- DESKTOP: visão semanal em colunas -->
        <div id="week-grid" class="hidden lg:grid grid-cols-7 gap-3 flex-1 overflow-y-auto safe-bottom pt-2"></div>
      </div>

      <button id="fab"
        class="fab absolute right-5 bottom-24 lg:bottom-10 w-16 h-16 rounded-full bg-accent text-white grid place-items-center shadow-fab fab-pulse active:scale-95 transition-transform z-30">
        ${icons.plus}
      </button>
    </div>
  `);

  const weekRow = $('#week > div', view);
  const timeline = $('#timeline', view);
  const weekGrid = $('#week-grid', view);

  function weekDays() {
    const base = new Date(today);
    base.setDate(today.getDate() - base.getDay()); // domingo
    return Array.from({ length: 7 }).map((_, i) => {
      const d = new Date(base);
      d.setDate(base.getDate() + i);
      return d;
    });
  }

  function tasksForDay(d) {
    // MVP: tarefas pendentes concentradas em "hoje".
    return d.getDate() === today.getDate() ? getTasks().filter((t) => !t.done) : [];
  }

  // ---------------- MOBILE ----------------
  function renderWeek() {
    const days = weekDays();
    weekRow.innerHTML = days.map((d) => {
      const day = d.getDate();
      const on = day === selected;
      const has = tasksForDay(d).length > 0;
      return `
        <button data-day="${day}"
          class="flex flex-col items-center gap-1.5 w-12 py-2 rounded-2xl transition ${on ? 'bg-bordeaux-700 text-white shadow-card' : 'text-bordeaux-700'}">
          <span class="text-[10px] font-medium ${on ? 'text-white/80' : 'text-soft-300'}">${WEEKDAYS[d.getDay()]}</span>
          <span class="text-base font-bold">${String(day).padStart(2, '0')}</span>
          <span class="w-1.5 h-1.5 rounded-full ${has ? (on ? 'bg-white' : 'bg-accent') : 'bg-transparent'}"></span>
        </button>`;
    }).join('');
    $$('[data-day]', weekRow).forEach((b) =>
      b.addEventListener('click', () => { selected = Number(b.dataset.day); renderWeek(); renderTimeline(); })
    );
  }

  function renderTimeline() {
    const day = weekDays().find((d) => d.getDate() === selected) || today;
    const tasks = tasksForDay(day);
    if (tasks.length === 0) {
      timeline.innerHTML = emptyDay();
      return;
    }
    timeline.innerHTML = tasks.map((t, i) => timelineRow(t, i)).join('');
  }

  // ---------------- DESKTOP ----------------
  function renderWeekGrid() {
    const days = weekDays();
    weekGrid.innerHTML = days.map((d) => {
      const isToday = d.getDate() === today.getDate();
      const tasks = tasksForDay(d);
      return `
        <div class="flex flex-col rounded-2xl ${isToday ? 'bg-soft-100/60' : 'bg-white/60'} border border-soft-100 overflow-hidden">
          <div class="text-center py-3 ${isToday ? 'bg-bordeaux-700 text-white' : 'text-bordeaux-700'}">
            <div class="text-[10px] font-medium ${isToday ? 'text-white/80' : 'text-soft-300'}">${WEEKDAYS[d.getDay()]}</div>
            <div class="text-lg font-bold">${String(d.getDate()).padStart(2, '0')}</div>
          </div>
          <div class="flex-1 p-2 flex flex-col gap-2 min-h-[120px]">
            ${tasks.length
              ? tasks.map((t) => {
                  const cat = getCategory(t.category);
                  return `<div class="bg-white rounded-xl shadow-card border-l-4 px-2.5 py-2" style="border-color:${cat ? cat.dot : '#ff4d6d'}">
                    <p class="text-xs font-medium text-bordeaux-900 leading-tight">${t.title}</p>
                    <p class="text-[10px] text-bordeaux-700 mt-0.5">${(t.due && t.due.match(/\\d{1,2}:\\d{2}/)) ? t.due.match(/\\d{1,2}:\\d{2}/)[0] : ''}</p>
                  </div>`;
                }).join('')
              : '<span class="text-[11px] text-soft-300 text-center mt-2">livre</span>'}
          </div>
        </div>`;
    }).join('');
  }

  function render() {
    if (isDesktop()) renderWeekGrid();
    else { renderWeek(); renderTimeline(); }
  }

  $('#fab', view).addEventListener('click', () => openTaskSheet(app, render));
  // re-render ao cruzar o breakpoint
  window.matchMedia('(min-width: 1024px)').addEventListener?.('change', render);

  render();
  return view;
}

/* ---------------- helpers ---------------- */
function timelineRow(t, i) {
  const cat = getCategory(t.category);
  const time = (t.due && t.due.match(/\d{1,2}:\d{2}/)) ? t.due.match(/\d{1,2}:\d{2}/)[0] : ['09:00', '10:30', '12:00', '14:00'][i % 4];
  return `
    <div class="flex gap-3 mb-1">
      <div class="w-14 shrink-0 text-right pt-3"><span class="text-xs font-semibold text-bordeaux-700">${time}</span></div>
      <div class="relative flex flex-col items-center">
        <span class="w-2.5 h-2.5 rounded-full mt-4" style="background:${cat ? cat.dot : '#ff4d6d'}"></span>
        <span class="flex-1 w-px bg-soft-100 my-1"></span>
      </div>
      <div class="flex-1 bg-white rounded-2xl shadow-card border border-soft-100 px-4 py-3 mb-2">
        <p class="text-[15px] font-medium text-bordeaux-900">${t.title}</p>
        <p class="text-xs text-bordeaux-700 mt-0.5">${cat ? cat.label : ''}</p>
      </div>
    </div>`;
}

function emptyDay() {
  return `
    <div class="h-full flex flex-col items-center justify-center text-center pb-24">
      <div class="w-20 h-20 rounded-full bg-soft-100/70 grid place-items-center text-accent mb-4">${icons.calendar}</div>
      <p class="font-serif font-bold text-bordeaux-900 text-lg">Dia livre por aqui</p>
      <p class="text-sm text-bordeaux-700 mt-1 max-w-[240px]">Nada agendado para este dia. Aproveite para respirar.</p>
    </div>`;
}
