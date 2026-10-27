/* ============================================================
   Kanban — quadros no estilo Trello
   Tela 1: os quadros (criar, abrir). Tela 2: o quadro aberto, com listas lado a
   lado, cartões arrastáveis (mouse: arrastar; toque: segurar e arrastar) e o
   cartão em detalhe (etiquetas, prazo, descrição, checklist, mover, enviar
   para a Agenda). Tudo fica no aparelho (js/kanban.js). Texto do usuário vai
   para o innerHTML sempre por `esc()`.
   ============================================================ */

import { h, $, $$, esc, toast, confirmDialog, icons } from '../ui.js';
import { playTap } from '../sound.js';
import { getUser, getUserId, addTask } from '../store.js';
import { todayKey, labelForKey } from '../dates.js';
import {
  LABELS, BOARD_COLORS, LIMITS, loadKanban, saveKanban, createBoard, getBoard, renameBoard, setBoardColor,
  removeBoard, addList, getList, renameList, removeList, moveList, addCard, findCard, updateCard, toggleLabel,
  removeCard, moveCard, addCheckItem, toggleCheckItem, removeCheckItem, checklistProgress, dueStatus,
  filterCards, countCards,
} from '../kanban.js';

const labelById = (id) => LABELS.find((l) => l.id === id);

const DUE_STYLE = {
  atrasado: 'bg-red-600 text-white',
  hoje: 'bg-amber-500 text-bordeaux-900',
  breve: 'bg-amber-100 text-amber-900',
  ok: 'bg-bg text-bordeaux-700',
};
const DUE_TEXT = { atrasado: 'atrasado', hoje: 'vence hoje', breve: 'vence em breve', ok: 'prazo' };

const ICON_X = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" class="w-5 h-5" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>';
const ICON_DOTS = '<svg viewBox="0 0 24 24" fill="currentColor" class="w-5 h-5" aria-hidden="true"><circle cx="5" cy="12" r="1.8"/><circle cx="12" cy="12" r="1.8"/><circle cx="19" cy="12" r="1.8"/></svg>';
const ICON_DESC = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" class="w-3.5 h-3.5" aria-hidden="true"><path d="M4 6h16M4 12h16M4 18h10"/></svg>';
const ICON_CHECK = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="w-3.5 h-3.5" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="4"/><path d="M8 12l3 3 5-6"/></svg>';

