/* ============================================================
   Onboarding — Carrossel de 3 slides + escolha de uso (Tela 1)
   O último passo pergunta "Para que você vai usar o MenteLeve?" e define o
   filtro inicial (Trabalho / Vida / Os dois) — ver categories.js.
   ============================================================ */

import { h, $, $$, icons, logoMark } from '../ui.js';
import { markOnboardingSeen } from '../store.js';
import { setGroupFilter } from '../categories.js';

const SLIDES = [
  {
    art: artAgenda,
    title: 'A sua mente não foi feita para guardar tudo.',
    text: 'Reúna o trabalho e a vida pessoal num só lugar e libere a cabeça para o que importa.',
  },
  {
    art: artAI,
    title: 'O MenteLeve pensa nos detalhes antes de você lembrar.',
    text: 'Escreva do seu jeito, como “reunião com o cliente sexta às 10h”, e deixe a inteligência artificial organizar prazos, passos e lembretes.',
  },
  {
    art: artShare,
    title: 'Compartilhe tarefas com quem importa.',
    text: 'Convide familiares ou colegas de equipe para dividir responsabilidades. Quando todos participam, a carga fica mais leve.',
  },
];

// Último passo: o uso escolhido vira o filtro inicial da Home e da Agenda.
const USOS = [
  { id: 'trabalho', label: 'Trabalho', hint: 'Reuniões, entregas, estudos e carreira' },
  { id: 'vida',     label: 'Vida pessoal', hint: 'Casa, família, saúde e finanças' },
  { id: 'tudo',     label: 'Os dois', hint: 'Tudo junto, num só lugar' },
];
const TOTAL = SLIDES.length + 1;

