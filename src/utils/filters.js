import { matchesQuery, tagKey } from './text';

// Pure filter logic (kept free of React so it can be unit-tested in Node).
// notebookId: null = every notebook, 0 = the default notebook, otherwise a notebook id.
export const EMPTY_FILTERS = { favorites: false, mood: null, tagId: null, notebookId: null, capsule: false };

export function hasActiveFilters(f) {
  return Boolean(f.favorites || f.capsule || f.mood || f.tagId || f.notebookId != null);
}

/** Filters combine with AND. */
export function applyFilters(entries, f) {
  if (!hasActiveFilters(f)) return entries;
  return entries.filter((e) => {
    if (f.favorites && !e.favorite) return false;
    if (f.capsule && !e.unlock_at) return false; // sealed or already opened time capsules
    if (f.mood && e.mood !== f.mood) return false;
    if (f.notebookId != null && (e.notebook_id != null ? e.notebook_id : 0) !== f.notebookId) return false;
    if (f.tagId && !(e.tags || []).some((x) => x.id === f.tagId)) return false;
    return true;
  });
}

export const TOP_TAGS = 5;

/** The most used tags (at most `limit`), busiest first; ties by name. */
export function topTags(tags, limit = TOP_TAGS, selectedId = null) {
  const used = tags.filter((x) => x.count > 0).sort((a, b) => b.count - a.count || String(a.name).localeCompare(String(b.name)));
  const top = used.slice(0, limit);
  const chosen = selectedId != null ? used.find((x) => x.id === selectedId) : null;
  if (chosen && !top.includes(chosen)) top.push(chosen);
  return top;
}

/**
 * Search text. Words starting with # match tags ("#vacation" finds every entry tagged
 * vacation; partial tag names work too); everything else is matched against title, body,
 * tags and place as before. All parts must match.
 */
export function matchesSearch(entry, query) {
  const words = String(query || '').trim().split(/\s+/).filter((w) => w && w !== '#'); // a lone # (still typing) matches everything
  if (!words.length) return true;
  const tagWords = words.filter((w) => w.startsWith('#') && w.length > 1).map((w) => tagKey(w.slice(1)));
  const textWords = words.filter((w) => !(w.startsWith('#') && w.length > 1)).join(' ');
  const keys = (entry.tags || []).map((x) => tagKey(x.name));
  if (!tagWords.every((k) => keys.some((tk) => tk.includes(k)))) return false;
  if (!textWords.trim()) return true;
  const hay = `${entry.title || ''} ${entry.body || ''} ${(entry.tags || []).map((x) => x.name).join(' ')} ${entry.location?.name || ''} ${entry.location?.address || ''}`;
  return matchesQuery(hay, textWords);
}
