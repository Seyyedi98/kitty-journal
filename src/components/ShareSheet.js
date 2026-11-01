import React, { useState } from 'react';
import { ActivityIndicator, Modal, Pressable, StyleSheet, View } from 'react-native';
import { Download, FileText, Image as ImageIcon, Share2, Type, X } from 'lucide-react-native';
import { ScrollView, Text } from '../ui';
import { TEMPLATES, DEFAULT_TEMPLATE } from '../utils/entryPdf';
import { canSaveToDevice } from '../platform/exportEntry';
import { usePremium } from '../premium';

/** "How do you want to share this entry?" popup: text, picture of the page, or a styled PDF. */
export default function ShareSheet({ visible, onClose, onText, onImage, onPdf, t, c, rtl }) {
  const { premium, request } = usePremium();
  const [pdfOpen, setPdfOpen] = useState(false);
  const [imageOpen, setImageOpen] = useState(false);
  const [template, setTemplate] = useState(DEFAULT_TEMPLATE);
  const [busy, setBusy] = useState(false);
  const align = rtl ? 'right' : 'left';

  const run = async (fn) => {
    if (busy) return;
    setBusy(true);
    try {
      await fn();
    } finally {
      setBusy(false);
    }
  };
  const close = () => {
    if (busy) return;
    setPdfOpen(false);
    setImageOpen(false);
    onClose();
  };

  const option = (Icon, title, hint, onPress, testID, selected, pro) => (
    <Pressable
      testID={testID}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityState={{ selected: Boolean(selected) }}
      style={[s.option, { backgroundColor: c.card, borderColor: selected ? c.accent : c.line }, rtl && s.rowReverse]}
    >
      <View style={[s.icon, { backgroundColor: c.accentSoft }]}>
        <Icon size={20} color={c.accent} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ color: c.ink, fontSize: 15, fontWeight: '700', textAlign: align }}>{title}{pro ? `  · ${t.premiumTag}` : ''}</Text>
        <Text style={{ color: c.muted, fontSize: 12, textAlign: align }}>{hint}</Text>
      </View>
    </Pressable>
  );

  // Two buttons: send it through the system share sheet, or keep a copy in a folder on the phone.
  const actions = (prefix, go) => (
    <View style={[s.actions, rtl && s.rowReverse]}>
      <Pressable
        testID={`${prefix}-share`}
        onPress={() => go('share')}
        accessibilityRole="button"
        accessibilityLabel={t.share}
        style={[s.create, { backgroundColor: c.accent, flex: 1, flexDirection: 'row', gap: 8 }]}
      >
        <Share2 size={16} color={c.onAccent} />
        <Text style={{ color: c.onAccent, fontWeight: '700', fontSize: 14 }}>{t.share}</Text>
      </Pressable>
      {canSaveToDevice() ? (
        <Pressable
          testID={`${prefix}-save`}
          onPress={() => go('save')}
          accessibilityRole="button"
          accessibilityLabel={t.saveToDevice}
          style={[s.create, { backgroundColor: c.card, borderColor: c.accent, borderWidth: 1.5, flex: 1, flexDirection: 'row', gap: 8 }]}
        >
          <Download size={16} color={c.accent} />
          <Text style={{ color: c.accent, fontWeight: '700', fontSize: 14 }}>{t.saveToDevice}</Text>
        </Pressable>
      ) : null}
    </View>
  );

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={close}>
      <View style={s.backdrop}>
        <View style={[s.card, { backgroundColor: c.paper, borderColor: c.line }]} testID="share-sheet">
          <View style={[s.head, rtl && s.rowReverse]}>
            <Text style={{ color: c.ink, fontSize: 18, fontWeight: '700', flex: 1, textAlign: align }}>{t.shareTitle}</Text>
            <Pressable onPress={close} accessibilityRole="button" accessibilityLabel={t.close} hitSlop={8}>
              <X size={20} color={c.muted} />
            </Pressable>
          </View>
          <ScrollView style={{ maxHeight: 480 }} contentContainerStyle={{ gap: 10 }}>
            {option(Type, t.shareText, t.shareTextHint, () => run(onText), 'share-text')}
            {option(ImageIcon, t.shareImage, t.shareImageHint, () => { setImageOpen((v) => !v); setPdfOpen(false); }, 'share-image', imageOpen)}
            {imageOpen ? actions('image', (mode) => run(() => onImage(mode))) : null}
            {option(FileText, t.sharePdf, t.sharePdfHint, () => { if (!premium) { request('pdf'); return; } setPdfOpen((v) => !v); setImageOpen(false); }, 'share-pdf', pdfOpen, !premium)}

            {pdfOpen ? (
              <View style={{ gap: 12 }}>
                <View style={[s.templates, rtl && s.rowReverse]}>
                  {TEMPLATES.map((tp) => {
                    const on = tp.key === template;
                    return (
                      <Pressable
                        key={tp.key}
                        testID={`tpl-${tp.key}`}
                        onPress={() => setTemplate(tp.key)}
                        accessibilityRole="button"
                        accessibilityLabel={t[tp.label]}
                        accessibilityState={{ selected: on }}
                        style={{ width: '22%', alignItems: 'center', gap: 6 }}
                      >
                        <View style={[s.mini, { backgroundColor: tp.swatch[0], borderColor: on ? c.accent : c.line, borderWidth: on ? 3 : 1 }]}>
                          <View style={{ height: 5, width: '60%', borderRadius: 3, backgroundColor: tp.swatch[1] }} />
                          <View style={{ height: 3, width: '85%', borderRadius: 2, backgroundColor: tp.swatch[1], opacity: 0.35 }} />
                          <View style={{ height: 3, width: '75%', borderRadius: 2, backgroundColor: tp.swatch[1], opacity: 0.35 }} />
                          <View style={{ height: 3, width: '80%', borderRadius: 2, backgroundColor: tp.swatch[1], opacity: 0.35 }} />
                        </View>
                        <Text style={{ color: c.ink, fontSize: 11, fontWeight: on ? '700' : '500' }} numberOfLines={1}>{t[tp.label]}</Text>
                      </Pressable>
                    );
                  })}
                </View>
                {actions('pdf', (mode) => run(() => onPdf(template, mode)))}
              </View>
            ) : null}
          </ScrollView>
          {busy ? (
            <View style={[s.busy, rtl && s.rowReverse]}>
              <ActivityIndicator color={c.accent} />
              <Text style={{ color: c.muted, fontSize: 13 }}>{t.shareBusy}</Text>
            </View>
          ) : null}
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', alignItems: 'center', justifyContent: 'center', padding: 22 },
  card: { width: '100%', maxWidth: 440, borderRadius: 22, borderWidth: 1, padding: 18, gap: 14 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  rowReverse: { flexDirection: 'row-reverse' },
  option: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: 16, borderWidth: 1.5 },
  icon: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
  templates: { flexDirection: 'row', flexWrap: 'wrap', rowGap: 12, columnGap: 6 },
  mini: { width: '100%', aspectRatio: 0.72, borderRadius: 8, padding: 8, gap: 5, justifyContent: 'flex-start' },
  actions: { flexDirection: 'row', gap: 10 },
  create: { height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center' },
  busy: { flexDirection: 'row', alignItems: 'center', gap: 10, justifyContent: 'center' },
});
