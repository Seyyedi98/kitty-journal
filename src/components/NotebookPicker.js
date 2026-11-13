import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Text } from '../ui';
import { usePremium } from '../premium';
import { colorHex } from '../utils/notebooks';

/**
 * Editor: which notebook this entry is in (0 = Personal). Only shown when notebooks exist.
 * Moving an entry INTO a notebook is a Plus feature; moving it back to Personal never is.
 */
export default function NotebookPicker({ notebooks, value, onChange, t, c, rtl }) {
  const { premium, request } = usePremium();
  const items = [{ id: 0, name: t.notebookPersonal, color: null }, ...notebooks];
  return (
    <View style={[s.row, rtl && s.rowReverse]}>
      {items.map((n) => {
        const selected = value === n.id;
        return (
          <Pressable
            key={n.id}
            onPress={() => (n.id !== 0 && !premium && !selected ? request('notebooks') : onChange(n.id))}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            style={[s.chip, { backgroundColor: selected ? c.sage : c.card, borderColor: selected ? c.sageDark : c.line }, rtl && s.rowReverse]}
          >
            {n.color ? <View style={[s.dot, { backgroundColor: colorHex(n.color) }]} /> : null}
            <Text numberOfLines={1} style={{ color: selected ? c.sageDark : c.muted, fontSize: 12, fontWeight: '600', maxWidth: 160 }}>{n.name}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const s = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  rowReverse: { flexDirection: 'row-reverse' },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderRadius: 99, paddingVertical: 7, paddingHorizontal: 12 },
  dot: { width: 10, height: 10, borderRadius: 5 },
});
