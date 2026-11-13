// Logic tests (no device needed). Run:  npx tsx tests/run.mjs
// Uses Node's built-in node:sqlite behind a tiny adapter that mimics expo-sqlite.
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
// tsx treats extensionless-package .js files as CommonJS, so named imports
// can be hidden behind `default`. load() merges both shapes.
const load = async (p) => {
  const m = await import(p);
  return { ...(typeof m.default === 'object' && m.default ? m.default : {}), ...m };
};
const { translations } = await load('../src/i18n/index.js');
const { groupPlaces, distanceMeters } = await load('../src/utils/mapPlaces.js');
const { foldText, matchesQuery, countWords, tagKey, cleanTagName } = await load('../src/utils/text.js');
const { runMigrations, LATEST_VERSION } = await load('../src/db/migrations.js');
const repo = await load('../src/db/repository.js');
const { gregorianToJalali, jalaliToGregorian, jalaliMonthLength, calendarDateKey, getCalendarParts, weekStartFor, calendarWeekdayLabels } = await load('../src/calendar.js');
const { htmlToBlocks } = await load('../src/utils/richView.js');
const { onThisDay } = await load('../src/utils/onThisDay.js');
const { buildStories, importance, STORY_MAX } = await load('../src/utils/stories.js');
const { todayData, monthData, weekData } = await load('../src/widgets/widgetData.js');
const { buildEntryHtml, TEMPLATES } = await load('../src/utils/entryPdf.js');
const { buildPalette, THEME_KEYS, contrastRatio } = await load('../src/theme.js');
const { matchesSearch, topTags } = await load('../src/utils/filters.js');
const { applyFilters, EMPTY_FILTERS } = await load('../src/utils/filters.js');

function makeDb(raw = new DatabaseSync(':memory:')) {
  return {
    raw,
    async execAsync(sql) { raw.exec(sql); },
    async runAsync(sql, ...p) {
      const r = raw.prepare(sql).run(...p.flat());
      return { lastInsertRowId: Number(r.lastInsertRowid), changes: r.changes };
    },
    async getAllAsync(sql, ...p) { return raw.prepare(sql).all(...p.flat()).map((x) => ({ ...x })); },
    async getFirstAsync(sql, ...p) { const r = raw.prepare(sql).get(...p.flat()); return r ? { ...r } : null; },
    async withTransactionAsync(fn) {
      raw.exec('BEGIN');
      try { await fn(); raw.exec('COMMIT'); } catch (e) { raw.exec('ROLLBACK'); throw e; }
    },
  };
}

let passed = 0;
const failures = [];
async function test(name, fn) {
  try { await fn(); passed++; console.log('  ok  ', name); }
  catch (e) { failures.push(name); console.log('  FAIL', name, '\n      ', e.message.split('\n')[0]); }
}

console.log('i18n');
await test('en / fa / tr have identical key sets', () => {
  const keys = (l) => Object.keys(translations[l]).sort();
  assert.deepEqual(keys('fa'), keys('en'));
  assert.deepEqual(keys('tr'), keys('en'));
});
await test('no empty translation strings', () => {
  for (const l of Object.keys(translations)) for (const [k, v] of Object.entries(translations[l])) assert.ok(String(v).trim(), `${l}.${k}`);
});

console.log('text utils');
await test('Turkish dotted/dotless I folds', () => {
  assert.ok(matchesQuery('İstanbul çok güzel', 'istanbul'));
  assert.ok(matchesQuery('ISPARTA', 'ısparta'));
  assert.ok(matchesQuery('şeker', 'SEKER'));
});
await test('Persian: Arabic yeh/kaf, ZWNJ, digits', () => {
  assert.ok(matchesQuery('علي رفت', 'علی'));
  assert.ok(matchesQuery('کتاب', 'كتاب'));
  assert.ok(matchesQuery('می‌روم', 'میروم'));
  assert.ok(matchesQuery('امروز ۱۲ مهر است', '12 مهر'));
});
await test('empty query matches everything; non-match is false', () => {
  assert.ok(matchesQuery('abc', '   '));
  assert.ok(!matchesQuery('abc', 'xyz'));
});
await test('word count: mixed script, ZWNJ, punctuation', () => {
  assert.equal(countWords(''), 0);
  assert.equal(countWords('سلام دنیا hello'), 3);
  assert.equal(countWords('می‌روم خانه، بعد؟ ok!'), 4);
  assert.equal(countWords("don't stop"), 2);
});
await test('tag keys are case/space-insensitive', () => {
  assert.equal(tagKey(' Work '), tagKey('work'));
  assert.equal(cleanTagName('##  my   tag '), 'my tag');
});

