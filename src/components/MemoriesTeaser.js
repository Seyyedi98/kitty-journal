import React, { useState } from "react";
import {
  Image,
  Pressable,
  StyleSheet,
  View,
  useWindowDimensions,
} from "react-native";
import {
  Crown,
  Image as ImageIcon,
  Map as MapIcon,
  MapPin,
} from "lucide-react-native";
import { ScrollView, Text } from "../ui";
import { Button } from "./common";
import { TEASER_CATS } from "../../assets/images/teaserImages";
import { usePremium } from "../premium";

const TINTS = [
  "#F6DCD3",
  "#F5E6C9",
  "#DCE9D8",
  "#D9E4F2",
  "#E6DCF0",
  "#F4D9E3",
];

const cat = (i) => ({ uri: TEASER_CATS[i % TEASER_CATS.length] });
const WALL = [3, 4, 5, 6, 7, 9, 10, 12, 13, 15, 16, 17];

/** Photo wall made of little cat "photos", sized like the real Memories grid so nothing is left over. */
function WallPreview() {
  const { width } = useWindowDimensions();
  const cols = width >= 900 ? 6 : width >= 600 ? 5 : 3;
  const usable =
    Math.min(width, 1060) - (width >= 600 ? 88 : 0) - (width >= 600 ? 60 : 38);
  const size = Math.floor((usable - 6 * (cols - 1)) / cols);
  return (
    <View style={s.wall}>
      {Array.from({ length: cols * 3 }).map((_, i) => (
        <View
          key={i}
          style={[
            s.tile,
            {
              width: size,
              height: size,
              backgroundColor: TINTS[i % TINTS.length],
            },
          ]}
        >
          <Image
            source={cat(WALL[i % WALL.length])}
            style={{ width: size * 0.84, height: size * 0.84 }}
            resizeMode="contain"
          />
        </View>
      ))}
    </View>
  );
}

const BLOCKS = [
  [6, 8, 18, 14],
  [28, 6, 14, 18],
  [50, 10, 16, 12],
  [74, 6, 20, 16],
  [8, 34, 14, 16],
  [30, 38, 12, 12],
  [66, 34, 18, 14],
  [8, 64, 20, 14],
  [34, 70, 16, 18],
  [58, 66, 14, 16],
  [78, 62, 16, 20],
  [52, 40, 10, 10],
];

/** A busier stylised map: streets, blocks, parks, a river, and cat pins. */
function MapPreview({ c }) {
  const pins = [
    { l: "14%", t: "20%", n: 4 },
    { l: "56%", t: "12%", n: 5 },
    { l: "36%", t: "46%", n: 13 },
    { l: "72%", t: "52%", n: 16 },
    { l: "20%", t: "68%", n: 12 },
  ];
  const road = {
    position: "absolute",
    backgroundColor: "rgba(255,255,255,0.75)",
  };
  return (
    <View style={[s.map, { backgroundColor: c.line }]}>
      {BLOCKS.map(([l, t, w, h], i) => (
        <View
          key={i}
          style={{
            position: "absolute",
            left: `${l}%`,
            top: `${t}%`,
            width: `${w}%`,
            height: `${h}%`,
            borderRadius: 4,
            backgroundColor: "rgba(255,255,255,0.32)",
          }}
        />
      ))}
      <View
        style={{
          position: "absolute",
          left: "60%",
          top: "70%",
          width: "34%",
          height: "24%",
          borderRadius: 18,
          backgroundColor: "rgba(120,175,120,0.38)",
        }}
      />
      <View
        style={{
          position: "absolute",
          left: "-4%",
          top: "-6%",
          width: "26%",
          height: "26%",
          borderRadius: 40,
          backgroundColor: "rgba(120,175,120,0.34)",
        }}
      />
      <View
        style={{
          position: "absolute",
          left: "38%",
          top: "24%",
          width: "16%",
          height: "12%",
          borderRadius: 14,
          backgroundColor: "rgba(120,175,120,0.30)",
        }}
      />
      <View
        style={{
          position: "absolute",
          left: "-10%",
          top: "55%",
          width: "125%",
          height: 18,
          borderRadius: 9,
          backgroundColor: "rgba(110,165,215,0.45)",
          transform: [{ rotate: "-18deg" }],
        }}
      />
      {[16, 30, 50, 66, 84].map((y) => (
        <View
          key={`h${y}`}
          style={[
            road,
            { left: 0, right: 0, top: `${y}%`, height: y === 50 ? 7 : 4 },
          ]}
        />
      ))}
      {[10, 26, 44, 62, 80].map((x) => (
        <View
          key={`v${x}`}
          style={[
            road,
            { top: 0, bottom: 0, left: `${x}%`, width: x === 44 ? 7 : 4 },
          ]}
        />
      ))}
      <View
        style={[
          road,
          {
            left: "-10%",
            top: "42%",
            width: "125%",
            height: 6,
            transform: [{ rotate: "24deg" }],
            backgroundColor: "rgba(255,255,255,0.9)",
          },
        ]}
      />
      <View
        style={[
          road,
          {
            left: "-15%",
            top: "28%",
            width: "130%",
            height: 3,
            transform: [{ rotate: "-30deg" }],
          },
        ]}
      />
      {pins.map((p, i) => (
        <View
          key={i}
          style={[
            s.pin,
            {
              left: p.l,
              top: p.t,
              backgroundColor: c.card,
              borderColor: c.accent,
            },
          ]}
        >
          <Image
            source={cat(p.n)}
            style={{ width: 34, height: 34 }}
            resizeMode="contain"
          />
        </View>
      ))}
    </View>
  );
}

