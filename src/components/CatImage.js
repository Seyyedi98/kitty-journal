import React from 'react';
import { Image } from 'react-native';

/**
 * A cat picture at a given width; the height follows the picture's own proportions.
 * `rounded` = a picture with its own paper background (rounded corners); pictures with a transparent
 * background should not be rounded.
 */
export default function CatImage({ source, width = 140, rounded = false, style }) {
  const meta = Image.resolveAssetSource ? Image.resolveAssetSource(source) : null;
  const ratio = meta && meta.width && meta.height ? meta.height / meta.width : 1;
  return (
    <Image
      source={source}
      style={[{ width, height: Math.round(width * ratio), alignSelf: 'center' }, rounded && { borderRadius: Math.round(width * 0.16) }, style]}
      resizeMode="contain"
      accessibilityIgnoresInvertColors
    />
  );
}
