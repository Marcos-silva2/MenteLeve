/* ============================================================
   Conexões — espaços compartilhados (Tela 6)
   Uma lista de tarefas comum a várias pessoas: cria-se um espaço, convida-se por
   código e todos os membros veem e editam as tarefas. Quem apaga: quem criou a
   tarefa ou o dono do espaço. Precisa de conta no servidor.
   Nomes (do espaço e das pessoas) vêm de outros usuários: sempre `esc()`.
   ============================================================ */

import { h, $, icons, toast, confirmDialog, friendlyError, esc } from '../ui.js';
import {
  getUserId, getSpaces, refreshSpaces, createSpace, joinSpace, leaveSpace,
  resetSpaceInvite, removeSpaceMember,
} from '../store.js';
import { isOnline } from '../api.js';

/** Texto do convite — o código vai junto com o endereço do app. */
export function inviteMessage(space, appUrl = 'https://mente-leve-teal.vercel.app') {
  return `Entre no espaço "${space.name}" no MenteLeve: abra ${appUrl}, vá em Conexões, preencha "Entrar com código" e digite ${space.inviteCode}.`;
}

/** Explica um erro das chamadas de espaço (o `friendlyError` genérico não conhece estes casos). */
export function spaceError(err) {
  const s = err && err.status;
  if (s === 404) return 'Código de convite inválido. Confira com quem te convidou (o código pode ter sido trocado).';
  if (s === 409) return 'Não foi possível: o espaço está cheio ou você já participa de espaços demais.';
  if (s === 403) return 'Só o dono do espaço pode fazer isso.';
  return friendlyError(err, 'espaco');
}

