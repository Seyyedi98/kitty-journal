import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { BadgeCheck, Check, CreditCard, Crown, Lock, RefreshCw, Tag } from 'lucide-react-native';
import { ScrollView, Text, TextInput } from '../ui';
import { Button, Card, Note, SubHeader } from '../components/common';
import { fmt } from '../i18n';
import { PREMIUM_FEATURES } from '../premium';
import { useAccount } from '../account/AccountContext';
import { ApiError, getApi } from '../account/api';
import { serverReady } from '../account/config';
import { errText } from '../account/errors';
import { daysLeft } from '../account/plan';
import { formatAmount, normalizePlans } from '../account/purchase';

const FREE_ITEMS = ['pfFreeEntries', 'pfFreeSearch', 'pfFreeBackup', 'pfFreeReminders', 'pfFreeShare', 'pfFreeLook', 'pfFreeInsights'];
const PAYMENT_NOTE = { paid: 'planPaid', failed: 'planFailed', cancelled: 'planCancelled', expired: 'planExpired' };

/** What Free and Plus include, and the plans to buy. Prices and discounts always come from the server. */
export default function PremiumScreen({ t, c, rtl, language = 'en', premium, num = String, onBack, onOpenAccount }) {
  const account = useAccount();
  const align = rtl ? 'right' : 'left';
  const row = rtl ? 'row-reverse' : 'row';
  const live = Boolean(account.user) && serverReady();

  const [status, setStatus] = useState('idle'); // idle | loading | ready | error
  const [data, setData] = useState(null);
  const [selected, setSelected] = useState(null);
  const [codeText, setCodeText] = useState('');
  const [applied, setApplied] = useState('');
  const [codeMsg, setCodeMsg] = useState({ text: '', ok: true });
  const [busy, setBusy] = useState('');
  const [msg, setMsg] = useState('');

  const load = useCallback(async (code) => {
    setStatus('loading');
    try {
      const raw = await account.authed((tok) => getApi().plans(tok, code || undefined));
      const n = normalizePlans(raw);
      setData(n);
      setSelected((cur) => (n.plans.some((p) => p.id === cur) ? cur : (n.plans.find((p) => p.badge === 'best_value') || n.plans[0] || {}).id || null));
      if (code) {
        const ok = Boolean(n.code && n.code.valid);
        setApplied(ok ? n.code.value : '');
        setCodeMsg(ok ? { text: fmt(t.planCodeApplied, { code: n.code.value }), ok: true } : { text: (n.code && n.code.message) || t.planCodeBad, ok: false });
      }
      setStatus('ready');
    } catch (e) {
      setMsg(errText(t, e, num));
      setStatus('error');
    }
  }, [account.authed, t, num]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { if (live) load(); }, [live, account.user && account.user.id]); // eslint-disable-line react-hooks/exhaustive-deps
  // coming back from the payment page (or opening this screen while an order is open): ask the server how it went
  useEffect(() => { if (account.pendingOrder) account.checkOrder(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const plan = useMemo(() => (data ? data.plans.find((p) => p.id === selected) : null), [data, selected]);
  const cur = data ? t[`cur_${data.currency}`] : '';
  const money = (v) => formatAmount(v, language);
  const planTitle = (p) => p.title || (p.months ? (p.months === 1 ? t.planMonth1 : fmt(t.planMonthsN, { n: num(p.months) })) : p.days ? fmt(t.planDaysN, { n: num(p.days) }) : p.id);

  const applyCode = () => {
    const code = codeText.trim().toUpperCase();
    if (!code) return;
    setMsg('');
    load(code);
  };
  const removeCode = () => { setApplied(''); setCodeText(''); setCodeMsg({ text: '', ok: true }); setMsg(''); load(''); };

  const pay = async () => {
    if (!plan || busy) return;
    setBusy('pay'); setMsg('');
    try {
      await account.startCheckout(plan.id, applied || undefined);
    } catch (e) {
      setMsg(e instanceof ApiError && e.serverCode === 'invalid_discount_code' ? t.planCodeBad : errText(t, e, num));
    } finally {
      setBusy('');
    }
  };
  const checkNow = async () => {
    if (busy) return;
    setBusy('check'); setMsg('');
    const r = await account.checkOrder();
    if (r === 'pending' || r === 'unknown') setMsg(t.planStillPending);
    setBusy('');
  };

  const item = (Icon, text, tone, key) => (
    <View key={key} style={[s.item, rtl && s.rowReverse]}>
      <Icon size={16} color={tone} />
      <Text style={{ color: c.ink, fontSize: 14, flex: 1, textAlign: align }}>{text}</Text>
    </View>
  );
  const input = { borderWidth: 1, borderColor: c.line, backgroundColor: c.card, color: c.ink, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 9, fontSize: 15, flex: 1, textAlign: align };
  const paymentKey = account.payment && PAYMENT_NOTE[account.payment.status];
  const days = premium ? daysLeft(account.expiresAt) : null;

  return (
    <ScrollView contentContainerStyle={s.page}>
      <SubHeader title={t.premium} onBack={onBack} c={c} rtl={rtl} t={t} />

      <View style={[s.hero, { backgroundColor: c.accentSoft, borderColor: c.line }]}>
        <Crown size={30} color={c.accent} />
        <Text style={{ color: c.ink, fontSize: 20, fontWeight: '700', textAlign: 'center' }}>{t.premiumTitle}</Text>
        <Text style={{ color: c.muted, fontSize: 14, lineHeight: 21, textAlign: 'center' }}>{t.premiumSubtitle}</Text>
      </View>

      {paymentKey ? <Note c={c} rtl={rtl} tone={account.payment.status === 'paid' ? 'ok' : 'danger'}>{t[paymentKey]}</Note> : null}

      <Card title={t.premiumIncluded} c={c} rtl={rtl}>
        {PREMIUM_FEATURES.map((k) => item(premium ? Check : Lock, t[`pf_${k}`], c.accent, k))}
      </Card>

      {serverReady() ? (
        <Card title={t.planSectionTitle} c={c} rtl={rtl}>
          {!account.user ? (
            <>
              <Text style={{ color: c.muted, fontSize: 13, lineHeight: 20, textAlign: align }}>{t.planNeedLogin}</Text>
              <Button label={t.planLogin} onPress={() => onOpenAccount && onOpenAccount()} c={c} rtl={rtl} variant="primary" />
            </>
          ) : status === 'loading' || status === 'idle' ? (
            <Text style={{ color: c.muted, fontSize: 13, textAlign: align }}>{t.planLoading}</Text>
          ) : status === 'error' ? (
            <>
              <Note c={c} rtl={rtl} tone="danger">{msg || t.planLoadFailed}</Note>
              <Button label={t.planRetry} onPress={() => load(applied)} c={c} rtl={rtl} variant="secondary" icon={RefreshCw} />
            </>
          ) : data && data.plans.length === 0 ? (
            <Text style={{ color: c.muted, fontSize: 13, textAlign: align }}>{t.planNone}</Text>
          ) : data ? (
            <>
              {premium && days !== null ? <Text style={{ color: c.muted, fontSize: 12, textAlign: align }}>{days <= 1 ? t.accPremiumLastDay : fmt(t.accPremiumDaysLeft, { n: num(days) })}</Text> : null}
              {data.notice ? <Note c={c} rtl={rtl}>{data.notice}</Note> : null}
              {data.plans.map((p) => {
                const on = p.id === selected;
                const left = p.discountEndsAt ? daysLeft(p.discountEndsAt) : null;
                return (
                  <Pressable
                    key={p.id}
                    onPress={() => setSelected(p.id)}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: on }}
                    style={[s.plan, { flexDirection: row, borderColor: on ? c.accent : c.line, backgroundColor: on ? c.accentSoft : c.card }]}
                  >
                    <View style={[s.radio, { borderColor: on ? c.accent : c.muted }]}>{on ? <View style={[s.dot, { backgroundColor: c.accent }]} /> : null}</View>
                    <View style={{ flex: 1, gap: 4 }}>
                      <View style={{ flexDirection: row, alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                        <Text style={{ color: c.ink, fontSize: 15, fontWeight: '700' }}>{planTitle(p)}</Text>
                        {p.badge === 'best_value' ? <Text style={[s.chip, { backgroundColor: c.accent, color: '#fff' }]}>{t.planBestValue}</Text> : null}
                        {p.discounted ? <Text style={[s.chip, { backgroundColor: '#E8F3E4', color: '#2F6B3A' }]}>{fmt(t.planOff, { n: num(p.percent) })}</Text> : null}
                      </View>
                      {p.discounted && p.discountLabel ? <Text style={{ color: c.muted, fontSize: 11, textAlign: align }}>{p.discountLabel}</Text> : null}
                      {p.discounted && left !== null && left <= 30 ? <Text style={{ color: '#B64E45', fontSize: 11, textAlign: align }}>{left <= 0 ? t.planEndsToday : fmt(t.planEndsIn, { n: num(left) })}</Text> : null}
                    </View>
                    <View style={{ alignItems: rtl ? 'flex-start' : 'flex-end' }}>
                      {p.discounted ? <Text style={{ color: c.muted, fontSize: 12, textDecorationLine: 'line-through' }}>{money(p.price)}</Text> : null}
                      <Text style={{ color: c.ink, fontSize: 16, fontWeight: '800' }}>{money(p.finalPrice)}</Text>
                      <Text style={{ color: c.muted, fontSize: 10 }}>{cur}</Text>
                    </View>
                  </Pressable>
                );
              })}

              <View style={{ gap: 6 }}>
                <Text style={{ color: c.muted, fontSize: 12, fontWeight: '700', textAlign: align }}>{t.planCodeLabel}</Text>
                {applied ? (
                  <View style={{ flexDirection: row, alignItems: 'center', gap: 8 }}>
                    <BadgeCheck size={18} color="#2F6B3A" />
                    <Text style={{ color: '#2F6B3A', fontSize: 13, flex: 1, textAlign: align }}>{codeMsg.text}</Text>
                    <Button label={t.planCodeRemove} onPress={removeCode} c={c} rtl={rtl} variant="secondary" style={{ minHeight: 38, paddingVertical: 7 }} />
                  </View>
                ) : (
                  <>
                    <View style={{ flexDirection: row, gap: 8, alignItems: 'center' }}>
                      <TextInput value={codeText} onChangeText={setCodeText} placeholder={t.planCodePh} placeholderTextColor={c.muted} autoCapitalize="characters" autoCorrect={false} maxLength={32} style={input} />
                      <Button label={t.planCodeApply} onPress={applyCode} c={c} rtl={rtl} variant="secondary" icon={Tag} disabled={!codeText.trim() || status === 'loading'} style={{ minHeight: 44 }} />
                    </View>
                    {codeMsg.text && !codeMsg.ok ? <Text style={{ color: '#B64E45', fontSize: 11, textAlign: align }}>{codeMsg.text}</Text> : null}
                  </>
                )}
              </View>

              {msg ? <Note c={c} rtl={rtl} tone="danger">{msg}</Note> : null}
              <Button
                label={plan ? fmt(premium ? t.planRenew : t.planPay, { amount: money(plan.finalPrice), cur }) : t.planNone}
                onPress={pay}
                c={c}
                rtl={rtl}
                variant="primary"
                icon={CreditCard}
                busy={busy === 'pay'}
                disabled={!plan || Boolean(busy)}
              />
              <Text style={{ color: c.muted, fontSize: 11, lineHeight: 17, textAlign: align }}>{t.planPayHint}</Text>

              {account.pendingOrder ? (
                <>
                  <Note c={c} rtl={rtl}>{t.planWaiting}</Note>
                  <Button label={busy === 'check' ? t.planChecking : t.planCheckNow} onPress={checkNow} c={c} rtl={rtl} variant="secondary" icon={RefreshCw} busy={busy === 'check'} disabled={Boolean(busy)} />
                </>
              ) : null}
            </>
          ) : null}
        </Card>
      ) : null}

      <Card title={t.premiumFreeIncluded} c={c} rtl={rtl}>
        {FREE_ITEMS.map((k) => item(Check, t[k], c.muted, k))}
      </Card>

      <Note c={c} rtl={rtl}>{t.premiumDataNote}</Note>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  page: { paddingTop: 25, paddingBottom: 24, gap: 12 },
  rowReverse: { flexDirection: 'row-reverse' },
  hero: { borderWidth: 1, borderRadius: 22, padding: 22, gap: 8, alignItems: 'center' },
  item: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 3 },
  plan: { borderWidth: 1.5, borderRadius: 16, padding: 12, gap: 10, alignItems: 'center' },
  radio: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  dot: { width: 10, height: 10, borderRadius: 5 },
  chip: { fontSize: 10, fontWeight: '700', paddingHorizontal: 7, paddingVertical: 2, borderRadius: 8, overflow: 'hidden' },
});
