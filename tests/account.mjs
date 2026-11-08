// Account + cloud-backup logic tests. Run:  npx tsx tests/account.mjs
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
const load = async (p) => { const m = await import(p); return { ...(typeof m.default === 'object' && m.default ? m.default : {}), ...m }; };
const { normalizePhone, normalizeCode, validateProfile, profileFromMe } = await load('../src/account/validation.js');
const { createApi, createMockApi, ApiError } = await load('../src/account/api.js');
const { createAuthed } = await load('../src/account/authed.js');
const { formatAmount, normalizePlans, normalizeQuote, pickTitle, currencyKey, safePaymentUrl, purchaseOutcome, paymentIdFromLink } = await load('../src/account/purchase.js');
const { errText } = await load('../src/account/errors.js');
const { daysLeft, premiumActive } = await load('../src/account/plan.js');
const { exportTextSnapshot, importTextSnapshot, backupNow, restoreNow, wrapForServer, unwrapFromServer, stripBinary, BACKUP_FORMAT, backupLimitOf } = await load('../src/account/cloudBackup.js');
const { phase2 } = await load('../src/i18n/phase2.js');
const { fmt } = await load('../src/i18n/index.js').catch(() => ({ fmt: null }));

let passed = 0;
const test = async (name, fn) => { try { await fn(); passed++; console.log('  ok  ', name); } catch (e) { console.log('  FAIL', name, '\n      ', e.message); process.exitCode = 1; } };

