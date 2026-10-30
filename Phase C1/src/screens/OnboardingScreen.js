import React, { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { BookOpen, Bell, Lock, Palette } from 'lucide-react-native';
import { ScrollView, Text } from '../ui';
import { Button, Note, Segmented } from '../components/common';
import { saveSetting } from '../db/repository';
import { DEFAULT_REMINDER } from '../services/reminders';
import { applyReminders, requestPermission } from '../platform/notifications';
import { reminderText } from '../services/reminderSync';

const PAGES = 4;

/** First-run welcome: language, privacy, look, optional reminder. Everything is skippable. */
export default function OnboardingScreen({
  db, t, c, rtl, insets, language, changeLanguage, calendarType, changeCalendar, appearance, setAppearance, onFinish,
  runExternal = (fn) => fn(),
}) {
  const [page, setPage] = useState(0);
  const [reminderMsg, setReminderMsg] = useState('');
  const [reminderOn, setReminderOn] = useState(false);
  const align = rtl ? 'right' : 'left';
  const last = page === PAGES - 1;

  const enableReminder = async () => {
    setReminderMsg('');
    try {
      const status = await runExternal(() => requestPermission());
      if (status !== 'granted') {
        setReminderMsg(t.reminderPermissionNeeded);
        return;
      }
      const next = { ...DEFAULT_REMINDER, enabled: true };
      await saveSetting(db, 'reminder', next);
      await applyReminders(next, reminderText(t));
      setReminderOn(true);
      setReminderMsg(t.reminderScheduled);
    } catch {
      setReminderMsg(t.reminderFailed);
    }
  };

  const icons = [BookOpen, Lock, Palette, Bell];
  const Icon = icons[page];
  const titles = [t.welcomeTitle, t.onbPrivacyTitle, t.onbCustomizeTitle, t.onbReminderTitle];
  const bodies = [t.welcomeBody, t.onbPrivacyBody, t.onbCustomizeBody, t.onbReminderBody];

  return (
    <View style={[s.root, { backgroundColor: c.bg, paddingTop: insets.top + 16, paddingBottom: insets.bottom + 16 }]}>
      <View style={[s.topRow, rtl && s.rowReverse]}>
        <View style={{ flex: 1 }} />
        {!last ? (
          <Pressable onPress={onFinish} accessibilityRole="button" accessibilityLabel={t.skip} hitSlop={10}>
            <Text style={{ color: c.muted, fontSize: 13, fontWeight: '600' }}>{t.skip}</Text>
          </Pressable>
        ) : null}
      </View>

      <ScrollView contentContainerStyle={s.body}>
        <View style={[s.icon, { backgroundColor: c.sage }]}>
          <Icon size={30} color={c.sageDark} />
        </View>
        <Text style={{ color: c.ink, fontSize: 22, fontWeight: '700', textAlign: 'center' }}>{titles[page]}</Text>
        <Text style={{ color: c.muted, fontSize: 14, lineHeight: 22, textAlign: 'center' }}>{bodies[page]}</Text>

        {page === 0 ? (
          <View style={s.picker}>
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
          </View>
        ) : null}

        {page === 2 ? (
          <View style={s.picker}>
            <Text style={{ color: c.ink, fontSize: 12, fontWeight: '700', textAlign: align }}>{t.calendarType}</Text>
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
            <Text style={{ color: c.ink, fontSize: 12, fontWeight: '700', textAlign: align, marginTop: 6 }}>{t.appearance}</Text>
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
          </View>
        ) : null}

        {page === 3 ? (
          <View style={s.picker}>
            <Button
              label={t.reminderEnable}
              onPress={enableReminder}
              c={c}
              rtl={rtl}
              variant={reminderOn ? 'secondary' : 'primary'}
              disabled={reminderOn}
            />
            {reminderMsg ? <Note c={c} rtl={rtl} tone={reminderOn ? 'ok' : 'danger'}>{reminderMsg}</Note> : null}
          </View>
        ) : null}
      </ScrollView>

      <View style={s.dots}>
        {Array.from({ length: PAGES }, (_, i) => (
          <View key={i} style={[s.dot, { backgroundColor: i === page ? c.sageDark : c.line, width: i === page ? 22 : 8 }]} />
        ))}
      </View>

      <View style={[s.nav, rtl && s.rowReverse]}>
        {page > 0 ? <Button label={t.back || t.cancel} onPress={() => setPage(page - 1)} c={c} rtl={rtl} style={{ flex: 1 }} /> : null}
        <Button
          label={last ? t.getStarted : t.next}
          onPress={() => (last ? onFinish() : setPage(page + 1))}
          c={c}
          rtl={rtl}
          variant="primary"
          style={{ flex: 1 }}
        />
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, paddingHorizontal: 22 },
  topRow: { flexDirection: 'row', minHeight: 28, alignItems: 'center' },
  rowReverse: { flexDirection: 'row-reverse' },
  body: { flexGrow: 1, alignItems: 'stretch', justifyContent: 'center', gap: 14, paddingVertical: 12 },
  icon: { width: 76, height: 76, borderRadius: 38, alignItems: 'center', justifyContent: 'center', alignSelf: 'center', marginBottom: 6 },
  picker: { gap: 8, marginTop: 10 },
  dots: { flexDirection: 'row', gap: 6, justifyContent: 'center', alignItems: 'center', marginVertical: 14 },
  dot: { height: 8, borderRadius: 4 },
  nav: { flexDirection: 'row', gap: 10 },
});
