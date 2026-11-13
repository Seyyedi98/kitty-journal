// Cloud backup: everything the journal holds EXCEPT photo files — entries (text, formatting, mood, favourite/pinned, font,
// tags, secondary emotions, place, time-capsule date, notebook, trash state), notebooks, daily moods and the few
// appearance settings. Restore only ADDS or UPDATES (matched by uuid); it never deletes anything on the phone.
import { NOTEBOOK_COLORS, cleanNotebookName, notebookKey } from '../utils/notebooks';
import { cleanLocation } from '../db/repository';
export const SNAPSHOT_VERSION = 1; // newer fields are optional, so older backups still restore
// The server accepts only this wrapper: { format: 'kitty-journal-json', formatVersion, includesAttachmentFiles: false, data: {...} }.
export const BACKUP_FORMAT = 'kitty-journal-json';
export const wrapForServer = (data) => ({ format: BACKUP_FORMAT, formatVersion: 1, includesAttachmentFiles: false, data });
export const unwrapFromServer = (payload) => (payload && payload.format === BACKUP_FORMAT && payload.data ? payload.data : payload);
export const CLOUD_SETTINGS = ['language', 'calendarType', 'appearance', 'theme'];

// The server refuses embedded binary (data: images). Photos are not in the cloud backup, so images are dropped from the HTML.
export const stripBinary = (html) => {
  if (!html) return null;
  const out = String(html).replace(/<img\b[^>]*>/gi, '');
  return /data:[a-z]+\/[a-z0-9.+-]+;base64/i.test(out) ? null : out;
};

const group = (rows) => {
  const m = new Map();
  for (const r of rows) (m.get(r.entry_id) || m.set(r.entry_id, []).get(r.entry_id)).push(r);
  return m;
};

export async function exportTextSnapshot(db, now = new Date()) {
  const rows = await db.getAllAsync(
    `SELECT id, uuid, title, body, body_html, content_format_version, journal_date, mood, favorite, pinned, font,
            created_at, updated_at, deleted_at, unlock_at, notebook_id
       FROM entries ORDER BY journal_date, created_at`,
  );
  const tagRows = await db.getAllAsync('SELECT et.entry_id AS entry_id, t.name AS name FROM entry_tags et JOIN tags t ON t.id = et.tag_id');
  const emoRows = await db.getAllAsync('SELECT entry_id, emotion_key AS key, intensity FROM entry_emotions');
  const locRows = await db.getAllAsync('SELECT entry_id, latitude, longitude, name, address FROM locations');
  const nbRows = await db.getAllAsync('SELECT id, uuid, name, color, sort_order, created_at, updated_at FROM notebooks ORDER BY sort_order, id');
  const moods = await db.getAllAsync('SELECT journal_date, mood, updated_at FROM daily_moods ORDER BY journal_date');
  const settingRows = await db.getAllAsync('SELECT key, value FROM app_settings');
  const nbUuid = new Map(nbRows.map((n) => [n.id, n.uuid]));
  const tagsBy = group(tagRows);
  const emosBy = group(emoRows);
  const locBy = new Map(locRows.map((l) => [l.entry_id, l]));
  const settings = {};
  for (const r of settingRows) {
    if (!CLOUD_SETTINGS.includes(r.key)) continue;
    try { settings[r.key] = JSON.parse(r.value); } catch { /* skip corrupt */ }
  }
  return {
    version: SNAPSHOT_VERSION,
    createdAt: now.toISOString(),
    notebooks: nbRows.map(({ id, ...rest }) => rest),
    dailyMoods: moods,
    settings,
    entries: rows.map((r) => {
      const loc = locBy.get(r.id);
      return {
        uuid: r.uuid, title: r.title || '', body: r.body || '', bodyHtml: stripBinary(r.body_html),
        formatVersion: r.content_format_version || 1, date: r.journal_date, mood: r.mood || null,
        favorite: r.favorite ? 1 : 0, pinned: r.pinned ? 1 : 0, font: r.font || null,
        createdAt: r.created_at, updatedAt: r.updated_at, deletedAt: r.deleted_at || null, unlockAt: r.unlock_at || null,
        notebook: r.notebook_id != null ? nbUuid.get(r.notebook_id) || null : null,
        tags: (tagsBy.get(r.id) || []).map((x) => x.name),
        emotions: (emosBy.get(r.id) || []).map((x) => ({ key: x.key, intensity: x.intensity })),
        location: loc ? { latitude: loc.latitude, longitude: loc.longitude, name: loc.name, address: loc.address } : null,
      };
    }),
  };
}