/** Three rows of places (skeleton lines, so it needs no translation). */
function PlacesPreview({ c, rtl }) {
  return (
    <View style={{ gap: 10 }}>
      {[0, 1, 2].map((i) => (
        <View
          key={i}
          style={[
            s.place,
            { backgroundColor: c.card, borderColor: c.line },
            rtl && s.rowReverse,
          ]}
        >
          <View style={[s.avatar, { backgroundColor: TINTS[i + 2] }]}>
            <Image
              source={cat([6, 2, 14][i])}
              style={{ width: 38, height: 38 }}
              resizeMode="contain"
            />
          </View>
          <View style={{ flex: 1, gap: 7 }}>
            <View
              style={[
                s.bar,
                { width: `${70 - i * 12}%`, backgroundColor: c.line },
              ]}
            />
            <View
              style={[
                s.bar,
                {
                  width: `${45 - i * 6}%`,
                  height: 7,
                  backgroundColor: c.accentSoft,
                },
              ]}
            />
          </View>
          <MapPin size={16} color={c.accent} />
        </View>
      ))}
    </View>
  );
}

/** Memories for free users: all three tabs are visible, each showing a preview and a way to Premium. */
export default function MemoriesTeaser({ t, c, rtl }) {
  const { openPremium } = usePremium();
  const [tab, setTab] = useState("photos");
  const tabs = [
    ["photos", t.memoriesImages, ImageIcon, t.memoriesTeasePhotos],
    ["map", t.memoriesMap, MapIcon, t.memoriesTeaseMap],
    ["places", t.memoriesPlaces, MapPin, t.memoriesTeasePlaces],
  ];
  const body = tabs.find((x) => x[0] === tab)[3];
  return (
    <ScrollView contentContainerStyle={s.page}>
      <Text
        style={[s.title, { color: c.ink, textAlign: rtl ? "right" : "left" }]}
      >
        {t.memories}
      </Text>

      <View
        style={[
          s.tabs,
          { backgroundColor: c.card, borderColor: c.line },
          rtl && s.rowReverse,
        ]}
      >
        {tabs.map(([key, label, Icon]) => {
          const active = tab === key;
          return (
            <Pressable
              key={key}
              onPress={() => setTab(key)}
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
              style={[
                s.tab,
                active && { backgroundColor: c.sage },
                rtl && s.rowReverse,
              ]}
            >
              <Icon size={16} color={active ? c.sageDark : c.muted} />
              <Text
                style={{
                  color: active ? c.sageDark : c.muted,
                  fontWeight: active ? "700" : "500",
                  fontSize: 12,
                }}
              >
                {label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <View testID="premium-locked" style={{ gap: 16 }}>
        <View style={{ position: "relative" }}>
          {tab === "photos" ? (
            <WallPreview />
          ) : tab === "map" ? (
            <MapPreview c={c} />
          ) : (
            <PlacesPreview c={c} rtl={rtl} />
          )}
          <View
            style={[
              s.badge,
              { backgroundColor: c.accent },
              rtl ? { left: 10 } : { right: 10 },
            ]}
          >
            <Crown size={12} color="#FFFFFF" />
            <Text style={{ color: "#FFFFFF", fontSize: 11, fontWeight: "800" }}>
              {t.premiumTag}
            </Text>
          </View>
        </View>
        <View style={[s.box, { backgroundColor: c.card, borderColor: c.line }]}>
          <Text
            style={{
              color: c.ink,
              fontSize: 17,
              fontWeight: "700",
              textAlign: "center",
            }}
          >
            {t.premiumFeature}
          </Text>
          <Text
            style={{
              color: c.muted,
              fontSize: 14,
              lineHeight: 22,
              textAlign: "center",
            }}
          >
            {body}
          </Text>
          <Text style={{ color: c.muted, fontSize: 12, textAlign: "center" }}>
            {t.memoriesLockedHint}
          </Text>
          <Button
            label={t.premiumSee}
            onPress={openPremium}
            c={c}
            rtl={rtl}
            variant="primary"
            style={{ alignSelf: "stretch" }}
          />
        </View>
      </View>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  page: { paddingTop: 25, paddingBottom: 22, gap: 16 },
  eyebrow: {
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  title: { fontSize: 28, fontWeight: "600" },
  rowReverse: { flexDirection: "row-reverse" },
  tabs: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    borderWidth: 1,
    borderRadius: 13,
    padding: 5,
  },
  tab: {
    flex: 1,
    minHeight: 40,
    borderRadius: 9,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
  },
  wall: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  tile: { borderRadius: 14, alignItems: "center", justifyContent: "center" },
  map: {
    position: "relative",
    height: 260,
    borderRadius: 20,
    overflow: "hidden",
  },
  road: {
    position: "absolute",
    height: 10,
    backgroundColor: "rgba(255,255,255,0.7)",
    borderRadius: 5,
  },
  pin: {
    position: "absolute",
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  place: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderWidth: 1,
    borderRadius: 16,
    padding: 12,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  bar: { height: 10, borderRadius: 5 },
  badge: {
    position: "absolute",
    top: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderRadius: 12,
    paddingHorizontal: 9,
    paddingVertical: 4,
  },
  box: {
    borderWidth: 1,
    borderRadius: 22,
    padding: 22,
    gap: 12,
    alignItems: "center",
  },
});
