import React from 'react';
import { Modal, StyleSheet, View } from 'react-native';
import { Text } from '../ui';
import { Button } from './common';
import CatImage from './CatImage';
import { fmt } from '../i18n';

const CAT = require('../../assets/images/capsule-cat.png');

/**
 * "A letter from your past self has arrived": shown when a time capsule has just opened.
 * `items` = the capsules opened since the last time this was shown (already unmasked entries).
 * One capsule: View opens it. Several: View shows them all in the Home list (capsule filter).
 */
export default function CapsuleArrived({ items, onView, onLater, t, c, rtl, num = String }) {
  const list = items || [];
  const one = list.length === 1 ? list[0] : null;
  const title = one ? (one.title || '').trim() : '';
  return (
    <Modal visible={list.length > 0} transparent animationType="fade" onRequestClose={onLater}>
      <View style={s.backdrop}>
        <View style={[s.card, { backgroundColor: c.paper, borderColor: c.line }]}>
          <CatImage source={CAT} width={130} />
          <Text style={{ color: c.ink, fontSize: 20, fontWeight: '800', textAlign: 'center' }}>
            {one ? t.capsuleArrTitle : fmt(t.capsuleArrTitleMany, { n: num(list.length) })}
          </Text>
          <Text style={{ color: c.muted, fontSize: 14, lineHeight: 22, textAlign: 'center' }}>
            {one ? t.capsuleArrBody : t.capsuleArrBodyMany}
          </Text>
          {title ? (
            <Text numberOfLines={2} style={{ color: c.sageDark, fontSize: 14, fontWeight: '700', textAlign: 'center' }}>{'“' + title + '”'}</Text>
          ) : null}
          <View style={[s.actions, rtl && { flexDirection: 'row-reverse' }]}>
            <Button label={t.capsuleArrLater} onPress={onLater} c={c} rtl={rtl} style={{ flex: 1 }} />
            <Button label={t.capsuleArrView} onPress={onView} c={c} rtl={rtl} variant="primary" style={{ flex: 1 }} />
          </View>
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: '#00000088', alignItems: 'center', justifyContent: 'center', padding: 22 },
  card: { width: '100%', maxWidth: 400, borderRadius: 26, borderWidth: 1, paddingVertical: 22, paddingHorizontal: 20, gap: 12, alignItems: 'center' },
  actions: { flexDirection: 'row', gap: 10, alignSelf: 'stretch', marginTop: 4 },
});