export function renderOnboarding(app) {
  let index = 0;

  const view = h(`
    <div class="h-full flex flex-col bg-gradient-to-b from-bg to-soft-100 lg:max-w-lg lg:mx-auto lg:w-full">
      <!-- topo -->
      <div class="flex items-center justify-between px-6 pt-12 pb-2">
        <div class="flex items-center gap-2 text-bordeaux-900">
          ${logoMark('h-9 w-auto', true)}
          <span class="font-serif font-bold text-lg">MenteLeve</span>
        </div>
        <button id="skip" class="text-sm font-medium text-bordeaux-700 min-h-11 px-2">Pular</button>
      </div>

      <!-- carrossel -->
      <div class="flex-1 overflow-hidden">
        <div id="track" class="slide-track">
          ${SLIDES.map((s) => `
            <div class="slide flex flex-col items-center px-6 text-center pt-6">
              <!-- ilustração grande, na metade superior -->
              <div class="w-full flex items-center justify-center">${s.art()}</div>
              <!-- textos logo abaixo -->
              <div class="pt-6">
                <h1 class="font-serif font-bold text-bordeaux-900 text-[28px] leading-tight mb-3">${s.title}</h1>
                <p class="text-bordeaux-700 text-[15px] leading-relaxed max-w-[320px] mx-auto">${s.text}</p>
              </div>
            </div>`).join('')}
          <!-- escolha de uso -->
          <div class="slide flex flex-col items-center px-6 text-center pt-10">
            <h1 class="font-serif font-bold text-bordeaux-900 text-[28px] leading-tight mb-2">Para que você vai usar o MenteLeve?</h1>
            <p class="text-bordeaux-700 text-[15px] leading-relaxed max-w-[320px] mx-auto mb-6">Isso só define o que aparece primeiro. Dá para mudar a qualquer momento.</p>
            <div id="usos" role="group" aria-label="Para que você vai usar o MenteLeve?" class="w-full max-w-sm flex flex-col gap-3">
              ${USOS.map((u) => `
                <button data-uso="${u.id}"
                  class="lift w-full min-h-[64px] px-5 py-3 rounded-2xl bg-white border border-soft-100 shadow-card text-left active:scale-[.98] transition">
                  <span class="block font-semibold text-bordeaux-900 text-base">${u.label}</span>
                  <span class="block text-xs text-bordeaux-700 mt-0.5">${u.hint}</span>
                </button>`).join('')}
            </div>
          </div>
        </div>
      </div>

      <!-- rodapé: dots + ação -->
      <div class="px-6 pb-10 pt-4">
        <div id="dots" class="flex items-center justify-center gap-2 mb-6">
          ${Array.from({ length: TOTAL }, (_, i) => `<span data-dot="${i}" class="h-2 rounded-full transition-all duration-300 ${i === 0 ? 'w-6 bg-accent' : 'w-2 bg-soft-200'}"></span>`).join('')}
        </div>

        <div id="controls" class="flex items-center justify-between gap-4">
          <button id="prev" class="text-sm font-medium text-bordeaux-700 min-h-11 px-2 opacity-0 pointer-events-none transition-opacity">Voltar</button>
          <button id="next" aria-label="Próximo" class="ml-auto w-14 h-14 rounded-full bg-accent text-white shadow-fab grid place-items-center active:scale-95 transition-transform">
            ${icons.chevron}
          </button>
        </div>
      </div>
    </div>
  `);

  const track = $('#track', view);
  const dots = $$('[data-dot]', view);
  const prevBtn = $('#prev', view);
  const nextCircle = $('#next', view);

  function update() {
    track.style.transform = `translateX(-${index * 100}%)`;
    dots.forEach((d, i) => {
      d.className = `h-2 rounded-full transition-all duration-300 ${i === index ? 'w-6 bg-accent' : 'w-2 bg-soft-200'}`;
    });
    prevBtn.style.opacity = index === 0 ? '0' : '1';
    prevBtn.style.pointerEvents = index === 0 ? 'none' : 'auto';
    // No último passo a ação é escolher um uso (os botões da própria tela).
    const last = index === TOTAL - 1;
    nextCircle.classList.toggle('invisible', last);
  }

  function finish(uso = 'tudo') {
    setGroupFilter(uso);
    markOnboardingSeen();
    app.navigate('login');
  }

  $('#skip', view).addEventListener('click', () => finish('tudo'));
  $('#usos', view).addEventListener('click', (e) => {
    const b = e.target.closest('[data-uso]');
    if (b) finish(b.dataset.uso);
  });
  nextCircle.addEventListener('click', () => { index = Math.min(index + 1, TOTAL - 1); update(); });
  prevBtn.addEventListener('click', () => { index = Math.max(index - 1, 0); update(); });

  // swipe básico + parallax da ilustração
  const semMovimento = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const parallaxEls = $$('.onboard-parallax', view);
  let startX = 0;

  // A ilustração acompanha o dedo a 40% da velocidade do slide. É o bastante
  // para dar profundidade e pouco para virar deslize independente.
  function parallax(dx, soltando) {
    if (semMovimento) return;
    for (const el of parallaxEls) {
      el.classList.toggle('settling', soltando);
      el.style.transform = soltando ? '' : `translateX(${dx * 0.4}px)`;
    }
  }

  track.addEventListener('touchstart', (e) => {
    startX = e.touches[0].clientX;
    parallax(0, false);
  }, { passive: true });

  track.addEventListener('touchmove', (e) => {
    parallax(e.touches[0].clientX - startX, false);
  }, { passive: true });

  track.addEventListener('touchend', (e) => {
    const dx = e.changedTouches[0].clientX - startX;
    parallax(0, true);
    if (dx < -40) index = Math.min(index + 1, TOTAL - 1);
    else if (dx > 40) index = Math.max(index - 1, 0);
    update();
  });

  update();
  return view;
}

