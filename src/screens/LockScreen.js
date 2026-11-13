import React, { useEffect, useRef, useState } from 'react';
import { AppState, StyleSheet, View } from 'react-native';
import { Fingerprint, Lock } from 'lucide-react-native';
import { Pressable } from 'react-native';
import { Text } from '../ui';
import PinPad from '../components/PinPad';
import { fmt } from '../i18n';

/** Full-screen lock shown instead of the app while the lock is active. */
export default function LockScreen({ lock, t, c, rtl, insets }) {
  const [pin, setPin] = useState('');
  const [message, setMessage] = useState('');
  const [checking, setChecking] = useState(false);
  const [bioBusy, setBioBusy] = useState(false);
  const asked = useRef(false);
  const bioRunning = useRef(false);
  const alive = useRef(true);
  const lockedSecs = Math.ceil(lock.lockedForMs / 1000);
  const canBio = lock.config.biometric && lock.bioAvailable;

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  // One fingerprint attempt. Never throws, never overlaps with another one, and always says what happened.
  const attempt = async () => {
    // The system prompt moves the app to the background; that must not count as leaving it.
    const run = lock.runExternal(() => lock.tryBiometric(t.biometricPrompt, t.cancel));
    const timeout = new Promise((resolve) => setTimeout(() => resolve('timeout'), 30000)); // a prompt that never answers must not block the button forever
    try {
      return (await Promise.race([run, timeout])) === true;
    } catch {
      return false;
    }
  };

  const bio = async (auto = false) => {
    if (!canBio || lock.lockedForMs > 0 || bioRunning.current) return;
    bioRunning.current = true;
    if (alive.current) setBioBusy(true);
    try {
      let ok = await attempt();
      // Right after the app comes to the front Android can refuse the prompt at once ("not in foreground");
      // one quiet retry fixes that without the user having to press anything.
      if (!ok && auto && alive.current) {
        await new Promise((resolve) => setTimeout(resolve, 700));
        if (alive.current) ok = await attempt();
      }
      if (!ok && alive.current) setMessage(t.biometricFailed);
      else if (alive.current) setMessage('');
    } finally {
      bioRunning.current = false;
      if (alive.current) setBioBusy(false);
    }
  };

  // Ask for the fingerprint when the lock screen appears, but only once the app is really in the foreground.
  useEffect(() => {
    if (!canBio || asked.current) return undefined;
    asked.current = true;
    let timer = null;
    const start = () => {
      timer = setTimeout(() => bio(true), 350);
    };
    let sub = null;
    if (AppState.currentState === 'active') start();
    else {
      sub = AppState.addEventListener('change', (st) => {
        if (st === 'active' && !timer) start();
      });
    }
    return () => {
      if (timer) clearTimeout(timer);
      if (sub) sub.remove();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canBio]);

  const submit = async (value) => {
    if (checking) return;
    setChecking(true);
    try {
      const r = await lock.tryPin(value);
      setPin('');
      if (r === 'wrong') setMessage(t.pinWrong);
      else if (r === 'locked') setMessage('');
      else if (r === 'error') setMessage(t.pinErrorGeneric);
      else setMessage('');
    } catch {
      setPin('');
      setMessage(t.pinErrorGeneric);
    } finally {
      setChecking(false);
    }
  };

  const shown = lockedSecs > 0 ? fmt(t.pinLockedFor, { s: lockedSecs }) : message;
  return (
    <View style={[s.root, { backgroundColor: c.bg, paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24 }]}>
      <View style={[s.icon, { backgroundColor: c.sage }]}>
        <Lock size={26} color={c.sageDark} />
      </View>
      <Text style={{ color: c.ink, fontSize: 18, fontWeight: '700', textAlign: 'center' }}>{t.unlockTitle}</Text>
      <Text style={{ color: c.muted, fontSize: 12, textAlign: 'center', minHeight: 18 }}>{t.pinEnter}</Text>
      <View style={{ minHeight: 20 }}>
        {shown ? <Text style={{ color: c.danger, fontSize: 12, fontWeight: '600', textAlign: 'center' }}>{shown}</Text> : null}
      </View>
      <PinPad
        value={pin}
        onChange={setPin}
        onSubmit={submit}
        c={c}
        t={t}
        disabled={checking || lockedSecs > 0}
        extraKey={
          canBio ? (
            <Pressable onPress={() => bio(false)} hitSlop={10} accessibilityRole="button" accessibilityLabel={t.unlockBiometric} style={[s.bio, bioBusy && { opacity: 0.5 }]}>
              <Fingerprint size={24} color={c.sageDark} />
            </Pressable>
          ) : undefined
        }
      />
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8, paddingHorizontal: 24 },
  icon: { width: 60, height: 60, borderRadius: 30, alignItems: 'center', justifyContent: 'center', marginBottom: 6 },
  bio: { width: 68, height: 56, alignItems: 'center', justifyContent: 'center' },
});
