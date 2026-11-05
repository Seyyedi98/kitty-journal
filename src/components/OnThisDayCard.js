import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Crown, History } from 'lucide-react-native';
import { Text } from '../ui';
import MoodFace from './MoodFace';
import { Button } from './common';
import { usePremium } from '../premium';
import { fmt } from '../i18n';
import { numberFormatter } from '../utils/format';

const MAX = 3;

/** "On this day": entries from earlier years. Renders nothing when there are none. */
export default function OnThisDayCard({ items, onOpen, language, t, c, rtl }) {
  const { premium, openPremium } = usePremium();
  if (!items || !items.length) return null;
  const num = numberFormatter(language);
  const align = rtl ? 'right' : 'left';
  // Free plan: a teaser that says there is something here, without showing it.
  if (!premium) {
    return (
      <View style={[s.card, { backgroundColor: c.card, borderColor: c.line }]} testID="on-this-day-locked">
        <View style={[s.head, rtl && s.rowReverse]}>
          <View style={[s.icon, { backgroundColor: c.accentSoft }]}>
            <Crown size={16} color={c.accent} />
          </View>
          <Text style={{ color: c.ink, fontSize: 15, fontWeight: '700', flex: 1, textAlign: align }}>{t.onThisDay}</Text>
        </View>
        <Text style={{ color: c.muted, fontSize: 13, lineHeight: 20, textAlign: align }}>
          {fmt(t.onThisDayLocked, { n: num(items.length) })}
        </Text>
        <Button label={t.premiumSee} onPress={openPremium} c={c} rtl={rtl} variant="primary" />
      </View>
    );
  }
  const shown = items.slice(0, MAX);
  return (
    <View style={[s.card, { backgroundColor: c.card, borderColor: c.line }]} testID="on-this-day">
      <View style={[s.head, rtl && s.rowReverse]}>
        <View style={[s.icon, { backgroundColor: c.sage }]}>
          <History size={16} color={c.sageDark} />
        </View>
        <Text style={{ color: c.ink, fontSize: 15, fontWeight: '700', flex: 1, textAlign: align }}>{t.onThisDay}</Text>
      </View>
      {shown.map(({ entry, yearsAgo }) => (
        <Pressable
          key={entry.id}
          onPress={() => onOpen(entry)}
          accessibilityRole="button"
          style={[s.row, { borderColor: c.line }, rtl && s.rowReverse]}
        >
          <View style={[s.pill, { backgroundColor: c.accentSoft }]}>
            <Text style={{ color: c.sageDark, fontSize: 11, fontWeight: '700' }}>
              {yearsAgo === 1 ? t.yearAgo : fmt(t.yearsAgo, { n: num(yearsAgo) })}
            </Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text numberOfLines={1} style={{ color: c.ink, fontSize: 13, fontWeight: '600', textAlign: align }}>
              {entry.title || entry.body?.slice(0, 52) || t.noTitle}
            </Text>
            {entry.title && entry.body ? (
              <Text numberOfLines={2} style={{ color: c.muted, fontSize: 11, marginTop: 2, textAlign: align }}>{entry.body}</Text>
            ) : null}
          </View>
          {entry.mood ? <MoodFace mood={entry.mood} size={22} /> : null}
        </Pressable>
      ))}
      {items.length > MAX ? (
        <Text style={{ color: c.muted, fontSize: 11, textAlign: align }}>{fmt(t.moreCount, { n: num(items.length - MAX) })}</Text>
      ) : null}
    </View>
  );
}

const s = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: 22, padding: 16, gap: 10 },
  rowReverse: { flexDirection: 'row-reverse' },
  head: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  icon: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, borderTopWidth: 1, paddingTop: 10 },
  pill: { borderRadius: 12, paddingHorizontal: 9, paddingVertical: 4 },
});
