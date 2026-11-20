// Extra statistics for Premium (Statistics page). Pure functions: no React, no native modules.
// Same rules as insights.js: everything is descriptive and computed from what the user recorded.
//   * a day without a recorded mood is missing data, never "neutral";
//   * a "factor" is only an association between days in the user's own notes, never a cause;
//   * a run of writing days is shown as a plain number, with no judgement of gaps.
import { MOOD_SCORE, addDays, daysBetween } from './insights';
import { countWords } from './text';

const MOOD_KEYS = ['veryLow', 'low', 'okay', 'good', 'great'];

/** The mood face closest to an average score (1..5). */
export const nearestMood = (avg) => (avg == null ? null : MOOD_KEYS[Math.min(4, Math.max(0, Math.round(avg) - 1))]);

const inRange = (key, from, to) => (!from || key >= from) && key <= to;
const round1 = (v) => Math.round(v * 10) / 10;

/** Average of the recorded daily moods between two day keys. */
export function avgMood(dayMoods, from, to) {
  let sum = 0;
  let n = 0;
  for (const [day, mood] of Object.entries(dayMoods || {})) {
    if (MOOD_SCORE[mood] && inRange(day, from, to)) {
      sum += MOOD_SCORE[mood];
      n += 1;
    }
  }
  return { avg: n ? sum / n : null, n };
}

/** Numbers of one period (used for "this period" and "the period before it"). */
export function periodStats(entries, dayMoods, from, to) {
  const live = entries.filter((e) => e.journal_date && inRange(e.journal_date, from, to));
  const days = new Set(live.map((e) => e.journal_date));
  let words = 0;
  for (const e of live) words += countWords(`${e.title || ''} ${e.body || ''}`);
  const m = avgMood(dayMoods, from, to);
  return { entries: live.length, writingDays: days.size, words, mood: m.avg, moodDays: m.n };
}

/**
 * This period against the one right before it, with the same length. `all` has nothing to compare with.
 * Returns null when there is no earlier period or it holds nothing.
 */
export function comparePeriods({ entries, dayMoods, range, rangeDays }) {
  if (!range.from) return null;
  const prevTo = addDays(range.from, -1);
  const prevFrom = addDays(range.from, -rangeDays);
  const prev = periodStats(entries, dayMoods, prevFrom, prevTo);
  if (!prev.entries && prev.mood == null) return null;
  return { cur: periodStats(entries, dayMoods, range.from, range.to), prev, days: rangeDays, curFrom: range.from, curTo: range.to, prevFrom, prevTo };
}

/** Longest run of consecutive writing days inside the range, and the run that ends today (or yesterday). */
export function writingRuns(entries, range, today) {
  const set = new Set();
  for (const e of entries) if (e.journal_date && inRange(e.journal_date, range.from, range.to)) set.add(e.journal_date);
  const days = [...set].sort();
  let longest = 0;
  let run = 0;
  for (let i = 0; i < days.length; i += 1) {
    run = i > 0 && daysBetween(days[i - 1], days[i]) === 1 ? run + 1 : 1;
    if (run > longest) longest = run;
  }
  let current = 0;
  let cursor = set.has(today) ? today : addDays(today, -1);
  while (set.has(cursor)) {
    current += 1;
    cursor = addDays(cursor, -1);
  }
  return { longest, current };
}

/** When in the day entries are written: 8 slots of 3 hours, from the time the entry was created. */
export function hourSlots(entries, range) {
  const slots = Array(8).fill(0);
  let total = 0;
  for (const e of entries) {
    if (!e.journal_date || !inRange(e.journal_date, range.from, range.to) || !e.created_at) continue;
    const d = new Date(e.created_at);
    if (Number.isNaN(d.getTime())) continue;
    slots[Math.floor(d.getHours() / 3)] += 1;
    total += 1;
  }
  let peak = -1;
  if (total >= 5) {
    let best = 0;
    slots.forEach((n, i) => {
      if (n > best) {
        best = n;
        peak = i;
      }
    });
  }
  return { slots, total, peak };
}

