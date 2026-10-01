/* ============================================================
   Linha do tempo: blocos de horário, conflitos e layout do dia.
   Funções puras (sem DOM), usadas pela Agenda e pela Home.
   ============================================================ */

/** Duração assumida quando a tarefa tem início mas não fim. */
export const DURACAO_PADRAO = 30;

/** "HH:MM" → minutos desde 00:00 (ou null). */
export function toMinutes(hhmm) {
  const m = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(hhmm || '');
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
}

export function fromMinutes(total) {
  if (total == null || total < 0 || total >= 24 * 60) return null;
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

/** Fim só vale com início e depois dele, no mesmo dia (espelha timerange.clean_end_time). */
export function cleanEndTime(start, end) {
  const a = toMinutes(start); const b = toMinutes(end);
  return a === null || b === null || b <= a ? null : end;
}

/** [início, fim) em minutos; sem fim, 30 min (limitado à meia-noite). Sem início → null. */
export function intervalOf(task) {
  const ini = toMinutes(task && task.dueTime);
  if (ini === null) return null;
  const fim = toMinutes(cleanEndTime(task.dueTime, task.endTime));
  return [ini, fim ?? Math.min(ini + DURACAO_PADRAO, 24 * 60)];
}

/** "10:00–11:30", "10:00" (sem fim) ou "". */
export function rangeLabel(task) {
  if (!task || !task.dueTime) return '';
  const fim = cleanEndTime(task.dueTime, task.endTime);
  return fim ? `${task.dueTime}–${fim}` : task.dueTime;
}

/**
 * Ids das tarefas em conflito de horário: mesmo dia, em aberto, com início, e
 * intervalos que se sobrepõem. Encostar (10–11 e 11–12) não é conflito.
 */
export function conflictIds(tasks) {
  const porDia = new Map();
  for (const t of tasks || []) {
    if (t.done || !t.dueDate) continue;
    const iv = intervalOf(t);
    if (!iv) continue;
    if (!porDia.has(t.dueDate)) porDia.set(t.dueDate, []);
    porDia.get(t.dueDate).push([t.id, iv]);
  }
  const out = new Set();
  for (const lista of porDia.values()) {
    lista.sort((a, b) => a[1][0] - b[1][0]);
    for (let i = 0; i < lista.length; i++) {
      for (let j = i + 1; j < lista.length && lista[j][1][0] < lista[i][1][1]; j++) {
        out.add(lista[i][0]); out.add(lista[j][0]);
      }
    }
  }
  return out;
}

/**
 * Layout de um dia na linha do tempo: tarefas com horário viram blocos; as que se
 * sobrepõem dividem a largura em colunas. Devolve [{ task, start, end, col, cols }].
 */
export function layoutDay(tasks) {
  const blocos = (tasks || [])
    .map((task) => ({ task, iv: intervalOf(task) }))
    .filter((b) => b.iv)
    .sort((a, b) => a.iv[0] - b.iv[0] || a.iv[1] - b.iv[1]);

  const out = [];
  let grupo = []; let fimGrupo = -1;
  const fechar = () => {
    const colunas = [];   // fim do último bloco de cada coluna
    for (const b of grupo) {
      let c = colunas.findIndex((fim) => fim <= b.iv[0]);
      if (c < 0) { c = colunas.length; colunas.push(0); }
      colunas[c] = b.iv[1];
      b.col = c;
    }
    for (const b of grupo) out.push({ task: b.task, start: b.iv[0], end: b.iv[1], col: b.col, cols: colunas.length });
    grupo = []; fimGrupo = -1;
  };
  for (const b of blocos) {
    if (grupo.length && b.iv[0] >= fimGrupo) fechar();
    grupo.push(b);
    fimGrupo = Math.max(fimGrupo, b.iv[1]);
  }
  if (grupo.length) fechar();
  return out;
}

/** Faixa de horas a desenhar: 07–20 por padrão, ampliada para caber tudo. */
export function hourRange(layout) {
  let ini = 7; let fim = 20;
  for (const b of layout) {
    ini = Math.min(ini, Math.floor(b.start / 60));
    fim = Math.max(fim, Math.ceil(b.end / 60));
  }
  return [ini, Math.min(fim, 24)];
}