const isIso = (s) => typeof s === 'string' && s.length >= 10 && !Number.isNaN(Date.parse(s));
const sane = (e) => e && typeof e.uuid === 'string' && /^[0-9a-f]{32}$/i.test(e.uuid) && typeof e.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(e.date) && isIso(e.createdAt) && isIso(e.updatedAt);
const iso = (v) => (isIso(v) ? new Date(v).toISOString() : null);
const fontOf = (v) => (typeof v === 'string' && /^[a-z0-9_]{1,32}$/.test(v) ? v : null);

async function writeExtras(db, id, e) {
  // Tags are only added; emotions and the place are replaced by the backup's version of this entry.
  for (const name of Array.isArray(e.tags) ? e.tags : []) {
    const clean = String(name).trim();
    if (!clean) continue;
    const key = clean.toLocaleLowerCase();
    const now = new Date().toISOString();
    await db.runAsync('INSERT OR IGNORE INTO tags (name,name_key,created_at,updated_at) VALUES (?,?,?,?)', clean, key, now, now);
    const tag = await db.getFirstAsync('SELECT id FROM tags WHERE name_key = ?', key);
    if (tag) await db.runAsync('INSERT OR IGNORE INTO entry_tags (entry_id,tag_id) VALUES (?,?)', id, tag.id);
  }
  if (Array.isArray(e.emotions)) {
    await db.runAsync('DELETE FROM entry_emotions WHERE entry_id = ?', id);
    const seen = new Set();
    for (const m of e.emotions) {
      if (!m || typeof m.key !== 'string' || !/^[a-z_]{1,32}$/.test(m.key) || seen.has(m.key)) continue;
      seen.add(m.key);
      const n = Number(m.intensity);
      await db.runAsync('INSERT INTO entry_emotions (entry_id, emotion_key, intensity) VALUES (?,?,?)', id, m.key, Number.isInteger(n) && n >= 1 && n <= 5 ? n : null);
    }
  }
  if (e.location !== undefined) {
    const loc = cleanLocation(e.location);
    await db.runAsync('DELETE FROM locations WHERE entry_id = ?', id);
    if (loc) {
      await db.runAsync(
        "INSERT INTO locations (uuid, entry_id, latitude, longitude, name, address, created_at) VALUES (lower(hex(randomblob(16))),?,?,?,?,?,?)",
        id, loc.latitude, loc.longitude, loc.name, loc.address, new Date().toISOString(),
      );
    }
  }
}

