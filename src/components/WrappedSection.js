import React, { useMemo, useRef, useState } from 'react';
import { Image, Pressable, StyleSheet, View } from 'react-native';
import { Check, ChevronLeft, ChevronRight, Download, FileText, Share2 } from 'lucide-react-native';
import { Text } from '../ui';
import { Button, Card } from './common';
import MoodFace from './MoodFace';
import { useSQLiteContext } from 'expo-sqlite';
import { Dialog } from '../platform/dialog';
import { deliverFile, makeImageFile, makePdfFile, photoDataUris } from '../platform/exportEntry';
import { listEntryAttachments } from '../db/repository';
import { MOOD_IMAGES } from '../../assets/images/moodImages';
import { buildBookHtml, TEMPLATES } from '../utils/entryPdf';
import { entryToEditorHtml } from '../utils/richText';
import { fontKeysIn, webFontCss } from '../toolbarFonts';
import { calendarDateKey, formatCalendarMonth, formatDateKey, getCalendarParts } from '../calendar';
import { computeWrapped, periodRange } from '../utils/wrapped';
import { fmt } from '../i18n';

const CAT = require('../../assets/images/home-cat.png'); // 560 x 337

/** One small number tile of the card. */
function Tile({ value, label, c }) {
  return (
    <View style={[s.tile, { backgroundColor: c.accentSoft }]}>
      <Text numberOfLines={1} adjustsFontSizeToFit style={{ color: c.sageDark, fontSize: 20, fontWeight: '800' }}>{value}</Text>
      <Text numberOfLines={2} style={{ color: c.muted, fontSize: 10, textAlign: 'center', lineHeight: 13 }}>{label}</Text>
    </View>
  );
}

/** A "highlight" row: a picture on one side, a small label and a bold value on the other. */
function Highlight({ icon, label, value, c, rtl }) {
  return (
    <View style={[s.hl, rtl && s.rowReverse]}>
      <View style={s.hlIcon}>{icon}</View>
      <View style={{ flex: 1 }}>
        <Text style={{ color: c.muted, fontSize: 11, textAlign: rtl ? 'right' : 'left' }}>{label}</Text>
        <Text numberOfLines={1} style={{ color: c.ink, fontSize: 15, fontWeight: '700', textAlign: rtl ? 'right' : 'left' }}>{value}</Text>
      </View>
    </View>
  );
}

/** The shareable poster. Everything is plain views so it can be captured as a picture. */
function WrappedCard({ t, c, rtl, language, calendar, stats, title, nf }) {
  const ink = c.onAccent || '#FFFFFF';
  return (
    <View style={[s.card, { backgroundColor: c.card, borderColor: c.line }]}>
      <View style={[s.hero, { backgroundColor: c.accent }]}>
        <Text style={{ color: ink, opacity: 0.85, fontSize: 11, fontWeight: '700', letterSpacing: 2 }}>KITTY JOURNAL</Text>
        <Text numberOfLines={1} adjustsFontSizeToFit style={{ color: ink, fontSize: 30, fontWeight: '800', marginTop: 2 }}>{title}</Text>
        <Image source={CAT} style={s.cat} resizeMode="contain" />
      </View>

      <View style={s.bigWrap}>
        <Text style={{ color: c.accent, fontSize: 60, fontWeight: '800', lineHeight: 66 }}>{nf.format(stats.entries)}</Text>
        <Text style={{ color: c.muted, fontSize: 14, marginTop: -2 }}>{t.entries}</Text>
      </View>

      <View style={[s.tiles, rtl && s.rowReverse]}>
        <Tile c={c} value={nf.format(stats.writingDays)} label={t.writingDays} />
        <Tile c={c} value={nf.format(stats.words)} label={t.totalWords} />
        <Tile c={c} value={nf.format(stats.longestStreak)} label={t.wrappedStreak} />
      </View>

      {stats.topMood || stats.bestDay ? (
        <View style={[s.panel, { backgroundColor: c.accentSoft }]}>
          {stats.topMood ? (
            <Highlight
              c={c}
              rtl={rtl}
              icon={<MoodFace mood={stats.topMood.key} size={38} />}
              label={t.wrappedTopMood}
              value={`${t[stats.topMood.key]} · ${fmt(t.wrappedDays, { n: nf.format(stats.topMood.count) })}`}
            />
          ) : null}
          {stats.topMood && stats.bestDay ? <View style={{ height: 1, backgroundColor: c.line }} /> : null}
          {stats.bestDay ? (
            <Highlight
              c={c}
              rtl={rtl}
              icon={stats.bestDay.mood ? <MoodFace mood={stats.bestDay.mood} size={38} /> : <Text style={{ fontSize: 30 }}>🌟</Text>}
              label={t.wrappedBestDay}
              value={formatDateKey(stats.bestDay.day, language, calendar, { day: 'numeric', month: 'long' })}
            />
          ) : null}
        </View>
      ) : null}

      {stats.topTag ? (
        <View style={[s.tag, { backgroundColor: c.sage }]}>
          <Text style={{ color: c.sageDark, fontSize: 13, fontWeight: '700' }}>#{stats.topTag.name}</Text>
        </View>
      ) : null}
      <Text style={{ color: c.muted, fontSize: 10, textAlign: 'center', marginTop: 4 }}>🐾 Kitty Journal 🐾</Text>
    </View>
  );
}

