// The extra Premium cards of the Statistics page: comparison, mood factors, writing rhythm, places
// and the shareable picture. Every figure comes from src/utils/insightsPlus.js.
import React, { useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Download, Share2 } from 'lucide-react-native';
import { Text } from '../ui';
import { Button, Card } from './common';
import MoodFace from './MoodFace';
import CatImage from './CatImage';
import { Dialog } from '../platform/dialog';
import { deliverFile, makeImageFile } from '../platform/exportEntry';
import { formatDateKey } from '../calendar';
import { fmt } from '../i18n';
import { nearestMood } from '../utils/insightsPlus';

const POSTER_CAT = require('../../assets/images/stats-cat.png'); // a cream rounded square with its own background
const MOOD_ORDER = ['veryLow', 'low', 'okay', 'good', 'great'];
const round1 = (v) => Math.round(v * 10) / 10;
const sign = (v) => (v > 0 ? '+' : v < 0 ? '−' : '');

/** Small vertical bars (the 8 time-of-day slots). */
function MiniBars({ items, c, rtl, color, num }) {
  const max = Math.max(1, ...items.map((i) => i.value));
  return (
    <View style={[s.bars, rtl && s.rowReverse]}>
      {items.map((it, i) => (
        <View key={i} style={s.barCol} accessible accessibilityLabel={`${it.label}: ${num(it.value)}`}>
          <Text style={{ color: c.muted, fontSize: 9, minHeight: 12 }}>{it.value ? num(it.value) : ''}</Text>
          <View style={[s.barTrack, { backgroundColor: c.accentSoft }]}>
            {it.value === 0 ? (
              <View style={[s.dot, { backgroundColor: c.line }]} />
            ) : (
              <View style={{ width: '100%', borderRadius: 8, height: `${Math.max(6, (it.value / max) * 100)}%`, backgroundColor: it.peak ? c.sageDark : color }} />
            )}
          </View>
          <Text style={{ color: c.muted, fontSize: 10 }} numberOfLines={1}>{it.label}</Text>
        </View>
      ))}
    </View>
  );
}

function KV({ label, value, c, rtl }) {
  return (
    <View style={[s.kv, rtl && s.rowReverse]}>
      <Text style={{ color: c.muted, fontSize: 12, flex: 1, textAlign: rtl ? 'right' : 'left' }}>{label}</Text>
      <Text style={{ color: c.ink, fontSize: 13, fontWeight: '700' }}>{value}</Text>
    </View>
  );
}

/** One bar of the comparison: a small caption, the bar, the number. */
function CmpBar({ caption, value, max, color, c, rtl, text }) {
  return (
    <View style={[s.cmpBarRow, rtl && s.rowReverse]}>
      <Text numberOfLines={1} style={{ color: c.muted, fontSize: 11, width: 78, textAlign: rtl ? 'right' : 'left' }}>{caption}</Text>
      <View style={[s.cmpTrack, { backgroundColor: c.card }, rtl && { transform: [{ scaleX: -1 }] }]}>
        <View style={{ width: `${value == null ? 0 : Math.max(value > 0 ? 4 : 0, (value / max) * 100)}%`, height: '100%', borderRadius: 7, backgroundColor: color }} />
      </View>
      <Text style={{ color: c.ink, fontSize: 13, fontWeight: '700', minWidth: 34, textAlign: 'center' }}>{text}</Text>
    </View>
  );
}

/**
 * This period against the one right before it, in plain words: both date ranges, then for each figure two bars
 * (now and before) and one sentence that says what changed.
 */
