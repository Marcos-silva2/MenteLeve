/* ============================================================
   Conhecimento — artigos curtos sobre saúde mental, gestão de tempo e agenda,
   cada um com as fontes. Lista com filtro por tema; tocar abre o artigo na
   mesma tela (Voltar retorna à lista na mesma posição).
   ============================================================ */

import { h, $, esc } from '../ui.js';
import { playTap } from '../sound.js';
import { TOPICS, articlesByTopic, findArticle } from '../knowledge.js';

const TOPIC_KEY = 'menteleve.knowledgeTopic';

function lerTema() {
  try {
    const t = localStorage.getItem(TOPIC_KEY);
    return t && (t === 'tudo' || TOPICS.some((x) => x.id === t)) ? t : 'tudo';
  } catch (_) { return 'tudo'; }
}
function salvarTema(t) {
  try { localStorage.setItem(TOPIC_KEY, t); } catch (_) { /* sem storage: só não lembra */ }
}

const nomeTema = (id) => (TOPICS.find((t) => t.id === id) || {}).label || '';

export function renderKnowledge() {
  const view = h(`
    <div class="h-full flex flex-col relative">
      <div class="content-wrap lg:max-w-3xl flex-1 flex flex-col overflow-hidden">
        <div id="kn" class="flex-1 overflow-y-auto px-6 lg:px-0 pb-6 safe-bottom"></div>
      </div>
    </div>
  `);
  const box = $('#kn', view);
  let tema = lerTema();
  let rolagemLista = 0;

  function lista() {
    const temas = [{ id: 'tudo', label: 'Tudo' }, ...TOPICS];
    const artigos = articlesByTopic(tema);
    box.innerHTML = `
      <header class="pt-12 lg:pt-8 pb-4">
        <h1 class="font-serif font-bold text-bordeaux-900 text-[26px] lg:text-3xl leading-tight">Conhecimento</h1>
        <p class="text-sm text-bordeaux-700 mt-1">O que a pesquisa diz sobre saúde mental, tempo e agenda — em leituras de 2 a 3 minutos, com as fontes.</p>
      </header>
      <div role="tablist" aria-label="Temas" class="flex gap-2 overflow-x-auto no-scrollbar pb-3 -mx-1 px-1">
        ${temas.map((t) => `
          <button role="tab" data-tema="${t.id}" aria-selected="${t.id === tema}"
            class="shrink-0 min-h-11 px-4 rounded-full text-sm font-semibold transition
                   ${t.id === tema ? 'bg-bordeaux-900 text-white shadow-card' : 'bg-white border border-soft-100 text-bordeaux-700 hover:bg-soft-100'}">${t.label}</button>`).join('')}
      </div>
      <ul class="grid sm:grid-cols-2 gap-3" aria-label="Artigos">
        ${artigos.map((a) => `
          <li>
            <button data-artigo="${esc(a.id)}" class="w-full h-full text-left bg-white rounded-xl2 shadow-card border border-soft-100 p-4 hover:border-soft-200 focus-visible:ring-4 focus-visible:ring-accent/15 outline-none transition">
              <span class="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-muted mb-1.5">
                <span aria-hidden="true" class="text-base">${a.emoji}</span>${esc(nomeTema(a.topic))} · ${a.minutes} min
              </span>
              <span class="block font-serif font-bold text-bordeaux-900 text-[17px] leading-snug mb-1">${esc(a.title)}</span>
              <span class="block text-sm text-bordeaux-700">${esc(a.summary)}</span>
            </button>
          </li>`).join('')}
      </ul>
      ${aviso()}`;
  }

  function artigo(a) {
    box.innerHTML = `
      <article class="pt-12 lg:pt-8 max-w-2xl" aria-labelledby="kn-t">
        <button data-voltar class="inline-flex items-center gap-1 min-h-11 -ml-2 pr-3 text-sm font-semibold text-bordeaux-700 hover:text-bordeaux-900">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="w-5 h-5" aria-hidden="true"><path d="M15 18l-6-6 6-6"/></svg>Conhecimento
        </button>
        <p class="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-muted mt-2 mb-2">
          <span aria-hidden="true" class="text-base">${a.emoji}</span>${esc(nomeTema(a.topic))} · ${a.minutes} min de leitura
        </p>
        <h1 id="kn-t" tabindex="-1" class="font-serif font-bold text-bordeaux-900 text-[26px] lg:text-3xl leading-tight mb-3 outline-none">${esc(a.title)}</h1>
        <p class="text-[15px] font-medium text-bordeaux-900 mb-4">${esc(a.summary)}</p>
        <div class="flex flex-col gap-3 text-[15px] leading-relaxed text-bordeaux-700">
          ${a.body.map((p) => `<p>${esc(p)}</p>`).join('')}
        </div>
        <div class="mt-5 rounded-2xl bg-soft-100/60 border border-soft-100 px-4 py-3">
          <p class="text-[11px] font-semibold uppercase tracking-wide text-bordeaux-700 mb-1">✨ Na prática, no MenteLeve</p>
          <p class="text-sm text-bordeaux-900">${esc(a.practice)}</p>
        </div>
        <section class="mt-6" aria-labelledby="kn-f">
          <h2 id="kn-f" class="text-sm font-bold text-bordeaux-900 mb-2">Fontes</h2>
          <ol class="list-decimal pl-5 flex flex-col gap-2 text-[13px] text-bordeaux-700">
            ${a.sources.map((s) => `
              <li><a href="${esc(s.url)}" target="_blank" rel="noopener noreferrer" class="underline decoration-soft-300 underline-offset-2 hover:text-bordeaux-900 break-words">${esc(s.label)}</a></li>`).join('')}
          </ol>
        </section>
        ${aviso()}
      </article>`;
    box.scrollTop = 0;
    $('#kn-t', box).focus({ preventScroll: true });
  }

  function aviso() {
    return `
      <p class="mt-6 text-xs text-muted leading-relaxed">
        Conteúdo informativo, que não substitui o acompanhamento de um profissional de saúde.
        Se estiver passando por um momento difícil, o CVV atende de graça, 24 horas, pelo telefone 188 ou em
        <a href="https://cvv.org.br" target="_blank" rel="noopener noreferrer" class="underline">cvv.org.br</a>.
      </p>`;
  }

  box.addEventListener('click', (ev) => {
    const t = ev.target.closest('[data-tema]');
    if (t) {
      playTap();
      tema = t.dataset.tema;
      salvarTema(tema);
      lista();
      return;
    }
    const b = ev.target.closest('[data-artigo]');
    if (b) {
      const a = findArticle(b.dataset.artigo);
      if (!a) return;
      playTap();
      rolagemLista = box.scrollTop;
      artigo(a);
      return;
    }
    if (ev.target.closest('[data-voltar]')) {
      playTap();
      lista();
      box.scrollTop = rolagemLista;
    }
  });

  lista();
  return view;
}
