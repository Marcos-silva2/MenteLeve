/* ============================================================
   Home / Dashboard "Minha Mente" (Tela 3)
   Mobile : lista vertical (checklist) + bottom bar
   Desktop: lista principal + painel de agenda semanal (aside)
   ============================================================ */

import { h, $, $$, icons, toast } from '../ui.js';
import { getUser, getTasks, getCategory, toggleTask, removeTask, CATEGORIES } from '../store.js';
import { openTaskSheet } from '../components/taskSheet.js';

export function renderHome(app) {
  let filter = 'tudo';
  const user = getUser() || { name: 'Você' };

  const view = h(`
    <div class="h-full flex flex-col relative">
      <div class="content-wrap w-full flex-1 flex flex-col lg:flex-row lg:gap-8 lg:pt-8 min-w-0 overflow-hidden">

        <!-- coluna principal -->
        <section class="flex flex-col flex-1 min-w-0 w-full lg:max-w-xl overflow-hidden">
          <header class="px-6 lg:px-0 pt-12 lg:pt-0 pb-3">
            <div class="flex items-start justify-between">
              <h1 class="font-serif font-bold text-bordeaux-900 text-[26px] lg:text-3xl leading-tight">
                Olá, ${user.name.split(' ')[0]}.<br/>Respire fundo…
              </h1>
              <button id="avatar" class="lg:hidden w-11 h-11 rounded-full bg-soft-200 grid place-items-center text-bordeaux-900 shrink-0 mt-1">
                ${initials(user.name)}
              </button>
            </div>
          </header>

          <!-- filtros -->
          <div class="px-6 lg:px-0 pb-2 overflow-x-auto no-scrollbar">
            <div id="filters" class="flex gap-2 w-max lg:flex-wrap lg:w-full pr-6 lg:pr-0"></div>
          </div>

          <!-- lista -->
          <div id="list" class="flex-1 overflow-y-auto px-5 lg:px-0 pt-2 safe-bottom"></div>
        </section>

        <!-- painel de agenda semanal (somente desktop) -->
        <aside class="hidden lg:flex flex-col w-80 shrink-0 py-1">
          <div class="bg-white rounded-xl2 shadow-card border border-soft-100 p-5 sticky top-0">
            <h2 class="font-serif font-bold text-bordeaux-900 text-lg mb-1">Sua semana</h2>
            <p class="text-xs text-bordeaux-700 mb-4">Planeje com antecedência, sem surpresas.</p>
            <div id="week-panel" class="flex flex-col gap-2"></div>
            <button id="go-agenda" class="mt-4 w-full py-2.5 rounded-full border border-soft-200 text-bordeaux-800 text-sm font-medium hover:bg-soft-100 transition">
              Ver agenda completa
            </button>
          </div>
        </aside>
      </div>

      <!-- FAB -->
      <button id="fab"
        class="fab absolute right-5 bottom-24 lg:bottom-10 w-16 h-16 rounded-full bg-accent text-white grid place-items-center shadow-fab fab-pulse active:scale-95 transition-transform z-30">
        ${icons.plus}
      </button>
    </div>
  `);

  const filtersEl = $('#filters', view);
  const listEl = $('#list', view);

  function renderFilters() {
    const all = [{ id: 'tudo', label: 'Tudo' }, ...CATEGORIES];
    filtersEl.innerHTML = all.map((c) => {
      const on = c.id === filter;
      return `<button data-filter="${c.id}"
        class="px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition
               ${on ? 'bg-bordeaux-700 text-white' : 'bg-white text-bordeaux-700 border border-soft-100 hover:border-soft-200'}">
        ${c.label}</button>`;
    }).join('');
    $$('[data-filter]', filtersEl).forEach((b) =>
      b.addEventListener('click', () => { filter = b.dataset.filter; renderFilters(); renderList(); })
    );
  }

  function renderList() {
    const tasks = getTasks().filter((t) => filter === 'tudo' || t.category === filter);

    if (tasks.length === 0) {
      listEl.innerHTML = emptyState(filter);
      return;
    }

    const ordered = [...tasks].sort((a, b) => Number(a.done) - Number(b.done));
    listEl.innerHTML = ordered.map(taskCard).join('');

    $$('[data-check]', listEl).forEach((btn) =>
      btn.addEventListener('click', () => handleToggle(btn.dataset.check))
    );
    // exclusão: hover (desktop) ou long-press (mobile)
    $$('[data-del]', listEl).forEach((btn) =>
      btn.addEventListener('click', (e) => { e.stopPropagation(); confirmDelete(btn.dataset.del); })
    );
    $$('[data-card]', listEl).forEach((card) => attachLongPress(card));
    renderWeekPanel();
  }

  function renderWeekPanel() {
    const panel = $('#week-panel', view);
    if (!panel) return;
    const today = new Date();
    const wd = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
    const pending = getTasks().filter((t) => !t.done);
    panel.innerHTML = Array.from({ length: 5 }).map((_, i) => {
      const d = new Date(today);
      d.setDate(today.getDate() + i);
      const label = i === 0 ? 'Hoje' : i === 1 ? 'Amanhã' : `${wd[d.getDay()]} ${d.getDate()}`;
      const count = i === 0 ? pending.length : 0; // MVP: tarefas concentradas em "hoje"
      return `
        <div class="flex items-center justify-between rounded-2xl px-3 py-2.5 ${i === 0 ? 'bg-soft-100/70' : 'bg-bg'}">
          <span class="text-sm font-medium text-bordeaux-900">${label}</span>
          ${count
            ? `<span class="text-xs font-semibold text-white bg-accent rounded-full px-2 py-0.5">${count}</span>`
            : `<span class="text-xs text-soft-300">livre</span>`}
        </div>`;
    }).join('');
  }

  function handleToggle(id) {
    const card = $(`[data-card="${id}"]`, listEl);
    const t = toggleTask(id);
    if (t && t.done && card) {
      playDing();
      card.classList.add('task-done');
      card.addEventListener('animationend', () => renderList(), { once: true });
    } else {
      renderList();
    }
  }

  function confirmDelete(id) {
    removeTask(id);
    renderList();
    toast('Tarefa removida');
  }

  function attachLongPress(card) {
    let timer;
    const id = card.dataset.card;
    const start = () => { timer = setTimeout(() => openQuickActions(id), 500); };
    const cancel = () => clearTimeout(timer);
    card.addEventListener('touchstart', start, { passive: true });
    card.addEventListener('touchend', cancel);
    card.addEventListener('touchmove', cancel);
  }

  function openQuickActions(id) {
    const host = document.getElementById('device');
    const scrim = h('<div class="scrim grid items-end"></div>');
    const menu = h(`
      <div class="sheet px-5 pt-4 pb-8">
        <div class="w-10 h-1.5 rounded-full bg-soft-100 mx-auto mb-4"></div>
        <button data-act="delete" class="w-full text-left px-4 py-3.5 rounded-2xl text-bordeaux-600 font-medium active:bg-bg transition">
          Excluir tarefa
        </button>
        <button data-act="cancel" class="w-full text-left px-4 py-3.5 rounded-2xl text-bordeaux-700 font-medium active:bg-bg transition">
          Cancelar
        </button>
      </div>`);
    scrim.appendChild(menu);
    host.appendChild(scrim);
    const close = () => { scrim.style.animation = 'fadeOut .2s ease both'; setTimeout(() => scrim.remove(), 200); };
    scrim.addEventListener('click', (e) => { if (e.target === scrim) close(); });
    $('[data-act="cancel"]', menu).addEventListener('click', close);
    $('[data-act="delete"]', menu).addEventListener('click', () => { removeTask(id); close(); renderList(); toast('Tarefa removida'); });
  }

  // eventos
  $('#fab', view).addEventListener('click', () => openTaskSheet(app, renderList));
  const avatar = $('#avatar', view);
  if (avatar) avatar.addEventListener('click', () => app.navigate('profile'));
  const goAgenda = $('#go-agenda', view);
  if (goAgenda) goAgenda.addEventListener('click', () => app.navigate('agenda'));

  renderFilters();
  renderList();
  return view;
}