/** A tiny page mock-up in the template's colours: this is what the user picks for the PDF. */
function StyleTile({ x, on, onPress, c, label }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: on }}
      accessibilityLabel={label}
      style={s.styleCell}
    >
      <View style={[s.page, { backgroundColor: x.swatch[0], borderColor: on ? c.sageDark : c.line, borderWidth: on ? 2.5 : 1 }]}>
        <View style={{ height: 5, width: '55%', borderRadius: 3, backgroundColor: x.swatch[1] }} />
        <View style={{ height: 3, width: '85%', borderRadius: 2, backgroundColor: x.swatch[1], opacity: 0.35, marginTop: 7 }} />
        <View style={{ height: 3, width: '70%', borderRadius: 2, backgroundColor: x.swatch[1], opacity: 0.35, marginTop: 4 }} />
        <View style={{ height: 3, width: '78%', borderRadius: 2, backgroundColor: x.swatch[1], opacity: 0.35, marginTop: 4 }} />
        {on ? (
          <View style={[s.check, { backgroundColor: c.sageDark }]}>
            <Check size={11} color={c.onAccent || '#FFFFFF'} />
          </View>
        ) : null}
      </View>
      <Text numberOfLines={1} style={{ color: on ? c.sageDark : c.muted, fontSize: 10.5, fontWeight: on ? '700' : '500', marginTop: 5 }}>{label}</Text>
    </Pressable>
  );
}

/**
 * Month / year review: period picker, a shareable poster, and the PDF book with a choice of styles.
 * Plus feature: the caller shows a lock instead when not premium.
 */