export function renderKanban() {
  const owner = getUserId() ?? getUser()?.email ?? 'local';
  let data = loadKanban(owner);
  const filtro = { text: '', label: null };

  const view = h('<div class="h-full flex flex-col relative" data-kanban></div>');

  const salvar = () => {
    if (!saveKanban(owner, data)) toast('Não consegui salvar no aparelho (armazenamento cheio?).', 3500);
  };

  // ============================================================
  // Tela 1 — quadros
  // ============================================================
  function telaQuadros() {
    view.innerHTML = `
      <div class="content-wrap lg:max-w-4xl flex-1 overflow-y-auto px-6 lg:px-0 pb-8">
        <header class="pt-12 lg:pt-8 pb-4">
          <h1 class="font-serif font-bold text-bordeaux-900 text-[26px] lg:text-3xl leading-tight">Kanban</h1>
          <p class="text-sm text-bordeaux-700 mt-1">Quadros com listas e cartões para acompanhar projetos de ponta a ponta. Ficam salvos neste aparelho.</p>
        </header>
        <ul class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3" aria-label="Seus quadros">
          ${data.boards.map((b) => `
            <li>
              <button data-abrir="${esc(b.id)}" class="w-full text-left rounded-xl2 overflow-hidden bg-white shadow-card border border-soft-100 hover:border-soft-200 transition focus-visible:ring-4 focus-visible:ring-accent/15 outline-none">
                <span class="block h-14" style="background:${esc(b.color)}"></span>
                <span class="block px-4 py-3">
                  <span class="block font-semibold text-bordeaux-900 truncate">${esc(b.title)}</span>
                  <span class="block text-xs text-muted mt-0.5">${b.lists.length} ${b.lists.length === 1 ? 'lista' : 'listas'} · ${countCards(b)} ${countCards(b) === 1 ? 'cartão' : 'cartões'}</span>
                </span>
              </button>
            </li>`).join('')}
          <li>
            <form id="kb-novo" class="h-full rounded-xl2 border-2 border-dashed border-soft-200 p-4 flex flex-col gap-3" novalidate>
              <label for="kb-novo-t" class="text-sm font-semibold text-bordeaux-900">Criar quadro</label>
              <input id="kb-novo-t" maxlength="${LIMITS.boardTitle}" autocomplete="off" placeholder="Ex.: Lançamento do site"
                class="w-full px-4 py-2.5 rounded-2xl bg-white border border-soft-100 text-bordeaux-900 placeholder-muted focus:border-accent focus:ring-4 focus:ring-accent/15 outline-none transition text-[15px]" />
              <div class="flex flex-wrap gap-2" role="radiogroup" aria-label="Cor do quadro">
                ${BOARD_COLORS.map((c, i) => `<button type="button" role="radio" data-cor="${c}" aria-checked="${i === 0}" aria-label="Cor ${i + 1}"
                  class="w-8 h-8 rounded-lg ring-offset-2 ${i === 0 ? 'ring-2 ring-bordeaux-900' : ''}" style="background:${c}"></button>`).join('')}
              </div>
              <button class="btn btn-primary" type="submit">Criar quadro</button>
            </form>
          </li>
        </ul>
        ${data.boards.length ? '' : '<p class="text-sm text-muted mt-4">Dica: cada quadro novo já vem com as listas "A fazer", "Fazendo" e "Feito". Dá para renomear, apagar e criar outras.</p>'}
      </div>`;
  }

  // ============================================================
  // Tela 2 — quadro aberto
  // ============================================================
  function telaQuadro(board) {
    view.innerHTML = `
      <header class="shrink-0 pl-16 pr-4 lg:px-8 pt-0.5 lg:pt-6 pb-3 flex flex-wrap items-center gap-x-3 gap-y-2">
        <button data-voltar class="inline-flex items-center gap-1 min-h-11 -ml-2 pr-2 text-sm font-semibold text-bordeaux-700 hover:text-bordeaux-900">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="w-5 h-5" aria-hidden="true"><path d="M15 18l-6-6 6-6"/></svg>Quadros
        </button>
        <span class="w-3 h-3 rounded-full shrink-0" style="background:${esc(board.color)}" aria-hidden="true"></span>
        <h1 id="kb-titulo" class="font-serif font-bold text-bordeaux-900 text-xl lg:text-2xl leading-tight min-w-0 truncate flex-1">${esc(board.title)}</h1>
        <div class="relative">
          <button data-menu-quadro aria-haspopup="menu" aria-expanded="false" aria-label="Opções do quadro" class="grid place-items-center w-11 h-11 rounded-full text-bordeaux-700 hover:bg-soft-100">${ICON_DOTS}</button>
        </div>
      </header>
      <div class="shrink-0 px-4 lg:px-8 pb-3 flex flex-wrap items-center gap-2">
        <input id="kb-busca" type="search" placeholder="Filtrar cartões" aria-label="Filtrar cartões por texto" value="${esc(filtro.text)}"
          class="min-w-0 flex-1 sm:flex-none sm:w-56 px-4 py-2 rounded-full bg-white border border-soft-100 text-bordeaux-900 placeholder-muted focus:border-accent focus:ring-4 focus:ring-accent/15 outline-none transition text-sm" />
        <div class="flex gap-1.5 overflow-x-auto no-scrollbar" role="group" aria-label="Filtrar por etiqueta">
          ${LABELS.map((l) => `<button data-filtro-etiqueta="${l.id}" aria-pressed="${filtro.label === l.id}" title="${l.name}"
            class="shrink-0 h-8 px-2.5 rounded-full text-[11px] font-semibold text-white transition ${filtro.label && filtro.label !== l.id ? 'opacity-40' : ''} ${filtro.label === l.id ? 'ring-2 ring-offset-1 ring-bordeaux-900' : ''}"
            style="background:${l.color}">${l.name}</button>`).join('')}
        </div>
      </div>
      <div id="kb-listas" class="kb-scroller flex-1 min-h-0 flex items-start gap-3 overflow-x-auto px-4 lg:px-8 pb-6" aria-label="Listas do quadro"></div>`;
    desenharListas(board);
  }

  function desenharListas(board) {
    const sc = $('#kb-listas', view);
    if (!sc) return;
    // Preserva a rolagem (horizontal do quadro e vertical de cada lista) ao redesenhar.
    const x = sc.scrollLeft;
    const ys = Object.fromEntries($$('[data-list-cards]', sc).map((u) => [u.dataset.listCards, u.scrollTop]));
    const filtrando = !!(filtro.text.trim() || filtro.label);
    const hoje = todayKey();

    sc.innerHTML = board.lists.map((l, i) => {
      const cartoes = filtrando ? filterCards(l, filtro) : l.cards;
      return `
      <section data-list="${esc(l.id)}" class="kb-list shrink-0 flex flex-col max-h-full rounded-2xl bg-soft-50 border border-soft-100" aria-label="Lista ${esc(l.title)}">
        <div class="flex items-center gap-1 pl-3 pr-1 pt-2 pb-1">
          <button data-titulo-lista class="flex-1 min-w-0 text-left font-semibold text-sm text-bordeaux-900 truncate min-h-9 px-1 rounded-lg hover:bg-white/70" title="Renomear lista">${esc(l.title)}</button>
          <span class="text-xs text-muted tabular-nums" aria-label="${l.cards.length} cartões">${filtrando ? `${cartoes.length}/` : ''}${l.cards.length}</span>
          <div class="relative">
            <button data-menu-lista aria-haspopup="menu" aria-expanded="false" aria-label="Opções da lista ${esc(l.title)}" class="grid place-items-center w-9 h-9 rounded-full text-bordeaux-700 hover:bg-white/70">${ICON_DOTS}</button>
          </div>
        </div>
        <ul data-list-cards="${esc(l.id)}" class="kb-cards flex-1 min-h-[8px] overflow-y-auto px-2 pb-1 flex flex-col gap-2">
          ${cartoes.map((c) => cartao(c, hoje)).join('')}
        </ul>
        <div class="px-2 pb-2 pt-1" data-composer-host>
          <button data-novo-cartao class="w-full flex items-center gap-1.5 min-h-10 px-2 rounded-xl text-sm font-medium text-bordeaux-700 hover:bg-white/70">
            <span aria-hidden="true" class="text-lg leading-none">+</span> Adicionar um cartão
          </button>
        </div>
        <span class="sr-only">Lista ${i + 1} de ${board.lists.length}</span>
      </section>`;
    }).join('') + `
      <div class="kb-list shrink-0" data-nova-lista-host>
        <button data-nova-lista class="w-full flex items-center gap-1.5 min-h-12 px-4 rounded-2xl bg-white/60 border border-dashed border-soft-200 text-sm font-semibold text-bordeaux-700 hover:bg-white">
          <span aria-hidden="true" class="text-lg leading-none">+</span> Adicionar outra lista
        </button>
      </div>`;

    sc.scrollLeft = x;
    $$('[data-list-cards]', sc).forEach((u) => { if (ys[u.dataset.listCards]) u.scrollTop = ys[u.dataset.listCards]; });
  }

  function cartao(c, hoje) {
    const st = dueStatus(c, hoje);
    const prog = checklistProgress(c);
    const etiquetas = c.labels.map(labelById).filter(Boolean);
    const selos = [
      st ? `<span class="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] font-semibold ${DUE_STYLE[st]}" title="${DUE_TEXT[st]}">${icons.clock}${esc(labelForKey(c.due, hoje))}</span>` : '',
      c.description ? `<span class="inline-flex items-center text-muted" title="Tem descrição">${ICON_DESC}</span>` : '',
      prog.total ? `<span class="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] font-semibold ${prog.done === prog.total ? 'bg-green-600 text-white' : 'text-muted'}" title="Checklist">${ICON_CHECK}${prog.done}/${prog.total}</span>` : '',
    ].join('');
    return `
      <li data-card="${esc(c.id)}" class="kb-card">
        <button data-abrir-cartao class="w-full text-left bg-white rounded-xl shadow-sm border border-soft-100 hover:border-soft-300 px-3 py-2 transition focus-visible:ring-4 focus-visible:ring-accent/15 outline-none">
          ${etiquetas.length ? `<span class="flex flex-wrap gap-1 mb-1.5">${etiquetas.map((l) => `<span class="px-1.5 rounded text-[10px] font-bold text-white leading-4" style="background:${l.color}">${l.name}</span>`).join('')}</span>` : ''}
          <span class="block text-sm text-bordeaux-900 break-words">${esc(c.title)}</span>
          ${selos ? `<span class="flex flex-wrap items-center gap-2 mt-1.5">${selos}</span>` : ''}
        </button>
      </li>`;
  }

  // ---------- Composers (adicionar cartão / lista, renomear lista) ----------
  function abrirComposerCartao(sec) {
    const host = $('[data-composer-host]', sec);
    host.innerHTML = `
      <form data-form-cartao class="flex flex-col gap-2" novalidate>
        <textarea rows="2" maxlength="${LIMITS.cardTitle}" aria-label="Título do cartão" placeholder="Insira um título para este cartão…"
          class="w-full px-3 py-2 rounded-xl bg-white border border-soft-100 text-sm text-bordeaux-900 placeholder-muted shadow-sm focus:border-accent focus:ring-4 focus:ring-accent/15 outline-none resize-none"></textarea>
        <div class="flex items-center gap-2">
          <button type="submit" class="btn btn-primary !py-2 !px-4 !text-sm">Adicionar cartão</button>
          <button type="button" data-fechar-composer aria-label="Cancelar" class="grid place-items-center w-10 h-10 rounded-full text-bordeaux-700 hover:bg-white/70">${ICON_X}</button>
        </div>
      </form>`;
    const ta = $('textarea', host);
    ta.focus();
    ta.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); host.querySelector('form').requestSubmit(); }
      if (e.key === 'Escape') { e.preventDefault(); desenharListas(quadroAtual()); }
    });
  }

  function abrirComposerLista() {
    const host = $('[data-nova-lista-host]', view);
    host.innerHTML = `
      <form data-form-lista class="rounded-2xl bg-soft-50 border border-soft-100 p-2 flex flex-col gap-2" novalidate>
        <input maxlength="${LIMITS.listTitle}" aria-label="Nome da lista" placeholder="Nome da lista" autocomplete="off"
          class="w-full px-3 py-2 rounded-xl bg-white border border-soft-100 text-sm text-bordeaux-900 placeholder-muted focus:border-accent focus:ring-4 focus:ring-accent/15 outline-none" />
        <div class="flex items-center gap-2">
          <button type="submit" class="btn btn-primary !py-2 !px-4 !text-sm">Adicionar lista</button>
          <button type="button" data-fechar-composer aria-label="Cancelar" class="grid place-items-center w-10 h-10 rounded-full text-bordeaux-700 hover:bg-white">${ICON_X}</button>
        </div>
      </form>`;
    const inp = $('input', host);
    inp.focus();
    inp.addEventListener('keydown', (e) => { if (e.key === 'Escape') { e.preventDefault(); desenharListas(quadroAtual()); } });
    $('#kb-listas', view).scrollLeft = 1e6;
  }

  /** Troca um texto por um campo de edição; Enter/sair salva, Esc cancela. */
  function editarInline(alvo, valor, max, salvarFn, classes) {
    const inp = h(`<input maxlength="${max}" class="${classes} px-2 py-1 rounded-lg bg-white border border-accent ring-4 ring-accent/15 outline-none text-bordeaux-900" />`);
    inp.value = valor;
    alvo.replaceWith(inp);
    inp.focus();
    inp.select();
    let feito = false;
    const fim = (ok) => {
      if (feito) return;
      feito = true;
      if (ok && inp.value.trim() && inp.value.trim() !== valor) { salvarFn(inp.value); salvar(); }
      render();
    };
    inp.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); fim(true); }
      if (e.key === 'Escape') { e.preventDefault(); fim(false); }
    });
    inp.addEventListener('blur', () => fim(true));
  }

  // ---------- Menus (quadro e lista) ----------
  function abrirMenu(botao, itens) {
    fecharMenus();
    botao.setAttribute('aria-expanded', 'true');
    const menu = h(`<div role="menu" data-menu class="absolute right-0 top-full mt-1 z-40 w-56 py-1.5 bg-white rounded-2xl shadow-card border border-soft-100">
      ${itens.map((it, i) => it ? `<button role="menuitem" data-i="${i}" ${it.disabled ? 'disabled' : ''}
        class="w-full text-left px-4 min-h-11 text-sm ${it.danger ? 'text-bordeaux-600' : 'text-bordeaux-900'} hover:bg-soft-50 disabled:opacity-40 disabled:cursor-not-allowed">${it.label}</button>`
        : '<hr class="my-1 border-soft-100" />').join('')}
    </div>`);
    botao.parentElement.appendChild(menu);
    const primeiros = $$('[role=menuitem]:not([disabled])', menu);
    if (primeiros[0]) primeiros[0].focus();
    menu.addEventListener('click', (e) => {
      const b = e.target.closest('[data-i]');
      if (!b) return;
      e.stopPropagation();
      fecharMenus();
      itens[Number(b.dataset.i)].run();
    });
    menu.addEventListener('keydown', (e) => {
      const lista = $$('[role=menuitem]:not([disabled])', menu);
      const i = lista.indexOf(document.activeElement);
      if (e.key === 'ArrowDown') { e.preventDefault(); lista[(i + 1) % lista.length].focus(); }
      if (e.key === 'ArrowUp') { e.preventDefault(); lista[(i - 1 + lista.length) % lista.length].focus(); }
      if (e.key === 'Escape') { e.preventDefault(); fecharMenus(); botao.focus(); }
    });
  }
  function fecharMenus() {
    $$('[data-menu]', view).forEach((m) => m.remove());
    $$('[aria-expanded="true"][aria-haspopup]', view).forEach((b) => b.setAttribute('aria-expanded', 'false'));
  }

  function menuQuadro(botao) {
    const board = quadroAtual();
    abrirMenu(botao, [
      { label: 'Renomear quadro', run: () => editarInline($('#kb-titulo', view), board.title, LIMITS.boardTitle, (v) => renameBoard(data, board.id, v), 'font-serif font-bold text-xl flex-1 min-w-0') },
      { label: 'Trocar a cor', run: () => {
        const i = BOARD_COLORS.indexOf(board.color);
        setBoardColor(data, board.id, BOARD_COLORS[(i + 1) % BOARD_COLORS.length]);
        salvar(); render();
      } },
      null,
      { label: 'Excluir quadro', danger: true, run: async () => {
        const ok = await confirmDialog({
          title: `Excluir "${board.title}"?`,
          message: `As ${board.lists.length} listas e os ${countCards(board)} cartões deste quadro serão apagados. Não dá para desfazer.`,
          confirmLabel: 'Excluir', cancelLabel: 'Manter', danger: true,
        });
        if (!ok) return;
        removeBoard(data, board.id);
        salvar(); render();
        toast('Quadro excluído.');
      } },
    ]);
  }

  function menuLista(botao, listId) {
    const board = quadroAtual();
    const i = board.lists.findIndex((l) => l.id === listId);
    const lista = board.lists[i];
    abrirMenu(botao, [
      { label: 'Adicionar cartão', run: () => abrirComposerCartao($(`[data-list="${CSS.escape(listId)}"]`, view)) },
      { label: 'Renomear lista', run: () => {
        const alvo = $(`[data-list="${CSS.escape(listId)}"] [data-titulo-lista]`, view);
        editarInline(alvo, lista.title, LIMITS.listTitle, (v) => renameList(board, listId, v), 'flex-1 min-w-0 text-sm font-semibold');
      } },
      { label: 'Mover para a esquerda', disabled: i === 0, run: () => { moveList(board, listId, i - 1); salvar(); render(); } },
      { label: 'Mover para a direita', disabled: i === board.lists.length - 1, run: () => { moveList(board, listId, i + 1); salvar(); render(); } },
      null,
      { label: 'Excluir lista', danger: true, run: async () => {
        if (lista.cards.length) {
          const ok = await confirmDialog({
            title: `Excluir a lista "${lista.title}"?`,
            message: `Os ${lista.cards.length} cartões dela também serão apagados.`,
            confirmLabel: 'Excluir', cancelLabel: 'Manter', danger: true,
          });
          if (!ok) return;
        }
        removeList(board, listId);
        salvar(); render();
      } },
    ]);
  }

  // ============================================================
  // Cartão em detalhe (diálogo)
  // ============================================================
  function abrirCartao(cardId) {
    const board = quadroAtual();
    if (!findCard(board, cardId)) return;
    const host = document.getElementById('device');
    const anterior = document.activeElement;
    const scrim = h('<div class="scrim grid place-items-center p-3 sm:p-6"></div>');
    const dlg = h(`<div role="dialog" aria-modal="true" aria-labelledby="kc-titulo"
      class="modal-card kb-dialog w-full max-w-[640px] max-h-[92dvh] overflow-y-auto bg-white rounded-xl2 shadow-card p-5 sm:p-6"></div>`);
    scrim.appendChild(dlg);
    host.appendChild(scrim);

    function pintar() {
      const f = findCard(board, cardId);
      if (!f) { fechar(); return; }
      const { card: c, list } = f;
      const prog = checklistProgress(c);
      const pct = prog.total ? Math.round((prog.done / prog.total) * 100) : 0;
      const st = dueStatus(c, todayKey());
      dlg.innerHTML = `
        <div class="flex items-start gap-2 mb-1">
          <textarea id="kc-titulo" rows="1" maxlength="${LIMITS.cardTitle}" aria-label="Título do cartão"
            class="flex-1 min-w-0 font-serif font-bold text-xl text-bordeaux-900 bg-transparent rounded-lg px-1 -ml-1 resize-none outline-none focus:bg-white focus:ring-4 focus:ring-accent/15">${esc(c.title)}</textarea>
          <button data-fechar aria-label="Fechar" class="shrink-0 grid place-items-center w-11 h-11 -mr-2 -mt-1 rounded-full text-bordeaux-700 hover:bg-soft-100">${ICON_X}</button>
        </div>
        <label class="flex flex-wrap items-center gap-2 text-sm text-bordeaux-700 mb-5">na lista
          <select id="kc-lista" class="px-3 py-1.5 rounded-full bg-bg border border-soft-100 text-bordeaux-900 text-sm font-semibold">
            ${board.lists.map((l) => `<option value="${esc(l.id)}" ${l.id === list.id ? 'selected' : ''}>${esc(l.title)}</option>`).join('')}
          </select>
        </label>

        <h3 class="text-xs font-bold uppercase tracking-wide text-muted mb-2">Etiquetas</h3>
        <div class="flex flex-wrap gap-2 mb-5">
          ${LABELS.map((l) => `<button data-etiqueta="${l.id}" aria-pressed="${c.labels.includes(l.id)}"
            class="min-h-9 px-3 rounded-lg text-xs font-bold text-white transition ${c.labels.includes(l.id) ? 'ring-2 ring-offset-2 ring-bordeaux-900' : 'opacity-45 hover:opacity-80'}"
            style="background:${l.color}">${c.labels.includes(l.id) ? '✓ ' : ''}${l.name}</button>`).join('')}
        </div>

        <h3 class="text-xs font-bold uppercase tracking-wide text-muted mb-2"><label for="kc-prazo">Prazo</label></h3>
        <div class="flex flex-wrap items-center gap-2 mb-5">
          <input id="kc-prazo" type="date" value="${c.due || ''}"
            class="px-3 py-2 rounded-xl bg-white border border-soft-100 text-bordeaux-900 text-sm focus:border-accent focus:ring-4 focus:ring-accent/15 outline-none" />
          ${c.due ? `<span class="px-2 py-1 rounded text-xs font-semibold ${DUE_STYLE[st]}">${DUE_TEXT[st]}</span>
            <button data-limpar-prazo class="text-sm text-bordeaux-700 underline min-h-9 px-1">Remover prazo</button>` : ''}
        </div>

        <h3 class="text-xs font-bold uppercase tracking-wide text-muted mb-2"><label for="kc-desc">Descrição</label></h3>
        <textarea id="kc-desc" rows="4" maxlength="${LIMITS.description}" placeholder="Adicione detalhes, links, combinados…"
          class="w-full px-3 py-2 rounded-xl bg-bg border border-soft-100 text-sm text-bordeaux-900 placeholder-muted focus:bg-white focus:border-accent focus:ring-4 focus:ring-accent/15 outline-none mb-5">${esc(c.description)}</textarea>

        <h3 class="text-xs font-bold uppercase tracking-wide text-muted mb-2">Checklist ${prog.total ? `<span class="normal-case font-semibold">· ${prog.done}/${prog.total}</span>` : ''}</h3>
        ${prog.total ? `<div class="h-1.5 rounded-full bg-soft-100 mb-2 overflow-hidden" role="progressbar" aria-label="Progresso do checklist" aria-valuenow="${pct}" aria-valuemin="0" aria-valuemax="100">
          <div class="h-full ${pct === 100 ? 'bg-green-600' : 'bg-accent'}" style="width:${pct}%"></div></div>` : ''}
        <ul class="flex flex-col gap-1 mb-2">
          ${c.checklist.map((it) => `
            <li class="flex items-center gap-2 group">
              <label class="flex-1 min-w-0 flex items-center gap-2.5 min-h-10 cursor-pointer">
                <input type="checkbox" data-item="${esc(it.id)}" ${it.done ? 'checked' : ''} class="w-5 h-5 accent-[var(--color-accent)] shrink-0" />
                <span class="text-sm break-words ${it.done ? 'line-through text-muted' : 'text-bordeaux-900'}">${esc(it.text)}</span>
              </label>
              <button data-remover-item="${esc(it.id)}" aria-label="Remover item ${esc(it.text)}" class="shrink-0 grid place-items-center w-9 h-9 rounded-full text-muted hover:bg-soft-100">${icons.trash}</button>
            </li>`).join('')}
        </ul>
        <form data-form-item class="flex gap-2 mb-6" novalidate>
          <input maxlength="${LIMITS.checkItem}" aria-label="Novo item do checklist" placeholder="Adicionar um item" autocomplete="off"
            class="min-w-0 flex-1 px-3 py-2 rounded-xl bg-white border border-soft-100 text-sm text-bordeaux-900 placeholder-muted focus:border-accent focus:ring-4 focus:ring-accent/15 outline-none" />
          <button class="btn btn-secondary border border-soft-200 !py-2 !px-4 !text-sm" type="submit">Adicionar</button>
        </form>

        <div class="flex flex-wrap gap-2 pt-4 border-t border-soft-100">
          <button data-agenda class="btn btn-primary !text-sm">${icons.calendar.replace('w-6 h-6', 'w-4 h-4')} Adicionar à agenda</button>
          <button data-excluir class="btn btn-danger !text-sm">${icons.trash} Excluir cartão</button>
        </div>`;
      autoAltura($('#kc-titulo', dlg));
    }

    function autoAltura(ta) {
      ta.style.height = 'auto';
      ta.style.height = ta.scrollHeight + 'px';
    }

    function fechar() {
      document.removeEventListener('keydown', teclas, true);
      scrim.remove();
      render();
      const volta = $(`[data-card="${CSS.escape(cardId)}"] [data-abrir-cartao]`, view);
      if (volta) volta.focus();
      else if (anterior && document.contains(anterior)) anterior.focus();
    }

    function teclas(e) {
      if (e.key === 'Escape' && !document.querySelector('[role=alertdialog]')) { e.preventDefault(); fechar(); return; }
      if (e.key === 'Tab') {
        const foco = $$('button, input, textarea, select', dlg).filter((el) => !el.disabled && el.offsetParent !== null);
        if (!foco.length) return;
        const [primeiro, ultimo] = [foco[0], foco[foco.length - 1]];
        if (e.shiftKey && document.activeElement === primeiro) { e.preventDefault(); ultimo.focus(); }
        else if (!e.shiftKey && document.activeElement === ultimo) { e.preventDefault(); primeiro.focus(); }
      }
    }
    document.addEventListener('keydown', teclas, true);
    scrim.addEventListener('click', (e) => { if (e.target === scrim) fechar(); });

    // Título e descrição salvam ao sair do campo (e o título também no Enter).
    dlg.addEventListener('focusout', (e) => {
      if (e.target.id === 'kc-titulo') {
        if (!e.target.value.trim()) { e.target.value = findCard(board, cardId).card.title; return; }
        updateCard(board, cardId, { title: e.target.value }); salvar();
      } else if (e.target.id === 'kc-desc') {
        updateCard(board, cardId, { description: e.target.value }); salvar();
      }
    });
    // Salva enquanto digita: fechar com Esc ou tocando fora não pode perder o texto.
    dlg.addEventListener('input', (e) => {
      if (e.target.id === 'kc-titulo') {
        autoAltura(e.target);
        if (e.target.value.trim()) { updateCard(board, cardId, { title: e.target.value }); salvar(); }
      } else if (e.target.id === 'kc-desc') {
        updateCard(board, cardId, { description: e.target.value }); salvar();
      }
    });
    dlg.addEventListener('keydown', (e) => {
      if (e.target.id === 'kc-titulo' && e.key === 'Enter') { e.preventDefault(); e.target.blur(); }
    });

    dlg.addEventListener('change', (e) => {
      if (e.target.id === 'kc-lista') {
        const destino = getList(board, e.target.value);
        moveCard(board, cardId, destino.id, destino.cards.length);
        salvar(); toast(`Movido para "${esc(destino.title)}".`);
        pintar(); $('#kc-lista', dlg).focus();
      } else if (e.target.id === 'kc-prazo') {
        updateCard(board, cardId, { due: e.target.value || null });
        salvar(); pintar(); $('#kc-prazo', dlg).focus();
      } else if (e.target.dataset.item) {
        toggleCheckItem(board, cardId, e.target.dataset.item);
        salvar(); const id = e.target.dataset.item; pintar();
        const cb = $(`[data-item="${CSS.escape(id)}"]`, dlg); if (cb) cb.focus();
      }
    });

    dlg.addEventListener('submit', (e) => {
      e.preventDefault();
      const inp = $('input', e.target);
      if (!addCheckItem(board, cardId, inp.value)) { inp.focus(); return; }
      salvar(); pintar();
      $('[data-form-item] input', dlg).focus();
    });

    dlg.addEventListener('click', async (e) => {
      const b = e.target.closest('button');
      if (!b) return;
      if (b.matches('[data-fechar]')) { fechar(); return; }
      if (b.dataset.etiqueta) {
        toggleLabel(board, cardId, b.dataset.etiqueta);
        salvar(); const id = b.dataset.etiqueta; pintar();
        $(`[data-etiqueta="${id}"]`, dlg).focus();
      } else if (b.matches('[data-limpar-prazo]')) {
        updateCard(board, cardId, { due: null }); salvar(); pintar(); $('#kc-prazo', dlg).focus();
      } else if (b.dataset.removerItem) {
        removeCheckItem(board, cardId, b.dataset.removerItem); salvar(); pintar();
        $('[data-form-item] input', dlg).focus();
      } else if (b.matches('[data-agenda]')) {
        const { card: c } = findCard(board, cardId);
        b.disabled = true;
        try {
          await addTask({ title: c.title, category: 'trabalho', dueDate: c.due || null });
          toast(c.due ? `Na agenda para ${esc(labelForKey(c.due))} ✨` : 'Adicionado à agenda, sem data ✨');
        } catch (_) {
          toast('Não consegui adicionar à agenda agora.');
        }
        b.disabled = false;
      } else if (b.matches('[data-excluir]')) {
        const ok = await confirmDialog({ title: 'Excluir este cartão?', message: 'Não dá para desfazer.', confirmLabel: 'Excluir', cancelLabel: 'Manter', danger: true });
        if (!ok) return;
        removeCard(board, cardId); salvar(); fechar();
        toast('Cartão excluído.');
      }
    });

    pintar();
    $('[data-fechar]', dlg).focus();
  }

  // ============================================================
  // Arrastar e soltar cartões (Pointer Events: mouse, caneta e toque)
  // Mouse: arrasta depois de 6 px. Toque: segurar ~0,3 s e arrastar (assim um
  // deslize rápido continua rolando a tela). Teclado: "na lista" no cartão.
  // ============================================================
  let pend = null;      // pressionado, ainda não arrastando
  let drag = null;      // arrastando
  let soltouAgora = 0;  // evita abrir o cartão no clique que encerra o arraste

  function inicioArraste(e) {
    const li = e.target.closest('[data-card]');
    if (!li || e.button > 0 || filtro.text.trim() || filtro.label) return;
    pend = { li, x: e.clientX, y: e.clientY, tipo: e.pointerType, id: e.pointerId, timer: null };
    if (e.pointerType !== 'mouse') {
      pend.timer = setTimeout(() => { if (pend) comecar(pend.x, pend.y); }, 300);
    }
    window.addEventListener('pointermove', mover, { passive: false });
    window.addEventListener('pointerup', terminar);
    window.addEventListener('pointercancel', cancelar);
  }

  function comecar(x, y) {
    const { li } = pend;
    const r = li.getBoundingClientRect();
    const ghost = li.cloneNode(true);
    ghost.classList.add('kb-ghost');
    ghost.removeAttribute('data-card');
    Object.assign(ghost.style, { width: r.width + 'px', left: r.left + 'px', top: r.top + 'px' });
    document.body.appendChild(ghost);
    const ph = document.createElement('li');
    ph.className = 'kb-placeholder';
    ph.style.height = r.height + 'px';
    li.after(ph);
    li.classList.add('kb-dragging');
    drag = { li, ghost, ph, dx: x - r.left, dy: y - r.top, x, y, raf: 0, cardId: li.dataset.card };
    pend = null;
    if (navigator.vibrate) try { navigator.vibrate(12); } catch (_) { /* opcional */ }
    view.classList.add('kb-is-dragging');
    rolarSozinho();
  }

  function mover(e) {
    if (pend && !drag) {
      const dist = Math.hypot(e.clientX - pend.x, e.clientY - pend.y);
      if (pend.tipo === 'mouse') {
        if (dist > 6) comecar(e.clientX, e.clientY);
      } else if (dist > 8) {
        // Mexeu antes do tempo: é rolagem, não arraste.
        clearTimeout(pend.timer); pend = null; limparEscutas();
        return;
      } else {
        pend.x = e.clientX; pend.y = e.clientY;
      }
    }
    if (!drag) return;
    e.preventDefault();
    drag.x = e.clientX; drag.y = e.clientY;
    drag.ghost.style.left = (drag.x - drag.dx) + 'px';
    drag.ghost.style.top = (drag.y - drag.dy) + 'px';
    posicionar();
  }

  /** Coloca o espaço reservado na lista sob o ponteiro, antes do 1º cartão cujo meio está abaixo dele. */
  function posicionar() {
    const el = document.elementFromPoint(drag.x, drag.y);
    const sec = el && el.closest('[data-list]');
    if (!sec || !view.contains(sec)) return;
    const ul = $('[data-list-cards]', sec);
    const itens = [...ul.children].filter((n) => n.matches('[data-card]') && n !== drag.li);
    const antes = itens.find((n) => { const r = n.getBoundingClientRect(); return drag.y < r.top + r.height / 2; });
    if (antes) { if (drag.ph.nextSibling !== antes) ul.insertBefore(drag.ph, antes); }
    else if (ul.lastElementChild !== drag.ph) ul.appendChild(drag.ph);
  }

  /** Rola o quadro (lados) e a lista (cima/baixo) quando o cartão chega perto da borda. */
  function rolarSozinho() {
    if (!drag) return;
    const sc = $('#kb-listas', view);
    const r = sc.getBoundingClientRect();
    const borda = 48;
    if (drag.x < r.left + borda) sc.scrollLeft -= 14;
    else if (drag.x > r.right - borda) sc.scrollLeft += 14;
    const ul = drag.ph.parentElement;
    if (ul) {
      const u = ul.getBoundingClientRect();
      if (drag.y < u.top + borda) ul.scrollTop -= 10;
      else if (drag.y > u.bottom - borda) ul.scrollTop += 10;
    }
    posicionar();
    drag.raf = requestAnimationFrame(rolarSozinho);
  }

  function terminar() {
    if (pend) { clearTimeout(pend.timer); pend = null; }
    limparEscutas();
    if (!drag) return;
    const { ph, cardId, li } = drag;
    const sec = ph.closest('[data-list]');
    const destino = sec && sec.dataset.list;
    // Posição final = quantos cartões (fora o arrastado) ficam antes do espaço reservado.
    let indice = 0;
    for (const n of ph.parentElement.children) {
      if (n === ph) break;
      if (n.matches('[data-card]') && n !== li) indice++;
    }
    encerrarVisual();
    soltouAgora = Date.now();
    if (destino && moveCard(quadroAtual(), cardId, destino, indice)) salvar();
    desenharListas(quadroAtual());
  }

  function cancelar() {
    if (pend) { clearTimeout(pend.timer); pend = null; }
    limparEscutas();
    if (drag) { encerrarVisual(); desenharListas(quadroAtual()); }
  }

  function encerrarVisual() {
    cancelAnimationFrame(drag.raf);
    drag.ghost.remove();
    drag.ph.remove();
    drag.li.classList.remove('kb-dragging');
    view.classList.remove('kb-is-dragging');
    drag = null;
  }

  function limparEscutas() {
    window.removeEventListener('pointermove', mover);
    window.removeEventListener('pointerup', terminar);
    window.removeEventListener('pointercancel', cancelar);
  }

  // No toque, depois que o arraste começou, impede a página de rolar junto.
  view.addEventListener('touchmove', (e) => { if (drag) e.preventDefault(); }, { passive: false });
  view.addEventListener('contextmenu', (e) => { if (drag || pend) e.preventDefault(); });
  view.addEventListener('pointerdown', inicioArraste);

  // ============================================================
  // Eventos
  // ============================================================
  const quadroAtual = () => getBoard(data, data.activeBoardId);

  view.addEventListener('click', (e) => {
    const t = e.target;
    if (!t.closest('[data-menu]') && !t.closest('[aria-haspopup]')) fecharMenus();

    const abrir = t.closest('[data-abrir]');
    if (abrir) {
      playTap();
      data.activeBoardId = abrir.dataset.abrir; salvar(); render();
      return;
    }
    const cor = t.closest('[data-cor]');
    if (cor) {
      $$('[data-cor]', view).forEach((b) => {
        const on = b === cor;
        b.setAttribute('aria-checked', String(on));
        b.classList.toggle('ring-2', on); b.classList.toggle('ring-bordeaux-900', on);
      });
      return;
    }
    if (t.closest('[data-voltar]')) {
      playTap();
      data.activeBoardId = null; salvar(); render();
      return;
    }
    const menuQ = t.closest('[data-menu-quadro]');
    if (menuQ) { if (menuQ.getAttribute('aria-expanded') === 'true') fecharMenus(); else menuQuadro(menuQ); return; }
    const menuL = t.closest('[data-menu-lista]');
    if (menuL) {
      if (menuL.getAttribute('aria-expanded') === 'true') fecharMenus();
      else menuLista(menuL, menuL.closest('[data-list]').dataset.list);
      return;
    }
    const etq = t.closest('[data-filtro-etiqueta]');
    if (etq) {
      filtro.label = filtro.label === etq.dataset.filtroEtiqueta ? null : etq.dataset.filtroEtiqueta;
      const foco = etq.dataset.filtroEtiqueta;
      render();
      $(`[data-filtro-etiqueta="${foco}"]`, view).focus();
      return;
    }
    const tituloLista = t.closest('[data-titulo-lista]');
    if (tituloLista) {
      const board = quadroAtual();
      const id = tituloLista.closest('[data-list]').dataset.list;
      editarInline(tituloLista, getList(board, id).title, LIMITS.listTitle, (v) => renameList(board, id, v), 'flex-1 min-w-0 text-sm font-semibold');
      return;
    }
    if (t.closest('[data-novo-cartao]')) { abrirComposerCartao(t.closest('[data-list]')); return; }
    if (t.closest('[data-nova-lista]')) { abrirComposerLista(); return; }
    if (t.closest('[data-fechar-composer]')) { desenharListas(quadroAtual()); return; }
    const card = t.closest('[data-abrir-cartao]');
    if (card) {
      if (Date.now() - soltouAgora < 350) return;
      abrirCartao(card.closest('[data-card]').dataset.card);
    }
  });

  view.addEventListener('submit', (e) => {
    e.preventDefault();
    const f = e.target;
    try {
      if (f.id === 'kb-novo') {
        const titulo = $('#kb-novo-t', view).value;
        if (!titulo.trim()) { toast('Dê um nome ao quadro.'); $('#kb-novo-t', view).focus(); return; }
        const cor = ($('[data-cor][aria-checked="true"]', view) || {}).dataset?.cor;
        const b = createBoard(data, titulo, cor);
        data.activeBoardId = b.id;
        salvar(); render();
        toast('Quadro criado ✨');
      } else if (f.matches('[data-form-cartao]')) {
        const ta = $('textarea', f);
        if (!ta.value.trim()) { ta.focus(); return; }
        const listId = f.closest('[data-list]').dataset.list;
        addCard(quadroAtual(), listId, ta.value);
        salvar();
        desenharListas(quadroAtual());
        // Como no Trello: o campo continua aberto para o próximo cartão.
        const sec = $(`[data-list="${CSS.escape(listId)}"]`, view);
        abrirComposerCartao(sec);
        const ul = $('[data-list-cards]', sec); ul.scrollTop = ul.scrollHeight;
      } else if (f.matches('[data-form-lista]')) {
        const inp = $('input', f);
        if (!inp.value.trim()) { inp.focus(); return; }
        addList(quadroAtual(), inp.value);
        salvar();
        desenharListas(quadroAtual());
        abrirComposerLista();
      }
    } catch (err) {
      toast(err.message === 'limite' ? 'Limite atingido para este quadro.' : 'Confira o texto e tente de novo.');
    }
  });

  view.addEventListener('input', (e) => {
    if (e.target.id === 'kb-busca') {
      filtro.text = e.target.value;
      desenharListas(quadroAtual());
    }
  });

  view.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && $('[data-menu]', view)) { fecharMenus(); }
  });

  function render() {
    const board = quadroAtual();
    if (board) telaQuadro(board);
    else telaQuadros();
  }

  render();
  return view;
}
