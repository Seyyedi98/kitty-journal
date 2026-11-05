import { getCalendarParts } from '../calendar';

/**
 * Entries written on this same day and month in an earlier year, in the user's calendar
 * (Solar Hijri days count in Solar Hijri). Nearest year first.
 * @returns {Array<{entry: object, yearsAgo: number}>}
 */
export function onThisDay(entries, todayKey, calendar = 'gregorian') {
  const now = getCalendarParts(todayKey, calendar);
  const out = [];
  for (const entry of entries || []) {
    if (!entry || !entry.journal_date) continue;
    const p = getCalendarParts(entry.journal_date, calendar);
    if (p.month === now.month && p.day === now.day && p.year < now.year) out.push({ entry, yearsAgo: now.year - p.year });
  }
  return out.sort((a, b) => a.yearsAgo - b.yearsAgo);
}