/** Word figures of the range. */
export function wordFigures(entries, range) {
  const live = entries.filter((e) => e.journal_date && inRange(e.journal_date, range.from, range.to));
  const days = new Set(live.map((e) => e.journal_date));
  let words = 0;
  let longest = 0;
  for (const e of live) {
    const w = countWords(`${e.title || ''} ${e.body || ''}`);
    words += w;
    if (w > longest) longest = w;
  }
  return { longest, perDay: days.size ? Math.round(words / days.size) : 0 };
}

const placeName = (loc) => {
  if (!loc) return '';
  if (typeof loc === 'string') return loc.trim();
  return String(loc.name || loc.address || '').trim();
};

/**
 * What goes with a higher or lower mood in the user's own days: tags, places and weekdays.
 * A factor needs at least `minDays` days with a recorded mood both with and without it.
 */
export function moodFactors({ entries, dayMoods, range, minDays = 4, limit = 3 }) {
  const recorded = [];
  for (const [day, mood] of Object.entries(dayMoods || {})) if (MOOD_SCORE[mood] && inRange(day, range.from, range.to)) recorded.push(day);
  if (recorded.length < minDays * 2) return { higher: [], lower: [], recorded: recorded.length };
  const recordedSet = new Set(recorded);
  const byFactor = new Map(); // "type:key" -> { type, key, days:Set }
  const add = (type, key, day) => {
    const id = `${type}:${key}`;
    let f = byFactor.get(id);
    if (!f) {
      f = { type, key, days: new Set() };
      byFactor.set(id, f);
    }
    f.days.add(day);
  };
  for (const e of entries) {
    const day = e.journal_date;
    if (!day || !recordedSet.has(day)) continue;
    for (const tg of e.tags || []) add('tag', tg.name, day);
    const p = placeName(e.location);
    if (p) add('place', p, day);
  }
  for (const day of recorded) add('weekday', String(new Date(`${day}T12:00:00`).getDay()), day);
  let total = 0;
  for (const d of recorded) total += MOOD_SCORE[dayMoods[d]];
  const all = [];
  for (const f of byFactor.values()) {
    const n = f.days.size;
    const rest = recorded.length - n;
    if (n < minDays || rest < minDays) continue;
    let sum = 0;
    for (const d of f.days) sum += MOOD_SCORE[dayMoods[d]];
    const withAvg = sum / n;
    const withoutAvg = (total - sum) / rest;
    all.push({ type: f.type, key: f.key, n, diff: withAvg - withoutAvg, withAvg });
  }
  const higher = all.filter((f) => f.diff >= 0.3).sort((a, b) => b.diff - a.diff || b.n - a.n).slice(0, limit);
  const lower = all.filter((f) => f.diff <= -0.3).sort((a, b) => a.diff - b.diff || b.n - a.n).slice(0, limit);
  return { higher, lower, recorded: recorded.length };
}

/** Places that appear in the range, with how often and the average mood of those days. */
export function topPlaces({ entries, dayMoods, range, limit = 5 }) {
  const map = new Map();
  for (const e of entries) {
    if (!e.journal_date || !inRange(e.journal_date, range.from, range.to)) continue;
    const name = placeName(e.location);
    if (!name) continue;
    const cur = map.get(name) || { name, count: 0, days: new Set() };
    cur.count += 1;
    cur.days.add(e.journal_date);
    map.set(name, cur);
  }
  return [...map.values()]
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
    .slice(0, limit)
    .map((p) => {
      let sum = 0;
      let n = 0;
      for (const d of p.days) {
        const s = MOOD_SCORE[(dayMoods || {})[d]];
        if (s) {
          sum += s;
          n += 1;
        }
      }
      return { name: p.name, count: p.count, avg: n ? round1(sum / n) : null };
    });
}
