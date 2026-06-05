/* ============================================================
   ui.js — Helpers de UI: criação de DOM, ícones, toast, navbar
   ============================================================ */

/** Cria um elemento a partir de uma string HTML (primeiro nó). */
export function h(html) {
  const tpl = document.createElement('template');
  tpl.innerHTML = html.trim();
  return tpl.content.firstElementChild;
}

/** Atalho para querySelector dentro de um root. */
export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

// ---------------- Ícones SVG (stroke currentColor) ----------------
export const icons = {
  home: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" class="w-6 h-6"><path d="M3 11l9-8 9 8"/><path d="M5 10v10h5v-6h4v6h5V10"/></svg>',
  calendar: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" class="w-6 h-6"><rect x="3" y="4" width="18" height="17" rx="3"/><path d="M3 9h18M8 2v4M16 2v4"/></svg>',
  users: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" class="w-6 h-6"><circle cx="9" cy="8" r="3.2"/><path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6"/><path d="M16 4.5a3 3 0 0 1 0 6M21 20c0-2.6-1.4-4.8-3.5-5.6"/></svg>',
  user: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" class="w-6 h-6"><circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 3.6-7 8-7s8 3 8 7"/></svg>',
  plus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" class="w-7 h-7"><path d="M12 5v14M5 12h14"/></svg>',
  check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" class="w-4 h-4"><path d="M4 12l5 5L20 6"/></svg>',
  spark: '<svg viewBox="0 0 24 24" fill="currentColor" class="w-5 h-5"><path d="M12 2l1.8 5.3L19 9l-5.2 1.7L12 16l-1.8-5.3L5 9l5.2-1.7L12 2z"/><circle cx="19" cy="4" r="1.4"/><circle cx="5" cy="18" r="1.2"/></svg>',
  back: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="w-6 h-6"><path d="M15 18l-6-6 6-6"/></svg>',
  chevron: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="w-5 h-5"><path d="M9 18l6-6-6-6"/></svg>',
  crown: '<svg viewBox="0 0 24 24" fill="currentColor" class="w-7 h-7"><path d="M3 7l4 4 5-7 5 7 4-4-2 12H5L3 7z"/></svg>',
  apple: '<svg viewBox="0 0 24 24" fill="currentColor" class="w-5 h-5"><path d="M16.4 12.8c0-2.3 1.9-3.4 2-3.5-1.1-1.6-2.8-1.8-3.4-1.8-1.4-.1-2.8.8-3.5.8s-1.8-.8-3-.8c-1.5 0-3 .9-3.8 2.3-1.6 2.8-.4 7 1.2 9.3.8 1.1 1.7 2.4 2.9 2.3 1.2 0 1.6-.7 3-.7s1.8.7 3 .7c1.2 0 2-1.1 2.8-2.2.9-1.3 1.2-2.5 1.3-2.6-.1 0-2.5-1-2.5-3.8zM14.3 5.9c.6-.8 1.1-1.9 1-3-.9 0-2.1.6-2.7 1.4-.6.7-1.1 1.8-1 2.9 1 .1 2.1-.5 2.7-1.3z"/></svg>',
  google: '<svg viewBox="0 0 24 24" class="w-5 h-5"><path fill="#4285F4" d="M22.5 12.2c0-.7-.1-1.4-.2-2H12v3.8h5.9c-.3 1.4-1 2.5-2.2 3.3v2.7h3.6c2.1-1.9 3.2-4.8 3.2-7.8z"/><path fill="#34A853" d="M12 23c2.9 0 5.4-1 7.2-2.6l-3.6-2.7c-1 .7-2.3 1.1-3.6 1.1-2.8 0-5.1-1.9-6-4.4H2.3v2.8C4.1 20.6 7.8 23 12 23z"/><path fill="#FBBC05" d="M6 14.4c-.2-.7-.4-1.4-.4-2.4s.1-1.6.4-2.4V6.8H2.3C1.5 8.4 1 10.1 1 12s.5 3.6 1.3 5.2L6 14.4z"/><path fill="#EA4335" d="M12 5.4c1.6 0 3 .5 4.1 1.6l3.1-3.1C17.4 2.1 14.9 1 12 1 7.8 1 4.1 3.4 2.3 6.8L6 9.6c.9-2.5 3.2-4.2 6-4.2z"/></svg>',
  logout: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" class="w-5 h-5"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/></svg>',
  trash: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" class="w-4 h-4"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m2 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M10 11v6M14 11v6"/></svg>',
  cog: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" class="w-5 h-5"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-2.7.7 1.6 1.6 0 0 0-1 1.5V22a2 2 0 0 1-4 0v-.1a1.6 1.6 0 0 0-1-1.5 1.6 1.6 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.6 1.6 0 0 0 .3-1.8 1.6 1.6 0 0 0-1.5-1H2a2 2 0 0 1 0-4h.1a1.6 1.6 0 0 0 1.5-1 1.6 1.6 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.6 1.6 0 0 0 1.8.3H8a1.6 1.6 0 0 0 1-1.5V2a2 2 0 0 1 4 0v.1a1.6 1.6 0 0 0 1 1.5 1.6 1.6 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0-.3 1.8V8a1.6 1.6 0 0 0 1.5 1H22a2 2 0 0 1 0 4h-.1a1.6 1.6 0 0 0-1.5 1z"/></svg>',
  bell: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" class="w-5 h-5"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.7 21a2 2 0 0 1-3.4 0"/></svg>',
  help: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" class="w-5 h-5"><circle cx="12" cy="12" r="10"/><path d="M9.1 9a3 3 0 0 1 5.8 1c0 2-3 2.5-3 2.5"/><path d="M12 17h.01"/></svg>',
  logo: '<svg viewBox="0 0 24 24" fill="currentColor" class="w-6 h-6"><path d="M12 2C8 2 5 5 5 9c0 3.5 2.5 5.8 4.5 7.5L12 22l2.5-5.5C16.5 14.8 19 12.5 19 9c0-4-3-7-7-7zm0 9.5A2.5 2.5 0 1 1 12 6.5a2.5 2.5 0 0 1 0 5z"/></svg>',
  // Isotipo oficial da marca (lótus "ML") — substitui o antigo pin de localização.
  logoImg: '<img src="assets/ML.png" alt="MenteLeve" class="h-9 w-auto object-contain select-none" draggable="false" />',
  chat: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" class="w-6 h-6"><path d="M21 11.5a8.5 8.5 0 0 1-12.2 7.7L3 21l1.8-5.8A8.5 8.5 0 1 1 21 11.5z"/><path d="M8.5 12h.01M12 12h.01M15.5 12h.01"/></svg>',
  send: '<svg viewBox="0 0 24 24" fill="currentColor" class="w-5 h-5"><path d="M3.4 20.4l17.4-7.5c.9-.4.9-1.6 0-2L3.4 3.6c-.7-.3-1.5.3-1.4 1.1L3.2 11l9 1-9 1-1.2 5.3c-.1.8.7 1.4 1.4 1.1z"/></svg>',
};

