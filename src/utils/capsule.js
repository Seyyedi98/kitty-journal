// Time capsule helpers. Pure — no DB, no React.
// A capsule is an entry whose `unlock_at` (ISO instant) is still in the future. Until then the app must show only its
// title, a lock and the unlock date. The database keeps the real content (backups need it), so screens get a MASKED
// copy of the entry from maskLocked().

export function isLocked(entry, now = Date.now()) {
  if (!entry || !entry.unlock_at) return false;
  const t = new Date(entry.unlock_at).getTime();
  return Number.isFinite(t) && t > now;
}

/** Same entry with everything but title/date/id hidden, flagged `locked: true`. Normal entries pass through untouched. */
export function maskLocked(entry, now = Date.now()) {
  if (!isLocked(entry, now)) return entry;
  return {
    ...entry,
    locked: true,
    body: '',
    body_html: null,
    mood: null,
    tags: [],
    emotions: [],
    location: null,
    attachmentCount: 0,
    favorite: 0,
  };
}

export const maskLockedList = (list, now = Date.now()) => (list || []).map((e) => maskLocked(e, now));

/** Smallest date a capsule may be sealed until: tomorrow at the same time. */
export function minUnlockDate(now = Date.now()) {
  return new Date(now + 24 * 3600 * 1000);
}

/** Milliseconds until the next capsule opens (for a re-render timer), or null when none is sealed. */
export function nextUnlockDelay(entries, now = Date.now()) {
  let best = null;
  for (const e of entries || []) {
    if (!e || !e.unlock_at) continue;
    const d = new Date(e.unlock_at).getTime() - now;
    if (Number.isFinite(d) && d > 0 && (best === null || d < best)) best = d;
  }
  return best;
}
