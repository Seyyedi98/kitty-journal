import React from "react";
import { Image } from "react-native";
import { MOOD_IMAGES } from "../../assets/images/moodImages";

/** Cat face for a mood key (veryLow..great). */
export default function MoodFace({ mood, size = 22, label, style }) {
  const uri = MOOD_IMAGES[mood];
  if (!uri) return null;
  return (
    <Image
      source={{ uri }}
      style={[{ width: size, height: size }, style]}
      resizeMode="contain"
      accessible={!!label}
      accessibilityLabel={label}
    />
  );
}
