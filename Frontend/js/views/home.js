/* ============================================================
   Home / Dashboard "Minha Mente" (Tela 3)
   Mobile : lista vertical (checklist) + bottom bar
   Desktop: lista principal + painel de agenda semanal (aside)
   ============================================================ */

import { h, $, $$, icons, toast, confirmDialog } from '../ui.js';
import { getUser, getTasks, getTopTasks, getSubtasks, getCategory, getPriority, toggleTask, removeTask, isSyncing, hasSession, restoreSession, CATEGORIES } from '../store.js';
import { isOnline, ensureOnline } from '../api.js';
import { formatDue, isOverdue, todayKey, addDaysKey, dateFromKey, labelForKey, resolveDue, RECURRENCE_LABELS } from '../dates.js';
import { playComplete, playUndo, playTap, playDelete, playAllDone } from '../sound.js';
import { openTaskSheet } from '../components/taskSheet.js';

/* Seções da Home. Cada tarefa cai em UMA só, decidida por sectionOf — os dados
   da tarefa não são alterados. */
const SECTIONS = [
  { id: 'hoje', title: 'Hoje' },
  { id: 'rotinas', title: 'Rotinas Cíclicas' },
  { id: 'depois', title: 'Mais Tarde / Próximos Dias' },
  { id: 'feitas', title: 'Concluídas' },
];
// Lembra quais seções estão abertas entre re-renders (concluir uma tarefa redesenha a lista).
const aberta = { hoje: true, rotinas: true, depois: true, feitas: false };

/**
 * Concluída → feitas. Em aberto com prazo hoje ou vencido → hoje (atrasada pede
 * atenção hoje). Recorrente sem prazo para hoje → rotinas. O resto (prazo
 * futuro ou sem prazo) → depois.
 */
export function sectionOf(t, today = todayKey()) {
  if (t.done) return 'feitas';
  const dia = t.dueDate || resolveDue(t.due, today);
  if (dia && dia <= today) return 'hoje';
  return t.isRecurring && t.recurrencePattern ? 'rotinas' : 'depois';
}

export function groupTasks(tasks, today = todayKey()) {
  const grupos = { hoje: [], rotinas: [], depois: [], feitas: [] };
  for (const t of tasks) grupos[sectionOf(t, today)].push(t);
  return grupos;
}

/**
 * Roda `fn` quando a animação de saída do card termina — ou já, se a pessoa
 * pediu movimento reduzido. No CSS, `prefers-reduced-motion` desliga a animação
 * (`animation: none`), e sem animação o `animationend` nunca dispara: concluir ou
 * excluir deixava a lista sem redesenhar. O temporizador cobre qualquer outro caso
 * em que o evento não chegue.
 */