await test('phone normalisation', () => {
  assert.equal(normalizePhone('09123456789'), '+989123456789');
  assert.equal(normalizePhone('۰۹۱۲ ۳۴۵ ۶۷۸۹'), '+989123456789');
  assert.equal(normalizePhone('9123456789'), '+989123456789');
  assert.equal(normalizePhone('+98 912-345-6789'), '+989123456789');
  assert.equal(normalizePhone('00989123456789'), '+989123456789');
  assert.equal(normalizePhone('+90 532 123 45 67'), '+905321234567');
  assert.equal(normalizePhone('12345'), null);
  assert.equal(normalizePhone('abc'), null);
  assert.equal(normalizePhone(''), null);
  assert.equal(normalizeCode('۱۲۳-۴۵۶'), '123456');
});
await test('profile validation', () => {
  assert.ok(validateProfile({ name: '  Ramtin  ', age: '۳۲', gender: 'male' }).ok);
  assert.equal(validateProfile({ name: 'Ramtin', age: '32', gender: 'male' }).value.age, 32);
  assert.ok(!validateProfile({ name: 'R', age: '40', gender: 'prefer_not_to_say' }).ok); // only the genders in GENDERS (female, male)
  assert.ok(validateProfile({ name: 'R', age: '12', gender: 'female' }).ok);
  assert.ok(!validateProfile({ name: 'R', age: '11', gender: 'female' }).ok);
  const bad = validateProfile({ name: ' ', age: '5', gender: 'x' });
  assert.deepEqual(Object.keys(bad.errors).sort(), ['age', 'gender', 'name']);
  assert.ok(!validateProfile({ name: 'Ab', age: '12.5', gender: 'female' }).ok);
  assert.ok(!validateProfile({ name: 'Ab', age: '101', gender: 'female' }).ok);
});
await test('profileFromMe: reads a valid profile (flat or nested), otherwise null', () => {
  assert.deepEqual(profileFromMe({ name: 'Ramtin', age: 32, gender: 'male', plan: 'free' }), { name: 'Ramtin', age: 32, gender: 'male' });
  assert.deepEqual(profileFromMe({ profile: { name: 'Ab', age: '20', gender: 'female' } }), { name: 'Ab', age: 20, gender: 'female' });
  assert.equal(profileFromMe({ user_id: 'u', phone: '+98***', plan: 'free', premium: false }), null);
  assert.equal(profileFromMe(null), null);
  assert.deepEqual(profileFromMe({ profile: { name: 'Sara', gender: 'female', age: 28, birth_year: 1998 } }), { name: 'Sara', age: 28, gender: 'female' });
  assert.equal(profileFromMe({ profile: { name: 'Sam', gender: 'other', age: 28 } }), null); // old value: asks for details again
  assert.equal(profileFromMe({ profile: {} }), null);
});
await test('i18n: same keys in en/fa/tr, account keys present, no duplicate keys', async () => {
  const k = (l) => Object.keys(phase2[l]).sort();
  assert.deepEqual(k('fa'), k('en')); assert.deepEqual(k('tr'), k('en'));
  for (const key of ['account', 'accLogin', 'accErrServer', 'premium_cloudbackup', 'pf_cloudbackup', 'gender_prefer_not_to_say']) assert.ok(phase2.en[key] && phase2.fa[key] && phase2.tr[key], key);
  const fs = await import('node:fs');
  const src = fs.readFileSync(new URL('../src/i18n/phase2.js', import.meta.url), 'utf8');
  for (const l of ['en', 'fa', 'tr']) {
    const block = src.split(`\n  ${l}: {`)[1].split('\n  },')[0];
    const keys = [...block.matchAll(/(?:^|[\s,{])([A-Za-z_][A-Za-z0-9_]*): /gm)].map((m) => m[1]);
    const seen = new Set(); const dup = keys.filter((x) => (seen.has(x) ? true : (seen.add(x), false)));
    // only keys we added must be unique; older blocks may legitimately repeat words inside strings
    assert.deepEqual(dup.filter((x) => x.startsWith('acc') || x.startsWith('gender_') || x === 'account'), [], l);
  }
});
await test('api: real routes, bodies, error mapping, timeout, auth header', async () => {
  const calls = [];
  const mk = (res) => createApi({ baseUrl: 'https://panjeh.ir/api/v1/', appId: 'kitty-journal', fetchImpl: async (url, init) => { calls.push({ url, init }); return typeof res === 'function' ? res(url, init) : res; } });
  const json = (status, body, headers = {}) => ({ ok: status < 400, status, headers: { get: (k) => headers[k.toLowerCase()] ?? null }, json: async () => { if (body === undefined) throw new Error('empty'); return body; } });
  const api = mk(json(202, { challenge_id: 'c1', expires_in: 300, resend_after: 60 }));
  assert.equal((await api.requestCode('+989123456789')).challenge_id, 'c1');
  assert.equal(calls[0].url, 'https://panjeh.ir/api/v1/auth/otp/request');
  assert.deepEqual(JSON.parse(calls[0].init.body), { phone: '+989123456789', app_id: 'kitty-journal' });
  await mk(json(200, { access_token: 'a', refresh_token: 'kjr_x', session_id: 's', user_id: 'u' })).verifyCode('c1', '123456', 'Android phone');
  assert.equal(calls.at(-1).url, 'https://panjeh.ir/api/v1/auth/otp/verify');
  assert.deepEqual(JSON.parse(calls.at(-1).init.body), { challenge_id: 'c1', code: '123456', device: 'Android phone' });
  await mk(json(200, {})).refresh('kjr_old');
  assert.equal(calls.at(-1).url, 'https://panjeh.ir/api/v1/auth/refresh');
  await mk(json(200, {})).entitlement('tok');
  assert.equal(calls.at(-1).url, 'https://panjeh.ir/api/v1/apps/kitty-journal/entitlement');
  assert.equal(calls.at(-1).init.headers.Authorization, 'Bearer tok');
  await mk(json(201, { id: 'b1' })).createBackup('tok', { label: 'L', backup: { version: 1 } });
  assert.equal(calls.at(-1).url, 'https://panjeh.ir/api/v1/apps/kitty-journal/backups');
  assert.deepEqual(JSON.parse(calls.at(-1).init.body), { label: 'L', backup: { version: 1 } });
  await mk(json(200, {})).updateProfile('tok', { name: 'Ramtin', age: 32, gender: 'male' });
  assert.equal(calls.at(-1).init.method, 'PATCH');
  assert.equal(calls.at(-1).url, 'https://panjeh.ir/api/v1/me');
  assert.deepEqual(JSON.parse(calls.at(-1).init.body), { name: 'Ramtin', gender: 'male', birth_year: new Date().getFullYear() - 32 });
  await mk(json(204, undefined)).logout('tok'); // empty body is fine
  await mk(json(200, {})).downloadBackup('tok', 'abc 1');
  assert.ok(calls.at(-1).url.endsWith('/backups/abc%201'));
  await assert.rejects(mk(json(402, {})).createBackup('t', {}), (e) => e.code === 'payment_required');
  await assert.rejects(mk(json(403, { error: { code: 'premium_required' } })).createBackup('t', {}), (e) => e.code === 'payment_required' && e.serverCode === 'premium_required');
  await assert.rejects(mk(json(401, { error: 'unauthorized' })).me('t'), (e) => e.code === 'unauthorized' && e.serverCode === 'unauthorized');
  await assert.rejects(mk(json(429, {}, { 'retry-after': '17' })).requestCode('p'), (e) => e.code === 'rate_limited' && e.retryAfter === 17);
  await assert.rejects(mk(json(400, { error: 'invalid_code' })).verifyCode('c', '000000'), (e) => e.code === 'invalid_code');
  await assert.rejects(mk(json(401, {})).verifyCode('c', '000000'), (e) => e.code === 'invalid_code'); // wrong code must not read as "session ended"
  await assert.rejects(mk(json(404, {})).downloadBackup('t', 'x'), (e) => e.code === 'not_found');
  await assert.rejects(mk(json(413, {})).createBackup('t', {}), (e) => e.code === 'too_large');
  await assert.rejects(mk(json(409, { error: { code: 'backup_limit', message: 'x' } })).createBackup('t', {}), (e) => e.code === 'limit_reached' && e.serverCode === 'backup_limit');
  await assert.rejects(mk(json(400, { error: { code: 'invalid_backup', message: 'Unexpected backup format' } })).createBackup('t', {}), (e) => e.serverCode === 'invalid_backup' && e.message === 'Unexpected backup format');
  await assert.rejects(mk(json(500, null)).me('t'), (e) => e.code === 'server');
  await assert.rejects(mk(() => { throw new TypeError('net'); }).me('t'), (e) => e.code === 'network');
  await assert.rejects(createApi({ baseUrl: 'http://panjeh.ir/api/v1', fetchImpl: async () => json(200, {}) }).me('t'), (e) => e.code === 'network'); // no plain http outside dev
  const slow = createApi({ baseUrl: 'https://x.test', timeoutMs: 20, fetchImpl: (u, init) => new Promise((_, rej) => init.signal.addEventListener('abort', () => rej(Object.assign(new Error('a'), { name: 'AbortError' })))) });
  await assert.rejects(slow.me('t'), (e) => e.code === 'timeout');
});
await test('mock server: wrong code rejected, backups list/create/download/delete', async () => {
  const api = createMockApi();
  const ch = await api.requestCode('+98912');
  await assert.rejects(api.verifyCode(ch.challenge_id, '000000'), (e) => e.code === 'invalid_code');
  const r = await api.verifyCode(ch.challenge_id, '123456');
  assert.ok(r.access_token && r.refresh_token.startsWith('kjr_'));
  const b = await api.createBackup(r.access_token, { label: 'x', backup: { version: 1, entries: [] } });
  assert.equal((await api.listBackups(r.access_token)).backups.length, 1);
  assert.deepEqual(await api.downloadBackup(r.access_token, b.id), { version: 1, entries: [] });
  await api.deleteBackup(r.access_token, b.id);
  assert.equal((await api.listBackups(r.access_token)).backups.length, 0);
});
await test('authed: refreshes once on 401 (shared), retries, ends login only on a definite refusal', async () => {
  const mkSession = () => ({ access: 'old', refresh: 'kjr_old' });
  let session = mkSession(); let ended = 0; let refreshCalls = 0;
  const base = { getSession: () => session, applyTokens: async (t) => { session = { ...session, ...t }; }, endSession: async () => { ended++; session = null; } };
  const api = { refresh: async (rt) => { refreshCalls++; await new Promise((r) => setTimeout(r, 10)); assert.equal(rt, 'kjr_old'); return { access_token: 'new', refresh_token: 'kjr_new' }; } };
  const authed = createAuthed({ ...base, api });
  const fn = async (tok) => { if (tok !== 'new') throw new ApiError('unauthorized'); return 'ok:' + tok; };
  const [a, b] = await Promise.all([authed(fn), authed(fn)]);
  assert.deepEqual([a, b], ['ok:new', 'ok:new']);
  assert.equal(refreshCalls, 1, 'two parallel calls share one refresh');
  assert.equal(session.refresh, 'kjr_new');
  assert.equal(await authed(async () => 'fine'), 'fine');
  // non-auth errors pass straight through, no refresh
  await assert.rejects(authed(async () => { throw new ApiError('payment_required'); }), (e) => e.code === 'payment_required');
  assert.equal(refreshCalls, 1);
  // offline during refresh keeps the login
  session = mkSession(); ended = 0;
  const offline = createAuthed({ ...base, api: { refresh: async () => { throw new ApiError('network'); } } });
  await assert.rejects(offline(async () => { throw new ApiError('unauthorized'); }), (e) => e.code === 'network');
  assert.equal(ended, 0); assert.ok(session);
  // refresh refused → signed out
  const refused = createAuthed({ ...base, api: { refresh: async () => { throw new ApiError('unauthorized', '', { status: 401 }); } } });
  await assert.rejects(refused(async () => { throw new ApiError('unauthorized'); }), (e) => e.code === 'unauthorized');
  assert.equal(ended, 1); assert.equal(session, null);
  await assert.rejects(authed(async () => 'x'), (e) => e.code === 'unauthorized'); // no session
});

function makeDb() {
  const raw = new DatabaseSync(':memory:');
  raw.exec(`CREATE TABLE entries (id INTEGER PRIMARY KEY AUTOINCREMENT, uuid TEXT NOT NULL UNIQUE, title TEXT NOT NULL DEFAULT '', body TEXT NOT NULL DEFAULT '', body_html TEXT, content_format_version INTEGER NOT NULL DEFAULT 1, journal_date TEXT NOT NULL, mood TEXT, favorite INTEGER NOT NULL DEFAULT 0, pinned INTEGER NOT NULL DEFAULT 0, deleted_at TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
  CREATE TABLE tags (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, name_key TEXT NOT NULL UNIQUE, created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
  CREATE TABLE entry_tags (entry_id INTEGER NOT NULL, tag_id INTEGER NOT NULL, PRIMARY KEY (entry_id, tag_id));`);
  return { raw,
    async getAllAsync(sql, ...p) { return raw.prepare(sql).all(...p).map((r) => ({ ...r })); },
    async getFirstAsync(sql, ...p) { const r = raw.prepare(sql).get(...p); return r ? { ...r } : null; },
    async runAsync(sql, ...p) { const r = raw.prepare(sql).run(...p); return { lastInsertRowId: Number(r.lastInsertRowid), changes: r.changes }; },
    async withTransactionAsync(fn) { raw.exec('BEGIN'); try { await fn(); raw.exec('COMMIT'); } catch (e) { raw.exec('ROLLBACK'); throw e; } },
  };
}
const U1 = 'a'.repeat(32), U2 = 'b'.repeat(32), U3 = 'c'.repeat(32);
const add = (db, uuid, title, date, upd, extra = '') => db.raw.exec(`INSERT INTO entries (uuid,title,body,journal_date,created_at,updated_at${extra ? ',deleted_at' : ''}) VALUES ('${uuid}','${title}','body ${title}','${date}','2026-10-01T10:00:00.000Z','${upd}'${extra ? `,'${extra}'` : ''})`);

await test('snapshot: text only, excludes trashed, includes tags', async () => {
  const db = makeDb();
  add(db, U1, 'one', '2026-10-01', '2026-10-01T10:00:00.000Z');
  add(db, U2, 'trashed', '2026-10-02', '2026-10-02T10:00:00.000Z', '2026-10-03T00:00:00.000Z');
  db.raw.exec("INSERT INTO tags (name,name_key,created_at,updated_at) VALUES ('Trip','trip','t','t'); INSERT INTO entry_tags VALUES (1,1)");
  const snap = await exportTextSnapshot(db);
  assert.equal(snap.entries.length, 1);
  assert.deepEqual(snap.entries[0].tags, ['Trip']);
  assert.deepEqual(Object.keys(snap.entries[0]).sort(), ['bodyHtml', 'body', 'createdAt', 'date', 'favorite', 'formatVersion', 'mood', 'pinned', 'tags', 'title', 'updatedAt', 'uuid'].sort());
});
await test('restore: adds missing, updates only when newer, never deletes, idempotent', async () => {
  const src = makeDb();
  add(src, U1, 'one', '2026-10-01', '2026-10-05T10:00:00.000Z');
  add(src, U2, 'two', '2026-10-02', '2026-10-02T10:00:00.000Z');
  src.raw.exec("INSERT INTO tags (name,name_key,created_at,updated_at) VALUES ('Trip','trip','t','t'); INSERT INTO entry_tags VALUES (1,1)");
  const snap = await exportTextSnapshot(src);
  const dst = makeDb();
  add(dst, U1, 'one-old', '2026-10-01', '2026-10-01T10:00:00.000Z'); // older → updated
  add(dst, U3, 'only-here', '2026-10-03', '2026-10-03T10:00:00.000Z'); // not in backup → kept
  const r = await importTextSnapshot(dst, snap);
  assert.deepEqual(r, { added: 1, updated: 1, skipped: 0 });
  assert.equal((await dst.getFirstAsync('SELECT title FROM entries WHERE uuid=?', U1)).title, 'one');
  assert.ok(await dst.getFirstAsync('SELECT 1 FROM entries WHERE uuid=?', U3));
  assert.equal((await dst.getAllAsync('SELECT * FROM entry_tags')).length, 1);
  assert.deepEqual(await importTextSnapshot(dst, snap), { added: 0, updated: 0, skipped: 2 });
  add(dst, 'd'.repeat(32), 'newer', '2026-10-04', '2026-12-01T00:00:00.000Z');
  const newer = { ...snap, entries: [{ ...snap.entries[0], uuid: 'd'.repeat(32), title: 'stale', updatedAt: '2026-10-01T00:00:00.000Z' }] };
  assert.equal((await importTextSnapshot(dst, newer)).skipped, 1);
  assert.equal((await dst.getFirstAsync('SELECT title FROM entries WHERE uuid=?', 'd'.repeat(32))).title, 'newer');
});
await test('restore: rejects bad snapshots, skips junk entries, is atomic', async () => {
  const db = makeDb();
  await assert.rejects(importTextSnapshot(db, null), /bad_snapshot/);
  await assert.rejects(importTextSnapshot(db, { version: 99, entries: [] }), /bad_snapshot/);
  const r = await importTextSnapshot(db, { version: 1, entries: [{ uuid: 'nope' }, null, { uuid: U1, date: '2026-10-01', createdAt: '2026-10-01T00:00:00Z', updatedAt: '2026-10-01T00:00:00Z', title: 'ok' }] });
  assert.deepEqual(r, { added: 1, updated: 0, skipped: 2 });
});
await test('server wrapper: exact format the server checks, text only, round trip', async () => {
  const sent = [];
  const api = { createBackup: async (tok, body) => { sent.push(body); return { id: 'b1', created_at: '2026-11-06T00:00:00Z' }; }, downloadBackup: async () => sent[0].backup };
  const authed = async (fn) => fn('tok');
  const db = makeDb();
  add(db, U1, 'one', '2026-10-01', '2026-10-01T10:00:00.000Z');
  db.raw.exec("UPDATE entries SET body_html='<p>hi</p><img src=\"data:image/png;base64,AAAA\"><p>x</p>' WHERE uuid='" + U1 + "'");
  await backupNow({ db, api, authed, label: 'L' });
  assert.deepEqual(Object.keys(sent[0]).sort(), ['backup', 'label']);
  const b = sent[0].backup;
  assert.equal(b.format, 'kitty-journal-json'); assert.equal(b.format, BACKUP_FORMAT);
  assert.equal(b.formatVersion, 1); assert.equal(b.includesAttachmentFiles, false);
  assert.equal(typeof b.data, 'object'); assert.equal(b.data.entries.length, 1);
  assert.deepEqual(Object.keys(b).sort(), ['data', 'format', 'formatVersion', 'includesAttachmentFiles']);
  assert.ok(!JSON.stringify(b).includes('base64'), 'no embedded binary');
  assert.equal(b.data.entries[0].bodyHtml, '<p>hi</p><p>x</p>');
  assert.ok(JSON.stringify(sent[0]).length < 2 * 1024 * 1024);
  const fresh = makeDb();
  assert.equal((await restoreNow({ db: fresh, api, authed, id: 'b1' })).added, 1);
  assert.equal(stripBinary('<p>a</p>data:image/png;base64,QQ=='), null);
  assert.equal(stripBinary(null), null);
  assert.deepEqual(unwrapFromServer({ version: 1, entries: [] }), { version: 1, entries: [] }); // old/unwrapped payloads still readable
});
await test('daysLeft: rounds up, never negative, null without end date', () => {
  const now = Date.parse('2026-11-06T12:00:00Z');
  assert.equal(daysLeft('2026-11-16T12:00:00Z', now), 10);
  assert.equal(daysLeft('2026-11-16T13:00:00Z', now), 11);
  assert.equal(daysLeft('2026-11-06T18:00:00Z', now), 1);
  assert.equal(daysLeft('2026-11-01T00:00:00Z', now), 0);
  assert.equal(daysLeft(null, now), null); assert.equal(daysLeft('nope', now), null);
});
await test('premiumActive: offline grace, end date, clock set back', () => {
  const H = 3600000, D = 24 * H;
  const t0 = Date.parse('2026-11-06T10:00:00Z');
  const base = { premium: true, expiresAt: '2026-12-06T00:00:00Z', checkedAt: t0, lastSeenAt: t0 };
  assert.equal(premiumActive(base, t0 + H), true, 'fresh check');
  assert.equal(premiumActive(base, t0 + 2 * D), true, 'inside 3 days offline');
  assert.equal(premiumActive(base, t0 + 3 * D + H), false, 'offline too long: paused until a check succeeds');
  assert.equal(premiumActive(base, t0 + 3 * D - H), true);
  assert.equal(premiumActive({ ...base, expiresAt: '2026-11-06T12:00:00Z' }, t0 + 3 * H), false, 'past the end date');
  assert.equal(premiumActive({ ...base, expiresAt: null }, t0 + H), true, 'no end date');
  assert.equal(premiumActive({ ...base, checkedAt: null }, t0 + H), false, 'never checked');
  assert.equal(premiumActive({ ...base, premium: false }, t0 + H), false);
  assert.equal(premiumActive({ ...base, premium: null }, t0 + H), false);
  assert.equal(premiumActive(base, t0 - D), false, 'clock set back before the last check');
  assert.equal(premiumActive({ ...base, lastSeenAt: t0 + 2 * D }, t0 + 1 * D), false, 'clock set back after the app had seen a later time');
  assert.equal(premiumActive(base, t0 - 60000), true, 'small clock drift is tolerated');
  assert.equal(premiumActive(base, t0 + 2 * D, 1), false, 'grace is configurable');
});
await test('backupLimitOf: number, object or unknown', () => {
  assert.equal(backupLimitOf(5), 5); assert.equal(backupLimitOf('10'), 10);
  assert.equal(backupLimitOf({ max_backups: 3, max_bytes: 1 }), 3);
  assert.equal(backupLimitOf({ count: 7 }), 7);
  assert.equal(backupLimitOf({ plan: 'free' }), null); assert.equal(backupLimitOf(null), null); assert.equal(backupLimitOf(0), null);
});
await test('backupNow / restoreNow through the mock server (with authed)', async () => {
  const api = createMockApi();
  const authed = async (fn) => fn('tok');
  const db = makeDb();
  add(db, U1, 'one', '2026-10-01', '2026-10-01T10:00:00.000Z');
  const b = await backupNow({ db, api, authed, label: 'L' });
  assert.equal(b.count, 1); assert.ok(b.id);
  const fresh = makeDb();
  assert.equal((await restoreNow({ db: fresh, api, authed, id: b.id })).added, 1);
  await assert.rejects(restoreNow({ db: fresh, api, authed, id: 'missing' }), (e) => e.code === 'not_found');
});
await test('purchase: amounts, plans, titles, discount quote, payment url, status, return link', () => {
  assert.equal(formatAmount(50000), '50,000');
  assert.equal(formatAmount(1299000, 'fa'), '۱٬۲۹۹٬۰۰۰');
  assert.equal(formatAmount(-5), '0');
  const raw = {
    currency: 'toman',
    plans: [
      { id: 'Zk3p9QwX1aB2', plan: 'premium', title: { en: 'Premium, 1 month', tr: 'Premium, 1 ay', fa: 'پریمیوم یک‌ماهه' }, price: 50000, currency: 'toman', duration_days: 30 },
      { id: 'Hs8dLm2VnC4e', plan: 'premium', title: { en: 'Lifetime' }, price: 900000, currency: 'toman', duration_days: null },
      { id: 'bad', price: 'abc' },
      { price: 5 },
    ],
  };
  const fa = normalizePlans(raw, 'fa');
  assert.deepEqual(fa.plans.map((p) => p.id), ['Zk3p9QwX1aB2', 'Hs8dLm2VnC4e']);
  assert.equal(fa.plans[0].title, 'پریمیوم یک‌ماهه');
  assert.equal(fa.plans[1].title, 'Lifetime', 'falls back to English');
  assert.equal(normalizePlans(raw, 'tr').plans[0].title, 'Premium, 1 ay');
  assert.equal(fa.plans[0].durationDays, 30); assert.equal(fa.plans[1].durationDays, null);
  assert.equal(fa.currency, 'toman'); assert.equal(currencyKey('toman'), 'cur_IRT'); assert.equal(currencyKey('rial'), 'cur_IRR');
  assert.equal(normalizePlans(null).plans.length, 0); assert.equal(normalizePlans({ plans: 'x' }).plans.length, 0);
  assert.equal(pickTitle('Plain'), 'Plain'); assert.equal(pickTitle(null), '');
  assert.deepEqual(normalizeQuote({ price: 50000, discount: 10000, amount: 40000, currency: 'toman' }), { price: 50000, amount: 40000, discount: 10000 });
  assert.deepEqual(normalizeQuote({ price: 50000, discount: 50000, amount: 0 }), { price: 50000, amount: 0, discount: 50000 });
  assert.equal(normalizeQuote({ price: 50000, amount: 60000 }), null, 'an amount above the price is not believed');
  assert.equal(normalizeQuote(null), null);
  assert.equal(safePaymentUrl('https://gateway.zibal.ir/start/4012345678'), 'https://gateway.zibal.ir/start/4012345678');
  assert.equal(safePaymentUrl('http://gateway.zibal.ir/start/1'), null);
  assert.equal(safePaymentUrl('javascript:alert(1)'), null);
  assert.equal(safePaymentUrl('nonsense'), null);
  assert.equal(purchaseOutcome('paid'), 'paid'); assert.equal(purchaseOutcome('failed'), 'failed'); assert.equal(purchaseOutcome('review'), 'review');
  assert.equal(purchaseOutcome('pending'), 'pending'); assert.equal(purchaseOutcome('whatever'), 'pending');
  assert.equal(paymentIdFromLink('kittyjournal://payment?status=paid&payment_id=Tq7vN2mXk9Rb'), 'Tq7vN2mXk9Rb');
  assert.equal(paymentIdFromLink('kittyjournal://payment?payment_id=Tq7vN2mXk9Rb&status=unknown'), 'Tq7vN2mXk9Rb');
  assert.equal(paymentIdFromLink('kittyjournal://payment?status=paid'), null);
  assert.equal(paymentIdFromLink('https://evil.example/payment?payment_id=Tq7vN2mXk9Rb'), null);
  assert.equal(paymentIdFromLink('kittyjournal://payment?payment_id=../../x'), null);
});

await test('purchase: routes match the server manual, errors read well, mock flow', async () => {
  const calls = [];
  const json = (status, body) => ({ ok: status < 400, status, headers: { get: () => null }, json: async () => body });
  const api = createApi({ baseUrl: 'https://panjeh.ir/api/v1', appId: 'kitty-journal', fetchImpl: async (url, init) => { calls.push({ url, init }); return json(200, {}); } });
  await api.plans();
  assert.equal(calls.at(-1).url, 'https://panjeh.ir/api/v1/apps/kitty-journal/plans'); assert.equal(calls.at(-1).init.method, 'GET');
  assert.equal(calls.at(-1).init.headers.Authorization, undefined, 'plans need no sign-in');
  await api.checkDiscount('tok', 'p1', 'welcome20');
  assert.equal(calls.at(-1).url, 'https://panjeh.ir/api/v1/apps/kitty-journal/discounts/check'); assert.equal(calls.at(-1).init.method, 'POST');
  assert.deepEqual(JSON.parse(calls.at(-1).init.body), { product_id: 'p1', code: 'welcome20' });
  assert.equal(calls.at(-1).init.headers.Authorization, 'Bearer tok');
  await api.startPurchase('tok', { product_id: 'p1', code: 'X' });
  assert.equal(calls.at(-1).url, 'https://panjeh.ir/api/v1/apps/kitty-journal/purchases');
  assert.deepEqual(JSON.parse(calls.at(-1).init.body), { product_id: 'p1', code: 'X' });
  await api.purchaseStatus('tok', 'Tq7vN2mXk9Rb');
  assert.equal(calls.at(-1).url, 'https://panjeh.ir/api/v1/apps/kitty-journal/purchases/Tq7vN2mXk9Rb');
  // the server's readable message for a bad code is kept, other server codes map to translated texts
  const err = (status, code, message) => createApi({ baseUrl: 'https://panjeh.ir/api/v1', fetchImpl: async () => json(status, { error: { code, message } }) });
  await assert.rejects(err(400, 'invalid_code', 'This code has expired').checkDiscount('t', 'p1', 'x'), (e) => e.serverCode === 'invalid_code' && e.message === 'This code has expired');
  const t = phase2.en;
  await assert.rejects(err(502, 'gateway_unavailable', 'x').startPurchase('t', {}), (e) => errText(t, e) === t.planErrGateway);
  await assert.rejects(err(502, 'gateway_refused', 'x').startPurchase('t', {}), (e) => errText(t, e) === t.planErrGateway);
  await assert.rejects(err(503, 'payments_unavailable', 'x').startPurchase('t', {}), (e) => errText(t, e) === t.planErrUnavailable);
  await assert.rejects(err(404, 'unknown_product', 'x').startPurchase('t', {}), (e) => errText(t, e) === t.planErrUnknown);
  const mock = createMockApi();
  const plans = normalizePlans(await mock.plans(), 'en');
  assert.equal(plans.plans.length, 3);
  assert.deepEqual(normalizeQuote(await mock.checkDiscount('t', 'p1', 'kitty20')), { price: 50000, amount: 40000, discount: 10000 });
  await assert.rejects(mock.checkDiscount('t', 'p1', 'NOPE'), (e) => e.serverCode === 'invalid_code');
  const o = await mock.startPurchase('t', { product_id: 'p1' });
  assert.ok(safePaymentUrl(o.pay_url));
  assert.equal((await mock.entitlement('t')).premium, false);
  assert.equal((await mock.purchaseStatus('t', o.payment_id)).status, 'pending');
  assert.equal((await mock.purchaseStatus('t', o.payment_id)).status, 'paid');
  assert.equal((await mock.entitlement('t')).premium, true);
  const free = await createMockApi().startPurchase('t', { product_id: 'p1', code: 'free' });
  assert.equal(free.status, 'paid'); assert.equal(free.amount, 0);
});

console.log(`\n${passed} passed`);