export function CompareCard({ t, c, rtl, num, language, calendar, cmp }) {
  if (!cmp) return null;
  const { cur, prev, days } = cmp;
  const nowColor = c.accent;
  const beforeColor = c.muted;
  const day = (key) => formatDateKey(key, language, calendar, { month: 'short', day: 'numeric' });
  const metrics = [
    { key: 'entries', label: t.entries, cur: cur.entries, prev: prev.entries, kind: 'count' },
    { key: 'days', label: t.writingDays, cur: cur.writingDays, prev: prev.writingDays, kind: 'count' },
    { key: 'mood', label: t.ipAvgMood, cur: cur.mood == null ? null : round1(cur.mood), prev: prev.mood == null ? null : round1(prev.mood), kind: 'mood' },
  ];
  const sentence = (m) => {
    if (m.kind === 'mood') {
      if (m.cur == null || m.prev == null) return { text: t.ipNoMoodCompare, dir: 0 };
      const d = m.cur - m.prev;
      if (d >= 0.2) return { text: t.ipMoodUp, dir: 1 };
      if (d <= -0.2) return { text: t.ipMoodDown, dir: -1 };
      return { text: t.ipMoodSame, dir: 0 };
    }
    const d = m.cur - m.prev;
    if (d > 0) return { text: fmt(t.ipMore, { n: num(d) }), dir: 1 };
    if (d < 0) return { text: fmt(t.ipLess, { n: num(-d) }), dir: -1 };
    return { text: t.ipSame, dir: 0 };
  };
  const dot = (color) => <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: color }} />;
  return (
    <Card title={t.ipCompareTitle} c={c} rtl={rtl}>
      <Text style={{ color: c.muted, fontSize: 12, lineHeight: 18, textAlign: rtl ? 'right' : 'left' }}>{fmt(t.ipCompareHint, { n: num(days) })}</Text>
      <View style={[s.cmpLegend, rtl && s.rowReverse]}>
        <View style={[s.cmpLegendItem, rtl && s.rowReverse]}>
          {dot(nowColor)}
          <Text style={{ color: c.ink, fontSize: 11, fontWeight: '700' }}>{t.ipNow}</Text>
          <Text style={{ color: c.muted, fontSize: 11 }}>{fmt(t.ipDates, { a: day(cmp.curFrom), b: day(cmp.curTo) })}</Text>
        </View>
        <View style={[s.cmpLegendItem, rtl && s.rowReverse]}>
          {dot(beforeColor)}
          <Text style={{ color: c.ink, fontSize: 11, fontWeight: '700' }}>{t.ipPrev}</Text>
          <Text style={{ color: c.muted, fontSize: 11 }}>{fmt(t.ipDates, { a: day(cmp.prevFrom), b: day(cmp.prevTo) })}</Text>
        </View>
      </View>
      {metrics.map((m) => {
        const max = m.kind === 'mood' ? 5 : Math.max(m.cur, m.prev, 1);
        const sn = sentence(m);
        const chipBg = sn.dir > 0 ? c.sage : c.accentSoft;
        const chipInk = sn.dir > 0 ? c.sageDark : c.muted;
        const arrow = sn.dir > 0 ? '↑' : sn.dir < 0 ? '↓' : '＝';
        return (
          <View key={m.key} style={[s.cmpBlock, { backgroundColor: c.accentSoft, borderColor: c.line }]}>
            <Text style={{ color: c.ink, fontSize: 14, fontWeight: '800', textAlign: rtl ? 'right' : 'left' }}>{m.label}</Text>
            <CmpBar caption={t.ipNow} value={m.cur} max={max} color={nowColor} c={c} rtl={rtl} text={m.cur == null ? '–' : num(m.cur)} />
            <CmpBar caption={t.ipPrev} value={m.prev} max={max} color={beforeColor} c={c} rtl={rtl} text={m.prev == null ? '–' : num(m.prev)} />
            <View style={[s.cmpChip, { backgroundColor: chipBg }, rtl && s.rowReverse]}>
              <Text style={{ color: chipInk, fontSize: 13, fontWeight: '800' }}>{m.kind === 'mood' && sn.dir === 0 && (m.cur == null || m.prev == null) ? '' : arrow}</Text>
              <Text style={{ color: chipInk, fontSize: 12, fontWeight: '600', flexShrink: 1, textAlign: rtl ? 'right' : 'left' }}>{sn.text}</Text>
            </View>
          </View>
        );
      })}
    </Card>
  );
}

