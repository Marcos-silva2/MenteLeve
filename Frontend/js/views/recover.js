/* ============================================================
   Recuperação de senha
   - renderForgot: pede o link por e-mail (POST /auth/forgot-password)
   - renderReset : define a nova senha com o token do link
                   (POST /auth/reset-password). O link do e-mail abre o app em
                   `#reset=<token>`; o app.js lê e passa o token por `params`.
   ============================================================ */

import { h, $, logoMark, attachPasswordToggle, friendlyError } from '../ui.js';
import { apiForgotPassword, apiResetPassword } from '../api.js';
import { playError, playAdd } from '../sound.js';

const FIELD_CLS = `w-full px-4 py-3.5 rounded-2xl bg-white border border-soft-100 text-bordeaux-900 placeholder-muted
                   focus:border-accent focus:ring-4 focus:ring-accent/15 outline-none transition`;
const BTN_CLS = `btn btn-primary w-full py-3.5 disabled:opacity-70`;
const WRAP_CLS = 'h-full flex flex-col px-7 pt-16 pb-10 lg:max-w-md lg:mx-auto lg:w-full lg:justify-center lg:pt-0';

function header(title, sub) {
  return `
    <div class="flex flex-col items-center text-center mb-8">
      <div class="flex items-center gap-2 text-bordeaux-900 mb-6">
        ${logoMark('h-9 w-auto', true)}
        <span class="font-serif font-bold text-xl">MenteLeve</span>
      </div>
      <h1 class="font-serif font-bold text-bordeaux-900 text-[26px] leading-tight">${title}</h1>
      <p class="text-sm text-bordeaux-700 mt-2 max-w-[300px]">${sub}</p>
    </div>`;
}

/** Mostra/limpa a mensagem de erro de um campo (ou do formulário, com field = 'form'). */
function fieldError(view, field, input, msg) {
  const p = view.querySelector(`[data-err="${field}"]`);
  if (!p) return;
  if (msg) {
    p.textContent = msg;
    p.classList.remove('hidden');
    if (input) input.classList.add('border-bordeaux-600');
  } else {
    p.classList.add('hidden');
    if (input) input.classList.remove('border-bordeaux-600');
  }
}

// ------------------------------------------------------------
// 1) "Esqueceu sua senha?" — pedir o link
// ------------------------------------------------------------
export function renderForgot(app) {
  const view = h(`
    <div class="${WRAP_CLS}">
      ${header('Vamos recuperar seu acesso', 'Digite o e-mail da sua conta e enviaremos um link para criar uma nova senha.')}

      <form id="form" class="flex flex-col gap-3.5" novalidate>
        <div>
          <input id="email" type="email" inputmode="email" autocomplete="email" placeholder="Seu e-mail" class="${FIELD_CLS}" />
          <p data-err="email" class="hidden text-xs text-bordeaux-600 mt-1 ml-1"></p>
        </div>
        <p data-err="form" role="alert" class="hidden text-xs text-bordeaux-600 ml-1"></p>
        <button type="submit" class="mt-1 ${BTN_CLS}">Enviar link</button>
      </form>

      <p class="text-center text-sm text-bordeaux-900/70 mt-5">
        Lembrou?
        <button id="go-login" class="font-semibold text-bordeaux-600 hover:underline min-h-11 px-1">Voltar para o login</button>
      </p>
    </div>
  `);

  const form = $('#form', view);
  const emailEl = $('#email', view);
  const btn = form.querySelector('button[type="submit"]');

  emailEl.addEventListener('input', () => { fieldError(view, 'email', emailEl, ''); fieldError(view, 'form', null, ''); });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = emailEl.value.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      fieldError(view, 'email', emailEl, 'Digite um e-mail válido.');
      return;
    }
    if (view.dataset.loading === '1') return;
    view.dataset.loading = '1';
    btn.disabled = true;
    btn.textContent = 'Enviando…';

    try {
      await apiForgotPassword(email);
      // A resposta é a mesma exista a conta ou não (o servidor não revela) — a
      // tela também não: "se houver conta, o e-mail chega".
      showSent(email);
    } catch (err) {
      view.dataset.loading = '0';
      btn.disabled = false;
      btn.textContent = 'Enviar link';
      playError();
      fieldError(view, 'form', null, friendlyError(err, 'reset'));
    }
  });

  function showSent(email) {
    playAdd();
    view.innerHTML = `
      ${header('Confira seu e-mail 💌', 'Se houver uma conta com esse endereço, o link já está a caminho.')}
      <div class="bg-white border border-soft-100 rounded-2xl shadow-card p-4 text-sm text-bordeaux-800">
        <p>Enviamos as instruções para <strong class="break-all"></strong>.</p>
        <p class="mt-2 text-bordeaux-700">O link vale por 30 minutos e só funciona uma vez. Não chegou? Olhe a caixa de spam.</p>
      </div>
      <button id="back" class="mt-6 ${BTN_CLS}">Voltar para o login</button>
      <button id="again" class="btn btn-secondary mt-3 w-full">Usar outro e-mail</button>`;
    // textContent: o e-mail digitado nunca entra como HTML.
    view.querySelector('strong').textContent = email;
    $('#back', view).addEventListener('click', () => app.navigate('login'));
    $('#again', view).addEventListener('click', () => app.navigate('forgot'));
  }

  $('#go-login', view).addEventListener('click', () => app.navigate('login'));
  setTimeout(() => emailEl.focus(), 80);
  return view;
}

