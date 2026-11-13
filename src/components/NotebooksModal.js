import React, { useEffect, useState } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { Check, Pencil, Trash2, X } from 'lucide-react-native';
import { ScrollView, Text, TextInput } from '../ui';
import { Button, Card } from './common';
import { Dialog } from '../platform/dialog';
import { createNotebook, deleteNotebook, updateNotebook } from '../db/repository';
import { MAX_NOTEBOOKS, NOTEBOOK_COLORS, colorHex } from '../utils/notebooks';
import { usePremium } from '../premium';
import { fmt } from '../i18n';

/**
 * Create, rename, recolour and delete notebooks. Deleting a notebook never deletes entries: they move to Personal.
 * Creating a notebook is a Plus feature; existing notebooks can always be edited or removed.
 */
export default function NotebooksModal({ visible, onClose, db, notebooks, defaultCount = 0, onChanged, t, c, rtl, num = String }) {
  const { premium, request } = usePremium();
  const align = rtl ? 'right' : 'left';
  const [editing, setEditing] = useState(null); // null = creating, else a notebook id
  const [name, setName] = useState('');
  const [color, setColor] = useState('sage');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (visible) {
      setEditing(null);
      setName('');
      setColor('sage');
      setError('');
    }
  }, [visible]);

  const explain = (e) => {
    const m = String((e && e.message) || e);
    if (m.includes('name-taken')) return t.notebookNameTaken;
    if (m.includes('limit')) return fmt(t.notebookLimit, { n: num(MAX_NOTEBOOKS) });
    if (m.includes('name-empty')) return t.notebookEmpty;
    return t.saveFailedHint;
  };

  const submit = async () => {
    if (busy) return;
    if (editing == null && !premium) {
      request('notebooks');
      return;
    }
    setBusy(true);
    setError('');
    try {
      if (editing == null) await createNotebook(db, { name, color });
      else await updateNotebook(db, editing, { name, color });
      setEditing(null);
      setName('');
      setColor('sage');
      await onChanged?.();
    } catch (e) {
      setError(explain(e));
    } finally {
      setBusy(false);
    }
  };

  const startEdit = (n) => {
    setEditing(n.id);
    setName(n.name);
    setColor(n.color || 'sage');
    setError('');
  };
  const cancelEdit = () => {
    setEditing(null);
    setName('');
    setColor('sage');
    setError('');
  };

  const remove = (n) =>
    Dialog.alert(t.notebookDelete, fmt(t.notebookDeleteConfirm, { name: n.name }), [
      { text: t.cancel, style: 'cancel' },
      {
        text: t.notebookDelete,
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteNotebook(db, n.id);
            if (editing === n.id) cancelEdit();
            await onChanged?.();
          } catch {
            Dialog.alert(t.somethingWrong, t.saveFailedHint);
          }
        },
      },
    ]);

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: c.bg, paddingTop: 44 }}>
        <View style={[s.head, rtl && s.rowReverse]}>
          <Text style={{ color: c.ink, fontSize: 20, fontWeight: '700' }}>{t.notebooks}</Text>
          <Pressable onPress={onClose} hitSlop={12} accessibilityRole="button" accessibilityLabel={t.photoRedClose}>
            <X size={22} color={c.ink} />
          </Pressable>
        </View>
        <ScrollView contentContainerStyle={s.page} keyboardShouldPersistTaps="handled">
          <Text style={{ color: c.muted, fontSize: 12, lineHeight: 18, textAlign: align }}>{t.notebookIntro}</Text>

          <Card c={c} rtl={rtl} style={{ gap: 0 }}>
            {/* The default notebook: not stored, cannot be renamed or deleted; every entry without a notebook lives here. */}
            <View style={[s.item, { borderBottomColor: c.line, borderBottomWidth: notebooks.length ? StyleSheet.hairlineWidth : 0 }, rtl && s.rowReverse]}>
              <View style={[s.dot, { backgroundColor: c.line }]} />
              <View style={{ flex: 1 }}>
                <Text style={{ color: c.ink, fontSize: 14, fontWeight: '600', textAlign: align }}>{t.notebookPersonal}</Text>
                <Text style={{ color: c.muted, fontSize: 11, lineHeight: 16, textAlign: align }}>{t.notebookDefaultHint}</Text>
                <Text style={{ color: c.muted, fontSize: 11, textAlign: align }}>{fmt(t.notebookCount, { n: num(defaultCount) })}</Text>
              </View>
              <View style={[s.badge, { backgroundColor: c.accentSoft }]}>
                <Text style={{ color: c.sageDark, fontSize: 10, fontWeight: '700' }}>{t.notebookDefaultTag}</Text>
              </View>
            </View>
            {notebooks.map((n, i) => (
                <View key={n.id} style={[s.item, { borderBottomColor: c.line, borderBottomWidth: i === notebooks.length - 1 ? 0 : StyleSheet.hairlineWidth }, rtl && s.rowReverse]}>
                  <View style={[s.dot, { backgroundColor: colorHex(n.color) }]} />
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: c.ink, fontSize: 14, fontWeight: '600', textAlign: align }}>{n.name}</Text>
                    <Text style={{ color: c.muted, fontSize: 11, textAlign: align }}>{fmt(t.notebookCount, { n: num(n.count || 0) })}</Text>
                  </View>
                  <Pressable onPress={() => startEdit(n)} hitSlop={8} style={s.icon} accessibilityRole="button" accessibilityLabel={`${t.notebookEdit}: ${n.name}`}>
                    <Pencil size={17} color={c.sageDark} />
                  </Pressable>
                  <Pressable onPress={() => remove(n)} hitSlop={8} style={s.icon} accessibilityRole="button" accessibilityLabel={`${t.notebookDelete}: ${n.name}`}>
                    <Trash2 size={17} color={c.sageDark} />
                  </Pressable>
                </View>
              ))}
          </Card>

          <Card title={editing == null ? t.notebookNew : t.notebookEdit} c={c} rtl={rtl}>
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder={t.notebookName}
              placeholderTextColor={c.muted}
              maxLength={40}
              style={[s.input, { color: c.ink, borderColor: c.line, backgroundColor: c.card, textAlign: align }]}
            />
            <View style={[s.colors, rtl && s.rowReverse]}>
              {NOTEBOOK_COLORS.map((x) => (
                <Pressable key={x.key} onPress={() => setColor(x.key)} accessibilityRole="button" accessibilityState={{ selected: color === x.key }} accessibilityLabel={x.key} style={[s.swatch, { backgroundColor: x.hex, borderColor: color === x.key ? c.ink : 'transparent' }]}>
                  {color === x.key ? <Check size={14} color="#FFFFFF" /> : null}
                </Pressable>
              ))}
            </View>
            {error ? <Text style={{ color: c.danger, fontSize: 12, textAlign: align }}>{error}</Text> : null}
            <Button label={editing == null ? t.notebookCreate : t.notebookSave} onPress={submit} c={c} rtl={rtl} variant="primary" busy={busy} disabled={busy || !name.trim()} />
            {editing != null ? <Button label={t.cancel} onPress={cancelEdit} c={c} rtl={rtl} variant="secondary" /> : null}
          </Card>
        </ScrollView>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 18, paddingBottom: 8 },
  rowReverse: { flexDirection: 'row-reverse' },
  page: { paddingHorizontal: 18, paddingBottom: 40, gap: 14 },
  item: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 11 },
  dot: { width: 14, height: 14, borderRadius: 7 },
  icon: { padding: 6 },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  input: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14 },
  colors: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  swatch: { width: 32, height: 32, borderRadius: 16, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
});
