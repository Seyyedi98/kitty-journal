import { getCalendarParts } from '../calendar';
import { onThisDay } from './onThisDay';

export const STORY_MAX = 8;

/** How much an entry deserves a place in a story: favourites, pinned, photos, strong moods, longer writing. */
export function importance(e) {
  let n = 0;
  if (e.favorite) n += 3;
  if (e.pinned) n += 2;
  if ((e.attachmentCount || 0) > 0) n += 2;
  if (e.mood === 'great' || e.mood === 'veryLow') n += 1;
  if ((e.body || '').length > 200) n += 1;
  return n;
}

/** Only entries the user marked or illustrated count as "important" for the month/year stories. */
const isImportant = (e) => Boolean(e.favorite || e.pinned || (e.attachmentCount || 0) > 0);

const pickBest = (list) =>
  [...list]
    .sort((a, b) => importance(b) - importance(a) || String(b.journal_date).localeCompare(String(a.journal_date)))
    .slice(0, STORY_MAX)
    .sort((a, b) => String(a.journal_date).localeCompare(String(b.journal_date)));

/**
 * Story groups for Home. Empty groups are left out.
 *  - today: every entry written on this day in earlier years (nearest year first)
 *  - lastMonth: the important entries of the previous month
 *  - lastYear: the important entries of the previous year
 * @returns {Array<{key:'today'|'lastMonth'|'lastYear', items: object[]}>}
 */
export function buildStories(entries, todayKey, calendar = 'gregorian') {
  const now = getCalendarParts(todayKey, calendar);
  const prevMonth = now.month === 1 ? { year: now.year - 1, month: 12 } : { year: now.year, month: now.month - 1 };
  const groups = [];
  const today = onThisDay(entries, todayKey, calendar).slice(0, STORY_MAX);
  if (today.length) groups.push({ key: 'today', items: today.map((x) => ({ ...x.entry, yearsAgo: x.yearsAgo })) });
  const month = [];
  const year = [];
  for (const e of entries || []) {
    if (!e || !e.journal_date || !isImportant(e)) continue;
    const p = getCalendarParts(e.journal_date, calendar);
    if (p.year === prevMonth.year && p.month === prevMonth.month) month.push(e);
    if (p.year === now.year - 1) year.push(e);
  }
  if (month.length) groups.push({ key: 'lastMonth', items: pickBest(month) });
  if (year.length) groups.push({ key: 'lastYear', items: pickBest(year) });
  return groups;
}