function aposSaida(el, fn) {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) { fn(); return; }
  let feito = false;
  const uma = () => { if (!feito) { feito = true; fn(); } };
  el.addEventListener('animationend', uma, { once: true });
  setTimeout(uma, 800);
}

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
            <button id="go-agenda" class="btn btn-secondary mt-4 w-full border border-soft-200 !text-sm !font-medium">
              Ver agenda completa
            </button>
          </div>
        </aside>
      </div>

      <!-- FAB -->
      <button id="fab" aria-label="Adicionar nova tarefa"
        class="fab absolute right-5 bottom-24 lg:bottom-10 w-16 h-16 rounded-full bg-accent text-white grid place-items-center shadow-fab fab-pulse active:scale-95 transition-transform z-30
               focus-visible:ring-4 focus-visible:ring-accent/30 outline-none">
        ${icons.plus}
      </button>
    </div>
  `);

  const filtersEl = $('#filters', view);
  const listEl = $('#list', view);

  // Delegação de eventos (anexada UMA vez) — evita re-anexar listeners a cada
  // render da lista (mais performático e sem vazamento de handlers).
  listEl.addEventListener('click', (e) => {
    const acc = e.target.closest('[data-acc]');
    if (acc) { toggleSection(acc); return; }
    const check = e.target.closest('[data-check]');
    if (check) { handleToggle(check.dataset.check); return; }
    const del = e.target.closest('[data-del]');
    if (del) { e.stopPropagation(); confirmDelete(del.dataset.del); return; }
    // Botão do estado vazio (a lista é reescrita a cada render; por isso vem
    // pela delegação, e não por um listener próprio).
    if (e.target.closest('[data-new]')) { playTap(); openTaskSheet(app, renderList); return; }
    if (e.target.closest('[data-retry]')) retryConnection();
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
    filtersEl.setAttribute('role', 'group');
    filtersEl.setAttribute('aria-label', 'Filtrar por categoria');
    const all = [{ id: 'tudo', label: 'Tudo' }, ...CATEGORIES];
    filtersEl.innerHTML = all.map((c) => {
      const on = c.id === filter;
      const dot = c.dot ? `<span class="w-1.5 h-1.5 rounded-full" style="background:${c.dot}"></span>` : '';
      return `<button data-filter="${c.id}" aria-pressed="${on}"
        class="inline-flex items-center gap-1.5 min-h-11 px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition
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
        <span class="text-xs font-bold text-bordeaux-600">${pct}%</span>
      </div>
      <div class="h-2 rounded-full bg-soft-100 overflow-hidden"
        role="progressbar" aria-valuenow="${pct}" aria-valuemin="0" aria-valuemax="100"
        aria-label="Progresso de tarefas de hoje">
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
      // Vazia com sessão e sem servidor no ar ≠ vazia de verdade: não dá para
      // dizer "tudo tranquilo" a quem não conseguiu buscar as próprias tarefas.
      const semConexao = hasSession() && !isOnline();
      listEl.innerHTML = isSyncing() ? skeletonList() : emptyState(filter, semConexao);
      renderWeekPanel();
      return;
    }

    const revelar = Array.isArray(revealIds) ? revealIds : [];
    const grupos = groupTasks(tasks);
    listEl.innerHTML = SECTIONS.filter((sec) => grupos[sec.id].length).map((sec) => {
      const cards = grupos[sec.id].map((t) => {
        const subs = getSubtasks(t.id).sort((a, b) => Number(a.done) - Number(b.done));
        const doneCount = subs.filter((s) => s.done).length;
        return taskCard(t, { total: subs.length, done: doneCount }) +
          (subs.length ? subtaskGroup(subs, revelar) : '');
      }).join('');
      return sectionHTML(sec, grupos[sec.id].length, cards);
    }).join('');

    renderWeekPanel();
  }

  function toggleSection(btn) {
    const id = btn.dataset.acc;
    const abrir = btn.getAttribute('aria-expanded') !== 'true';
    aberta[id] = abrir;
    btn.setAttribute('aria-expanded', String(abrir));
    const painel = listEl.querySelector(`#acc-${id}`);
    if (painel) painel.dataset.open = String(abrir);
    playTap();
  }

  async function retryConnection() {
    if (await ensureOnline(true)) await restoreSession().catch(() => {});
    renderList();
    if (!isOnline()) toast('Ainda sem conexão. Suas tarefas continuam salvas aqui 💗');
  }

  function renderWeekPanel() {
    const panel = $('#week-panel', view);
    if (!panel) return;
    const wd = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
    const hoje = todayKey();
    // Só tarefas com data estruturada contam aqui — a mesma fonte de verdade
    // que o calendário usa (ver dates.js). Substitui a contagem anterior, que
    // jogava toda tarefa pendente em "Hoje" e nada nos demais dias.
    const pendentesComData = getTasks().filter((t) => !t.done && t.dueDate);
    panel.innerHTML = Array.from({ length: 5 }).map((_, i) => {
      const key = addDaysKey(hoje, i);
      const d = dateFromKey(key);
      const label = i === 0 ? 'Hoje' : i === 1 ? 'Amanhã' : `${wd[d.getDay()]} ${d.getDate()}`;
      const count = pendentesComData.filter((t) => t.dueDate === key).length;
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
    // Recorrente não fecha: o prazo rola e ela segue na lista (lido ANTES do toggle).
    const antes = getTasks().find((x) => x.id === id);
    const recorrente = !!(antes && antes.isRecurring && antes.recurrencePattern && !antes.done);
    const t = toggleTask(id);
    if (recorrente && t) {
      playComplete();
      toast(`Feito ✨ Volta ${labelForKey(t.dueDate).toLowerCase()} 🔁`);
      if (card) {
        card.classList.add('task-done');
        aposSaida(card, () => renderList());
      } else {
        renderList();
      }
      return;
    }
    if (t && t.done && card) {
      playComplete();
      // A última pendência caiu: marco do dia, não só mais um item. Conta sobre
      // TODAS as tarefas, não sobre o filtro ativo — zerar a aba "Trabalho"
      // enquanto sobram cinco em "Casa" não é a mente vazia que o som celebra.
      if (getTasks().every((x) => x.done)) playAllDone();
      card.classList.add('task-done');
      aposSaida(card, () => renderList());
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
  async function confirmDelete(id) {
    const t = getTasks().find((x) => x.id === id);
    const ok = await confirmDialog({
      title: 'Excluir esta tarefa?',
      message: t ? `“${t.title}” será removida. Isso não pode ser desfeito.` : 'Isso não pode ser desfeito.',
      confirmLabel: 'Excluir',
      cancelLabel: 'Manter',
      danger: true,
    });
    if (!ok) return;
    playDelete();
    const card = $(`[data-card="${id}"]`, listEl);
    if (!card) {
      removeTask(id);
      renderList();
      toast('Tarefa removida');
      return;
    }
    card.classList.add('task-remove');
    aposSaida(card, () => {
      removeTask(id);
      renderList();
      toast('Tarefa removida');
    });
  }

  function openQuickActions(id) {
    const host = document.getElementById('device');
    const scrim = h('<div class="scrim grid items-end"></div>');
    const menu = h(`
      <div class="sheet px-5 pt-4 pb-8">
        <div class="w-10 h-1.5 rounded-full bg-soft-100 mx-auto mb-4"></div>
        <button data-act="delete" class="btn btn-danger w-full !justify-start">Excluir tarefa</button>
        <button data-act="cancel" class="btn btn-secondary w-full !justify-start">Cancelar</button>
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
/** Escapa para uso dentro de um atributo HTML (ex.: aria-label com o título da tarefa). */
function escAttr(s) {
  return String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function taskCard(t, sub = { total: 0, done: 0 }) {
  const cat = getCategory(t.category);
  const done = t.done;
  // Prioridade: deriva de `priority` (fallback p/ tarefas antigas via `important`).
  const prio = getPriority(t.priority || (t.important ? 'alta' : 'media'));
  const hasSubs = sub.total > 0;
  const acao = done ? 'Reabrir' : 'Concluir';
  return `
  <div data-card="${t.id}"
    style="border-left:4px solid ${cat ? cat.dot : '#ffb3c1'}"
    class="lift group relative bg-white rounded-2xl shadow-card border border-soft-100 px-4 py-3.5 ${hasSubs ? 'mb-1' : 'mb-3'} flex items-center gap-3 select-none hover:border-soft-200">
    <button data-check="${t.id}" aria-label="${acao} tarefa ${escAttr(t.title)}"
      class="shrink-0 w-11 h-11 rounded-full border-2 grid place-items-center transition
             ${done ? 'bg-accent border-accent text-white' : 'border-soft-200 text-transparent hover:border-accent'}">
      <span class="${done ? 'check-pop' : ''}">${icons.check}</span>
    </button>
    <div class="min-w-0 flex-1">
      <p class="text-[15px] font-medium leading-tight ${done ? 'line-through text-muted' : 'text-bordeaux-900'}">${t.title}</p>
      <div class="flex items-center gap-2 mt-1 flex-wrap">
        ${formatDue(t) ? `<span class="inline-flex items-center gap-1 text-xs ${done ? 'text-muted' : (isOverdue(t) ? 'text-bordeaux-600 font-semibold' : 'text-bordeaux-700')}">${icons.clock}${formatDue(t)}</span>` : ''}
        ${t.isRecurring && t.recurrencePattern ? `<span class="inline-flex items-center gap-1 text-xs font-semibold text-bordeaux-700">${icons.repeat}${RECURRENCE_LABELS[t.recurrencePattern]}</span>` : ''}
        ${!done && prio.id !== 'media' ? `<span class="inline-flex items-center gap-1 text-xs font-semibold text-bordeaux-700">
          <span style="color:${prio.dot}">${icons.flag}</span>${prio.label}</span>` : ''}
        ${hasSubs ? `<span class="inline-flex items-center gap-1 text-xs font-semibold text-bordeaux-600">✨ ${sub.done}/${sub.total} passos</span>` : ''}
      </div>
    </div>
    <!-- excluir: sempre visível (não depende de hover), alvo de 44px e confirmação antes -->
    <button data-del="${t.id}" title="Excluir" aria-label="Excluir tarefa ${escAttr(t.title)}"
      class="grid place-items-center shrink-0 w-11 h-11 -mr-2 rounded-full text-muted hover:text-bordeaux-600 hover:bg-soft-100 transition">
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
  const acao = done ? 'Reabrir' : 'Concluir';
  return `
  <div data-card="${t.id}"${anima ? ` style="--i:${revealIndex}"` : ''}
    class="${anima ? 'reveal ' : ''}group relative flex items-center gap-2.5 bg-white/70 rounded-xl border border-soft-100 px-3 py-2 select-none hover:border-soft-200 transition">
    <button data-check="${t.id}" aria-label="${acao} tarefa ${escAttr(t.title)}"
      class="shrink-0 w-11 h-11 -m-3 grid place-items-center rounded-full">
      <span class="w-5 h-5 rounded-full border-2 grid place-items-center transition
             ${done ? 'bg-accent border-accent text-white' : 'border-soft-200 text-transparent'}">
        <span class="${done ? 'check-pop' : ''}">${icons.check}</span>
      </span>
    </button>
    <p class="flex-1 min-w-0 text-[13px] leading-tight ${done ? 'line-through text-muted' : 'text-bordeaux-800'}">${t.title}</p>
    ${formatDue(t) && !done ? `<span class="text-[11px] shrink-0 ${isOverdue(t) ? 'text-bordeaux-600 font-semibold' : 'text-bordeaux-700'}">${formatDue(t)}</span>` : ''}
    <button data-del="${t.id}" title="Excluir" aria-label="Excluir tarefa ${escAttr(t.title)}"
      class="grid place-items-center shrink-0 w-11 h-11 -my-3 -mr-2 rounded-full text-muted hover:text-bordeaux-600 hover:bg-soft-100 transition">
      ${icons.trash}
    </button>
  </div>`;
}

/* Cabeçalho + painel de uma seção. O botão é o gatilho do accordion (Enter e
   Espaço já valem por ser <button>); o painel recolhido some da tabulação. */
function sectionHTML(sec, total, cards) {
  const open = aberta[sec.id];
  return `
  <section class="mb-3" data-section="${sec.id}">
    <h2 class="m-0">
      <button type="button" data-acc="${sec.id}" id="acc-btn-${sec.id}" aria-expanded="${open}" aria-controls="acc-${sec.id}"
        class="w-full flex items-center gap-2 min-h-11 px-1 rounded-xl text-left">
        <span class="font-serif font-bold text-bordeaux-900 text-lg flex-1">${sec.title}</span>
        <span class="text-xs font-bold rounded-full px-2.5 py-0.5 bg-soft-100 text-bordeaux-900" aria-label="${total} tarefa${total > 1 ? 's' : ''}">${total}</span>
        <span class="acc-chevron text-bordeaux-700" aria-hidden="true">${icons.chevron}</span>
      </button>
    </h2>
    <div id="acc-${sec.id}" role="region" aria-labelledby="acc-btn-${sec.id}" class="acc-panel" data-open="${open}">
      <div class="acc-inner"><div class="acc-body">${cards}</div></div>
    </div>
  </section>`;
}

/* Esqueleto: a forma do que está por vir, enquanto o sync não responde. Mesmas
   medidas do cartão real (círculo de 44px, py-3.5) para a lista não "saltar"
   quando o conteúdo chega. Três bastam: mais que isso promete uma lista cheia
   que o servidor talvez não confirme. `.skeleton-wrap` só aparece após 200 ms. */
function skeletonList() {
  return `
  <div data-skeleton class="skeleton-wrap flex flex-col gap-3 pt-1" aria-busy="true">
    <p role="status" class="sr-only">Buscando suas tarefas…</p>
    ${[0, 1, 2].map(() => `
      <div aria-hidden="true" class="bg-white rounded-2xl shadow-card border border-soft-100 px-4 py-3.5 flex items-center gap-3"
        style="border-left:4px solid #ffccd5">
        <div class="skeleton-pulse shrink-0 w-11 h-11"></div>
        <div class="flex-1 min-w-0 flex flex-col gap-2">
          <div class="skeleton-pulse h-4 w-3/5"></div>
          <div class="skeleton-pulse h-3 w-2/5"></div>
        </div>
      </div>`).join('')}
    <p aria-hidden="true" class="text-center text-xs text-bordeaux-700 pt-1">Buscando suas tarefas…</p>
  </div>`;
}

/* Lista vazia. Duas situações diferentes: vazia de verdade (acolhe e convida a
   anotar) e "não consegui buscar" (sem servidor — não dá para afirmar que está
   tudo tranquilo). */
function emptyState(filter, semConexao) {
  const onde = filter === 'tudo' ? 'por aqui' : `em ${getCategory(filter)?.label || 'esta categoria'}`;
  const titulo = semConexao ? 'Sem conexão por enquanto.' : `Tudo tranquilo ${onde}. Respire fundo!`;
  const texto = semConexao
    ? 'Não consegui buscar suas tarefas agora. O que você criar fica salvo aqui e sincroniza depois.'
    : 'Quando algo vier à mente, é só anotar — eu guardo para você.';
  return `
  <div class="flex flex-col items-center text-center px-6 py-10 mt-2 mx-auto max-w-sm bg-bg border border-soft-100 rounded-xl2">
    <div class="w-20 h-20 rounded-full bg-white grid place-items-center mb-4 text-soft-300 [&>svg]:w-10 [&>svg]:h-10" aria-hidden="true">${icons.spark}</div>
    <h3 class="font-serif font-bold text-bordeaux-900 text-xl mb-2">${titulo}</h3>
    <p class="text-sm text-bordeaux-700 max-w-[260px] mb-5">${texto}</p>
    <button data-new class="btn btn-primary cta-lift">${icons.plus} Adicionar tarefa</button>
    ${semConexao ? '<button data-retry class="btn btn-secondary mt-2">Tentar de novo</button>' : ''}
  </div>`;
}

function initials(name) {
  const parts = name.trim().split(/\s+/);
  const txt = (parts[0]?.[0] || '') + (parts[1]?.[0] || '');
  return `<span class="font-serif font-bold text-sm">${txt.toUpperCase()}</span>`;
}

