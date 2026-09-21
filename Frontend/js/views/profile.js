/* ============================================================
   Perfil (Tela de conta)
   ============================================================ */

import { h, $, $$, icons, toast } from '../ui.js';
import { getUser, logout, isPremium, getSoundLevel, setSoundLevel, SOUND_LEVELS } from '../store.js';
import { playTap, playComplete } from '../sound.js';
import * as push from '../push.js';

export function renderProfile(app) {
  const user = getUser() || { name: 'Você', email: '' };
  const premium = isPremium();
  const installed = app.isInstalled && app.isInstalled();
  const som = getSoundLevel();

  const menu = [
    { id: 'account', label: 'Minha Conta', icon: icons.user },
    { id: 'ai', label: 'Preferências da IA', icon: icons.cog },
    { id: 'notifications', label: 'Notificações da Família', icon: icons.bell },
    { id: 'help', label: 'Ajuda e Suporte', icon: icons.help },
  ];

  const view = h(`
    <div class="h-full flex flex-col relative">
      <div class="content-wrap lg:max-w-xl flex-1 overflow-y-auto safe-bottom">
        <!-- header -->
        <div class="flex flex-col items-center text-center pt-14 pb-6 px-6">
          <div class="lift w-24 h-24 rounded-full bg-soft-200 grid place-items-center text-bordeaux-900 font-serif font-bold text-2xl mb-3">
            ${ini(user.name)}
          </div>
          <h1 class="font-serif font-bold text-bordeaux-900 text-2xl">${user.name}</h1>
          <p class="text-sm text-bordeaux-700">${user.email || ''}</p>
        </div>

        <!-- upgrade / premium -->
        <div class="px-6 mb-6">
          ${premium ? `
            <div class="bg-white rounded-xl2 shadow-card border border-soft-100 p-4 flex items-center gap-3">
              <span class="text-accent">${icons.crown}</span>
              <div>
                <p class="font-semibold text-bordeaux-900 text-sm">MenteLeve Premium ativo</p>
                <p class="text-xs text-bordeaux-700">Aproveite tudo sem limites ✨</p>
              </div>
            </div>` : `
            <div class="bg-white rounded-xl2 shadow-card border border-soft-100 p-4">
              <p class="flex items-center justify-center gap-2 text-sm font-medium text-bordeaux-900 mb-3">
                ${icons.crown} Zere sua sobrecarga mental
              </p>
              <button id="upgrade"
                class="btn btn-primary cta-lift w-full py-3">
                Fazer Upgrade
              </button>
            </div>`}
        </div>

        <!-- preferências -->
        <div class="px-6 mb-4">
          <div class="lift bg-white rounded-xl2 shadow-card border border-soft-100 p-4">
            <p class="flex items-center gap-2 text-sm text-bordeaux-900 mb-1">
              <span class="text-bordeaux-700">${icons.spark}</span> Sons do app
            </p>
            <p id="sound-hint" class="text-xs text-bordeaux-700 mb-3">${hintDoNivel(som)}</p>
            <div id="sound-levels" role="radiogroup" aria-label="Sons do app" class="flex gap-2">
              ${SOUND_LEVELS.map((n) => `
                <button data-level="${n.id}" role="radio" aria-checked="${n.id === som}"
                  class="flex-1 px-2 py-2 rounded-full text-xs font-medium border transition
                         ${n.id === som ? 'bg-accent text-white border-accent' : 'bg-white text-bordeaux-700 border-soft-100'}">
                  ${n.label}
                </button>`).join('')}
            </div>
          </div>
        </div>

        <!-- lembrete de tarefas (push) -->
        <div class="px-6 mb-4" id="push-card" hidden>
          <div class="lift bg-white rounded-xl2 shadow-card border border-soft-100 p-4 flex items-center justify-between gap-3">
            <div class="flex-1 min-w-0">
              <p class="flex items-center gap-2 text-sm text-bordeaux-900 mb-1">
                <span class="text-bordeaux-700">${icons.bell}</span> Lembrete de tarefas
              </p>
              <p class="text-xs text-bordeaux-700">Um aviso no aparelho perto do horário da tarefa.</p>
            </div>
            <button id="push-toggle" aria-checked="false"
              class="relative w-12 h-7 rounded-full shrink-0 transition-colors bg-soft-200">
              <span class="absolute top-1 left-1 w-5 h-5 rounded-full bg-white shadow transition-all"></span>
            </button>
          </div>
        </div>

        <!-- menu -->
        <div class="px-6">
          <div class="lift bg-white rounded-xl2 shadow-card border border-soft-100 overflow-hidden">
            ${menu.map((m) => `
              <button data-menu="${m.id}" class="w-full flex items-center gap-3 px-4 py-4 border-b border-soft-100 last:border-0 active:bg-bg transition text-left">
                <span class="text-bordeaux-700">${m.icon}</span>
                <span class="flex-1 text-sm text-bordeaux-900">${m.label}</span>
                <span class="text-muted">${icons.chevron}</span>
              </button>`).join('')}
          </div>

          ${installed ? '' : `
          <!-- Baixar / instalar o app (PWA) -->
          <div id="install-card" class="lift bg-white rounded-xl2 shadow-card border border-soft-100 p-4 mt-4 flex items-center gap-3">
            <img src="assets/icon-192.webp" alt="" class="w-11 h-11 rounded-xl shrink-0 object-cover" draggable="false" />
            <div class="min-w-0 flex-1">
              <p class="font-semibold text-bordeaux-900 text-sm">Instalar o MenteLeve</p>
              <p class="text-xs text-bordeaux-700">Tenha o app na tela inicial, funciona offline.</p>
            </div>
            <button id="install" class="btn btn-primary cta-lift shrink-0 px-4 py-2 !text-sm">
              Baixar
            </button>
          </div>`}

          <button id="logout" class="w-full flex items-center justify-center gap-2 py-4 mt-4 text-bordeaux-600 font-medium">
            ${icons.logout} Sair da Conta
          </button>
        </div>
      </div>
    </div>
  `);

  const up = $('#upgrade', view);
  if (up) up.addEventListener('click', () => app.navigate('paywall', { trigger: 'profile' }));

  // Nível de som — o primeiro item realmente funcional deste menu.
  const niveisEl = $('#sound-levels', view);
  niveisEl.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-level]');
    if (!btn) return;
    const nivel = setSoundLevel(btn.dataset.level);
    $$('[data-level]', niveisEl).forEach((b) => {
      const on = b.dataset.level === nivel;
      b.setAttribute('aria-checked', String(on));
      b.className = `flex-1 px-2 py-2 rounded-full text-xs font-medium border transition ${
        on ? 'bg-accent text-white border-accent' : 'bg-white text-bordeaux-700 border-soft-100'}`;
    });
    $('#sound-hint', view).textContent = hintDoNivel(nivel);
    // Toca uma amostra do que aquele nível de fato deixa passar — escolher
    // "Só conclusões" e ouvir o toque de navegação seria mentira.
    if (nivel === 'tudo') playTap();
    else if (nivel === 'conclusoes') playComplete();
  });

  // Lembrete de tarefas (push) — só aparece se o navegador suportar; o estado
  // real (assinado ou não) é assíncrono, então a checagem chega depois do
  // primeiro paint e ajusta o toggle sem bloquear a tela.
  const pushCard = $('#push-card', view);
  const pushToggle = $('#push-toggle', view);
  if (push.isPushSupported()) {
    pushCard.hidden = false;
    push.isEnabled().then(setPushToggle);
  }
  pushToggle.addEventListener('click', async () => {
    const ligado = pushToggle.getAttribute('aria-checked') === 'true';
    pushToggle.disabled = true;
    if (ligado) {
      await push.disable();
      setPushToggle(false);
      toast('Lembretes desativados');
    } else {
      const resultado = await push.enable();
      if (resultado === 'enabled') {
        setPushToggle(true);
        toast('Lembretes ativados 🔔');
      } else if (resultado === 'denied') {
        toast('Os lembretes estão bloqueados neste navegador. Libere as notificações do site nas configurações para ativar.', 4500);
      } else if (resultado === 'unavailable') {
        toast('Os lembretes ainda não estão disponíveis neste servidor.', 3500);
      } else {
        toast('Não consegui ativar os lembretes agora. Confira sua conexão e tente de novo.', 4000);
      }
    }
    pushToggle.disabled = false;
  });
  function setPushToggle(on) {
    pushToggle.setAttribute('aria-checked', String(on));
    pushToggle.className = `relative w-12 h-7 rounded-full shrink-0 transition-colors ${on ? 'bg-accent' : 'bg-soft-200'}`;
    pushToggle.querySelector('span').className =
      `absolute top-1 w-5 h-5 rounded-full bg-white shadow transition-all ${on ? 'left-6' : 'left-1'}`;
  }

  $$('[data-menu]', view).forEach((b) =>
    b.addEventListener('click', () => toast('Recurso disponível na versão final ✨'))
  );

  const installBtn = $('#install', view);
  if (installBtn) {
    installBtn.addEventListener('click', async () => {
      const outcome = await app.promptInstall();
      if (outcome === 'accepted') {
        const card = $('#install-card', view);
        if (card) card.remove();
      } else if (outcome === 'unavailable') {
        // iOS/Safari ou navegador sem prompt nativo: orienta a instalação manual.
        toast('No menu do navegador, toque em “Adicionar à Tela de Início”.', 4000);
      }
    });
  }

  $('#logout', view).addEventListener('click', () => {
    logout();
    app.navigate('login');
  });

  return view;
}

/** Frase que explica o nível escolhido, logo abaixo do título. */
function hintDoNivel(nivel) {
  const n = SOUND_LEVELS.find((x) => x.id === nivel) || SOUND_LEVELS[0];
  return n.hint;
}

function ini(name) {
  const p = name.trim().split(/\s+/);
  return ((p[0]?.[0] || '') + (p[1]?.[0] || '')).toUpperCase();
}
