import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Image, Modal, PanResponder, Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';
import { ChevronLeft, ChevronRight, ImageDown, X } from 'lucide-react-native';
import { Text } from '../ui';
import { Button, Card } from './common';
import { Dialog } from '../platform/dialog';
import { deps } from '../platform/deps';
import { MAX_BYTES, MAX_EDGE, fileOpsActive, findOversizedPhotos, previewReduction, reducePhoto } from '../services/photos';
import { formatBytes, numberFormatter } from '../utils/format';
import { fmt } from '../i18n';

const fs = deps.fs;
const MAX_COMPARE = 12; // the biggest photos are offered for comparison

/**
 * Settings > Storage: photos are stored at most MAX_EDGE px / MAX_BYTES. This card shows how many stored photos are
 * bigger, lets the user compare one of them before/after (nothing is changed by the comparison) and reduce them all.
 */
export default function PhotoReduceCard({ db, t, c, rtl, language, onChanged }) {
  const num = numberFormatter(language);
  const align = rtl ? 'right' : 'left';
  const { width } = useWindowDimensions();
  const [scan, setScan] = useState(null); // { total, candidates, bytes }
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(null);
  const [message, setMessage] = useState('');
  const [cmp, setCmp] = useState(null); // { index, data, view, loading, error }
  const [boxWidth, setBoxWidth] = useState(0);
  const [split, setSplit] = useState(0.5); // 0..1: how much of the picture (from the left) shows the original
  const splitRef = useRef(0.5);
  const startRef = useRef(0.5);
  const widthRef = useRef(0);
  const live = useRef(true);
  const current = useRef(null); // preview currently on disk (its cleanup)

  const load = useCallback(async () => {
    try {
      const r = await findOversizedPhotos(db, fs);
      if (live.current) setScan(r);
    } catch {
      if (live.current) setScan({ total: 0, candidates: [], bytes: 0 });
    }
  }, [db]);
  useEffect(() => {
    live.current = true;
    load();
    return () => {
      live.current = false;
      if (current.current) current.current.cleanup();
    };
  }, [load]);

  // Dragging anywhere on the picture moves the dividing line (the touch point itself is the new position).
  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: (e) => {
        const w = widthRef.current || 1;
        const v = Math.min(1, Math.max(0, e.nativeEvent.locationX / w));
        startRef.current = v;
        splitRef.current = v;
        setSplit(v);
      },
      onPanResponderMove: (_e, g) => {
        const w = widthRef.current || 1;
        const v = Math.min(1, Math.max(0, startRef.current + g.dx / w));
        splitRef.current = v;
        setSplit(v);
      },
    }),
  ).current;

  const dropPreview = async () => {
    const p = current.current;
    current.current = null;
    if (p) await p.cleanup();
  };

  const showPhoto = async (index) => {
    await dropPreview();
    setSplit(0.5);
    splitRef.current = 0.5;
    setCmp({ index, data: null, loading: true, error: false });
    try {
      const list = scan.candidates;
      const p = await previewReduction(deps, list[index % list.length].row);
      current.current = p;
      if (live.current) setCmp({ index, data: p, loading: false, error: false });
      else await dropPreview();
    } catch {
      if (live.current) setCmp({ index, data: null, loading: false, error: true });
    }
  };
  const closeCompare = async () => {
    setCmp(null);
    await dropPreview();
  };

  const reduceAll = () => {
    if (busy || !scan || !scan.candidates.length) return;
    if (fileOpsActive()) {
      setMessage(t.storageBusy);
      return;
    }
    Dialog.alert(t.photoRedRun, t.photoRedConfirm, [
      { text: t.cancel, style: 'cancel' },
      {
        text: t.photoRedRun,
        style: 'destructive',
        onPress: async () => {
          setBusy(true);
          setMessage('');
          let done = 0;
          let failed = 0;
          let saved = 0;
          const list = scan.candidates;
          for (let i = 0; i < list.length; i += 1) {
            setProgress({ a: i + 1, b: list.length });
            const r = await reducePhoto(db, deps, list[i].row);
            if (r.status === 'reduced') {
              done += 1;
              saved += r.before - r.after;
            } else if (r.status === 'failed') failed += 1;
          }
          setProgress(null);
          setBusy(false);
          setMessage(fmt(t.photoRedDone, { n: num(done), size: formatBytes(saved, language) }) + (failed ? ` ${fmt(t.photoRedFailed, { n: num(failed) })}` : ''));
          await load();
          onChanged?.();
        },
      },
    ]);
  };

  const n = scan ? scan.candidates.length : 0;
  const data = cmp && cmp.data;
  const boxW = Math.min(width - 56, 560);
  const refPic = data ? data.reduced : null;
  const ratio = refPic && refPic.width && refPic.height ? refPic.width / refPic.height : 4 / 3;
  const boxH = Math.min(Math.round(boxW / ratio), 480);
  widthRef.current = boxW;
  const lineX = Math.round(boxW * split);

  return (
    <Card title={t.photoRedTitle} c={c} rtl={rtl}>
      <Text style={{ color: c.muted, fontSize: 12, lineHeight: 18, textAlign: align }}>
        {fmt(t.photoRedInfo, { px: num(MAX_EDGE), size: formatBytes(MAX_BYTES, language) })}
      </Text>
      {scan ? (
        <Text style={{ color: c.ink, fontSize: 12, textAlign: align }}>
          {n ? fmt(t.photoRedSummary, { n: num(n), total: num(scan.total), size: formatBytes(scan.bytes, language) }) : t.photoRedAllGood}
        </Text>
      ) : null}
      <Button label={t.photoRedCompare} onPress={() => showPhoto(0)} c={c} rtl={rtl} variant="secondary" icon={ImageDown} disabled={busy || !n} />
      <Button
        label={progress ? fmt(t.photoRedRunning, { a: num(progress.a), b: num(progress.b) }) : t.photoRedRun}
        onPress={reduceAll}
        c={c}
        rtl={rtl}
        icon={ImageDown}
        busy={busy}
        disabled={busy || !n}
      />
      {message ? <Text style={{ color: c.sageDark, fontSize: 12, textAlign: align }}>{message}</Text> : null}

      <Modal visible={Boolean(cmp)} animationType="slide" onRequestClose={closeCompare}>
        <View style={{ flex: 1, backgroundColor: c.bg, paddingTop: 44, paddingHorizontal: 16, paddingBottom: 20, gap: 12 }}>
          <View style={[s.head, rtl && s.rowReverse]}>
            <Text style={{ color: c.ink, fontSize: 17, fontWeight: '700' }}>{t.photoRedCompare}</Text>
            <Pressable onPress={closeCompare} hitSlop={12} accessibilityRole="button" accessibilityLabel={t.photoRedClose}>
              <X size={22} color={c.ink} />
            </Pressable>
          </View>
          {cmp && cmp.loading ? <Text style={{ color: c.muted, fontSize: 13, textAlign: 'center', marginTop: 30 }}>{t.loading}</Text> : null}
          {cmp && cmp.error ? <Text style={{ color: c.muted, fontSize: 13, textAlign: 'center', marginTop: 30 }}>{t.photoRedNoPreview}</Text> : null}
          {data ? (
            <>
              <View
                {...pan.panHandlers}
                style={{ alignSelf: 'center', width: boxW, height: boxH, borderRadius: 12, overflow: 'hidden', backgroundColor: c.line }}
                accessibilityLabel={t.photoRedCompare}
              >
                {/* below: the reduced photo, full width */}
                <Image pointerEvents="none" source={{ uri: data.reduced.uri }} style={{ position: 'absolute', left: 0, top: 0, width: boxW, height: boxH }} resizeMode="contain" accessibilityIgnoresInvertColors />
                {/* above: the original, cut off at the line, same size and position */}
                <View pointerEvents="none" style={{ position: 'absolute', left: 0, top: 0, width: lineX, height: boxH, overflow: 'hidden' }}>
                  <Image source={{ uri: data.original.uri }} style={{ width: boxW, height: boxH }} resizeMode="contain" accessibilityIgnoresInvertColors />
                </View>
                {/* the line and its handle */}
                <View pointerEvents="none" style={{ position: 'absolute', top: 0, bottom: 0, left: lineX - 1, width: 2, backgroundColor: '#FFFFFF' }} />
                <View pointerEvents="none" style={[s.handle, { left: lineX - 18, top: boxH / 2 - 18, backgroundColor: '#FFFFFF', borderColor: c.line }]}>
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <ChevronLeft size={15} color="#333333" />
                    <ChevronRight size={15} color="#333333" />
                  </View>
                </View>
                <View pointerEvents="none" style={[s.tag, { left: 8, backgroundColor: 'rgba(0,0,0,0.55)' }]}>
                  <Text style={{ color: '#FFFFFF', fontSize: 11, fontWeight: '700' }}>{t.photoRedOriginal}</Text>
                </View>
                <View pointerEvents="none" style={[s.tag, { right: 8, backgroundColor: 'rgba(0,0,0,0.55)' }]}>
                  <Text style={{ color: '#FFFFFF', fontSize: 11, fontWeight: '700' }}>{t.photoRedReduced}</Text>
                </View>
              </View>
              {[['photoRedOriginal', data.original], ['photoRedReduced', data.reduced]].map(([k, p]) => (
                <Text key={k} style={{ color: c.ink, fontSize: 12, textAlign: 'center' }}>
                  {t[k]}: {p.width && p.height ? fmt(t.photoRedDetails, { w: num(p.width), h: num(p.height), size: formatBytes(p.size, language) }) : formatBytes(p.size, language)}
                </Text>
              ))}
              <Text style={{ color: c.muted, fontSize: 11, textAlign: 'center' }}>{t.photoRedTapHint}</Text>
              <Button label={t.photoRedNext} onPress={() => showPhoto(cmp.index + 1)} c={c} rtl={rtl} variant="secondary" disabled={n < 2} />
            </>
          ) : null}
        </View>
      </Modal>
    </Card>
  );
}

const s = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  rowReverse: { flexDirection: 'row-reverse' },
  handle: { position: 'absolute', width: 36, height: 36, borderRadius: 18, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  tag: { position: 'absolute', top: 8, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
});
