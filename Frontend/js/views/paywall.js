/* ============================================================
   Paywall Premium (Tela 7)
   Disparado pelo limite de tarefas ou ao convidar parceiro.
   MVP: assinatura simulada (toast).
   ============================================================ */

import { h, $, $$, icons, toast } from '../ui.js';
import { setPremium } from '../store.js';

const BENEFITS = [
  'Tarefas e pensamentos ilimitados.',
  'Conexão com parceiro(a) e rede de apoio.',
  'Inteligência Artificial avançada para antecipar rotinas.',
  'Sincronização de calendários familiares.',
];

export function renderPaywall(app, params = {}) {
  let plan = 'anual';

  const headline = params.trigger === 'limit'
    ? 'Você atingiu o limite gratuito.'
    : 'Zere a sua sobrecarga mental.';

  const view = h(`
    <div class="h-full flex flex-col bg-gradient-to-b from-bg to-soft-100 relative">
      <!-- voltar -->
      <button id="close" class="absolute top-12 left-5 z-10 w-10 h-10 rounded-full bg-white/70 grid place-items-center text-bordeaux-900 active:scale-95 transition">
        ${icons.back}
      </button>

      <!-- Mobile: scroll vertical linear | Desktop: card centralizado com colunas -->
      <div class="flex-1 overflow-y-auto px-7 pt-20 lg:pt-0 pb-4 lg:flex lg:items-center lg:justify-center">
        <div class="w-full lg:max-w-4xl lg:bg-white lg:rounded-xl2 lg:shadow-card lg:border lg:border-soft-100 lg:p-12 lg:grid lg:grid-cols-2 lg:gap-12 lg:items-center">

          <!-- coluna 1: apelo + benefícios -->
          <div class="text-center lg:text-left">
            <div class="w-16 h-16 mx-auto lg:mx-0 rounded-2xl bg-accent/15 grid place-items-center text-accent mb-4">${icons.crown}</div>
            <h1 class="font-serif font-bold text-bordeaux-900 text-[28px] lg:text-4xl leading-tight mb-3">${headline}</h1>
            <p class="text-sm text-bordeaux-700 max-w-[300px] lg:max-w-none mx-auto lg:mx-0 mb-7">
              Você conheceu a leveza. Agora, desbloqueie o poder completo do seu Segundo Cérebro Inteligente.
            </p>
            <div class="stagger text-left max-w-[320px] lg:max-w-none mx-auto flex flex-col gap-3 mb-8 lg:mb-0">
              ${BENEFITS.map((b) => `
                <div class="flex items-start gap-3">
                  <span class="shrink-0 w-6 h-6 rounded-full bg-accent text-white grid place-items-center mt-0.5">${icons.check}</span>
                  <span class="text-sm text-bordeaux-900">${b}</span>
                </div>`).join('')}
            </div>
          </div>

          <!-- coluna 2: planos + CTA -->
          <div>
            <div class="grid grid-cols-2 lg:grid-cols-1 gap-3 max-w-[340px] lg:max-w-none mx-auto">
              <button data-plan="mensal"
                class="plan rounded-xl2 border-2 p-4 text-left transition bg-white border-soft-100">
                <p class="text-xs font-medium text-bordeaux-700 mb-1">Plano Mensal</p>
                <p class="font-serif font-bold text-bordeaux-900 text-xl">R$ 19,90<span class="text-xs font-sans font-medium text-bordeaux-700">/mês</span></p>
              </button>
              <button data-plan="anual"
                class="plan relative rounded-xl2 border-2 p-4 text-left transition bg-white border-accent">
                <span class="absolute -top-2.5 right-3 bg-accent text-white text-[10px] font-bold px-2 py-0.5 rounded-full">ECONOMIZE 60%</span>
                <p class="text-xs font-medium text-bordeaux-700 mb-1">Plano Anual</p>
                <p class="font-serif font-bold text-bordeaux-900 text-xl">R$ 7,90<span class="text-xs font-sans font-medium text-bordeaux-700">/mês</span></p>
                <p class="text-[10px] text-bordeaux-700 mt-1">cobrado anualmente</p>
              </button>
            </div>

            <button id="subscribe"
              class="cta-lift hidden lg:block w-full mt-6 py-4 rounded-full bg-accent hover:bg-accent-hover text-white font-semibold shadow-fab active:scale-[.98] transition">
              Desbloquear MenteLeve Premium
            </button>
            <p class="hidden lg:block text-center text-[11px] text-muted mt-3">Cancele a qualquer momento • Faturamento seguro via App Store / Google Play</p>
          </div>
        </div>
      </div>

      <!-- CTA fixo (mobile) -->
      <div class="lg:hidden px-7 pb-10 pt-3">
        <button id="subscribe-m"
          class="cta-lift w-full py-4 rounded-full bg-accent hover:bg-accent-hover text-white font-semibold shadow-fab active:scale-[.98] transition">
          Desbloquear MenteLeve Premium
        </button>
        <p class="text-center text-[11px] text-muted mt-3">Cancele a qualquer momento • Faturamento seguro via App Store / Google Play</p>
      </div>
    </div>
  `);

  function selectPlan(p) {
    plan = p;
    $$('[data-plan]', view).forEach((b) => {
      const on = b.dataset.plan === plan;
      b.className = `plan relative rounded-xl2 border-2 p-4 text-left transition bg-white ${on ? 'border-accent' : 'border-soft-100'}`;
    });
  }

  $$('[data-plan]', view).forEach((b) => b.addEventListener('click', () => selectPlan(b.dataset.plan)));

  $('#close', view).addEventListener('click', () => app.navigate(backTarget(params)));

  let assinando = false;
  const subscribe = async () => {
    if (assinando) return;   // dois toques na mesma compra = uma chamada só
    assinando = true;
    try {
      // MVP: compra simulada. O servidor pode recusar (403) quando a cobrança
      // real estiver ligada — só comemora e navega se o Premium valeu mesmo.
      if (!(await setPremium(true))) {
        toast('Não foi possível ativar agora. Tente novamente em instantes.');
        return;
      }
      toast('Recurso disponível na versão final ✨');
      setTimeout(() => app.navigate('home'), 800);
    } finally {
      assinando = false;
    }
  };
  $$('#subscribe, #subscribe-m', view).forEach((b) => b.addEventListener('click', subscribe));

  selectPlan('anual');
  return view;
}

function backTarget(params) {
  if (params.trigger === 'invite') return 'connections';
  return 'home';
}
