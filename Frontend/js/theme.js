/* ============================================================
   Temas de cor
   As paletas completas vivem em css/styles.css (blocos
   `:root[data-theme="..."]`); aqui ficam só o id, o rótulo e as três
   cores da amostra mostrada no Perfil.
   O index.html aplica o tema salvo antes do primeiro render.
   ============================================================ */

const KEY = 'menteleve.theme';
export const DEFAULT_THEME = 'bordeaux';

// `swatch`: [fundo 60%, estrutura 30%, destaque 10%] — igual aos tokens do CSS.
export const THEMES = [
  { id: 'bordeaux', label: 'Bordeaux Pink', swatch: ['#fff0f3', '#590d22', '#d42a4c'] },
  { id: 'oceano',   label: 'Oceano',        swatch: ['#eef6fb', '#0b3a53', '#1c7cac'] },
  { id: 'floresta', label: 'Floresta',      swatch: ['#f0f7f1', '#1e4d2b', '#36844d'] },
  { id: 'grafite',  label: 'Grafite',       swatch: ['#f4f4f5', '#27272a', '#5e61f1'] },
  { id: 'lavanda',  label: 'Lavanda',       swatch: ['#f6f2fd', '#3b1f6b', '#8452f5'] },
];

export function isValidTheme(id) {
  return THEMES.some((t) => t.id === id);
}

export function getTheme() {
  try {
    const t = localStorage.getItem(KEY);
    return isValidTheme(t) ? t : DEFAULT_THEME;
  } catch {
    return DEFAULT_THEME;
  }
}

/** Aplica o tema no <html> e na barra do navegador (`theme-color`). */
export function applyTheme(id = getTheme()) {
  if (typeof document === 'undefined') return;
  const theme = THEMES.find((t) => t.id === id) || THEMES[0];
  const root = document.documentElement;
  if (theme.id === DEFAULT_THEME) root.removeAttribute('data-theme');
  else root.setAttribute('data-theme', theme.id);
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', theme.swatch[0]);
}

export function setTheme(id) {
  const next = isValidTheme(id) ? id : DEFAULT_THEME;
  try {
    if (next === DEFAULT_THEME) localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, next);
  } catch { /* storage bloqueado: o tema vale só nesta sessão */ }
  applyTheme(next);
  return next;
}

/** Lê uma cor do tema ativo (ex.: `themeColor('soft-300')`), para uso em JS/canvas. */
export function themeColor(token) {
  if (typeof document === 'undefined') return '';
  return getComputedStyle(document.documentElement).getPropertyValue(`--color-${token}`).trim();
}
