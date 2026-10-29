import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Delete } from 'lucide-react-native';
import { Text } from '../ui';
import { PIN_MAX, PIN_MIN } from '../services/lock';

const ROWS = [['1', '2', '3'], ['4', '5', '6'], ['7', '8', '9']];

/**
 * Digits-only PIN entry: dots + keypad. `onSubmit(pin)` fires from the OK key
 * once PIN_MIN digits are entered, or automatically at PIN_MAX digits.
 * Digits always run left-to-right, also in right-to-left languages.
 */
export default function PinPad({ value, onChange, onSubmit, c, t, disabled, extraKey }) {
  const press = (d) => {
    if (disabled || value.length >= PIN_MAX) return;
    const next = value + d;
    onChange(next);
    if (next.length === PIN_MAX) onSubmit(next);
  };
  const back = () => {
    if (!disabled && value.length) onChange(value.slice(0, -1));
  };
  const submit = () => {
    if (!disabled && value.length >= PIN_MIN) onSubmit(value);
  };

  const Key = ({ label, onPress, a11y, children, muted }) => (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={a11y || label}
      style={[s.key, { backgroundColor: muted ? 'transparent' : c.card, borderColor: muted ? 'transparent' : c.line, opacity: disabled ? 0.45 : 1 }]}
    >
      {children || <Text style={{ color: c.ink, fontSize: 22, fontWeight: '600' }}>{label}</Text>}
    </Pressable>
  );

  const slots = Math.max(PIN_MIN, value.length);
  return (
    <View style={s.wrap}>
      <View style={s.dots}>
        {Array.from({ length: slots }, (_, i) => (
          <View key={i} style={[s.dot, { backgroundColor: i < value.length ? c.sageDark : 'transparent', borderColor: c.sageDark }]} />
        ))}
      </View>
      {ROWS.map((row) => (
        <View key={row.join('')} style={s.row}>
          {row.map((d) => <Key key={d} label={d} onPress={() => press(d)} />)}
        </View>
      ))}
      <View style={s.row}>
        {extraKey || <View style={s.key} />}
        <Key label="0" onPress={() => press('0')} />
        <Key a11y={t.pinDelete} onPress={back} muted><Delete size={22} color={c.muted} /></Key>
      </View>
      <Pressable
        onPress={submit}
        disabled={disabled || value.length < PIN_MIN}
        accessibilityRole="button"
        accessibilityLabel={t.done}
        style={[s.ok, { backgroundColor: c.sageDark, opacity: disabled || value.length < PIN_MIN ? 0.35 : 1 }]}
      >
        <Text style={{ color: c.onAccent, fontWeight: '700', fontSize: 14 }}>{t.done}</Text>
      </Pressable>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { alignItems: 'center', gap: 10 },
  dots: { flexDirection: 'row', gap: 12, minHeight: 22, marginBottom: 10, alignItems: 'center' },
  dot: { width: 14, height: 14, borderRadius: 7, borderWidth: 2 },
  row: { flexDirection: 'row', gap: 12 },
  key: { width: 68, height: 56, borderRadius: 18, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  ok: { marginTop: 6, minWidth: 220, height: 48, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
});
