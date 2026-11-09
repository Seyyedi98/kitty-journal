// Real fonts behind the editor toolbar's font menu (see utils/fontCatalog.js for the list).
// The editor page is a web view and cannot see the app's fonts, so a font is embedded into it ONLY when it is used
// (the text already has it, or the user picks it). Only the font's name is saved with the text.
import * as Font from 'expo-font';
import { Asset } from 'expo-asset';
import * as FileSystem from 'expo-file-system/legacy';
import * as VazirmatnPkg from '@expo-google-fonts/vazirmatn';
import * as AmiriPkg from '@expo-google-fonts/amiri';
import * as ArefRuqaaPkg from '@expo-google-fonts/aref-ruqaa';
import * as LalezarPkg from '@expo-google-fonts/lalezar';
import * as MarkaziTextPkg from '@expo-google-fonts/markazi-text';
import * as NotoNaskhArabicPkg from '@expo-google-fonts/noto-naskh-arabic';
import * as NotoSansArabicPkg from '@expo-google-fonts/noto-sans-arabic';
import * as CairoPkg from '@expo-google-fonts/cairo';
import * as NotoNastaliqUrduPkg from '@expo-google-fonts/noto-nastaliq-urdu';
import * as CaveatPkg from '@expo-google-fonts/caveat';
import * as PatrickHandPkg from '@expo-google-fonts/patrick-hand';
import * as DancingScriptPkg from '@expo-google-fonts/dancing-script';
import * as LoraPkg from '@expo-google-fonts/lora';
import * as InterPkg from '@expo-google-fonts/inter';
import * as NunitoPkg from '@expo-google-fonts/nunito';
import * as PoppinsPkg from '@expo-google-fonts/poppins';
import * as RobotoMonoPkg from '@expo-google-fonts/roboto-mono';
import { FONT_CATALOG } from './utils/fontCatalog';

const PKGS = {
  Vazirmatn: VazirmatnPkg, Amiri: AmiriPkg, ArefRuqaa: ArefRuqaaPkg, Lalezar: LalezarPkg, MarkaziText: MarkaziTextPkg,
  NotoNaskhArabic: NotoNaskhArabicPkg, NotoSansArabic: NotoSansArabicPkg, Cairo: CairoPkg, NotoNastaliqUrdu: NotoNastaliqUrduPkg,
  Caveat: CaveatPkg, PatrickHand: PatrickHandPkg, DancingScript: DancingScriptPkg, Lora: LoraPkg, Inter: InterPkg,
  Nunito: NunitoPkg, Poppins: PoppinsPkg, RobotoMono: RobotoMonoPkg,
};

/** key -> catalog entry (label, script, family, css, generic, weights) */
export const TOOLBAR_FONTS = Object.fromEntries(FONT_CATALOG.map((f) => [f.key, f]));
export const ALL_FONT_KEYS = FONT_CATALOG.map((f) => f.key);

const faceName = (f, bold) => `${f.family}_${bold ? '700Bold' : '400Regular'}`;
const fileOf = (f, bold) => {
  if (bold && !f.weights.includes('700')) return null;
  const pkg = PKGS[f.family];
  return (pkg && pkg[faceName(f, bold)]) || null;
};

/** Which toolbar fonts does this (sanitised) HTML use? */
export function fontKeysIn(html) {
  const s = String(html || '');
  return ALL_FONT_KEYS.filter((k) => s.includes(TOOLBAR_FONTS[k].css));
}

const b64Cache = new Map();
async function toBase64(mod) {
  const asset = Asset.fromModule(mod);
  await asset.downloadAsync();
  // read the font file itself as base64 (fetch/Blob corrupts binary data in React Native)
  const b64 = await FileSystem.readAsStringAsync(asset.localUri || asset.uri, { encoding: 'base64' });
  // a font file starts with 0x00010000 (AAEAAA), 'OTTO' (T1RUTw) or 'true' (dHJ1ZQ)
  if (!/^(AAEAAA|T1RUTw|dHJ1ZQ)/.test(b64)) console.warn('[kitty-fonts] unexpected font data start:', b64.slice(0, 12), asset.localUri);
  return b64;
}

/** The font files of the given keys as base64: [{ name (css family), weight, b64 }]. */
export async function webFontFaces(keys) {
  const out = [];
  for (const key of keys) {
    const f = TOOLBAR_FONTS[key];
    if (!f) continue;
    for (const bold of [false, true]) {
      const file = fileOf(f, bold);
      if (!file) continue;
      const id = `${key}:${bold ? 700 : 400}`;
      if (!b64Cache.has(id)) b64Cache.set(id, await toBase64(file));
      out.push({ name: f.css, weight: bold ? 700 : 400, b64: b64Cache.get(id), id });
    }
  }
  return out;
}

/** @font-face CSS (fonts embedded as data) for web pages: the PDF export. */
export async function webFontCss(keys) {
  const faces = await webFontFaces(keys);
  return faces.map((x) => `@font-face{font-family:'${x.name}';font-weight:${x.weight};src:url(data:font/ttf;base64,${x.b64}) format('truetype');}`).join('');
}

/** Make fonts usable by native Text (the font menu and the entry preview). Resolves true if something was loaded. */
export async function loadNativeFonts(keys) {
  const files = {};
  for (const key of keys) {
    const f = TOOLBAR_FONTS[key];
    if (!f) continue;
    for (const bold of [false, true]) {
      const file = fileOf(f, bold);
      if (file) files[faceName(f, bold)] = file;
    }
  }
  if (!Object.keys(files).length) return false;
  try {
    await Font.loadAsync(files);
    return true;
  } catch (e) {
    console.warn('[kitty-fonts] could not load toolbar fonts', e);
    return false;
  }
}

/** Native font family for a font key (undefined = the app's normal font). */
export function toolbarFamily(key, _text, bold) {
  const f = TOOLBAR_FONTS[key];
  if (!f) return undefined;
  return faceName(f, bold && f.weights.includes('700'));
}
