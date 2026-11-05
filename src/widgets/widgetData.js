// Pure data for the home-screen widgets (no native imports, so it is unit-tested).
import {
  calendarDateKey,
  calendarMonthLength,
  calendarWeekdayLabels,
  dateKey,
  formatCalendarMonth,
  formatDateKey,
  getCalendarParts,
  parseDateKey,
  weekStartFor,
} from '../calendar';

const tag = (language) => (language === 'fa' ? 'fa-IR' : language === 'tr' ? 'tr-TR' : 'en-US');

/** "Default" calendar follows the language, exactly like the app. */
export const resolveCalendar = (calendar, language) =>
  !calendar || calendar === 'default' ? (language === 'fa' ? 'solarHijri' : 'gregorian') : calendar;

/** Today widget: weekday, big day number, month and year in the user's language and calendar. */
export function todayData({ now = new Date(), language = 'en', calendar = 'default' } = {}) {
  const cal = resolveCalendar(calendar, language);
  const key = dateKey(now);
  const parts = getCalendarParts(key, cal);
  const nf = new Intl.NumberFormat(tag(language), { useGrouping: false });
  return {
    key,
    weekday: formatDateKey(key, language, cal, { weekday: 'long' }),
    day: nf.format(parts.day),
    month: formatDateKey(key, language, cal, { month: 'long' }),
    year: nf.format(parts.year),
    rtl: language === 'fa',
  };
}

/**
 * Month widget: title, weekday header and rows of 7 cells ({ label, today } or { blank }).
 * Weeks start on Monday (Saturday for Persian); Persian rows run right to left.
 */
/** Week strip: the 7 days of the current week (Monday first, Saturday first for Persian). */
export function weekData({ now = new Date(), language = 'en', calendar = 'default' } = {}) {
  const cal = resolveCalendar(calendar, language);
  const nf = new Intl.NumberFormat(tag(language), { useGrouping: false });
  const rtl = language === 'fa';
  const back = (now.getDay() - weekStartFor(language) + 7) % 7;
  const labels = calendarWeekdayLabels(language).map((w) => (rtl ? Array.from(w)[0] : w.slice(0, 2)));
  const todayKey = dateKey(now);
  let days = labels.map((wd, i) => {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - back + i, 12);
    const k = dateKey(d);
    return { wd, label: nf.format(getCalendarParts(k, cal).day), today: k === todayKey };
  });
  if (rtl) days = [...days].reverse();
  return { days, rtl };
}

export function monthData({ now = new Date(), language = 'en', calendar = 'default' } = {}) {
  const cal = resolveCalendar(calendar, language);
  const key = dateKey(now);
  const { year, month, day: todayDay } = getCalendarParts(key, cal);
  const rtl = language === 'fa';
  const nf = new Intl.NumberFormat(tag(language), { useGrouping: false });
  const first = parseDateKey(calendarDateKey(year, month, 1, cal));
  const offset = (first.getDay() - weekStartFor(language) + 7) % 7;
  const length = calendarMonthLength(year, month, cal);
  const cells = [];
  for (let i = 0; i < offset; i += 1) cells.push({ blank: true });
  for (let d = 1; d <= length; d += 1) cells.push({ label: nf.format(d), today: d === todayDay });
  while (cells.length % 7) cells.push({ blank: true });
  let weeks = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  let weekdays = calendarWeekdayLabels(language).map((w) => (rtl ? Array.from(w)[0] : w.slice(0, 2)));
  if (rtl) {
    weeks = weeks.map((w) => [...w].reverse());
    weekdays = [...weekdays].reverse();
  }
  return { title: formatCalendarMonth(year, month, language, cal), weekdays, weeks, rtl };
}