console.log('migrations');
await test('fresh install reaches latest version with all tables', async () => {
  const db = makeDb();
  await runMigrations(db);
  assert.equal((await db.getFirstAsync('PRAGMA user_version')).user_version, LATEST_VERSION);
  const names = (await db.getAllAsync("SELECT name FROM sqlite_master WHERE type='table'")).map((r) => r.name);
  for (const n of ['entries', 'daily_moods', 'tags', 'entry_tags', 'drafts', 'app_settings']) assert.ok(names.includes(n), n);
});
await test('running twice is a no-op', async () => {
  const db = makeDb();
  await runMigrations(db);
  await runMigrations(db);
  assert.equal((await db.getFirstAsync('PRAGMA user_version')).user_version, LATEST_VERSION);
});
await test('existing v0 install (old initDb schema) upgrades without losing data', async () => {
  const raw = new DatabaseSync(':memory:');
  raw.exec(`CREATE TABLE entries (id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT NOT NULL DEFAULT '', body TEXT NOT NULL DEFAULT '',
    journal_date TEXT NOT NULL, mood TEXT, favorite INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
    CREATE INDEX idx_entries_date ON entries(journal_date);
    CREATE TABLE daily_moods (journal_date TEXT PRIMARY KEY NOT NULL, mood TEXT NOT NULL, updated_at TEXT NOT NULL);
    INSERT INTO entries (title, body, journal_date, mood, favorite, created_at, updated_at) VALUES ('سلام','متن قدیمی','2026-10-01','good',1,'t','t');
    INSERT INTO daily_moods VALUES ('2026-10-01','great','t');`);
  const db = makeDb(raw);
  await runMigrations(db);
  const e = await db.getAllAsync('SELECT * FROM entries');
  assert.equal(e.length, 1);
  assert.equal(e[0].title, 'سلام');
  assert.equal(e[0].favorite, 1);
  assert.equal(e[0].pinned, 0);
  assert.equal(e[0].deleted_at, null);
  assert.equal((await db.getAllAsync('SELECT * FROM daily_moods')).length, 1);
});
await test('database from a newer app build is refused, not modified', async () => {
  const raw = new DatabaseSync(':memory:');
  raw.exec(`PRAGMA user_version = ${LATEST_VERSION + 5}`);
  await assert.rejects(() => runMigrations(makeDb(raw)), /newer/);
});

console.log('repository');
const fresh = async () => { const db = makeDb(); await runMigrations(db); return db; };

