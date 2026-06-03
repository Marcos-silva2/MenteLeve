/* ============================================================
   Login / Cadastro — Autenticação rápida (Tela 2)
   MVP: sem OAuth real. Email vira identificador (localStorage).
   ============================================================ */

import { h, $, icons } from '../ui.js';
import { login } from '../store.js';

export function renderLogin(app) {
  const view = h(`
    <div class="h-full flex flex-col px-7 pt-16 pb-10 lg:max-w-md lg:mx-auto lg:w-full lg:justify-center lg:pt-0">
      <!-- logo -->
      <div class="flex flex-col items-center text-center mb-10">
        <div class="flex items-center gap-1.5 text-bordeaux-900 mb-8">
          <span class="text-accent">${icons.logo}</span>
          <span class="font-serif font-bold text-xl">MenteLeve</span>
        </div>
        <h1 class="font-serif font-bold text-bordeaux-900 text-[28px] leading-tight">
          Sua mente mais leve a<br/>um clique de distância
        </h1>
      </div>

      <!-- form -->
      <form id="form" class="flex flex-col gap-3.5" novalidate>
        <div>
          <input id="email" type="email" inputmode="email" autocomplete="email" placeholder="Seu e-mail"
            class="w-full px-4 py-3.5 rounded-2xl bg-white border border-soft-100 text-bordeaux-900 placeholder-soft-300
                   focus:border-accent focus:ring-4 focus:ring-accent/15 outline-none transition" />
          <p data-err="email" class="hidden text-xs text-bordeaux-600 mt-1 ml-1"></p>
        </div>
        <div>
          <input id="password" type="password" autocomplete="current-password" placeholder="Sua senha"
            class="w-full px-4 py-3.5 rounded-2xl bg-white border border-soft-100 text-bordeaux-900 placeholder-soft-300
                   focus:border-accent focus:ring-4 focus:ring-accent/15 outline-none transition" />
          <p data-err="password" class="hidden text-xs text-bordeaux-600 mt-1 ml-1"></p>
        </div>

        <button type="submit"
          class="mt-1 w-full py-3.5 rounded-full bg-accent hover:bg-accent-hover text-white font-semibold shadow-fab active:scale-[.98] transition">
          Continuar
        </button>
      </form>

      <!-- divisor -->
      <div class="flex items-center gap-3 my-6">
        <span class="flex-1 h-px bg-soft-100"></span>
        <span class="text-xs text-soft-300">ou continue com</span>
        <span class="flex-1 h-px bg-soft-100"></span>
      </div>

      <!-- social -->
      <div class="flex flex-col gap-3">
        <button data-social="apple"
          class="w-full py-3.5 rounded-full bg-white border border-soft-100 text-bordeaux-900 font-medium flex items-center justify-center gap-2 active:scale-[.98] transition">
          ${icons.apple} Entrar com Apple
        </button>
        <button data-social="google"
          class="w-full py-3.5 rounded-full bg-white border border-soft-100 text-bordeaux-900 font-medium flex items-center justify-center gap-2 active:scale-[.98] transition">
          ${icons.google} Entrar com Google
        </button>
      </div>

      <p class="mt-auto text-center text-[11px] text-soft-300 pt-8">
        Ao continuar você concorda com os Termos e a Política de Privacidade.
      </p>
    </div>
  `);

  const form = $('#form', view);
  const emailEl = $('#email', view);
  const passEl = $('#password', view);

  function showErr(field, msg) {
    const p = view.querySelector(`[data-err="${field}"]`);
    const input = field === 'email' ? emailEl : passEl;
    if (msg) {
      p.textContent = msg;
      p.classList.remove('hidden');
      input.classList.add('border-bordeaux-600');
    } else {
      p.classList.add('hidden');
      input.classList.remove('border-bordeaux-600');
    }
  }

  function validate() {
    let ok = true;
    const email = emailEl.value.trim();
    const pass = passEl.value;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { showErr('email', 'Digite um e-mail válido.'); ok = false; }
    else showErr('email', '');
    if (pass.length < 6) { showErr('password', 'A senha precisa ter ao menos 6 caracteres.'); ok = false; }
    else showErr('password', '');
    return ok;
  }

  emailEl.addEventListener('input', () => showErr('email', ''));
  passEl.addEventListener('input', () => showErr('password', ''));

  const submitBtn = form.querySelector('button[type="submit"]');

  async function doLogin(credentials) {
    // bloqueia reentrância e dá feedback enquanto autentica
    if (view.dataset.loading === '1') return;
    view.dataset.loading = '1';
    const original = submitBtn.textContent;
    submitBtn.textContent = 'Entrando…';
    submitBtn.disabled = true;
    try {
      await login(credentials);
      app.navigate('home');
    } catch (_) {
      submitBtn.textContent = original;
      submitBtn.disabled = false;
      view.dataset.loading = '0';
      app.toast('Não foi possível entrar. Tente novamente.');
    }
  }

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    if (!validate()) return;
    doLogin({ email: emailEl.value.trim() });
  });

  view.querySelectorAll('[data-social]').forEach((b) =>
    b.addEventListener('click', () => {
      // MVP: simula login social com um e-mail fictício do provedor.
      const provider = b.dataset.social;
      doLogin({ name: 'Sofia', email: `sofia@${provider}.com` });
    })
  );

  return view;
}
