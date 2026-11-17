import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { ChevronLeft, ChevronRight, LifeBuoy, Plus } from 'lucide-react-native';
import { ScrollView, Text, TextInput } from '../ui';
import { Button, Card, Note, SubHeader } from '../components/common';
import { fmt } from '../i18n';
import { useAccount } from '../account/AccountContext';
import { ApiError, getApi } from '../account/api';
import { errText } from '../account/errors';
import { serverReady } from '../account/config';

const SUBJECT_MAX = 100;
const MESSAGE_MAX = 2000;
const REFRESH_MS = 20000;

const LOCALES = { fa: 'fa-IR', tr: 'tr-TR', en: 'en-GB' };
function when(iso, language) {
  try {
    return new Date(iso).toLocaleString(LOCALES[language] || 'en-GB', { dateStyle: 'medium', timeStyle: 'short' });
  } catch {
    return String(iso || '').slice(0, 16).replace('T', ' ');
  }
}

/** Support: the list of conversations, a new message form, and one conversation. Needs a signed-in account. */
export default function SupportScreen({ t, c, rtl, language, num = String, onBack, onOpenAccount }) {
  const account = useAccount();
  const signedIn = Boolean(account.user);
  const align = rtl ? 'right' : 'left';
  const Chevron = rtl ? ChevronLeft : ChevronRight;
  const [view, setView] = useState('list'); // 'list' | 'new' | 'thread'
  const [tickets, setTickets] = useState(null); // null = loading
  const [thread, setThread] = useState(null); // { ticket, messages }
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [reply, setReply] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const scroller = useRef(null);
  const openId = useRef(null);

  const problem = useCallback((e) => {
    if (e instanceof ApiError && e.serverCode === 'too_many_open') return t.supportTooMany;
    if (e instanceof ApiError && e.serverCode === 'ticket_full') return t.supportFull;
    if (e instanceof ApiError && e.code === 'rate_limited') return t.supportLimit;
    return errText(t, e, num);
  }, [t, num]);

  const loadList = useCallback(async () => {
    try {
      const r = await account.authed((tok) => getApi().supportList(tok));
      setTickets(Array.isArray(r && r.tickets) ? r.tickets : []);
    } catch (e) {
      setTickets((cur) => cur || []);
      setError(problem(e));
    }
  }, [account, problem]);

  const loadThread = useCallback(async (id) => {
    try {
      const r = await account.authed((tok) => getApi().supportGet(tok, id));
      if (openId.current === id) setThread(r);
    } catch (e) {
      setError(problem(e));
    }
  }, [account, problem]);

  useEffect(() => {
    if (signedIn && serverReady()) loadList();
  }, [signedIn, loadList]);

  // While a conversation is open, look for our answer from time to time.
  useEffect(() => {
    if (view !== 'thread' || !openId.current) return undefined;
    const id = setInterval(() => loadThread(openId.current), REFRESH_MS);
    return () => clearInterval(id);
  }, [view, loadThread]);

  const open = (id) => {
    openId.current = id;
    setThread(null);
    setError('');
    setReply('');
    setView('thread');
    loadThread(id);
  };
  const back = () => {
    if (view === 'list') return onBack();
    setError('');
    setView('list');
    loadList();
    return undefined;
  };

  const send = async () => {
    const sub = subject.trim();
    const msg = message.trim();
    if (sub.length < 3 || msg.length < 3) {
      setError(t.supportTooShort);
      return;
    }
    setBusy(true);
    setError('');
    try {
      const r = await account.authed((tok) => getApi().supportCreate(tok, sub, msg));
      setSubject('');
      setMessage('');
      if (r && r.ticket) open(r.ticket.id);
      else back();
    } catch (e) {
      setError(problem(e));
    } finally {
      setBusy(false);
    }
  };

  const sendReply = async () => {
    const msg = reply.trim();
    if (!msg || !openId.current) return;
    setBusy(true);
    setError('');
    try {
      await account.authed((tok) => getApi().supportReply(tok, openId.current, msg));
      setReply('');
      await loadThread(openId.current);
    } catch (e) {
      setError(problem(e));
    } finally {
      setBusy(false);
    }
  };

  const solve = async () => {
    if (!openId.current) return;
    setBusy(true);
    try {
      await account.authed((tok) => getApi().supportClose(tok, openId.current));
      await loadThread(openId.current);
    } catch (e) {
      setError(problem(e));
    } finally {
      setBusy(false);
    }
  };

  const input = (extra) => [s.input, { color: c.ink, borderColor: c.line, backgroundColor: c.card, textAlign: align }, extra];
  const statusText = (st) => (st === 'open' ? t.supportOpen : st === 'answered' ? t.supportAnswered : t.supportClosed);
  const header = <SubHeader title={t.support} onBack={back} c={c} rtl={rtl} t={t} />;

  if (!signedIn || !serverReady()) {
    return (
      <ScrollView contentContainerStyle={s.page}>
        {header}
        <Card c={c} rtl={rtl}>
          <Note c={c} rtl={rtl}>{t.supportSignIn}</Note>
          {serverReady() ? <Button label={t.account} onPress={onOpenAccount} c={c} rtl={rtl} variant="primary" /> : null}
        </Card>
      </ScrollView>
    );
  }

  if (view === 'new') {
    return (
      <ScrollView contentContainerStyle={s.page} keyboardShouldPersistTaps="handled">
        {header}
        <Card c={c} rtl={rtl}>
          <Text style={[s.label, { color: c.muted, textAlign: align }]}>{t.supportSubject}</Text>
          <TextInput value={subject} onChangeText={setSubject} placeholder={t.supportSubjectPh} placeholderTextColor={c.muted} maxLength={SUBJECT_MAX} style={input()} />
          <Text style={[s.label, { color: c.muted, textAlign: align }]}>{t.supportMessage}</Text>
          <TextInput value={message} onChangeText={setMessage} placeholder={t.supportMessagePh} placeholderTextColor={c.muted} multiline maxLength={MESSAGE_MAX} textAlignVertical="top" style={input({ minHeight: 140 })} />
          <Text style={{ color: c.muted, fontSize: 11, textAlign: rtl ? 'left' : 'right' }}>{fmt(t.supportCount, { n: num(message.length), max: num(MESSAGE_MAX) })}</Text>
          <Note c={c} rtl={rtl}>{t.supportTip}</Note>
          {error ? <Note c={c} rtl={rtl} tone="danger">{error}</Note> : null}
          <Button label={t.supportSend} onPress={send} busy={busy} disabled={!subject.trim() || !message.trim()} c={c} rtl={rtl} variant="primary" />
        </Card>
      </ScrollView>
    );
  }

  if (view === 'thread') {
    const tk = thread && thread.ticket;
    return (
      <ScrollView ref={scroller} contentContainerStyle={s.page} keyboardShouldPersistTaps="handled">
        {header}
        {!thread ? (
          <View style={s.center}>{error ? <Note c={c} rtl={rtl} tone="danger">{error}</Note> : <ActivityIndicator color={c.muted} />}</View>
        ) : (
          <>
            <Text style={{ color: c.ink, fontSize: 18, fontWeight: '700', textAlign: align }}>{tk.subject}</Text>
            <Text style={{ color: c.muted, fontSize: 12, textAlign: align }}>{statusText(tk.status)}</Text>
            {thread.messages.map((m) => {
              const mine = m.from === 'user';
              return (
                <View key={m.id} style={[s.bubble, { backgroundColor: mine ? c.accentSoft : c.card, borderColor: c.line, alignSelf: mine ? (rtl ? 'flex-start' : 'flex-end') : (rtl ? 'flex-end' : 'flex-start') }]}>
                  <Text style={{ color: c.muted, fontSize: 11, fontWeight: '700', textAlign: align }}>{mine ? t.supportYou : t.supportTeam} · {when(m.created_at, language)}</Text>
                  <Text selectable style={{ color: c.ink, fontSize: 14, lineHeight: 21, marginTop: 3, textAlign: align }}>{m.body}</Text>
                </View>
              );
            })}
            {tk.status === 'closed' ? <Note c={c} rtl={rtl}>{t.supportReopenHint}</Note> : null}
            <Card c={c} rtl={rtl}>
              <TextInput value={reply} onChangeText={setReply} placeholder={t.supportReplyPh} placeholderTextColor={c.muted} multiline maxLength={MESSAGE_MAX} textAlignVertical="top" style={input({ minHeight: 90 })} />
              {error ? <Note c={c} rtl={rtl} tone="danger">{error}</Note> : null}
              <Button label={t.supportSend} onPress={sendReply} busy={busy} disabled={!reply.trim()} c={c} rtl={rtl} variant="primary" />
              {tk.status !== 'closed' ? <Button label={t.supportSolved} onPress={solve} disabled={busy} c={c} rtl={rtl} /> : null}
            </Card>
          </>
        )}
      </ScrollView>
    );
  }

  return (
    <ScrollView contentContainerStyle={s.page}>
      {header}
      <Note c={c} rtl={rtl}>{t.supportIntro}</Note>
      <Button label={t.supportNew} icon={Plus} onPress={() => { setError(''); setView('new'); }} c={c} rtl={rtl} variant="primary" />
      {error ? <Note c={c} rtl={rtl} tone="danger">{error}</Note> : null}
      {tickets === null ? (
        <View style={s.center}><ActivityIndicator color={c.muted} /></View>
      ) : tickets.length === 0 ? (
        <Card c={c} rtl={rtl}>
          <View style={[s.emptyRow, rtl && s.rowReverse]}>
            <LifeBuoy size={20} color={c.muted} />
            <Text style={{ color: c.muted, fontSize: 13, flex: 1, textAlign: align }}>{t.supportEmpty}</Text>
          </View>
        </Card>
      ) : (
        tickets.map((tk) => (
          <Pressable key={tk.id} onPress={() => open(tk.id)} accessibilityRole="button" style={[s.ticket, { backgroundColor: c.card, borderColor: c.line }, rtl && s.rowReverse]}>
            <View style={{ flex: 1, gap: 2 }}>
              <Text numberOfLines={1} style={{ color: c.ink, fontSize: 14, fontWeight: tk.unread ? '800' : '600', textAlign: align }}>{tk.subject}</Text>
              <Text style={{ color: c.muted, fontSize: 11, textAlign: align }}>{statusText(tk.status)} · {when(tk.last_message_at, language)}</Text>
            </View>
            {tk.unread ? <View style={[s.dot, { backgroundColor: c.accent }]} accessibilityLabel={t.supportAnswered} /> : null}
            <Chevron size={16} color={c.muted} />
          </Pressable>
        ))
      )}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  page: { paddingTop: 20, paddingBottom: 28, gap: 12 },
  center: { alignItems: 'center', justifyContent: 'center', paddingVertical: 24 },
  label: { fontSize: 12, fontWeight: '700' },
  input: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 11, fontSize: 15 },
  bubble: { maxWidth: '88%', borderWidth: 1, borderRadius: 16, paddingHorizontal: 14, paddingVertical: 10 },
  ticket: { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12 },
  rowReverse: { flexDirection: 'row-reverse' },
  emptyRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  dot: { width: 10, height: 10, borderRadius: 5 },
});
