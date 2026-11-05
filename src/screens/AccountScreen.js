import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { ChevronLeft, ChevronRight, CloudUpload, CloudDownload, Crown, LogOut, ShieldCheck, UserRound } from 'lucide-react-native';
import { ScrollView, Text, TextInput } from '../ui';
import { Card, Segmented } from '../components/common';
import { fmt } from '../i18n';
import { useAccount } from '../account/AccountContext';
import { ApiError, getApi } from '../account/api';
import { CODE_LENGTH, GENDERS, MAX_AGE, MIN_AGE, RESEND_SECONDS, serverReady } from '../account/config';
import { normalizeCode, normalizePhone, validateProfile } from '../account/validation';
import { backupNow, restoreNow } from '../account/cloudBackup';
import { usePremium } from '../premium';

const ERROR_KEY = { network: 'accErrNetwork', timeout: 'accErrNetwork', invalid_code: 'accErrCode', rate_limited: 'accErrRate', not_found: 'accErrNotFound', unauthorized: 'accErrSession', payment_required: 'accErrPaid', server: 'accErrServer' };
const errText = (t, e) => t[ERROR_KEY[e instanceof ApiError ? e.code : 'server']] || t.accErrServer;

function Field({ label, error, c, rtl, children }) {
  return (
    <View style={{ gap: 6 }}>
      <Text style={{ color: c.muted, fontSize: 12, fontWeight: '700', textAlign: rtl ? 'right' : 'left' }}>{label}</Text>
      {children}
      {error ? <Text style={{ color: '#B64E45', fontSize: 11, textAlign: rtl ? 'right' : 'left' }}>{error}</Text> : null}
    </View>
  );
}

function Button({ label, onPress, busy, disabled, c, kind = 'primary', icon: Icon }) {
  const primary = kind === 'primary';
  return (
    <Pressable
      onPress={onPress}
      disabled={busy || disabled}
      accessibilityRole="button"
      style={[s.btn, { backgroundColor: primary ? c.accent : 'transparent', borderColor: primary ? c.accent : c.line, opacity: disabled ? 0.5 : 1 }]}
    >
      {busy ? <ActivityIndicator size="small" color={primary ? '#FFFFFF' : c.muted} /> : Icon ? <Icon size={16} color={primary ? '#FFFFFF' : c.ink} /> : null}
      <Text style={{ color: primary ? '#FFFFFF' : c.ink, fontWeight: '700', fontSize: 13 }}>{label}</Text>
    </Pressable>
  );
}

/**
 * Account page. Logged out: login / register with a phone code. Logged in: profile, cloud text backup, sign out.
 * `intro` = shown once after the welcome pages, with a "Maybe later" button; onDone() closes it.
 */
