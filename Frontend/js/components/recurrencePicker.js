/* ============================================================
   Seletor de repetição — usado ao criar (taskSheet) e ao editar (Home).
   Todo dia · Dias úteis · Toda semana (+ dias escolhidos) · Todo mês,
   e "Até" (fim da série). Dias no padrão do backend: 0 = segunda.
   ============================================================ */

import { h, $, $$, icons } from '../ui.js';
import { cleanWeekdays, WORKDAYS, todayKey } from '../dates.js';

const MODOS = [
  { id: 'daily',   label: 'Todo dia' },
  { id: 'uteis',   label: 'Dias úteis' },
  { id: 'weekly',  label: 'Toda semana' },
  { id: 'monthly', label: 'Todo mês' },
];
const DIAS = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];

const chipCls = (on) => `inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium border transition ${
  on ? 'bg-accent text-white border-accent' : 'bg-white text-bordeaux-700 border-soft-100'}`;
const diaCls = (on) => `w-10 h-10 rounded-full text-xs font-semibold border transition ${
  on ? 'bg-bordeaux-800 text-white border-bordeaux-800' : 'bg-white text-bordeaux-700 border-soft-100'}`;

/** Modo inicial a partir de uma tarefa (front-format). */
function modoDe(task) {
  if (!task || !task.isRecurring) return { modo: null, dias: [] };
  const dias = cleanWeekdays(task.recurrenceWeekdays) || [];
  if (task.recurrencePattern === 'weekly' && dias.join(',') === WORKDAYS.join(',')) return { modo: 'uteis', dias: [] };
  return { modo: task.recurrencePattern, dias: task.recurrencePattern === 'weekly' ? dias : [] };
}

/**
 * @param {object}   opts
 * @param {object}  [opts.task]      tarefa existente (edição) — define o estado inicial
 * @param {boolean} [opts.allowNone] mostra "Não repete" (edição). Na criação, desmarcar
 *                                   volta para "a IA decide" e getValue() devolve null.
 * @param {Function}[opts.onChange]
 */
export function recurrencePicker({ task = null, allowNone = false, onChange } = {}) {
  const ini = modoDe(task);
  let modo = ini.modo ?? (allowNone ? 'none' : null);
  const dias = new Set(ini.dias);
  let ate = (task && task.recurrenceUntil) || '';

  const el = h(`
    <div>
      <div class="flex flex-wrap gap-2" role="group" aria-label="Repetição da tarefa">
        ${allowNone ? `<button type="button" data-modo="none" aria-pressed="false" class="${chipCls(false)}">Não repete</button>` : ''}
        ${MODOS.map((m) => `
          <button type="button" data-modo="${m.id}" aria-pressed="false" class="${chipCls(false)}">${icons.repeat}${m.label}</button>`).join('')}
      </div>
      <div data-dias class="mt-3" hidden>
        <p class="text-[11px] text-muted mb-1.5">Em quais dias? <span class="text-muted">(nenhum = no dia do prazo)</span></p>
        <div class="flex gap-1.5 flex-wrap" role="group" aria-label="Dias da semana">
          ${DIAS.map((d, i) => `<button type="button" data-dia="${i}" aria-pressed="false" class="${diaCls(false)}">${d}</button>`).join('')}
        </div>
      </div>
      <label data-ate class="mt-3 flex items-center gap-2 text-xs text-bordeaux-700" hidden>
        Até
        <input type="date" min="${todayKey()}" aria-label="Repetir até (opcional)"
          class="px-3 py-2 rounded-2xl bg-white border border-soft-100 text-bordeaux-900 text-sm
                 focus:border-accent focus:ring-4 focus:ring-accent/15 outline-none transition" />
        <span class="text-muted">(opcional)</span>
      </label>
    </div>`);

  const ateInput = $('input[type="date"]', el);
  ateInput.value = ate;

  function draw() {
    $$('[data-modo]', el).forEach((b) => {
      const on = b.dataset.modo === modo;
      b.setAttribute('aria-pressed', String(on));
      b.className = chipCls(on);
    });
    $('[data-dias]', el).hidden = modo !== 'weekly';
    $$('[data-dia]', el).forEach((b) => {
      const on = dias.has(Number(b.dataset.dia));
      b.setAttribute('aria-pressed', String(on));
      b.className = diaCls(on);
    });
    $('[data-ate]', el).hidden = !modo || modo === 'none';
  }

  el.addEventListener('click', (e) => {
    const m = e.target.closest('[data-modo]');
    if (m) {
      // Na criação, tocar de novo desmarca (volta para o palpite da IA).
      modo = modo === m.dataset.modo && !allowNone ? null : m.dataset.modo;
      draw(); onChange && onChange(getValue());
      return;
    }
    const d = e.target.closest('[data-dia]');
    if (d) {
      const n = Number(d.dataset.dia);
      if (dias.has(n)) dias.delete(n); else dias.add(n);
      draw(); onChange && onChange(getValue());
    }
  });
  ateInput.addEventListener('change', () => { ate = ateInput.value; onChange && onChange(getValue()); });

  /** null = nada escolhido (criação: a IA decide); senão os campos da tarefa. */
  function getValue() {
    if (!modo) return null;
    if (modo === 'none') return { isRecurring: false, recurrencePattern: null, recurrenceWeekdays: null, recurrenceUntil: null };
    const pattern = modo === 'uteis' ? 'weekly' : modo;
    const weekdays = modo === 'uteis' ? [...WORKDAYS] : modo === 'weekly' ? cleanWeekdays([...dias]) : null;
    return { isRecurring: true, recurrencePattern: pattern, recurrenceWeekdays: weekdays, recurrenceUntil: ate || null };
  }

  draw();
  return { el, getValue };
}
