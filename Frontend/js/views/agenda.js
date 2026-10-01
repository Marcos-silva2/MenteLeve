/* ============================================================
   Agenda / Calendário (Tela 5)
   - Três visões: MÊS (grade + lista do dia), SEMANA (7 dias em lista) e DIA
     (linha do tempo com blocos de horário e conflitos). A escolha é lembrada.
   - Calendário MENSAL navegável (‹ mês ›) + lista do dia.
   - Camada opcional de CICLO MENSTRUAL (fases nos dias + previsões).
     Dados do ciclo são 100% locais/privados (localStorage).
   ============================================================ */

import { h, $, $$, icons, renderGroupTabs } from '../ui.js';
import { getGroupFilter, inGroup } from '../categories.js';
import {
  getTasks, getCategory,
  getCycle, setCycle, logPeriodToday, cyclePhase, cycleSummary, isCycleModuleOn,
} from '../store.js';
import { openTaskSheet } from '../components/taskSheet.js';
import { resolveTime, addDaysKey, weekdayOf } from '../dates.js';
import { conflictIds, layoutDay, hourRange, rangeLabel, toMinutes } from '../timeline.js';
import { playCycle, playTap } from '../sound.js';

const MONTHS = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
const WEEKDAYS = ['DOM', 'SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB'];

const VIEW_KEY = 'menteleve.agendaView';
const VIEWS = [{ id: 'mes', label: 'Mês' }, { id: 'semana', label: 'Semana' }, { id: 'dia', label: 'Dia' }];
const WD_LONG = ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado', 'Domingo'];   // 0 = segunda
const WD_SHORT = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];
const PX_POR_MIN = 1;   // 60 px por hora na linha do tempo

/** Visão salva; sem escolha, quem usa para Trabalho começa na semana. */
function visaoInicial() {
  try {
    const v = localStorage.getItem(VIEW_KEY);
    if (VIEWS.some((x) => x.id === v)) return v;
  } catch { /* storage bloqueado */ }
  return getGroupFilter() === 'trabalho' ? 'semana' : 'mes';
}
function salvarVisao(v) {
  try { localStorage.setItem(VIEW_KEY, v); } catch { /* vale só nesta sessão */ }
}

const PHASE = {
  period:    { label: 'Menstruação',    color: 'var(--color-primary-600)', bg: 'bg-soft-200' },
  fertile:   { label: 'Período fértil',  color: 'var(--color-soft-300)', bg: '' },
  ovulation: { label: 'Ovulação',        color: 'var(--color-accent)', bg: '' },
};

