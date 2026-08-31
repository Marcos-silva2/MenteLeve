/* ============================================================
   sound.js — Feedback sonoro discreto

   Os sons são SINTETIZADOS pela Web Audio API, não carregados de arquivos.
   Motivo: o precache do PWA foi reduzido a ~125 KB; anexar .mp3 andaria para
   trás. Sintetizar custa zero byte, não tem licenciamento e não pode dar 404
   no modo offline.

   Nada aqui pode quebrar a ação que disparou o som — tudo é tolerante a falha.
   ============================================================ */

import { getSoundLevel } from './store.js';

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

/**
 * Cada som pertence a uma família, e é a família que o nível escolhido no
 * Perfil libera ou não:
 *
 *   'recompensa' — concluir, desfazer, o Aha Moment. O retorno que sustenta o
 *                  hábito; sobrevive no nível "Só conclusões".
 *   'ambiente'   — Bruna, toques, ciclo, erro. Acompanham a navegação e são o
 *                  que incomoda quem quer silêncio parcial.
 */
const ligado = (familia = 'ambiente') => {
  try {
    const nivel = getSoundLevel();
    if (nivel === 'silencio') return false;
    if (nivel === 'conclusoes') return familia === 'recompensa';
    return true;
  } catch (_) {
    return false;
  }
};

/** Recompensa ao concluir uma tarefa: duas notas ascendentes (Lá → Dó#). */
export function playComplete() {
  if (!ligado('recompensa')) return;
  nota(880, 0, 0.14, 0.13);
  nota(1108.73, 0.09, 0.20, 0.11);
}

/**
 * Desfazer a conclusão: as mesmas duas notas, na ordem inversa (Dó# → Lá).
 * A simetria comunica a reversão sem nenhuma palavra — e por ser o espelho de
 * `playComplete`, pertence à mesma família.
 */
export function playUndo() {
  if (!ligado('recompensa')) return;
  nota(1108.73, 0, 0.12, 0.09);
  nota(880, 0.08, 0.18, 0.08);
}

/**
 * Registro de menstruação no calendário.
 *
 * Nota grave e longa, sem o brilho das outras: é um registro íntimo, não uma
 * conquista de produtividade, e soar como "tarefa concluída" seria uma leitura
 * errada do momento.
 */
export function playCycle() {
  if (!ligado()) return;
  nota(440, 0, 0.42, 0.07);
}

/**
 * Falha (sync que não subiu, credencial recusada). Nota grave e curta, sem
 * segunda voz: é reconhecida como erro sem soar como punição. O aviso na tela
 * continua sendo o principal — este som só evita que a falha passe batida.
 */
export function playError() {
  if (!ligado()) return;
  nota(330, 0, 0.22, 0.07);
}

/**
 * *Aha Moment*: a IA acabou de decompor a tarefa em passos.
 *
 * É o momento de maior valor do produto e era o único sem som nenhum. Três
 * notas ascendentes (Lá → Dó# → Mi, o acorde de Lá maior) em vez das duas de
 * `playComplete`: soa como "abriu-se algo", não como "terminei um item". É o
 * som mais longo do app de propósito — e nenhum outro tem três notas, então
 * não se confunde com o resto.
 */
export function playAha() {
  if (!ligado('recompensa')) return;
  nota(880, 0, 0.16, 0.11);
  nota(1108.73, 0.10, 0.18, 0.10);
  nota(1318.51, 0.20, 0.26, 0.09);
}

/**
 * Tarefa registrada.
 *
 * Duas notas ascendentes como `playComplete`, mas em outro par (Mi → Lá) e mais
 * baixas: anotar não é o mesmo que concluir, e confundir os dois roubaria o
 * peso da conclusão. Só toca quando o Aha Moment NÃO abre — senão dois sons se
 * atropelariam, e ali quem manda é o `playAha`.
 */
export function playAdd() {
  if (!ligado()) return;
  nota(659.25, 0, 0.10, 0.07);
  nota(880, 0.07, 0.16, 0.06);
}

/**
 * Tarefa removida: as duas notas descendo (Lá → Mi), espelho de `playAdd`.
 * Mesma simetria que `playUndo` faz com `playComplete` — o app inteiro diz
 * "desfeito" invertendo a ordem, e não com um som de erro. Remover algo que se
 * quis remover não é falha.
 */
export function playDelete() {
  if (!ligado()) return;
  nota(880, 0, 0.09, 0.06);
  nota(659.25, 0.06, 0.16, 0.05);
}

/**
 * A última pendência do dia caiu: a lista ficou vazia.
 *
 * O acorde de Lá maior de `playAha` seguindo até a oitava (Lá → Dó# → Mi → Lá).
 * É o som mais longo e mais alto do app, e o único que fecha a oitava — é o
 * momento que o produto inteiro existe para entregar, e acontece poucas vezes
 * ao dia, então não cansa. Toca DEPOIS de `playComplete`, que já soou na
 * conclusão em si; o atraso evita que as duas se sobreponham.
 */
export function playAllDone() {
  if (!ligado('recompensa')) return;
  const t = 0.26;   // deixa o playComplete da própria conclusão terminar
  nota(880, t, 0.16, 0.10);
  nota(1108.73, t + 0.11, 0.18, 0.10);
  nota(1318.51, t + 0.22, 0.20, 0.09);
  nota(1760, t + 0.33, 0.44, 0.08);
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
