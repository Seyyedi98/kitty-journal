import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Lock } from 'lucide-react-native';
import { Text } from '../ui';
import { dateKey, formatDateKey } from '../calendar';

function addMonths(d, n) {
  const r = new Date(d.getTime());
  const day = r.getDate();
  r.setDate(1);
  r.setMonth(r.getMonth() + n);
  const last = new Date(r.getFullYear(), r.getMonth() + 1, 0).getDate();
  r.setDate(Math.min(day, last));
  return r;
}
const addDays = (d, n) => new Date(d.getTime() + n * 86400000);

/** The day a capsule opens, at 08:00 local time. `d` is any Date; returns a new Date. */
export const atMorning = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 8, 0, 0, 0);

/** Date chooser (presets + day/month steppers) and the Seal button. `value` is a Date, `onChange(Date)`. */
export default function CapsuleSection({ value, onChange, onSeal, busy, t, c, rtl, language, calendar }) {
  const tomorrow = addDays(atMorning(new Date()), 1);
  const set = (d) => onChange(atMorning(d) < tomorrow ? tomorrow : atMorning(d));
  const Dn = rtl ? ChevronRight : ChevronLeft;
  const Up = rtl ? ChevronLeft : ChevronRight;
  const DnM = rtl ? ChevronsRight : ChevronsLeft;
  const UpM = rtl ? ChevronsLeft : ChevronsRight;
  const now = new Date();
  const presets = [
    [t.capWeek1, addDays(now, 7)], [t.capMonth1, addMonths(now, 1)], [t.capMonth3, addMonths(now, 3)],
    [t.capMonth6, addMonths(now, 6)], [t.capYear1, addMonths(now, 12)], [t.capYear5, addMonths(now, 60)],
  ];
  const step = (Icon, label, fn) => (
    <Pressable onPress={fn} accessibilityRole="button" accessibilityLabel={label} style={[s.step, { backgroundColor: c.sage }]}>
      <Icon size={16} color={c.sageDark} />
    </Pressable>
  );
  return (
    <View style={{ gap: 12 }}>
      <View style={[s.dateRow, { borderColor: c.line, backgroundColor: c.card }, rtl && s.rowReverse]}>
        {step(DnM, t.capMonth, () => set(addMonths(value, -1)))}
        {step(Dn, t.capDay, () => set(addDays(value, -1)))}
        <View style={{ flex: 1 }}>
          <Text style={{ color: c.muted, fontSize: 9, textAlign: 'center' }}>{t.capsuleUnlockOn}</Text>
          <Text style={{ color: c.ink, fontSize: 13, fontWeight: '600', textAlign: 'center' }}>
            {formatDateKey(dateKey(value), language, calendar, { dateStyle: 'full' })}
          </Text>
        </View>
        {step(Up, t.capDay, () => set(addDays(value, 1)))}
        {step(UpM, t.capMonth, () => set(addMonths(value, 1)))}
      </View>
      <View style={[s.chips, rtl && s.rowReverse]}>
        {presets.map(([label, d]) => (
          <Pressable key={label} onPress={() => set(d)} accessibilityRole="button" style={[s.chip, { borderColor: c.line, backgroundColor: c.card }]}>
            <Text style={{ color: c.muted, fontSize: 11, fontWeight: '600' }}>{label}</Text>
          </Pressable>
        ))}
      </View>
      <Pressable
        onPress={onSeal}
        disabled={busy}
        accessibilityRole="button"
        style={[s.seal, { backgroundColor: c.sageDark, opacity: busy ? 0.6 : 1 }, rtl && s.rowReverse]}
      >
        <Lock size={16} color={c.onAccent || '#fff'} />
        <Text style={{ color: c.onAccent || '#fff', fontWeight: '700', fontSize: 13 }}>{t.capsuleSeal}</Text>
      </Pressable>
    </View>
  );
}

const s = StyleSheet.create({
  rowReverse: { flexDirection: 'row-reverse' },
  dateRow: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderRadius: 16, padding: 6 },
  step: { width: 34, height: 34, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  chip: { borderWidth: 1, borderRadius: 99, paddingVertical: 6, paddingHorizontal: 11 },
  seal: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 12, borderRadius: 16 },
});
