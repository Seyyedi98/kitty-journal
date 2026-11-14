import React from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { Text } from '../ui';
import { Button } from './common';
import CatImage from './CatImage';

const CAT = require('../../assets/images/premium-cat.png');

/** Shown once after a purchase went through (also when a discount code made it free). */
export default function PremiumCongrats({ visible, onClose, t, c, rtl }) {
  return (
    <Modal visible={Boolean(visible)} transparent animationType="fade" onRequestClose={onClose}>
      <View style={s.backdrop}>
        <View style={[s.card, { backgroundColor: c.paper, borderColor: c.line }]}>
          <CatImage source={CAT} width={220} />
          <Text style={{ color: c.ink, fontSize: 21, fontWeight: '800', textAlign: 'center' }}>{t.congratsTitle}</Text>
          <Text style={{ color: c.muted, fontSize: 14, lineHeight: 22, textAlign: 'center' }}>{t.congratsBody}</Text>
          <Button label={t.congratsOk} onPress={onClose} c={c} rtl={rtl} variant="primary" style={{ alignSelf: 'stretch' }} />
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: '#00000088', alignItems: 'center', justifyContent: 'center', padding: 22 },
  card: { width: '100%', maxWidth: 400, borderRadius: 26, borderWidth: 1, paddingVertical: 22, paddingHorizontal: 20, gap: 12, alignItems: 'center' },
});
