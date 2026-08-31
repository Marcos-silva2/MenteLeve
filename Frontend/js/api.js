/* ============================================================
   api.js — Cliente REST do backend (FastAPI) + heurística local
   - Cliente REST: cadastro/login, tarefas, premium
     (auth via token JWT no header Authorization: Bearer)
   - decomposeTask(): "IA temporária" client-side que gera o Aha Moment
     enquanto a IA real não está plugada no backend (/tasks/smart).
   ============================================================ */

import { todayKey, resolveDue, resolveTime, addDaysKey } from './dates.js';

// Base da API: em dev local usa o backend local; em produção, o Render.
// (hostname vazio = arquivo aberto via file://, tratado como local.)
const _isLocalHost = ['localhost', '127.0.0.1', ''].includes(location.hostname);
export const API_BASE = _isLocalHost
  ? 'http://localhost:8000'
  : 'https://menteleve.onrender.com';

let _token = null;      // token JWT (definido após login/cadastro)
let _online = null;     // status do backend (true cacheado; false re-tenta)
let _lastCheck = 0;     // timestamp do último ping (cache negativo curto)
const NEG_TTL = 10000;  // re-tenta o /health 10s após uma falha

/** Erro de sessão inválida/expirada (HTTP 401) — o app deve pedir login. */
export class AuthError extends Error {
  constructor(message = 'Sessão expirada') {
    super(message);
    this.name = 'AuthError';
    this.status = 401;
  }
}

export function setAuthToken(token) {
  _token = token || null;
}

export const hasAuthToken = () => !!_token;
export const getAuthToken = () => _token;

// Handler chamado quando o backend rejeita o token (401) em qualquer chamada.
// O store registra aqui para limpar a sessão e mandar a usuária ao login —
// sem isso, um token expirado pareceria "backend offline" para sempre.
let _onSessionExpired = null;
export function onSessionExpired(fn) {
  _onSessionExpired = fn;
}

function headers(extra = {}) {
  const h = { 'Content-Type': 'application/json', ...extra };
  if (_token) h['Authorization'] = `Bearer ${_token}`;
  return h;
}

async function request(path, options = {}) {
  const res = await fetch(`${API_BASE}${path}`, options);
  if (!res.ok) {
    // 401 é tratado à parte: significa sessão inválida/expirada, e não
    // "backend fora do ar" — o app precisa mandar a usuária para o login.
    if (res.status === 401) {
      // Nas rotas de login/cadastro o 401 é "credencial errada", não sessão
      // expirada — quem chamou trata; não dispara o logout global.
      if (_token && !path.startsWith('/auth/login') && !path.startsWith('/auth/register')) {
        setAuthToken(null);
        if (_onSessionExpired) _onSessionExpired();
      }
      throw new AuthError();
    }
    const err = new Error(`HTTP ${res.status}`);
    err.status = res.status;
    throw err;
  }
  return res.status === 204 ? null : res.json();
}

/** Um ping ao /health com timeout. Retorna true/false (não cacheia). */
async function pingHealth(timeoutMs) {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), timeoutMs);
    const res = await fetch(`${API_BASE}/health`, { signal: ctrl.signal, cache: 'no-store' });
    clearTimeout(t);
    return res.ok;
  } catch (_) {
    return false;
  }
}

/**
 * Verifica se o backend está no ar.
 * - Resultado POSITIVO é cacheado (uma vez online, segue online na sessão).
 * - Enquanto offline, re-tenta após NEG_TTL (importante p/ cold start do Render).
 */
export async function ensureOnline(forceRecheck = false) {
  if (_online === true && !forceRecheck) return true;
  if (!forceRecheck && _online === false && (Date.now() - _lastCheck) < NEG_TTL) return false;
  const timeoutMs = _isLocalHost ? 2000 : 8000;
  _online = await pingHealth(timeoutMs);
  _lastCheck = Date.now();
  return _online;
}

/**
 * "Acorda" o backend (o Render free dorme após ~15min). Faz pings com
 * re-tentativas até responder ou estourar o tempo total (~cold start de 60-90s).
 * Atualiza o status online. Não bloqueante — chame no boot do app.
 */
