/* ============================================================
   Login — Autenticação com e-mail + senha (Tela 2)
   O cadastro fica na tela própria (views/register.js).
   ============================================================ */

import { h, $, icons, logoMark, attachPasswordToggle } from '../ui.js';
import { login } from '../store.js';
import { playError } from '../sound.js';

export function renderLogin(app) {
  const view = h(`
    <div class="h-full flex flex-col px-7 pt-16 pb-10 lg:max-w-md lg:mx-auto lg:w-full lg:justify-center lg:pt-0">
      <!-- logo -->
      <div class="flex flex-col items-center text-center mb-10">
        <div class="flex items-center gap-2 text-bordeaux-900 mb-8">
          ${logoMark('h-9 w-auto', true)}
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
            class="w-full px-4 py-3.5 rounded-2xl bg-white border border-soft-100 text-bordeaux-900 placeholder-muted
                   focus:border-accent focus:ring-4 focus:ring-accent/15 outline-none transition" />
          <p data-err="email" class="hidden text-xs text-bordeaux-600 mt-1 ml-1"></p>
        </div>
        <div>
          <input id="password" type="password" autocomplete="current-password" placeholder="Sua senha"
            class="w-full px-4 py-3.5 rounded-2xl bg-white border border-soft-100 text-bordeaux-900 placeholder-muted
                   focus:border-accent focus:ring-4 focus:ring-accent/15 outline-none transition" />
          <p data-err="password" class="hidden text-xs text-bordeaux-600 mt-1 ml-1"></p>
        </div>

        <button type="submit"
          class="mt-1 w-full py-3.5 rounded-full bg-accent hover:bg-accent-hover text-white font-semibold shadow-fab active:scale-[.98] transition">
          Entrar
        </button>
      </form>

      <p class="text-center text-sm text-bordeaux-900/70 mt-5">
        Ainda não tem conta?
        <button id="go-register" class="font-semibold text-accent hover:underline">Criar conta</button>
      </p>

      <!-- divisor -->
      <div class="flex items-center gap-3 my-6">
        <span class="flex-1 h-px bg-soft-100"></span>
        <span class="text-xs text-muted">ou continue com</span>
        <span class="flex-1 h-px bg-soft-100"></span>
      </div>

      <!-- social (ainda não implementado — ver Roadmap)
           O botão dizia duas coisas ao mesmo tempo: cursor-not-allowed (não
           clique) e um toast explicativo ao clicar (pode clicar). E o texto a
           50% rendia 3,2:1, ilegível. Agora o selo "em breve" diz o estado por
           escrito, o clique segue explicando, e aria-disabled conta o mesmo a
           quem usa leitor de tela — a quem o cursor nunca disse nada. -->
      <div class="flex flex-col gap-3">
        ${[['apple', 'Apple'], ['google', 'Google']].map(([id, nome]) => `
          <button data-social="${id}" aria-disabled="true"
            class="w-full py-3.5 rounded-full bg-white border border-soft-100 text-muted font-medium flex items-center justify-center gap-2 transition hover:border-soft-200">
            ${icons[id]} Entrar com ${nome}
            <span class="text-[10px] font-semibold uppercase tracking-wide bg-soft-100 text-bordeaux-700 rounded-full px-2 py-0.5">em breve</span>
          </button>`).join('')}
      </div>

      <p class="mt-auto text-center text-[11px] text-muted pt-8">
        Ao continuar você concorda com os Termos e a Política de Privacidade.
      </p>
    </div>
  `);

  const form = $('#form', view);
  const emailEl = $('#email', view);
  const passEl = $('#password', view);
  attachPasswordToggle(passEl);

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

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!validate()) return;

    // bloqueia reentrância e dá feedback enquanto autentica
    if (view.dataset.loading === '1') return;
    view.dataset.loading = '1';
    const original = submitBtn.textContent;
    submitBtn.textContent = 'Entrando…';
    submitBtn.disabled = true;

    try {
      await login({ email: emailEl.value.trim(), password: passEl.value });
      app.navigate('home');
    } catch (err) {
      submitBtn.textContent = original;
      submitBtn.disabled = false;
      view.dataset.loading = '0';
      playError();
      if (err && err.status === 401) {
        // Mensagem genérica de propósito: não revela se o e-mail tem conta.
        showErr('password', 'E-mail ou senha incorretos.');
      } else if (err && err.status === 429) {
        // Limite de tentativas do backend. Sem esta mensagem, o genérico
        // "tente novamente" convidaria a usuária a fazer exatamente o que
        // está bloqueado.
        showErr('password', 'Muitas tentativas. Aguarde alguns minutos e tente de novo.');
      } else {
        app.toast('Não foi possível entrar. Tente novamente.');
      }
    }
  });

  $('#go-register', view).addEventListener('click', () => app.navigate('register'));

  view.querySelectorAll('[data-social]').forEach((b) =>
    b.addEventListener('click', () => app.toast('Login social em breve. Use e-mail e senha por enquanto.'))
  );

  return view;
}
