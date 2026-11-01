import React from 'react';
import { StyleSheet } from 'react-native';
import { ScrollView } from '../ui';
import { Card, Note, Segmented, SubHeader } from '../components/common';
import ThemePicker from '../components/ThemePicker';

/** Light / dark mode and the colour theme, on a page of their own so Settings stays short. */
export default function AppearanceScreen({ t, c, rtl, appearance, setAppearance, theme, setTheme, dark, onBack }) {
  return (
    <ScrollView contentContainerStyle={s.page}>
      <SubHeader title={t.appearance} onBack={onBack} c={c} rtl={rtl} t={t} />

      <Card title={t.appearanceMode} c={c} rtl={rtl}>
        <Segmented
          c={c}
          rtl={rtl}
          value={appearance}
          onChange={setAppearance}
          options={[
            { value: 'light', label: t.light },
            { value: 'dark', label: t.dark },
            { value: 'system', label: t.system },
          ]}
        />
      </Card>

      <Card title={t.theme} c={c} rtl={rtl}>
        <ThemePicker t={t} c={c} rtl={rtl} value={theme} onChange={setTheme} dark={dark} />
      </Card>

      <Note c={c} rtl={rtl}>{t.themeHint}</Note>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  page: { paddingTop: 25, paddingBottom: 120, gap: 8 },
});
