import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
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
  const asked = useRef(false);
  const lockedSecs = Math.ceil(lock.lockedForMs / 1000);
  const canBio = lock.config.biometric && lock.bioAvailable;

  const bio = async () => {
    if (!canBio || lock.lockedForMs > 0) return;
    // The system prompt moves the app to the background; that must not count as leaving it.
    await lock.runExternal(() => lock.tryBiometric(t.biometricPrompt, t.cancel));
  };

  useEffect(() => {
    if (canBio && !asked.current) {
      asked.current = true;
      bio();
    }
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
            <Pressable onPress={bio} accessibilityRole="button" accessibilityLabel={t.unlockBiometric} style={s.bio}>
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
