/* ============================================================
   sound.js — Feedback sonoro discreto

   Os sons são SINTETIZADOS pela Web Audio API, não carregados de arquivos.
   Motivo: o precache do PWA foi reduzido a ~125 KB; anexar .mp3 andaria para
   trás. Sintetizar custa zero byte, não tem licenciamento e não pode dar 404
   no modo offline.

   Nada aqui pode quebrar a ação que disparou o som — tudo é tolerante a falha.
   ============================================================ */

import { isSoundEnabled } from './store.js';

let ctx = null;

/** Cria/retoma o AudioContext. Só funciona após um gesto da usuária — o
 *  navegador o mantém suspenso até lá (política de autoplay). */
function audio() {
  try {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
    }
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});
    return ctx;
  } catch (_) {
    return null;
  }
}

/**
 * Toca uma nota curta com envelope suave (sem clique de corte).
 * @param {number} freq  frequência em Hz
 * @param {number} start atraso em segundos
 * @param {number} dur   duração em segundos
 * @param {number} vol   volume de pico (0–1); mantido baixo de propósito
 */
function nota(freq, start = 0, dur = 0.16, vol = 0.14) {
  const ac = audio();
  if (!ac) return;
  try {
    const t0 = ac.currentTime + start;
    const osc = ac.createOscillator();
    const gain = ac.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, t0);

    // Ataque rápido e decaimento exponencial: soa como um toque, não como um bipe.
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(vol, t0 + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);

    osc.connect(gain).connect(ac.destination);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  } catch (_) { /* áudio nunca derruba a interação */ }
}

const ligado = () => {
  try { return isSoundEnabled(); } catch (_) { return false; }
};

/** Recompensa ao concluir uma tarefa: duas notas ascendentes (Lá → Dó#). */
export function playComplete() {
  if (!ligado()) return;
  nota(880, 0, 0.14, 0.13);
  nota(1108.73, 0.09, 0.20, 0.11);
}

/** Chegada de resposta da Bruna: nota única, discreta. */
export function playMessage() {
  if (!ligado()) return;
  nota(660, 0, 0.16, 0.08);
}

/** Toque nos botões principais: bem curto e baixo. */
export function playTap() {
  if (!ligado()) return;
  nota(520, 0, 0.06, 0.05);
}

/** Prepara o contexto de áudio no primeiro gesto (evita atraso no 1º som). */
export function primeAudio() {
  audio();
}
