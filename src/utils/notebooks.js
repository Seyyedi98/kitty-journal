// Notebook helpers. Pure. A notebook is { id, uuid, name, color, count }. Entries point to one with entry.notebook_id;
// NULL means the default notebook, which is not a stored row. In filters the default notebook is id 0.
export const DEFAULT_NOTEBOOK_ID = 0;
export const MAX_NOTEBOOKS = 20;
export const NOTEBOOK_COLORS = [
  { key: 'sage', hex: '#7FA487' }, { key: 'sky', hex: '#6FA3C7' }, { key: 'rose', hex: '#D98A9B' }, { key: 'sand', hex: '#C9A15B' },
  { key: 'lilac', hex: '#9C8BC7' }, { key: 'coral', hex: '#E07F5F' }, { key: 'teal', hex: '#4FA6A0' }, { key: 'slate', hex: '#7D8794' },
];
export const colorHex = (key) => (NOTEBOOK_COLORS.find((x) => x.key === key) || NOTEBOOK_COLORS[0]).hex;
export const cleanNotebookName = (s) => String(s ?? '').replace(/\s+/g, ' ').trim().slice(0, 40);
export const notebookKey = (s) => cleanNotebookName(s).toLocaleLowerCase();
/** The notebook id an entry belongs to for filtering (default = 0). */
export const entryNotebook = (e) => (e && e.notebook_id != null ? e.notebook_id : DEFAULT_NOTEBOOK_ID);