export async function wakeBackend({ attempts = 14, intervalMs = 4000 } = {}) {
  if (_online === true) return true;
  for (let i = 0; i < attempts; i++) {
    if (await pingHealth(_isLocalHost ? 2000 : 9000)) {
      _online = true;
      _lastCheck = Date.now();
      return true;
    }
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  return _online === true;
}

export const isOnline = () => _online === true;

// --------- Normalização backend <-> frontend ---------
// Backend Task: {id, user_id, title, category, due_date, due_time, due, done, important, created_at}
// Frontend Task: {id(string), title, category, dueDate, dueTime, due, done, important, createdAt}
function fromServer(t) {
  return {
    id: String(t.id),
    title: t.title,
    category: t.category,
    // Prazo estruturado (fonte da verdade); `due` é só o rótulo legado.
    dueDate: t.due_date || null,
    dueTime: t.due_time || null,
    due: t.due || '',
    done: !!t.done,
    important: !!t.important,
    // Backend ainda não tem coluna de prioridade: deriva de `important`.
    priority: t.important ? 'alta' : 'media',
    parentId: t.parent_id != null ? String(t.parent_id) : null,
    createdAt: t.created_at ? Date.parse(t.created_at) : Date.now(),
  };
}

// ----------------------- Auth -----------------------
/**
 * Autentica com e-mail + senha. Guarda o token e retorna o usuário.
 * - Retorna null se o backend estiver offline (cold start do Render).
 * - Lança AuthError (401) se as credenciais estiverem incorretas.
 */
export async function apiLogin(email, password) {
  if (!(await ensureOnline(true))) return null;
  const data = await request('/auth/login', {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({ email, password }),
  });
  setAuthToken(data.access_token);
  return data.user;
}

/**
 * Cria a conta e já autentica. Mesmas regras do apiLogin, mas lança um
 * erro com status 409 quando o e-mail já está cadastrado.
 */
export async function apiRegister(email, name, password) {
  if (!(await ensureOnline(true))) return null;
  const data = await request('/auth/register', {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({ email, name, password }),
  });
  setAuthToken(data.access_token);
  return data.user;
}

/** Valida o token atual e devolve o usuário. Lança AuthError se expirado. */
export async function apiMe() {
  if (!_token || !(await ensureOnline())) return null;
  return request('/auth/me', { headers: headers() });
}

/**
 * Ativa ou cancela o Premium. Devolve o usuário atualizado pelo servidor.
 *
 * Ativar e cancelar são rotas distintas de propósito. A ativação passa por
 * `/auth/me/premium/simulate`, que o servidor pode recusar (403) quando a
 * cobrança real estiver ligada — o cliente não decide mais quem é Premium.
 * O cancelamento é sempre da própria usuária, e continua permitido.
 *
 * Retorna `null` quando não há sessão ou o backend está fora do ar (nada foi
 * decidido). Uma RECUSA do servidor é propagada como erro com `.status`, e não
 * pode ser confundida com estar offline — quem chama precisa dessa diferença
 * para saber se mantém o estado otimista ou o reverte.
 */
export async function apiSetPremium(isPremium) {
  if (!_token || !(await ensureOnline())) return null;
  return isPremium
    ? request('/auth/me/premium/simulate', { method: 'POST', headers: headers() })
    : request('/auth/me/premium', { method: 'DELETE', headers: headers() });
}

// ----------------------- Tasks -----------------------
/** Lista as tarefas do usuário. Retorna array (front-format) ou null. */
export async function apiListTasks() {
  if (!_token || !(await ensureOnline())) return null;
  try {
    const tasks = await request('/tasks', { headers: headers() });
    return tasks.map(fromServer);
  } catch (_) {
    return null;
  }
}

/** Cria uma tarefa. Retorna a tarefa persistida (front-format) ou null. */
export async function apiCreateTask({ title, category, dueDate, dueTime, due, important, parentId }) {
  if (!_token || !(await ensureOnline())) return null;
  try {
    const t = await request('/tasks', {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify({
        title,
        category,
        due_date: dueDate || null,
        due_time: dueTime || null,
        due: due || '',
        important: !!important,
        parent_id: parentId != null ? Number(parentId) : null,
      }),
    });
    return fromServer(t);
  } catch (_) {
    return null;
  }
}

/**
 * Análise inteligente (IA do backend) de um texto livre — o "Aha Moment".
 * Retorna { title, category, dueDate, dueTime, subtasks, suggestion } ou null
 * se offline/erro (o chamador então usa a heurística local decomposeTask).
 * NÃO persiste a tarefa; o app cria via apiCreateTask/addTask depois.
 *
 * `today` é a data local da usuária: o servidor roda em UTC e, à noite no
 * Brasil, resolveria "amanhã" com um dia de diferença.
 */
export async function apiSmartTask(text) {
  if (!_token || !(await ensureOnline())) return null;
  try {
    const r = await request('/tasks/smart', {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify({ text, today: todayKey() }),
    });
    // O servidor tem um fallback próprio: quando a IA não responde, devolve 200
    // com o título normalizado, categoria "casa" e sem data. Aceitar isso como
    // análise desliga a heurística local — que, para "dentista sexta 15h", ao
    // menos acha a data e a categoria. `ai: false` é o servidor dizendo que não
    // analisou; devolvemos null para o chamador usar decomposeTask().
    if (r.ai === false) return null;

    const act = r.suggestion && r.suggestion.action;
    return {
      title: r.title || text,
      category: r.category || 'casa',
      dueDate: r.due_date || null,
      dueTime: r.due_time || null,
      due: r.due || '',
      subtasks: Array.isArray(r.subtasks) ? r.subtasks : [],
      suggestion: r.suggestion
        ? {
            text: r.suggestion.text,
            action: act
              ? {
                  title: act.title,
                  category: act.category,
                  dueDate: act.due_date || null,
                  dueTime: act.due_time || null,
                  due: act.due || '',
                }
              : null,
          }
        : null,
    };
  } catch (_) {
    return null;
  }
}

// O backend aceita no máximo 40 mensagens (ChatIn). Enviar o histórico inteiro
// fazia toda requisição virar 422 depois de ~20 trocas — e a Bruna passava a
// responder só com as frases prontas, para sempre.
const CHAT_HISTORY_MAX = 30;

/**
 * Conversa com a Bruna (IA). Recebe o histórico [{role, content}] e retorna
 * { reply, tasks, limiteAtingido } — ou null se offline/erro.
 * `tasks` traz as tarefas que ela criou/concluiu nesta resposta.
 */
export async function apiChat(messages) {
  if (!_token || !(await ensureOnline())) return null;
  try {
    const r = await request('/ai/chat', {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify({
        messages: messages.slice(-CHAT_HISTORY_MAX),
        today: todayKey(),
      }),
    });
    if (!r || !r.reply) return null;
    return {
      reply: r.reply,
      tasks: Array.isArray(r.tasks) ? r.tasks.map(fromServer) : [],
      limiteAtingido: !!r.limite_atingido,
    };
  } catch (_) {
    return null;
  }
}

export async function apiSetDone(id, done) {
  if (!_token || !(await ensureOnline())) return null;
  const verb = done ? 'complete' : 'uncomplete';
  try {
    return fromServer(await request(`/tasks/${id}/${verb}`, { method: 'PUT', headers: headers() }));
  } catch (_) {
    return null;
  }
}

export async function apiDeleteTask(id) {
  if (!_token || !(await ensureOnline())) return false;
  try {
    await request(`/tasks/${id}`, { method: 'DELETE', headers: headers() });
    return true;
  } catch (_) {
    return false;
  }
}

// ============================================================
// "IA temporária" — decomposição client-side (Aha Moment)
// Até a IA ser plugada no backend (/tasks/smart), o app gera as
// sugestões aqui. Quando a IA entrar, troca-se por uma chamada
// a /tasks/smart e remove-se esta heurística.
// ============================================================
export function decomposeTask(text) {
  const lower = text.toLowerCase();
  const due = extractDue(text);
  const category = guessCategory(lower);
  const title = capitalize(text.trim());

  let subtasks = [];
  let suggestion = null;

  if (/(festa|anivers[aá]rio|comemora)/.test(lower)) {
    subtasks = ['Encomendar o bolo', 'Comprar o presente', 'Mandar os convites'];
    suggestion = {
      text: 'Identifiquei uma festa. Quer que eu crie um lembrete 1 dia antes para conferir tudo?',
      action: { title: 'Conferir preparativos da festa', category, due: 'Véspera' },
    };
  } else if (/(vacina|consulta|pediatra|m[eé]dic|dentista|exame)/.test(lower)) {
    subtasks = ['Confirmar horário', 'Levar carteirinha/documentos'];
    suggestion = {
      text: 'Identifiquei uma consulta. Deseja um lembrete no dia anterior para comprar o antitérmico?',
      action: { title: 'Comprar antitérmico', category: 'saude', due: 'Véspera' },
    };
  } else if (/(comprar|mercado|presente|encomendar)/.test(lower)) {
    subtasks = ['Fazer a lista', 'Definir orçamento'];
    suggestion = {
      text: 'Quer que eu te lembre de levar as sacolas reutilizáveis?',
      action: { title: 'Levar sacolas reutilizáveis', category, due: due || 'Hoje' },
    };
  } else if (/(reuni[aã]o|trabalho|projeto|apresenta)/.test(lower)) {
    subtasks = ['Preparar pauta', 'Revisar materiais'];
    suggestion = {
      text: 'Quer um lembrete 30 min antes para se organizar?',
      action: { title: 'Preparar para a reunião', category: 'trabalho', due: due || 'Hoje' },
    };
  } else if (/(pagar|conta|boleto|fatura|imposto)/.test(lower)) {
    subtasks = ['Verificar valor', 'Agendar pagamento'];
    suggestion = {
      text: 'Quer ativar um lembrete recorrente todo mês para essa conta?',
      action: { title: 'Lembrete mensal da conta', category: 'financas', due: 'Mensal' },
    };
  }

  // Converte os rótulos da heurística em data estruturada — é isso que faz a
  // tarefa aparecer no calendário mesmo quando o app está offline.
  const today = todayKey();
  const structure = (label) => ({
    dueDate: resolveDue(label, today),
    dueTime: resolveTime(label),
  });
  if (suggestion && suggestion.action) {
    const a = suggestion.action;
    // "Véspera" é relativa à data da tarefa-mãe, não a hoje.
    const base = a.due === 'Véspera' ? resolveDue(due, today) : null;
    suggestion.action = {
      ...a,
      ...(base
        ? { dueDate: addDaysKey(base, -1), dueTime: null }
        : structure(a.due)),
    };
  }

  return { title, category, due, ...structure(due), subtasks, suggestion };
}

function extractDue(text) {
  const t = text.toLowerCase();
  const time = text.match(/(\d{1,2})[:h](\d{0,2})/);
  const timeStr = time ? `${time[1].padStart(2, '0')}:${(time[2] || '00').padStart(2, '0')}` : '';

  let day = '';
  if (/depois de amanh[aã]/.test(t)) day = 'Depois de amanhã';
  else if (/amanh[aã]/.test(t)) day = 'Amanhã';
  else if (/hoje/.test(t)) day = 'Hoje';
  else {
    const dm = text.match(/dia\s+(\d{1,2})/i);
    if (dm) day = `Dia ${dm[1]}`;
  }
  return [day, timeStr].filter(Boolean).join(' • ');
}

function guessCategory(t) {
  if (/(vacina|consulta|pediatra|m[eé]dic|dentista|exame|sa[uú]de|rem[eé]dio)/.test(t)) return 'saude';
  if (/(leo|filh|crian[cç]a|escola|beb[eê]|fralda)/.test(t)) return 'filhos';
  if (/(reuni[aã]o|trabalho|projeto|cliente|chefe|apresenta)/.test(t)) return 'trabalho';
  if (/(pagar|conta|boleto|fatura|imposto|banco|dinheiro)/.test(t)) return 'financas';
  if (/(parceir|marido|esposa|jantar a dois|namoro)/.test(t)) return 'relacionamento';
  return 'casa';
}

function capitalize(s) {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}