export function renderAgenda(app) {
  const today = new Date();
  const todayKey = keyOf(today);
  let viewY = today.getFullYear();
  let viewM = today.getMonth();
  let selectedKey = todayKey;
  const cicloLigado = isCycleModuleOn();                // módulo opcional (Perfil)
  let showCycle = cicloLigado && getCycle().enabled;   // mostra a camada de ciclo
  let cycleEdit = false;                // mostra o formulário de configuração
  let modo = visaoInicial();            // 'mes' | 'semana' | 'dia'

  const view = h(`
    <div class="h-full flex flex-col relative">
      <div class="content-wrap lg:max-w-2xl flex-1 overflow-y-auto">
        <header class="sticky top-0 z-20 bg-bg px-6 lg:px-0 pt-12 lg:pt-8 pb-2 flex items-center justify-between gap-2">
          <h1 id="month-label" class="font-serif font-bold text-bordeaux-900 text-[22px] lg:text-3xl leading-tight min-w-0"></h1>
          <div class="flex items-center gap-1.5 shrink-0">
            ${cicloLigado ? '<button id="cycle-toggle" class="text-xs font-semibold px-3 py-1.5 min-h-11 rounded-full border transition">🌸 Ciclo</button>' : ''}
            <button id="today-btn" class="text-xs font-semibold text-bordeaux-700 px-3 py-1.5 min-h-11 rounded-full border border-soft-100 hover:bg-soft-100 transition">Hoje</button>
            <button id="prev" class="w-11 h-11 rounded-full grid place-items-center text-bordeaux-700 hover:bg-soft-100 transition rotate-180" aria-label="Mês anterior">${icons.chevron}</button>
            <button id="next" class="w-11 h-11 rounded-full grid place-items-center text-bordeaux-700 hover:bg-soft-100 transition" aria-label="Próximo mês">${icons.chevron}</button>
          </div>
        </header>

        <div id="group-tabs" class="mx-5 lg:mx-0 mb-2 p-1 flex gap-1 rounded-full bg-white border border-soft-100"></div>
        <div id="view-tabs" role="tablist" aria-label="Visão da agenda" class="mx-5 lg:mx-0 mb-3 flex gap-1"></div>

        <div id="span-view" class="px-5 lg:px-0 pb-2 safe-bottom"></div>

        <div id="month-card" class="px-5 lg:px-0">
          <div class="bg-white rounded-xl2 shadow-card border border-soft-100 p-3">
            <div class="grid grid-cols-7 mb-1">
              ${WEEKDAYS.map((w) => `<div class="text-center text-[10px] font-semibold text-muted py-1">${w}</div>`).join('')}
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
  const viewTabs = $('#view-tabs', view);
  const spanEl = $('#span-view', view);
  renderGroupTabs($('#group-tabs', view), () => render());

  function renderViewTabs() {
    viewTabs.innerHTML = VIEWS.map((v) => `
      <button role="tab" data-view="${v.id}" aria-selected="${v.id === modo}"
        class="flex-1 min-h-11 rounded-xl text-sm font-semibold border transition
               ${v.id === modo ? 'bg-accent text-white border-accent' : 'bg-white text-bordeaux-700 border-soft-100 hover:bg-soft-100'}">${v.label}</button>`).join('');
  }
  viewTabs.addEventListener('click', (e) => {
    const b = e.target.closest('[data-view]');
    if (!b || b.dataset.view === modo) return;
    playTap();
    modo = b.dataset.view;
    salvarVisao(modo);
    render();
  });

  function buildIndex() {
    const byDay = new Map();
    const undated = [];
    const grupo = getGroupFilter();
    for (const t of getTasks()) {
      if (!inGroup(t, grupo)) continue;
      // `dueDate` já vem no formato "AAAA-MM-DD" — o mesmo de keyOf(). Indexar
      // a string direto evita `new Date('AAAA-MM-DD')`, que é lido como UTC e
      // volta um dia no Brasil.
      let k = t.dueDate || null;
      if (!k) {
        // Legado: tarefas criadas antes da data estruturada só têm o texto.
        const d = parseDueDate(t.due, today);
        k = d ? keyOf(d) : null;
      }
      if (!k) { undated.push(t); continue; }
      if (!byDay.has(k)) byDay.set(k, []);
      byDay.get(k).push(t);
    }
    return { byDay, undated };
  }

  function render() {
    const { byDay, undated } = buildIndex();
    renderViewTabs();
    const emMes = modo === 'mes';
    $('#month-card', view).hidden = !emMes;
    dayEl.hidden = !emMes;
    cycleEl.hidden = !emMes;
    spanEl.hidden = emMes;
    $('#prev', view).setAttribute('aria-label', emMes ? 'Mês anterior' : modo === 'semana' ? 'Semana anterior' : 'Dia anterior');
    $('#next', view).setAttribute('aria-label', emMes ? 'Próximo mês' : modo === 'semana' ? 'Próxima semana' : 'Próximo dia');
    if (!emMes) {
      // Conflito olha todas as tarefas do dia, não só as do grupo filtrado.
      const conflitos = conflictIds(getTasks());
      if (modo === 'semana') {
        const ini = addDaysKey(selectedKey, -weekdayOf(selectedKey));
        monthLabel.textContent = `${fmtCurto(ini)} – ${fmtCurto(addDaysKey(ini, 6))}`;
        spanEl.innerHTML = weekHtml(ini, byDay, todayKey, conflitos);
      } else {
        const [, m, d] = selectedKey.split('-').map(Number);
        monthLabel.textContent = `${WD_LONG[weekdayOf(selectedKey)]}, ${d} de ${MONTHS[m - 1].toLowerCase()}`;
        spanEl.innerHTML = dayHtml(selectedKey, byDay.get(selectedKey) || [], todayKey, conflitos);
      }
      return;
    }
    monthLabel.textContent = `${MONTHS[viewM]} ${viewY}`;
    if (toggleBtn) toggleBtn.className = `text-xs font-semibold px-3 py-1.5 min-h-11 rounded-full border transition ${showCycle ? 'bg-accent text-white border-accent' : 'text-bordeaux-700 border-soft-100 hover:bg-soft-100'}`;

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
          class="relative aspect-square min-h-11 rounded-xl flex flex-col items-center justify-center gap-0.5 text-sm transition active:scale-90 border ${base} ${cycleRing}">
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
             <p class="text-sm text-bordeaux-700">Nada agendado para este dia. Aproveite para respirar.</p>
           </div>`}
      ${undated.length
        ? `<h3 class="text-xs font-semibold text-muted uppercase tracking-wide mb-2">Sem data definida</h3>
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
          <button id="cy-save" class="btn btn-primary cta-lift w-full py-3">Salvar</button>
        </div>`;

      $('#cy-save', cycleEl).addEventListener('click', () => {
        const last = $('#cy-last', cycleEl).value || todayKey;
        const cycleLength = clampNum($('#cy-cycle', cycleEl).value, 20, 45, 28);
        const periodLength = clampNum($('#cy-period', cycleEl).value, 2, 10, 5);
        setCycle({ enabled: true, lastStart: last, cycleLength, periodLength });
        playCycle();
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
          <button id="cy-edit" class="text-xs text-bordeaux-700 underline min-h-11 px-2 -my-2">ajustar</button>
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
        <button id="cy-log" class="btn btn-primary cta-lift w-full py-2.5 mb-3 !text-sm">
          Registrar menstruação hoje
        </button>
        <div class="flex items-center gap-3 text-[11px] text-bordeaux-700">
          ${legendDot('var(--color-primary-600)', 'Menstruação')} ${legendDot('var(--color-soft-300)', 'Fértil')} ${legendDot('var(--color-accent)', 'Ovulação')}
        </div>
      </div>`;

    $('#cy-edit', cycleEl).addEventListener('click', () => { cycleEdit = true; render(); });
    // Timbre próprio, grave e longo: registro íntimo, não conquista de
    // produtividade. Soar como "tarefa concluída" leria mal o momento.
    $('#cy-log', cycleEl).addEventListener('click', () => { logPeriodToday(); playCycle(); cycleEdit = false; render(); app.toast('Menstruação registrada 🌸'); });
  }

  // eventos de navegação
  function passo(delta) {
    playTap();
    if (modo === 'mes') {
      viewM += delta;
      if (viewM < 0) { viewM = 11; viewY--; }
      if (viewM > 11) { viewM = 0; viewY++; }
    } else {
      selectedKey = addDaysKey(selectedKey, delta * (modo === 'semana' ? 7 : 1));
      const [y, m] = selectedKey.split('-').map(Number);
      viewY = y; viewM = m - 1;   // voltar ao mês mostra o mês do dia escolhido
    }
    render();
  }
  $('#prev', view).addEventListener('click', () => passo(-1));
  $('#next', view).addEventListener('click', () => passo(1));
  // Na semana, tocar no dia abre a visão de dia.
  spanEl.addEventListener('click', (e) => {
    const b = e.target.closest('[data-goday]');
    if (!b) return;
    playTap();
    selectedKey = b.dataset.goday;
    modo = 'dia';
    salvarVisao(modo);
    render();
  });
  $('#today-btn', view).addEventListener('click', () => { playTap(); viewY = today.getFullYear(); viewM = today.getMonth(); selectedKey = todayKey; render(); });
  if (toggleBtn) toggleBtn.addEventListener('click', () => { showCycle = !showCycle; setCycle({ enabled: showCycle }); cycleEdit = false; render(); });
  $('#fab', view).addEventListener('click', () => openTaskSheet(app, render));

  render();
  return view;
}

