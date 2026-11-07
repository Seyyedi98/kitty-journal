import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { ChevronLeft, ChevronRight, CloudUpload, LogOut, Pencil, ShieldCheck, UserRound } from 'lucide-react-native';
import { ScrollView, Text, TextInput } from '../ui';
import { Card, Note, Segmented } from '../components/common';
import { fmt } from '../i18n';
import { useAccount } from '../account/AccountContext';
import { CODE_LENGTH, DEFAULT_RESEND_SECONDS, GENDERS, MAX_AGE, MIN_AGE, serverReady } from '../account/config';
import { normalizeCode, normalizePhone, validateProfile } from '../account/validation';
import { Dialog } from '../platform/dialog';
import { daysLeft } from '../account/plan';
import { errText } from '../account/errors';

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
  const danger = kind === 'danger'; // filled red: only Log out uses it
  const primary = kind === 'primary' || danger;
  return (
    <Pressable
      onPress={onPress}
      disabled={busy || disabled}
      accessibilityRole="button"
      style={[s.btn, { backgroundColor: danger ? '#C0392B' : primary ? c.accent : 'transparent', borderColor: danger ? '#C0392B' : primary ? c.accent : c.line, opacity: disabled ? 0.5 : 1 }]}
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
export default function AccountScreen({ db, t, c, rtl, language, onBack, onOpenBackup = () => {}, intro = false, onDone = () => {}, num = String }) {
  const account = useAccount();
  const Back = rtl ? ChevronRight : ChevronLeft;
  const align = rtl ? 'right' : 'left';
  const ok = serverReady();

  // --- phone → code ---
  const [step, setStep] = useState('phone');
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [phoneError, setPhoneError] = useState('');
  const [formError, setFormError] = useState('');
  const [busy, setBusy] = useState(false);
  const [resendAt, setResendAt] = useState(0); // end time, so the countdown survives the app being in the background
  const [, tick] = useState(0);
  const pending = useRef(null); // { phone, challengeId } of the code that was sent
  const cooldown = Math.max(0, Math.ceil((resendAt - Date.now()) / 1000));

  useEffect(() => {
    if (!resendAt || Date.now() >= resendAt) return undefined;
    const id = setInterval(() => { tick((n) => n + 1); if (Date.now() >= resendAt) clearInterval(id); }, 1000);
    return () => clearInterval(id);
  }, [resendAt]);
  const startCooldown = (r) => setResendAt(Date.now() + 1000 * (Number(r && r.resend_after) > 0 ? Number(r.resend_after) : DEFAULT_RESEND_SECONDS));

  const sendCode = async () => {
    const e164 = normalizePhone(phone);
    setPhoneError(e164 ? '' : t.accErrPhone);
    setFormError('');
    if (!e164) return;
    setBusy(true);
    try {
      const r = await account.requestCode(e164);
      pending.current = { phone: e164, challengeId: r && r.challenge_id };
      setCode('');
      setStep('code');
      startCooldown(r);
    } catch (err) {
      setFormError(errText(t, err, num));
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
      // New phone numbers are created by the server on first verification; the screen then asks for details.
      await account.verifyCode(pending.current.challengeId, digits, { phone: pending.current.phone });
    } catch (err) {
      setFormError(errText(t, err, num));
    } finally {
      setBusy(false);
    }
  };
  const resend = async () => {
    if (cooldown > 0 || busy) return;
    setBusy(true);
    try { const r = await account.requestCode(pending.current.phone); pending.current = { ...pending.current, challengeId: r && r.challenge_id }; startCooldown(r); setFormError(''); }
    catch (err) { setFormError(errText(t, err, num)); }
    finally { setBusy(false); }
  };

  // --- details (name, age, gender): asked right after a first sign-in, editable later ---
  const u0 = account.user;
  useEffect(() => { if (account.user) account.refreshEntitlement(true); }, [account.user?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState('');
  const [age, setAge] = useState('');
  const [gender, setGender] = useState(null);
  const [errors, setErrors] = useState({});
  const needsDetails = Boolean(u0 && !u0.name);
  const formOpen = needsDetails || editing;
  const openEdit = () => { setName(u0?.name || ''); setAge(u0?.age ? String(u0.age) : ''); setGender(u0?.gender || null); setErrors({}); setEditing(true); };
  const saveDetails = async () => {
    const v = validateProfile({ name, age, gender });
    const next = {};
    for (const k of Object.keys(v.errors)) next[k] = t[v.errors[k]];
    setErrors(next);
    if (!v.ok) return;
    setBusy(true);
    try { await account.saveProfile(v.value); setEditing(false); } finally { setBusy(false); }
  };
  // In the welcome flow the page closes by itself once the details are in.
  useEffect(() => { if (intro && u0 && u0.name) onDone(); }, [intro, u0?.name]); // eslint-disable-line react-hooks/exhaustive-deps

  const confirmSignOut = () =>
    Dialog.alert(t.accSignOut, t.accSignOutConfirm, [
      { text: t.cancel, style: 'cancel' },
      { text: t.accSignOut, style: 'destructive', onPress: () => account.signOut() },
    ]);

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

  const input = (extra) => [s.input, { color: c.ink, borderColor: c.line, backgroundColor: c.card, textAlign: rtl ? 'right' : 'left' }, extra];

  const detailsForm = (
    <Card c={c} rtl={rtl}>
      <Field label={t.accName} error={errors.name} c={c} rtl={rtl}>
        <TextInput value={name} onChangeText={setName} placeholder={t.accNamePh} placeholderTextColor={c.muted} autoComplete="name" textContentType="name" maxLength={60} style={input()} />
      </Field>
      <Field label={fmt(t.accAge, { min: num(MIN_AGE), max: num(MAX_AGE) })} error={errors.age} c={c} rtl={rtl}>
        <TextInput value={age} onChangeText={setAge} keyboardType="number-pad" maxLength={3} placeholder="25" placeholderTextColor={c.muted} style={input()} />
      </Field>
      <Field label={t.accGender} error={errors.gender} c={c} rtl={rtl}>
        <Segmented c={c} rtl={rtl} value={gender} onChange={setGender} options={GENDERS.map((g) => ({ value: g, label: t['gender_' + g] }))} />
      </Field>
      <Button label={t.accSaveProfile} onPress={saveDetails} busy={busy} c={c} />
      {editing && !needsDetails ? <Button label={t.cancel} kind="secondary" onPress={() => setEditing(false)} c={c} /> : null}
    </Card>
  );

  if (account.user && formOpen)
    return (
      <ScrollView contentContainerStyle={s.page} keyboardShouldPersistTaps="handled">
        {header}
        <Text style={[s.title, { color: c.ink, textAlign: align }]}>{needsDetails ? t.accDetailsTitle : t.accEditProfile}</Text>
        {needsDetails ? <Text style={{ color: c.muted, fontSize: 13, lineHeight: 20, textAlign: align }}>{t.accDetailsBody}</Text> : null}
        {detailsForm}
        {intro ? <Button label={t.accMaybeLater} kind="secondary" onPress={onDone} c={c} /> : null}
        {needsDetails ? <Button label={t.accSignOut} icon={LogOut} kind="danger" onPress={confirmSignOut} c={c} /> : null}
        {needsDetails ? <Text style={{ color: c.muted, fontSize: 11, lineHeight: 17, textAlign: align }}>{fmt(t.accSignedInAs, { name: account.user.phone })}</Text> : null}
      </ScrollView>
    );

  if (account.user) {
    const u = account.user;
    const left = account.premium ? daysLeft(account.expiresAt) : null;
    const planText = !account.premium
      ? t.planFree
      : left == null ? t.accPremiumNoExpiry : left <= 1 ? t.accPremiumLastDay : fmt(t.accPremiumDaysLeft, { n: num(left) });
    const rows = [
      [t.premiumPlan, planText],
      [t.accName, u.name],
      [t.accPhone, u.phone],
      [t.accAgeRow, num(u.age)],
      [t.accGender, t['gender_' + u.gender] || ''],
    ];
    return (
      <ScrollView contentContainerStyle={s.page} keyboardShouldPersistTaps="handled">
        {header}
        <Text style={[s.title, { color: c.ink, textAlign: align }]}>{t.account}</Text>
        <Card c={c} rtl={rtl}>
          <View style={[s.profileRow, rtl && s.rowReverse]}>
            <View style={[s.avatar, { backgroundColor: c.sage }]}><UserRound size={24} color={c.sageDark} /></View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: c.ink, fontSize: 17, fontWeight: '700', textAlign: align }}>{u.name}</Text>
              <Text style={{ color: c.muted, fontSize: 12, marginTop: 3, textAlign: align }}>{account.premium ? t.planPremium : t.planFree}{account.premium && left != null ? ' · ' + planText : ''}</Text>
            </View>
          </View>
          {account.premiumUnconfirmed ? <Note c={c} rtl={rtl} tone="danger">{t.accPremiumPaused}</Note> : null}
          {rows.map(([label, value]) => (
            <View key={label} style={[s.detailRow, { borderTopColor: c.line }, rtl && s.rowReverse]}>
              <Text style={{ color: c.muted, fontSize: 12 }}>{label}</Text>
              <Text style={{ color: c.ink, fontSize: 13, fontWeight: '600', writingDirection: label === t.accPhone ? 'ltr' : undefined }}>{value}</Text>
            </View>
          ))}
          <Button label={t.accEditProfile} kind="secondary" icon={Pencil} onPress={openEdit} c={c} />
        </Card>

        <Button label={t.accOpenBackup} icon={CloudUpload} kind="secondary" onPress={onOpenBackup} c={c} />

        <Button label={t.accSignOut} icon={LogOut} kind="danger" onPress={confirmSignOut} c={c} />
        <Text style={{ color: c.muted, fontSize: 11, lineHeight: 17, textAlign: align }}>{t.accSignOutNote}</Text>
      </ScrollView>
    );
  }

  return (
    <ScrollView contentContainerStyle={s.page} keyboardShouldPersistTaps="handled">
      {header}
      <Text style={[s.title, { color: c.ink, textAlign: align }]}>{intro ? t.accIntroTitle : t.account}</Text>
      <Text style={{ color: c.muted, fontSize: 13, lineHeight: 20, textAlign: align }}>{step === 'phone' ? (intro ? t.accIntroBody : t.accBody) : ''}</Text>

      {!ok ? <Text style={[s.notice, { color: c.ink, backgroundColor: c.accentSoft, borderColor: c.line, textAlign: align }]}>{t.accNoServer}</Text> : null}

      {step === 'phone' ? (
        <Card c={c} rtl={rtl}>
          <Field label={t.accPhone} error={phoneError} c={c} rtl={rtl}>
            <TextInput value={phone} onChangeText={setPhone} placeholder="+98 912 345 6789" placeholderTextColor={c.muted} keyboardType="phone-pad" autoComplete="tel" textContentType="telephoneNumber" style={input({ writingDirection: 'ltr' })} />
          </Field>
          <Text style={{ color: c.muted, fontSize: 11, lineHeight: 17, textAlign: align }}>{t.accNewOrOld}</Text>
          {formError ? <Text style={{ color: '#B64E45', fontSize: 12, textAlign: align }}>{formError}</Text> : null}
          <Button label={t.accSendCode} onPress={sendCode} busy={busy} disabled={!ok} c={c} />
        </Card>
      ) : (
        <Card c={c} rtl={rtl}>
          <Text style={{ color: c.ink, fontSize: 13, textAlign: align }}>{fmt(t.accCodeSent, { phone: pending.current?.phone || '' })}</Text>
          <TextInput value={code} onChangeText={(v) => setCode(normalizeCode(v).slice(0, CODE_LENGTH))} keyboardType="number-pad" maxLength={CODE_LENGTH} autoComplete="sms-otp" textContentType="oneTimeCode" placeholder="••••••" placeholderTextColor={c.muted} style={input({ textAlign: 'center', letterSpacing: 8, fontSize: 22, writingDirection: 'ltr' })} />
          {formError ? <Text style={{ color: '#B64E45', fontSize: 12, textAlign: align }}>{formError}</Text> : null}
          <Button label={t.continue} onPress={confirmCode} busy={busy} disabled={normalizeCode(code).length !== CODE_LENGTH} c={c} />
          <View style={[s.linkRow, rtl && s.rowReverse]}>
            <Pressable onPress={resend} disabled={cooldown > 0 || busy}><Text style={{ color: cooldown > 0 ? c.muted : c.sageDark, fontSize: 12, fontWeight: '700' }}>{cooldown > 0 ? fmt(t.accResendIn, { n: num(cooldown) }) : t.accResend}</Text></Pressable>
            <Pressable onPress={() => { setStep('phone'); setFormError(''); }}><Text style={{ color: c.muted, fontSize: 12 }}>{t.accChangePhone}</Text></Pressable>
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
  page: { paddingTop: 20, paddingBottom: 24, gap: 12 },
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
  backupRow: { flexDirection: 'row', alignItems: 'center', gap: 6, borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 10 },
  iconBtn: { minWidth: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderTopWidth: StyleSheet.hairlineWidth, paddingVertical: 10, gap: 12 },
  linkRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  privacy: { borderWidth: 1, borderRadius: 15, padding: 14, flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
});
