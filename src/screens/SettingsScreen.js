import React from 'react';
import { Image, Pressable, StyleSheet, View } from 'react-native';
import { Archive, Bell, Crown, UserRound, Palette, ChevronLeft, ChevronRight, Heart, HardDrive, Lock, Tag, Trash2 } from 'lucide-react-native';
import { ScrollView, Text } from '../ui';
import { Card, LinkRow, Segmented } from '../components/common';
import { fmt } from '../i18n';
import { usePremium } from '../premium';
import { useAccount } from '../account/AccountContext';

const PLUS_IMAGE = require('../../assets/images/plus-cat.png');

const themeLabelKey = (key) => `theme${String(key).charAt(0).toUpperCase()}${String(key).slice(1)}`;

/**
 * Settings. `onOpen(name)` navigates to a sub-screen; the rows shown here are
 * the ones whose screens exist in this build.
 */
export default function SettingsScreen({
  t,
  c,
  rtl,
  language,
  changeLanguage,
  calendarType,
  changeCalendar,
  appearance,
  setAppearance,
  theme,
  setTheme,
  dark,
  onOpen,
  premium = false,
  trashCount = 0,
  lockEnabled = false,
  num = String,
}) {
  const { request } = usePremium();
  const { user } = useAccount();
  const Chevron = rtl ? ChevronLeft : ChevronRight;
  const chevron = <Chevron size={16} color={c.muted} />;
  const align = rtl ? 'right' : 'left';
  return (
    <ScrollView contentContainerStyle={s.page}>
      <Text style={[s.title, { color: c.ink }]}>{t.settings}</Text>

      {!premium ? (
        <Pressable
          onPress={() => onOpen('premium')}
          accessibilityRole="button"
          accessibilityLabel={`${t.bannerTitle}. ${t.bannerCta}`}
          style={[s.banner, { backgroundColor: c.accentSoft, borderColor: c.line, flexDirection: rtl ? 'row-reverse' : 'row' }]}
        >
          <Image source={PLUS_IMAGE} style={s.bannerImg} resizeMode="contain" accessibilityIgnoresInvertColors />
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={{ color: c.ink, fontSize: 15, fontWeight: '800', textAlign: align }}>{t.bannerTitle}</Text>
            <Text numberOfLines={2} style={{ color: c.muted, fontSize: 12, lineHeight: 17, textAlign: align }}>{t.bannerText}</Text>
            <View style={[s.bannerCta, { backgroundColor: c.accent, alignSelf: rtl ? 'flex-end' : 'flex-start' }]}>
              <Text style={{ color: '#fff', fontSize: 12, fontWeight: '700' }}>{t.bannerCta}</Text>
            </View>
          </View>
        </Pressable>
      ) : null}

      <Card c={c} rtl={rtl} style={{ gap: 0 }}>
        <LinkRow icon={UserRound} title={t.account} subtitle={user ? fmt(t.accSignedInAs, { name: user.name || user.phone }) : t.accRowHint} onPress={() => onOpen('account')} trailing={chevron} c={c} rtl={rtl} last />
      </Card>

      <Card title={t.settingsGeneral} c={c} rtl={rtl}>
        <Text style={[s.label, { color: c.muted, textAlign: align }]}>{t.language}</Text>
        <Segmented
          c={c}
          rtl={rtl}
          value={language}
          onChange={changeLanguage}
          options={[
            { value: 'en', label: 'English' },
            { value: 'fa', label: 'فارسی' },
            { value: 'tr', label: 'Türkçe' },
          ]}
        />
        <Text style={[s.label, { color: c.muted, textAlign: align, marginTop: 6 }]}>{t.calendarType}</Text>
        <Segmented
          c={c}
          rtl={rtl}
          value={calendarType}
          onChange={changeCalendar}
          options={[
            { value: 'solarHijri', label: t.solarHijri },
            { value: 'gregorian', label: t.gregorian },
            { value: 'default', label: t.languageDefault },
          ]}
        />
      </Card>

      <Card c={c} rtl={rtl} style={{ gap: 0 }}>
        <LinkRow
          icon={Palette}
          title={t.appearance}
          subtitle={`${t[themeLabelKey(theme)] || ''} · ${t[appearance === 'system' ? 'system' : appearance === 'dark' ? 'dark' : 'light']}`}
          onPress={() => onOpen('appearance')}
          trailing={chevron}
          c={c}
          rtl={rtl}
          last
        />
      </Card>

      <Card title={t.settingsData} c={c} rtl={rtl} style={{ gap: 0 }}>
        <LinkRow icon={Archive} title={t.backup} onPress={() => onOpen('backup')} trailing={chevron} c={c} rtl={rtl} />
        <LinkRow icon={HardDrive} title={t.storage} onPress={() => onOpen('storage')} trailing={chevron} c={c} rtl={rtl} />
        <LinkRow icon={Lock} title={t.appLock} subtitle={lockEnabled ? t.lockEnabledMsg : premium ? undefined : t.premiumTag} onPress={() => (premium || lockEnabled ? onOpen('lock') : request('lock'))} trailing={chevron} c={c} rtl={rtl} />
        <LinkRow icon={Bell} title={t.reminders} onPress={() => onOpen('reminders')} trailing={chevron} c={c} rtl={rtl} />
        <LinkRow
          icon={Trash2}
          title={t.trash}
          subtitle={trashCount ? fmt(t.trashCount, { n: num(trashCount) }) : t.trashEmpty}
          onPress={() => onOpen('trash')}
          trailing={chevron}
          c={c}
          rtl={rtl}
        />
        <LinkRow icon={Tag} title={t.manageTags} onPress={() => onOpen('tags')} trailing={chevron} c={c} rtl={rtl} last />
      </Card>

      <View style={[s.privacy, { backgroundColor: c.card, borderColor: c.line }, rtl && s.rowReverse]}>
        <Heart size={20} color={c.sageDark} />
        <View style={{ flex: 1 }}>
          <Text style={{ color: c.ink, fontSize: 13, fontWeight: '700', textAlign: align }}>{t.privacyTitle}</Text>
          <Text style={{ color: c.muted, fontSize: 11, lineHeight: 17, marginTop: 5, textAlign: align }}>{t.privacyNote}</Text>
        </View>
      </View>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  page: { paddingTop: 25, paddingBottom: 24, gap: 2 },
  rowReverse: { flexDirection: 'row-reverse' },
  banner: { borderWidth: 1, borderRadius: 18, paddingVertical: 10, paddingHorizontal: 12, gap: 12, alignItems: 'center', marginBottom: 10 },
  bannerImg: { width: 64, height: 64 },
  bannerCta: { marginTop: 6, paddingHorizontal: 12, paddingVertical: 5, borderRadius: 999 },
  label: { fontSize: 12, fontWeight: '700' },
  eyebrow: { fontSize: 10, letterSpacing: 1.6, fontWeight: '700', marginBottom: 9 },
  title: { fontSize: 29, fontWeight: '500', marginTop: -4, marginBottom: 6 },
  privacy: { borderWidth: 1, borderRadius: 15, padding: 16, flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginTop: 14 },
});
