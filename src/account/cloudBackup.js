// Text-only cloud backup: titles, text, dates, mood, favourite/pinned, tags. No photos, places or files.
// Restore only ADDS or UPDATES entries (matched by uuid); it never deletes anything on the phone.
export const SNAPSHOT_VERSION = 1;
// The server accepts only this wrapper: { format: 'kitty-journal-json', formatVersion, includesAttachmentFiles: false, data: {...} }.
export const BACKUP_FORMAT = 'kitty-journal-json';
export const wrapForServer = (data) => ({ format: BACKUP_FORMAT, formatVersion: 1, includesAttachmentFiles: false, data });
export const unwrapFromServer = (payload) => (payload && payload.format === BACKUP_FORMAT && payload.data ? payload.data : payload);

// The server refuses embedded binary (data: images). Backups are text only, so images are dropped from the HTML.
export const stripBinary = (html) => {
  if (!html) return null;
  const out = String(html).replace(/<img\b[^>]*>/gi, '');
  return /data:[a-z]+\/[a-z0-9.+-]+;base64/i.test(out) ? null : out;
};

export async function exportTextSnapshot(db, now = new Date()) {
  const rows = await db.getAllAsync(
    `SELECT id, uuid, title, body, body_html, content_format_version, journal_date, mood, favorite, pinned, created_at, updated_at
       FROM entries WHERE deleted_at IS NULL ORDER BY journal_date, created_at`,
  );
  const tagRows = await db.getAllAsync(
    'SELECT et.entry_id AS entry_id, t.name AS name FROM entry_tags et JOIN tags t ON t.id = et.tag_id',
  );
  const tagsBy = new Map();
  for (const r of tagRows) (tagsBy.get(r.entry_id) || tagsBy.set(r.entry_id, []).get(r.entry_id)).push(r.name);
  return {
    version: SNAPSHOT_VERSION,
    createdAt: now.toISOString(),
    entries: rows.map((r) => ({
      uuid: r.uuid, title: r.title || '', body: r.body || '', bodyHtml: stripBinary(r.body_html),
      formatVersion: r.content_format_version || 1, date: r.journal_date, mood: r.mood || null,
      favorite: r.favorite ? 1 : 0, pinned: r.pinned ? 1 : 0, createdAt: r.created_at, updatedAt: r.updated_at,
      tags: tagsBy.get(r.id) || [],
    })),
  };
}

const isIso = (s) => typeof s === 'string' && s.length >= 10;
const sane = (e) => e && typeof e.uuid === 'string' && /^[0-9a-f]{32}$/i.test(e.uuid) && typeof e.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(e.date) && isIso(e.createdAt) && isIso(e.updatedAt);

/** → { added, updated, skipped } */
export async function importTextSnapshot(db, snapshot) {
  if (!snapshot || snapshot.version !== SNAPSHOT_VERSION || !Array.isArray(snapshot.entries)) throw new Error('bad_snapshot');
  let added = 0, updated = 0, skipped = 0;
  await db.withTransactionAsync(async () => {
    for (const e of snapshot.entries) {
      if (!sane(e)) { skipped++; continue; }
      const cur = await db.getFirstAsync('SELECT id, updated_at, deleted_at FROM entries WHERE uuid = ?', e.uuid);
      let id;
      if (!cur) {
        const r = await db.runAsync(
          `INSERT INTO entries (uuid,title,body,body_html,content_format_version,journal_date,mood,favorite,pinned,created_at,updated_at)
           VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
          e.uuid, String(e.title || ''), String(e.body || ''), e.bodyHtml || null, e.formatVersion || 1, e.date, e.mood || null, e.favorite ? 1 : 0, e.pinned ? 1 : 0, e.createdAt, e.updatedAt,
        );
        id = r.lastInsertRowId; added++;
      } else if (!cur.deleted_at && String(e.updatedAt) > String(cur.updated_at)) {
        await db.runAsync(
          'UPDATE entries SET title=?, body=?, body_html=?, content_format_version=?, journal_date=?, mood=?, favorite=?, pinned=?, updated_at=? WHERE id=?',
          String(e.title || ''), String(e.body || ''), e.bodyHtml || null, e.formatVersion || 1, e.date, e.mood || null, e.favorite ? 1 : 0, e.pinned ? 1 : 0, e.updatedAt, cur.id,
        );
        id = cur.id; updated++;
      } else { skipped++; continue; }
      for (const name of Array.isArray(e.tags) ? e.tags : []) {
        const clean = String(name).trim();
        if (!clean) continue;
        const key = clean.toLocaleLowerCase();
        const now = new Date().toISOString();
        await db.runAsync('INSERT OR IGNORE INTO tags (name,name_key,created_at,updated_at) VALUES (?,?,?,?)', clean, key, now, now);
        const tag = await db.getFirstAsync('SELECT id FROM tags WHERE name_key = ?', key);
        if (tag) await db.runAsync('INSERT OR IGNORE INTO entry_tags (entry_id,tag_id) VALUES (?,?)', id, tag.id);
      }
    }
  });
  return { added, updated, skipped };
}

/** authed(fn) runs fn(accessToken) and refreshes the login once if the token has expired. */
export async function backupNow({ db, api, authed, label }) {
  const snapshot = await exportTextSnapshot(db);
  const res = await authed((token) => api.createBackup(token, { label, backup: wrapForServer(snapshot) }));
  return { count: snapshot.entries.length, at: (res && (res.created_at || res.createdAt)) || snapshot.createdAt, id: res && res.id };
}

export async function restoreNow({ db, api, authed, id }) {
  const payload = await authed((token) => api.downloadBackup(token, id));
  return importTextSnapshot(db, unwrapFromServer(payload));
}

/** The server's `limit` may be a number or an object; returns how many cloud backups are allowed, or null if unknown. */
export function backupLimitOf(limit) {
  const pick = (v) => (Number.isFinite(Number(v)) && Number(v) > 0 ? Number(v) : null);
  if (limit && typeof limit === 'object') {
    for (const k of ['max_backups', 'max_count', 'count', 'max', 'backups']) if (pick(limit[k]) != null) return pick(limit[k]);
    return null;
  }
  return pick(limit);
}
