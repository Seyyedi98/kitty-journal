# Edits to make in App.js (5 small ones)

1. Imports
   After: import { useFonts } from "expo-font";
   add: import { PERSIAN_FONT_KEYS, loadPersianFont } from "./src/fonts";
   And add `setUiPersianFont` to your existing import from "./src/ui".

2. Right after the line setUiFontsLoaded(fontsLoaded); add:
   StorageScreen;
   useEffect(() => {
   let off = false;
   loadPersianFont(faFont).then(() => { if (!off) setUiPersianFont(faFont); }).catch(() => {});
   return () => { off = true; };
   }, [faFont]);

3. In loadSettings handling, after if (THEME_KEYS.includes(saved.theme)) setTheme(saved.theme); add:
   if (PERSIAN_FONT_KEYS.includes(saved.faFont)) setFaFont(saved.faFont);

4. Before const changeAppearance = ... add:
   const changeFaFont = (value) => {
   if (!PERSIAN_FONT_KEYS.includes(value)) return;
   setFaFont(value);
   persistSetting("faFont", value);
   };

5. In the <AppearanceScreen ... /> call add these props:
   language={language}
   faFont={faFont}
   setFaFont={changeFaFont}