export function renderConnections() {
  const view = h(`
    <div class="h-full flex flex-col relative">
      <div class="content-wrap lg:max-w-2xl flex-1 flex flex-col overflow-hidden">
        <header class="px-6 lg:px-0 pt-12 lg:pt-8 pb-4">
          <h1 class="font-serif font-bold text-bordeaux-900 text-[26px] lg:text-3xl leading-tight">Espaços compartilhados</h1>
          <p class="text-sm text-bordeaux-700 mt-1">Uma lista de tarefas em comum com a família ou a equipe. Quem participa vê e edita tudo.</p>
        </header>
        <div id="body" class="flex-1 overflow-y-auto px-6 lg:px-0 pb-6 safe-bottom"></div>
      </div>
    </div>
  `);
  const body = $('#body', view);

  function render() {
    // Sem conta no servidor não há com quem compartilhar.
    if (getUserId() == null) {
      body.innerHTML = `
        <div class="flex flex-col items-center text-center px-6 py-10 bg-bg border border-soft-100 rounded-xl2">
          <div class="w-16 h-16 rounded-full bg-white grid place-items-center mb-3 text-soft-300 [&>svg]:w-8 [&>svg]:h-8" aria-hidden="true">${icons.users}</div>
          <h2 class="font-serif font-bold text-bordeaux-900 text-lg mb-1">Entre com uma conta para compartilhar</h2>
          <p class="text-sm text-bordeaux-700 max-w-[300px]">Os espaços ficam no servidor, para todo mundo ver as mesmas tarefas. Você está usando o app só neste aparelho.</p>
        </div>`;
      return;
    }

    const espacos = getSpaces();
    const eu = getUserId();
    body.innerHTML = `
      <div class="grid sm:grid-cols-2 gap-3 mb-6">
        <form id="f-criar" class="bg-white rounded-xl2 shadow-card border border-soft-100 p-4" novalidate>
          <label for="nome-espaco" class="block text-sm font-semibold text-bordeaux-900 mb-2">Criar um espaço</label>
          <input id="nome-espaco" maxlength="60" autocomplete="off" placeholder="Ex.: Equipe de projeto, Casa"
            class="w-full px-4 py-3 rounded-2xl bg-white border border-soft-100 text-bordeaux-900 placeholder-muted focus:border-accent focus:ring-4 focus:ring-accent/15 outline-none transition text-[15px] mb-3" />
          <button class="btn btn-primary w-full" type="submit">Criar</button>
        </form>
        <form id="f-entrar" class="bg-white rounded-xl2 shadow-card border border-soft-100 p-4" novalidate>
          <label for="codigo" class="block text-sm font-semibold text-bordeaux-900 mb-2">Entrar com código</label>
          <input id="codigo" maxlength="24" autocomplete="off" autocapitalize="characters" placeholder="ABCD-EFGH"
            class="w-full px-4 py-3 rounded-2xl bg-white border border-soft-100 text-bordeaux-900 placeholder-muted tracking-widest uppercase focus:border-accent focus:ring-4 focus:ring-accent/15 outline-none transition text-[15px] mb-3" />
          <button class="btn btn-secondary w-full border border-soft-200" type="submit">Entrar</button>
        </form>
      </div>
      ${isOnline() || !espacos.length ? '' : '<p class="text-xs text-muted mb-3">Sem conexão: mostrando a última lista que o aparelho guardou.</p>'}
      ${espacos.length ? espacos.map((e) => cartaoEspaco(e, eu)).join('') : `
        <div class="flex flex-col items-center text-center px-6 py-8 bg-bg border border-soft-100 rounded-xl2">
          <div class="w-16 h-16 rounded-full bg-white grid place-items-center mb-3 text-soft-300 [&>svg]:w-8 [&>svg]:h-8" aria-hidden="true">${icons.users}</div>
          <h2 class="font-serif font-bold text-bordeaux-900 text-lg mb-1">Você ainda não está em nenhum espaço</h2>
          <p class="text-sm text-bordeaux-700 max-w-[300px]">Crie um e mande o código para quem vai participar, ou digite o código que recebeu.</p>
        </div>`}`;
  }

  function cartaoEspaco(e, eu) {
    const souDono = e.ownerId === eu;
    return `
      <section class="bg-white rounded-xl2 shadow-card border border-soft-100 p-4 mb-4" data-espaco="${esc(e.id)}" aria-label="Espaço ${esc(e.name)}">
        <div class="mb-3 min-w-0">
          <h2 class="font-serif font-bold text-bordeaux-900 text-lg truncate">👥 ${esc(e.name)}</h2>
          <p class="text-xs text-bordeaux-700">${e.members.length} ${e.members.length === 1 ? 'pessoa' : 'pessoas'}${souDono ? ' · você é o dono' : ''}</p>
        </div>
        <ul class="flex flex-col gap-1.5 mb-3" aria-label="Membros">
          ${e.members.map((m) => `
            <li class="flex items-center gap-2.5">
              <span class="w-8 h-8 rounded-full bg-soft-200 grid place-items-center text-bordeaux-900 text-xs font-bold shrink-0">${esc(ini(m.name))}</span>
              <span class="flex-1 min-w-0 truncate text-sm text-bordeaux-900">${esc(m.name)}${m.userId === eu ? ' (você)' : ''}${m.isOwner ? ' · dono' : ''}</span>
              ${souDono && m.userId !== eu ? `<button data-remover="${m.userId}" class="text-xs text-bordeaux-600 min-h-11 px-2" aria-label="Remover ${esc(m.name)} do espaço">Remover</button>` : ''}
            </li>`).join('')}
        </ul>
        <div class="rounded-2xl bg-bg border border-soft-100 px-4 py-3 mb-3">
          <p class="text-[11px] font-semibold text-muted uppercase tracking-wide mb-1">Código de convite</p>
          <p class="text-xl font-bold tracking-widest text-bordeaux-900 select-all" data-codigo>${esc(e.inviteCode)}</p>
        </div>
        <div class="flex flex-wrap gap-2">
          <button data-copiar class="btn btn-primary !text-sm">Copiar convite</button>
          ${souDono ? '<button data-trocar class="btn btn-secondary border border-soft-200 !text-sm">Gerar novo código</button>' : ''}
          <button data-sair class="btn btn-danger !text-sm">Sair do espaço</button>
        </div>
      </section>`;
  }

  /** Executa a ação, avisa o resultado (texto de erro escapado: toast usa innerHTML) e redesenha. */
  async function tentar(fn, sucesso) {
    try {
      await fn();
      toast(sucesso);
    } catch (err) {
      toast(esc(spaceError(err)), 4500);
    }
    render();
  }

  body.addEventListener('submit', (ev) => {
    ev.preventDefault();
    if (ev.target.id === 'f-criar') {
      const nome = $('#nome-espaco', body).value.trim();
      if (!nome) { toast('Dê um nome ao espaço.'); return; }
      tentar(() => createSpace(nome), 'Espaço criado ✨ Copie o convite e mande para quem vai participar.');
    } else if (ev.target.id === 'f-entrar') {
      const codigo = $('#codigo', body).value.trim();
      if (!codigo) { toast('Digite o código de convite.'); return; }
      tentar(() => joinSpace(codigo), 'Você entrou no espaço ✨ As tarefas dele já aparecem na Home.');
    }
  });

  body.addEventListener('click', async (ev) => {
    const sec = ev.target.closest('[data-espaco]');
    if (!sec) return;
    const id = sec.dataset.espaco;
    const espaco = getSpaces().find((x) => x.id === id);
    if (!espaco) return;

    if (ev.target.closest('[data-copiar]')) {
      try {
        await navigator.clipboard.writeText(inviteMessage(espaco));
        toast('Convite copiado ✨ É só colar na conversa.');
      } catch (_) {
        toast('Não consegui copiar sozinho. Toque no código para selecioná-lo e copie.', 4000);
      }
    } else if (ev.target.closest('[data-trocar]')) {
      const ok = await confirmDialog({
        title: 'Gerar um novo código?',
        message: 'O código atual deixa de funcionar. Quem já está no espaço continua nele.',
        confirmLabel: 'Gerar novo', cancelLabel: 'Manter',
      });
      if (ok) tentar(() => resetSpaceInvite(id), 'Código trocado.');
    } else if (ev.target.closest('[data-sair]')) {
      const ok = await confirmDialog({
        title: `Sair de "${espaco.name}"?`,
        message: 'Você deixa de ver as tarefas deste espaço, inclusive as que você criou. Elas continuam com quem ficou.',
        confirmLabel: 'Sair', cancelLabel: 'Ficar', danger: true,
      });
      if (ok) tentar(() => leaveSpace(id), 'Você saiu do espaço.');
    } else if (ev.target.closest('[data-remover]')) {
      const alvo = ev.target.closest('[data-remover]').dataset.remover;
      const membro = espaco.members.find((m) => String(m.userId) === alvo);
      if (!membro) return;
      const ok = await confirmDialog({
        title: `Remover ${membro.name}?`,
        message: 'A pessoa deixa de ver as tarefas deste espaço. Para voltar, precisa de um código válido.',
        confirmLabel: 'Remover', cancelLabel: 'Cancelar', danger: true,
      });
      if (ok) tentar(() => removeSpaceMember(id, membro.userId), 'Pessoa removida.');
    }
  });

  render();
  // A lista pode ter mudado desde a última vez (alguém entrou, saiu ou te removeu).
  if (getUserId() != null) refreshSpaces().then((ok) => { if (ok) render(); });
  return view;
}

function ini(name) {
  const p = String(name || '').trim().split(/\s+/);
  return ((p[0]?.[0] || '') + (p[1]?.[0] || '')).toUpperCase();
}