/** Tags, places and weekdays that go with a higher or lower mood. */
export function FactorsCard({ t, c, rtl, num, factors, weekdayLong }) {
  if (!factors) return null;
  const { higher, lower, recorded } = factors;
  const maxAbs = Math.max(0.3, ...higher.map((f) => Math.abs(f.diff)), ...lower.map((f) => Math.abs(f.diff)));
  const label = (f) => (f.type === 'tag' ? `#${f.key}` : f.type === 'place' ? `📍 ${f.key}` : weekdayLong(Number(f.key)));
  const group = (title, list, color) =>
    list.length ? (
      <View style={{ gap: 6 }}>
        <Text style={{ color: c.muted, fontSize: 11, fontWeight: '700', textAlign: rtl ? 'right' : 'left' }}>{title}</Text>
        {list.map((f) => (
          <View key={`${f.type}:${f.key}`} style={[s.fRow, rtl && s.rowReverse]} accessible accessibilityLabel={`${label(f)}: ${sign(f.diff)}${num(round1(Math.abs(f.diff)))}`}>
            <View style={{ width: 104 }}>
              <Text numberOfLines={1} style={{ color: c.ink, fontSize: 12, fontWeight: '600', textAlign: rtl ? 'right' : 'left' }}>{label(f)}</Text>
              <Text style={{ color: c.muted, fontSize: 10, textAlign: rtl ? 'right' : 'left' }}>{fmt(t.ipDaysN, { n: num(f.n) })}</Text>
            </View>
            <View style={[s.fTrack, { backgroundColor: c.accentSoft }, rtl && { transform: [{ scaleX: -1 }] }]}>
              <View style={{ width: `${Math.max(8, (Math.abs(f.diff) / maxAbs) * 100)}%`, height: '100%', borderRadius: 6, backgroundColor: color }} />
            </View>
            <Text style={{ color: c.ink, fontSize: 12, fontWeight: '700', minWidth: 40, textAlign: 'center' }}>{`${sign(f.diff)}${num(round1(Math.abs(f.diff)))}`}</Text>
          </View>
        ))}
      </View>
    ) : null;
  return (
    <Card title={t.ipFactorsTitle} c={c} rtl={rtl}>
      {higher.length || lower.length ? (
        <>
          {group(t.ipHigher, higher, c.accent)}
          {group(t.ipLower, lower, c.muted)}
        </>
      ) : (
        <Text style={{ color: c.muted, fontSize: 12, textAlign: rtl ? 'right' : 'left' }}>{recorded < 8 ? t.ipFactorsNeed : t.ipFactorsNone}</Text>
      )}
      <Text style={{ color: c.muted, fontSize: 11, lineHeight: 17, textAlign: rtl ? 'right' : 'left' }}>{t.ipFactorsHint}</Text>
    </Card>
  );
}

/** Time of day plus runs of writing days and word figures. */
export function RhythmCard({ t, c, rtl, num, hours, runs, words }) {
  const slotLabel = (i) => `${num(i * 3)}–${num(i * 3 + 3)}`;
  return (
    <Card title={t.ipRhythmTitle} c={c} rtl={rtl}>
      {hours.total > 0 ? (
        <>
          <Text style={{ color: c.muted, fontSize: 11, textAlign: rtl ? 'right' : 'left' }}>{t.ipTimeOfDay}</Text>
          <MiniBars items={hours.slots.map((v, i) => ({ label: num(i * 3), value: v, peak: i === hours.peak }))} c={c} rtl={rtl} color={c.accent} num={num} />
          {hours.peak >= 0 ? <Text style={{ color: c.ink, fontSize: 12, textAlign: rtl ? 'right' : 'left' }}>{fmt(t.ipPeak, { slot: slotLabel(hours.peak) })}</Text> : null}
        </>
      ) : null}
      <KV c={c} rtl={rtl} label={t.ipLongestRun} value={fmt(t.ipDaysN, { n: num(runs.longest) })} />
      <KV c={c} rtl={rtl} label={t.ipCurrentRun} value={fmt(t.ipDaysN, { n: num(runs.current) })} />
      <KV c={c} rtl={rtl} label={t.ipLongestEntry} value={fmt(t.ipWordsUnit, { n: num(words.longest) })} />
      <KV c={c} rtl={rtl} label={t.ipPerWritingDay} value={num(words.perDay)} />
    </Card>
  );
}

