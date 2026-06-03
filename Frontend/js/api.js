/* ============================================================
   api.js — Cliente REST do backend (FastAPI) + heurística local
   - Cliente REST: login, tarefas, premium (auth via header X-User-Id)
   - decomposeTask(): "IA temporária" client-side que gera o Aha Moment
     enquanto a IA real não está plugada no backend (/tasks/smart).
   ============================================================ */

// Local: http://localhost:8000 | Produção: URL do Render.
export const API_BASE = 'http://localhost:8000';

let _userId = null;     // id do usuário (definido após login)
let _online = null;     // cache do status do backend (null = ainda não checado)

export function setAuthUserId(id) {
  _userId = id != null ? String(id) : null;
}

function headers(extra = {}) {
  const h = { 'Content-Type': 'application/json', ...extra };
  if (_userId) h['X-User-Id'] = _userId;
  return h;
}

async function request(path, options = {}) {
  const res = await fetch(`${API_BASE}${path}`, options);
  if (!res.ok) {
    const err = new Error(`HTTP ${res.status}`);
    err.status = res.status;
    throw err;
  }
  return res.status === 204 ? null : res.json();
}

/** Verifica (com cache) se o backend está no ar. */
export async function ensureOnline(forceRecheck = false) {
  if (_online !== null && !forceRecheck) return _online;
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 1500);
    const res = await fetch(`${API_BASE}/health`, { signal: ctrl.signal });
    clearTimeout(t);
    _online = res.ok;
  } catch (_) {
    _online = false;
  }
  return _online;
}

export const isOnline = () => _online === true;

// --------- Normalização backend <-> frontend ---------
// Backend Task: {id, user_id, title, category, due, done, important, created_at}
// Frontend Task: {id(string), title, category, due, done, important, createdAt}
function fromServer(t) {
  return {
    id: String(t.id),
    title: t.title,
    category: t.category,
    due: t.due || '',
    done: !!t.done,
    important: !!t.important,
    createdAt: t.created_at ? Date.parse(t.created_at) : Date.now(),
  };
}

// ----------------------- Auth -----------------------
/** Faz login/registro. Retorna o usuário do backend ou null se offline/erro. */
export async function apiLogin(email, name) {
  if (!(await ensureOnline(true))) return null;
  try {
    const user = await request('/auth/login', {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify({ email, name }),
    });
    setAuthUserId(user.id);
    return user;
  } catch (_) {
    return null;
  }
}

export async function apiSetPremium(isPremium) {
  if (!_userId || !(await ensureOnline())) return null;
  try {
    return await request(`/auth/me/premium?is_premium=${isPremium}`, {
      method: 'POST',
      headers: headers(),
    });
  } catch (_) {
    return null;
  }
}

// ----------------------- Tasks -----------------------
/** Lista as tarefas do usuário. Retorna array (front-format) ou null. */
export async function apiListTasks() {
  if (!_userId || !(await ensureOnline())) return null;
  try {
    const tasks = await request('/tasks', { headers: headers() });
    return tasks.map(fromServer);
  } catch (_) {
    return null;
  }
}

/** Cria uma tarefa. Retorna a tarefa persistida (front-format) ou null. */
export async function apiCreateTask({ title, category, due, important }) {
  if (!_userId || !(await ensureOnline())) return null;
  try {
    const t = await request('/tasks', {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify({ title, category, due: due || '', important: !!important }),
    });
    return fromServer(t);
  } catch (_) {
    return null;
  }
}

export async function apiSetDone(id, done) {
  if (!_userId || !(await ensureOnline())) return null;
  const verb = done ? 'complete' : 'uncomplete';
  try {
    return fromServer(await request(`/tasks/${id}/${verb}`, { method: 'PUT', headers: headers() }));
  } catch (_) {
    return null;
  }
}

export async function apiDeleteTask(id) {
  if (!_userId || !(await ensureOnline())) return false;
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

  return { title, category, due, subtasks, suggestion };
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
