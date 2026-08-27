/* ============================================================
   Criar conta — Cadastro com nome, e-mail e senha
   Segue o mesmo padrão visual e de validação do login.js.
   ============================================================ */

import { h, $, icons } from '../ui.js';
import { register } from '../store.js';

export function renderRegister(app) {
  const view = h(`
    <div class="h-full flex flex-col px-7 pt-16 pb-10 lg:max-w-md lg:mx-auto lg:w-full lg:justify-center lg:pt-0">
      <!-- logo -->
      <div class="flex flex-col items-center text-center mb-10">
        <div class="flex items-center gap-2 text-bordeaux-900 mb-8">
          ${icons.logoImg}
          <span class="font-serif font-bold text-xl">MenteLeve</span>
        </div>
        <h1 class="font-serif font-bold text-bordeaux-900 text-[28px] leading-tight">
          Vamos deixar a sua<br/>mente mais leve
        </h1>
      </div>

      <!-- form -->
      <form id="form" class="flex flex-col gap-3.5" novalidate>
        <div>
          <input id="name" type="text" autocomplete="given-name" placeholder="Como podemos te chamar?"
            class="w-full px-4 py-3.5 rounded-2xl bg-white border border-soft-100 text-bordeaux-900 placeholder-soft-300
                   focus:border-accent focus:ring-4 focus:ring-accent/15 outline-none transition" />
          <p data-err="name" class="hidden text-xs text-bordeaux-600 mt-1 ml-1"></p>
        </div>
        <div>
          <input id="email" type="email" inputmode="email" autocomplete="email" placeholder="Seu e-mail"
            class="w-full px-4 py-3.5 rounded-2xl bg-white border border-soft-100 text-bordeaux-900 placeholder-soft-300
                   focus:border-accent focus:ring-4 focus:ring-accent/15 outline-none transition" />
          <p data-err="email" class="hidden text-xs text-bordeaux-600 mt-1 ml-1"></p>
        </div>
        <div>
          <input id="password" type="password" autocomplete="new-password" placeholder="Crie uma senha"
            class="w-full px-4 py-3.5 rounded-2xl bg-white border border-soft-100 text-bordeaux-900 placeholder-soft-300
                   focus:border-accent focus:ring-4 focus:ring-accent/15 outline-none transition" />
          <p data-err="password" class="hidden text-xs text-bordeaux-600 mt-1 ml-1"></p>
          <p class="text-[11px] text-soft-300 mt-1 ml-1">Pelo menos 6 caracteres.</p>
        </div>

        <button type="submit"
          class="mt-1 w-full py-3.5 rounded-full bg-accent hover:bg-accent-hover text-white font-semibold shadow-fab active:scale-[.98] transition">
          Criar conta
        </button>
      </form>

      <p class="text-center text-sm text-bordeaux-900/70 mt-5">
        Já tem conta?
        <button id="go-login" class="font-semibold text-accent hover:underline">Entrar</button>
      </p>

      <p class="mt-auto text-center text-[11px] text-soft-300 pt-8">
        Ao criar sua conta você concorda com os Termos e a Política de Privacidade.
      </p>
    </div>
  `);

  const form = $('#form', view);
  const nameEl = $('#name', view);
  const emailEl = $('#email', view);
  const passEl = $('#password', view);
  const fields = { name: nameEl, email: emailEl, password: passEl };

  function showErr(field, msg) {
    const p = view.querySelector(`[data-err="${field}"]`);
    const input = fields[field];
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
    if (!nameEl.value.trim()) { showErr('name', 'Digite o seu nome.'); ok = false; }
    else showErr('name', '');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailEl.value.trim())) { showErr('email', 'Digite um e-mail válido.'); ok = false; }
    else showErr('email', '');
    if (passEl.value.length < 6) { showErr('password', 'A senha precisa ter ao menos 6 caracteres.'); ok = false; }
    else showErr('password', '');
    return ok;
  }

  Object.entries(fields).forEach(([key, el]) =>
    el.addEventListener('input', () => showErr(key, ''))
  );

  const submitBtn = form.querySelector('button[type="submit"]');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!validate()) return;

    if (view.dataset.loading === '1') return;
    view.dataset.loading = '1';
    const original = submitBtn.textContent;
    submitBtn.textContent = 'Criando…';
    submitBtn.disabled = true;

    try {
      await register({
        name: nameEl.value.trim(),
        email: emailEl.value.trim(),
        password: passEl.value,
      });
      app.navigate('home');
    } catch (err) {
      submitBtn.textContent = original;
      submitBtn.disabled = false;
      view.dataset.loading = '0';
      if (err && err.status === 409) {
        showErr('email', 'Este e-mail já tem uma conta. Tente entrar.');
      } else {
        app.toast('Não foi possível criar a conta. Tente novamente.');
      }
    }
  });

  $('#go-login', view).addEventListener('click', () => app.navigate('login'));

  return view;
}
