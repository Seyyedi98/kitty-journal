import React, { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { BookOpen, Bell, Cloud, Heart, Lock, Sparkles } from 'lucide-react-native';
import { ScrollView, Text } from '../ui';
import { Button, Note, Segmented } from '../components/common';
import TimeStepper from '../components/TimeStepper';
import { normalizeReminder } from '../services/reminders';
import { saveSetting } from '../db/repository';
import { DEFAULT_REMINDER } from '../services/reminders';
import { applyReminders, requestPermission } from '../platform/notifications';
import { reminderText } from '../services/reminderSync';

const PAGES = 6;

/** First-run welcome: language, privacy, look, optional reminder. Everything is skippable. */
export default function OnboardingScreen({
  db, t, c, rtl, insets, language, changeLanguage, calendarType, changeCalendar, lock, onLogin, onFinish,
  runExternal = (fn) => fn(),
}) {
  const [page, setPage] = useState(0);
  const [reminderMsg, setReminderMsg] = useState('');
  const [reminderOn, setReminderOn] = useState(false);
  const [rem, setRem] = useState(DEFAULT_REMINDER);
  const locale = ({ fa: 'fa-IR', tr: 'tr-TR' })[language] || 'en-US';
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
      const next = { ...rem, enabled: true };
      await saveSetting(db, 'reminder', next);
      await applyReminders(next, reminderText(t));
      setReminderOn(true);
      setReminderMsg(t.reminderScheduled);
    } catch {
      setReminderMsg(t.reminderFailed);
    }
  };

  const changeTime = async (time) => {
    const next = normalizeReminder({ ...rem, hour: time.hour, minute: time.minute });
    setRem(next);
    if (!reminderOn) return;
    try {
      await saveSetting(db, 'reminder', { ...next, enabled: true });
      await applyReminders({ ...next, enabled: true }, reminderText(t));
    } catch {
      setReminderMsg(t.reminderFailed);
    }
  };

  // 0 welcome · 1 companion · 2 passcode · 3 log in (later) · 4 reminders · 5 done
  const icons = [BookOpen, Heart, Lock, Cloud, Bell, Sparkles];
  const Icon = icons[page];
  const titles = [t.welcomeTitle, t.onbCompanionTitle, t.onbPrivacyTitle, t.onbCloudTitle, t.onbReminderTitle, t.onbDoneTitle];
  const bodies = [t.welcomeBody, t.onbCompanionBody, t.onbPrivacyBody, t.onbCloudBody, t.onbReminderBody, t.onbDoneBody];
  // On the action pages the main button reads "Skip" until the action has been done.
  const actionDone = [true, true, true, false, reminderOn, true][page];
  const mainLabel = last ? t.getStarted : actionDone ? t.next : t.skip;

  return (
    <View style={[s.root, { backgroundColor: c.bg, paddingTop: insets.top + 16, paddingBottom: insets.bottom + 16 }]}>
      <ScrollView contentContainerStyle={s.body}>
        <View style={[s.icon, { backgroundColor: c.sage }]}>
          <Icon size={30} color={c.sageDark} />
        </View>
        <Text style={{ color: c.ink, fontSize: 24, fontWeight: '700', textAlign: 'center' }}>{titles[page]}</Text>
        <Text style={{ color: c.muted, fontSize: 15, lineHeight: 23, textAlign: 'center' }}>{bodies[page]}</Text>

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

        {page === 3 ? (
          <View style={s.picker}>
            <Button label={t.onbLogin} onPress={() => onLogin && onLogin()} c={c} rtl={rtl} variant="primary" />
          </View>
        ) : null}

        {page === 4 ? (
          <View style={[s.picker, { gap: 26, marginTop: 18 }]}>
            <TimeStepper value={rem} onChange={changeTime} c={c} rtl={rtl} locale={locale} t={t} />
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
          label={mainLabel}
          onPress={() => (last ? onFinish() : setPage(page + 1))}
          c={c}
          rtl={rtl}
          variant={mainLabel === t.skip ? 'secondary' : 'primary'}
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
