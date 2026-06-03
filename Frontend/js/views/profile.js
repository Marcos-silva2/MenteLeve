/* ============================================================
   Perfil (Tela de conta)
   ============================================================ */

import { h, $, $$, icons, toast } from '../ui.js';
import { getUser, logout, isPremium } from '../store.js';

export function renderProfile(app) {
  const user = getUser() || { name: 'Você', email: '' };
  const premium = isPremium();

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
          <div class="w-24 h-24 rounded-full bg-soft-200 grid place-items-center text-bordeaux-900 font-serif font-bold text-2xl mb-3">
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
                class="w-full py-3 rounded-full bg-accent hover:bg-accent-hover text-white font-semibold shadow-fab active:scale-[.98] transition">
                Fazer Upgrade
              </button>
            </div>`}
        </div>

        <!-- menu -->
        <div class="px-6">
          <div class="bg-white rounded-xl2 shadow-card border border-soft-100 overflow-hidden">
            ${menu.map((m) => `
              <button data-menu="${m.id}" class="w-full flex items-center gap-3 px-4 py-4 border-b border-soft-100 last:border-0 active:bg-bg transition text-left">
                <span class="text-bordeaux-700">${m.icon}</span>
                <span class="flex-1 text-sm text-bordeaux-900">${m.label}</span>
                <span class="text-soft-300">${icons.chevron}</span>
              </button>`).join('')}
          </div>

          <button id="logout" class="w-full flex items-center justify-center gap-2 py-4 mt-4 text-bordeaux-600 font-medium">
            ${icons.logout} Sair da Conta
          </button>
        </div>
      </div>
    </div>
  `);

  const up = $('#upgrade', view);
  if (up) up.addEventListener('click', () => app.navigate('paywall', { trigger: 'profile' }));

  $$('[data-menu]', view).forEach((b) =>
    b.addEventListener('click', () => toast('Recurso disponível na versão final ✨'))
  );

  $('#logout', view).addEventListener('click', () => {
    logout();
    app.navigate('login');
  });

  return view;
}

function ini(name) {
  const p = name.trim().split(/\s+/);
  return ((p[0]?.[0] || '') + (p[1]?.[0] || '')).toUpperCase();
}