// ------------------------------------------------------------
// 2) Nova senha — token vindo do link (ou colado à mão)
// ------------------------------------------------------------
export function renderReset(app, params = {}) {
  const tokenFromLink = typeof params.token === 'string' ? params.token.trim() : '';

  const view = h(`
    <div class="${WRAP_CLS}">
      ${header('Crie sua nova senha', 'Escolha uma senha que você lembre com facilidade. Ela vale a partir de agora.')}

      <form id="form" class="flex flex-col gap-3.5" novalidate>
        ${tokenFromLink ? '' : `
        <div>
          <input id="token" type="text" autocomplete="off" autocapitalize="off" spellcheck="false"
            placeholder="Código do link (cole aqui)" class="${FIELD_CLS}" />
          <p data-err="token" class="hidden text-xs text-bordeaux-600 mt-1 ml-1"></p>
        </div>`}
        <div>
          <input id="password" type="password" autocomplete="new-password" placeholder="Nova senha" class="${FIELD_CLS}" />
          <p data-err="password" class="hidden text-xs text-bordeaux-600 mt-1 ml-1"></p>
        </div>
        <div>
          <input id="confirm" type="password" autocomplete="new-password" placeholder="Repita a nova senha" class="${FIELD_CLS}" />
          <p data-err="confirm" class="hidden text-xs text-bordeaux-600 mt-1 ml-1"></p>
        </div>
        <p data-err="form" role="alert" class="hidden text-xs text-bordeaux-600 ml-1"></p>
        <button type="submit" class="mt-1 ${BTN_CLS}">Salvar nova senha</button>
      </form>

      <p class="text-center text-sm text-bordeaux-900/70 mt-5">
        <button id="new-link" class="font-semibold text-bordeaux-600 hover:underline min-h-11 px-1">Pedir um novo link</button>
      </p>
    </div>
  `);

  const form = $('#form', view);
  const tokenEl = $('#token', view);
  const passEl = $('#password', view);
  const confEl = $('#confirm', view);
  const btn = form.querySelector('button[type="submit"]');
  attachPasswordToggle(passEl);
  attachPasswordToggle(confEl);

  for (const [el, name] of [[tokenEl, 'token'], [passEl, 'password'], [confEl, 'confirm']]) {
    if (el) el.addEventListener('input', () => { fieldError(view, name, el, ''); fieldError(view, 'form', null, ''); });
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const token = tokenFromLink || (tokenEl ? tokenEl.value.trim() : '');
    let ok = true;
    if (!token) { fieldError(view, 'token', tokenEl, 'Cole o código que veio no link do e-mail.'); ok = false; }
    if (passEl.value.length < 6) { fieldError(view, 'password', passEl, 'A senha precisa ter ao menos 6 caracteres.'); ok = false; }
    if (confEl.value !== passEl.value) { fieldError(view, 'confirm', confEl, 'As senhas não são iguais.'); ok = false; }
    if (!ok) return;

    if (view.dataset.loading === '1') return;
    view.dataset.loading = '1';
    btn.disabled = true;
    btn.textContent = 'Salvando…';

    try {
      await apiResetPassword(token, passEl.value);
      playAdd();
      app.toast('Senha atualizada ✨ Entre com a nova senha.', 4200);
      app.navigate('login');
    } catch (err) {
      view.dataset.loading = '0';
      btn.disabled = false;
      btn.textContent = 'Salvar nova senha';
      playError();
      // Link vencido/usado (400) é o caso mais comum e o único que exige outro
      // pedido; a mensagem já diz isso e o botão abaixo leva direto a ele.
      fieldError(view, 'form', null, friendlyError(err, 'reset'));
    }
  });

  $('#new-link', view).addEventListener('click', () => app.navigate('forgot'));
  setTimeout(() => (tokenEl || passEl).focus(), 80);
  return view;
}
