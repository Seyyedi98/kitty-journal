import React, { useEffect, useRef, useState } from 'react';
import MoodFace from './MoodFace';
import { MOOD_IMAGES } from '../moodImages';
import { Image, Modal, Pressable, Share, StyleSheet, View, useWindowDimensions } from 'react-native';
import { ChevronLeft, ChevronRight, MapPin, Pencil, Share2 } from 'lucide-react-native';
import { ScrollView, Text } from '../ui';
import { MOODS } from '../theme';
import { formatDateKey } from '../calendar';
import { fmt } from '../i18n';
import { fs } from '../platform/fs';
import { listEntryAttachments } from '../db/repository';
import { attachmentUri } from '../services/photos';
import { entryToEditorHtml } from '../utils/richText';
import { htmlToBlocks } from '../utils/richView';
import PhotoViewer from './PhotoViewer';
import ShareSheet from './ShareSheet';
import { Dialog } from '../platform/dialog';
import { buildEntryHtml } from '../utils/entryPdf';
import { photoDataUris, makePdfFile, makeImageFile, deliverFile } from '../platform/exportEntry';

const FONTS = { serif: 'serif', naskh: 'serif', mono: 'monospace', hand: 'cursive' };
const SIZES = { h1: 26, h2: 21, h3: 18, p: 16, li: 16 };

function fontOf(css) {
  const x = String(css || '').toLowerCase();
  if (x.includes('mono')) return FONTS.mono;
  if (x.includes('cursive')) return FONTS.hand;
  if (x.includes('serif')) return FONTS.serif;
  return undefined;
}

function Body({ html, c, rtl }) {
  const blocks = htmlToBlocks(html);
  return (
    <View style={{ gap: 10 }}>
      {blocks.map((b, i) => {
        if (b.type === 'hr') return <View key={i} style={{ height: 1, backgroundColor: c.line, marginVertical: 6 }} />;
        const dirRtl = b.dir === 'rtl' ? true : b.dir === 'ltr' ? false : rtl;
        const align = b.align || (dirRtl ? 'right' : 'left');
        const text = (
          <Text
            style={{
              color: c.ink,
              fontSize: SIZES[b.type] || 16,
              lineHeight: Math.round((SIZES[b.type] || 16) * 1.55),
              fontWeight: b.type.startsWith('h') ? '700' : '400',
              textAlign: align,
              writingDirection: dirRtl ? 'rtl' : 'ltr',
            }}
          >
            {b.runs.length === 0 ? ' ' : b.runs.map((r, j) => (
              <Text
                key={j}
                style={{
                  fontWeight: r.bold ? '700' : undefined,
                  fontStyle: r.italic ? 'italic' : undefined,
                  textDecorationLine: r.underline && r.strike ? 'underline line-through' : r.underline ? 'underline' : r.strike ? 'line-through' : undefined,
                  color: r.color || undefined,
                  backgroundColor: r.background || undefined,
                  fontFamily: fontOf(r.font),
                }}
              >
                {r.text}
              </Text>
            ))}
          </Text>
        );
        const row = b.marker ? (
          <View style={{ flexDirection: dirRtl ? 'row-reverse' : 'row', gap: 8 }}>
            <Text style={{ color: c.muted, fontSize: 16, lineHeight: 25, minWidth: 18, textAlign: dirRtl ? 'left' : 'right' }}>{b.marker}</Text>
            <View style={{ flex: 1 }}>{text}</View>
          </View>
        ) : text;
        return b.quote ? (
          <View key={i} style={{ borderColor: c.accent, [dirRtl ? 'borderRightWidth' : 'borderLeftWidth']: 3, [dirRtl ? 'paddingRight' : 'paddingLeft']: 12 }}>{row}</View>
        ) : (
          <View key={i}>{row}</View>
        );
      })}
    </View>
  );
}

/**
 * Read-only view of one entry: slide-show of photos, formatted text, and a top bar with
 * Back / Edit / Share.
 */