/* ---------------- helpers de render ---------------- */
function taskCard(t) {
  const cat = getCategory(t.category);
  const done = t.done;
  return `
  <div data-card="${t.id}"
    class="group relative bg-white rounded-2xl shadow-card border border-soft-100 px-4 py-3.5 mb-3 flex items-center gap-3 select-none hover:border-soft-200 transition">
    <button data-check="${t.id}"
      class="shrink-0 w-7 h-7 rounded-full border-2 grid place-items-center transition
             ${done ? 'bg-accent border-accent text-white' : 'border-soft-200 text-transparent hover:border-accent'}">
      <span class="${done ? 'check-pop' : ''}">${icons.check}</span>
    </button>
    <div class="min-w-0 flex-1">
      <p class="text-[15px] font-medium leading-tight ${done ? 'line-through text-soft-300' : 'text-bordeaux-900'}">${t.title}</p>
      <div class="flex items-center gap-2 mt-1">
        ${t.due ? `<span class="text-xs ${done ? 'text-soft-300' : 'text-bordeaux-700'}">${t.due}</span>` : ''}
        ${t.important && !done ? '<span class="text-xs font-semibold text-accent">• Importante</span>' : ''}
      </div>
    </div>
    <!-- ação no hover (desktop): excluir, em tom Cherry Rose discreto -->
    <button data-del="${t.id}" title="Excluir"
      class="hidden lg:grid place-items-center shrink-0 w-8 h-8 rounded-full text-bordeaux-700/0 group-hover:text-bordeaux-600 hover:bg-soft-100 transition">
      ${icons.trash}
    </button>
    <span class="shrink-0 w-2.5 h-2.5 rounded-full" style="background:${cat ? cat.dot : '#ffb3c1'}" title="${cat ? cat.label : ''}"></span>
  </div>`;
}

