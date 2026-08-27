/* ============================================================
   taskSheet.js — Bottom Sheet de Nova Tarefa + Modal IA
   Fluxo: digitar texto natural → IA processa → sugestão preventiva
   ============================================================ */

import { h, $, $$, icons, toast, isDesktop } from '../ui.js';
import { CATEGORIES, PRIORITIES, addTask, reachedFreeLimit } from '../store.js';
import { apiSmartTask, decomposeTask } from '../api.js';
import { todayKey, resolveDue } from '../dates.js';

/**
 * Abre o bottom sheet de nova tarefa.
 * @param {object} app contexto do app
 * @param {function} onDone callback chamado após criar tarefa(s) — para re-render
 */
export function openTaskSheet(app, onDone) {
  // Gatilho do paywall: limite do plano gratuito
  if (reachedFreeLimit()) {
    app.navigate('paywall', { trigger: 'limit' });
    return;
  }

  const host = document.getElementById('device');
  const desktop = isDesktop();
  let selectedCat = 'casa';
  let due = '';
  let selectedPriority = 'media';
  // Data mínima do seletor = hoje (evita agendar no passado).
  // todayKey() usa o fuso local: toISOString() devolveria o dia seguinte
  // à noite no Brasil, bloqueando a escolha do próprio dia de hoje.
  const todayISO = todayKey();

  // Desktop → modal central (foco no teclado) | Mobile → bottom sheet (foco no polegar)
  const scrim = h(`<div class="scrim ${desktop ? 'grid place-items-center px-6' : ''}"></div>`);
  const sheet = h(`
    <div class="${desktop ? 'modal-card w-full max-w-[440px] rounded-xl2 bg-white px-6 pt-6 pb-6' : 'sheet px-5 pt-3 pb-6'}">
      ${desktop ? '' : '<div class="w-10 h-1.5 rounded-full bg-soft-100 mx-auto mb-4"></div>'}
      <div class="flex items-center gap-2.5 mb-4">
        <span class="w-9 h-9 rounded-full bg-accent/15 text-accent grid place-items-center shrink-0">${icons.spark}</span>
        <div class="min-w-0">
          <h2 class="font-serif font-bold text-bordeaux-900 text-xl leading-none">Nova tarefa</h2>
          <p class="text-xs text-bordeaux-700 mt-1">Escreva do seu jeito — a IA cuida dos detalhes ✨</p>
        </div>
      </div>

      <textarea id="task-input" rows="2"
        class="w-full px-4 py-3 rounded-2xl bg-white border border-soft-100 text-bordeaux-900 placeholder-soft-300
               focus:border-accent focus:ring-4 focus:ring-accent/15 outline-none transition resize-none text-[15px]"
        placeholder="Ex: Vacina do Léo dia 15 ou Comprar presentes de aniversário amanhã..."></textarea>

      <!-- categorias -->
      <p class="text-xs font-medium text-bordeaux-700 mt-4 mb-2">Categoria</p>
      <div class="flex flex-wrap gap-2">
        ${CATEGORIES.map((c) => `
          <button data-cat="${c.id}"
            class="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium border transition
                   ${c.id === selectedCat ? 'bg-accent text-white border-accent' : 'bg-white text-bordeaux-700 border-soft-100'}">
            <span class="w-2 h-2 rounded-full" style="background:${c.dot}"></span>${c.label}
          </button>`).join('')}
      </div>

      <!-- data rápida -->
      <p class="text-xs font-medium text-bordeaux-700 mt-4 mb-2">Quando</p>
      <div class="flex flex-wrap gap-2">
        ${['Hoje', 'Amanhã', 'Esta semana'].map((d) => `
          <button data-due="${d}"
            class="px-3 py-1.5 rounded-full text-sm font-medium border bg-white text-bordeaux-700 border-soft-100 transition">
            ${d}
          </button>`).join('')}
      </div>

      <!-- data específica (calendário) + horário -->
      <div class="mt-2 flex items-center gap-2">
        <span class="text-bordeaux-700 shrink-0">${icons.calendar}</span>
        <input id="task-date" type="date" min="${todayISO}"
          class="flex-1 min-w-0 px-4 py-2.5 rounded-2xl bg-white border border-soft-100 text-bordeaux-900
                 focus:border-accent focus:ring-4 focus:ring-accent/15 outline-none transition text-[15px]" />
        <input id="task-time" type="time" aria-label="Horário"
          class="w-[7.5rem] shrink-0 px-3 py-2.5 rounded-2xl bg-white border border-soft-100 text-bordeaux-900
                 focus:border-accent focus:ring-4 focus:ring-accent/15 outline-none transition text-[15px]" />
      </div>

      <!-- prioridade -->
      <p class="text-xs font-medium text-bordeaux-700 mt-4 mb-2">Prioridade</p>
      <div class="flex gap-2">
        ${PRIORITIES.map((p) => `
          <button data-prio="${p.id}"
            class="flex-1 px-3 py-1.5 rounded-full text-sm font-medium border transition flex items-center justify-center gap-1.5
                   ${p.id === selectedPriority ? 'bg-accent text-white border-accent' : 'bg-white text-bordeaux-700 border-soft-100'}">
            <span class="w-2 h-2 rounded-full" style="background:${p.dot}"></span>${p.label}
          </button>`).join('')}
      </div>

      <button id="save-task"
        class="mt-6 w-full py-3.5 rounded-full bg-accent hover:bg-accent-hover text-white font-semibold shadow-fab
               active:scale-[.98] transition flex items-center justify-center gap-2">
        <span id="save-label">Salvar</span>
        ${icons.spark}
      </button>
    </div>
  `);

  host.appendChild(scrim);
  host.appendChild(sheet);

  const input = $('#task-input', sheet);
  setTimeout(() => input.focus(), 80);

  // seleção de categoria
  $$('[data-cat]', sheet).forEach((b) =>
    b.addEventListener('click', () => {
      selectedCat = b.dataset.cat;
      $$('[data-cat]', sheet).forEach((x) => {
        const on = x.dataset.cat === selectedCat;
        x.className = `flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium border transition ${on ? 'bg-accent text-white border-accent' : 'bg-white text-bordeaux-700 border-soft-100'}`;
      });
    })
  );

  const dateInput = $('#task-date', sheet);
  const timeInput = $('#task-time', sheet);

  // seleção de data rápida (atalhos). Escolher um atalho limpa o calendário.
  $$('[data-due]', sheet).forEach((b) =>
    b.addEventListener('click', () => {
      due = due === b.dataset.due ? '' : b.dataset.due;
      if (due) dateInput.value = '';
      $$('[data-due]', sheet).forEach((x) => {
        const on = x.dataset.due === due;
        x.className = `px-3 py-1.5 rounded-full text-sm font-medium border transition ${on ? 'bg-accent text-white border-accent' : 'bg-white text-bordeaux-700 border-soft-100'}`;
      });
    })
  );

  // escolher uma data específica desmarca os atalhos rápidos.
  dateInput.addEventListener('change', () => {
    if (!dateInput.value) return;
    due = '';
    $$('[data-due]', sheet).forEach((x) => {
      x.className = 'px-3 py-1.5 rounded-full text-sm font-medium border transition bg-white text-bordeaux-700 border-soft-100';
    });
  });

  // seleção de prioridade
  $$('[data-prio]', sheet).forEach((b) =>
    b.addEventListener('click', () => {
      selectedPriority = b.dataset.prio;
      $$('[data-prio]', sheet).forEach((x) => {
        const p = PRIORITIES.find((it) => it.id === x.dataset.prio);
        const on = x.dataset.prio === selectedPriority;
        x.className = `flex-1 px-3 py-1.5 rounded-full text-sm font-medium border transition flex items-center justify-center gap-1.5 ${on ? 'bg-accent text-white border-accent' : 'bg-white text-bordeaux-700 border-soft-100'}`;
        x.innerHTML = `<span class="w-2 h-2 rounded-full" style="background:${p.dot}"></span>${p.label}`;
      });
    })
  );

  function close() {
    sheet.classList.add('closing');
    scrim.style.animation = 'fadeOut .25s ease both';
    setTimeout(() => { sheet.remove(); scrim.remove(); }, 250);
  }
  scrim.addEventListener('click', close);

  $('#save-task', sheet).addEventListener('click', async () => {
    const text = input.value.trim();
    if (!text) { input.focus(); return; }

    const btn = $('#save-task', sheet);
    const label = $('#save-label', sheet);
    btn.disabled = true;
    label.textContent = 'Pensando…';
    btn.classList.add('opacity-80');

    // Aha Moment: usa a IA real do backend (/tasks/smart). Se estiver
    // offline ou a IA falhar, cai na heurística client-side decomposeTask().
    let result = null;
    try {
      result = await apiSmartTask(text);
    } catch (_) { /* tenta o fallback abaixo */ }
    if (!result) {
      try {
        result = decomposeTask(text);
      } catch (_) {
        result = { title: text, category: selectedCat, due, subtasks: [], suggestion: null };
      }
    }

    // A escolha manual do usuário tem prioridade sobre o palpite da IA.
    const category = selectedCat !== 'casa' ? selectedCat : (result.category || 'casa');
    // Data: escolha no calendário > atalho rápido > palpite da IA.
    const finalDueDate =
      dateInput.value || (due ? resolveDue(due) : null) || result.dueDate || null;
    // Horário: escolha manual > palpite da IA.
    const finalDueTime = timeInput.value || result.dueTime || null;

    // Cria e persiste a tarefa principal (aguarda para reconciliar o id real).
    // Guardamos a tarefa-mãe para fixar as sugestões da IA como subtarefas.
    const parent = await addTask({
      title: result.title || text,
      category,
      dueDate: finalDueDate,
      dueTime: finalDueTime,
      priority: selectedPriority,
    });

    close();
    onDone && onDone();

    // Aha Moment: se houver subtarefas/lembrete sugeridos, mostra o modal
    if ((result.subtasks && result.subtasks.length) || result.suggestion) {
      setTimeout(() => openAiModal(app, {
        ...result,
        category,
        dueDate: finalDueDate,
        dueTime: finalDueTime,
        parentId: parent.id,
      }, onDone), 300);
    } else {
      toast('Tarefa adicionada ✨');
    }
  });
}

