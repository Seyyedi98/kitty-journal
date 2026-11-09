// Fonts the user can pick in Settings → Appearance. The default fonts (DM Sans for English/Turkish, Vazirmatn for Persian)
// are loaded by App.js; the others are loaded here, only when chosen (or when the picker is open).
// Each package is imported as a namespace and its fonts are read by name.
import * as Font from 'expo-font';
import * as NotoNaskhArabicPkg from '@expo-google-fonts/noto-naskh-arabic';
import * as NotoSansArabicPkg from '@expo-google-fonts/noto-sans-arabic';
import * as CairoPkg from '@expo-google-fonts/cairo';
import * as InterPkg from '@expo-google-fonts/inter';
import * as NunitoPkg from '@expo-google-fonts/nunito';
import * as PoppinsPkg from '@expo-google-fonts/poppins';
import * as LoraPkg from '@expo-google-fonts/lora';


const pick = (mod, name) => (mod && mod[name]) || null;
const set = (prefix, pkg) => {
  const files = {};
  [['400', 'Regular'], ['500', 'Medium'], ['600', 'SemiBold'], ['700', 'Bold']].forEach(([w, n]) => {
    const name = `${prefix}_${w}${n}`;
    const f = pick(pkg, name);
    if (f) files[name] = f;
  });
  return files;
};

const NASKH = set('NotoNaskhArabic', NotoNaskhArabicPkg);
const NOTOSANS = set('NotoSansArabic', NotoSansArabicPkg);
const CAIRO = set('Cairo', CairoPkg);
const INTER = set('Inter', InterPkg);
const NUNITO = set('Nunito', NunitoPkg);
const POPPINS = set('Poppins', PoppinsPkg);
const LORA = set('Lora', LoraPkg);

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