/** → { added, updated, skipped, moods } */
export async function importTextSnapshot(db, snapshot) {
  if (!snapshot || snapshot.version !== SNAPSHOT_VERSION || !Array.isArray(snapshot.entries)) throw new Error('bad_snapshot');
  let added = 0, updated = 0, skipped = 0, moodsAdded = 0;
  await db.withTransactionAsync(async () => {
    // Notebooks first (matched by uuid; a clashing name gets a numeric suffix), so entries can point to them.
    const nbIds = new Map();
    for (const n of Array.isArray(snapshot.notebooks) ? snapshot.notebooks : []) {
      if (!n || typeof n.uuid !== 'string' || !/^[0-9a-f]{32}$/i.test(n.uuid)) continue;
      const base = cleanNotebookName(n.name);
      if (!base) continue;
      const have = await db.getFirstAsync('SELECT id FROM notebooks WHERE uuid = ?', n.uuid);
      if (have) { nbIds.set(n.uuid, have.id); continue; }
      let name = base;
      for (let i = 2; await db.getFirstAsync('SELECT 1 AS x FROM notebooks WHERE name_key = ?', notebookKey(name)); i++) name = `${base} ${i}`.slice(0, 40);
      const now0 = new Date().toISOString();
      const r = await db.runAsync(
        'INSERT INTO notebooks (uuid,name,name_key,color,sort_order,created_at,updated_at) VALUES (?,?,?,?,?,?,?)',
        n.uuid, name, notebookKey(name), NOTEBOOK_COLORS.some((x) => x.key === n.color) ? n.color : 'sage',
        Number.isFinite(Number(n.sort_order)) ? Number(n.sort_order) : 0, isIso(n.created_at) ? n.created_at : now0, isIso(n.updated_at) ? n.updated_at : now0,
      );
      nbIds.set(n.uuid, r.lastInsertRowId);
    }

    for (const e of snapshot.entries) {
      if (!sane(e)) { skipped++; continue; }
      const nb = e.notebook ? nbIds.get(e.notebook) ?? null : null;
      const cur = await db.getFirstAsync('SELECT id, updated_at, deleted_at, unlock_at FROM entries WHERE uuid = ?', e.uuid);
      let id;
      if (!cur) {
        const r = await db.runAsync(
          `INSERT INTO entries (uuid,title,body,body_html,content_format_version,journal_date,mood,favorite,pinned,font,created_at,updated_at,deleted_at,unlock_at,notebook_id)
           VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
          e.uuid, String(e.title || ''), String(e.body || ''), e.bodyHtml || null, e.formatVersion || 1, e.date, e.mood || null,
          e.favorite ? 1 : 0, e.pinned ? 1 : 0, fontOf(e.font), e.createdAt, e.updatedAt, iso(e.deletedAt), iso(e.unlockAt), nb,
        );
        id = r.lastInsertRowId; added++;
      } else if (!cur.deleted_at && String(e.updatedAt) > String(cur.updated_at) && !(cur.unlock_at && String(cur.unlock_at) > new Date().toISOString())) {
        await db.runAsync(
          'UPDATE entries SET title=?, body=?, body_html=?, content_format_version=?, journal_date=?, mood=?, favorite=?, pinned=?, font=?, updated_at=?, notebook_id=? WHERE id=?',
          String(e.title || ''), String(e.body || ''), e.bodyHtml || null, e.formatVersion || 1, e.date, e.mood || null,
          e.favorite ? 1 : 0, e.pinned ? 1 : 0, fontOf(e.font), e.updatedAt, nb, cur.id,
        );
        id = cur.id; updated++;
      } else { skipped++; continue; }
      await writeExtras(db, id, e);
    }

    // Daily moods: add the days this phone has none for; never overwrite.
    for (const m of Array.isArray(snapshot.dailyMoods) ? snapshot.dailyMoods : []) {
      if (!m || !/^\d{4}-\d{2}-\d{2}$/.test(String(m.journal_date)) || typeof m.mood !== 'string' || !/^[a-z_]{1,20}$/.test(m.mood)) continue;
      const r = await db.runAsync('INSERT OR IGNORE INTO daily_moods (journal_date, mood, updated_at) VALUES (?,?,?)', m.journal_date, m.mood, iso(m.updated_at) || new Date().toISOString());
      if (r && r.changes) moodsAdded++;
    }
    // Settings: only fill in what this phone has not set yet.
    const sv = { language: ['en', 'fa', 'tr'], calendarType: ['default', 'solarHijri', 'gregorian'], appearance: ['light', 'dark', 'system'] };
    for (const key of CLOUD_SETTINGS) {
      const v = snapshot.settings && snapshot.settings[key];
      const ok = key === 'theme' ? typeof v === 'string' && /^[a-z]{2,20}$/.test(v) : sv[key] && sv[key].includes(v);
      if (!ok) continue;
      await db.runAsync('INSERT OR IGNORE INTO app_settings (key, value, updated_at) VALUES (?,?,?)', key, JSON.stringify(v), new Date().toISOString());
    }
  });
  return { added, updated, skipped, moods: moodsAdded };
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
