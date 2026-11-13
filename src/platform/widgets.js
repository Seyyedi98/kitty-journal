// Ask Android to redraw the home-screen widgets (e.g. after language/theme change).
import { Platform } from 'react-native';
import { requestWidgetUpdate } from 'react-native-android-widget';
import { WIDGET_NAMES, widgetFor } from '../widgets/widgets';
import { widgetPalette } from '../widgets/widgetPalette';

/** @param {{language:string, calendar:string, theme:string, appearance:string, premium:boolean, systemDark:boolean}} s */
export async function refreshWidgets(s) {
  if (Platform.OS !== 'android') return;
  const c = widgetPalette(s);
  for (const name of Object.values(WIDGET_NAMES)) {
    try {
      await requestWidgetUpdate({
        widgetName: name,
        renderWidget: () => widgetFor(name, { now: new Date(), language: s.language, calendar: s.calendar, c }),
        widgetNotFound: () => {}, // not placed on the home screen: nothing to do
      });
    } catch (error) {
      console.warn('[kitty-journal] widget refresh failed:', error);
    }
  }
}
