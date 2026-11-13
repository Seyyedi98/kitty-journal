import React, { useRef } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { BookOpen, Settings2 } from 'lucide-react-native';
import { ScrollView, Text } from '../ui';
import { colorHex } from '../utils/notebooks';

function Chip({ selected, onPress, children, c, label }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={label}
      style={[s.chip, { backgroundColor: selected ? c.sage : c.card, borderColor: selected ? c.sageDark : c.line }]}
    >
      {children}
    </Pressable>
  );
}

/**
 * Home: a row to look at one notebook at a time. `value`: null = every notebook, 0 = Personal (no notebook), else a notebook id.
 * With no notebooks yet it is a single quiet button that opens the notebook manager.
 */
export default function NotebookBar({ notebooks, value, onChange, onManage, t, c, rtl }) {
  const scroller = useRef(null);
  if (!notebooks.length) {
    return (
      <Pressable onPress={onManage} accessibilityRole="button" style={[s.intro, { borderColor: c.line }, rtl && s.rowReverse]}>
        <BookOpen size={14} color={c.muted} />
        <Text style={{ color: c.muted, fontSize: 11, fontWeight: '600' }}>{t.notebooks}</Text>
      </Pressable>
    );
  }
  const dot = (hex) => <View style={[s.dot, { backgroundColor: hex }]} />;
  const txt = (on) => ({ color: on ? c.sageDark : c.muted, fontSize: 11, fontWeight: '600' });
  return (
    <View style={s.wrap}>
      <ScrollView
        ref={scroller}
        horizontal
        showsHorizontalScrollIndicator={false}
        keyboardShouldPersistTaps="always"
        contentContainerStyle={[s.row, rtl && s.rowReverse]}
        onContentSizeChange={() => {
          if (rtl) scroller.current?.scrollToEnd?.({ animated: false });
        }}
      >
        <Chip c={c} selected={value == null} onPress={() => onChange(null)} label={t.allEntries}>
          <BookOpen size={12} color={value == null ? c.sageDark : c.muted} />
          <Text style={txt(value == null)}>{t.allEntries}</Text>
        </Chip>
        <Chip c={c} selected={value === 0} onPress={() => onChange(value === 0 ? null : 0)} label={t.notebookPersonal}>
          <Text style={txt(value === 0)}>{t.notebookPersonal}</Text>
        </Chip>
        {notebooks.map((n) => (
          <Chip key={n.id} c={c} selected={value === n.id} onPress={() => onChange(value === n.id ? null : n.id)} label={n.name}>
            {dot(colorHex(n.color))}
            <Text numberOfLines={1} style={[txt(value === n.id), { maxWidth: 120 }]}>{n.name}</Text>
          </Chip>
        ))}
        <Chip c={c} selected={false} onPress={onManage} label={t.notebookManage}>
          <Settings2 size={13} color={c.muted} />
        </Chip>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { marginBottom: 8 },
  row: { flexDirection: 'row', gap: 7, paddingVertical: 2, flexGrow: 1 },
  rowReverse: { flexDirection: 'row-reverse' },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 5, borderWidth: 1, borderRadius: 99, paddingVertical: 6, paddingHorizontal: 11, minHeight: 32 },
  dot: { width: 9, height: 9, borderRadius: 5 },
  intro: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', borderWidth: 1, borderStyle: 'dashed', borderRadius: 99, paddingVertical: 5, paddingHorizontal: 11, marginBottom: 8 },
});