await test('create, update, multiple entries on one date', async () => {
  const db = await fresh();
  const a = await repo.saveEntry(db, { title: 'A', body: 'one', journal_date: '2026-10-23', mood: 'good', tags: [] });
  const b = await repo.saveEntry(db, { title: 'B', body: 'two', journal_date: '2026-10-23', mood: null, tags: [] });
  assert.notEqual(a, b);
  await repo.saveEntry(db, { id: a, title: 'A2', body: 'one!', journal_date: '2026-10-23', mood: 'great', tags: [] });
  const list = await repo.listEntries(db);
  assert.equal(list.length, 2);
  assert.equal(list.find((x) => x.id === a).title, 'A2');
  assert.equal(list.find((x) => x.id === a).mood, 'great');
});
await test('tags: dedupe case-insensitively, reuse across entries, replace on update', async () => {
  const db = await fresh();
  const a = await repo.saveEntry(db, { title: '', body: 'x', journal_date: '2026-10-23', mood: null, tags: ['Work', 'work', ' WORK ', 'Family'] });
  const b = await repo.saveEntry(db, { title: '', body: 'y', journal_date: '2026-10-24', mood: null, tags: ['work'] });
  let list = await repo.listEntries(db);
  assert.deepEqual(list.find((x) => x.id === a).tags.map((t) => t.name).sort(), ['Family', 'Work']);
  const tags = await repo.listTags(db);
  assert.equal(tags.length, 2);
  assert.equal(tags.find((t) => t.name === 'Work').count, 2);
  await repo.saveEntry(db, { id: a, title: '', body: 'x', journal_date: '2026-10-23', mood: null, tags: ['Family'] });
  list = await repo.listEntries(db);
  assert.deepEqual(list.find((x) => x.id === a).tags.map((t) => t.name), ['Family']);
  assert.equal(list.find((x) => x.id === b).tags.length, 1);
});
await test('deleting a tag never deletes entries', async () => {
  const db = await fresh();
  const a = await repo.saveEntry(db, { title: 't', body: 'b', journal_date: '2026-10-23', mood: null, tags: ['x'] });
  const [tag] = await repo.listTags(db);
  await repo.deleteTag(db, tag.id);
  const list = await repo.listEntries(db);
  assert.equal(list.length, 1);
  assert.equal(list[0].id, a);
  assert.equal(list[0].tags.length, 0);
});
await test('soft delete hides, restore brings back, tag counts ignore deleted', async () => {
  const db = await fresh();
  const a = await repo.saveEntry(db, { title: 'gone', body: 'b', journal_date: '2026-10-23', mood: null, tags: ['t'] });
  await repo.softDeleteEntry(db, a);
  assert.equal((await repo.listEntries(db)).length, 0);
  assert.equal((await repo.listTags(db))[0].count, 0);
  assert.equal((await repo.listDeletedEntries(db)).length, 1);
  await repo.restoreEntry(db, a);
  const list = await repo.listEntries(db);
  assert.equal(list.length, 1);
  assert.equal(list[0].tags[0].name, 't');
});
await test('pinned entries sort first; favorite toggles', async () => {
  const db = await fresh();
  const old = await repo.saveEntry(db, { title: 'old', body: '', journal_date: '2026-01-01', mood: null, tags: [] });
  await repo.saveEntry(db, { title: 'new', body: '', journal_date: '2026-10-01', mood: null, tags: [] });
  await repo.setPinned(db, old, true);
  await repo.setFavorite(db, old, true);
  const list = await repo.listEntries(db);
  assert.equal(list[0].id, old);
  assert.equal(list[0].favorite, 1);
});
await test('failed save rolls back completely (no half-written entry)', async () => {
  const db = await fresh();
  await assert.rejects(() => repo.saveEntry(db, { title: 't', body: 'b', journal_date: null, mood: null, tags: ['x'] }));
  assert.equal((await repo.listEntries(db)).length, 0);
  assert.equal((await repo.listTags(db)).length, 0);
});
await test('daily mood is independent of entry mood and can be cleared', async () => {
  const db = await fresh();
  await repo.saveEntry(db, { title: '', body: 'x', journal_date: '2026-10-23', mood: 'low', tags: [] });
  await repo.setDailyMood(db, '2026-10-23', 'great');
  let moods = await repo.listDailyMoods(db);
  assert.equal(moods['2026-10-23'], 'great');
  assert.equal((await repo.listEntries(db))[0].mood, 'low');
  await repo.setDailyMood(db, '2026-10-23', 'good'); // upsert, no duplicate row
  await repo.setDailyMood(db, '2026-10-23', null);
  moods = await repo.listDailyMoods(db);
  assert.deepEqual(moods, {});
  assert.equal((await repo.listEntries(db))[0].mood, 'low');
});
await test('settings round-trip (JSON values, upsert)', async () => {
  const db = await fresh();
  await repo.saveSetting(db, 'language', 'fa');
  await repo.saveSetting(db, 'language', 'tr');
  await repo.saveSetting(db, 'appearance', 'dark');
  assert.deepEqual(await repo.loadSettings(db), { language: 'tr', appearance: 'dark' });
});
await test('filters: favorites + mood + tag combine with AND', async () => {
  const db = await fresh();
  await repo.saveEntry(db, { title: 'a', body: '', journal_date: '2026-10-01', mood: 'good', tags: ['x'] });
  const b = await repo.saveEntry(db, { title: 'b', body: '', journal_date: '2026-10-02', mood: 'good', tags: ['x', 'y'] });
  await repo.setFavorite(db, b, true);
  const entries = await repo.listEntries(db);
  const tagY = (await repo.listTags(db)).find((t) => t.name === 'y');
  assert.equal(applyFilters(entries, EMPTY_FILTERS).length, 2);
  assert.equal(applyFilters(entries, { favorites: true, mood: null, tagId: null }).length, 1);
  assert.equal(applyFilters(entries, { favorites: false, mood: 'good', tagId: tagY.id })[0].title, 'b');
  assert.equal(applyFilters(entries, { favorites: false, mood: 'low', tagId: null }).length, 0);
});

