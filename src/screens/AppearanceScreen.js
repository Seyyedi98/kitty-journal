import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { ScrollView, Text } from '../ui';
import { Card, Note, Segmented, SubHeader } from '../components/common';
import ThemePicker from '../components/ThemePicker';
import { LATIN_FONTS, PERSIAN_FONTS, loadAllFonts } from '../fonts';
import { LATIN_FONT_FAMILIES, PERSIAN_FONT_FAMILIES } from '../ui';

const SAMPLE_FA = 'این یک نمونهٔ نوشتهٔ فارسی است ۱۲۳۴۵۶۷۸۹۰';
const SAMPLE_EN = 'The quick brown fox · Günaydın 0123456789';

/** Light / dark mode and the colour theme, on a page of their own so Settings stays short. */
export default function AppearanceScreen({ t, c, rtl, appearance, setAppearance, theme, setTheme, dark, language = 'en', faFont = 'vazirmatn', setFaFont = () => {}, latinFont = 'dmsans', setLatinFont = () => {}, onBack }) {
  const fa = language === 'fa';
  const list = fa ? PERSIAN_FONTS : LATIN_FONTS;
  const families = fa ? PERSIAN_FONT_FAMILIES : LATIN_FONT_FAMILIES;
  const [ready, setReady] = useState({}); // font key → loaded
  // the picker shows a sample in every font, so they are loaded while it is open
  useEffect(() => {
    let off = false;
    list.forEach((f) =>
      loadAllFonts([f]).then(() => { if (!off) setReady((r) => ({ ...r, [f.key]: true })); }),
    );
    return () => { off = true; };
  }, [list]);
  const current = fa ? faFont : latinFont;
  const choose = fa ? setFaFont : setLatinFont;
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

      <Card title={fa ? t.faFontTitle : t.latinFontTitle} c={c} rtl={rtl}>
        {list.map((f) => {
          const on = f.key === current;
          const fam = families[f.key];
          return (
            <Pressable
              key={f.key}
              onPress={() => choose(f.key)}
              accessibilityRole="radio"
              accessibilityState={{ selected: on }}
              style={[s.fontRow, { borderColor: on ? c.accent : c.line, backgroundColor: on ? c.accentSoft : c.card, flexDirection: rtl ? 'row-reverse' : 'row' }]}
            >
              <View style={[s.radio, { borderColor: on ? c.accent : c.muted }]}>{on ? <View style={[s.dot, { backgroundColor: c.accent }]} /> : null}</View>
              <View style={{ flex: 1, gap: 4 }}>
                <Text style={{ color: c.ink, fontSize: 13, fontWeight: '700', textAlign: rtl ? 'right' : 'left' }}>
                  {f.label}{!f.files ? ` · ${t.faFontDefault}` : ''}
                </Text>
                {ready[f.key] || !f.files ? (
                  <Text style={{ color: c.ink, fontSize: 16, lineHeight: 28, fontFamily: fam[400], textAlign: fa ? 'right' : 'left', writingDirection: fa ? 'rtl' : 'ltr' }}>{fa ? SAMPLE_FA : SAMPLE_EN}</Text>
                ) : null}
              </View>
            </Pressable>
          );
        })}
        <Note c={c} rtl={rtl}>{t.faFontHint}</Note>
      </Card>

      <Note c={c} rtl={rtl}>{t.themeHint}</Note>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  page: { paddingTop: 25, paddingBottom: 24, gap: 8 },
  fontRow: { borderWidth: 1.5, borderRadius: 14, padding: 12, gap: 10, alignItems: 'center' },
  radio: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  dot: { width: 10, height: 10, borderRadius: 5 },
});
