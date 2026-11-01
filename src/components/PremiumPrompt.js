import React from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { Crown } from 'lucide-react-native';
import { Text } from '../ui';

/** "This needs Premium" popup. `canOpen` is false where the Premium page is not reachable (intro). */
export default function PremiumPrompt({ feature, onClose, onSee, canOpen = true, t, c, rtl }) {
  if (!feature) return null;
  const align = rtl ? 'right' : 'left';
  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <View style={s.backdrop}>
        <View style={[s.card, { backgroundColor: c.paper, borderColor: c.line }]} testID="premium-prompt" accessibilityRole="alert">
          <View style={[s.icon, { backgroundColor: c.accentSoft }]}>
            <Crown size={24} color={c.accent} />
          </View>
          <Text style={{ color: c.ink, fontSize: 18, fontWeight: '700', textAlign: 'center' }}>{t.premiumFeature}</Text>
          <Text style={{ color: c.muted, fontSize: 14, lineHeight: 21, textAlign: 'center' }}>{t[`premium_${feature}`]}</Text>
          <View style={[s.actions, rtl && { flexDirection: 'row-reverse' }]}>
            <Pressable
              testID="premium-later"
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel={t.premiumNotNow}
              style={[s.btn, { backgroundColor: c.card, borderColor: c.line }]}
            >
              <Text style={{ color: c.ink, fontWeight: '700', fontSize: 14 }}>{t.premiumNotNow}</Text>
            </Pressable>
            {canOpen ? (
              <Pressable
                testID="premium-see"
                onPress={onSee}
                accessibilityRole="button"
                accessibilityLabel={t.premiumSee}
                style={[s.btn, { backgroundColor: c.accent, borderColor: c.accent }]}
              >
                <Text style={{ color: c.onAccent, fontWeight: '700', fontSize: 14 }}>{t.premiumSee}</Text>
              </Pressable>
            ) : null}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', alignItems: 'center', justifyContent: 'center', padding: 24 },
  card: { width: '100%', maxWidth: 400, borderRadius: 22, borderWidth: 1, padding: 22, gap: 12, alignItems: 'center' },
  icon: { width: 54, height: 54, borderRadius: 27, alignItems: 'center', justifyContent: 'center' },
  actions: { flexDirection: 'row', gap: 10, marginTop: 6, alignSelf: 'stretch' },
  btn: { flex: 1, paddingVertical: 12, borderRadius: 14, borderWidth: 1, alignItems: 'center' },
});