console.log('calendar (existing code, boundary checks)');
await test('Solar Hijri new year dates', () => {
  const j = (y, m, d) => { const p = gregorianToJalali(y, m, d); return `${p.jy}-${p.jm}-${p.jd}`; };
  assert.equal(j(2024, 3, 20), '1403-1-1');
  assert.equal(j(2025, 3, 21), '1404-1-1');
  assert.equal(j(2026, 3, 21), '1405-1-1');
});
await test('Solar Hijri round-trips for every day 2020–2035', () => {
  for (let t = Date.UTC(2020, 0, 1); t < Date.UTC(2036, 0, 1); t += 86400000) {
    const d = new Date(t);
    const g = [d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate()];
    const p = gregorianToJalali(...g);
    const back = jalaliToGregorian(p.jy, p.jm, p.jd);
    assert.deepEqual([back.gy, back.gm, back.gd], g, `${g}`);
  }
});
await test('Esfand length: 30 in leap years (1403), 29 otherwise (1404)', () => {
  assert.equal(jalaliMonthLength(1403, 12), 30);
  assert.equal(jalaliMonthLength(1404, 12), 29);
});
await test('getCalendarParts / calendarDateKey are inverse', () => {
  const parts = getCalendarParts('2026-10-23', 'solarHijri');
  assert.equal(calendarDateKey(parts.year, parts.month, parts.day, 'solarHijri'), '2026-10-23');
});

console.log('map places');
await test('groupPlaces: two spots in the same house become one marker, even across a rounding boundary', () => {
  // ~25 m apart, but on opposite sides of a 3-decimal rounding edge (41.0004 vs 41.0006 -> "41.000" / "41.001")
  const places = [
    { id: 1, entry_id: 1, latitude: 41.00049, longitude: 29.0, name: 'Home', journal_date: '2026-10-02' },
    { id: 2, entry_id: 2, latitude: 41.00061, longitude: 29.00005, name: '', journal_date: '2026-10-01' },
  ];
  const { groups } = groupPlaces(places);
  assert.equal(groups.length, 1);
  assert.equal(groups[0].entries.length, 2);
  assert.equal(groups[0].name, 'Home');
  assert.ok(distanceMeters(groups[0].latitude, groups[0].longitude, 41.00055, 29.000025) < 5, 'marker at the average position');
});
await test('groupPlaces: places a few hundred metres apart stay separate; missing coordinates are counted', () => {
  const { groups, withoutCoords } = groupPlaces([
    { id: 1, entry_id: 1, latitude: 41.0, longitude: 29.0 },
    { id: 2, entry_id: 2, latitude: 41.004, longitude: 29.0 }, // ~445 m
    { id: 3, entry_id: 3, latitude: null, longitude: null },
  ]);
  assert.equal(groups.length, 2);
  assert.equal(withoutCoords, 1);
});
await test('groupPlaces: 50 m radius — 40 m apart is one place, 70 m apart is two', () => {
  const near = groupPlaces([{ id: 1, entry_id: 1, latitude: 41.0, longitude: 29.0 }, { id: 2, entry_id: 2, latitude: 41.00036, longitude: 29.0 }]);
  assert.equal(near.groups.length, 1);
  const far = groupPlaces([{ id: 1, entry_id: 1, latitude: 41.0, longitude: 29.0 }, { id: 2, entry_id: 2, latitude: 41.00063, longitude: 29.0 }]);
  assert.equal(far.groups.length, 2);
});
await test('groupPlaces: Places list radius 100 m merges many "Home" spots 80 m apart; map radius keeps them apart', () => {
  const homes = [0, 1, 2].map((i) => ({ id: i + 1, entry_id: i + 1, latitude: 35.7 + i * 0.00036, longitude: 51.4, name: 'Home', address: 'Valiasr St', journal_date: '2026-10-0' + (3 - i) }));
  assert.equal(groupPlaces(homes, 100).groups.length, 1);
  assert.equal(groupPlaces(homes, 100).groups[0].entries.length, 3);
  assert.equal(groupPlaces(homes, 100).groups[0].address, 'Valiasr St');
  assert.equal(groupPlaces(homes).groups.length, 2, 'default (map) radius is 50 m');
});
await test('groupPlaces: a chain of places is not merged into one endless cluster', () => {
  const chain = Array.from({ length: 6 }, (_, i) => ({ id: i + 1, entry_id: i + 1, latitude: 41.0 + i * 0.0009, longitude: 29.0 })); // 100 m steps
  const { groups } = groupPlaces(chain);
  assert.ok(groups.length >= 3, 'got ' + groups.length);
});

