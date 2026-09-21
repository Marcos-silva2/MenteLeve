/* ============================================================
   Conexões / Rede de Apoio (Tela 6)
   MVP: visual estático. Convidar parceiro → dispara Paywall.
   ============================================================ */

import { h, $, $$, icons, toast } from '../ui.js';
import { getUser } from '../store.js';

export function renderConnections(app) {
  const user = getUser() || { name: 'Você' };

  const view = h(`
    <div class="h-full flex flex-col relative">
      <div class="content-wrap lg:max-w-2xl flex-1 flex flex-col overflow-hidden">
      <header class="px-6 lg:px-0 pt-12 lg:pt-8 pb-4">
        <h1 class="font-serif font-bold text-bordeaux-900 text-[26px] lg:text-3xl leading-tight">A sua Rede de Apoio</h1>
        <p class="text-sm text-bordeaux-700 mt-1">Divida as tarefas e multiplique o seu tempo livre.</p>
      </header>

      <div class="flex-1 overflow-y-auto px-6 lg:px-0 safe-bottom">
        <!-- membros -->
        <div class="stagger grid grid-cols-2 gap-3 mb-7">
          <div class="lift bg-white rounded-xl2 shadow-card border border-soft-100 p-4 flex flex-col items-center text-center">
            <div class="w-14 h-14 rounded-full bg-soft-200 grid place-items-center text-bordeaux-900 font-serif font-bold mb-2">${ini(user.name)}</div>
            <p class="text-sm font-semibold text-bordeaux-900">${user.name.split(' ')[0]}</p>
            <p class="text-[11px] text-bordeaux-700">(Administradora)</p>
          </div>
          <button id="invite-card"
            class="lift rounded-xl2 border-2 border-dashed border-soft-200 p-4 flex flex-col items-center justify-center text-center active:scale-[.98] transition">
            <div class="w-14 h-14 rounded-full bg-soft-100 grid place-items-center text-accent mb-2">${icons.plus}</div>
            <p class="text-sm font-semibold text-bordeaux-900">Convidar Parceiro(a)</p>
            <p class="text-[11px] text-bordeaux-700">Divida a carga</p>
          </button>
        </div>

        <!-- estado vazio: ainda não há ninguém na rede. Não é erro nem carregamento —
             é o começo; a orientação é convidar. -->
        <div class="flex flex-col items-center text-center px-6 py-8 mb-7 bg-bg border border-soft-100 rounded-xl2">
          <div class="w-16 h-16 rounded-full bg-white grid place-items-center mb-3 text-soft-300 [&>svg]:w-8 [&>svg]:h-8" aria-hidden="true">${icons.users}</div>
          <h2 class="font-serif font-bold text-bordeaux-900 text-lg mb-1">Sua rede de apoio começa aqui</h2>
          <p class="text-sm text-bordeaux-700 max-w-[280px] mb-4">Ainda não há ninguém conectado. Convide seu parceiro(a) ou alguém de confiança para dividir a carga.</p>
          <button id="invite" class="btn btn-primary cta-lift">Convidar Parceiro(a)</button>
        </div>

        <!-- configurações -->
        <h2 class="font-serif font-bold text-bordeaux-900 text-lg mb-3">Configurações de Partilha</h2>
        <div class="flex flex-col gap-1 bg-white rounded-xl2 shadow-card border border-soft-100 overflow-hidden mb-6">
          ${toggleRow('Notificar parceiro sobre tarefas urgentes', true)}
          ${toggleRow('Sincronizar agenda de filhos', false)}
          ${toggleRow('Permitir que a IA divida tarefas entre nós ✨', true)}
        </div>
      </div>

      </div>
    </div>
  `);

  // Qualquer ação de convite no MVP leva ao paywall (recurso premium)
  const goPaywall = () => app.navigate('paywall', { trigger: 'invite' });
  $('#invite', view).addEventListener('click', goPaywall);
  $('#invite-card', view).addEventListener('click', goPaywall);

  // toggles são apenas visuais no MVP
  $$('[data-toggle]', view).forEach((t) =>
    t.addEventListener('click', () => {
      const on = t.getAttribute('aria-checked') === 'true';
      setToggle(t, !on);
      toast('Recurso disponível na versão final ✨');
    })
  );

  return view;
}

function toggleRow(label, on) {
  return `
  <div class="flex items-center justify-between px-4 py-3.5 border-b border-soft-100 last:border-0">
    <span class="text-sm text-bordeaux-900 pr-4">${label}</span>
    <button data-toggle role="switch" aria-checked="${on}" aria-label="${label}"
      class="relative w-12 h-7 rounded-full shrink-0 transition-colors ${on ? 'bg-accent' : 'bg-soft-200'}">
      <span class="absolute top-1 w-5 h-5 rounded-full bg-white shadow transition-all ${on ? 'left-6' : 'left-1'}"></span>
    </button>
  </div>`;
}

function setToggle(btn, on) {
  btn.setAttribute('aria-checked', String(on));
  btn.className = `relative w-12 h-7 rounded-full shrink-0 transition-colors ${on ? 'bg-accent' : 'bg-soft-200'}`;
  const knob = btn.querySelector('span');
  knob.className = `absolute top-1 w-5 h-5 rounded-full bg-white shadow transition-all ${on ? 'left-6' : 'left-1'}`;
}

function ini(name) {
  const p = name.trim().split(/\s+/);
  return ((p[0]?.[0] || '') + (p[1]?.[0] || '')).toUpperCase();
}