/* ---------------- Modal "Aha Moment" da IA ---------------- */
function openAiModal(app, result, onDone) {
  const host = document.getElementById('device');
  const subs = result.subtasks || [];
  const sug = result.suggestion;

  const scrim = h('<div class="scrim grid place-items-center px-6"></div>');
  const card = h(`
    <div class="modal-card relative w-full max-w-[340px] bg-white rounded-xl2 p-6 shadow-card">
      <div class="flex items-center gap-2 mb-3">
        <span class="w-9 h-9 rounded-full bg-accent text-white grid place-items-center shadow-fab">${icons.spark}</span>
        <h3 class="font-serif font-bold text-bordeaux-900 text-lg">A IA pensou nisso por você</h3>
      </div>

      ${subs.length ? `
        <p class="text-sm text-bordeaux-700 mb-2">Posso dividir em passos menores:</p>
        <div class="flex flex-col gap-2 mb-4">
          ${subs.map((s) => `
            <label class="flex items-center gap-3 bg-bg rounded-2xl px-3 py-2.5 cursor-pointer">
              <input type="checkbox" data-sub="${encodeURIComponent(s)}" checked
                class="w-5 h-5 accent-accent rounded" />
              <span class="text-sm text-bordeaux-900">${s}</span>
            </label>`).join('')}
        </div>` : ''}

      ${sug ? `
        <div class="bg-soft-100/60 rounded-2xl p-3 mb-4">
          <p class="text-sm text-bordeaux-800">${sug.text}</p>
        </div>` : ''}

      <div class="flex flex-col gap-2">
        <button id="ai-accept"
          class="w-full py-3 rounded-full bg-accent hover:bg-accent-hover text-white font-semibold shadow-fab active:scale-[.98] transition">
          Sim, adicionar
        </button>
        <button id="ai-decline"
          class="w-full py-3 rounded-full bg-transparent text-bordeaux-700 font-medium active:scale-[.98] transition">
          Não, obrigada
        </button>
      </div>
    </div>
  `);

  scrim.appendChild(card);
  host.appendChild(scrim);

  function close() {
    scrim.style.animation = 'fadeOut .2s ease both';
    setTimeout(() => scrim.remove(), 200);
  }

  $('#ai-decline', card).addEventListener('click', close);
  $('#ai-accept', card).addEventListener('click', async () => {
    const btn = $('#ai-accept', card);
    btn.disabled = true;
    btn.classList.add('opacity-80');

    // adiciona as subtarefas marcadas, FIXADAS como filhas da tarefa-mãe
    // (herdam a data da mãe, para caírem no mesmo dia do calendário)
    for (const cb of $$('[data-sub]:checked', card)) {
      await addTask({
        title: decodeURIComponent(cb.dataset.sub),
        category: result.category,
        dueDate: result.dueDate || null,
        dueTime: result.dueTime || null,
        parentId: result.parentId,
      });
    }
    // adiciona a sugestão preventiva (também como subtarefa da tarefa-mãe).
    // Ela tem data própria — é o lembrete ANTES/DEPOIS do evento.
    if (sug && sug.action) {
      await addTask({
        title: sug.action.title,
        category: sug.action.category || result.category,
        dueDate: sug.action.dueDate || null,
        dueTime: sug.action.dueTime || null,
        due: sug.action.due || '',
        parentId: result.parentId,
      });
    }
    close();
    onDone && onDone();
    toast('Pronto, deixei tudo organizado ✨');
  });
}