/* ---------------- visões Semana e Dia ---------------- */
function fmtCurto(key) {
  const [, m, d] = key.split('-').map(Number);
  return `${d} ${MONTHS[m - 1].slice(0, 3).toLowerCase()}`;
}

function porHorario(a, b) {
  if (a.done !== b.done) return Number(a.done) - Number(b.done);
  const ma = toMinutes(a.dueTime); const mb = toMinutes(b.dueTime);
  if (ma === null && mb === null) return 0;
  if (ma === null) return -1;          // sem horário primeiro: é o "a qualquer hora" do dia
  if (mb === null) return 1;
  return ma - mb;
}

const AVISO_CONFLITO = '<span class="shrink-0 text-[11px] font-semibold text-bordeaux-600" title="Outra tarefa ocupa o mesmo horário">⚠ conflito</span>';

function linhaCompacta(t, conflito) {
  const cat = getCategory(t.category);
  const faixa = rangeLabel(t);
  return `
    <div class="flex items-center gap-2 px-3 py-2 rounded-xl bg-white border ${conflito ? 'border-bordeaux-600' : 'border-soft-100'}">
      <span class="shrink-0 w-2 h-2 rounded-full" style="background:${cat ? cat.dot : 'var(--color-accent)'}"></span>
      <span class="shrink-0 w-[5.5rem] text-xs font-semibold text-bordeaux-700">${faixa || 'Sem horário'}</span>
      <span class="min-w-0 flex-1 truncate text-sm ${t.done ? 'line-through text-muted' : 'text-bordeaux-900'}">${t.title}</span>
      ${conflito ? AVISO_CONFLITO : ''}
    </div>`;
}

