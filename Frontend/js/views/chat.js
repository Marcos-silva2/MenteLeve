/* ============================================================
   Bruna — Chat com a IA (Tela de conversa)
   Conversa empática para organizar a rotina e aliviar a carga mental.
   Backend: POST /ai/chat (Gemini). Fallback gentil se offline.
   ============================================================ */

import { h, $, $$, icons, pulseBrandLogo } from '../ui.js';
import { getUser, restoreSession, upsertTasks } from '../store.js';
import { apiChat, wakeBackend, isOnline } from '../api.js';
import { playMessage } from '../sound.js';

// Histórico mantido em memória durante a sessão (sobrevive à troca de abas).
let conversation = []; // [{ role: 'user' | 'assistant', content }]
let typing = false;

/** Limpa a conversa ao sair da conta.
 *  Sem isso, num aparelho compartilhado a próxima pessoa herdaria o histórico
 *  da anterior — e a Bruna, que agora age nas tarefas, poderia agir em cima dele. */
export function clearConversation() {
  conversation = [];
  typing = false;
}

const SUGGESTIONS = [
  'Me ajuda a organizar a semana',
  'Tô me sentindo sobrecarregada',
  'Como dividir uma tarefa grande?',
];

// Respostas padrão (offline) para as perguntas prontas — usadas na hora se a
// conexão com a IA demorar (cold start do Render). A IA real é acordada em 2º plano.
const CANNED = {
  'Me ajuda a organizar a semana':
    'Claro! Vamos por partes 💗: toque no + e despeje tudo que está na sua cabeça, sem filtrar. Depois marque só o que é desta semana e escolha no máximo 3 prioridades por dia — o resto pode esperar. Quando eu me conectar, te ajudo a quebrar cada tarefa em passos. 🌸',
  'Tô me sentindo sobrecarregada':
    'Respira fundo, eu tô aqui com você 💗. Que tal escolher UMA coisa pequena pra resolver agora e registrar o resto no app, pra tirar da mente? Você não precisa dar conta de tudo de uma vez. Daqui a pouco a gente organiza o restante juntas. 🌸',
  'Como dividir uma tarefa grande?':
    'Ótima pergunta! Pergunte a si mesma: "qual é o primeiro passo bem pequeno?". Quebre em 3 a 5 passos curtos (ex.: pesquisar → decidir → comprar → agendar) e faça só o primeiro hoje. Ao adicionar a tarefa no +, eu já sugiro esses passos automaticamente. ✨',
};

