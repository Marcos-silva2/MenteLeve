/* ============================================================
   Equilíbrio Trabalho × Pessoal — resumo da semana.
   Função pura: recebe as tarefas e o primeiro dia da semana e conta, por grupo,
   o tempo agendado (tarefas com horário), quantas tarefas há e quantas foram
   concluídas. Mostrado no topo da visão Semana da Agenda.
   ============================================================ */

import { getCategory, normalizeCategory } from './categories.js';
import { intervalOf } from './timeline.js';
import { addDaysKey } from './dates.js';

const vazio = () => ({ minutes: 0, count: 0, done: 0, timed: 0 });

/** Limite acima do qual o app sugere olhar o equilíbrio (fatia do tempo agendado). */
export const LIMITE_DESEQUILIBRIO = 0.75;

/**
 * @param {object[]} tasks     todas as tarefas (subtarefas são ignoradas)
 * @param {string}   weekStart "AAAA-MM-DD" da segunda-feira
 * @returns {{ trabalho, vida, totalMinutes, busiest, share, mensagem }}
 *   `share` = fatia do Trabalho no tempo agendado (null sem nenhum horário).
 *   Recorrentes contam só a ocorrência atual (o prazo que está na tarefa).
 */
export function weekBalance(tasks, weekStart) {
  const fim = addDaysKey(weekStart, 6);
  const out = { trabalho: vazio(), vida: vazio() };
  const porDia = new Map();

  for (const t of tasks || []) {
    if (t.parentId || !t.dueDate || t.dueDate < weekStart || t.dueDate > fim) continue;
    const cat = getCategory(normalizeCategory(t.category));
    const g = out[cat ? cat.group : 'vida'];
    g.count += 1;
    if (t.done) g.done += 1;
    const iv = intervalOf(t);
    if (iv) {
      g.timed += 1;
      g.minutes += iv[1] - iv[0];
      porDia.set(t.dueDate, (porDia.get(t.dueDate) || 0) + (iv[1] - iv[0]));
    }
  }

  const total = out.trabalho.minutes + out.vida.minutes;
  let busiest = null;
  for (const [key, minutes] of porDia) if (!busiest || minutes > busiest.minutes) busiest = { key, minutes };
  const share = total > 0 ? out.trabalho.minutes / total : null;

  return { ...out, totalMinutes: total, busiest, share, mensagem: mensagemDe(out, total, share) };
}

function mensagemDe(g, total, share) {
  const n = g.trabalho.count + g.vida.count;
  if (n === 0) return 'Semana livre por enquanto. Que tal agendar algo dos dois lados?';
  if (total === 0) return 'Ainda sem horários marcados — dê um horário às tarefas para ver como o tempo se divide.';
  if (share >= LIMITE_DESEQUILIBRIO) return 'O trabalho ocupa a maior parte do seu tempo agendado. Reserve um bloco para você.';
  if (share <= 1 - LIMITE_DESEQUILIBRIO) return 'Sua semana está bem voltada à vida pessoal. Confira se os prazos do trabalho estão cobertos.';
  return 'Boa divisão entre trabalho e vida pessoal nesta semana.';
}

/** 90 → "1h30", 45 → "45 min", 120 → "2h", 0 → "0 min". */
export function formatMinutes(min) {
  const m = Math.round(min || 0);
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60); const r = m % 60;
  return r ? `${h}h${String(r).padStart(2, '0')}` : `${h}h`;
}
