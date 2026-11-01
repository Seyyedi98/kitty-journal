import React from 'react';
import {
  Dimensions,
  Keyboard,
  ScrollView as NativeScrollView,
  StyleSheet,
  Text as NativeText,
  TextInput as NativeTextInput,
} from 'react-native';

// Font selection depends on the active language. Kept in module state so the
// drop-in Text / TextInput wrappers need no extra props anywhere in the app.
let ACTIVE_LANGUAGE = 'en';
let ACTIVE_FONTS_LOADED = false;

export function setUiLanguage(language) {
  ACTIVE_LANGUAGE = language;
}
/** Font family for the current language/weight (undefined until fonts have loaded). */
export function uiFont(weight = 400) {
  if (!ACTIVE_FONTS_LOADED) return undefined;
  const family = FONT_FAMILIES[ACTIVE_LANGUAGE] || FONT_FAMILIES.en;
  return family[String(weight)] || family['400'];
}
export function setUiFontsLoaded(loaded) {
  ACTIVE_FONTS_LOADED = loaded;
}

const LATIN = {
  400: 'DMSans_400Regular',
  500: 'DMSans_500Medium',
  600: 'DMSans_600SemiBold',
  700: 'DMSans_700Bold',
  800: 'DMSans_700Bold',
};
export const FONT_FAMILIES = {
  en: LATIN,
  tr: LATIN,
  fa: {
    400: 'Vazirmatn_400Regular',
    500: 'Vazirmatn_500Medium',
    600: 'Vazirmatn_600SemiBold',
    700: 'Vazirmatn_700Bold',
    800: 'Vazirmatn_700Bold',
  },
};

const RTL_LANGUAGES = ['fa'];
const rtlAlign = (flattened) => (RTL_LANGUAGES.includes(ACTIVE_LANGUAGE) && !flattened.textAlign ? { textAlign: 'right' } : null);

export function Text({ style, ...props }) {
  const flattened = StyleSheet.flatten(style) || {};
  const weight = String(flattened.fontWeight || '400');
  const family = FONT_FAMILIES[ACTIVE_LANGUAGE] || FONT_FAMILIES.en;
  const fontFamily = flattened.fontFamily || (ACTIVE_FONTS_LOADED ? family[weight] || family['400'] : undefined);
  return (
    <NativeText
      maxFontSizeMultiplier={1.5}
      {...props}
      style={[fontFamily ? { fontFamily } : null, rtlAlign(flattened), style]}
    />
  );
}

export function TextInput(props) {
  const flattened = StyleSheet.flatten(props.style) || {};
  const family = FONT_FAMILIES[ACTIVE_LANGUAGE] || FONT_FAMILIES.en;
  const fontFamily = flattened.fontFamily || (ACTIVE_FONTS_LOADED ? family['400'] : undefined);
  return (
    <NativeTextInput
      maxFontSizeMultiplier={1.5}
      {...props}
      style={[fontFamily ? { fontFamily } : null, rtlAlign(flattened), props.style]}
    />
  );
}

/**
 * Drop-in ScrollView with both scroll indicators permanently hidden
 * (scrolling itself is unchanged). Use this instead of react-native's.
 */
// Space the floating dock needs below scrolling content. The content area itself runs all the way
// to the bottom edge (the dock floats over it), so each page's ScrollView adds this to its own bottom
// padding and the last rows can still be scrolled clear of the dock. Popups and full-screen
// overlays provide 0.
export const BottomInsetContext = React.createContext(0);

/** How far a scroller must move so a field's bottom edge sits `margin` px above the keyboard (0 if already clear). */
export function scrollDeltaForKeyboard(fieldBottom, keyboardTop, margin = 16) {
  const over = fieldBottom + margin - keyboardTop;
  return over > 0 ? over : 0;
}

/** Height of the on-screen keyboard (0 when hidden) and where it starts on screen. */
function useKeyboard() {
  const [kb, setKb] = React.useState({ height: 0, top: 0 });
  React.useEffect(() => {
    const show = Keyboard.addListener('keyboardDidShow', (e) => {
      const h = (e && e.endCoordinates && e.endCoordinates.height) || 0;
      const top = (e && e.endCoordinates && e.endCoordinates.screenY) || Dimensions.get('window').height - h;
      setKb({ height: h, top });
    });
    const hide = Keyboard.addListener('keyboardDidHide', () => setKb({ height: 0, top: 0 }));
    return () => { show.remove(); hide.remove(); };
  }, []);
  return kb;
}

export const ScrollView = React.forwardRef(function ScrollView(props, ref) {
  const inset = React.useContext(BottomInsetContext);
  const kb = useKeyboard();
  const inner = React.useRef(null);
  const offset = React.useRef(0);
  const setRef = (node) => {
    inner.current = node;
    if (typeof ref === 'function') ref(node);
    else if (ref) ref.current = node;
  };
  let contentContainerStyle = props.contentContainerStyle;
  // Only vertical page scrollers need dock / keyboard clearance; horizontal strips (filter chips etc.) must not.
  if (!props.horizontal && (inset || kb.height)) {
    const flat = StyleSheet.flatten(contentContainerStyle) || {};
    contentContainerStyle = { ...flat, paddingBottom: (flat.paddingBottom || 0) + inset + kb.height };
  }

  // With the keyboard open, a field in this scroller that would end up underneath it is scrolled
  // into view. (The extra bottom padding above gives short pages room to scroll at all.)
  React.useEffect(() => {
    if (props.horizontal || !kb.height) return undefined;
    const field = TextInput_State();
    if (!field || !field.measureInWindow || !inner.current || !inner.current.measureInWindow) return undefined;
    const timer = setTimeout(() => {
      inner.current.measureInWindow((sx, sy, sw, sh) => {
        field.measureInWindow((fx, fy, fw, fh) => {
          if (fy + fh < sy || fy > sy + sh) return; // the focused field belongs to another scroller
          const delta = scrollDeltaForKeyboard(fy + fh, kb.top);
          if (delta > 0 && inner.current && inner.current.scrollTo) inner.current.scrollTo({ y: offset.current + delta, animated: true });
        });
      });
    }, 120);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kb.height, kb.top, props.horizontal]);

  return (
    <NativeScrollView
      ref={setRef}
      showsVerticalScrollIndicator={false}
      showsHorizontalScrollIndicator={false}
      scrollEventThrottle={16}
      {...props}
      onScroll={(e) => {
        offset.current = (e && e.nativeEvent && e.nativeEvent.contentOffset && e.nativeEvent.contentOffset.y) || 0;
        if (props.onScroll) props.onScroll(e);
      }}
      contentContainerStyle={contentContainerStyle}
    />
  );
});

function TextInput_State() {
  const state = NativeTextInput && NativeTextInput.State;
  return state && state.currentlyFocusedInput ? state.currentlyFocusedInput() : null;
}

