// The fonts of the editor's font menu. Pure data (no packages) so the text helpers and the editor page can use it.
// `family` is the font package's family name (files are `${family}_400Regular` and `${family}_700Bold`).
// In saved text a font is stored as a CSS stack like  font-family:'KJ_amiri',serif  (the key is the part after KJ_).
const F = (key, script, label, family, generic, weights = ['400', '700']) => ({ key, script, label, family, generic, weights, css: `KJ_${key}` });

export const FONT_CATALOG = [
  // Persian (Arabic script). The label is the font's own name in Persian.
  F('vazir', 'fa', 'وزیرمتن', 'Vazirmatn', 'sans-serif'),
  F('amiri', 'fa', 'امیری', 'Amiri', 'serif'),
  F('arefruqaa', 'fa', 'عارف رقعه', 'ArefRuqaa', 'serif'),
  F('lalezar', 'fa', 'لاله‌زار', 'Lalezar', 'cursive', ['400']),
  F('markazi', 'fa', 'مرکزی', 'MarkaziText', 'serif'),
  F('naskh', 'fa', 'نوتو نسخ', 'NotoNaskhArabic', 'serif'),
  F('notosans', 'fa', 'نوتو سنس', 'NotoSansArabic', 'sans-serif'),
  F('cairo', 'fa', 'کایرو', 'Cairo', 'sans-serif'),
  F('nastaliq', 'fa', 'نستعلیق', 'NotoNastaliqUrdu', 'serif'),
  // English / Turkish
  F('caveat', 'en', 'Caveat', 'Caveat', 'cursive'),
  F('patrick', 'en', 'Patrick Hand', 'PatrickHand', 'cursive', ['400']),
  F('dancing', 'en', 'Dancing Script', 'DancingScript', 'cursive'),
  F('lora', 'en', 'Lora', 'Lora', 'serif'),
  F('inter', 'en', 'Inter', 'Inter', 'sans-serif'),
  F('nunito', 'en', 'Nunito', 'Nunito', 'sans-serif'),
  F('poppins', 'en', 'Poppins', 'Poppins', 'sans-serif'),
  F('mono', 'en', 'Roboto Mono', 'RobotoMono', 'monospace'),
];
export const FONT_KEYS = FONT_CATALOG.map((f) => f.key);
export const fontStack = (f) => `'${f.css}',${f.generic}`;
/** key -> canonical CSS stack */
export const FONT_STACKS = Object.fromEntries(FONT_CATALOG.map((f) => [f.key, fontStack(f)]));
