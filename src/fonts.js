// Fonts the user can pick in Settings → Appearance. The default fonts (DM Sans for English/Turkish, Vazirmatn for Persian)
// are loaded by App.js; the others are loaded here, only when chosen (or when the picker is open).
// Each file is imported as a namespace and read by name OR as the default export, so it works with either package layout.
import * as Font from 'expo-font';

import * as NotoNaskhArabic_400 from '@expo-google-fonts/noto-naskh-arabic/400Regular';
import * as NotoNaskhArabic_500 from '@expo-google-fonts/noto-naskh-arabic/500Medium';
import * as NotoNaskhArabic_600 from '@expo-google-fonts/noto-naskh-arabic/600SemiBold';
import * as NotoNaskhArabic_700 from '@expo-google-fonts/noto-naskh-arabic/700Bold';
import * as NotoSansArabic_400 from '@expo-google-fonts/noto-sans-arabic/400Regular';
import * as NotoSansArabic_500 from '@expo-google-fonts/noto-sans-arabic/500Medium';
import * as NotoSansArabic_600 from '@expo-google-fonts/noto-sans-arabic/600SemiBold';
import * as NotoSansArabic_700 from '@expo-google-fonts/noto-sans-arabic/700Bold';
import * as Cairo_400 from '@expo-google-fonts/cairo/400Regular';
import * as Cairo_500 from '@expo-google-fonts/cairo/500Medium';
import * as Cairo_600 from '@expo-google-fonts/cairo/600SemiBold';
import * as Cairo_700 from '@expo-google-fonts/cairo/700Bold';
import * as Inter_400 from '@expo-google-fonts/inter/400Regular';
import * as Inter_500 from '@expo-google-fonts/inter/500Medium';
import * as Inter_600 from '@expo-google-fonts/inter/600SemiBold';
import * as Inter_700 from '@expo-google-fonts/inter/700Bold';
import * as Nunito_400 from '@expo-google-fonts/nunito/400Regular';
import * as Nunito_500 from '@expo-google-fonts/nunito/500Medium';
import * as Nunito_600 from '@expo-google-fonts/nunito/600SemiBold';
import * as Nunito_700 from '@expo-google-fonts/nunito/700Bold';
import * as Poppins_400 from '@expo-google-fonts/poppins/400Regular';
import * as Poppins_500 from '@expo-google-fonts/poppins/500Medium';
import * as Poppins_600 from '@expo-google-fonts/poppins/600SemiBold';
import * as Poppins_700 from '@expo-google-fonts/poppins/700Bold';
import * as Lora_400 from '@expo-google-fonts/lora/400Regular';
import * as Lora_500 from '@expo-google-fonts/lora/500Medium';
import * as Lora_600 from '@expo-google-fonts/lora/600SemiBold';
import * as Lora_700 from '@expo-google-fonts/lora/700Bold';

const pick = (mod, name) => (mod && (mod[name] || mod.default)) || null;
const set = (prefix, mods) => {
  const files = {};
  [['400', 'Regular'], ['500', 'Medium'], ['600', 'SemiBold'], ['700', 'Bold']].forEach(([w, n]) => {
    const name = `${prefix}_${w}${n}`;
    const f = pick(mods[w], name);
    if (f) files[name] = f;
  });
  return files;
};

const NASKH = set('NotoNaskhArabic', { 400: NotoNaskhArabic_400, 500: NotoNaskhArabic_500, 600: NotoNaskhArabic_600, 700: NotoNaskhArabic_700 });
const NOTOSANS = set('NotoSansArabic', { 400: NotoSansArabic_400, 500: NotoSansArabic_500, 600: NotoSansArabic_600, 700: NotoSansArabic_700 });
const CAIRO = set('Cairo', { 400: Cairo_400, 500: Cairo_500, 600: Cairo_600, 700: Cairo_700 });
const INTER = set('Inter', { 400: Inter_400, 500: Inter_500, 600: Inter_600, 700: Inter_700 });
const NUNITO = set('Nunito', { 400: Nunito_400, 500: Nunito_500, 600: Nunito_600, 700: Nunito_700 });
const POPPINS = set('Poppins', { 400: Poppins_400, 500: Poppins_500, 600: Poppins_600, 700: Poppins_700 });
const LORA = set('Lora', { 400: Lora_400, 500: Lora_500, 600: Lora_600, 700: Lora_700 });

/** Persian. `label` is the font's own name (shown in every language). files = null → already loaded at start-up. */
export const PERSIAN_FONTS = [
  { key: 'vazirmatn', label: 'وزیرمتن', files: null },
  { key: 'naskh', label: 'نوتو نسخ', files: NASKH },
  { key: 'notosans', label: 'نوتو سنس', files: NOTOSANS },
  { key: 'cairo', label: 'کایرو', files: CAIRO },
];
/** English / Turkish. */
export const LATIN_FONTS = [
  { key: 'dmsans', label: 'DM Sans', files: null },
  { key: 'inter', label: 'Inter', files: INTER },
  { key: 'nunito', label: 'Nunito', files: NUNITO },
  { key: 'poppins', label: 'Poppins', files: POPPINS },
  { key: 'lora', label: 'Lora (serif)', files: LORA },
];
export const PERSIAN_FONT_KEYS = PERSIAN_FONTS.map((f) => f.key);
export const LATIN_FONT_KEYS = LATIN_FONTS.map((f) => f.key);

const find = (key) => PERSIAN_FONTS.find((x) => x.key === key) || LATIN_FONTS.find((x) => x.key === key);

/** Load one font's files. Resolves true when it can be used (the default font needs nothing). */
export async function loadFont(key) {
  const f = find(key);
  if (!f) return false;
  if (!f.files) return true;
  if (!Object.keys(f.files).length) {
    console.warn('[kitty-fonts] no font files found for', key, '- is the package installed?');
    return false;
  }
  try {
    await Font.loadAsync(f.files);
    return true;
  } catch (e) {
    console.warn('[kitty-fonts] could not load', key, e);
    return false;
  }
}
/** Load every font of one list, so the picker can show a sample in each. */
export async function loadAllFonts(list) {
  await Promise.all(list.map((f) => loadFont(f.key)));
}
