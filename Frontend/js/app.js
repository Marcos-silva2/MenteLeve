/* ============================================================
   app.js — Bootstrap + mini-router
   ============================================================ */

import { isOnboardingSeen, getUser, isPremium, restoreSession } from './store.js';
import { toast, renderNav } from './ui.js';

import { renderOnboarding } from './views/onboarding.js';
import { renderLogin } from './views/login.js';
import { renderHome } from './views/home.js';
import { renderAgenda } from './views/agenda.js';
import { renderConnections } from './views/connections.js';
import { renderPaywall } from './views/paywall.js';
import { renderProfile } from './views/profile.js';

const routes = {
  onboarding: renderOnboarding,
  login: renderLogin,
  home: renderHome,
  agenda: renderAgenda,
  connections: renderConnections,
  paywall: renderPaywall,
  profile: renderProfile,
};

const appEl = document.getElementById('app');

// Contexto passado a todas as views.
export const app = {
  navigate,
  toast,
  current: null,
  // Re-renderiza a rota atual (usado após sincronizar dados do backend).
  refresh: () => navigate(app.current),
};

// Abas que podem ser refletidas na URL (deep-link / restaurar ao recarregar).
const TAB_ROUTES = ['home', 'agenda', 'connections', 'profile'];

function navigate(route, params = {}) {
  const render = routes[route];
  if (!render) {
    console.warn('Rota desconhecida:', route);
    return;
  }
  app.current = route;
  appEl.innerHTML = '';
  const view = render(app, params);
  view.classList.add('view-enter');
  appEl.appendChild(view);
  appEl.scrollTop = 0;

  // Navegação persistente do shell (sidebar desktop / bottom bar mobile).
  // Telas de fluxo (onboarding/login/paywall) não exibem navegação.
  if (TAB_ROUTES.includes(route)) {
    renderNav(route, navigate, {
      premium: isPremium(),
      onUpgrade: () => navigate('paywall', { trigger: 'profile' }),
    });
  } else {
    renderNav(null, navigate);
  }

  // Reflete a aba atual no hash (sem disparar o handler de hashchange).
  if (TAB_ROUTES.includes(route) && location.hash.slice(1) !== route) {
    suppressHash = true;
    location.hash = route;
  }
}

let suppressHash = false;
window.addEventListener('hashchange', () => {
  if (suppressHash) { suppressHash = false; return; }
  const route = location.hash.slice(1);
  if (TAB_ROUTES.includes(route) && getUser()) navigate(route);
});

function start() {
  const hashRoute = location.hash.slice(1);
  if (!isOnboardingSeen()) {
    navigate('onboarding');
  } else if (!getUser()) {
    navigate('login');
  } else {
    // Mostra imediatamente a partir do cache local (UI instantânea)...
    if (TAB_ROUTES.includes(hashRoute) || hashRoute === 'paywall') navigate(hashRoute);
    else navigate('home');

    // ...e re-hidrata do backend em segundo plano, re-renderizando se mudou.
    restoreSession()
      .then((updated) => {
        if (updated && TAB_ROUTES.includes(app.current)) app.refresh();
      })
      .catch(() => {});
  }
}

// Registra o service worker (PWA) — só funciona via http(s).
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  });
}

start();
