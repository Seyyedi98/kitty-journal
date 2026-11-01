import React from 'react';
import { Pressable, View } from 'react-native';
import { Minus, Plus } from 'lucide-react-native';
import { Text } from '../ui';
import { formatTime, stepTime } from '../services/reminders';

/** Time of day with separate hour (±1) and minute (±5) steppers. */
export default function TimeStepper({ value, onChange, c, rtl, locale, t }) {
  const bump = (deltaMinutes) => onChange({ ...value, ...stepTime(value, deltaMinutes) });
  const btn = (label, delta, Icon) => (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={() => bump(delta)}
      hitSlop={6}
      style={{ width: 38, height: 38, borderRadius: 19, borderWidth: 1, borderColor: c.line, backgroundColor: c.card, alignItems: 'center', justifyContent: 'center' }}
    >
      <Icon size={16} color={c.ink} />
    </Pressable>
  );
  const group = (title, minus, plus) => (
    <View style={{ alignItems: 'center', gap: 6 }}>
      <Text style={{ color: c.muted, fontSize: 11 }}>{title}</Text>
      <View style={{ flexDirection: rtl ? 'row-reverse' : 'row', gap: 8 }}>{minus}{plus}</View>
    </View>
  );
  return (
    <View style={{ alignItems: 'center', gap: 10 }}>
      <Text style={{ color: c.ink, fontSize: 28, fontWeight: '700' }} accessibilityLabel={t.reminderTime}>
        {formatTime(value.hour, value.minute, locale)}
      </Text>
      <View style={{ flexDirection: 'row', gap: 28 }}>
        {group(t.hourLabel, btn(`${t.hourLabel} −`, -60, Minus), btn(`${t.hourLabel} +`, 60, Plus))}
        {group(t.minuteLabel, btn(`${t.minuteLabel} −`, -5, Minus), btn(`${t.minuteLabel} +`, 5, Plus))}
      </View>
    </View>
  );
}
