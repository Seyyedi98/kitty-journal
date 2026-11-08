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
import { currencyKey, formatAmount, normalizePlans, normalizeQuote } from '../account/purchase';

const FREE_ITEMS = ['pfFreeEntries', 'pfFreeSearch', 'pfFreeBackup', 'pfFreeReminders', 'pfFreeShare', 'pfFreeLook', 'pfFreeInsights'];
const PAYMENT_NOTE = { paid: 'planPaid', failed: 'planFailed', review: 'planReview', expired: 'planExpired' };
const GREEN = '#2F6B3A';
const RED = '#B64E45';

/** What Free and Plus include, and the plans to buy. Plans, prices and discount codes always come from the server. */
export default function PremiumScreen({ t, c, rtl, language = 'en', premium, num = String, onBack, onOpenAccount }) {
  const account = useAccount();
  const align = rtl ? 'right' : 'left';
  const row = rtl ? 'row-reverse' : 'row';
  const live = serverReady();

  const [status, setStatus] = useState('idle'); // idle | loading | ready | error
  const [data, setData] = useState(null);
  const [selected, setSelected] = useState(null);
  const [codeText, setCodeText] = useState('');
  const [applied, setApplied] = useState(''); // a code the server accepted
  const [quotes, setQuotes] = useState({}); // planId → { price, amount, discount } | { error }
  const [codeMsg, setCodeMsg] = useState('');
  const [busy, setBusy] = useState('');
  const [msg, setMsg] = useState('');

  const load = useCallback(async () => {
    setStatus('loading');
    try {
      const n = normalizePlans(await getApi().plans(), language);
      setData(n);
      setSelected((cur) => (n.plans.some((p) => p.id === cur) ? cur : (n.plans[0] || {}).id || null));
      setStatus('ready');
    } catch (e) {
      setMsg(errText(t, e, num));
      setStatus('error');
    }
  }, [language, t, num]);
  useEffect(() => { if (live) load(); }, [live, language]); // eslint-disable-line react-hooks/exhaustive-deps
  // opening this screen with a purchase still open (for example after the app was closed): ask the server how it went
  useEffect(() => { if (account.pendingOrder) account.pollOrder(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const plan = useMemo(() => (data ? data.plans.find((p) => p.id === selected) || null : null), [data, selected]);
  const cur = data ? t[currencyKey(data.currency)] : '';
  const money = (v) => formatAmount(v, language);
  const quote = plan ? quotes[plan.id] : null;
  const quoteOk = quote && !quote.error ? quote : null;

  const quoteError = (e) => (e instanceof ApiError && e.serverCode === 'invalid_code' ? e.message || t.planCodeBad : errText(t, e, num));

  // a code is applied: price the plan the user picks next with it too
  useEffect(() => {
    if (!applied || !plan || !account.user || quotes[plan.id]) return undefined;
    let off = false;
    (async () => {
      try {
        const q = normalizeQuote(await account.authed((tok) => getApi().checkDiscount(tok, plan.id, applied)));
        if (!off) setQuotes((m) => ({ ...m, [plan.id]: q || { error: t.planCodeBad } }));
      } catch (e) {
        if (!off) setQuotes((m) => ({ ...m, [plan.id]: { error: quoteError(e) } }));
        if (e instanceof ApiError && e.serverCode === 'unknown_product') load();
      }
    })();
    return () => { off = true; };
  }, [applied, selected, account.user && account.user.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const applyCode = async () => {
    const code = codeText.trim().toUpperCase();
    if (!code || !plan || busy) return;
    setBusy('code'); setCodeMsg(''); setMsg('');
    try {
      const q = normalizeQuote(await account.authed((tok) => getApi().checkDiscount(tok, plan.id, code)));
      if (!q) throw new ApiError('server', 'unexpected answer from the server');
      setApplied(code);
      setQuotes({ [plan.id]: q });
    } catch (e) {
      setCodeMsg(quoteError(e));
      if (e instanceof ApiError && e.serverCode === 'unknown_product') load();
    } finally {
      setBusy('');
    }
  };
  const removeCode = () => { setApplied(''); setQuotes({}); setCodeText(''); setCodeMsg(''); };

  const pay = async () => {
    if (!plan || busy) return;
    setBusy('pay'); setMsg('');
    try {
      await account.startCheckout(plan.id, quoteOk ? applied : undefined);
    } catch (e) {
      setMsg(errText(t, e, num));
      if (e instanceof ApiError && e.serverCode === 'unknown_product') load();
    } finally {
      setBusy('');
    }
  };
  const checkAgain = async () => {
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
  const payLabel = !plan ? t.planNone : quoteOk && quoteOk.amount === 0 ? t.planFreeCta : fmt(premium ? t.planRenew : t.planPay, { amount: money(quoteOk ? quoteOk.amount : plan.price), cur });

  return (
    <ScrollView contentContainerStyle={s.page}>
      <SubHeader title={t.premium} onBack={onBack} c={c} rtl={rtl} t={t} />

      <View style={[s.hero, { backgroundColor: c.accentSoft, borderColor: c.line }]}>
        <Crown size={30} color={c.accent} />
        <Text style={{ color: c.ink, fontSize: 20, fontWeight: '700', textAlign: 'center' }}>{t.premiumTitle}</Text>
        <Text style={{ color: c.muted, fontSize: 14, lineHeight: 21, textAlign: 'center' }}>{t.premiumSubtitle}</Text>
      </View>

      {paymentKey ? (
        <Note c={c} rtl={rtl} tone={account.payment.status === 'paid' ? 'ok' : 'danger'}>
          {account.payment.status === 'review' ? fmt(t.planReview, { id: account.payment.id || '' }) : t[paymentKey]}
        </Note>
      ) : null}

      <Card title={t.premiumIncluded} c={c} rtl={rtl}>
        {PREMIUM_FEATURES.map((k) => item(premium ? Check : Lock, t[`pf_${k}`], c.accent, k))}
      </Card>

      {live ? (
        <Card title={t.planSectionTitle} c={c} rtl={rtl}>
          {status === 'loading' || status === 'idle' ? (
            <Text style={{ color: c.muted, fontSize: 13, textAlign: align }}>{t.planLoading}</Text>
          ) : status === 'error' ? (
            <>
              <Note c={c} rtl={rtl} tone="danger">{msg || t.planLoadFailed}</Note>
              <Button label={t.planRetry} onPress={load} c={c} rtl={rtl} variant="secondary" icon={RefreshCw} />
            </>
          ) : !data || data.plans.length === 0 ? (
            <Text style={{ color: c.muted, fontSize: 13, textAlign: align }}>{t.planNone}</Text>
          ) : (
            <>
              {data.plans.map((p) => {
                const on = p.id === selected;
                const q = quotes[p.id];
                const cut = q && !q.error && q.amount < p.price ? q : null;
                return (
                  <Pressable
                    key={p.id}
                    onPress={() => { setSelected(p.id); setMsg(''); }}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: on }}
                    style={[s.plan, { flexDirection: row, borderColor: on ? c.accent : c.line, backgroundColor: on ? c.accentSoft : c.card }]}
                  >
                    <View style={[s.radio, { borderColor: on ? c.accent : c.muted }]}>{on ? <View style={[s.dot, { backgroundColor: c.accent }]} /> : null}</View>
                    <View style={{ flex: 1, gap: 3 }}>
                      <Text style={{ color: c.ink, fontSize: 15, fontWeight: '700', textAlign: align }}>{p.title}</Text>
                      {p.durationDays ? <Text style={{ color: c.muted, fontSize: 11, textAlign: align }}>{fmt(t.planDaysN, { n: num(p.durationDays) })}</Text> : null}
                      {cut ? <Text style={{ color: GREEN, fontSize: 11, textAlign: align }}>{fmt(t.planDiscountSaved, { amount: money(cut.discount), cur })}</Text> : null}
                      {q && q.error ? <Text style={{ color: RED, fontSize: 11, textAlign: align }}>{q.error}</Text> : null}
                    </View>
                    <View style={{ alignItems: rtl ? 'flex-start' : 'flex-end' }}>
                      {cut ? <Text style={{ color: c.muted, fontSize: 12, textDecorationLine: 'line-through' }}>{money(p.price)}</Text> : null}
                      <Text style={{ color: c.ink, fontSize: 16, fontWeight: '800' }}>{money(cut ? cut.amount : p.price)}</Text>
                      <Text style={{ color: c.muted, fontSize: 10 }}>{cur}</Text>
                    </View>
                  </Pressable>
                );
              })}

              {!account.user ? (
                <>
                  <Text style={{ color: c.muted, fontSize: 13, lineHeight: 20, textAlign: align }}>{t.planNeedLogin}</Text>
                  <Button label={t.planLogin} onPress={() => onOpenAccount && onOpenAccount()} c={c} rtl={rtl} variant="primary" />
                </>
              ) : (
                <>
                  <View style={{ gap: 6 }}>
                    <Text style={{ color: c.muted, fontSize: 12, fontWeight: '700', textAlign: align }}>{t.planCodeLabel}</Text>
                    {applied ? (
                      <View style={{ flexDirection: row, alignItems: 'center', gap: 8 }}>
                        <BadgeCheck size={18} color={GREEN} />
                        <Text style={{ color: GREEN, fontSize: 13, flex: 1, textAlign: align }}>{fmt(t.planCodeApplied, { code: applied })}</Text>
                        <Button label={t.planCodeRemove} onPress={removeCode} c={c} rtl={rtl} variant="secondary" style={{ minHeight: 38, paddingVertical: 7 }} />
                      </View>
                    ) : (
                      <>
                        <View style={{ flexDirection: row, gap: 8, alignItems: 'center' }}>
                          <TextInput value={codeText} onChangeText={(v) => { setCodeText(v); setCodeMsg(''); }} placeholder={t.planCodePh} placeholderTextColor={c.muted} autoCapitalize="characters" autoCorrect={false} maxLength={32} style={input} />
                          <Button label={t.planCodeApply} onPress={applyCode} c={c} rtl={rtl} variant="secondary" icon={Tag} busy={busy === 'code'} disabled={!codeText.trim() || !plan || Boolean(busy)} style={{ minHeight: 44 }} />
                        </View>
                        {codeMsg ? <Text style={{ color: RED, fontSize: 11, textAlign: align }}>{codeMsg}</Text> : null}
                      </>
                    )}
                  </View>

                  {msg ? <Note c={c} rtl={rtl} tone="danger">{msg}</Note> : null}
                  <Button label={payLabel} onPress={pay} c={c} rtl={rtl} variant="primary" icon={CreditCard} busy={busy === 'pay'} disabled={!plan || Boolean(busy) || Boolean(plan && quote && quote.error)} />
                  <Text style={{ color: c.muted, fontSize: 11, lineHeight: 17, textAlign: align }}>{t.planPayHint}</Text>

                  {account.pendingOrder ? (
                    <>
                      <Note c={c} rtl={rtl}>{account.polling ? t.planChecking : t.planWaiting}</Note>
                      <Button label={busy === 'check' || account.polling ? t.planChecking : t.planCheckNow} onPress={checkAgain} c={c} rtl={rtl} variant="secondary" icon={RefreshCw} busy={busy === 'check' || account.polling} disabled={Boolean(busy) || account.polling} />
                    </>
                  ) : null}
                </>
              )}
            </>
          )}
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
});
