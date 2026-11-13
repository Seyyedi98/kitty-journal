import { DEFAULT_THEME, THEME_KEYS, buildPalette } from '../theme';
import { effectiveTheme } from '../premium';

/** Palette for the widget from the same settings the app uses. */
export function widgetPalette({ theme, appearance, premium, systemDark }) {
  const dark = appearance === 'dark' || (appearance !== 'light' && !!systemDark);
  const key = THEME_KEYS.includes(theme) ? theme : DEFAULT_THEME;
  return buildPalette(effectiveTheme(key, !!premium), dark);
}

