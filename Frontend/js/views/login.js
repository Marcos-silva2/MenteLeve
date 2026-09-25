/* ============================================================
   Login — Autenticação com e-mail + senha (Tela 2)
   O cadastro fica na tela própria (views/register.js).
   ============================================================ */

import { h, $, icons, logoMark, attachPasswordToggle, friendlyError } from '../ui.js';
import { login, verifyLoginCode } from '../store.js';
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
          class="btn btn-primary mt-1 w-full py-3.5">
          Entrar
        </button>
      </form>

      <!-- código de verificação (A2F) — só aparece se o backend tiver
           RESEND_API_KEY configurada; ver store.login()/otp-required. -->
      <form id="otp-form" class="hidden flex-col gap-3.5" novalidate>
        <p class="text-sm text-bordeaux-900/80 text-center">
          Enviamos um código de verificação pro seu e-mail. Digite abaixo.
        </p>
        <div>
          <input id="otp-code" inputmode="numeric" autocomplete="one-time-code" maxlength="8" placeholder="000000"
            class="w-full px-4 py-3.5 rounded-2xl bg-white border border-soft-100 text-bordeaux-900 text-center text-2xl tracking-[0.4em] placeholder-muted
                   focus:border-accent focus:ring-4 focus:ring-accent/15 outline-none transition" />
          <p data-err="otp" class="hidden text-xs text-bordeaux-600 mt-1 ml-1 text-center"></p>
        </div>
        <button type="submit" class="btn btn-primary mt-1 w-full py-3.5">Confirmar</button>
        <div class="flex items-center justify-between text-sm">
          <button type="button" id="otp-back" class="text-bordeaux-600 hover:underline min-h-11 px-1">Usar outro e-mail</button>
          <button type="button" id="otp-resend" class="text-bordeaux-600 hover:underline min-h-11 px-1">Reenviar código</button>
        </div>
      </form>

      <div id="alt-methods">
        <p class="text-center text-sm text-bordeaux-900/70 mt-5">
          Ainda não tem conta?
          <button id="go-register" class="font-semibold text-bordeaux-600 hover:underline min-h-11 px-1">Criar conta</button>
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

  const otpForm = $('#otp-form', view);
  const otpInput = $('#otp-code', view);
  const altMethods = $('#alt-methods', view);
  // Guardadas só em memória (nunca em localStorage) pra permitir "Reenviar
  // código" sem pedir a senha de novo — mesma janela de confiança do campo
  // de senha em si, que também já está em memória no momento do submit.
  let pendingEmail = '';
  let pendingPassword = '';

  function showErr(field, msg) {
    const p = view.querySelector(`[data-err="${field}"]`);
    const input = field === 'email' ? emailEl : field === 'otp' ? otpInput : passEl;
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

    const email = emailEl.value.trim();
    const password = passEl.value;

    try {
      const result = await login({ email, password });
      view.dataset.loading = '0';
      if (result.status === 'otp') {
        pendingEmail = email;
        pendingPassword = password;
        submitBtn.textContent = original;
        submitBtn.disabled = false;
        showOtpStep(result.email);
        return;
      }
      app.navigate('home');
    } catch (err) {
      submitBtn.textContent = original;
      submitBtn.disabled = false;
      view.dataset.loading = '0';
      playError();
      if (err && (err.status === 401 || err.status === 429)) {
        // 401 genérico de propósito (não revela se o e-mail tem conta); 429 = limite de tentativas
        showErr('password', friendlyError(err, 'auth'));
      } else {
        // Conexão, servidor indisponível ou erro inesperado: cada um com a sua frase.
        app.toast(friendlyError(err, 'auth'), 4200);
      }
    }
  });

  function showOtpStep(email) {
    form.classList.add('hidden');
    altMethods.classList.add('hidden');
    otpForm.classList.remove('hidden');
    otpForm.classList.add('flex');
    otpInput.value = '';
    showErr('otp', '');
    app.toast(`Código enviado para ${email} 💗`, 3200);
    setTimeout(() => otpInput.focus(), 80);
  }

  function backToCredentials() {
    otpForm.classList.add('hidden');
    otpForm.classList.remove('flex');
    form.classList.remove('hidden');
    altMethods.classList.remove('hidden');
    pendingPassword = '';
    showErr('otp', '');
  }

  const otpSubmitBtn = otpForm.querySelector('button[type="submit"]');
  otpForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const code = otpInput.value.trim();
    if (!code) { showErr('otp', 'Digite o código recebido por e-mail.'); return; }

    if (otpForm.dataset.loading === '1') return;
    otpForm.dataset.loading = '1';
    const original = otpSubmitBtn.textContent;
    otpSubmitBtn.textContent = 'Confirmando…';
    otpSubmitBtn.disabled = true;

    try {
      await verifyLoginCode({ email: pendingEmail, code });
      app.navigate('home');
    } catch (err) {
      otpSubmitBtn.textContent = original;
      otpSubmitBtn.disabled = false;
      otpForm.dataset.loading = '0';
      playError();
      if (err && err.status === 401) {
        showErr('otp', friendlyError(err, 'otp'));
      } else {
        app.toast(friendlyError(err, 'auth'), 4200);
      }
    }
  });

  $('#otp-back', view).addEventListener('click', backToCredentials);
  $('#otp-resend', view).addEventListener('click', async () => {
    if (!pendingEmail || !pendingPassword) { backToCredentials(); return; }
    try {
      await login({ email: pendingEmail, password: pendingPassword });
      showOtpStep(pendingEmail);
    } catch (_) {
      // Sessão de reenvio expirou de algum jeito incomum (ex.: rate limit) —
      // volta pro início em vez de deixar o botão de reenviar preso num erro.
      backToCredentials();
      app.toast('Não foi possível reenviar agora. Entre de novo.', 3500);
    }
  });

  $('#go-register', view).addEventListener('click', () => app.navigate('register'));

  view.querySelectorAll('[data-social]').forEach((b) =>
    b.addEventListener('click', () => app.toast('Login social em breve. Use e-mail e senha por enquanto.'))
  );

  return view;
}
