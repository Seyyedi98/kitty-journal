import React from 'react';
import { Pressable, View } from 'react-native';
import { Check, Lock } from 'lucide-react-native';
import { Text } from '../ui';
import { THEME_KEYS, buildPalette } from '../theme';
import { FREE_THEME, usePremium } from '../premium';

// Every theme in theme.js is named `theme<Key>` in the translations (themeMidnight, themeSepia, ...), so new themes need no edit here.
const labelKey = (key) => `theme${key.charAt(0).toUpperCase()}${key.slice(1)}`;

/** Four colour-theme swatches. `dark` previews each theme in the current mode. */
export default function ThemePicker({ t, c, rtl, value, onChange, dark }) {
  const { premium, request } = usePremium();
  return (
    <View style={{ flexDirection: rtl ? 'row-reverse' : 'row', flexWrap: 'wrap', rowGap: 14, columnGap: 6 }}>
      {THEME_KEYS.map((key) => {
        const p = buildPalette(key, dark);
        const locked = !premium && key !== FREE_THEME;
        const selected = premium ? key === value : key === FREE_THEME;
        return (
          <Pressable
            key={key}
            testID={`theme-${key}`}
            accessibilityRole="button"
            accessibilityLabel={(t[labelKey(key)] || key)}
            accessibilityState={{ selected }}
            onPress={() => (locked ? request('themes') : onChange(key))}
            style={{ width: '22%', alignItems: 'center', gap: 6 }}
          >
            <View
              style={{
                width: 44, height: 44, borderRadius: 22, backgroundColor: p.accent,
                borderWidth: selected ? 3 : 1, borderColor: selected ? c.ink : c.line,
                alignItems: 'center', justifyContent: 'center',
              }}
            >
              {selected ? <Check size={18} color={p.onAccent} /> : locked ? <Lock size={14} color={p.onAccent} /> : null}
            </View>
            <Text style={{ color: c.ink, fontSize: 11, fontWeight: selected ? '700' : '500' }} numberOfLines={1}>
              {(t[labelKey(key)] || key)}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
