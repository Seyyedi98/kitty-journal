// "Wrapped": a friendly summary of one month or one year. Pure functions (no React, no native modules).
import { calendarDateKey, calendarMonthLength, parseDateKey } from '../calendar';

export const MOOD_SCORE = { veryLow: 1, low: 2, okay: 3, good: 4, great: 5 };

/** First and last date key of a month (month 1-12) or of a whole year (month = null), in the user's calendar. */
export function periodRange(year, month, calendar) {
  if (month == null) {
    return { from: calendarDateKey(year, 1, 1, calendar), to: calendarDateKey(year, 12, calendarMonthLength(year, 12, calendar), calendar) };
  }
  return { from: calendarDateKey(year, month, 1, calendar), to: calendarDateKey(year, month, calendarMonthLength(year, month, calendar), calendar) };
}

const wordCount = (text) => (String(text || '').trim() ? String(text).trim().split(/\s+/).length : 0);
const dayNumber = (key) => Math.round(parseDateKey(key).getTime() / 86400000);

/**
 * @param {{entries: object[], dayMoods: Record<string,string>, from: string, to: string}} p
 * entries need journal_date ('YYYY-MM-DD'), body, tags ([{name}]) and favorite.
 */
export function computeWrapped({ entries, dayMoods = {}, from, to }) {
  const inRange = (key) => key >= from && key <= to;
  const list = entries.filter((e) => e.journal_date && inRange(e.journal_date));
  const perDay = {};
  const tagCounts = {};
  let words = 0;
  let favorites = 0;
  for (const e of list) {
    const w = wordCount(e.body);
    words += w;
    if (e.favorite) favorites += 1;
    const d = (perDay[e.journal_date] ||= { entries: 0, words: 0 });
    d.entries += 1;
    d.words += w;
    for (const tg of e.tags || []) tagCounts[tg.name] = (tagCounts[tg.name] || 0) + 1;
  }
  const days = Object.keys(perDay).sort();
  // longest run of consecutive writing days
  let streak = 0;
  let run = 0;
  for (let i = 0; i < days.length; i += 1) {
    run = i > 0 && dayNumber(days[i]) - dayNumber(days[i - 1]) === 1 ? run + 1 : 1;
    if (run > streak) streak = run;
  }
  // moods of the period (one per day)
  const moodCounts = {};
  let best = null;
  for (const [day, mood] of Object.entries(dayMoods)) {
    if (!inRange(day) || !MOOD_SCORE[mood]) continue;
    moodCounts[mood] = (moodCounts[mood] || 0) + 1;
    const score = MOOD_SCORE[mood];
    const w = perDay[day] ? perDay[day].words : 0;
    if (!best || score > best.score || (score === best.score && w > best.words)) best = { day, mood, score, words: w };
  }
  if (!best && days.length) {
    const day = days.reduce((a, b) => (perDay[b].words > perDay[a].words ? b : a), days[0]);
    best = { day, mood: null, score: 0, words: perDay[day].words };
  }
  const topMood = Object.entries(moodCounts).sort((a, b) => b[1] - a[1] || MOOD_SCORE[b[0]] - MOOD_SCORE[a[0]])[0] || null;
  const topTag = Object.entries(tagCounts).sort((a, b) => b[1] - a[1])[0] || null;
  return {
    entries: list.length,
    writingDays: days.length,
    words,
    favorites,
    longestStreak: streak,
    topMood: topMood ? { key: topMood[0], count: topMood[1] } : null,
    bestDay: best ? { day: best.day, mood: best.mood } : null,
    topTag: topTag ? { name: topTag[0], count: topTag[1] } : null,
  };
}

/**
 * One mood per day: the Home "How are you feeling today?" choice wins; otherwise the mood of that day's most recently
 * edited entry. A day with no mood is missing data. Shared by Statistics and Wrapped.
 */
export function mergeDayMoods(entries, dailyMoods) {
  const out = { ...(dailyMoods || {}) };
  const latest = {};
  for (const e of entries || []) {
    if (!e.mood || out[e.journal_date]) continue;
    const prev = latest[e.journal_date];
    if (!prev || String(e.updated_at) > String(prev.updated_at)) latest[e.journal_date] = e;
  }
  for (const [day, e] of Object.entries(latest)) out[day] = e.mood;
  return out;
}