/** Places of the entries with their count and the average mood of those days. */
export function PlacesCard({ t, c, rtl, num, places }) {
  if (!places || !places.length) return null;
  return (
    <Card title={t.ipPlacesTitle} c={c} rtl={rtl}>
      <Text style={{ color: c.muted, fontSize: 11, textAlign: rtl ? 'right' : 'left' }}>{t.ipPlacesHint}</Text>
      {places.map((p) => (
        <View key={p.name} style={[s.pRow, rtl && s.rowReverse]} accessible accessibilityLabel={`${p.name}: ${fmt(t.timesCount, { n: num(p.count) })}`}>
          {p.avg != null ? <MoodFace mood={nearestMood(p.avg)} size={24} /> : <View style={{ width: 24 }} />}
          <Text numberOfLines={1} style={{ color: c.ink, fontSize: 13, fontWeight: '600', flex: 1, textAlign: rtl ? 'right' : 'left' }}>{p.name}</Text>
          <Text style={{ color: c.muted, fontSize: 11 }}>{fmt(t.timesCount, { n: num(p.count) })}</Text>
          {p.avg != null ? <Text style={{ color: c.sageDark, fontSize: 12, fontWeight: '700', minWidth: 28, textAlign: 'center' }}>{num(p.avg)}</Text> : null}
        </View>
      ))}
    </Card>
  );
}

function PosterTile({ value, label, c }) {
  return (
    <View style={[s.tile, { backgroundColor: c.accentSoft }]}>
      <Text numberOfLines={1} adjustsFontSizeToFit style={{ color: c.sageDark, fontSize: 20, fontWeight: '800' }}>{value}</Text>
      <Text numberOfLines={2} style={{ color: c.muted, fontSize: 10, textAlign: 'center', lineHeight: 13 }}>{label}</Text>
    </View>
  );
}

/** A picture of this period's numbers, drawn off-screen, captured and shared / saved like the Wrapped card. */
export function ShareStatsCard({ t, c, rtl, num, today, rangeLabel, totals, moodCounts, avg, longestRun, topTag, topPlace }) {
  const shotRef = useRef(null);
  const [busy, setBusy] = useState('');
  const title = `Kitty Journal · ${rangeLabel}`;
  const send = async (how) => {
    if (busy) return;
    setBusy(how);
    try {
      const file = await makeImageFile(shotRef.current, { title, dateKey: today, dialogTitle: title });
      const r = await deliverFile(file, how, title);
      if (r && r.done && how === 'save') Dialog.alert(t.share, t.savedToDevice);
    } catch (e) {
      console.warn('[kitty-journal] statistics share failed:', e);
      Dialog.alert(t.share, t.shareFailed);
    } finally {
      setBusy('');
    }
  };
  const maxMood = Math.max(1, ...moodCounts.map((m) => m.count));
  const ink = c.onAccent || '#FFFFFF';
  return (
    <Card title={t.ipShareTitle} c={c} rtl={rtl}>
      <Text style={{ color: c.muted, fontSize: 12, textAlign: rtl ? 'right' : 'left' }}>{t.ipShareHint}</Text>
      <View style={[s.actions, rtl && s.rowReverse]}>
        <View style={{ flex: 1 }}>
          <Button label={t.wrappedShare} onPress={() => send('share')} c={c} rtl={rtl} variant="primary" icon={Share2} busy={busy === 'share'} disabled={Boolean(busy)} />
        </View>
        <View style={{ flex: 1 }}>
          <Button label={t.wrappedSave} onPress={() => send('save')} c={c} rtl={rtl} icon={Download} busy={busy === 'save'} disabled={Boolean(busy)} />
        </View>
      </View>

      <View pointerEvents="none" style={s.offscreen}>
        <View ref={shotRef} collapsable={false} style={[s.poster, { backgroundColor: c.paper || c.card, borderColor: c.line }]}>
          <View style={[s.posterHero, { backgroundColor: c.accent }]}>
            <Text style={{ color: ink, opacity: 0.85, fontSize: 11, fontWeight: '700', letterSpacing: 2 }}>KITTY JOURNAL</Text>
            <Text numberOfLines={1} adjustsFontSizeToFit style={{ color: ink, fontSize: 24, fontWeight: '800', marginTop: 2 }}>{t.ipPosterTitle}</Text>
            <Text style={{ color: ink, opacity: 0.9, fontSize: 12, marginTop: 2 }}>{rangeLabel}</Text>
            <CatImage source={POSTER_CAT} width={120} style={{ marginTop: 6 }} />
          </View>
          <View style={{ alignItems: 'center' }}>
            <Text style={{ color: c.accent, fontSize: 54, fontWeight: '800', lineHeight: 60 }}>{num(totals.entries)}</Text>
            <Text style={{ color: c.muted, fontSize: 13 }}>{t.entries}</Text>
          </View>
          <View style={[s.tiles, rtl && s.rowReverse]}>
            <PosterTile c={c} value={num(totals.writingDays)} label={t.writingDays} />
            <PosterTile c={c} value={num(totals.words)} label={t.totalWords} />
            <PosterTile c={c} value={num(longestRun)} label={t.ipTileLongestRun} />
          </View>
          <View style={[s.posterPanel, { backgroundColor: c.accentSoft }]}>
            {MOOD_ORDER.map((k) => {
              const m = moodCounts.find((x) => x.key === k) || { count: 0 };
              return (
                <View key={k} style={[s.mRow, rtl && s.rowReverse]}>
                  <MoodFace mood={k} size={20} />
                  <View style={[s.mTrack, { backgroundColor: c.card }, rtl && { transform: [{ scaleX: -1 }] }]}>
                    <View style={{ width: `${(m.count / maxMood) * 100}%`, height: '100%', borderRadius: 5, backgroundColor: c.accent }} />
                  </View>
                  <Text style={{ color: c.ink, fontSize: 11, minWidth: 24, textAlign: 'center' }}>{num(m.count)}</Text>
                </View>
              );
            })}
            {avg != null ? (
              <View style={[s.mRow, rtl && s.rowReverse, { justifyContent: 'center', marginTop: 4 }]}>
                <MoodFace mood={nearestMood(avg)} size={26} />
                <Text style={{ color: c.ink, fontSize: 13, fontWeight: '700' }}>{t.ipAvgMood}: {num(round1(avg))}</Text>
              </View>
            ) : null}
          </View>
          {topTag || topPlace ? (
            <View style={[s.chips, rtl && s.rowReverse]}>
              {topTag ? (
                <View style={[s.chip, { backgroundColor: c.sage }]}><Text style={{ color: c.sageDark, fontSize: 12, fontWeight: '700' }}>#{topTag}</Text></View>
              ) : null}
              {topPlace ? (
                <View style={[s.chip, { backgroundColor: c.sage }]}><Text style={{ color: c.sageDark, fontSize: 12, fontWeight: '700' }}>📍 {topPlace}</Text></View>
              ) : null}
            </View>
          ) : null}
          <Text style={{ color: c.muted, fontSize: 10, textAlign: 'center' }}>🐾 Kitty Journal 🐾</Text>
        </View>
      </View>
    </Card>
  );
}

