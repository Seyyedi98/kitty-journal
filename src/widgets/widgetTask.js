// Headless task: Android asks for a widget picture, we read the saved settings
// straight from the journal database and render with the app's theme.
import { Appearance } from 'react-native';
import { openDatabaseAsync } from 'expo-sqlite';
import { loadSettings } from '../db/repository';
import { widgetPalette } from './widgetPalette';
import { widgetFor } from './widgets';

async function readSettings() {
  try {
    const db = await openDatabaseAsync('kitty-journal.db');
    try {
      return await loadSettings(db);
    } finally {
      await db.closeAsync();
    }
  } catch {
    return {}; // never opened yet: defaults
  }
}

export async function widgetTaskHandler(props) {
  const { widgetAction, widgetInfo, renderWidget } = props;
  if (widgetAction === 'WIDGET_CLICK' || widgetAction === 'WIDGET_DELETED') return;
  const s = await readSettings();
  const language = ['en', 'fa', 'tr'].includes(s.language) ? s.language : 'en';
  const c = widgetPalette({
    theme: s.theme,
    appearance: s.appearance || 'system',
    premium: s.premium === true || s.premium === 'true',
    systemDark: Appearance.getColorScheme() === 'dark',
  });
  renderWidget(widgetFor(widgetInfo.widgetName, { now: new Date(), language, calendar: s.calendar || 'default', c }));
}
