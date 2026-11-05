import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Image, Modal, Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';
import { X } from 'lucide-react-native';
import { Text } from '../ui';
import MoodFace from './MoodFace';
import { Button } from './common';
import { listEntryAttachments } from '../db/repository';
import { attachmentUri } from '../services/photos';
import { fs } from '../platform/fs';
import { formatDateKey } from '../calendar';
import { fmt } from '../i18n';
import { numberFormatter } from '../utils/format';

const TICK = 50;
const DEFAULT_MS = 5500;
const slideMs = () => (typeof globalThis !== 'undefined' && globalThis.__STORY_MS) || DEFAULT_MS;

/** One slide per photo; an entry without photos is a single text slide. */
export function buildSlides(items, photosById) {
  const out = [];
  for (const entry of items) {
    const photos = photosById[entry.id] || [];
    if (!photos.length) out.push({ entry, uri: null, first: true });
    else photos.forEach((p, i) => out.push({ entry, uri: attachmentUri(fs, p.file_name), first: i === 0 }));
  }
  return out;
}

/** Full-screen story player: progress bars, auto-advance, tap left/right, hold to pause. */
export default function StoryViewer({ group, db, onClose, onOpenEntry, t, c, rtl, language, calendar, insets = { top: 0, bottom: 0 } }) {
  const { width, height } = useWindowDimensions();
  const [slides, setSlides] = useState(null);
  const [idx, setIdx] = useState(0);
  const [progress, setProgress] = useState(0);
  const [paused, setPaused] = useState(false);
  const [broken, setBroken] = useState({});
  const idxRef = useRef(0);
  idxRef.current = idx;
  const visible = !!group;
  const num = numberFormatter(language);
  const align = rtl ? 'right' : 'left';

  useEffect(() => {
    if (!group) { setProgress(0); setIdx(0); setSlides(null); return undefined; }
    let live = true;
    setSlides(null); setIdx(0); setProgress(0); setPaused(false); setBroken({});
    (async () => {
      const byId = {};
      for (const e of group.items) {
        try { byId[e.id] = (e.attachmentCount || 0) > 0 ? await listEntryAttachments(db, e.id) : []; } catch { byId[e.id] = []; }
      }
      if (live) setSlides(buildSlides(group.items, byId));
    })();
    return () => { live = false; };
  }, [group, db]);

  const total = slides ? slides.length : 0;
  const next = useCallback(() => {
    if (idxRef.current + 1 >= total) onClose();
    else { setIdx(idxRef.current + 1); setProgress(0); }
  }, [total, onClose]);
  const prev = () => {
    if (progress > 0.15 || idx === 0) setProgress(0);
    else { setIdx(idx - 1); setProgress(0); }
  };

  useEffect(() => {
    if (!visible || !total || paused) return undefined;
    const ms = slideMs();
    const id = setInterval(() => {
      setProgress((p) => {
        const n = p + TICK / ms;
        return n >= 1 ? 1 : n;
      });
    }, TICK);
    return () => clearInterval(id);
  }, [visible, total, paused, idx]);

  useEffect(() => {
    if (progress >= 1 && total > 0) next();
  }, [progress, total, next]);

  if (!group) return null;
  const slide = slides && slides[idx];
  const entry = slide && slide.entry;
  const photo = slide && slide.uri && !broken[slide.uri] ? slide.uri : null;
  const label = { today: t.onThisDay, lastMonth: t.storyLastMonth, lastYear: t.storyLastYear }[group.key] || '';
  const when = entry
    ? group.key === 'today' && entry.yearsAgo
      ? entry.yearsAgo === 1 ? t.yearAgo : fmt(t.yearsAgo, { n: num(entry.yearsAgo) })
      : formatDateKey(entry.journal_date, language, calendar, { dateStyle: 'medium' })
    : '';
  const textColor = photo ? '#FFFFFF' : c.ink;

  return (
    <Modal visible={visible} animationType="fade" transparent={false} onRequestClose={onClose}>
      <View style={[s.page, { width, height, backgroundColor: photo ? '#000' : c.sage }]} testID="story-viewer">
        {photo ? <Image source={{ uri: photo }} style={StyleSheet.absoluteFill} resizeMode="cover" onError={() => setBroken((b) => ({ ...b, [photo]: true }))} /> : null}
        {photo ? <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.28)' }]} /> : null}

        {/* tap zones: left = back, right = next (swapped in RTL); hold = pause */}
        <View style={[StyleSheet.absoluteFill, { flexDirection: rtl ? 'row-reverse' : 'row' }]}>
          {[prev, next].map((fn, i) => (
            <Pressable
              key={i}
              style={{ flex: i === 0 ? 1 : 2 }}
              onPress={fn}
              onPressIn={() => setPaused(true)}
              onPressOut={() => setPaused(false)}
              onLongPress={() => {}}
              accessibilityRole="button"
              accessibilityLabel={i === 0 ? t.storyPrev : t.storyNext}
              testID={i === 0 ? 'story-prev' : 'story-next'}
            />
          ))}
        </View>

        <View pointerEvents="box-none" style={[s.top, { paddingTop: Math.max(insets.top, 10) + 4 }]}>
          <View style={s.bars}>
            {Array.from({ length: total }).map((_, i) => (
              <View key={i} style={s.track}>
                <View style={[s.fill, { width: `${(i < idx ? 1 : i === idx ? progress : 0) * 100}%` }]} testID={i === idx ? 'story-progress' : undefined} />
              </View>
            ))}
          </View>
          <View style={[s.head, rtl && { flexDirection: 'row-reverse' }]}>
            <View style={{ flex: 1 }}>
              <Text style={{ color: textColor, fontSize: 14, fontWeight: '700', textAlign: align }}>{label}</Text>
              <Text style={{ color: textColor, opacity: 0.85, fontSize: 12, textAlign: align }}>{when}</Text>
            </View>
            <Pressable onPress={onClose} hitSlop={12} accessibilityRole="button" accessibilityLabel={t.cancel} style={s.close} testID="story-close">
              <X size={24} color={textColor} />
            </Pressable>
          </View>
        </View>

        {entry ? (
          <View pointerEvents="box-none" style={[s.body, { paddingBottom: Math.max(insets.bottom, 14) + 8, paddingHorizontal: Math.max(20, (width - 640) / 2) }]}>
            <View pointerEvents="none" style={{ gap: 8 }}>
              {entry.mood ? <MoodFace mood={entry.mood} size={34} style={{ alignSelf: rtl ? 'flex-end' : 'flex-start' }} /> : null}
              <Text style={{ color: textColor, fontSize: photo ? 24 : 28, fontWeight: '800', textAlign: align }} numberOfLines={3}>
                {entry.title || t.noTitle}
              </Text>
              {slide.first && entry.body ? (
                <Text style={{ color: textColor, opacity: 0.92, fontSize: 15, lineHeight: 23, textAlign: align }} numberOfLines={photo ? 4 : 9}>
                  {entry.body.slice(0, 320)}
                </Text>
              ) : null}
            </View>
            <Button label={t.storyOpen} onPress={() => { onClose(); onOpenEntry(entry); }} c={c} rtl={rtl} variant="primary" />
          </View>
        ) : (
          <View style={s.body}><Text style={{ color: c.muted, textAlign: 'center' }}>{t.loading}</Text></View>
        )}
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  page: { overflow: 'hidden' },
  top: { position: 'absolute', top: 0, left: 0, right: 0, paddingHorizontal: 12, gap: 10 },
  bars: { flexDirection: 'row', gap: 4 },
  track: { flex: 1, height: 3, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.35)', overflow: 'hidden' },
  fill: { height: '100%', backgroundColor: '#FFFFFF' },
  head: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  close: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  body: { position: 'absolute', left: 0, right: 0, bottom: 0, gap: 16 },
});
