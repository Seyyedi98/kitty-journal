import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Check, Crown, Lock } from 'lucide-react-native';
import { ScrollView, Text } from '../ui';
import { Button, Card, Note, Segmented, SubHeader } from '../components/common';
import { Dialog } from '../platform/dialog';
import { PREMIUM_FEATURES } from '../premium';

const FREE_ITEMS = ['pfFreeEntries', 'pfFreeSearch', 'pfFreeBackup', 'pfFreeReminders', 'pfFreeShare', 'pfFreeLook', 'pfFreeInsights'];

/** What Free and Premium include, plus the plan switch used while testing. */
export default function PremiumScreen({ t, c, rtl, premium, setPremium, onBack }) {
  const align = rtl ? 'right' : 'left';
  const item = (Icon, text, tone, key) => (
    <View key={key} style={[s.item, rtl && s.rowReverse]}>
      <Icon size={16} color={tone} />
      <Text style={{ color: c.ink, fontSize: 14, flex: 1, textAlign: align }}>{text}</Text>
    </View>
  );
  return (
    <ScrollView contentContainerStyle={s.page}>
      <SubHeader title={t.premium} onBack={onBack} c={c} rtl={rtl} t={t} />

      <View style={[s.hero, { backgroundColor: c.accentSoft, borderColor: c.line }]}>
        <Crown size={30} color={c.accent} />
        <Text style={{ color: c.ink, fontSize: 20, fontWeight: '700', textAlign: 'center' }}>{t.premiumTitle}</Text>
        <Text style={{ color: c.muted, fontSize: 14, lineHeight: 21, textAlign: 'center' }}>{t.premiumSubtitle}</Text>
      </View>

      <Card title={t.premiumPlan} c={c} rtl={rtl}>
        <Segmented
          c={c}
          rtl={rtl}
          value={premium ? 'premium' : 'free'}
          onChange={(v) => setPremium(v === 'premium')}
          options={[
            { value: 'free', label: t.planFree },
            { value: 'premium', label: t.planPremium },
          ]}
        />
        <Text style={{ color: c.muted, fontSize: 11, textAlign: align }}>{t.planTestHint}</Text>
      </Card>

      <Card title={t.premiumIncluded} c={c} rtl={rtl}>
        {PREMIUM_FEATURES.map((k) => item(premium ? Check : Lock, t[`pf_${k}`], c.accent, k))}
        {!premium ? (
          <Button
            label={t.premiumUpgrade}
            onPress={() => Dialog.alert(t.premiumUpgrade, t.premiumUpgradeSoon)}
            c={c}
            rtl={rtl}
            variant="primary"
          />
        ) : null}
      </Card>

      <Card title={t.premiumFreeIncluded} c={c} rtl={rtl}>
        {FREE_ITEMS.map((k) => item(Check, t[k], c.muted, k))}
      </Card>

      <Note c={c} rtl={rtl}>{t.premiumDataNote}</Note>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  page: { paddingTop: 25, paddingBottom: 120, gap: 12 },
  rowReverse: { flexDirection: 'row-reverse' },
  hero: { borderWidth: 1, borderRadius: 22, padding: 22, gap: 8, alignItems: 'center' },
  item: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 3 },
});