await test('widgets: today and month data follow language, calendar and week start', () => {
  const now = new Date(2026, 10, 3, 9, 0); // Tue 3 Nov 2026 = 12 Aban 1405
  const en = todayData({ now, language: 'en' });
  assert.equal(en.day, '3'); assert.equal(en.weekday, 'Tuesday'); assert.equal(en.month, 'November');
  const fa = todayData({ now, language: 'fa' });
  assert.equal(fa.day, '۱۲'); assert.equal(fa.rtl, true);
  const m = monthData({ now, language: 'en' });
  assert.equal(m.weekdays.length, 7); assert.equal(m.weekdays[0], 'Mo');
  assert.ok(m.weeks.every((w) => w.length === 7));
  assert.equal(m.weeks[0].findIndex((x) => !x.blank), 6, '1 Nov 2026 is a Sunday: last column of a Monday-first week');
  assert.equal(m.weeks.flat().filter((x) => x.today).length, 1);
  assert.equal(m.weeks.flat().filter((x) => !x.blank).length, 30);
  const mf = monthData({ now, language: 'fa' });
  assert.equal(mf.weeks.flat().filter((x) => !x.blank).length, 30, 'Aban has 30 days');
  assert.equal(mf.weeks.flat().find((x) => x.today).label, '۱۲');
  assert.equal(mf.weekdays.length, 7);
});
await test('widgets: week strip is the current week, Monday first (Saturday first, right to left, in Persian)', () => {
  const now = new Date(2026, 10, 3, 9, 0); // Tuesday
  const w = weekData({ now, language: 'en' });
  assert.deepEqual(w.days.map((d) => d.label), ['2', '3', '4', '5', '6', '7', '8']);
  assert.equal(w.days.findIndex((d) => d.today), 1);
  const f = weekData({ now, language: 'fa' });
  assert.equal(f.days.length, 7);
  assert.equal(f.days.find((d) => d.today).label, '۱۲');
  // Persian week starts on Saturday 9 Aban; rows run right to left, so Saturday is the last array item
  assert.equal(f.days[f.days.length - 1].label, '۹', 'Saturday 9 Aban 1405 starts this week');
});
await test('onThisDay: same day and month in earlier years, nearest first; Solar Hijri uses Jalali days', () => {
  const es = [
    { id: 1, journal_date: '2024-11-03' }, { id: 2, journal_date: '2025-11-03' }, { id: 3, journal_date: '2026-11-03' },
    { id: 4, journal_date: '2025-11-04' }, { id: 5, journal_date: '2025-03-03' },
  ];
  const g = onThisDay(es, '2026-11-03', 'gregorian');
  assert.deepEqual(g.map((x) => [x.entry.id, x.yearsAgo]), [[2, 1], [1, 2]]);
  // 12 Aban 1405 = 3 Nov 2026; 12 Aban 1404 = 3 Nov 2025 (+/- a day around leap years): same Jalali day
  const j = onThisDay([{ id: 9, journal_date: '2025-11-03' }, { id: 8, journal_date: '2025-11-04' }], '2026-11-03', 'solarHijri');
  assert.ok(j.length <= 1 && j.every((x) => x.yearsAgo === 1));
});
await test('stories: today = same day earlier years; month/year = only important entries (favourite, pinned or photo)', () => {
  const E = (id, date, o = {}) => ({ id, journal_date: date, title: 't' + id, body: '', favorite: 0, pinned: 0, attachmentCount: 0, ...o });
  const es = [
    E(1, '2025-11-03'), E(2, '2024-11-03'),                       // on this day
    E(3, '2026-10-05', { favorite: 1 }), E(4, '2026-10-06'), E(5, '2026-10-20', { attachmentCount: 2 }), // last month
    E(6, '2025-03-01', { pinned: 1 }), E(7, '2025-04-01'), E(8, '2025-06-01', { attachmentCount: 1 }),   // last year
    E(9, '2026-11-03'),
  ];
  const g = buildStories(es, '2026-11-03', 'gregorian');
  assert.deepEqual(g.map((x) => x.key), ['today', 'lastMonth', 'lastYear']);
  assert.deepEqual(g[0].items.map((x) => [x.id, x.yearsAgo]), [[1, 1], [2, 2]]);
  assert.deepEqual(g[1].items.map((x) => x.id), [3, 5], 'unmarked entry 4 is left out; played oldest first');
  assert.deepEqual(g[2].items.map((x) => x.id), [6, 8]);
  assert.equal(buildStories([E(1, '2026-11-03')], '2026-11-03').length, 0, 'nothing to show');
  assert.ok(importance(E(1, 'x', { favorite: 1, attachmentCount: 1 })) > importance(E(2, 'x', { favorite: 1 })));
  const many = Array.from({ length: 20 }, (_, i) => E(i + 1, '2026-10-' + String((i % 28) + 1).padStart(2, '0'), { favorite: 1 }));
  assert.equal(buildStories(many, '2026-11-03')[0].items.length, STORY_MAX, 'capped');
  // January looks back to December of the year before
  assert.deepEqual(buildStories([E(1, '2025-12-20', { favorite: 1 })], '2026-01-10')[0].items.map((x) => x.id), [1]);
});
await test('themes: every theme/mode keeps readable contrast', () => {
  for (const k of THEME_KEYS) for (const dark of [false, true]) {
    const p = buildPalette(k, dark);
    const chk = (a, b, min, name) => assert.ok(contrastRatio(a, b) >= min, `${k}/${dark ? 'dark' : 'light'} ${name} ${contrastRatio(a, b).toFixed(2)}`);
    chk(p.ink, p.paper, 7, 'ink/paper'); chk(p.ink, p.card, 7, 'ink/card');
    chk(p.muted, p.paper, 4.5, 'muted/paper'); chk(p.onAccent, p.accent, 4.5, 'onAccent/accent');
  }
});
await test('themes: unknown key falls back to default', () => {
  assert.deepEqual(buildPalette('nope', false), buildPalette('sage', false));
});
await test('richView: blocks, lists, marks, colours, quotes', () => {
  const b = htmlToBlocks('<h1>Hi</h1><p dir="rtl">a <strong>b</strong><em>c</em><br>d</p><ul><li>x</li><li>y</li></ul><ol><li>one</li></ol><blockquote><p>q</p></blockquote><hr><p><span style="color:#ff0000">r</span></p>');
  assert.equal(b[0].type, 'h1');
  assert.equal(b[1].dir, 'rtl');
  assert.ok(b[1].runs.some((r) => r.text === 'b' && r.bold));
  assert.ok(b[1].runs.some((r) => r.text === 'c' && r.italic));
  assert.deepEqual(b.filter((x) => x.type === 'li').map((x) => x.marker), ['•', '•', '1.']);
  assert.equal(b.find((x) => x.runs[0] && x.runs[0].text === 'q').quote, true);
  assert.ok(b.some((x) => x.type === 'hr'));
  assert.equal(b[b.length - 1].runs[0].color, '#ff0000');
});
await test('richView: plain text and entities', () => {
  const b = htmlToBlocks('hello &amp; <b>bye</b>');
  assert.equal(b[0].runs.map((r) => r.text).join(''), 'hello & bye');
  assert.deepEqual(htmlToBlocks(''), []);
});
await test('search: #tag finds entries with that tag; mixes with words; top 5 tags', () => {
  const e = (title, ...tags) => ({ title, body: '', tags: tags.map((name, i) => ({ id: i, name })) });
  const a = e('Rome', 'Vacation', 'food'), b = e('Work day', 'work'), d = e('vacation plans');
  assert.equal(matchesSearch(a, '#vacation'), true);
  assert.equal(matchesSearch(a, '#VAC'), true);
  assert.equal(matchesSearch(b, '#vacation'), false);
  assert.equal(matchesSearch(d, '#vacation'), false, 'a #tag search does not match plain words');
  assert.equal(matchesSearch(a, '#vacation rome'), true);
  assert.equal(matchesSearch(a, '#vacation paris'), false);
  assert.equal(matchesSearch(b, 'work'), true);
  assert.equal(matchesSearch(b, '#'), true);
  const tags = Array.from({ length: 8 }, (_, i) => ({ id: i + 1, name: 't' + i, count: i }));
  const top = topTags(tags);
  assert.equal(top.length, 5);
  assert.deepEqual(top.map((x) => x.count), [7, 6, 5, 4, 3]);
  assert.equal(topTags(tags, 5, 2).length, 6, 'selected tag stays visible');
});
await test('pdf: every template renders title, body, tags, photos; escapes and sanitises; rtl', () => {
  const entry = { title: 'A <b>&</b> B', tags: [{ name: 'x<y' }], location: { name: 'Rome' } };
  for (const tp of TEMPLATES) {
    const h = buildEntryHtml({ entry, bodyHtml: '<p>hello</p><script>evil()</script>', template: tp.key, dateText: 'Sat', photos: ['data:image/jpeg;base64,AAA', 'data:image/jpeg;base64,BBB'], moodFace: '🙂', rtl: tp.key === 'modern' });
    assert.ok(h.includes('tpl-' + tp.key));
    assert.ok(h.includes('A &lt;b&gt;&amp;&lt;/b&gt; B') && h.includes('#x&lt;y') && h.includes('hello') && h.includes('Rome'));
    assert.ok(!h.includes('evil()') && !h.includes('<script'));
    assert.equal((h.match(/<img /g) || []).length, 2);
    assert.ok(h.includes('class="photos many"'));
  }
  assert.ok(buildEntryHtml({ entry, bodyHtml: '', template: 'modern', dateText: 'd', rtl: true }).includes('direction: rtl'));
  assert.ok(buildEntryHtml({ entry, bodyHtml: '', template: 'nope', dateText: 'd' }).includes('tpl-classic'));
});
await test('pdf: photos are sized on their wrapper (full width alone, two per row otherwise)', () => {
  const html = buildEntryHtml({ entry: { title: 'x', tags: [] }, bodyHtml: '<p>a</p>', template: 'garden', dateText: 'd', photos: ['data:a', 'data:b', 'data:c'] });
  assert.ok(html.includes('.photos.many .ph { width: calc(50% - 5px); }'));
  assert.ok(!/\.photos\.many img \{ width: calc/.test(html), 'img must not be given a fraction of its shrink-wrapped parent');
  assert.equal((html.match(/class="ph"/g) || []).length, 3);
});
await test('week starts on Monday (en, tr) and Saturday (fa)', () => {
  assert.equal(weekStartFor('en'), 1); assert.equal(weekStartFor('tr'), 1); assert.equal(weekStartFor('fa'), 6);
  assert.equal(calendarWeekdayLabels('en')[0], 'Mon');
  assert.equal(calendarWeekdayLabels('en')[6], 'Sun');
  assert.equal(calendarWeekdayLabels('fa')[0], 'شنبه');
});
console.log(`\n${passed} passed, ${failures.length} failed`);
if (failures.length) { console.log('Failed:', failures.join('; ')); process.exit(1); }
