import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Crown } from 'lucide-react-native';
import { ScrollView, Text } from '../ui';
import { Button } from './common';
import { usePremium } from '../premium';

/** Stands in for a whole page that is Premium-only (Memories). */
export default function PremiumLocked({ title, body, hint, t, c, rtl }) {
  const { openPremium } = usePremium();
  return (
    <ScrollView contentContainerStyle={s.page}>
      <Text style={[s.title, { color: c.ink, textAlign: rtl ? 'right' : 'left' }]}>{title}</Text>
      <View style={[s.box, { backgroundColor: c.card, borderColor: c.line }]} testID="premium-locked">
        <View style={[s.icon, { backgroundColor: c.accentSoft }]}>
          <Crown size={28} color={c.accent} />
        </View>
        <Text style={{ color: c.ink, fontSize: 17, fontWeight: '700', textAlign: 'center' }}>{t.premiumFeature}</Text>
        <Text style={{ color: c.muted, fontSize: 14, lineHeight: 22, textAlign: 'center' }}>{body}</Text>
        {hint ? <Text style={{ color: c.muted, fontSize: 12, textAlign: 'center' }}>{hint}</Text> : null}
        <Button label={t.premiumSee} onPress={openPremium} c={c} rtl={rtl} variant="primary" style={{ alignSelf: 'stretch' }} />
      </View>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  page: { paddingTop: 25, paddingBottom: 22, gap: 16 },
  title: { fontSize: 28, fontWeight: '600' },
  box: { borderWidth: 1, borderRadius: 22, padding: 24, gap: 12, alignItems: 'center' },
  icon: { width: 60, height: 60, borderRadius: 30, alignItems: 'center', justifyContent: 'center' },
});
