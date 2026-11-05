import React, { useMemo, useState } from 'react';
import MoodFace from '../components/MoodFace';
import { StyleSheet, View } from 'react-native';
import { BookOpen, Star } from 'lucide-react-native';
import { ScrollView, Text } from '../ui';
import { Button, Card, Note, Segmented } from '../components/common';
import { usePremium } from '../premium';
import { MOODS } from '../theme';
import { EMOTIONS } from '../utils/emotions';
import { RANGE_PRESETS, computeInsights, rangeFor } from '../utils/insights';
import { calendarDateKey, formatDateKey, weekStartFor } from '../calendar';
import { fmt } from '../i18n';

const CHART_H = 84;

/** Vertical bars. items: [{ label, value }]; value null = nothing recorded (drawn as a faint dot). */
function Bars({ items, max, c, rtl, color, format }) {
  const top = Math.max(1, max);
  return (
    <View style={[s.bars, rtl && s.rowReverse]}>
      {items.map((it, i) => (
        <View key={i} style={s.barCol} accessible accessibilityLabel={`${it.label}: ${it.value == null ? '–' : format(it.value)}`}>
          <Text style={{ color: c.muted, fontSize: 9, minHeight: 12 }}>{it.value ? format(it.value) : ''}</Text>
          <View style={[s.barTrack, { backgroundColor: c.accentSoft }]}>
            {it.value == null || it.value === 0 ? (
              <View style={[s.dot, { backgroundColor: c.line }]} />
            ) : (
              <View style={[s.bar, { height: `${Math.max(6, (it.value / top) * 100)}%`, backgroundColor: color }]} />
            )}
          </View>
          <Text style={{ color: c.muted, fontSize: 10 }} numberOfLines={1}>{it.label}</Text>
        </View>
      ))}
    </View>
  );
}

/** Horizontal share rows (mood distribution, tags, emotions). */
function Rows({ rows, c, rtl, color }) {
  const maxCount = Math.max(1, ...rows.map((r) => r.count));
  return rows.map((r) => (
    <View key={r.key} style={[s.row, rtl && s.rowReverse]} accessible accessibilityLabel={`${r.label}: ${r.countText}`}>
      {r.mood ? <MoodFace mood={r.mood} size={20} style={{ marginHorizontal: 1 }} /> : <Text style={s.face}>{r.face || ''}</Text>}
      <Text style={{ color: c.muted, fontSize: 11, width: 74, textAlign: rtl ? 'right' : 'left' }} numberOfLines={1}>{r.label}</Text>
      <View style={[s.track, { backgroundColor: c.accentSoft }, rtl && { transform: [{ scaleX: -1 }] }]}>
        <View style={{ width: `${(r.count / maxCount) * 100}%`, height: '100%', borderRadius: 6, backgroundColor: color }} />
      </View>
      <Text style={{ color: c.ink, fontSize: 11, minWidth: 30, textAlign: 'center' }}>{r.countText}</Text>
    </View>
  ));
}

