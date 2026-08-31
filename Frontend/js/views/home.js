/* ============================================================
   Home / Dashboard "Minha Mente" (Tela 3)
   Mobile : lista vertical (checklist) + bottom bar
   Desktop: lista principal + painel de agenda semanal (aside)
   ============================================================ */

import { h, $, $$, icons, toast, logoMark } from '../ui.js';
import { getUser, getTasks, getTopTasks, getSubtasks, getCategory, getPriority, toggleTask, removeTask, isSyncing, CATEGORIES } from '../store.js';
import { formatDue, isOverdue } from '../dates.js';
import { playComplete, playUndo, playTap, playDelete, playAllDone } from '../sound.js';
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
            <div id="progress" class="mt-3.5"></div>
          </header>

          <!-- filtros -->
          <div class="px-6 lg:px-0 pb-2 overflow-x-auto no-scrollbar">
            <div id="filters" class="flex gap-2 w-max lg:flex-wrap lg:w-full pr-6 lg:pr-0"></div>
          </div>

          <!-- lista -->
          <div id="list" class="stagger flex-1 overflow-y-auto px-5 lg:px-0 pt-2 safe-bottom"></div>
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

  // Delegação de eventos (anexada UMA vez) — evita re-anexar listeners a cada
  // render da lista (mais performático e sem vazamento de handlers).
  listEl.addEventListener('click', (e) => {
    const check = e.target.closest('[data-check]');
    if (check) { handleToggle(check.dataset.check); return; }
    const del = e.target.closest('[data-del]');
    if (del) { e.stopPropagation(); confirmDelete(del.dataset.del); return; }
    // Botão do estado vazio (a lista é reescrita a cada render; por isso vem
    // pela delegação, e não por um listener próprio).
    if (e.target.closest('[data-new]')) { playTap(); openTaskSheet(app, renderList); }
  });
  let lpTimer;
  listEl.addEventListener('touchstart', (e) => {
    const card = e.target.closest('[data-card]');
    if (card) lpTimer = setTimeout(() => openQuickActions(card.dataset.card), 500);
  }, { passive: true });
  const cancelLp = () => clearTimeout(lpTimer);
  listEl.addEventListener('touchend', cancelLp);
  listEl.addEventListener('touchmove', cancelLp, { passive: true });

  function renderFilters() {
    const all = [{ id: 'tudo', label: 'Tudo' }, ...CATEGORIES];
    filtersEl.innerHTML = all.map((c) => {
      const on = c.id === filter;
      const dot = c.dot ? `<span class="w-1.5 h-1.5 rounded-full" style="background:${c.dot}"></span>` : '';
      return `<button data-filter="${c.id}"
        class="inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition
               ${on ? 'bg-bordeaux-700 text-white shadow-card' : 'bg-white text-bordeaux-700 border border-soft-100 hover:border-soft-200'}">
        ${dot}${c.label}</button>`;
    }).join('');
    $$('[data-filter]', filtersEl).forEach((b) =>
      b.addEventListener('click', () => { filter = b.dataset.filter; renderFilters(); renderList(); })
    );
  }

  function renderProgress() {
    const el = $('#progress', view);
    if (!el) return;
    const tops = getTopTasks();
    const total = tops.length;
    const done = tops.filter((t) => t.done).length;
    if (total === 0) { el.innerHTML = ''; return; }
    const pct = Math.round((done / total) * 100);
    const msg = pct === 100 ? 'Tudo em dia, respire fundo 🌸' : `${done} de ${total} concluídas`;
    el.innerHTML = `
      <div class="flex items-center justify-between mb-1.5">
        <span class="text-xs font-medium text-bordeaux-700">${msg}</span>
        <span class="text-xs font-bold text-accent">${pct}%</span>
      </div>
      <div class="h-2 rounded-full bg-soft-100 overflow-hidden">
        <div class="h-full rounded-full bg-gradient-to-r from-accent to-soft-300 transition-all duration-700 ease-out" style="width:${pct}%"></div>
      </div>`;
  }

  /**
   * @param {string[]} [revealIds] ids recém-criados (pela IA) — entram um a um,
   *        em vez de surgirem todos de uma vez no meio da lista.
   */
  function renderList(revealIds) {
    renderProgress();
    // Apenas tarefas principais na lista; as subtarefas vêm aninhadas.
    const tasks = getTopTasks().filter((t) => filter === 'tudo' || t.category === filter);

    if (tasks.length === 0) {
      // Lista vazia é ambígua: pode ser "não há nada" ou "ainda não chegou".
      // Com uma sessão salva e o sync em andamento, dizer "sua mente está
      // limpa" seria mentira — e assustaria quem tem 30 tarefas no servidor.
      listEl.innerHTML = isSyncing() ? skeletonList() : emptyState(filter);
      renderWeekPanel();
      return;
    }

    const revelar = Array.isArray(revealIds) ? revealIds : [];
    const ordered = [...tasks].sort((a, b) => Number(a.done) - Number(b.done));
    listEl.innerHTML = ordered.map((t) => {
      const subs = getSubtasks(t.id).sort((a, b) => Number(a.done) - Number(b.done));
      const doneCount = subs.filter((s) => s.done).length;
      return taskCard(t, { total: subs.length, done: doneCount }) +
        (subs.length ? subtaskGroup(subs, revelar) : '');
    }).join('');

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
            : `<span class="text-xs text-muted">livre</span>`}
        </div>`;
    }).join('');
  }

  function handleToggle(id) {
    const card = $(`[data-card="${id}"]`, listEl);
    const t = toggleTask(id);
    if (t && t.done && card) {
      playComplete();
      // A última pendência caiu: marco do dia, não só mais um item. Conta sobre
      // TODAS as tarefas, não sobre o filtro ativo — zerar a aba "Trabalho"
      // enquanto sobram cinco em "Casa" não é a mente vazia que o som celebra.
      if (getTasks().every((x) => x.done)) playAllDone();
      card.classList.add('task-done');
      card.addEventListener('animationend', () => renderList(), { once: true });
    } else {
      // Desmarcar é a reversão: as mesmas notas, ao contrário.
      if (t) playUndo();
      renderList();
    }
  }

  /**
   * Remove a tarefa deixando o card sair de cena antes de a lista se refazer.
   *
   * Sem o card na tela (a exclusão pode vir do menu, depois de a lista já ter
   * sido redesenhada) a remoção é imediata — a animação é um bônus, nunca uma
   * condição para o dado sumir.
   */
  function confirmDelete(id) {
    playDelete();
    const card = $(`[data-card="${id}"]`, listEl);
    if (!card) {
      removeTask(id);
      renderList();
      toast('Tarefa removida');
      return;
    }
    card.classList.add('task-remove');
    card.addEventListener('animationend', () => {
      removeTask(id);
      renderList();
      toast('Tarefa removida');
    }, { once: true });
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
    $('[data-act="delete"]', menu).addEventListener('click', () => { close(); confirmDelete(id); });
  }

  // eventos
  $('#fab', view).addEventListener('click', () => { playTap(); openTaskSheet(app, renderList); });
  const avatar = $('#avatar', view);
  if (avatar) avatar.addEventListener('click', () => app.navigate('profile'));
  const goAgenda = $('#go-agenda', view);
  if (goAgenda) goAgenda.addEventListener('click', () => app.navigate('agenda'));

  renderFilters();
  renderList();
  return view;
}

/* ---------------- helpers de render ---------------- */
function taskCard(t, sub = { total: 0, done: 0 }) {
  const cat = getCategory(t.category);
  const done = t.done;
  // Prioridade: deriva de `priority` (fallback p/ tarefas antigas via `important`).
  const prio = getPriority(t.priority || (t.important ? 'alta' : 'media'));
  const hasSubs = sub.total > 0;
  return `
  <div data-card="${t.id}"
    style="border-left:4px solid ${cat ? cat.dot : '#ffb3c1'}"
    class="lift group relative bg-white rounded-2xl shadow-card border border-soft-100 px-4 py-3.5 ${hasSubs ? 'mb-1' : 'mb-3'} flex items-center gap-3 select-none hover:border-soft-200">
    <button data-check="${t.id}"
      class="shrink-0 w-7 h-7 rounded-full border-2 grid place-items-center transition
             ${done ? 'bg-accent border-accent text-white' : 'border-soft-200 text-transparent hover:border-accent'}">
      <span class="${done ? 'check-pop' : ''}">${icons.check}</span>
    </button>
    <div class="min-w-0 flex-1">
      <p class="text-[15px] font-medium leading-tight ${done ? 'line-through text-muted' : 'text-bordeaux-900'}">${t.title}</p>
      <div class="flex items-center gap-2 mt-1 flex-wrap">
        ${formatDue(t) ? `<span class="text-xs ${done ? 'text-muted' : (isOverdue(t) ? 'text-accent font-semibold' : 'text-bordeaux-700')}">${formatDue(t)}</span>` : ''}
        ${!done && prio.id !== 'media' ? `<span class="inline-flex items-center gap-1 text-xs font-semibold text-bordeaux-700">
          <span class="w-1.5 h-1.5 rounded-full" style="background:${prio.dot}"></span>${prio.label}</span>` : ''}
        ${hasSubs ? `<span class="inline-flex items-center gap-1 text-xs font-semibold text-accent">✨ ${sub.done}/${sub.total} passos</span>` : ''}
      </div>
    </div>
    <!-- ação no hover (desktop): excluir, em tom Cherry Rose discreto -->
    <button data-del="${t.id}" title="Excluir"
      class="hidden lg:grid place-items-center shrink-0 w-8 h-8 rounded-full text-bordeaux-700/0 group-hover:text-bordeaux-600 hover:bg-soft-100 transition">
      ${icons.trash}
    </button>
  </div>`;
}

/* Grupo de subtarefas (sugeridas pela IA), aninhadas sob a tarefa-mãe. */
function subtaskGroup(subs, revealIds = []) {
  // O índice da animação conta só os itens que serão revelados: se apenas o
  // terceiro passo é novo, ele entra imediatamente, sem herdar a espera dos
  // dois que já estavam na tela.
  let ordem = 0;
  const linhas = subs.map((t) => {
    const novo = revealIds.includes(t.id);
    return subtaskRow(t, novo ? ordem++ : null);
  });
  return `<div class="ml-6 pl-3 border-l-2 border-soft-100 mb-3 flex flex-col gap-2">
    ${linhas.join('')}
  </div>`;
}

function subtaskRow(t, revealIndex = null) {
  const done = t.done;
  const anima = revealIndex != null;
  return `
  <div data-card="${t.id}"${anima ? ` style="--i:${revealIndex}"` : ''}
    class="${anima ? 'reveal ' : ''}group relative flex items-center gap-2.5 bg-white/70 rounded-xl border border-soft-100 px-3 py-2 select-none hover:border-soft-200 transition">
    <button data-check="${t.id}"
      class="shrink-0 w-5 h-5 rounded-full border-2 grid place-items-center transition
             ${done ? 'bg-accent border-accent text-white' : 'border-soft-200 text-transparent hover:border-accent'}">
      <span class="${done ? 'check-pop' : ''}">${icons.check}</span>
    </button>
    <p class="flex-1 min-w-0 text-[13px] leading-tight ${done ? 'line-through text-muted' : 'text-bordeaux-800'}">${t.title}</p>
    ${formatDue(t) && !done ? `<span class="text-[11px] shrink-0 ${isOverdue(t) ? 'text-accent font-semibold' : 'text-bordeaux-700'}">${formatDue(t)}</span>` : ''}
    <button data-del="${t.id}" title="Excluir"
      class="hidden lg:grid place-items-center shrink-0 w-7 h-7 rounded-full text-bordeaux-700/0 group-hover:text-bordeaux-600 hover:bg-soft-100 transition">
      ${icons.trash}
    </button>
  </div>`;
}

/* Esqueleto: a forma do que está por vir, enquanto o sync não responde.
   Três linhas bastam — mais que isso vira uma promessa de lista cheia que o
   servidor talvez não confirme. */
function skeletonList() {
  return `
  <div data-skeleton class="flex flex-col gap-3 pt-1" aria-hidden="true">
    ${[0, 1, 2].map(() => `
      <div class="bg-white rounded-2xl shadow-card border border-soft-100 px-4 py-3.5 flex items-center gap-3">
        <div class="skeleton shrink-0 w-7 h-7 rounded-full"></div>
        <div class="flex-1 min-w-0 flex flex-col gap-2">
          <div class="skeleton h-3.5 w-3/5 rounded-full"></div>
          <div class="skeleton h-2.5 w-2/5 rounded-full"></div>
        </div>
      </div>`).join('')}
    <p class="text-center text-xs text-bordeaux-700 pt-1">Buscando suas tarefas…</p>
  </div>`;
}

function emptyState(filter) {
  const label = filter === 'tudo' ? 'aqui' : `em ${getCategory(filter)?.label || ''}`;
  return `
  <div class="h-full flex flex-col items-center justify-center text-center px-8 pb-20">
    <!-- Aqui havia um pino de mapa. Numa tela que diz "sua mente parece limpa",
         a ilustração era um marcador de localização — sem relação com o texto
         nem com a marca. A borboleta é o isotipo e já significa leveza. -->
    <div class="w-24 h-24 rounded-full bg-soft-100/70 grid place-items-center mb-5">
      ${logoMark('h-12 w-auto', true)}
    </div>
    <h3 class="font-serif font-bold text-bordeaux-900 text-xl mb-2">Sua mente parece limpa ${label}.</h3>
    <p class="text-sm text-bordeaux-700 max-w-[260px] mb-5">Que tal registrar a primeira pendência para começar a relaxar?</p>
    <!-- Uma ação, e ela funciona daqui. A seta apontando para o FAB pedia que a
         usuária descobrisse sozinha o que fazer — e no desktop o botão fica
         longe do texto. -->
    <button data-new
      class="cta-lift inline-flex items-center gap-2 px-6 py-3 rounded-full bg-accent hover:bg-accent-hover text-white font-semibold shadow-fab active:scale-[.98] transition">
      ${icons.plus} Criar a primeira tarefa
    </button>
  </div>`;
}

function initials(name) {
  const parts = name.trim().split(/\s+/);
  const txt = (parts[0]?.[0] || '') + (parts[1]?.[0] || '');
  return `<span class="font-serif font-bold text-sm">${txt.toUpperCase()}</span>`;
}

