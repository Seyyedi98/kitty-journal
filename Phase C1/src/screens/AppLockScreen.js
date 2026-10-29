import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { ScrollView, Text } from '../ui';
import { Button, Card, Note, SubHeader, Segmented, ToggleRow } from '../components/common';
import PinPad from '../components/PinPad';
import { fmt } from '../i18n';

/**
 * App lock settings. A small state machine drives the PIN prompts:
 * menu | create -> confirmCreate | verifyDisable | verifyChange -> newPin -> confirmNew
 */
export default function AppLockScreen({ lock, t, c, rtl, onBack }) {
  const align = rtl ? 'right' : 'left';
  const [mode, setMode] = useState('menu');
  const [pin, setPin] = useState('');
  const [first, setFirst] = useState('');
  const [message, setMessage] = useState('');
  const [problem, setProblem] = useState(false);
  const [busy, setBusy] = useState(false);

  const reset = (to = 'menu') => {
    setMode(to);
    setPin('');
    setFirst('');
  };
  const say = (text, isProblem = false) => {
    setMessage(text);
    setProblem(isProblem);
  };
  const lockedMsg = () => fmt(t.pinLockedFor, { s: Math.max(1, Math.ceil(lock.lockedForMs / 1000)) });

  const submit = async (value) => {
    if (busy) return;
    setBusy(true);
    try {
      if (mode === 'create') {
        setFirst(value);
        setPin('');
        setMode('confirmCreate');
        say('');
      } else if (mode === 'confirmCreate') {
        if (value !== first) {
          say(t.pinMismatch, true);
          reset('create');
        } else {
          await lock.enable(value);
          reset();
          say(t.lockEnabledMsg);
        }
      } else if (mode === 'verifyDisable' || mode === 'verifyChange') {
        const r = await lock.confirmPin(value);
        setPin('');
        if (r === 'ok') {
          if (mode === 'verifyDisable') {
            await lock.disable();
            reset();
            say(t.lockDisabledMsg);
          } else {
            setMode('newPin');
            say('');
          }
        } else {
          say(r === 'locked' ? lockedMsg() : t.pinWrong, true);
        }
      } else if (mode === 'newPin') {
        setFirst(value);
        setPin('');
        setMode('confirmNew');
        say('');
      } else if (mode === 'confirmNew') {
        if (value !== first) {
          say(t.pinMismatch, true);
          reset('newPin');
        } else {
          await lock.changePin(value);
          reset();
          say(t.pinChanged);
        }
      }
    } catch (e) {
      console.warn('[kitty-journal] app lock action failed:', e);
      setPin('');
      say(t.pinErrorGeneric, true);
    } finally {
      setBusy(false);
    }
  };

  const titles = {
    create: [t.pinCreate, t.pinCreateHint],
    confirmCreate: [t.pinConfirm, ''],
    verifyDisable: [t.pinEnter, ''],
    verifyChange: [t.pinCurrent, ''],
    newPin: [t.pinNew, t.pinCreateHint],
    confirmNew: [t.pinConfirm, ''],
  };

  if (mode !== 'menu') {
    const [title, hint] = titles[mode];
    return (
      <ScrollView contentContainerStyle={s.page}>
        <SubHeader title={t.appLock} onBack={() => reset()} c={c} rtl={rtl} t={t} />
        <Card title={title} c={c} rtl={rtl}>
          {hint ? <Text style={{ color: c.muted, fontSize: 11, textAlign: align }}>{hint}</Text> : null}
          {message ? <Note c={c} rtl={rtl} tone={problem ? 'danger' : 'ok'}>{message}</Note> : null}
          <PinPad value={pin} onChange={setPin} onSubmit={submit} c={c} t={t} disabled={busy || lock.lockedForMs > 0} />
          <Button label={t.cancel} onPress={() => reset()} c={c} rtl={rtl} variant="secondary" />
        </Card>
      </ScrollView>
    );
  }

  const { config } = lock;
  return (
    <ScrollView contentContainerStyle={s.page}>
      <SubHeader title={t.appLock} onBack={onBack} c={c} rtl={rtl} t={t} />
      <Note c={c} rtl={rtl}>{t.appLockHint}</Note>
      <Note c={c} rtl={rtl}>{t.lockNote}</Note>

      {!config.enabled ? (
        <Button label={t.lockEnable} onPress={() => { say(''); setMode('create'); }} c={c} rtl={rtl} variant="primary" />
      ) : (
        <>
          <Card c={c} rtl={rtl}>
            <Button label={t.lockChangePin} onPress={() => { say(''); setMode('verifyChange'); }} c={c} rtl={rtl} />
            {lock.bioAvailable ? (
              <ToggleRow title={t.lockBiometric} value={config.biometric} onValueChange={lock.setBiometric} c={c} rtl={rtl} />
            ) : (
              <Note c={c} rtl={rtl}>{t.lockBiometricUnavailable}</Note>
            )}
          </Card>
          <Card title={t.lockRelock} c={c} rtl={rtl}>
            <Segmented
              value={config.relock}
              onChange={lock.setRelock}
              c={c}
              rtl={rtl}
              options={[
                { value: 'immediately', label: t.relockImmediately },
                { value: '1m', label: t.relock1m },
                { value: '5m', label: t.relock5m },
              ]}
            />
          </Card>
          <Button label={t.lockDisable} onPress={() => { say(''); setMode('verifyDisable'); }} c={c} rtl={rtl} variant="danger" />
        </>
      )}
      {message ? <Note c={c} rtl={rtl} tone={problem ? 'danger' : 'ok'}>{message}</Note> : null}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  page: { paddingTop: 22, paddingBottom: 40, gap: 14 },
});