export default function InsightsScreen({ t, c, rtl, language, calendar, today, entries, dailyMoods, premium = true }) {
  const { openPremium } = usePremium();
  const [preset, setPreset] = useState('30d');
  const localeTag = language === 'fa' ? 'fa-IR' : language === 'tr' ? 'tr-TR' : 'en-US';
  const num = useMemo(() => {
    const f = new Intl.NumberFormat(localeTag);
    return (v) => f.format(v);
  }, [localeTag]);
  const align = rtl ? 'right' : 'left';

  // One mood per day: the Home "How are you feeling today?" choice wins; otherwise the mood picked in that
  // day's most recently edited entry is used. A day with no mood is missing data, never "neutral".
  const dayMoods = useMemo(() => {
    const out = { ...dailyMoods };
    const latest = {};
    for (const e of entries) {
      if (!e.mood || out[e.journal_date]) continue;
      const prev = latest[e.journal_date];
      if (!prev || String(e.updated_at) > String(prev.updated_at)) latest[e.journal_date] = e;
    }
    for (const [day, e] of Object.entries(latest)) out[day] = e.mood;
    return out;
  }, [entries, dailyMoods]);

  // Free: always the last 30 days, simple numbers and the mood summary.
  const shownPreset = premium ? preset : '30d';
  const range = useMemo(() => rangeFor(shownPreset, today), [shownPreset, today]);
  const data = useMemo(
    () => computeInsights({ entries, dailyMoods: dayMoods, range, today, calendar, weekStart: weekStartFor(language) }),
    [entries, dayMoods, range, today, calendar, language],
  );
  const { totals } = data;

  const weekdayName = (day) =>
    new Intl.DateTimeFormat(localeTag, { weekday: 'short', timeZone: 'UTC' }).format(new Date(Date.UTC(2023, 0, 1 + day)));
  const monthName = (m) =>
    formatDateKey(calendarDateKey(m.year, m.month, 1, calendar), language, calendar, { month: 'short' });

  const moodRows = data.mood.counts.map((m) => ({
    key: m.key,
    mood: m.key,
    label: t[m.key],
    count: m.count,
    countText: num(m.count),
  }));
  const weekMax = Math.max(1, ...data.weekdays.map((w) => w.count));
  const monthMax = Math.max(1, ...data.monthly.map((m) => m.count));
  const weeklyHasData = data.weeklyMood.some((w) => w.avg != null);

  const summary = [
    [num(totals.entries), t.entries],
    [fmt(t.writingDaysOf, { a: num(totals.writingDays), b: num(totals.rangeDays) }), t.writingDays],
    [num(totals.words), t.totalWords],
    [num(totals.avgWords), t.avgWords],
  ];

  return (
    <ScrollView contentContainerStyle={s.page}>
      <Text style={[s.title, { color: c.ink, textAlign: align }]}>{t.insights}</Text>

      {premium ? <Segmented
        c={c}
        rtl={rtl}
        value={preset}
        onChange={setPreset}
        options={RANGE_PRESETS.map((p) => ({ value: p, label: t[p === 'all' ? 'rangeAll' : `range${p}`] }))}
      /> : <Text style={{ color: c.muted, fontSize: 12, textAlign: align }}>{t.insightsFreeNote}</Text>}

      {totals.entries === 0 && entries.length === 0 ? <Note c={c} rtl={rtl}>{t.insightsEmpty}</Note> : null}

      <View style={[s.grid, rtl && s.rowReverse]}>
        {summary.map(([value, label], i) => (
          <View key={i} style={[s.stat, { backgroundColor: c.card, borderColor: c.line }]}>
            <Text style={[s.statNumber, { color: c.sageDark }]}>{value}</Text>
            <Text style={[s.statLabel, { color: c.muted }]}>{label}</Text>
          </View>
        ))}
      </View>
      <View style={[s.grid, rtl && s.rowReverse]}>
        <View style={[s.stat, { backgroundColor: c.card, borderColor: c.line }]}>
          <Star size={17} color={c.sageDark} />
          <Text style={[s.statNumber, { color: c.sageDark }]}>{num(totals.favorites)}</Text>
          <Text style={[s.statLabel, { color: c.muted }]}>{t.favorites}</Text>
        </View>
        <View style={[s.stat, { backgroundColor: c.card, borderColor: c.line }]}>
          <BookOpen size={17} color={c.sageDark} />
          <Text style={[s.statNumber, { color: c.sageDark }]}>{num(entries.length)}</Text>
          <Text style={[s.statLabel, { color: c.muted }]}>{t.rangeAll}</Text>
        </View>
      </View>

      {premium ? (
      <Card title={t.monthlyActivity} c={c} rtl={rtl}>
        <Bars items={data.monthly.map((m) => ({ label: monthName(m), value: m.count }))} max={monthMax} c={c} rtl={rtl} color={c.accent} format={num} />
      </Card>
      ) : null}

      {premium ? (
      <Card title={t.activeWeekdays} c={c} rtl={rtl}>
        {totals.entries === 0 ? (
          <Text style={{ color: c.muted, fontSize: 12, textAlign: align }}>{t.noData}</Text>
        ) : (
          <Bars items={data.weekdays.map((w) => ({ label: weekdayName(w.day), value: w.count }))} max={weekMax} c={c} rtl={rtl} color={c.accent} format={num} />
        )}
      </Card>
      ) : null}

      <Card title={t.moodDistribution} c={c} rtl={rtl}>
        {data.mood.recordedDays === 0 ? (
          <Text style={{ color: c.muted, fontSize: 12, textAlign: align }}>{t.noMoodData}</Text>
        ) : (
          <>
            <Rows rows={moodRows} c={c} rtl={rtl} color={c.accent} />
            <Text style={{ color: c.muted, fontSize: 11, textAlign: align }}>
              {fmt(t.daysRecorded, { a: num(data.mood.recordedDays), b: num(data.mood.rangeDays) })}
            </Text>
          </>
        )}
      </Card>

      {premium && weeklyHasData ? (
        <Card title={t.weeklyMood} c={c} rtl={rtl}>
          <Bars
            items={data.weeklyMood.map((w, i) => ({ label: i === 0 || i === data.weeklyMood.length - 1 ? formatDateKey(w.start, language, calendar, { month: 'short', day: 'numeric' }) : '', value: w.avg }))}
            max={5}
            c={c}
            rtl={rtl}
            color={c.sageDark}
            format={(v) => num(Math.round(v * 10) / 10)}
          />
          <Text style={{ color: c.muted, fontSize: 11, textAlign: align }}>{t.moodScaleHint}</Text>
        </Card>
      ) : null}

      {premium && data.topTags.length ? (
        <Card title={t.topTags} c={c} rtl={rtl}>
          <Rows rows={data.topTags.map((x) => ({ key: x.name, label: `#${x.name}`, count: x.count, countText: fmt(t.timesCount, { n: num(x.count) }) }))} c={c} rtl={rtl} color={c.accent} />
        </Card>
      ) : null}

      {premium && data.topEmotions.length ? (
        <Card title={t.topEmotions} c={c} rtl={rtl}>
          <Rows
            rows={data.topEmotions.map((x) => ({
              key: x.key,
              face: EMOTIONS.find((e) => e.key === x.key)?.face,
              label: t[`emotion_${x.key}`] || x.key,
              count: x.count,
              countText: fmt(t.timesCount, { n: num(x.count) }),
            }))}
            c={c}
            rtl={rtl}
            color={c.accent}
          />
          {data.topEmotions.some((x) => x.avgIntensity != null) ? (
            <Text style={{ color: c.muted, fontSize: 11, textAlign: align }}>
              {data.topEmotions.filter((x) => x.avgIntensity != null).map((x) => `${t[`emotion_${x.key}`] || x.key}: ${fmt(t.averageStrength, { n: num(x.avgIntensity) })}`).join(' · ')}
            </Text>
          ) : null}
        </Card>
      ) : null}

      {!premium ? (
        <Card title={t.insightsLockedTitle} c={c} rtl={rtl}>
          <Text style={{ color: c.muted, fontSize: 13, lineHeight: 20, textAlign: align }}>{t.insightsLockedBody}</Text>
          <Button label={t.premiumSee} onPress={openPremium} c={c} rtl={rtl} variant="primary" />
        </Card>
      ) : null}

      <Note c={c} rtl={rtl}>{t.insightsNote}</Note>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  page: { paddingTop: 25, paddingBottom: 22, gap: 14 },
  eyebrow: { fontSize: 11, fontWeight: '700', letterSpacing: 1.4, textTransform: 'uppercase' },
  title: { fontSize: 28, fontWeight: '600' },
  grid: { flexDirection: 'row', gap: 10 },
  rowReverse: { flexDirection: 'row-reverse' },
  stat: { flex: 1, borderWidth: 1, borderRadius: 18, paddingVertical: 14, paddingHorizontal: 10, alignItems: 'center', gap: 4 },
  statNumber: { fontSize: 18, fontWeight: '700', textAlign: 'center' },
  statLabel: { fontSize: 10, textAlign: 'center' },
  bars: { flexDirection: 'row', gap: 6, alignItems: 'flex-end' },
  barCol: { flex: 1, alignItems: 'center', gap: 4 },
  barTrack: { width: '100%', height: CHART_H, borderRadius: 8, justifyContent: 'flex-end', alignItems: 'center', overflow: 'hidden' },
  bar: { width: '100%', borderRadius: 8 },
  dot: { width: 6, height: 6, borderRadius: 3, marginBottom: 4 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 26 },
  face: { fontSize: 15, width: 22, textAlign: 'center' },
  track: { flex: 1, height: 12, borderRadius: 6, overflow: 'hidden' },
});
