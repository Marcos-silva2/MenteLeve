/* ============================================================
   Onboarding — Carrossel de 3 slides (Tela 1)
   ============================================================ */

import { h, $, $$, icons } from '../ui.js';
import { markOnboardingSeen } from '../store.js';

const SLIDES = [
  {
    art: artWoman,
    title: 'A sua mente não foi feita para guardar tudo.',
    text: 'Libere a sua carga mental com o seu ‘Second Brain’ inteligente.',
  },
  {
    art: artAI,
    title: 'O MenteLeve pensa nos detalhes antes de você lembrar.',
    text: 'Crie tarefas como se estivesse conversando com uma amiga, e deixe a inteligência artificial organizar os prazos e detalhes por você.',
  },
  {
    art: artShare,
    title: 'Compartilhe a carga com a sua rede de apoio.',
    text: 'Convide seu parceiro ou familiares para dividir as responsabilidades. Quando todos participam, o peso mental desaparece.',
  },
];

export function renderOnboarding(app) {
  let index = 0;

  const view = h(`
    <div class="h-full flex flex-col bg-gradient-to-b from-bg to-soft-100 lg:max-w-lg lg:mx-auto lg:w-full">
      <!-- topo -->
      <div class="flex items-center justify-between px-6 pt-12 pb-2">
        <div class="flex items-center gap-2 text-bordeaux-900">
          ${icons.logoImg}
          <span class="font-serif font-bold text-lg">MenteLeve</span>
        </div>
        <button id="skip" class="text-sm font-medium text-bordeaux-700">Pular</button>
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
        </div>
      </div>

      <!-- rodapé: dots + ação -->
      <div class="px-6 pb-10 pt-4">
        <div id="dots" class="flex items-center justify-center gap-2 mb-6">
          ${SLIDES.map((_, i) => `<span data-dot="${i}" class="h-2 rounded-full transition-all duration-300 ${i === 0 ? 'w-6 bg-accent' : 'w-2 bg-soft-200'}"></span>`).join('')}
        </div>

        <div id="controls" class="flex items-center justify-between gap-4">
          <button id="prev" class="text-sm font-medium text-bordeaux-700 px-2 opacity-0 pointer-events-none transition-opacity">Voltar</button>
          <button id="next" class="ml-auto w-14 h-14 rounded-full bg-accent text-white shadow-fab grid place-items-center active:scale-95 transition-transform">
            ${icons.chevron}
          </button>
        </div>

        <button id="start" class="hidden w-full py-4 rounded-full bg-accent text-white font-semibold text-base shadow-fab active:scale-[.98] transition-transform">
          Começar Gratuitamente
        </button>
      </div>
    </div>
  `);

  const track = $('#track', view);
  const dots = $$('[data-dot]', view);
  const prevBtn = $('#prev', view);
  const nextCircle = $('#next', view);
  const controls = $('#controls', view);
  const startBtn = $('#start', view);

  function update() {
    track.style.transform = `translateX(-${index * 100}%)`;
    dots.forEach((d, i) => {
      d.className = `h-2 rounded-full transition-all duration-300 ${i === index ? 'w-6 bg-accent' : 'w-2 bg-soft-200'}`;
    });
    // Voltar
    prevBtn.style.opacity = index === 0 ? '0' : '1';
    prevBtn.style.pointerEvents = index === 0 ? 'none' : 'auto';
    // Último slide → botão grande "Começar"
    const last = index === SLIDES.length - 1;
    controls.classList.toggle('hidden', last);
    startBtn.classList.toggle('hidden', !last);
  }

  function finish() {
    markOnboardingSeen();
    app.navigate('login');
  }

  $('#skip', view).addEventListener('click', finish);
  startBtn.addEventListener('click', finish);
  nextCircle.addEventListener('click', () => { index = Math.min(index + 1, SLIDES.length - 1); update(); });
  prevBtn.addEventListener('click', () => { index = Math.max(index - 1, 0); update(); });

  // swipe básico
  let startX = 0;
  track.addEventListener('touchstart', (e) => { startX = e.touches[0].clientX; }, { passive: true });
  track.addEventListener('touchend', (e) => {
    const dx = e.changedTouches[0].clientX - startX;
    if (dx < -40) index = Math.min(index + 1, SLIDES.length - 1);
    else if (dx > 40) index = Math.max(index - 1, 0);
    update();
  });

  update();
  return view;
}

/* ---------- Ilustrações ---------- */
function artWoman() {
  // Ilustração estática (mulher pensativa + balões), sem animação.
  return `
  <img src="assets/mulher-onboard.webp" alt="Mulher pensativa com tarefas ao redor"
       class="h-[44vh] max-h-[400px] w-auto max-w-full object-contain select-none pointer-events-none mx-auto"
       decoding="async" fetchpriority="high" draggable="false" />`;
}
function artAI() {
  // Fluxo vertical: pensamento (nota) → IA (faísca) → tarefas organizadas (chips).
  // O alinhamento central e os conectores deixam a relação causa→efeito clara,
  // melhorando a leitura dos elementos e dos textos nesta tela.
  return `
  <div class="w-64 max-w-full mx-auto flex flex-col items-center pt-2">
    <!-- pensamento solto da usuária -->
    <div class="bg-white px-5 py-2.5 rounded-2xl shadow-card font-serif italic text-bordeaux-900 text-[15px]">Aniversário do Leo</div>

    <!-- conector + IA processando -->
    <div class="w-px h-4 bg-soft-200"></div>
    <div class="w-11 h-11 rounded-full bg-accent grid place-items-center text-white shadow-fab onboard-float">${icons.spark}</div>
    <div class="w-px h-4 bg-soft-200"></div>

    <!-- tarefas organizadas pela IA -->
    <div class="grid grid-cols-3 gap-2 w-full">
      ${chip('Encomendar bolo')}
      ${chip('Comprar presente')}
      ${chip('Mandar convites')}
    </div>
  </div>`;
}
function artShare() {
  return `
  <div class="relative w-60 h-48 flex items-center justify-center gap-6">
    ${avatarCard('#ff8fa3', '-rotate-6')}
    <div class="text-accent">${icons.spark}</div>
    ${avatarCard('#c9184a', 'rotate-6')}
    <div class="absolute -top-1 right-8 w-9 h-9 rounded-full bg-accent grid place-items-center text-white shadow-fab">${icons.check}</div>
  </div>`;
}

function chip(label) {
  return `<div class="flex-1 bg-white text-bordeaux-800 text-[11px] font-medium px-2 py-2 rounded-xl shadow-card text-center leading-tight">${label}</div>`;
}
function avatarCard(color, rot) {
  return `<div class="bg-white p-2 rounded-2xl shadow-card ${rot}">
    <div class="w-16 h-16 rounded-xl grid place-items-center" style="background:${color}22;color:${color}">
      <svg viewBox="0 0 24 24" fill="currentColor" class="w-9 h-9"><circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 3.6-7 8-7s8 3 8 7z"/></svg>
    </div>
  </div>`;
}
