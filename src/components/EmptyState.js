import React from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { BookOpen } from 'lucide-react-native';
import { Text } from '../ui';
import { isLightPalette } from '../theme';

// Fixed warm (orange) colours — not taken from the theme.
const warmTint = (c) => (isLightPalette(c) ? { bg: '#FBE3CF', fg: '#D9732B' } : { bg: '#4A3526', fg: '#F0A56B' });

export default function EmptyState({ c, title, hint, icon: Icon = BookOpen, warm }) {
  const tint = warm ? warmTint(c) : null;
  return (
    <View style={[s.card, { backgroundColor: c.card, borderColor: c.line }]}>
      <View style={[s.art, { backgroundColor: tint ? tint.bg : c.lavender }]}>
        <Icon size={27} color={tint ? tint.fg : '#A091B0'} />
        <View style={s.cat}>
          <Text style={{ fontSize: 15 }}>☻</Text>
        </View>
        <Text style={s.star}>✦</Text>
      </View>
      <Text style={[s.title, { color: c.ink }]}>{title}</Text>
      {hint ? <Text style={[s.hint, { color: c.muted }]}>{hint}</Text> : null}
    </View>
  );
}

const s = StyleSheet.create({
  card: { borderWidth: 1, borderStyle: 'dashed', borderRadius: 18, paddingHorizontal: 18, paddingVertical: 24, alignItems: 'center', marginTop: 3 },
  art: { width: 70, height: 57, borderRadius: 17, alignItems: 'center', justifyContent: 'center', marginBottom: 8, position: 'relative' },
  cat: { position: 'absolute', right: -5, bottom: -3, width: 25, height: 25, borderRadius: 13, backgroundColor: '#E4C9B3', alignItems: 'center', justifyContent: 'center' },
  star: { position: 'absolute', left: -5, top: -8, fontSize: 19, color: '#C4AD82' },
  title: {
    fontFamily: Platform.select({ ios: 'Georgia', android: 'serif', default: 'Georgia' }),
    fontSize: 18,
    fontWeight: '500',
    textAlign: 'center',
    marginTop: 4,
  },
  hint: { fontSize: 11, lineHeight: 18, textAlign: 'center', marginTop: 7, maxWidth: 300 },
});