const s = StyleSheet.create({
  rowReverse: { flexDirection: 'row-reverse' },
  bars: { flexDirection: 'row', gap: 6, alignItems: 'flex-end' },
  barCol: { flex: 1, alignItems: 'center', gap: 4 },
  barTrack: { width: '100%', height: 84, borderRadius: 8, justifyContent: 'flex-end', alignItems: 'center', overflow: 'hidden' },
  dot: { width: 6, height: 6, borderRadius: 3, marginBottom: 4 },
  kv: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 26 },
  cmpLegend: { gap: 4 },
  cmpLegendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  cmpBlock: { borderWidth: 1, borderRadius: 16, padding: 12, gap: 7 },
  cmpBarRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  cmpTrack: { flex: 1, height: 14, borderRadius: 7, overflow: 'hidden' },
  cmpChip: { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 12, paddingVertical: 6, paddingHorizontal: 10, alignSelf: 'stretch', marginTop: 2 },
  fRow: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 34 },
  fTrack: { flex: 1, height: 12, borderRadius: 6, overflow: 'hidden' },
  pRow: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 32 },
  actions: { flexDirection: 'row', gap: 10 },
  offscreen: { position: 'absolute', left: -5000, top: 0 },
  poster: { width: 340, borderWidth: 1, borderRadius: 26, overflow: 'hidden', paddingBottom: 16, gap: 12 },
  posterHero: { paddingTop: 16, paddingBottom: 6, alignItems: 'center' },
  tiles: { flexDirection: 'row', gap: 8, paddingHorizontal: 16 },
  tile: { flex: 1, borderRadius: 14, paddingVertical: 10, paddingHorizontal: 6, alignItems: 'center', justifyContent: 'center', gap: 2, minHeight: 68 },
  posterPanel: { marginHorizontal: 16, borderRadius: 16, paddingHorizontal: 14, paddingVertical: 10, gap: 4 },
  mRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  mTrack: { flex: 1, height: 10, borderRadius: 5, overflow: 'hidden' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 8, paddingHorizontal: 16 },
  chip: { borderRadius: 99, paddingVertical: 6, paddingHorizontal: 14 },
});
