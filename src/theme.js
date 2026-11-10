export const MOODS = [
  { key: 'veryLow', face: '😿', color: '#E9D5D1' },
  { key: 'low', face: '🙁', color: '#F1E0CF' },
  { key: 'okay', face: '😐', color: '#F4EBCF' },
  { key: 'good', face: '🙂', color: '#DCE9D8' },
  { key: 'great', face: '😸', color: '#D5E8D9' },
];

export const BASE = {
  ink: '#38352F',
  muted: '#6F695E',
  paper: '#FBF8F0',
  card: '#FFFDF8',
  line: '#EAE3D5',
  sage: '#DCE6D7',
  sageDark: '#6F8668',
  rose: '#EAD0C6',
  lavender: '#E8E0ED',
  bg: '#F5F0E7',
  cream: '#FBF8F0',
  dockBorder: '#E8DFD1',
  brown: '#8B5A2B',
  accent: '#5E7355',
  accentSoft: '#F1F3EB',
  write: '#F8EEE5',
  white: '#FFFFFF',
  danger: '#B64E45',
  star: '#B78E57',
  onAccent: '#FFFFFF',
};

export const DARK = {
  ink: '#EEE8DC',
  muted: '#B5AA98',
  paper: '#242722',
  card: '#2D3029',
  line: '#45473D',
  sage: '#394236',
  sageDark: '#B4C5A6',
  rose: '#514239',
  lavender: '#48404C',
  bg: '#1C1F1A',
  cream: '#282B25',
  dockBorder: '#41443B',
  brown: '#9E7951',
  accent: '#B4C5A6',
  accentSoft: '#2C332A',
  write: '#382F2A',
  white: '#FFFFFF',
  danger: '#E08A80',
  star: '#D4AE78',
  // Text/icons drawn ON the accent color (the dark accent is pale, so white is unreadable).
  onAccent: '#1C1F1A',
};

/* ------------------------------- themes ------------------------------- */
// A theme overrides only colors; layout and typography never change. The
// default "sage" theme is BASE/DARK exactly as designed.

