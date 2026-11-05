import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { ScrollView, Text } from '../ui';
import { Button, Card, Note, SubHeader, ToggleRow } from '../components/common';
import { weekStartFor } from '../calendar';
import { loadSettings, saveSetting } from '../db/repository';
import { DEFAULT_REMINDER, normalizeReminder } from '../services/reminders';
import { applyReminders, requestPermission } from '../platform/notifications';
import TimeStepper from '../components/TimeStepper';
import { reminderText } from '../services/reminderSync';

const LOCALES = { en: 'en-US', fa: 'fa-IR', tr: 'tr-TR' };

/** Writing reminder: on/off, time of day, weekdays. */
export default function ReminderScreen({ db, t, c, rtl, language, onBack, runExternal = (fn) => fn() }) {
  const align = rtl ? 'right' : 'left';
  const locale = LOCALES[language] || 'en-US';
  const [reminder, setReminder] = useState(DEFAULT_REMINDER);
  const [loaded, setLoaded] = useState(false);
  const [message, setMessage] = useState('');
  const [problem, setProblem] = useState(false);

  useEffect(() => {
    let cancelled = false;
    loadSettings(db)
      .then((s) => {
        if (cancelled) return;
        setReminder(normalizeReminder(s.reminder));
        setLoaded(true);
      })
      .catch(() => setLoaded(true));
    return () => {
      cancelled = true;
    };
  }, [db]);

  // Weekday names for 0 = Sunday … 6 = Saturday, in the app language.
  const dayNames = useMemo(() => {
    if (locale.startsWith('fa')) return ['یکشنبه', 'دوشنبه', 'سه‌شنبه', 'چهارشنبه', 'پنج‌شنبه', 'جمعه', 'شنبه'];
    let f;
    try {
      f = new Intl.DateTimeFormat(locale, { weekday: 'short', timeZone: 'UTC' });
    } catch {
      f = new Intl.DateTimeFormat('en-US', { weekday: 'short', timeZone: 'UTC' });
    }
    return [0, 1, 2, 3, 4, 5, 6].map((d) => f.format(new Date(Date.UTC(2024, 0, 7 + d))));
  }, [locale]);
  // Persian weekday names are too long for the day buttons: show one letter, speak the whole name.
  const dayShort = (d) => (locale.startsWith('fa') ? ['ی', 'د', 'س', 'چ', 'پ', 'ج', 'ش'][d] : dayNames[d]);

  const commit = async (next, { announce = true } = {}) => {
    setProblem(false);
    setReminder(next);
    try {
      await saveSetting(db, 'reminder', next);
      const n = await applyReminders(next, reminderText(t));
      if (announce) setMessage(next.enabled && n ? t.reminderScheduled : t.reminderOffMsg);
    } catch (e) {
      console.warn('[kitty-journal] reminder failed:', e);
      setProblem(true);
      setMessage(t.reminderFailed);
    }
  };

  const toggle = async (value) => {
    setMessage('');
    if (!value) return commit({ ...reminder, enabled: false });
    const status = await runExternal(() => requestPermission());
    if (status !== 'granted') {
      setProblem(true);
      setMessage(t.reminderPermissionNeeded);
      return undefined;
    }
    return commit({ ...reminder, enabled: true });
  };


  const toggleDay = (d) => {
    const has = reminder.days.includes(d);
    if (has && reminder.days.length === 1) return; // keep at least one day
    const days = has ? reminder.days.filter((x) => x !== d) : [...reminder.days, d].sort();
    commit({ ...reminder, days }, { announce: reminder.enabled });
  };

  // Week starts on Saturday (Persian, shown right-to-left) or Monday.
  const first = weekStartFor(language);
  const week = [0, 1, 2, 3, 4, 5, 6].map((i) => (first + i) % 7);
  const order = rtl ? [...week].reverse() : week;
  return (
    <ScrollView contentContainerStyle={s.page}>
      <SubHeader title={t.reminders} onBack={onBack} c={c} rtl={rtl} t={t} />
      <Note c={c} rtl={rtl}>{t.remindersHint}</Note>

      <Card c={c} rtl={rtl}>
        <ToggleRow title={t.reminderEnable} value={reminder.enabled} onValueChange={toggle} c={c} rtl={rtl} disabled={!loaded} />
      </Card>

      <Card title={t.reminderTime} c={c} rtl={rtl}>
        <TimeStepper value={reminder} onChange={(time) => commit({ ...reminder, ...time }, { announce: reminder.enabled })} c={c} rtl={rtl} locale={locale} t={t} />
      </Card>

      <Card title={t.reminderDays} c={c} rtl={rtl}>
        <View style={s.days}>
          {order.map((d) => {
            const on = reminder.days.includes(d);
            return (
              <Pressable
                key={d}
                onPress={() => toggleDay(d)}
                accessibilityRole="button"
                accessibilityState={{ selected: on }}
                accessibilityLabel={dayNames[d]}
                style={[s.day, { backgroundColor: on ? c.sage : c.card, borderColor: on ? c.sageDark : c.line }]}
              >
                <Text style={{ color: on ? c.sageDark : c.muted, fontSize: locale.startsWith('fa') ? 15 : 12, fontWeight: on ? '700' : '500' }}>{dayShort(d)}</Text>
              </Pressable>
            );
          })}
        </View>
      </Card>

      {message ? <Note c={c} rtl={rtl} tone={problem ? 'danger' : 'ok'} style={{ textAlign: align }}>{message}</Note> : null}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  page: { paddingTop: 22, paddingBottom: 40, gap: 14 },
  row: { flexDirection: 'row', gap: 8 },
  rowReverse: { flexDirection: 'row-reverse' },
  days: { flexDirection: 'row', gap: 6, justifyContent: 'space-between' },
  day: { flex: 1, minHeight: 40, borderRadius: 12, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
});
