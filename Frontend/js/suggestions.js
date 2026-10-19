/* ============================================================
   Sugestões da Bruna — qualidade antes de quantidade.
   Depois de criar uma tarefa a Bruna pode sugerir:
     - PASSOS: só quando o compromisso tem etapas ou exige preparação (0 a 3, curtos);
     - um LEMBRETE: só quando ajuda (véspera para se preparar, ou pouco antes do horário);
     - AVISOS de contexto: conflito de horário, dia cheio, tarefa repetida.
   Nada é inventado: sem data não há lembrete, e tarefa simples (ligar, comprar pão)
   fica sem passos. Função pura, aplicada ao resultado da IA ou da heurística sem IA.
   Os limites espelham Backend/app/ai.py (MAX_STEPS, MAX_STEP_LEN, MAX_TEXT_LEN).
   ============================================================ */

import { addDaysKey, todayKey } from './dates.js';
import { normalizeCategory, DEFAULT_CATEGORY } from './categories.js';
import { intervalOf, toMinutes, fromMinutes, cleanEndTime } from './timeline.js';

export const MAX_STEPS = 3;        // só em tarefas complexas
export const MAX_STEP_LEN = 48;
export const MAX_TEXT_LEN = 90;
export const AVISO_ANTES_MIN = 30; // lembrete de "início": minutos antes do horário
export const DIA_CHEIO_TAREFAS = 5;
export const DIA_CHEIO_MINUTOS = 6 * 60;