export default function AccountScreen({ db, t, c, rtl, language, onBack, intro = false, onDone = () => {}, premium = false, num = String }) {
  const account = useAccount();
  const { request } = usePremium();
  const Back = rtl ? ChevronRight : ChevronLeft;
  const align = rtl ? 'right' : 'left';
  const ok = serverReady();

  // --- logged out ---
  const [mode, setMode] = useState('login');
  const [step, setStep] = useState('form');
  const [phone, setPhone] = useState('');
  const [name, setName] = useState('');
  const [age, setAge] = useState('');
  const [gender, setGender] = useState(null);
  const [code, setCode] = useState('');
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [busy, setBusy] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const pending = useRef(null); // { phone, profile } of the code that was sent

  useEffect(() => {
    if (cooldown <= 0) return undefined;
    const id = setTimeout(() => setCooldown((n) => n - 1), 1000);
    return () => clearTimeout(id);
  }, [cooldown]);

  const sendCode = async () => {
    const e164 = normalizePhone(phone);
    const next = {};
    if (!e164) next.phone = t.accErrPhone;
    let profile;
    if (mode === 'register') {
      const v = validateProfile({ name, age, gender });
      for (const k of Object.keys(v.errors)) next[k] = t[v.errors[k]];
      profile = v.value;
    }
    setErrors(next);
    setFormError('');
    if (Object.keys(next).length) return;
    setBusy(true);
    try {
      await account.requestCode(e164, mode, profile);
      pending.current = { phone: e164, profile };
      setCode('');
      setStep('code');
      setCooldown(RESEND_SECONDS);
    } catch (err) {
      setFormError(errText(t, err));
    } finally {
      setBusy(false);
    }
  };
  const confirmCode = async () => {
    const digits = normalizeCode(code);
    if (digits.length !== CODE_LENGTH) { setFormError(t.accErrCode); return; }
    setBusy(true);
    setFormError('');
    try {
      await account.verifyCode(pending.current.phone, digits, mode, pending.current.profile);
      if (intro) onDone();
    } catch (err) {
      setFormError(errText(t, err));
    } finally {
      setBusy(false);
    }
  };
  const resend = async () => {
    if (cooldown > 0 || busy) return;
    setBusy(true);
    try { await account.requestCode(pending.current.phone, mode, pending.current.profile); setCooldown(RESEND_SECONDS); setFormError(''); }
    catch (err) { setFormError(errText(t, err)); }
    finally { setBusy(false); }
  };

  // --- logged in: backup ---
  const [cloudMsg, setCloudMsg] = useState('');
  const [cloudErr, setCloudErr] = useState(false);
  const [cloudBusy, setCloudBusy] = useState('');
  const runCloud = async (kind) => {
    if (!premium) { request('cloudbackup'); return; }
    setCloudBusy(kind); setCloudMsg(''); setCloudErr(false);
    try {
      if (kind === 'up') {
        const r = await backupNow({ db, api: getApi(), token: account.token });
        account.setLastBackupAt(r.at);
        setCloudMsg(fmt(t.accBackupDone, { n: num(r.count) }));
      } else {
        const r = await restoreNow({ db, api: getApi(), token: account.token });
        setCloudMsg(fmt(t.accRestoreDone, { a: num(r.added), u: num(r.updated) }));
      }
    } catch (err) {
      setCloudErr(true);
      if (err instanceof ApiError && err.code === 'not_found') setCloudMsg(t.accNoBackup);
      else if (err instanceof ApiError && err.code === 'payment_required') setCloudMsg(t.accErrPaid);
      else setCloudMsg(err instanceof ApiError ? errText(t, err) : t.accErrServer);
    } finally {
      setCloudBusy('');
    }
  };

  const header = (
    <View style={[s.header, rtl && s.rowReverse]}>
      {!intro ? (
        <Pressable onPress={onBack} style={[s.back, rtl && s.rowReverse]} accessibilityRole="button" accessibilityLabel={t.backToSettings}>
          <Back size={18} color={c.muted} />
          <Text style={{ color: c.muted, fontSize: 13 }}>{t.backToSettings}</Text>
        </Pressable>
      ) : <View />}
    </View>
  );

  if (!account.ready) return <View style={s.center}><ActivityIndicator color={c.muted} /></View>;

  if (account.user) {
    const u = account.user;
    return (
      <ScrollView contentContainerStyle={s.page} keyboardShouldPersistTaps="handled">
        {header}
        <Text style={[s.title, { color: c.ink, textAlign: align }]}>{t.account}</Text>
        <Card c={c} rtl={rtl}>
          <View style={[s.profileRow, rtl && s.rowReverse]}>
            <View style={[s.avatar, { backgroundColor: c.sage }]}><UserRound size={24} color={c.sageDark} /></View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: c.ink, fontSize: 16, fontWeight: '700', textAlign: align }}>{u.name}</Text>
              <Text style={{ color: c.muted, fontSize: 12, marginTop: 3, textAlign: align }}>{u.phone}</Text>
              <Text style={{ color: c.muted, fontSize: 12, marginTop: 2, textAlign: align }}>{fmt(t.accAgeLine, { age: num(u.age), gender: t['gender_' + u.gender] || '' })}</Text>
            </View>
          </View>
        </Card>

        <Card title={t.accCloudBackup} c={c} rtl={rtl}>
          <Text style={{ color: c.muted, fontSize: 12, lineHeight: 18, textAlign: align }}>{t.accCloudNote}</Text>
          {!premium ? (
            <Pressable onPress={() => request('cloudbackup')} style={[s.lock, { backgroundColor: c.accentSoft, borderColor: c.line }, rtl && s.rowReverse]}>
              <Crown size={16} color={c.sageDark} />
              <Text style={{ color: c.ink, fontSize: 12, flex: 1, textAlign: align }}>{t.premium_cloudbackup}</Text>
            </Pressable>
          ) : (
            <Text style={{ color: c.muted, fontSize: 11, textAlign: align }}>
              {account.lastBackupAt ? fmt(t.accLastBackup, { when: new Date(account.lastBackupAt).toLocaleString(language === 'fa' ? 'fa-IR' : language === 'tr' ? 'tr-TR' : 'en-US') }) : t.accNeverBackedUp}
            </Text>
          )}
          <Button label={t.accBackupNow} icon={CloudUpload} onPress={() => runCloud('up')} busy={cloudBusy === 'up'} disabled={Boolean(cloudBusy) || !ok} c={c} />
          <Button label={t.accRestore} icon={CloudDownload} kind="secondary" onPress={() => runCloud('down')} busy={cloudBusy === 'down'} disabled={Boolean(cloudBusy) || !ok} c={c} />
          {cloudMsg ? <Text style={{ color: cloudErr ? '#B64E45' : c.sageDark, fontSize: 12, textAlign: align }}>{cloudMsg}</Text> : null}
        </Card>

        <Button label={t.accSignOut} icon={LogOut} kind="secondary" onPress={account.signOut} c={c} />
        <Text style={{ color: c.muted, fontSize: 11, lineHeight: 17, textAlign: align }}>{t.accSignOutNote}</Text>
      </ScrollView>
    );
  }

  const input = (extra) => [s.input, { color: c.ink, borderColor: c.line, backgroundColor: c.card, textAlign: rtl ? 'right' : 'left' }, extra];
  return (
    <ScrollView contentContainerStyle={s.page} keyboardShouldPersistTaps="handled">
      {header}
      <Text style={[s.title, { color: c.ink, textAlign: align }]}>{intro ? t.accIntroTitle : t.account}</Text>
      <Text style={{ color: c.muted, fontSize: 13, lineHeight: 20, textAlign: align }}>{intro ? t.accIntroBody : t.accBody}</Text>

      {!ok ? <Text style={[s.notice, { color: c.ink, backgroundColor: c.accentSoft, borderColor: c.line, textAlign: align }]}>{t.accNoServer}</Text> : null}

      {step === 'form' ? (
        <Card c={c} rtl={rtl}>
          <Segmented c={c} rtl={rtl} value={mode} onChange={(v) => { setMode(v); setErrors({}); setFormError(''); }} options={[{ value: 'login', label: t.accLogin }, { value: 'register', label: t.accRegister }]} />
          <Field label={t.accPhone} error={errors.phone} c={c} rtl={rtl}>
            <TextInput value={phone} onChangeText={setPhone} placeholder="+98 912 345 6789" placeholderTextColor={c.muted} keyboardType="phone-pad" autoComplete="tel" textContentType="telephoneNumber" style={input({ writingDirection: 'ltr' })} />
          </Field>
          {mode === 'register' ? (
            <>
              <Field label={t.accName} error={errors.name} c={c} rtl={rtl}>
                <TextInput value={name} onChangeText={setName} placeholder={t.accNamePh} placeholderTextColor={c.muted} autoComplete="name" textContentType="name" maxLength={60} style={input()} />
              </Field>
              <Field label={fmt(t.accAge, { min: num(MIN_AGE), max: num(MAX_AGE) })} error={errors.age} c={c} rtl={rtl}>
                <TextInput value={age} onChangeText={setAge} keyboardType="number-pad" maxLength={3} placeholder="25" placeholderTextColor={c.muted} style={input()} />
              </Field>
              <Field label={t.accGender} error={errors.gender} c={c} rtl={rtl}>
                <Segmented c={c} rtl={rtl} value={gender} onChange={setGender} options={GENDERS.map((g) => ({ value: g, label: t['gender_' + g] }))} />
              </Field>
            </>
          ) : null}
          {formError ? <Text style={{ color: '#B64E45', fontSize: 12, textAlign: align }}>{formError}</Text> : null}
          <Button label={t.accSendCode} onPress={sendCode} busy={busy} disabled={!ok} c={c} />
        </Card>
      ) : (
        <Card c={c} rtl={rtl}>
          <Text style={{ color: c.ink, fontSize: 13, textAlign: align }}>{fmt(t.accCodeSent, { phone: pending.current?.phone || '' })}</Text>
          <TextInput value={code} onChangeText={(v) => setCode(normalizeCode(v).slice(0, CODE_LENGTH))} keyboardType="number-pad" maxLength={CODE_LENGTH} autoComplete="sms-otp" textContentType="oneTimeCode" placeholder="••••••" placeholderTextColor={c.muted} style={input({ textAlign: 'center', letterSpacing: 8, fontSize: 22, writingDirection: 'ltr' })} />
          {formError ? <Text style={{ color: '#B64E45', fontSize: 12, textAlign: align }}>{formError}</Text> : null}
          <Button label={mode === 'register' ? t.accCreate : t.accLogin} onPress={confirmCode} busy={busy} disabled={normalizeCode(code).length !== CODE_LENGTH} c={c} />
          <View style={[s.linkRow, rtl && s.rowReverse]}>
            <Pressable onPress={resend} disabled={cooldown > 0 || busy}><Text style={{ color: cooldown > 0 ? c.muted : c.sageDark, fontSize: 12, fontWeight: '700' }}>{cooldown > 0 ? fmt(t.accResendIn, { n: num(cooldown) }) : t.accResend}</Text></Pressable>
            <Pressable onPress={() => { setStep('form'); setFormError(''); }}><Text style={{ color: c.muted, fontSize: 12 }}>{t.accChangePhone}</Text></Pressable>
          </View>
        </Card>
      )}

      <View style={[s.privacy, { backgroundColor: c.card, borderColor: c.line }, rtl && s.rowReverse]}>
        <ShieldCheck size={18} color={c.sageDark} />
        <Text style={{ color: c.muted, fontSize: 11, lineHeight: 17, flex: 1, textAlign: align }}>{t.accPrivacy}</Text>
      </View>
      {intro ? <Button label={t.accMaybeLater} kind="secondary" onPress={onDone} c={c} /> : null}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  page: { paddingTop: 20, paddingBottom: 120, gap: 12 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: { flexDirection: 'row', minHeight: 28 },
  back: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 4 },
  rowReverse: { flexDirection: 'row-reverse' },
  title: { fontSize: 29, fontWeight: '500', marginBottom: 2 },
  input: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 11, fontSize: 15 },
  btn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 13, borderWidth: 1, paddingVertical: 13, paddingHorizontal: 16 },
  notice: { borderWidth: 1, borderRadius: 12, padding: 12, fontSize: 12, lineHeight: 18 },
  lock: { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderRadius: 12, padding: 11 },
  profileRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  avatar: { width: 52, height: 52, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  linkRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  privacy: { borderWidth: 1, borderRadius: 15, padding: 14, flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
});