function weekHtml(inicio, byDay, hoje, conflitos) {
  return `<div class="flex flex-col gap-3">${Array.from({ length: 7 }, (_, i) => {
    const k = addDaysKey(inicio, i);
    const tarefas = (byDay.get(k) || []).filter((t) => !t.parentId).sort(porHorario);
    const d = Number(k.slice(8, 10));
    const ehHoje = k === hoje;
    const abertas = tarefas.filter((t) => !t.done).length;
    return `
      <section>
        <button data-goday="${k}" class="w-full min-h-11 flex items-center justify-between px-1 mb-1 text-left">
          <span class="font-serif font-bold text-base ${ehHoje ? 'text-accent' : 'text-bordeaux-900'}">${WD_SHORT[i]} ${d}${ehHoje ? ' · hoje' : ''}</span>
          <span class="text-xs text-bordeaux-700">${tarefas.length ? `${abertas} em aberto` : 'livre'} ›</span>
        </button>
        ${tarefas.length ? `<div class="flex flex-col gap-1.5">${tarefas.map((t) => linhaCompacta(t, conflitos.has(t.id))).join('')}</div>` : ''}
      </section>`;
  }).join('')}</div>`;
}

function dayHtml(key, tarefasDoDia, hoje, conflitos) {
  const tarefas = tarefasDoDia.filter((t) => !t.parentId);
  const semHora = tarefas.filter((t) => toMinutes(t.dueTime) === null).sort(porHorario);
  const layout = layoutDay(tarefas.filter((t) => toMinutes(t.dueTime) !== null));
  const [h0, h1] = hourRange(layout);
  const altura = (h1 - h0) * 60 * PX_POR_MIN;
  const agora = new Date();
  const minAgora = agora.getHours() * 60 + agora.getMinutes();
  const linhaAgora = key === hoje && minAgora >= h0 * 60 && minAgora <= h1 * 60
    ? `<div class="absolute left-12 right-0 h-0.5 bg-accent z-10" style="top:${(minAgora - h0 * 60) * PX_POR_MIN}px" aria-hidden="true"><span class="absolute -left-1 -top-1 w-2.5 h-2.5 rounded-full bg-accent"></span></div>`
    : '';

  const horas = Array.from({ length: h1 - h0 + 1 }, (_, i) => `
    <div class="absolute left-0 right-0 flex items-start" style="top:${i * 60 * PX_POR_MIN}px" aria-hidden="true">
      <span class="w-12 -mt-2 text-[11px] text-muted">${String(h0 + i).padStart(2, '0')}:00</span>
      <span class="flex-1 border-t border-soft-100"></span>
    </div>`).join('');

  const blocos = layout.map((b) => {
    const t = b.task;
    const cat = getCategory(t.category);
    const conflito = conflitos.has(t.id);
    const alto = Math.max((b.end - b.start) * PX_POR_MIN, 26);
    return `
      <div role="listitem" data-bloco="${t.id}" class="absolute rounded-lg bg-white shadow-card border px-2 py-1 overflow-hidden ${conflito ? 'border-bordeaux-600' : 'border-soft-100'}"
        style="top:${(b.start - h0 * 60) * PX_POR_MIN}px; height:${alto}px; left:calc(3rem + (100% - 3rem) * ${b.col / b.cols}); width:calc((100% - 3rem) / ${b.cols} - 4px); border-left:4px solid ${cat ? cat.dot : 'var(--color-accent)'}">
        <p class="text-xs font-semibold leading-tight truncate ${t.done ? 'line-through text-muted' : 'text-bordeaux-900'}">${t.title}</p>
        ${alto >= 40 ? `<p class="text-[11px] text-bordeaux-700 truncate">${rangeLabel(t)}${conflito ? ' · ⚠ conflito' : ''}</p>` : ''}
      </div>`;
  }).join('');

  const nConf = tarefas.filter((t) => conflitos.has(t.id)).length;
  return `
    ${nConf ? `<p class="mb-3 px-3 py-2 rounded-xl bg-soft-100 text-sm text-bordeaux-800">⚠ ${nConf} tarefas com horário sobreposto neste dia.</p>` : ''}
    ${semHora.length ? `
      <h3 class="text-xs font-semibold text-muted uppercase tracking-wide mb-1.5">Sem horário</h3>
      <div class="flex flex-col gap-1.5 mb-4">${semHora.map((t) => linhaCompacta(t, false)).join('')}</div>` : ''}
    ${!tarefas.length ? '<p class="text-sm text-bordeaux-700 text-center mb-4">Nada agendado para este dia.</p>' : ''}
    <div class="relative mb-6 mt-3" style="height:${altura + 8}px" role="list" aria-label="Linha do tempo do dia">
      ${horas}${linhaAgora}${blocos}
    </div>`;
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
  // Horário estruturado; cai no texto legado só para tarefas antigas.
  const time = rangeLabel(t) || resolveTime(t.due) || '';
  return `
    <div class="lift flex items-center gap-3 bg-white rounded-2xl shadow-card border border-soft-100 px-4 py-3">
      <span class="shrink-0 w-2.5 h-2.5 rounded-full" style="background:${cat ? cat.dot : 'var(--color-accent)'}"></span>
      <div class="min-w-0 flex-1">
        <p class="text-[15px] font-medium leading-tight ${done ? 'line-through text-muted' : 'text-bordeaux-900'}">${t.title}</p>
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