const fold = (t) => String(t || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim();

/** Passos de enchimento: servem para qualquer tarefa e por isso não ajudam em nenhuma. */
const ENCHIMENTO = /^(definir o proximo passo|reservar (um )?(horario|tempo|bloco)( na agenda)?|comecar|iniciar( a tarefa)?|finalizar( a tarefa)?|concluir( a tarefa)?|terminar( a tarefa)?|fazer a tarefa|anotar|planejar|organizar o tempo|pensar|decidir)$/;
export const ehEnchimento = (passo) => ENCHIMENTO.test(fold(passo).replace(/[.!:; ]+$/, ''));

/** Corta no limite sem partir palavra e sem deixar pontuação no fim. */
export function clip(texto, max) {
  const t = String(texto || '').replace(/\s+/g, ' ').trim();
  if (t.length <= max) return t.replace(/[.,;:\s]+$/, '');
  const corte = t.slice(0, max);
  const espaco = corte.lastIndexOf(' ');
  return (espaco > max * 0.5 ? corte.slice(0, espaco) : corte).replace(/[.,;:\s]+$/, '');
}

/* ------------------------------------------------------------
   Base de conhecimento: o que costuma ser preciso ANTES de cada tipo de compromisso.
   A primeira regra que casa vence (as específicas vêm antes). `cats` restringe por categoria
   (evita "exame" de saúde virar prova). `marcado: false` deixa os passos desmarcados — quando
   a pessoa é quem escolhe por onde começar. `lembrete`: { kind, para, titulo }.
   São sugestões, nunca obrigações: a pessoa desmarca o que não servir.
   ------------------------------------------------------------ */
const REGRAS = [
  { id: 'entrevista', quando: /\b(entrevista|processo seletivo|teste tecnico)\b/,
    passos: ['Pesquisar sobre a vaga', 'Preparar exemplos profissionais', 'Conferir horário e local ou link'],
    lembrete: { kind: 'preparo', para: 'se preparar', titulo: 'Preparar-se para a entrevista' } },
  { id: 'apresentacao', quando: /\b(apresentar|apresentacao|apresentacoes|pitch|demonstracao|palestra|seminario)\b/,
    passos: ['Revisar os slides', 'Conferir os dados', 'Preparar os pontos principais'],
    lembrete: { kind: 'preparo', para: 'revisar a apresentação', titulo: 'Revisar a apresentação' } },
  { id: 'viagem', quando: /\b(viagem|viajar|voo|passagem aerea|embarque|hospedagem)\b/,
    passos: ['Conferir documentos e reservas', 'Fazer a mala', 'Organizar o trajeto'],
    lembrete: { kind: 'preparo', para: 'conferir os preparativos', titulo: 'Conferir os preparativos' } },
  { id: 'consulta', cats: ['saude'], quando: /\b(consulta|dentista|medico|medica|exame|exames|vacina|fisioterapia|retorno)\b/,
    passos: ['Confirmar horário e local', 'Separar documentos e exames'],
    lembrete: { kind: 'preparo', para: 'confirmar o horário', titulo: 'Confirmar o horário' } },
  { id: 'prova', cats: ['estudos'], quando: /\b(prova|exame|simulado|concurso|certificacao|vestibular|enem)\b/,
    passos: ['Separar o material', 'Revisar os pontos principais', 'Resolver exercícios'],
    lembrete: { kind: 'preparo', para: 'uma revisão rápida', titulo: 'Fazer uma revisão rápida' } },
  { id: 'relatorio', quando: /\b(relatorio|parecer|documento)\b/,
    passos: ['Reunir os dados', 'Elaborar o relatório', 'Revisar o documento'],
    lembrete: { kind: 'preparo', para: 'a revisão final', titulo: 'Fazer a revisão final' } },
  { id: 'entrega', cats: ['trabalho', 'estudos', 'carreira'], quando: /\b(entrega|entregar|entregue)\b/,
    // "entregar o presente / a encomenda" é outra coisa: nada de "revisar antes de enviar"
    exceto: /\b(presente|encomenda|pacote|convite|compras|comida|flores)\b/,
    passos: ['Conferir o que falta', 'Revisar antes de enviar'],
    lembrete: { kind: 'preparo', para: 'a revisão final', titulo: 'Fazer a revisão final' } },
  { id: 'proposta', cats: ['trabalho', 'reunioes'], quando: /\b(proposta|orcamento|contrato)\b/,
    passos: ['Levantar as informações', 'Revisar valores e prazos'],
    lembrete: { kind: 'preparo', para: 'revisar a proposta', titulo: 'Revisar a proposta' } },
  { id: 'reuniao-organizar', quando: /\b(marcar|agendar|organizar|convocar)\b.*\b(reuniao|call|alinhamento|videochamada)\b|\b(reuniao|call|alinhamento)\b.*\b(marcar|agendar|convocar)\b/,
    passos: ['Definir os pontos a tratar', 'Enviar o convite'],
    lembrete: { kind: 'preparo', para: 'revisar a pauta', titulo: 'Revisar a pauta' } },
  { id: 'reuniao', quando: /\b(reuniao|reunioes|call|alinhamento|videochamada|1:1|one on one)\b/,
    passos: ['Preparar os pontos a tratar'],
    lembrete: { kind: 'preparo', para: 'revisar a pauta', titulo: 'Revisar a pauta' } },
  { id: 'conta', cats: ['financas'], quando: /\b(pagar|boleto|fatura|imposto|irpf|mensalidade|parcela)\b/,
    passos: ['Conferir valor e vencimento'],
    lembrete: { kind: 'preparo', para: 'conferir o vencimento', titulo: 'Conferir o vencimento' } },
  { id: 'casa', cats: ['casa'], quando: /\b(organizar|arrumar|faxina|limpeza|limpar)\b.*\b(casa|apartamento|quarto|guarda roupa|armario)\b|\b(faxina|arrumar a casa|organizar a casa|limpeza geral)\b/,
    // quem decide por onde começar é a pessoa: nada vem marcado
    marcado: false, passos: ['Organizar a cozinha', 'Organizar os quartos', 'Organizar o banheiro'], lembrete: null },
  { id: 'mercado', quando: /\b(mercado|supermercado|feira|compras do mes)\b/,
    passos: ['Fazer a lista de compras'], lembrete: null },
  { id: 'festa', quando: /\b(organizar|planejar|preparar)\b.*\b(festa|aniversario|churrasco|confraternizacao|jantar)\b|\bfesta de\b/,
    passos: ['Definir convidados e local', 'Combinar comida e bebida', 'Enviar os convites'],
    lembrete: { kind: 'preparo', para: 'conferir os preparativos', titulo: 'Conferir os preparativos' } },
  { id: 'aniversario', cats: ['familia', 'pessoal'], quando: /\baniversario\b/,
    passos: ['Escolher o presente'], lembrete: null },
  { id: 'curriculo', cats: ['carreira'], quando: /\b(curriculo|linkedin|portfolio)\b/,
    passos: ['Atualizar as experiências recentes', 'Revisar antes de enviar'], lembrete: null },
  { id: 'pedido', cats: ['carreira'], quando: /\b(aumento|promocao|feedback|avaliacao de desempenho)\b/,
    passos: ['Listar suas entregas e resultados', 'Definir o que você quer pedir'], lembrete: null },
  // tarefa grande: sugere dividir, sem inventar as etapas
  { id: 'projeto', quando: /\b(projeto|tcc|monografia|dissertacao|mudanca|reforma|migracao|plano de negocios)\b/,
    passos: ['Listar as etapas principais', 'Definir o primeiro passo'], lembrete: null },
];

/** A regra do compromisso (ou null: tarefa simples, sem passos a sugerir). */
export function regraPara(titulo, categoria) {
  const t = fold(titulo);
  return REGRAS.find((r) => (!r.cats || r.cats.includes(categoria)) && r.quando.test(t) && !(r.exceto && r.exceto.test(t))) || null;
}

/* ------------------------------------------------------------
   Lembrete: o QUANDO é calculado aqui, a partir da data e do horário da tarefa.
   ------------------------------------------------------------ */
const agoraEmMinutos = () => { const d = new Date(); return d.getHours() * 60 + d.getMinutes(); };

/**
 * @returns {{kind, dueDate, dueTime}|null}
 *  - preparo: na véspera (sem horário). Hoje não há véspera: com horário por vir vira "inicio".
 *  - inicio: AVISO_ANTES_MIN minutos antes do horário; exige horário e que o momento não tenha passado.
 *  Sem data, ou já no passado: null (não se inventa momento).
 */
export function quandoLembrar(kind, { dueDate, dueTime }, { today = todayKey(), nowMinutes = agoraEmMinutos() } = {}) {
  if (!dueDate || dueDate < today) return null;
  const inicio = () => {
    const min = toMinutes(dueTime);
    if (min === null) return null;
    const aviso = min - AVISO_ANTES_MIN;
    if (aviso < 0 || (dueDate === today && aviso <= nowMinutes)) return null;
    return { kind: 'inicio', dueDate, dueTime: fromMinutes(aviso) };
  };
  if (kind === 'inicio') return inicio();
  if (dueDate > today) return { kind: 'preparo', dueDate: addDaysKey(dueDate, -1), dueTime: null };
  return inicio();   // "preparo" para hoje: só resta avisar antes do horário, se houver
}

/* ------------------------------------------------------------
   Contexto: conflitos, dia cheio e tarefas repetidas (tudo no aparelho; nada é enviado).
   ------------------------------------------------------------ */
const abertas = (tasks) => (tasks || []).filter((t) => !t.done && !t.parentId);

function cargaDoDia(tasks, dia) {
  const doDia = abertas(tasks).filter((t) => t.dueDate === dia);
  const minutos = doDia.reduce((s, t) => { const iv = intervalOf(t); return s + (iv ? iv[1] - iv[0] : 0); }, 0);
  return { tarefas: doDia, n: doDia.length, minutos };
}

function observacoes(r, tasks, spaces, today) {
  const notas = [];
  const titulo = fold(r.title);

  const igual = abertas(tasks).find((t) => fold(t.title) === titulo && (!t.dueDate || !r.dueDate || t.dueDate === r.dueDate));
  if (igual) {
    notas.push(`Você já tem uma tarefa parecida: “${clip(igual.title, 40)}”.`);
    return { notas, repetida: true, cheio: false };
  }
  if (!r.dueDate) return { notas, repetida: false, cheio: false };

  const carga = cargaDoDia(tasks, r.dueDate);
  const meu = r.dueTime ? [toMinutes(r.dueTime), toMinutes(cleanEndTime(r.dueTime, r.endTime)) ?? toMinutes(r.dueTime) + 30] : null;
  if (meu && meu[0] !== null) {
    const choque = carga.tarefas.find((t) => { const iv = intervalOf(t); return iv && iv[0] < meu[1] && meu[0] < iv[1]; });
    if (choque) notas.push(`Conflito de horário: você já tem “${clip(choque.title, 32)}” às ${choque.dueTime}.`);
  }

  const cheio = carga.n >= DIA_CHEIO_TAREFAS || carga.minutos >= DIA_CHEIO_MINUTOS;
  if (cheio) {
    // um dia próximo claramente mais leve; senão, só o aviso
    let melhor = null;
    for (let i = 1; i <= 3; i++) {
      const dia = addDaysKey(r.dueDate, i);
      if (dia < today) continue;
      const c = cargaDoDia(tasks, dia);
      if (c.n <= carga.n - 2 && (!melhor || c.n < melhor.n)) melhor = { dia, n: c.n };
    }
    let msg = `Este dia já está cheio (${carga.n} ${carga.n === 1 ? 'tarefa' : 'tarefas'}).`;
    if (melhor) { const [, m, d] = melhor.dia.split('-'); msg += ` O dia ${d}/${m} está mais livre.`; }
    else if ((spaces || []).length) msg += ` Se der, divida com “${clip(spaces[0].name, 24)}”.`;
    notas.push(msg);
  }
  return { notas, repetida: false, cheio };
}

/* ------------------------------------------------------------
   API
   ------------------------------------------------------------ */
/**
 * @param {object} r     { title, category, dueDate, dueTime, endTime, subtasks: string[], suggestion }
 * @param {object} ctx   { tasks, spaces, today, nowMinutes, fromAi }
 * @returns {{ steps: {text, checked}[], reminder: {text, action}|null, notes: string[] }}
 */
export function buildSuggestions(r, ctx = {}) {
  const today = ctx.today || todayKey();
  const tasks = ctx.tasks || [];
  const categoria = normalizeCategory(r.category) || DEFAULT_CATEGORY;
  const titulo = fold(r.title);

  const { notas, repetida, cheio } = observacoes(r, tasks, ctx.spaces, today);
  if (repetida) return { steps: [], reminder: null, notes: notas };

  // ---- passos: os da IA valem; sem eles, a base de conhecimento (só se o compromisso for reconhecido) ----
  const jaTem = new Set(abertas(tasks).filter((t) => !r.dueDate || t.dueDate === r.dueDate || !t.dueDate).map((t) => fold(t.title)));
  const limpar = (lista, marcado = true) => {
    const vistos = new Set([titulo]);
    const out = [];
    for (const s of lista) {
      const p = clip(s, MAX_STEP_LEN);
      const k = fold(p);
      if (!p || ehEnchimento(p) || vistos.has(k) || jaTem.has(k)) continue;
      vistos.add(k);
      out.push({ text: p, checked: marcado });
    }
    return out;
  };
  const regra = regraPara(r.title, categoria);
  let steps = limpar(r.subtasks || []);
  if (!steps.length && regra) steps = limpar(regra.passos, regra.marcado !== false);
  // Dia cheio: nada que aumente a carga além do essencial.
  steps = steps.slice(0, cheio ? 1 : MAX_STEPS);

  // ---- lembrete: o que a IA sugeriu, ou o da regra; o quando é sempre calculado aqui ----
  let reminder = null;
  const ia = r.suggestion && String(r.suggestion.text || '').trim() ? r.suggestion : null;
  const kindIa = ia && (ia.kind === 'inicio' ? 'inicio' : 'preparo');
  const alvo = ia ? { kind: kindIa, titulo: ia.action && ia.action.title, texto: ia.text } : regra && regra.lembrete
    ? { kind: regra.lembrete.kind, titulo: regra.lembrete.titulo, para: regra.lembrete.para } : null;
  if (alvo && !cheio) {
    const quando = quandoLembrar(alvo.kind, r, { today, nowMinutes: ctx.nowMinutes ?? agoraEmMinutos() });
    if (quando) {
      const texto = alvo.texto ? clip(alvo.texto, MAX_TEXT_LEN)
        : quando.kind === 'inicio' ? `Quer um aviso ${AVISO_ANTES_MIN} min antes${alvo.para ? ` para ${alvo.para}` : ''}?`
          : `Quer um lembrete na véspera para ${alvo.para}?`;
      reminder = {
        text: texto,
        kind: quando.kind,
        action: alvo.titulo && String(alvo.titulo).trim()
          ? { title: clip(alvo.titulo, MAX_STEP_LEN), category: categoria, dueDate: quando.dueDate, dueTime: quando.dueTime, due: '' }
          : null,
      };
    }
  }

  return { steps, reminder, notes: notas };
}