export function renderChat(app) {
  const user = getUser() || { name: 'Você' };
  const firstName = (user.name || 'Você').split(' ')[0];
  const greeting = `Oi, ${firstName}! Eu sou a Bruna 💗 Tô aqui pra te ajudar a organizar a rotina e tirar um peso da sua mente. Como você tá hoje?`;

  const view = h(`
    <div class="h-full flex flex-col">
      <div class="content-wrap lg:max-w-2xl flex flex-col h-full">
        <header class="shrink-0 px-5 lg:px-0 pt-12 lg:pt-8 pb-3 flex items-center gap-3 border-b border-soft-100">
          <span class="bruna-glow w-11 h-11 rounded-full bg-accent text-white grid place-items-center">${icons.spark}</span>
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
              class="flex-1 resize-none px-4 py-3 rounded-2xl bg-white border border-soft-100 text-bordeaux-900 placeholder-muted
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
    // Anima apenas a bolha mais recente (evita re-animar o histórico todo).
    if (messagesEl.lastElementChild) messagesEl.lastElementChild.classList.add('msg-in');
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

    // A Bruna pode executar ações (criar/concluir tarefa), o que exige até duas
    // idas ao modelo. Com o backend já no ar, esperamos bem mais: desistir cedo
    // mostraria a resposta pronta enquanto a tarefa É criada no servidor — e a
    // usuária, achando que falhou, repetiria o pedido e ganharia uma duplicata.
    const budget = isOnline() ? 30000 : 7000;
    const result = await withTimeout(apiChat(conversation), budget);

    let reply = result && result.reply;
    let agiu = false;
    if (result) {
      // Reflete na Home/Agenda o que a Bruna acabou de fazer, sem recarregar
      // a lista inteira (ver upsertTasks).
      upsertTasks(result.tasks);
      agiu = !!(result.tasks && result.tasks.length);
    }

    if (!reply) {
      // Sem conexão (ou lenta): a "Bruna local" responde de forma natural,
      // enquanto acordamos o backend em 2º plano para as próximas mensagens.
      wakeBackend().then((ok) => ok && restoreSession().catch(() => {}));
      reply = CANNED[msg] || localReply(msg);
      // pausa proporcional ao tamanho — dá a sensação de que ela "digitou".
      await new Promise((r) => setTimeout(r, 650 + Math.min(1400, reply.length * 10)));
    }

    typing = false;
    conversation.push({ role: 'assistant', content: reply });
    renderMessages();
    playMessage();

    // Ela não só respondeu: criou ou concluiu tarefa de verdade. O brilho no
    // avatar (e no logotipo, no desktop) é a confirmação disso onde o olhar já
    // está — sem ele, a única prova da ação ficava em outra aba.
    if (agiu) {
      pulseBrandLogo();
      const avatar = messagesEl.lastElementChild &&
        messagesEl.lastElementChild.querySelector('span.rounded-full');
      if (avatar) {
        avatar.classList.add('bruna-glow');
        setTimeout(() => avatar.classList.remove('bruna-glow'), 1600);
      }
    }
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

/** Espera `p` resolver, mas desiste após `ms` (resolve null) — mantém a conversa fluida. */
function withTimeout(p, ms) {
  return Promise.race([p, new Promise((res) => setTimeout(() => res(null), ms))]);
}

const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

/**
 * "Bruna local" — respostas heurísticas e acolhedoras usadas quando a IA real
 * está indisponível/lenta. Mantém a sensação de conversa contínua (o backend é
 * acordado em 2º plano para as próximas mensagens irem ao Gemini de verdade).
 */
function localReply(text) {
  const t = (text || '').toLowerCase().trim();
  const has = (...w) => w.some((x) => t.includes(x));

  if (has('oi', 'olá', 'ola', 'bom dia', 'boa tarde', 'boa noite', 'e aí', 'eai', 'opa'))
    return pick([
      'Oi! Que bom te ver por aqui 💗 Como você está se sentindo hoje?',
      'Olá! Tô aqui com você 🌸 Me conta, como posso te ajudar agora?',
    ]);

  if (has('obrigad', 'valeu', 'brigad', 'agradeç', 'gratidão'))
    return pick([
      'Imagina, é sempre um prazer 💗 Conte comigo sempre que precisar.',
      'De nada! Tô aqui pra deixar a sua mente mais leve 🌸',
    ]);

  if (has('tchau', 'até logo', 'ate logo', 'falou', 'até mais', 'ate mais'))
    return 'Até já! Descanse a mente, você merece 💗';

  if (has('sobrecarreg', 'cansad', 'exaust', 'estressad', 'não aguento', 'nao aguento', 'demais', 'no limite', 'esgotad'))
    return pick([
      'Respira fundo, eu tô aqui com você 💗. Que tal escolher só UMA coisa pequena pra resolver agora e registrar o resto no + pra tirar da cabeça? Você não precisa dar conta de tudo de uma vez.',
      'Sinto muito que esteja pesado assim 🌸. Vamos aliviar juntas: me diz a única tarefa que mais te incomoda agora, e começamos só por ela.',
    ]);

  if (has('triste', 'ansios', 'sozinha', 'chorar', 'angúst', 'angust', 'medo', 'desanim', 'pra baixo'))
    return pick([
      'Eu tô aqui com você, viu? 💗 Tá tudo bem não estar bem. Respira fundo comigo: inspira… e solta devagar. Quer me contar o que está pesando?',
      'Você não está sozinha 🌸. Vamos com calma, uma coisinha de cada vez, pra a sua mente respirar.',
    ]);

  if (has('organiz', 'semana', 'rotina', 'planej', 'agenda', 'dia a dia', 'prioridade'))
    return pick([
      'Vamos por partes 💗: toque no + e despeje tudo que está na sua cabeça, sem filtrar. Depois marque só o que é desta semana e escolha no máximo 3 prioridades por dia — o resto pode esperar. 🌸',
      'Adoro organizar com você! Comece anotando tudo no +, sem se cobrar. Aí a gente separa por dia e por prioridade. Quer começar listando o de hoje?',
    ]);

  if (has('dividir', 'divido', 'grande', 'passo', 'começar', 'comecar', 'por onde', 'quebrar'))
    return 'Ótima pergunta! Pergunte a si mesma: "qual é o primeiro passo bem pequeno?". Quebre em 3 a 5 passos curtos (ex.: pesquisar → decidir → comprar → agendar) e faça só o primeiro hoje. Ao adicionar a tarefa no +, eu já sugiro esses passos. ✨';

  if (has('filho', 'filha', 'bebê', 'bebe', 'criança', 'crianca', 'escola', 'pediatra', 'vacina'))
    return 'Cuidar dos filhos já é um trabalho enorme 💗. Registra essas tarefas no + que eu te ajudo a encaixá-las na semana — e, se quiser, dá pra dividir algumas com a sua rede de apoio na aba Conexões. Você não precisa carregar tudo sozinha. 🌸';
  if (has('marido', 'esposo', 'parceir', 'companheir', 'delegar'))
    return 'Dividir a carga faz toda a diferença 🌸. Na aba Conexões você pode convidar o seu parceiro pra compartilhar tarefas. Quer que eu te ajude a separar o que dá pra delegar?';
  if (has('casa', 'limpe', 'mercado', 'comida', 'janta', 'almoç', 'roupa', 'louça'))
    return 'As tarefas de casa nunca acabam, né? 💗 Registra elas no + que eu te ajudo a distribuir na semana sem sobrecarregar nenhum dia.';

  if (/^(sim|isso|ok|ta|tá|claro|pode ser|aham|uhum|certo|beleza|com certeza)\b/.test(t))
    return pick([
      'Perfeito! Me conta um pouco mais pra eu te ajudar melhor 💗',
      'Que bom! Então vamos lá — qual é o próximo passo que você quer dar? 🌸',
    ]);
  if (/^(não|nao|nem|jamais)\b/.test(t))
    return 'Tudo bem 💗. Me diz então o que faria mais sentido pra você agora?';

  if (has('quem é você', 'quem e voce', 'seu nome', 'você é', 'voce e', 'o que voce faz', 'o que você faz'))
    return 'Eu sou a Bruna, sua parceira aqui no MenteLeve 💗 Tô aqui pra te ajudar a organizar a rotina e aliviar a carga mental. Como posso te ajudar?';

  return pick([
    'Entendi 💗. Me conta um pouco mais? Se quiser, posso te ajudar a transformar isso em tarefas — é só tocar no +.',
    'Tô aqui com você 🌸. Que tal a gente registrar isso no app pra tirar da sua mente? Toque no + e me conta o que precisa ser feito.',
    'Faz sentido. Vamos deixar a sua mente mais leve: quer que eu te ajude a quebrar isso em pequenos passos?',
  ]);
}