export const THEMES = {
  sage: { light: {}, dark: {} },
  rose: {
    light: {
      sage: '#F0DAD6', sageDark: '#8A4B45', accent: '#9A5750', accentSoft: '#F7EDEB', write: '#F7ECE6',
      rose: '#EAD0C6', paper: '#FCF7F4', card: '#FFFBF9', line: '#EBDDD6', bg: '#F6EEEA', cream: '#FCF7F4',
      muted: '#7A6E69', dockBorder: '#EBDDD6',
    },
    dark: {
      sage: '#4A3532', sageDark: '#E8B8B0', accent: '#E8B8B0', accentSoft: '#35282A', write: '#3A2C2C',
      paper: '#2A2224', card: '#342A2C', line: '#4F4144', bg: '#211B1C', cream: '#2A2224',
      muted: '#BDAFAA', dockBorder: '#4F4144',
    },
  },
  lavender: {
    light: {
      sage: '#E4DDF0', sageDark: '#5E4B86', accent: '#6B5A93', accentSoft: '#F1EEF6', write: '#F2ECF4',
      paper: '#FAF8FC', card: '#FFFDFF', line: '#E3DDEB', bg: '#F3EFF7', cream: '#FAF8FC',
      muted: '#746C80', dockBorder: '#E3DDEB',
    },
    dark: {
      sage: '#3E3750', sageDark: '#CBBFE8', accent: '#CBBFE8', accentSoft: '#302B3B', write: '#352F40',
      paper: '#26232D', card: '#2F2B38', line: '#463F55', bg: '#1E1C24', cream: '#26232D',
      muted: '#B8B0C4', dockBorder: '#463F55',
    },
  },
  // Cozy: warm peach, biscuit cream and terracotta, like a pinned moodboard.
  cozy: {
    light: {
      sage: '#FBDCCB', sageDark: '#8F412C', accent: '#B0543F', accentSoft: '#FDEEE4', write: '#FCEBDD',
      rose: '#F6CFC0', paper: '#FFF7EE', card: '#FFFCF8', line: '#F1DDCB', bg: '#FBEEDF', cream: '#FFF7EE',
      muted: '#7A6356', dockBorder: '#F1DDCB',
    },
    dark: {
      sage: '#4D3329', sageDark: '#F4B99E', accent: '#F4B99E', accentSoft: '#3A2A24', write: '#41302A',
      paper: '#2C2320', card: '#372B27', line: '#52403A', bg: '#231C19', cream: '#2C2320',
      muted: '#CDB8AB', dockBorder: '#52403A',
    },
  },
  // Navy: deep blues and slate, calm and a little sporty.
  navy: {
    light: {
      sage: '#D9E3F2', sageDark: '#1F3C6B', accent: '#2B4C85', accentSoft: '#EAF0F9', write: '#E9EFF8',
      paper: '#F6F9FD', card: '#FDFEFF', line: '#D5DEEC', bg: '#EDF2F9', cream: '#F6F9FD',
      muted: '#5D6B80', dockBorder: '#D5DEEC',
    },
    dark: {
      sage: '#2A3A57', sageDark: '#9DBBEA', accent: '#9DBBEA', accentSoft: '#222D42', write: '#273450',
      paper: '#1D2433', card: '#252E42', line: '#38455F', bg: '#161C28', cream: '#1D2433',
      muted: '#A6B3C9', dockBorder: '#38455F',
    },
  },
  // Vanilla: soft butter yellow and warm cream.
  vanilla: {
    light: {
      sage: '#F5E8B8', sageDark: '#6E560F', accent: '#85650F', accentSoft: '#FBF4DA', write: '#FBF1D3',
      paper: '#FFFBEC', card: '#FFFEF7', line: '#EFE3BC', bg: '#FAF3DC', cream: '#FFFBEC',
      muted: '#6F6445', dockBorder: '#EFE3BC',
    },
    dark: {
      sage: '#4A4020', sageDark: '#F0DC8A', accent: '#F0DC8A', accentSoft: '#352F1C', write: '#3C3520',
      paper: '#2A2618', card: '#342F1E', line: '#524A2C', bg: '#201D12', cream: '#2A2618',
      muted: '#CBBF95', dockBorder: '#524A2C',
    },
  },
  // Professional: quiet slate greys for a clean, work-like journal.
  professional: {
    light: {
      sage: '#DDE3EA', sageDark: '#2F3E4E', accent: '#34495E', accentSoft: '#EEF1F4', write: '#ECEFF2',
      paper: '#F7F8FA', card: '#FFFFFF', line: '#D9DEE4', bg: '#EEF0F3', cream: '#F7F8FA',
      muted: '#5C6773', dockBorder: '#D9DEE4',
    },
    dark: {
      sage: '#33404D', sageDark: '#B9C6D3', accent: '#B9C6D3', accentSoft: '#262E37', write: '#2C3641',
      paper: '#1F252C', card: '#272F38', line: '#3C4753', bg: '#181D22', cream: '#1F252C',
      muted: '#A5B0BC', dockBorder: '#3C4753',
    },
  },
  // Summer: sunshine yellow, sea teal and a touch of coral.
  summer: {
    light: {
      sage: '#FFE8A3', sageDark: '#0B5F68', accent: '#0E7C86', accentSoft: '#E6F6F5', write: '#FFF0C9',
      rose: '#FFC6B0', paper: '#FFFCF2', card: '#FFFFFB', line: '#F3E5B8', bg: '#FFF6D9', cream: '#FFFCF2',
      muted: '#6B6646', dockBorder: '#F3E5B8',
    },
    dark: {
      sage: '#3F3A1C', sageDark: '#7FDCE3', accent: '#7FDCE3', accentSoft: '#1F3436', write: '#38341A',
      paper: '#232A26', card: '#2C332E', line: '#44503F', bg: '#1A201C', cream: '#232A26',
      muted: '#B7C2A8', dockBorder: '#44503F',
    },
  },
  // Forest: mossy greens, earthy and grounded.
  forest: {
    light: {
      sage: '#D6E5D3', sageDark: '#2A5A34', accent: '#2F6B3B', accentSoft: '#EAF3E8', write: '#E9F1E5',
      paper: '#F5FAF3', card: '#FDFFFC', line: '#D3E1CF', bg: '#EBF2E8', cream: '#F5FAF3',
      muted: '#5C6E5B', dockBorder: '#D3E1CF',
    },
    dark: {
      sage: '#2C4630', sageDark: '#A9DDA6', accent: '#A9DDA6', accentSoft: '#243628', write: '#2A3D2D',
      paper: '#1E2A20', card: '#263429', line: '#3A5240', bg: '#171F18', cream: '#1E2A20',
      muted: '#A8BDA8', dockBorder: '#3A5240',
    },
  },
  // Sunset: raspberry pink fading into warm peach.
  sunset: {
    light: {
      sage: '#F9D9DE', sageDark: '#9C2F5C', accent: '#B03A6A', accentSoft: '#FCEBEE', write: '#FBE7E3',
      paper: '#FFF8F6', card: '#FFFCFB', line: '#F2DAD9', bg: '#FBEDEA', cream: '#FFF8F6',
      muted: '#755A63', dockBorder: '#F2DAD9',
    },
    dark: {
      sage: '#4E2B3A', sageDark: '#F7B3CC', accent: '#F7B3CC', accentSoft: '#3A2630', write: '#412C37',
      paper: '#2A1F27', card: '#352933', line: '#523B49', bg: '#20171D', cream: '#2A1F27',
      muted: '#CDB1BE', dockBorder: '#523B49',
    },
  },
  // Midnight Ink: deep indigo ink with gold, like writing a poem after midnight.
  midnight: {
    light: {
      sage: '#E3DFF3', sageDark: '#3C2F7A', accent: '#463A8C', accentSoft: '#EFECF8', write: '#EEEAF7',
      paper: '#F8F6FC', card: '#FFFFFF', line: '#DDD8EC', bg: '#EFECF6', cream: '#F8F6FC',
      muted: '#6E6A85', dockBorder: '#DDD8EC', star: '#B8902F',
    },
    dark: {
      ink: '#EFEAFB', sage: '#2E2850', sageDark: '#E2B857', accent: '#E2B857', accentSoft: '#26213F', write: '#292346',
      paper: '#191630', card: '#221E3D', line: '#3A3563', bg: '#12101F', cream: '#191630',
      muted: '#B3AECF', dockBorder: '#3A3563', star: '#E2B857', onAccent: '#14112A',
    },
  },
  // Sepia: old paper and brown ink with a brick-red accent, a grandmother's diary.
  sepia: {
    light: {
      ink: '#3B2A1E', sage: '#E6D3B0', sageDark: '#6B3A1F', accent: '#8C3B24', accentSoft: '#F1E3C9', write: '#F0DFC0',
      rose: '#E8C9B0', paper: '#F4E8D2', card: '#FBF3E2', line: '#E0CDAA', bg: '#EBDDC2', cream: '#F4E8D2',
      muted: '#7A6650', dockBorder: '#E0CDAA',
    },
    dark: {
      sage: '#4A3A2A', sageDark: '#E8B98E', accent: '#E8B98E', accentSoft: '#3A2E23', write: '#3D2F24',
      paper: '#2A211A', card: '#342A21', line: '#4F4033', bg: '#211A14', cream: '#2A211A',
      muted: '#C7B49C', dockBorder: '#4F4033',
    },
  },
  // Aurora: northern lights, teal and mint glowing on a dark polar night.
  aurora: {
    light: {
      sage: '#D5F0EA', sageDark: '#0F6B66', accent: '#12776F', accentSoft: '#E6F6F3', write: '#E7F0F6',
      lavender: '#E4DDF4', paper: '#F5FBFA', card: '#FDFFFF', line: '#D2E6E3', bg: '#EAF4F3', cream: '#F5FBFA',
      muted: '#5F7472', dockBorder: '#D2E6E3',
    },
    dark: {
      sage: '#183A3A', sageDark: '#5FE3C0', accent: '#5FE3C0', accentSoft: '#14282B', write: '#1A2A38',
      rose: '#3A2B4A', lavender: '#2C2748', paper: '#101C22', card: '#16262D', line: '#2A4048', bg: '#0B1418',
      cream: '#101C22', muted: '#9CB8BC', dockBorder: '#2A4048', onAccent: '#0B1418',
    },
  },
  // Saffron: warm cream, saffron orange and a little pistachio.
  saffron: {
    light: {
      sage: '#FFE3B0', sageDark: '#8A4A00', accent: '#A35508', accentSoft: '#FFF1D6', write: '#FDEBCB',
      rose: '#F3D3B0', lavender: '#E3EDCB', paper: '#FFF9EC', card: '#FFFDF6', line: '#F0DEB8', bg: '#FBF0D8',
      cream: '#FFF9EC', muted: '#7A6A4A', dockBorder: '#F0DEB8',
    },
    dark: {
      sage: '#4A3716', sageDark: '#FFC76B', accent: '#FFC76B', accentSoft: '#3A2D18', write: '#40331A',
      paper: '#2B2317', card: '#352C1D', line: '#54452A', bg: '#211B11', cream: '#2B2317',
      muted: '#CDBB94', dockBorder: '#54452A',
    },
  },
  // Mono: black, white and grey with one sharp pink accent. Clean and modern.
  mono: {
    light: {
      ink: '#111111', muted: '#5E5E5E', sage: '#EDEDED', sageDark: '#1A1A1A', accent: '#D6006F', accentSoft: '#F7E7F0',
      write: '#F0F0F0', rose: '#F3DCE8', lavender: '#ECECEC', paper: '#FAFAFA', card: '#FFFFFF', line: '#E0E0E0',
      bg: '#F2F2F2', cream: '#FAFAFA', dockBorder: '#E0E0E0',
    },
    dark: {
      ink: '#F2F2F2', sage: '#2A2A2A', sageDark: '#F2F2F2', accent: '#FF5CAB', accentSoft: '#2A1A23', write: '#222222',
      rose: '#3A2631', lavender: '#2A2A2A', paper: '#161616', card: '#1F1F1F', line: '#383838', bg: '#0E0E0E',
      cream: '#161616', muted: '#A8A8A8', dockBorder: '#383838', onAccent: '#0E0E0E',
    },
  },
  ocean: {
    light: {
      sage: '#D8E8EC', sageDark: '#2F6674', accent: '#33707F', accentSoft: '#EAF3F5', write: '#EBF2F2',
      paper: '#F6FAFA', card: '#FDFFFF', line: '#D6E3E6', bg: '#EEF4F5', cream: '#F6FAFA',
      muted: '#667579', dockBorder: '#D6E3E6',
    },
    dark: {
      sage: '#2F4348', sageDark: '#9CCBD6', accent: '#9CCBD6', accentSoft: '#26343A', write: '#2B3A3E',
      paper: '#20292C', card: '#273236', line: '#3B4D52', bg: '#192023', cream: '#20292C',
      muted: '#A9BCC1', dockBorder: '#3B4D52',
    },
  },
};

export const THEME_KEYS = Object.keys(THEMES);
export const DEFAULT_THEME = 'sage';

/** Resolved palette for a theme + light/dark. Unknown themes fall back to default. */
export function buildPalette(themeKey, dark) {
  const base = dark ? DARK : BASE;
  const theme = THEMES[themeKey] || THEMES[DEFAULT_THEME];
  return { ...base, ...(dark ? theme.dark : theme.light) };
}

/** WCAG 2.x contrast ratio between two #RRGGBB colors. */
export function contrastRatio(a, b) {
  const lum = (hex) => {
    const n = parseInt(hex.slice(1), 16);
    const ch = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => {
      const c = v / 255;
      return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * ch[0] + 0.7152 * ch[1] + 0.0722 * ch[2];
  };
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

/** True for a light palette (dark text on a light paper). Theme-independent way to ask "is this dark mode?". */
export function isLightPalette(palette) {
  return contrastRatio(palette.paper, '#000000') > contrastRatio(palette.paper, '#FFFFFF');
}
