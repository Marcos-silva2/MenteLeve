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

// ---- Splash de abertura ----
function hideSplash() {
  const s = document.getElementById('splash');
  if (!s || s.classList.contains('hide')) return;
  s.classList.add('hide');
  setTimeout(() => s.remove(), 700);
}
(function setupSplash() {
  const s = document.getElementById('splash');
  if (!s) return;
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Gera as partículas (carga mental dispersa) que convergem ao centro.
  const host = document.getElementById('splash-particles');
  if (host && !reduce) {
    const colors = ['#ff8fa3', '#ffccd5', '#ffb3c1']; // Cotton Candy / Pastel Petal / Cherry Blossom
    const N = 14;
    for (let i = 0; i < N; i++) {
      const angle = (i / N) * Math.PI * 2 + Math.random() * 0.4;
      const dist = 32 + Math.random() * 16;           // vmin a partir do centro
      const dx = (Math.cos(angle) * dist).toFixed(1) + 'vmin';
      const dy = (Math.sin(angle) * dist).toFixed(1) + 'vmin';
      const size = (6 + Math.random() * 7).toFixed(0);
      const p = document.createElement('span');
      p.className = 'particle';
      p.style.setProperty('--dx', dx);
      p.style.setProperty('--dy', dy);
      p.style.width = size + 'px';
      p.style.height = size + 'px';
      p.style.background = colors[i % colors.length];
      p.style.animationDelay = (0.5 + Math.random() * 0.35).toFixed(2) + 's';
      host.appendChild(p);
    }
  }

  // Duração total do roteiro (~3.5s + fade); curtíssima se prefere menos movimento.
  setTimeout(hideSplash, reduce ? 400 : 3800);
  // permite pular tocando na tela
  s.addEventListener('click', hideSplash);
})();

// Registra o service worker (PWA) — só funciona via http(s).
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  });
}

start();
