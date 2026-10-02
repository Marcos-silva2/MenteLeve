/* ============================================================
   Sugestões da Bruna — sempre presentes e sempre simples.
   Depois de criar uma tarefa a Bruna sugere até 2 passos curtos e, se a tarefa
   tem data futura, 1 lembrete na véspera. Vale para TODA tarefa: se a IA (ou a
   heurística) não trouxe nada, entram os passos padrão da categoria; se trouxe
   demais, é cortado. Função pura, aplicada ao resultado de qualquer origem.
   ============================================================ */

import { addDaysKey, todayKey } from './dates.js';
import { normalizeCategory, DEFAULT_CATEGORY } from './categories.js';

export const MAX_STEPS = 2;        // passos por tarefa
export const MAX_STEP_LEN = 40;    // caracteres por passo / título do lembrete
export const MAX_TEXT_LEN = 90;    // caracteres da frase do lembrete

// Passos e lembrete padrão: curtos, no infinitivo, servem para qualquer tarefa da categoria.
const PADRAO = {
  trabalho: { passos: ['Definir o próximo passo', 'Reservar um horário'], lembrete: ['revisar', 'Revisar antes de começar'] },
  reunioes: { passos: ['Preparar a pauta', 'Enviar o convite'], lembrete: ['rever a pauta', 'Rever a pauta'] },
  carreira: { passos: ['Separar o material', 'Definir um prazo'], lembrete: ['se preparar', 'Preparar-se'] },
  estudos:  { passos: ['Separar o material', 'Reservar um horário'], lembrete: ['uma revisão rápida', 'Revisão rápida'] },
  casa:     { passos: ['Fazer uma lista', 'Reservar um horário'], lembrete: ['não esquecer', 'Não esquecer'] },
  familia:  { passos: ['Combinar os detalhes', 'Confirmar com todos'], lembrete: ['combinar com a família', 'Combinar com a família'] },
  saude:    { passos: ['Confirmar o horário', 'Separar documentos'], lembrete: ['confirmar o horário', 'Confirmar o horário'] },
  financas: { passos: ['Conferir o valor', 'Agendar o pagamento'], lembrete: ['conferir o valor', 'Conferir o valor'] },
  pessoal:  { passos: ['Definir o plano', 'Reservar um horário'], lembrete: ['organizar o que levar', 'Organizar o que levar'] },
};

const semAcento = (t) => String(t || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();

/** Corta no limite sem partir palavra e sem deixar pontuação no fim. */
export function clip(texto, max) {
  const t = String(texto || '').replace(/\s+/g, ' ').trim();
  if (t.length <= max) return t.replace(/[.,;:\s]+$/, '');
  const corte = t.slice(0, max);
  const espaco = corte.lastIndexOf(' ');
  return (espaco > max * 0.5 ? corte.slice(0, espaco) : corte).replace(/[.,;:\s]+$/, '');
}

/**
 * @param {object} r  { title, category, dueDate, dueTime, subtasks: string[], suggestion }
 * @returns {object}  cópia com `subtasks` (1–2, curtos) e `suggestion` (lembrete) ajustados
 */
export function simplifySuggestions(r, { today = todayKey() } = {}) {
  const categoria = normalizeCategory(r.category) || DEFAULT_CATEGORY;
  const padrao = PADRAO[categoria] || PADRAO[DEFAULT_CATEGORY];
  const titulo = semAcento(r.title);

  // Passos: curtos, sem repetir o título nem entre si, no máximo MAX_STEPS.
  const limpar = (lista) => {
    const vistos = new Set([titulo]);
    const out = [];
    for (const s of lista) {
      const p = clip(s, MAX_STEP_LEN);
      const chave = semAcento(p);
      if (!p || vistos.has(chave)) continue;
      vistos.add(chave);
      out.push(p);
      if (out.length === MAX_STEPS) break;
    }
    return out;
  };
  // Os da IA valem; se ela não mandou nenhum aproveitável, entram os padrão da categoria.
  let finais = limpar(r.subtasks || []);
  if (!finais.length) finais = limpar(padrao.passos);

  // Lembrete: o que veio (curto) ou, com data futura, um padrão na véspera.
  let suggestion = null;
  const sug = r.suggestion;
  if (sug && String(sug.text || '').trim()) {
    let action = sug.action && String(sug.action.title || '').trim()
      ? { ...sug.action, title: clip(sug.action.title, MAX_STEP_LEN) } : null;
    // A heurística sem IA marca o lembrete como "Véspera" sem saber a data final (que pode vir do
    // calendário do formulário): aqui ele passa a ser o dia anterior à tarefa (nunca antes de hoje).
    if (action && action.due === 'Véspera' && r.dueDate) {
      const vespera = addDaysKey(r.dueDate, -1);
      action = { ...action, dueDate: vespera >= today ? vespera : today, dueTime: null, due: '' };
    }
    suggestion = { text: clip(sug.text, MAX_TEXT_LEN), action };
  } else if (r.dueDate && r.dueDate > today) {
    const [paraQue, titulo2] = padrao.lembrete;
    suggestion = {
      text: `Quer um lembrete na véspera para ${paraQue}?`,
      action: { title: titulo2, category: categoria, dueDate: addDaysKey(r.dueDate, -1), dueTime: null, due: '' },
    };
  }

  return { ...r, subtasks: finais, suggestion };
}
