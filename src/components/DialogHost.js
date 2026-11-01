import React, { useEffect, useState } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { Text } from '../ui';
import { subscribeDialog } from '../platform/dialog';

/** Renders Dialog.alert() requests as a themed popup. Mount once, near the app root. */
export default function DialogHost({ t, c, rtl }) {
  const [items, setItems] = useState([]);
  useEffect(() => subscribeDialog((req) => setItems((cur) => [...cur, req])), []);
  const current = items[0];
  const close = () => setItems((cur) => cur.slice(1));
  if (!current) return null;

  const buttons = current.buttons;
  const cancel = buttons.find((b) => b.style === 'cancel');
  const press = (b) => {
    close();
    if (b.onPress) b.onPress();
  };
  return (
    <Modal visible transparent animationType="fade" onRequestClose={() => (cancel ? press(cancel) : close())}>
      <View style={s.backdrop}>
        <View style={[s.card, { backgroundColor: c.paper, borderColor: c.line }]} accessibilityRole="alert">
          <Text style={{ color: c.ink, fontSize: 18, fontWeight: '700', textAlign: rtl ? 'right' : 'left' }}>{current.title}</Text>
          {current.message ? (
            <Text style={{ color: c.muted, fontSize: 14, lineHeight: 21, textAlign: rtl ? 'right' : 'left' }}>{current.message}</Text>
          ) : null}
          <View style={[s.actions, rtl && { flexDirection: 'row-reverse' }]}>
            {buttons.map((b, i) => {
              const destructive = b.style === 'destructive';
              const isCancel = b.style === 'cancel';
              return (
                <Pressable
                  key={i}
                  testID={destructive ? 'dialog-destructive' : isCancel ? 'dialog-cancel' : 'dialog-ok'}
                  accessibilityRole="button"
                  accessibilityLabel={b.text || t.ok || 'OK'}
                  onPress={() => press(b)}
                  style={[
                    s.btn,
                    destructive
                      ? { backgroundColor: c.danger, borderColor: c.danger }
                      : isCancel
                        ? { backgroundColor: c.card, borderColor: c.line }
                        : { backgroundColor: c.accent, borderColor: c.accent },
                  ]}
                >
                  <Text style={{ color: destructive || !isCancel ? c.onAccent : c.ink, fontSize: 14, fontWeight: '700' }}>{b.text || t.ok || 'OK'}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', alignItems: 'center', justifyContent: 'center', padding: 24 },
  card: { width: '100%', maxWidth: 420, borderRadius: 20, borderWidth: 1, padding: 20, gap: 12 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'flex-end', gap: 8, marginTop: 6 },
  btn: { minWidth: 88, paddingHorizontal: 16, paddingVertical: 11, borderRadius: 14, borderWidth: 1, alignItems: 'center' },
});