function emptyState(filter) {
  const label = filter === 'tudo' ? 'aqui' : `em ${getCategory(filter)?.label || ''}`;
  return `
  <div class="h-full flex flex-col items-center justify-center text-center px-8 pb-20">
    <div class="w-24 h-24 rounded-full bg-soft-100/70 grid place-items-center text-accent mb-5">
      <svg viewBox="0 0 24 24" fill="currentColor" class="w-12 h-12">
        <path d="M12 2C8 2 5 5 5 9c0 3.5 2.5 5.8 4.5 7.5L12 22l2.5-5.5C16.5 14.8 19 12.5 19 9c0-4-3-7-7-7zm0 9.5A2.5 2.5 0 1 1 12 6.5a2.5 2.5 0 0 1 0 5z"/>
      </svg>
    </div>
    <h3 class="font-serif font-bold text-bordeaux-900 text-xl mb-2">Sua mente parece limpa ${label}.</h3>
    <p class="text-sm text-bordeaux-700 max-w-[260px]">Que tal registrar a primeira pendência para começar a relaxar?</p>
    <div class="mt-4 text-accent animate-bounce">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="w-6 h-6"><path d="M12 5v14M5 12l7 7 7-7" stroke-linecap="round" stroke-linejoin="round"/></svg>
    </div>
  </div>`;
}

function initials(name) {
  const parts = name.trim().split(/\s+/);
  const txt = (parts[0]?.[0] || '') + (parts[1]?.[0] || '');
  return `<span class="font-serif font-bold text-sm">${txt.toUpperCase()}</span>`;
}

/* som de conclusão suave via WebAudio */
let audioCtx;
function playDing() {
  try {
    audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    const o = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(880, audioCtx.currentTime);
    o.frequency.exponentialRampToValueAtTime(1320, audioCtx.currentTime + 0.12);
    g.gain.setValueAtTime(0.0001, audioCtx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.08, audioCtx.currentTime + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + 0.25);
    o.connect(g).connect(audioCtx.destination);
    o.start();
    o.stop(audioCtx.currentTime + 0.26);
  } catch (_) { /* navegador sem suporte/autoplay bloqueado */ }
}