export default function WrappedSection({ t, c, rtl, language, calendar, today, entries, dayMoods }) {
  const localeTag = language === 'fa' ? 'fa-IR' : language === 'tr' ? 'tr-TR' : 'en-US';
  const nf = useMemo(() => new Intl.NumberFormat(localeTag, { useGrouping: false }), [localeTag]);
  const nfGroup = useMemo(() => new Intl.NumberFormat(localeTag), [localeTag]);
  const now = getCalendarParts(today, calendar);
  // One selection: a year plus either a month (1-12) or 'year' for the whole year. Opens on the current month.
  const [year, setYear] = useState(now.year);
  const [sel, setSel] = useState(now.month);
  const db = useSQLiteContext();
  const shotRef = useRef(null);
  const [busy, setBusy] = useState(''); // '' | 'img:share' | 'img:save' | 'pdf:share' | 'pdf:save'
  const [tpl, setTpl] = useState('kitty');

  const mode = sel === 'year' ? 'year' : 'month';
  const range = mode === 'month' ? periodRange(year, sel, calendar) : periodRange(year, null, calendar);
  // Which months of the shown year have entries (they get a dot in the picker).
  const monthHas = useMemo(() => {
    const has = {};
    for (let m = 1; m <= 12; m += 1) {
      const r = periodRange(year, m, calendar);
      has[m] = entries.some((e) => e.journal_date >= r.from && e.journal_date <= r.to);
    }
    return has;
  }, [entries, year, calendar]);
  const isFuture = (m) => year > now.year || (year === now.year && m > now.month);
  const monthLabel = (m) => formatDateKey(calendarDateKey(year, m, 1, calendar), language, calendar, { month: 'long' });
  const changeYear = (dir) => {
    const next = year + dir;
    if (next > now.year) return;
    setYear(next);
    if (sel !== 'year' && next === now.year && sel > now.month) setSel('year'); // that month has not happened yet
  };
  const stats = useMemo(() => computeWrapped({ entries, dayMoods, from: range.from, to: range.to }), [entries, dayMoods, range.from, range.to]);
  const title = mode === 'month' ? formatCalendarMonth(year, sel, language, calendar) : nf.format(year);
  const Prev = rtl ? ChevronRight : ChevronLeft;
  const Next = rtl ? ChevronLeft : ChevronRight;
  const info = { title: `Kitty Journal ${title}`, dateKey: today, dialogTitle: `Kitty Journal ${title}` };

  const finish = async (file, how) => {
    const r = await deliverFile(file, how, info.dialogTitle);
    if (r && r.done && how === 'save') Dialog.alert(t.share, t.savedToDevice);
  };
  const run = async (key, work) => {
    if (busy) return;
    setBusy(key);
    try {
      await work();
    } catch (e) {
      console.warn('[kitty-journal] wrapped export failed:', e);
      Dialog.alert(t.share, t.shareFailed);
    } finally {
      setBusy('');
    }
  };

  const sendImage = (how) => run(`img:${how}`, async () => finish(await makeImageFile(shotRef.current, info), how));

  // The period as one PDF book in the chosen style: every entry on its own page.
  const sendBook = (how) =>
    run(`pdf:${how}`, async () => {
      const month = entries
        .filter((e) => e.journal_date >= range.from && e.journal_date <= range.to)
        .sort((x, y) => String(x.journal_date).localeCompare(String(y.journal_date)) || String(x.created_at || '').localeCompare(String(y.created_at || '')));
      const items = [];
      for (const entry of month) {
        const rows = await listEntryAttachments(db, entry.id).catch(() => []);
        const photos = await photoDataUris(rows.slice(0, 2).map((p) => p.file_name)).catch(() => []);
        items.push({
          entry,
          bodyHtml: entryToEditorHtml(entry),
          dateText: formatDateKey(entry.journal_date, language, calendar, { dateStyle: 'full' }),
          photos,
          moodFace: entry.mood ? MOOD_IMAGES[entry.mood] || '' : '',
        });
      }
      const fontFaces = await webFontCss(fontKeysIn(items.map((i) => i.bodyHtml).join(''))).catch(() => '');
      const doc = buildBookHtml({
        title,
        subtitle: fmt(t.bookEntries, { n: nfGroup.format(items.length) }),
        items, rtl, footer: 'Kitty Journal', fontFaces, template: tpl,
        stats: [
          [t.writingDays, nfGroup.format(stats.writingDays)],
          [t.totalWords, nfGroup.format(stats.words)],
          [t.wrappedStreak, nfGroup.format(stats.longestStreak)],
        ],
      });
      await finish(await makePdfFile(doc, info), how);
    });

  const align = rtl ? 'right' : 'left';
  return (
    <View style={s.root}>
      {/* 1. Which period: pick the year, then the whole year or one month */}
      <View style={[s.picker, { backgroundColor: c.card, borderColor: c.line }]}>
        <View style={[s.nav, rtl && s.rowReverse]}>
          <Pressable onPress={() => changeYear(-1)} hitSlop={8} accessibilityRole="button" style={[s.navBtn, { backgroundColor: c.paper || c.bg, borderColor: c.line }]}>
            <Prev size={20} color={c.ink} />
          </Pressable>
          <Text style={{ color: c.ink, fontSize: 22, fontWeight: '800', flex: 1, textAlign: 'center' }}>{nf.format(year)}</Text>
          <Pressable
            onPress={() => changeYear(1)}
            hitSlop={8}
            disabled={year >= now.year}
            accessibilityRole="button"
            style={[s.navBtn, { backgroundColor: c.paper || c.bg, borderColor: c.line, opacity: year >= now.year ? 0.35 : 1 }]}
          >
            <Next size={20} color={c.ink} />
          </Pressable>
        </View>
        <Pressable
          onPress={() => setSel('year')}
          accessibilityRole="button"
          accessibilityState={{ selected: sel === 'year' }}
          style={[s.yearChip, { backgroundColor: sel === 'year' ? c.accent : c.paper || c.bg, borderColor: sel === 'year' ? c.accent : c.line }]}
        >
          <Text style={{ color: sel === 'year' ? c.onAccent || '#FFFFFF' : c.ink, fontWeight: '700', fontSize: 14 }}>{t.wrappedWholeYear}</Text>
        </Pressable>
        <View style={[s.months, rtl && s.rowReverse]}>
          {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => {
            const on = sel === m;
            const off = isFuture(m);
            return (
              <Pressable
                key={m}
                onPress={() => setSel(m)}
                disabled={off}
                accessibilityRole="button"
                accessibilityState={{ selected: on, disabled: off }}
                accessibilityLabel={monthLabel(m)}
                style={[s.month, { backgroundColor: on ? c.sage : c.paper || c.bg, borderColor: on ? c.sageDark : c.line, borderWidth: on ? 2 : 1, opacity: off ? 0.35 : 1 }]}
              >
                <Text numberOfLines={1} adjustsFontSizeToFit style={{ color: on ? c.sageDark : c.ink, fontWeight: on ? '800' : '600', fontSize: 13 }}>{monthLabel(m)}</Text>
                <View style={[s.dot, { backgroundColor: monthHas[m] ? c.accent : 'transparent' }]} />
              </Pressable>
            );
          })}
        </View>
      </View>

      {stats.entries === 0 ? (
        <View style={[s.empty, { backgroundColor: c.card, borderColor: c.line }]}>
          <Image source={CAT} style={{ width: 150, height: 90 }} resizeMode="contain" />
          <Text style={{ color: c.ink, fontSize: 15, fontWeight: '700', textAlign: 'center' }}>{t.wrappedEmpty}</Text>
        </View>
      ) : (
        <>
          {/* 2. The poster, then share / save */}
          <View ref={shotRef} collapsable={false} style={s.shot}>
            <WrappedCard t={t} c={c} rtl={rtl} language={language} calendar={calendar} stats={stats} title={title} nf={nfGroup} />
          </View>
          <View style={[s.actions, rtl && s.rowReverse]}>
            <View style={{ flex: 1 }}>
              <Button label={t.wrappedShare} onPress={() => sendImage('share')} c={c} rtl={rtl} variant="primary" icon={Share2} busy={busy === 'img:share'} disabled={Boolean(busy)} />
            </View>
            <View style={{ flex: 1 }}>
              <Button label={t.wrappedSave} onPress={() => sendImage('save')} c={c} rtl={rtl} icon={Download} busy={busy === 'img:save'} disabled={Boolean(busy)} />
            </View>
          </View>

          {/* 3. The PDF book */}
          <Card title={t.bookTitle} c={c} rtl={rtl}>
            <Text style={{ color: c.muted, fontSize: 12, lineHeight: 18, textAlign: align }}>
              {t.bookHint} · {fmt(t.bookEntries, { n: nfGroup.format(stats.entries) })}
            </Text>
            <Text style={{ color: c.ink, fontSize: 12, fontWeight: '700', textAlign: align, marginTop: 2 }}>{t.wrappedStyle}</Text>
            <View style={[s.styles, rtl && s.rowReverse]}>
              {TEMPLATES.map((x) => (
                <StyleTile key={x.key} x={x} on={tpl === x.key} onPress={() => setTpl(x.key)} c={c} label={t[x.label] || x.key} />
              ))}
            </View>
            <View style={[s.actions, rtl && s.rowReverse]}>
              <View style={{ flex: 1 }}>
                <Button label={busy.startsWith('pdf') ? t.bookWorking : t.wrappedShare} onPress={() => sendBook('share')} c={c} rtl={rtl} variant="primary" icon={FileText} busy={busy === 'pdf:share'} disabled={Boolean(busy)} />
              </View>
              <View style={{ flex: 1 }}>
                <Button label={t.wrappedSave} onPress={() => sendBook('save')} c={c} rtl={rtl} icon={Download} busy={busy === 'pdf:save'} disabled={Boolean(busy)} />
              </View>
            </View>
          </Card>
        </>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  root: { gap: 14 },
  rowReverse: { flexDirection: 'row-reverse' },
  picker: { borderWidth: 1, borderRadius: 20, padding: 12, gap: 10 },
  nav: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  yearChip: { borderWidth: 1, borderRadius: 14, minHeight: 42, alignItems: 'center', justifyContent: 'center' },
  months: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  month: { width: '23%', flexGrow: 1, minHeight: 46, borderRadius: 12, alignItems: 'center', justifyContent: 'center', gap: 3, paddingHorizontal: 4 },
  dot: { width: 5, height: 5, borderRadius: 3 },
  navBtn: { width: 42, height: 42, borderRadius: 21, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  shot: { alignSelf: 'center', width: '100%', maxWidth: 360 },
  card: { borderWidth: 1, borderRadius: 26, overflow: 'hidden', paddingBottom: 16, gap: 10 },
  hero: { paddingTop: 18, alignItems: 'center' },
  cat: { width: '72%', height: 118, marginTop: 6, marginBottom: -2 },
  bigWrap: { alignItems: 'center', marginTop: 4 },
  tiles: { flexDirection: 'row', gap: 8, paddingHorizontal: 16 },
  tile: { flex: 1, borderRadius: 14, paddingVertical: 10, paddingHorizontal: 6, alignItems: 'center', justifyContent: 'center', gap: 2, minHeight: 68 },
  panel: { marginHorizontal: 16, borderRadius: 16, paddingHorizontal: 14, paddingVertical: 6 },
  hl: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8 },
  hlIcon: { width: 40, alignItems: 'center', justifyContent: 'center' },
  tag: { alignSelf: 'center', borderRadius: 99, paddingVertical: 6, paddingHorizontal: 16 },
  actions: { flexDirection: 'row', gap: 10 },
  empty: { borderWidth: 1, borderRadius: 22, paddingVertical: 28, paddingHorizontal: 20, alignItems: 'center', gap: 10 },
  styles: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  styleCell: { width: '22%', flexGrow: 1, maxWidth: '24%' },
  page: { height: 62, borderRadius: 10, padding: 9 },
  check: { position: 'absolute', right: 5, bottom: 5, width: 18, height: 18, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
});
