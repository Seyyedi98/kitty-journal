import React from 'react';
import { Pressable, View } from 'react-native';
import { Check } from 'lucide-react-native';
import { Text } from '../ui';
import { THEMES, THEME_KEYS, buildPalette } from '../theme';

const LABEL = { sage: 'themeSage', rose: 'themeRose', lavender: 'themeLavender', ocean: 'themeOcean' };

/** Four colour-theme swatches. `dark` previews each theme in the current mode. */
export default function ThemePicker({ t, c, rtl, value, onChange, dark }) {
  return (
    <View style={{ flexDirection: rtl ? 'row-reverse' : 'row', gap: 10 }}>
      {THEME_KEYS.map((key) => {
        const p = buildPalette(key, dark);
        const selected = key === value;
        return (
          <Pressable
            key={key}
            testID={`theme-${key}`}
            accessibilityRole="button"
            accessibilityLabel={t[LABEL[key]]}
            accessibilityState={{ selected }}
            onPress={() => onChange(key)}
            style={{ flex: 1, alignItems: 'center', gap: 6 }}
          >
            <View
              style={{
                width: 44, height: 44, borderRadius: 22, backgroundColor: p.accent,
                borderWidth: selected ? 3 : 1, borderColor: selected ? c.ink : c.line,
                alignItems: 'center', justifyContent: 'center',
              }}
            >
              {selected ? <Check size={18} color={p.onAccent} /> : null}
            </View>
            <Text style={{ color: c.ink, fontSize: 11, fontWeight: selected ? '700' : '500' }} numberOfLines={1}>
              {t[LABEL[key]]}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
