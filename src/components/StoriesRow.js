import React, { useEffect, useState } from 'react';
import { Image, Pressable, StyleSheet, View } from 'react-native';
import { CalendarDays, Crown, History, Sparkles } from 'lucide-react-native';
import { ScrollView, Text } from '../ui';
import { listEntryAttachments } from '../db/repository';
import { attachmentUri } from '../services/photos';
import { fs } from '../platform/fs';
import { usePremium } from '../premium';

const ICONS = { today: History, lastMonth: CalendarDays, lastYear: Sparkles };

/** Instagram-style row of story circles at the top of Home. Free users see them locked. */
export default function StoriesRow({ groups, db, onOpen, t, c, rtl }) {
  const { premium, request } = usePremium();
  const [thumbs, setThumbs] = useState({});
  const sig = groups.map((g) => `${g.key}:${g.items.map((i) => i.id).join(',')}`).join('|');

  useEffect(() => {
    let live = true;
    (async () => {
      const out = {};
      for (const g of groups) {
        const withPhoto = g.items.find((e) => (e.attachmentCount || 0) > 0);
        if (!withPhoto) continue;
        try {
          const rows = await listEntryAttachments(db, withPhoto.id);
          if (rows[0]) out[g.key] = attachmentUri(fs, rows[0].thumb_name || rows[0].file_name);
        } catch {
          /* no thumbnail: the icon is shown */
        }
      }
      if (live) setThumbs(out);
    })();
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sig, db]);

  if (!groups.length) return null;
  const label = { today: t.onThisDay, lastMonth: t.storyLastMonth, lastYear: t.storyLastYear };
  return (
    <View style={s.wrap} testID="stories-row">
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={[s.row, rtl && { flexDirection: 'row-reverse' }]}>
        {groups.map((g) => {
          const Icon = ICONS[g.key] || History;
          return (
            <Pressable
              key={g.key}
              onPress={() => (premium ? onOpen(g) : request('onthisday'))}
              accessibilityRole="button"
              accessibilityLabel={label[g.key]}
              testID={`story-${g.key}`}
              style={s.item}
            >
              <View style={[s.ring, { borderColor: premium ? c.accent : c.line }]}>
                <View style={[s.inner, { backgroundColor: c.accentSoft }]}>
                  {thumbs[g.key] ? <Image source={{ uri: thumbs[g.key] }} style={s.img} resizeMode="cover" /> : <Icon size={26} color={c.sageDark} />}
                </View>
                {!premium ? (
                  <View style={[s.lock, { backgroundColor: c.accent, borderColor: c.paper }]}>
                    <Crown size={10} color={c.onAccent} />
                  </View>
                ) : null}
              </View>
              <Text numberOfLines={1} style={{ color: c.ink, fontSize: 11, fontWeight: '600', marginTop: 6, maxWidth: 76, textAlign: 'center' }}>
                {label[g.key]}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { marginTop: 8, marginBottom: 20 },
  row: { flexDirection: 'row', gap: 16, paddingVertical: 4, paddingHorizontal: 2 },
  item: { alignItems: 'center', width: 80 },
  ring: { width: 72, height: 72, borderRadius: 36, borderWidth: 3, padding: 3 },
  inner: { flex: 1, borderRadius: 33, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  img: { width: '100%', height: '100%' },
  lock: { position: 'absolute', right: -2, bottom: -2, width: 22, height: 22, borderRadius: 11, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
});