/* ---------- Ilustrações ---------- */
function artAgenda() {
  // Uma agenda com tarefas de trabalho e de vida, feita só de tokens do tema (não é
  // imagem), então acompanha qualquer cor escolhida. Dois elementos: o de FORA recebe o
  // parallax (transform escrito por JS durante o arraste), o de DENTRO respira sozinho
  // (animação CSS). Num elemento só, as duas transformações brigariam.
  const linha = (titulo, quando, feito, cor) => `
    <div class="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-bg">
      <span class="w-5 h-5 rounded-full shrink-0 grid place-items-center ${feito ? 'bg-accent text-white' : 'border-2 border-soft-300'}">${feito ? '<svg viewBox="0 0 24 24" class="w-3 h-3" fill="none" stroke="currentColor" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12l5 5 9-10"/></svg>' : ''}</span>
      <span class="flex-1 min-w-0 text-left">
        <span class="block text-[13px] font-semibold text-bordeaux-900 truncate ${feito ? 'line-through opacity-60' : ''}">${titulo}</span>
        <span class="block text-[11px] text-bordeaux-700">${quando}</span>
      </span>
      <span class="w-2 h-2 rounded-full shrink-0" style="background:${cor}"></span>
    </div>`;
  return `
  <div class="onboard-parallax">
    <div class="onboard-breathe relative w-72 max-w-full mx-auto" role="img" aria-label="Agenda com tarefas de trabalho e de vida pessoal">
      <div class="bg-white rounded-[28px] shadow-card border border-soft-100 p-4">
        <div class="flex items-center justify-between mb-3">
          <span class="font-serif font-bold text-bordeaux-900 text-lg">Hoje</span>
          <span class="text-accent">${icons.spark}</span>
        </div>
        <div class="flex flex-col gap-2">
          ${linha('Reunião com o cliente', '10:00 · Reuniões', false, 'var(--color-primary-700)')}
          ${linha('Enviar o relatório', '14:00 · Trabalho', false, 'var(--color-primary-900)')}
          ${linha('Consulta no dentista', '17:30 · Saúde', false, 'var(--color-accent)')}
          ${linha('Pagar a fatura', 'Concluída · Finanças', true, 'var(--color-soft-300)')}
        </div>
      </div>
      <span class="onboard-float absolute -top-3 -right-2 px-3 py-1.5 rounded-full bg-accent text-white text-[11px] font-semibold shadow-fab">Trabalho + Vida</span>
    </div>
  </div>`;
}
function artAI() {
  // Fluxo vertical: pensamento (nota) → IA (faísca) → tarefas organizadas (chips).
  // O alinhamento central e os conectores deixam a relação causa→efeito clara,
  // melhorando a leitura dos elementos e dos textos nesta tela.
  return `
  <div class="w-64 max-w-full mx-auto flex flex-col items-center pt-2">
    <!-- pensamento solto -->
    <div class="bg-white px-5 py-2.5 rounded-2xl shadow-card font-serif italic text-bordeaux-900 text-[15px]">Reunião com o cliente</div>

    <!-- conector + IA processando -->
    <div class="w-px h-4 bg-soft-200"></div>
    <div class="w-11 h-11 rounded-full bg-accent grid place-items-center text-white shadow-fab onboard-float">${icons.spark}</div>
    <div class="w-px h-4 bg-soft-200"></div>

    <!-- tarefas organizadas pela IA -->
    <div class="grid grid-cols-3 gap-2 w-full">
      ${chip('Preparar a pauta')}
      ${chip('Enviar o convite')}
      ${chip('Registrar a ata')}
    </div>
  </div>`;
}
function artShare() {
  // Este slide era o único totalmente parado — os outros dois já respiravam, e
  // a diferença aparecia justo no slide que fala de "dividir a carga". Os dois
  // cartões balançam em contratempo (um sobe enquanto o outro desce), a faísca
  // pulsa entre eles e o selo de concluído entra por último.
  return `
  <div class="relative w-60 h-48 flex items-center justify-center gap-6">
    ${avatarCard('var(--color-soft-300)', 'share-card')}
    <div class="text-accent onboard-float">${icons.spark}</div>
    ${avatarCard('var(--color-primary-600)', 'share-card share-card-b')}
    <div class="share-seal absolute -top-1 right-8 w-9 h-9 rounded-full bg-accent grid place-items-center text-white shadow-fab">${icons.check}</div>
  </div>`;
}

function chip(label) {
  return `<div class="flex-1 bg-white text-bordeaux-800 text-[11px] font-medium px-2 py-2 rounded-xl shadow-card text-center leading-tight">${label}</div>`;
}
function avatarCard(color, cls) {
  // A inclinação vem da animação em CSS, não das classes `rotate-*` do
  // Tailwind: as duas escrevem `transform`, e a última a valer apagaria a
  // outra — os cartões ficariam retos ou parados.
  return `<div class="bg-white p-2 rounded-2xl shadow-card ${cls}">
    <div class="w-16 h-16 rounded-xl grid place-items-center" style="background:color-mix(in srgb, ${color} 13%, transparent);color:${color}">
      <svg viewBox="0 0 24 24" fill="currentColor" class="w-9 h-9"><circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 3.6-7 8-7s8 3 8 7z"/></svg>
    </div>
  </div>`;
}
