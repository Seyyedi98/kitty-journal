// Headless task: Android asks for a widget picture, we read the saved settings
// straight from the journal database and render with the app's theme.
import React from 'react';
import { Appearance } from 'react-native';
import { FlexWidget, TextWidget } from 'react-native-android-widget';
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
  try {
    const s = await readSettings();
    const language = ['en', 'fa', 'tr'].includes(s.language) ? s.language : 'en';
    const c = widgetPalette({
      theme: s.theme,
      appearance: s.appearance || 'system',
      premium: s.widgetPremium === true, // saved by the app (Premium itself comes from the server)
      systemDark: Appearance.getColorScheme() === 'dark',
    });
    // the app saves the calendar choice as "calendarType"
    renderWidget(widgetFor(widgetInfo.widgetName, { now: new Date(), language, calendar: s.calendarType || 'default', c }));
  } catch (error) {
    // Never leave a blank widget: draw a plain date card instead and log the reason (adb logcat shows it).
    console.warn('[kitty-journal] widget render failed:', error && error.message);
    try {
      renderWidget(
        <FlexWidget
          clickAction="OPEN_APP"
          style={{ height: 'match_parent', width: 'match_parent', backgroundColor: '#FBF8F0', borderRadius: 24, alignItems: 'center', justifyContent: 'center' }}
        >
          <TextWidget text={String(new Date().getDate())} style={{ fontSize: 44, fontWeight: '800', color: '#3B3A33' }} />
        </FlexWidget>,
      );
    } catch {
      /* nothing more can be done */
    }
  }
}
