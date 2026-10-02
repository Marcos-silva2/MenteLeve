/* ============================================================
   Categorias e grupos (Trabalho / Pessoal)
   Fonte única no frontend; o backend espelha em app/categories.py.
   As cores são tokens do tema ativo (var(--color-*)), então acompanham
   a troca de tema sem precisar de nada aqui.
   ============================================================ */

export const GROUPS = [
  { id: 'trabalho', label: 'Trabalho' },
  // O id continua 'vida' (está salvo no aparelho em menteleve.group); só o rótulo é "Pessoal".
  { id: 'vida',     label: 'Pessoal' },
];

// Trabalho usa a família "estrutura" do tema; Vida usa a família "destaque".
export const CATEGORIES = [
  { id: 'trabalho', label: 'Trabalho',  group: 'trabalho', dot: 'var(--color-primary-900)' },
  { id: 'reunioes', label: 'Reuniões',  group: 'trabalho', dot: 'var(--color-primary-700)' },
  { id: 'carreira', label: 'Carreira',  group: 'trabalho', dot: 'var(--color-primary-800)' },
  { id: 'estudos',  label: 'Estudos',   group: 'trabalho', dot: 'var(--color-muted)' },
  { id: 'casa',     label: 'Casa',      group: 'vida',     dot: 'var(--color-accent-hover)' },
  { id: 'familia',  label: 'Família',   group: 'vida',     dot: 'var(--color-primary-600)' },
  { id: 'saude',    label: 'Saúde',     group: 'vida',     dot: 'var(--color-accent)' },
  { id: 'financas', label: 'Finanças',  group: 'vida',     dot: 'var(--color-soft-300)' },
  { id: 'pessoal',  label: 'Pessoal',   group: 'vida',     dot: 'var(--color-soft-200)' },
];

export const DEFAULT_CATEGORY = 'casa';

// Categorias de antes da ampliação para vida + trabalho -> equivalente atual.
// Tarefas salvas no aparelho e filas offline antigas ainda as carregam.
export const LEGACY_CATEGORIES = { filhos: 'familia', relacionamento: 'pessoal' };

/** Converte categoria antiga na atual; o que não é conhecido vira a padrão. */
export function normalizeCategory(id) {
  const atual = LEGACY_CATEGORIES[id] || id;
  return CATEGORIES.some((c) => c.id === atual) ? atual : DEFAULT_CATEGORY;
}

export const getCategory = (id) => {
  const atual = LEGACY_CATEGORIES[id] || id;
  return CATEGORIES.find((c) => c.id === atual) || null;
};

export const categoriesOf = (group) =>
  group === 'tudo' ? CATEGORIES : CATEGORIES.filter((c) => c.group === group);

/** A tarefa pertence ao grupo? 'tudo' aceita todas. */
export function inGroup(task, group) {
  if (!group || group === 'tudo') return true;
  return getCategory(normalizeCategory(task.category)).group === group;
}

// ---- Palpite de categoria por palavras-chave ----
// Só entra quando a IA não responde (modo sem IA / offline). A ordem importa:
// a primeira regra que casar vence, então os contextos mais específicos vêm antes.
const RULES = [
  ['casa',     /\b(condominio|sindico|oficina|mecanico)\b/],
  ['saude',    /\b(vacina|consulta|medic[oa]s?|dentista|exame|exames|remedios?|terapia|psicolog[oa]|academia|treino|yoga|pilates|corrida|fisioterapia|nutricionista|saude)\b/],
  ['familia',  /\b(filh[oa]s?|crianca|bebe|fralda|escola|creche|pediatra|mae|pai|reuniao de pais|avo|avos|sogr[oa]|irma[oa]|sobrinh[oa]|tio|tia|familia|leo)\b/],
  ['reunioes', /\b(reuniao|reunioes|call|1:1|alinhamento|standup|stand-up|daily|weekly|videochamada|apresentacao|apresentar|workshop|webinar|kickoff|retrospectiva)\b/],
  ['carreira', /\b(curriculo|cv|linkedin|entrevista|promocao|aumento|networking|portfolio|vaga|recrutador|mentoria|feedback|plano de carreira)\b/],
  ['estudos',  /\b(estudar|estudo|estudos|curso|prova|provas|faculdade|aula|aulas|tcc|certificacao|certificado|ingles|espanhol|idioma|leitura|livro|artigo|simulado|vestibular|enem|mba)\b/],
  ['financas', /\b(pagar|pagamento|boleto|fatura|imposto|irpf|imposto de renda|banco|dinheiro|investimento|investir|financiamento|aluguel|condominio|cartao|transferir|pix|salario|poupanca|contas? de \w+|pagar contas?)\b/],
  ['trabalho', /\b(relatorio|projeto|cliente|clientes|entrega|entregar|prazo|e-?mails?|proposta|contrato|planilha|deploy|sprint|chefe|gerente|equipe|empresa|escritorio|trabalho|expediente|ticket|chamado|briefing|cronograma)\b/],
  ['pessoal',  /\b(amig[oa]s?|parceir[oa]|marido|esposa|namor\w*|jantar|cinema|show|festa|viagem|viajar|hobby|passeio|ferias|autocuidado|meditar|meditacao|massagem|salao|cabelo|presente)\b/],
  ['casa',     /\b(mercado|supermercado|limpeza|limpar|faxina|lavar|roupa|cozinha|cozinhar|jardim|conserto|consertar|reforma|feira|comprar|compras|lixo|pet|cachorro|gato|arrumar)\b/],
];

const semAcento = (t) => t.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

/** Palpite de categoria a partir do texto; sem pista nenhuma, a categoria padrão. */
export function guessCategory(text) {
  const t = semAcento(String(text || ''));
  for (const [id, re] of RULES) if (re.test(t)) return id;
  return DEFAULT_CATEGORY;
}

// ---- Grupo escolhido (lembrado entre Home e Agenda e entre sessões) ----
const GROUP_KEY = 'menteleve.group';

export function getGroupFilter() {
  try {
    const g = localStorage.getItem(GROUP_KEY);
    return GROUPS.some((x) => x.id === g) ? g : 'tudo';
  } catch {
    return 'tudo';
  }
}

export function setGroupFilter(group) {
  const g = GROUPS.some((x) => x.id === group) ? group : 'tudo';
  try {
    if (g === 'tudo') localStorage.removeItem(GROUP_KEY);
    else localStorage.setItem(GROUP_KEY, g);
  } catch { /* storage bloqueado: vale só nesta sessão */ }
  return g;
}
