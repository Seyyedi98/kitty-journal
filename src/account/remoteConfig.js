// Remote settings from the server (GET /apps/{appId}/config): announcement now, minimum version and flags next.
// Pure logic over an injected `db` and `api`, so it runs unchanged in Node tests. Nothing here may ever block the app:
// every failure falls back to the last saved copy, and to "nothing" when there is none.
import { loadSettings, saveSetting } from '../db/repository';

export const CONFIG_KEY = 'remoteConfig';
export const DISMISSED_KEY = 'announcementDismissed';
export const MAX_ANNOUNCEMENT_CHARS = 600;
const LANGS = ['en', 'tr', 'fa'];

const isObj = (x) => x && typeof x === 'object' && !Array.isArray(x);

/** Keep only what we understand from a server answer. Never throws. @returns {{minVersion:string, flags:object, announcement:null|{id:string,text:object}}|null} */
export function cleanConfig(raw) {
  if (!isObj(raw)) return null;
  const flags = {};
  if (isObj(raw.flags)) for (const [k, v] of Object.entries(raw.flags)) if (/^[a-z0-9_]{1,64}$/.test(k)) flags[k] = v === true;
  let announcement = null;
  const a = raw.announcement;
  if (isObj(a) && typeof a.id === 'string' && a.id && a.id.length <= 100 && isObj(a.text)) {
    const text = {};
    for (const l of LANGS) if (typeof a.text[l] === 'string' && a.text[l].trim()) text[l] = a.text[l].trim().slice(0, MAX_ANNOUNCEMENT_CHARS);
    if (text.en || Object.keys(text).length) announcement = { id: a.id, text };
  }
  return { minVersion: typeof raw.min_version === 'string' ? raw.min_version : '0.0.0', flags, announcement };
}

/** The text in the user's language, else English, else any other language the owner wrote. Plain text only. */
export function announcementText(announcement, language) {
  if (!announcement || !announcement.text) return '';
  const t = announcement.text;
  return t[language] || t.en || t.fa || t.tr || '';
}

/** What to show now: null when there is no announcement, or this id was already closed. */
export function pendingAnnouncement(config, dismissedId, language) {
  const a = config && config.announcement;
  if (!a || a.id === dismissedId) return null;
  const text = announcementText(a, language);
  return text ? { id: a.id, text } : null;
}

export async function loadSaved(db) {
  const s = await loadSettings(db);
  return { config: cleanConfig(s[CONFIG_KEY]), dismissed: typeof s[DISMISSED_KEY] === 'string' ? s[DISMISSED_KEY] : null };
}

/** Ask the server; on success save and return the answer, otherwise return `fallback` (the saved copy). Never throws. */
export async function refreshConfig(db, api, fallback = null) {
  try {
    const cfg = cleanConfig(await api.config());
    if (!cfg) return fallback;
    await saveSetting(db, CONFIG_KEY, cfg).catch(() => {});
    return cfg;
  } catch {
    return fallback;
  }
}

/** Remember the id (not just "closed"), so a new message with a new id shows again. */
export async function dismissAnnouncement(db, id) {
  await saveSetting(db, DISMISSED_KEY, id);
}
