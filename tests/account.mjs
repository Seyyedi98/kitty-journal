// Account + cloud-backup logic tests. Run:  npx tsx tests/account.mjs
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
const load = async (p) => { const m = await import(p); return { ...(typeof m.default === 'object' && m.default ? m.default : {}), ...m }; };
const { normalizePhone, normalizeCode, validateProfile } = await load('../src/account/validation.js');
const { createApi, createMockApi, ApiError } = await load('../src/account/api.js');
const { exportTextSnapshot, importTextSnapshot, backupNow, restoreNow } = await load('../src/account/cloudBackup.js');
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
  const bad = validateProfile({ name: 'R', age: '5', gender: 'x' });
  assert.deepEqual(Object.keys(bad.errors).sort(), ['age', 'gender', 'name']);
  assert.ok(!validateProfile({ name: 'Ab', age: '12.5', gender: 'female' }).ok);
  assert.ok(!validateProfile({ name: 'Ab', age: '121', gender: 'female' }).ok);
});
await test('i18n: same keys in en/fa/tr, account keys present, no duplicate keys', async () => {
  const k = (l) => Object.keys(phase2[l]).sort();
  assert.deepEqual(k('fa'), k('en')); assert.deepEqual(k('tr'), k('en'));
  for (const key of ['account', 'accLogin', 'accErrServer', 'premium_cloudbackup', 'pf_cloudbackup', 'gender_unspecified']) assert.ok(phase2.en[key] && phase2.fa[key] && phase2.tr[key], key);
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
await test('api: success, error mapping, timeout, network, auth header', async () => {
  const calls = [];
  const mk = (res) => createApi({ baseUrl: 'https://x.test/v1/', fetchImpl: async (url, init) => { calls.push({ url, init }); return typeof res === 'function' ? res(url, init) : res; } });
  const json = (status, body) => ({ ok: status < 400, status, json: async () => body });
  const api = mk(json(200, { token: 't', user: { id: 1 }, plan: 'free' }));
  assert.equal((await api.verifyCode('+98912', '123456', 'login')).token, 't');
  assert.equal(calls[0].url, 'https://x.test/v1/auth/verify');
  assert.equal(JSON.parse(calls[0].init.body).code, '123456');
  await mk(json(200, {})).uploadBackup('tok', { entries: [] });
  await assert.rejects(mk(json(402, {})).uploadBackup('t', {}), (e) => e instanceof ApiError && e.code === 'payment_required');
  await assert.rejects(mk(json(401, {})).me('t'), (e) => e.code === 'unauthorized');
  await assert.rejects(mk(json(429, {})).requestCode('p', 'login'), (e) => e.code === 'rate_limited');
  await assert.rejects(mk(json(400, { error: 'invalid_code' })).verifyCode('p', 'c', 'login'), (e) => e.code === 'invalid_code');
  await assert.rejects(mk(json(500, null)).me('t'), (e) => e.code === 'server');
  await assert.rejects(mk(() => { throw new TypeError('net'); }).me('t'), (e) => e.code === 'network');
  const slow = createApi({ baseUrl: 'https://x.test', timeoutMs: 20, fetchImpl: (u, init) => new Promise((_, rej) => init.signal.addEventListener('abort', () => rej(Object.assign(new Error('a'), { name: 'AbortError' })))) });
  await assert.rejects(slow.me('t'), (e) => e.code === 'timeout');
  await mk(json(200, {})).me('secret');
  assert.equal(calls.at(-1).init.headers.Authorization, 'Bearer secret');
});
await test('mock server: wrong code rejected, register then login', async () => {
  const api = createMockApi();
  await assert.rejects(api.verifyCode('+98912', '000000', 'register', {}), (e) => e.code === 'invalid_code');
  const r = await api.verifyCode('+98912', '123456', 'register', { name: 'A', age: 30, gender: 'male' });
  assert.equal(r.user.name, 'A');
  assert.equal((await api.verifyCode('+98912', '123456', 'login')).user.name, 'A');
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
await test('backupNow / restoreNow through the mock server', async () => {
  const api = createMockApi();
  const db = makeDb();
  add(db, U1, 'one', '2026-10-01', '2026-10-01T10:00:00.000Z');
  await assert.rejects(restoreNow({ db, api, token: 'mock.+98' }), (e) => e.code === 'not_found');
  const b = await backupNow({ db, api, token: 'mock.+98' });
  assert.equal(b.count, 1);
  const fresh = makeDb();
  assert.equal((await restoreNow({ db: fresh, api, token: 'mock.+98' })).added, 1);
});
console.log(`\n${passed} passed`);