/** Toast efêmero dentro da moldura do device. */
export function toast(message, ms = 2200) {
  const host = document.getElementById('device');
  const el = h(`
    <div class="toast">
      <div class="flex items-center gap-2 bg-bordeaux-900 text-white text-sm font-medium px-4 py-2.5 rounded-full shadow-lg max-w-[300px]">
        <span>${message}</span>
      </div>
    </div>`);
  host.appendChild(el);
  setTimeout(() => {
    el.classList.add('out');
    setTimeout(() => el.remove(), 250);
  }, ms);
}

export const NAV_ITEMS = [
  { id: 'home', label: 'Home', icon: icons.home },
  { id: 'agenda', label: 'Agenda', icon: icons.calendar },
  { id: 'bruna', label: 'Bruna', icon: icons.chat },
  { id: 'connections', label: 'Conexões', icon: icons.users },
  { id: 'profile', label: 'Perfil', icon: icons.user },
];

/**
 * Renderiza a navegação persistente do shell:
 *  - Desktop → sidebar lateral fixa (#sidenav), Night Bordeaux
 *  - Mobile  → bottom bar (#bottomnav)
 * Quando `active` é null, esconde a navegação (telas de fluxo).
 */
export function renderNav(active, onNavigate, opts = {}) {
  const side = document.getElementById('sidenav');
  const bottom = document.getElementById('bottomnav');
  const root = document.getElementById('root');

  if (!active) {
    side.innerHTML = '';
    bottom.innerHTML = '';
    root.classList.add('is-fullbleed');
    return;
  }
  root.classList.remove('is-fullbleed');

  // ---- Sidebar (desktop) ----
  side.innerHTML = `
    <div class="flex items-center gap-2 px-2 mb-8">
      <span class="grid place-items-center w-10 h-10 rounded-xl bg-white shadow-fab">
        <img src="assets/ML.png" alt="" class="h-7 w-auto select-none" draggable="false" />
      </span>
      <span class="font-serif font-bold text-xl text-white">MenteLeve</span>
    </div>
    <nav class="flex flex-col gap-1">
      ${NAV_ITEMS.map((it) => navSideItem(it, active)).join('')}
    </nav>
    <div class="mt-auto pt-6">
      ${opts.premium ? `
        <div class="flex items-center gap-2 text-soft-100 text-xs bg-white/5 rounded-2xl px-3 py-3">
          <span class="text-accent">${icons.crown}</span> Premium ativo
        </div>` : `
        <button data-side-action="upgrade"
          class="w-full flex items-center justify-center gap-2 py-3 rounded-full bg-accent hover:bg-accent-hover text-white text-sm font-semibold transition">
          ${icons.crown} Fazer Upgrade
        </button>`}
    </div>`;

  $$('[data-tab]', side).forEach((b) =>
    b.addEventListener('click', () => onNavigate(b.dataset.tab))
  );
  const up = side.querySelector('[data-side-action="upgrade"]');
  if (up && opts.onUpgrade) up.addEventListener('click', opts.onUpgrade);

  // ---- Bottom bar (mobile) ----
  bottom.innerHTML = `
    <div class="flex items-center justify-around px-2 py-2">
      ${NAV_ITEMS.map((it) => `
        <button data-tab="${it.id}"
          class="flex flex-col items-center gap-0.5 px-3 py-1 transition-colors ${active === it.id ? 'is-active text-bordeaux-900' : 'text-soft-300'}">
          ${it.icon}
          <span class="text-[10px] font-medium">${it.label}</span>
        </button>`).join('')}
    </div>`;
  $$('[data-tab]', bottom).forEach((b) =>
    b.addEventListener('click', () => onNavigate(b.dataset.tab))
  );
}

function navSideItem(it, active) {
  const on = it.id === active;
  return `
    <button data-tab="${it.id}"
      class="flex items-center gap-3 px-3 py-3 rounded-2xl text-sm font-medium transition
             ${on ? 'bg-accent text-white shadow-fab' : 'text-soft-100 hover:bg-white/10'}">
      ${it.icon}<span>${it.label}</span>
    </button>`;
}

/** Detecta o modo desktop (≥1024px). */
export const isDesktop = () => window.matchMedia('(min-width: 1024px)').matches;
