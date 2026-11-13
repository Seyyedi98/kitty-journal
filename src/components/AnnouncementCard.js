import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Bell, X } from 'lucide-react-native';
import { Text } from '../ui';

/** A message from the app's owner (maintenance, news, an offer): plain text, closed once and then never shown again. */
export default function AnnouncementCard({ text, onClose, t, c, rtl }) {
  return (
    <View style={[s.card, { backgroundColor: c.accentSoft, borderColor: c.line }, rtl && s.rowReverse]}>
      <Bell size={16} color={c.sageDark} style={{ marginTop: 2 }} />
      <Text
        selectable
        style={{ flex: 1, color: c.ink, fontSize: 13, lineHeight: 20, textAlign: rtl ? 'right' : 'left', writingDirection: rtl ? 'rtl' : 'ltr' }}
      >
        {text}
      </Text>
      <Pressable onPress={onClose} hitSlop={10} accessibilityRole="button" accessibilityLabel={t.announcementClose}>
        <X size={18} color={c.muted} />
      </Pressable>
    </View>
  );
}

const s = StyleSheet.create({
  card: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, borderWidth: 1, borderRadius: 16, paddingVertical: 12, paddingHorizontal: 14, marginBottom: 12 },
  rowReverse: { flexDirection: 'row-reverse' },
});
