/* ============================================================
   Bruna — Chat com a IA (Tela de conversa)
   Conversa empática para organizar a rotina e aliviar a carga mental.
   Backend: POST /ai/chat (Gemini). Fallback gentil se offline.
   ============================================================ */

import { h, $, $$, icons } from '../ui.js';
import { getUser } from '../store.js';
import { apiChat } from '../api.js';

// Histórico mantido em memória durante a sessão (sobrevive à troca de abas).
let conversation = []; // [{ role: 'user' | 'assistant', content }]
let typing = false;

const SUGGESTIONS = [
  'Me ajuda a organizar a semana',
  'Tô me sentindo sobrecarregada',
  'Como dividir uma tarefa grande?',
];

export function renderChat(app) {
  const user = getUser() || { name: 'Você' };
  const firstName = (user.name || 'Você').split(' ')[0];
  const greeting = `Oi, ${firstName}! Eu sou a Bruna 💗 Tô aqui pra te ajudar a organizar a rotina e tirar um peso da sua mente. Como você tá hoje?`;

  const view = h(`
    <div class="h-full flex flex-col">
      <div class="content-wrap lg:max-w-2xl flex flex-col h-full">
        <header class="shrink-0 px-5 lg:px-0 pt-12 lg:pt-8 pb-3 flex items-center gap-3 border-b border-soft-100">
          <span class="w-11 h-11 rounded-full bg-accent text-white grid place-items-center shadow-fab">${icons.spark}</span>
          <div class="min-w-0">
            <h1 class="font-serif font-bold text-bordeaux-900 text-xl leading-none">Bruna</h1>
            <p class="text-xs text-bordeaux-700 mt-1">Sua parceira de rotina • IA do MenteLeve</p>
          </div>
        </header>

        <div id="messages" class="flex-1 overflow-y-auto px-5 lg:px-0 py-4 flex flex-col gap-3"></div>

        <div class="shrink-0 px-5 lg:px-0 pt-2 pb-24 lg:pb-6">
          <div id="suggestions" class="flex flex-wrap gap-2 mb-2"></div>
          <form id="chat-form" class="flex items-end gap-2">
            <textarea id="chat-input" rows="1" maxlength="2000"
              class="flex-1 resize-none px-4 py-3 rounded-2xl bg-white border border-soft-100 text-bordeaux-900 placeholder-soft-300
                     focus:border-accent focus:ring-4 focus:ring-accent/15 outline-none transition text-[15px] max-h-32"
              placeholder="Escreva pra Bruna…"></textarea>
            <button id="send" type="submit"
              class="shrink-0 w-12 h-12 rounded-full bg-accent hover:bg-accent-hover text-white grid place-items-center shadow-fab active:scale-95 transition">
              ${icons.send}
            </button>
          </form>
        </div>
      </div>
    </div>
  `);

  const messagesEl = $('#messages', view);
  const sugEl = $('#suggestions', view);
  const input = $('#chat-input', view);

  function bubble(role, text) {
    if (role === 'assistant') {
      return `
        <div class="flex items-end gap-2 max-w-[88%]">
          <span class="shrink-0 w-7 h-7 rounded-full bg-accent text-white grid place-items-center">${icons.spark}</span>
          <div class="bg-white border border-soft-100 rounded-2xl rounded-bl-md shadow-card px-4 py-2.5 text-[15px] text-bordeaux-900 whitespace-pre-wrap">${escapeHtml(text)}</div>
        </div>`;
    }
    return `
      <div class="self-end max-w-[88%]">
        <div class="bg-accent text-white rounded-2xl rounded-br-md px-4 py-2.5 text-[15px] whitespace-pre-wrap">${escapeHtml(text)}</div>
      </div>`;
  }

  function typingBubble() {
    return `
      <div class="flex items-end gap-2">
        <span class="shrink-0 w-7 h-7 rounded-full bg-accent text-white grid place-items-center">${icons.spark}</span>
        <div class="bg-white border border-soft-100 rounded-2xl rounded-bl-md shadow-card px-4 py-3 flex items-center gap-1">
          <span class="typing-dot"></span><span class="typing-dot"></span><span class="typing-dot"></span>
        </div>
      </div>`;
  }

  function renderMessages() {
    const items = [bubble('assistant', greeting)];
    for (const m of conversation) items.push(bubble(m.role, m.content));
    if (typing) items.push(typingBubble());
    messagesEl.innerHTML = items.join('');
    messagesEl.scrollTop = messagesEl.scrollHeight;

    // sugestões só enquanto a conversa não começou
    sugEl.innerHTML = conversation.length === 0
      ? SUGGESTIONS.map((s) => `<button data-sug="${encodeURIComponent(s)}"
          class="px-3 py-1.5 rounded-full text-xs font-medium bg-white text-bordeaux-700 border border-soft-100 hover:border-soft-200 transition">${s}</button>`).join('')
      : '';
    $$('[data-sug]', sugEl).forEach((b) =>
      b.addEventListener('click', () => { send(decodeURIComponent(b.dataset.sug)); })
    );
  }

  async function send(text) {
    const msg = (text != null ? text : input.value).trim();
    if (!msg || typing) return;
    conversation.push({ role: 'user', content: msg });
    input.value = '';
    autosize();
    typing = true;
    renderMessages();

    const reply = await apiChat(conversation);
    typing = false;
    conversation.push({
      role: 'assistant',
      content: reply || 'Não consegui falar com a IA agora 💗. Confere a conexão e tenta de novo daqui a pouco.',
    });
    renderMessages();
  }

  function autosize() {
    input.style.height = 'auto';
    input.style.height = Math.min(input.scrollHeight, 128) + 'px';
  }

  $('#chat-form', view).addEventListener('submit', (e) => { e.preventDefault(); send(); });
  input.addEventListener('input', autosize);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
  });

  renderMessages();
  setTimeout(() => input.focus(), 80);
  return view;
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
