import React, { useEffect, useMemo, useState } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { WebView } from 'react-native-webview';
import { X } from 'lucide-react-native';
import { Text } from '../ui';
import { Button } from './common';
import { MAP_BASE_URL, buildPickerHtml } from '../utils/mapPlaces';

const valid = (m) =>
  m && m.type === 'pick' && typeof m.lat === 'number' && typeof m.lng === 'number' &&
  Number.isFinite(m.lat) && Number.isFinite(m.lng) && Math.abs(m.lat) <= 90 && Math.abs(m.lng) <= 180;

/** Full-screen map to choose where an entry was written. `onConfirm({ latitude, longitude })`. */
export default function MapPickerModal({ visible, initial, onConfirm, onCancel, t, c, rtl, insets = { top: 0, bottom: 0 } }) {
  const [picked, setPicked] = useState(null);
  const [offline, setOffline] = useState(false);
  useEffect(() => {
    if (visible) {
      setPicked(initial ? { lat: initial.latitude, lng: initial.longitude } : null);
      setOffline(false);
    }
  }, [visible, initial]);
  const html = useMemo(
    () => buildPickerHtml({ lat: initial?.latitude, lng: initial?.longitude, background: c.line, accent: c.accent, offlineText: t.mapOffline }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [visible, initial?.latitude, initial?.longitude, c.line, c.accent, t.mapOffline],
  );
  const onMessage = (event) => {
    let m;
    try { m = JSON.parse(event.nativeEvent.data); } catch { return; }
    if (valid(m)) setPicked({ lat: m.lat, lng: m.lng });
    else if (m && m.type === 'offline') setOffline(true);
  };
  const align = rtl ? 'right' : 'left';
  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onCancel}>
      <View style={[s.page, { backgroundColor: c.paper, paddingTop: Math.max(insets.top, 12) }]} testID="map-picker">
        <View style={[s.head, rtl && s.rowReverse]}>
          <Text style={{ flex: 1, color: c.ink, fontSize: 17, fontWeight: '700', textAlign: align }}>{t.mapPickerTitle}</Text>
          <Pressable onPress={onCancel} accessibilityRole="button" accessibilityLabel={t.cancel} hitSlop={10} style={s.close}>
            <X size={20} color={c.muted} />
          </Pressable>
        </View>
        {visible ? (
          <View style={[s.map, { backgroundColor: c.line }]}>
            <WebView
              originWhitelist={['*']}
              source={{ html, baseUrl: MAP_BASE_URL }}
              onMessage={onMessage}
              javaScriptEnabled
              domStorageEnabled={false}
              nestedScrollEnabled
              setSupportMultipleWindows={false}
              onShouldStartLoadWithRequest={(req) => req.url === MAP_BASE_URL || req.url.startsWith('about:') || req.url.startsWith('data:')}
              style={{ flex: 1, backgroundColor: c.line }}
              accessibilityLabel="map"
            />
          </View>
        ) : null}
        <View style={[s.foot, { paddingBottom: Math.max(insets.bottom, 12) }]}>
          <Text style={{ color: c.muted, fontSize: 12, textAlign: align }}>
            {offline ? t.mapOffline : picked ? `${picked.lat.toFixed(5)}, ${picked.lng.toFixed(5)}` : t.mapPickerHint}
          </Text>
          <View style={[s.actions, rtl && s.rowReverse]}>
            <Button label={t.cancel} onPress={onCancel} c={c} rtl={rtl} style={{ flex: 1 }} />
            <Button
              label={t.mapPickerUse}
              onPress={() => picked && onConfirm({ latitude: picked.lat, longitude: picked.lng })}
              disabled={!picked}
              c={c}
              rtl={rtl}
              variant="primary"
              style={{ flex: 1 }}
            />
          </View>
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  page: { flex: 1 },
  rowReverse: { flexDirection: 'row-reverse' },
  head: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 18, paddingBottom: 10 },
  close: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  map: { flex: 1, marginHorizontal: 12, borderRadius: 18, overflow: 'hidden' },
  foot: { paddingHorizontal: 18, paddingTop: 12, gap: 10 },
  actions: { flexDirection: 'row', gap: 10 },
});
