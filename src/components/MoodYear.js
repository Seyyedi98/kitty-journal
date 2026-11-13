import React, { useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { ChevronLeft, ChevronRight, Share2 } from 'lucide-react-native';
import { Text } from '../ui';
import { Button, Card } from './common';
import { Dialog } from '../platform/dialog';
import { deliverFile, makeImageFile } from '../platform/exportEntry';
import MoodFace from './MoodFace';
import { calendarDateKey, calendarMonthLength, calendarWeekdayLabels, formatDateKey, getCalendarParts, parseDateKey, weekStartFor } from '../calendar';
import { fmt } from '../i18n';

// One colour per mood, strong enough to tell apart at a glance (the soft MOODS colours are too close together).
export const PIXEL_COLORS = {
  veryLow: '#5C7CC2',
  low: '#F08A4B',
  okay: '#F5C842',
  good: '#6DBE7A',
  great: '#1F9D55',
};
const MOOD_ORDER = ['veryLow', 'low', 'okay', 'good', 'great'];
const LABEL_W = 44; // weekday names on the side (shared picture only)
const MONTH_H = 12; // month names on top
const GAP = 1;
const POSTER_STEP = 14; // square size in the shared picture

/**
 * The days of a year laid out like GitHub's contribution graph: one column per week, one row per weekday
 * (the week starts on Monday, or Saturday for Persian). Returns { weeks: (key|null)[7][], months: [{ month, col, span }] }.
 */
export function buildYearGrid(year, calendar, weekStart) {
  const weeks = [];
  const months = [];
  let col = -1;
  let row = 0;
  for (let m = 1; m <= 12; m += 1) {
    const len = calendarMonthLength(year, m, calendar);
    for (let d = 1; d <= len; d += 1) {
      const key = calendarDateKey(year, m, d, calendar);
      row = (parseDateKey(key).getDay() - weekStart + 7) % 7;
      if (col < 0 || row === 0) {
        col += 1;
        weeks.push(Array(7).fill(null));
      }
      weeks[col][row] = key;
      if (d === 1) months.push({ month: m, col });
    }
  }
  months.forEach((x, i) => { x.span = (i + 1 < months.length ? months[i + 1].col : weeks.length) - x.col; });
  return { weeks, months };
}

/** "Year in pixels": every day of the year is a tiny square coloured by that day's mood, GitHub style. */
export default function MoodYear({ t, c, rtl, language, calendar, today, dayMoods }) {
  const localeTag = language === 'fa' ? 'fa-IR' : language === 'tr' ? 'tr-TR' : 'en-US';
  const nf = useMemo(() => new Intl.NumberFormat(localeTag, { useGrouping: false }), [localeTag]);
  const nowYear = getCalendarParts(today, calendar).year;
  const [year, setYear] = useState(nowYear);
  const [width, setWidth] = useState(0);
  const [sharing, setSharing] = useState(false);
  const shotRef = useRef(null);

  const weekStart = weekStartFor(language);
  const { weeks, months } = useMemo(() => buildYearGrid(year, calendar, weekStart), [year, calendar, weekStart]);
  const cols = weeks.length;
  const step = width > 0 ? Math.max(4, Math.floor(width / cols)) : 0;
  const recorded = useMemo(() => {
    let n = 0;
    for (const w of weeks) for (const k of w) if (k && dayMoods[k]) n += 1;
    return n;
  }, [weeks, dayMoods]);

  // The labels already start on the first day of the week (Monday, or Saturday for Persian), like the rows of the grid.
  const dayNames = useMemo(() => calendarWeekdayLabels(language).map((w) => (rtl ? w : w.slice(0, 3))), [language, rtl]);
  const monthName = (m) => formatDateKey(calendarDateKey(year, m, 1, calendar), language, calendar, { month: 'short' });
  const Prev = rtl ? ChevronRight : ChevronLeft;
  const Next = rtl ? ChevronLeft : ChevronRight;

  // The grid at a given square size; with weekday names on the side when `withDays` (the shared picture only).
  const renderGrid = (st, fontSize, monthH, withDays) => {
    const cl = st - GAP;
    const xOf = (ci, span = 1) => (rtl ? cols - ci - span : ci) * st; // time runs right to left for Persian
    return (
      <View style={[s.row, rtl && s.rowReverse, { alignItems: 'flex-start' }]}>
        {withDays ? (
          <View style={{ width: LABEL_W, paddingTop: monthH }}>
            {dayNames.map((n, i) => (
              <View key={i} style={{ height: st, justifyContent: 'center' }}>
                <Text numberOfLines={1} style={{ color: c.ink, fontSize: fontSize, textAlign: rtl ? 'left' : 'right', paddingHorizontal: 4 }}>{n}</Text>
              </View>
            ))}
          </View>
        ) : null}
        <View>
          <View style={{ height: monthH, width: cols * st }}>
            {months.map((mo) => (
              <View key={mo.month} style={{ position: 'absolute', left: xOf(mo.col, mo.span), width: mo.span * st }}>
                <Text numberOfLines={1} style={{ color: c.muted, fontSize, lineHeight: monthH, textAlign: rtl ? 'right' : 'left' }}>{mo.span * st >= fontSize * 3 ? monthName(mo.month) : ''}</Text>
              </View>
            ))}
          </View>
          <View style={[s.row, rtl && s.rowReverse, { width: cols * st }]}>
            {weeks.map((week, ci) => (
              <View key={ci} style={{ width: st }}>
                {week.map((key, ri) => {
                  const mood = key ? dayMoods[key] : null;
                  const future = key ? key > today : false;
                  return (
                    <View
                      key={ri}
                      style={{
                        width: cl,
                        height: cl,
                        marginBottom: GAP,
                        borderRadius: Math.max(1.5, st / 8),
                        backgroundColor: !key ? 'transparent' : mood && PIXEL_COLORS[mood] ? PIXEL_COLORS[mood] : c.line,
                        opacity: future ? 0.35 : 1,
                      }}
                    />
                  );
                })}
              </View>
            ))}
          </View>
        </View>
      </View>
    );
  };

  const legend = (
    <View style={[s.legend, rtl && s.rowReverse]}>
      {MOOD_ORDER.map((m) => (
        <View key={m} style={[s.legendItem, rtl && s.rowReverse]}>
          <View style={{ width: 12, height: 12, borderRadius: 3, backgroundColor: PIXEL_COLORS[m] }} />
          <MoodFace mood={m} size={16} />
        </View>
      ))}
    </View>
  );
  const daysText = fmt(t.moodYearDays, { a: nf.format(recorded), year: nf.format(year) });

  const share = async () => {
    if (sharing) return;
    setSharing(true);
    try {
      const title = `Kitty Journal ${nf.format(year)}`;
      const file = await makeImageFile(shotRef.current, { title, dateKey: today, dialogTitle: title });
      await deliverFile(file, 'share', title);
    } catch (e) {
      console.warn('[kitty-journal] mood year share failed:', e);
      Dialog.alert(t.share, t.shareFailed);
    } finally {
      setSharing(false);
    }
  };

  const posterW = LABEL_W + cols * POSTER_STEP + 36;
  return (
    <Card title={t.moodYear} c={c} rtl={rtl}>
      <View style={[s.nav, rtl && s.rowReverse]}>
        <Pressable onPress={() => setYear(year - 1)} hitSlop={10} accessibilityRole="button" accessibilityLabel={t.previous || 'Previous'}>
          <Prev size={20} color={c.muted} />
        </Pressable>
        <Text style={{ color: c.ink, fontSize: 16, fontWeight: '700' }}>{nf.format(year)}</Text>
        <Pressable onPress={() => setYear(year + 1)} hitSlop={10} disabled={year >= nowYear} accessibilityRole="button" accessibilityLabel={t.next || 'Next'} style={{ opacity: year >= nowYear ? 0.3 : 1 }}>
          <Next size={20} color={c.muted} />
        </Pressable>
      </View>

      <View onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
        {step > 0 ? renderGrid(step, 8, 12, false) : null}
      </View>

      {legend}
      <Text style={{ color: c.muted, fontSize: 11, textAlign: rtl ? 'right' : 'left' }}>{daysText}</Text>
      <Button label={t.wrappedShare} onPress={share} c={c} rtl={rtl} variant="secondary" icon={Share2} busy={sharing} disabled={sharing} />

      {/* The picture that gets shared: bigger squares, weekday names, a title. Drawn off-screen, never touchable. */}
      <View pointerEvents="none" style={s.offscreen}>
        <View ref={shotRef} collapsable={false} style={{ width: posterW, backgroundColor: c.paper || c.card, padding: 18, gap: 12 }}>
          <View style={[s.row, rtl && s.rowReverse, { justifyContent: 'space-between' }]}>
            <Text style={{ color: c.ink, fontSize: 20, fontWeight: '800' }}>{t.moodYear}</Text>
            <Text style={{ color: c.ink, fontSize: 20, fontWeight: '800' }}>{nf.format(year)}</Text>
          </View>
          {renderGrid(POSTER_STEP, 11, 18, true)}
          {legend}
          <View style={[s.row, rtl && s.rowReverse, { justifyContent: 'space-between' }]}>
            <Text style={{ color: c.muted, fontSize: 11 }}>{daysText}</Text>
            <Text style={{ color: c.muted, fontSize: 11, fontWeight: '700' }}>Kitty Journal</Text>
          </View>
        </View>
      </View>
    </Card>
  );
}

const s = StyleSheet.create({
  nav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 4 },
  row: { flexDirection: 'row', alignItems: 'center' },
  rowReverse: { flexDirection: 'row-reverse' },
  legend: { flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center', paddingVertical: 4 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  offscreen: { position: 'absolute', left: -5000, top: 0 },
});