export default function EntryPreview({ visible, entry, db, onClose, onEdit, t, c, rtl, language, calendar, insets, num = String }) {
  const { width } = useWindowDimensions();
  const slideW = Math.min(width, 720);
  const [photos, setPhotos] = useState([]);
  const [slide, setSlide] = useState(0);
  const [viewer, setViewer] = useState(null);
  const [failed, setFailed] = useState({});
  const slider = useRef(null);
  const shotRef = useRef(null);
  const [sheet, setSheet] = useState(false);
  const id = entry && entry.id;

  useEffect(() => {
    if (!visible || !id) return undefined;
    let live = true;
    setSlide(0);
    setFailed({});
    listEntryAttachments(db, id).then((rows) => { if (live) setPhotos(rows); }).catch(() => { if (live) setPhotos([]); });
    return () => { live = false; };
  }, [visible, id, db]);

  if (!entry) return null;
  const mood = MOODS.find((m) => m.key === entry.mood);
  const html = entryToEditorHtml(entry);
  const dateText = formatDateKey(entry.journal_date, language, calendar, { dateStyle: 'full' });
  const place = entry.location && (entry.location.name || entry.location.address);
  const tags = entry.tags || [];
  const Back = rtl ? ChevronRight : ChevronLeft;

  const fileInfo = { title: entry.title, dateKey: entry.journal_date, dialogTitle: entry.title || dateText };
  const failed_ = (error) => {
    console.warn('[kitty-journal] share failed:', error);
    Dialog.alert(t.share, t.shareFailed);
  };
  const shareAsText = async () => {
    setSheet(false);
    const message = [entry.title, dateText, '', entry.body].filter((x, i) => i > 1 || x).join('\n');
    try {
      await Share.share({ message, title: entry.title || dateText });
    } catch {
      /* cancelled or unavailable */
    }
  };
  const finish = (r) => {
    setSheet(false);
    if (r && r.done) {
      if (r.mode === 'save') Dialog.alert(t.share, t.savedToDevice);
    } else if (r && r.reason === 'unavailable') Dialog.alert(t.share, t.shareUnavailable);
    else if (r && r.reason === 'unsupported') Dialog.alert(t.share, t.saveUnsupported);
  };
  const shareAsImage = async (mode) => {
    try {
      const file = await makeImageFile(shotRef.current, fileInfo);
      const r = await deliverFile(file, mode, fileInfo.dialogTitle);
      finish({ ...r, mode });
    } catch (error) {
      setSheet(false);
      failed_(error);
    }
  };
  const shareAsPdf = async (template, mode) => {
    try {
      const uris = await photoDataUris(photos.map((p) => p.file_name));
      const doc = buildEntryHtml({
        entry,
        bodyHtml: html,
        template,
        dateText,
        photos: uris,
        moodFace: mood ? MOOD_IMAGES[mood.key] : '',
        rtl,
        footer: 'Kitty Journal',
      });
      const file = await makePdfFile(doc, fileInfo);
      const r = await deliverFile(file, mode, fileInfo.dialogTitle);
      finish({ ...r, mode });
    } catch (error) {
      setSheet(false);
      failed_(error);
    }
  };

  const pill = (Icon, label, onPress) => (
    <Pressable
      key={label}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={[s.pill, { backgroundColor: c.card, borderColor: c.line }]}
    >
      <Icon size={16} color={c.ink} />
      <Text style={{ color: c.ink, fontSize: 13, fontWeight: '600' }}>{label}</Text>
    </Pressable>
  );

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={[s.root, { backgroundColor: c.bg, paddingTop: insets.top + 8 }]} testID="entry-preview">
        <View style={[s.bar, rtl && s.rowReverse]}>
          <Pressable
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel={t.back}
            style={[s.back, { backgroundColor: c.card, borderColor: c.line }]}
          >
            <Back size={20} color={c.ink} />
          </Pressable>
          <View style={[s.actions, rtl && s.rowReverse]}>
            {pill(Pencil, t.edit, () => onEdit(entry))}
            {pill(Share2, t.share, () => setSheet(true))}
          </View>
        </View>

        <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 32, alignItems: 'center' }}>
          <View ref={shotRef} collapsable={false} style={{ width: slideW, maxWidth: '100%', backgroundColor: c.bg }}>
            {photos.length > 0 ? (
              <View>
                <ScrollView
                  ref={slider}
                  horizontal
                  pagingEnabled
                  onMomentumScrollEnd={(e) => setSlide(Math.round(e.nativeEvent.contentOffset.x / slideW))}
                >
                  {photos.map((p, i) => (
                    <Pressable key={p.id} onPress={() => setViewer(i)} accessibilityRole="button" accessibilityLabel={fmt(t.photoViewerOf, { i: num(i + 1), n: num(photos.length) })}>
                      {failed[p.id] ? (
                        <View style={{ width: slideW, height: 260, alignItems: 'center', justifyContent: 'center', backgroundColor: c.card }}>
                          <Text style={{ color: c.muted }}>{t.photoMissing}</Text>
                        </View>
                      ) : (
                        <Image
                          source={{ uri: attachmentUri(fs, p.file_name) }}
                          style={{ width: slideW, height: 260, backgroundColor: c.card }}
                          resizeMode="cover"
                          onError={() => setFailed((prev) => ({ ...prev, [p.id]: true }))}
                          accessibilityIgnoresInvertColors
                        />
                      )}
                    </Pressable>
                  ))}
                </ScrollView>
                {photos.length > 1 ? (
                  <View style={s.dots}>
                    {photos.map((p, i) => (
                      <View key={p.id} style={[s.dot, { backgroundColor: i === slide ? c.accent : c.line, width: i === slide ? 18 : 7 }]} />
                    ))}
                  </View>
                ) : null}
              </View>
            ) : null}

            <View style={{ padding: 20, gap: 14 }}>
              <View style={{ gap: 6 }}>
                <Text style={{ color: c.muted, fontSize: 13, textAlign: rtl ? 'right' : 'left' }}>{dateText}</Text>
                {entry.title ? (
                  <Text style={{ color: c.ink, fontSize: 26, fontWeight: '700', textAlign: rtl ? 'right' : 'left' }}>{entry.title}</Text>
                ) : null}
              </View>

              {mood || place || tags.length ? (
                <View style={[s.meta, rtl && s.rowReverse]}>
                  {mood ? <MoodFace mood={mood.key} size={30} label={t[mood.key] || mood.key} /> : null}
                  {place ? (
                    <View style={[s.chip, { backgroundColor: c.card, borderColor: c.line }, rtl && s.rowReverse]}>
                      <MapPin size={13} color={c.muted} />
                      <Text style={{ color: c.ink, fontSize: 12 }}>{place}</Text>
                    </View>
                  ) : null}
                  {tags.map((tag) => (
                    <View key={tag.name} style={[s.chip, { backgroundColor: c.accentSoft, borderColor: c.line }]}>
                      <Text style={{ color: c.ink, fontSize: 12 }}>#{tag.name}</Text>
                    </View>
                  ))}
                </View>
              ) : null}

              <Body html={html} c={c} rtl={rtl} />
            </View>
          </View>
        </ScrollView>
      </View>
      <ShareSheet visible={sheet} onClose={() => setSheet(false)} onText={shareAsText} onImage={shareAsImage} onPdf={shareAsPdf} t={t} c={c} rtl={rtl} />
      <PhotoViewer
        visible={viewer !== null}
        photos={photos.map((p) => ({ id: p.id, uri: attachmentUri(fs, p.file_name) }))}
        index={viewer ?? 0}
        onClose={() => setViewer(null)}
        t={t}
        insets={insets}
        num={num}
      />
    </Modal>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },
  rowReverse: { flexDirection: 'row-reverse' },
  bar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14, paddingBottom: 8, gap: 8 },
  back: { width: 42, height: 42, borderRadius: 21, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  actions: { flexDirection: 'row', gap: 8 },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, height: 42, borderRadius: 21, borderWidth: 1 },
  dots: { flexDirection: 'row', gap: 5, justifyContent: 'center', alignItems: 'center', paddingVertical: 10 },
  dot: { height: 7, borderRadius: 4 },
  meta: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 14, borderWidth: 1 },
});
