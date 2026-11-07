import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { CloudDownload, CloudUpload, LogIn, Trash2 } from 'lucide-react-native';
import { Dialog } from '../platform/dialog';
import { Text } from '../ui';
import { Button, Card, Note } from './common';
import { fmt } from '../i18n';
import { formatBytes } from '../utils/format';
import { usePremium } from '../premium';
import { useAccount } from '../account/AccountContext';
import { getApi } from '../account/api';
import { FALLBACK_BACKUP_LIMIT, serverReady } from '../account/config';
import { backupLimitOf, backupNow, restoreNow } from '../account/cloudBackup';
import { errText } from '../account/errors';

/**
 * Cloud text backup, shown inside Backup & restore.
 * Everyone who is signed in can see, restore and delete their cloud backups; making a NEW one needs Premium.
 */
export default function CloudBackupCard({ db, t, c, rtl, language, num = String, onChanged, onOpenAccount }) {
  const account = useAccount();
  const { premium, request } = usePremium();
  const canCreate = premium || account.premium === true;
  const align = rtl ? 'right' : 'left';
  const [backups, setBackups] = useState(null); // null = not loaded yet
  const [limit, setLimit] = useState(null);
  const [busy, setBusy] = useState(''); // 'up' | 'r<id>' | 'd<id>' | ''
  const [msg, setMsg] = useState({ text: '', ok: true });
  const api = getApi();
  const say = (text, ok = true) => setMsg({ text, ok });
  const fail = (err) => {
    say(errText(t, err, num), false);
    if (err && err.code === 'payment_required') account.refreshEntitlement(true); // the plan may have changed on the server
  };

  const load = useCallback(async () => {
    try {
      const r = await account.authed((tok) => api.listBackups(tok));
      setBackups(Array.isArray(r && r.backups) ? r.backups : []);
      setLimit(backupLimitOf(r && r.limit) ?? FALLBACK_BACKUP_LIMIT);
    } catch (err) { setBackups([]); fail(err); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [account.authed]);
  useEffect(() => { if (account.user && serverReady()) { account.refreshEntitlement(true); load(); } }, [account.user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!account.user)
    return (
      <Card title={t.accCloudBackup} c={c} rtl={rtl}>
        <Text style={{ color: c.muted, fontSize: 11, lineHeight: 17, textAlign: align }}>{t.accLoginForCloud}</Text>
        <Button label={t.accGoLogin} onPress={onOpenAccount} c={c} rtl={rtl} variant="primary" icon={LogIn} disabled={!serverReady()} />
      </Card>
    );

  const makeBackup = async () => {
    if (!canCreate) { request('cloudbackup'); return; }
    setBusy('up'); say('');
    try {
      const r = await backupNow({ db, api, authed: account.authed, label: 'Phone backup ' + new Date().toISOString().slice(0, 16).replace('T', ' ') });
      account.setLastBackupAt(r.at);
      say(fmt(t.accBackupDone, { n: num(r.count) }));
      await load();
    } catch (err) { fail(err); } finally { setBusy(''); }
  };
  const runRestore = async (id) => {
    setBusy('r' + id); say('');
    try {
      const r = await restoreNow({ db, api, authed: account.authed, id });
      say(fmt(t.accRestoreDone, { a: num(r.added), u: num(r.updated) }));
      if (onChanged) await onChanged(); // show the restored entries right away
    } catch (err) { fail(err); } finally { setBusy(''); }
  };
  const askRestore = (id) =>
    Dialog.alert(t.accRestoreTitle, t.accRestoreConfirm, [
      { text: t.cancel, style: 'cancel' },
      { text: t.accRestoreBtn, onPress: () => runRestore(id) },
    ]);
  const runDelete = async (id) => {
    setBusy('d' + id); say('');
    try { await account.authed((tok) => api.deleteBackup(tok, id)); await load(); }
    catch (err) { fail(err); } finally { setBusy(''); }
  };
  const askDelete = (id) =>
    Dialog.alert(t.delete, t.accDeleteBackupConfirm, [
      { text: t.cancel, style: 'cancel' },
      { text: t.delete, style: 'destructive', onPress: () => runDelete(id) },
    ]);
  const when = (iso) => { const d = new Date(iso); return Number.isNaN(d.getTime()) ? '' : d.toLocaleString(language === 'fa' ? 'fa-IR' : language === 'tr' ? 'tr-TR' : 'en-US'); };

  const used = backups ? backups.length : null;
  return (
    <Card title={t.accCloudBackup} c={c} rtl={rtl}>
      <Text style={{ color: c.muted, fontSize: 11, lineHeight: 17, textAlign: align }}>{t.accCloudNote}</Text>
      {used != null ? <Text style={{ color: c.ink, fontSize: 12, fontWeight: '700', textAlign: align }}>{canCreate ? fmt(t.accBackupsUsed, { n: num(used), max: num(limit || FALLBACK_BACKUP_LIMIT) }) : fmt(t.accBackupsSaved, { n: num(used) })}</Text> : null}
      {!canCreate ? <Note c={c} rtl={rtl}>{t.accBackupPremiumOnly}</Note> : null}
      <Button
        label={busy === 'up' ? t.creatingBackup : t.accBackupNow}
        onPress={makeBackup}
        c={c} rtl={rtl}
        variant={canCreate ? 'primary' : 'secondary'}
        icon={CloudUpload}
        busy={busy === 'up'}
        disabled={Boolean(busy) || !serverReady()}
      />
      {msg.text ? <Note c={c} rtl={rtl} tone={msg.ok ? 'ok' : 'danger'}>{msg.text}</Note> : null}

      {backups && backups.length ? <Text style={{ color: c.ink, fontSize: 12, fontWeight: '700', marginTop: 6, textAlign: align }}>{t.accBackupsTitle}</Text> : null}
      {backups && !backups.length && !msg.text ? <Text style={{ color: c.muted, fontSize: 12, textAlign: align }}>{t.accNoBackups}</Text> : null}
      {(backups || []).map((b) => {
        const size = Number(b.size ?? b.size_bytes);
        return (
          <View key={b.id} style={[s.item, { borderColor: c.line, backgroundColor: c.paper }]}>
            <Text style={{ color: c.ink, fontSize: 13, fontWeight: '700', textAlign: align }}>{when(b.created_at || b.createdAt || b.date) || b.label || ''}</Text>
            <Text style={{ color: c.muted, fontSize: 11, textAlign: align }} numberOfLines={1}>
              {[b.label, Number.isFinite(size) && size > 0 ? formatBytes(size, language) : ''].filter(Boolean).join(' · ')}
            </Text>
            <Button
              label={busy === 'r' + b.id ? t.restoreWorking : t.accRestoreBtn}
              onPress={() => askRestore(b.id)}
              c={c} rtl={rtl}
              variant="primary"
              icon={CloudDownload}
              busy={busy === 'r' + b.id}
              disabled={Boolean(busy)}
            />
            <Pressable
              onPress={() => askDelete(b.id)}
              disabled={Boolean(busy)}
              accessibilityRole="button"
              style={[s.del, { opacity: busy ? 0.5 : 1, flexDirection: rtl ? 'row-reverse' : 'row' }]}
            >
              {busy === 'd' + b.id ? <ActivityIndicator size="small" color="#FFFFFF" /> : <Trash2 size={16} color="#FFFFFF" />}
              <Text style={{ color: '#FFFFFF', fontWeight: '700', fontSize: 14 }}>{t.delete}</Text>
            </Pressable>
          </View>
        );
      })}
    </Card>
  );
}

const s = StyleSheet.create({
  item: { borderWidth: 1, borderRadius: 14, padding: 12, gap: 8 },
  del: { minHeight: 44, borderRadius: 14, backgroundColor: '#C0392B', alignItems: 'center', justifyContent: 'center', gap: 8, paddingHorizontal: 14 },
});
