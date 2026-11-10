// Builds the printable HTML for one entry in a chosen template (used for the styled PDF).
// Pure: no DOM, no native modules, so it runs in the app and in Node tests.
import { escapeHtml, sanitizeHtml } from './richText';
import { CAT_BORDERS } from './catBorders';

export const TEMPLATES = [
  { key: 'classic', label: 'tplClassic', swatch: ['#FBF6EA', '#8B5A2B'] },
  { key: 'modern', label: 'tplModern', swatch: ['#FFFFFF', '#2F6F5E'] },
  { key: 'garden', label: 'tplGarden', swatch: ['#E9F0E4', '#C7798B'] },
  { key: 'midnight', label: 'tplMidnight', swatch: ['#1D2433', '#D9B36C'] },
  { key: 'cozy', label: 'tplCozy', swatch: ['#FFE9D6', '#B0543F'] },
  { key: 'navy', label: 'tplNavy', swatch: ['#E6EDF7', '#1F3C6B'] },
  { key: 'vanilla', label: 'tplVanilla', swatch: ['#FFF4CC', '#85650F'] },
  { key: 'professional', label: 'tplProfessional', swatch: ['#F1F3F5', '#34495E'] },
  { key: 'summer', label: 'tplSummer', swatch: ['#FFF0B8', '#0E7C86'] },
  { key: 'forest', label: 'tplForest', swatch: ['#E1EBDB', '#2F6B3B'] },
  { key: 'sunset', label: 'tplSunset', swatch: ['#FBE0DA', '#B03A6A'] },
  { key: 'sepia', label: 'tplSepia', swatch: ['#F4E8D2', '#8C3B24'] },
  { key: 'aurora', label: 'tplAurora', swatch: ['#0B1418', '#5FE3C0'] },
  { key: 'saffron', label: 'tplSaffron', swatch: ['#FFE9B8', '#A35508'] },
  { key: 'mono', label: 'tplMono', swatch: ['#F2F2F2', '#D6006F'] },
  { key: 'kitty', label: 'tplKitty', swatch: ['#FFFBF2', '#E8A5B5'] },
];
export const DEFAULT_TEMPLATE = 'classic';

const VARS = {
  classic: { bg: '#FBF6EA', paper: '#FFFDF6', ink: '#3A332A', muted: '#8A7F6E', accent: '#8B5A2B', line: '#E3D8C0', font: "Georgia, 'Times New Roman', serif" },
  modern: { bg: '#FFFFFF', paper: '#FFFFFF', ink: '#1F2933', muted: '#6B7785', accent: '#2F6F5E', line: '#E4E8EC', font: "'Helvetica Neue', Arial, sans-serif" },
  garden: { bg: '#E9F0E4', paper: '#FFFFFF', ink: '#34402F', muted: '#76846F', accent: '#C7798B', line: '#D3DEC9', font: "Georgia, 'Times New Roman', serif" },
  cozy: { bg: '#FBE7D5', paper: '#FFFAF3', ink: '#4A3A32', muted: '#8C7365', accent: '#B0543F', line: '#F1D9C5', font: "'Trebuchet MS', 'Segoe UI', Arial, sans-serif" },
  navy: { bg: '#E6EDF7', paper: '#FFFFFF', ink: '#1B2A41', muted: '#5D6B80', accent: '#1F3C6B', line: '#D5DEEC', font: "'Helvetica Neue', Arial, sans-serif" },
  vanilla: { bg: '#FFF3C7', paper: '#FFFDF1', ink: '#4A4126', muted: '#8A7C52', accent: '#85650F', line: '#F0E3B5', font: "Georgia, 'Times New Roman', serif" },
  professional: { bg: '#EEF0F3', paper: '#FFFFFF', ink: '#1F2933', muted: '#66727F', accent: '#34495E', line: '#D9DEE4', font: "'Helvetica Neue', Arial, sans-serif" },
  summer: { bg: '#FFEFB5', paper: '#FFFDF4', ink: '#33432F', muted: '#6B7A5E', accent: '#0E7C86', line: '#F3E5B8', font: "'Trebuchet MS', 'Segoe UI', Arial, sans-serif" },
  forest: { bg: '#E1EBDB', paper: '#FBFDF8', ink: '#24351F', muted: '#61755B', accent: '#2F6B3B', line: '#D3E1CF', font: "Georgia, 'Times New Roman', serif" },
  sunset: { bg: '#FBDFD8', paper: '#FFFAF8', ink: '#4A2E3A', muted: '#80626E', accent: '#B03A6A', line: '#F2DAD9', font: "'Trebuchet MS', 'Segoe UI', Arial, sans-serif" },
  midnight: { bg: '#1D2433', paper: '#242C3E', ink: '#EEF0F6', muted: '#9AA3B8', accent: '#D9B36C', line: '#3A4460', font: "Georgia, 'Times New Roman', serif" },
  sepia: { bg: '#EBDDC2', paper: '#F9F0DD', ink: '#3B2A1E', muted: '#7A6650', accent: '#8C3B24', line: '#E0CDAA', font: "Georgia, 'Times New Roman', serif" },
  aurora: { bg: '#0B1418', paper: '#12222A', ink: '#E8F6F4', muted: '#9CB8BC', accent: '#5FE3C0', line: '#2A4048', font: "'Helvetica Neue', Arial, sans-serif" },
  saffron: { bg: '#FBF0D8', paper: '#FFFAEE', ink: '#43321A', muted: '#7A6A4A', accent: '#A35508', line: '#F0DEB8', font: "'Trebuchet MS', 'Segoe UI', Arial, sans-serif" },
  kitty: { bg: '#F7EEE2', paper: '#FFFCF6', ink: '#4A3A32', muted: '#8C7A6C', accent: '#C9788C', line: '#EFDFCF', font: "'Trebuchet MS', 'Segoe UI', Arial, sans-serif" },
  mono: { bg: '#F2F2F2', paper: '#FFFFFF', ink: '#111111', muted: '#5E5E5E', accent: '#D6006F', line: '#E0E0E0', font: "'Helvetica Neue', Arial, sans-serif" },
};

const CSS = (v, key, rtl) => `
@page { size: A4; margin: 0; }
* { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
html, body { margin: 0; padding: 0; background: ${v.bg}; }
body { font-family: ${v.font}; color: ${v.ink}; direction: ${rtl ? 'rtl' : 'ltr'}; }
/* Page frame: a fixed box is painted on EVERY printed page, so each page has its own start,
   end and rounded corners. The text flows through a table whose repeating head/foot rows
   keep it inside the frame (the usual print-CSS way to get per-page margins). */
.frame { position: fixed; top: 26px; bottom: 26px; left: 26px; right: 26px; background: ${v.paper}; z-index: 0; }
.flow { position: relative; z-index: 1; width: 100%; border-collapse: collapse; border-spacing: 0; }
.flow td { padding: 0; }
.sp { height: 64px; }
.content { padding: 0 66px; }
.date { color: ${v.muted}; font-size: 13px; letter-spacing: .04em; }
h1.title { margin: 8px 0 14px; font-size: 32px; line-height: 1.25; color: ${v.ink}; }
.meta { margin: 0 0 20px; display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }
.chip { font-size: 12px; padding: 4px 11px; border-radius: 14px; border: 1px solid ${v.line}; color: ${v.ink}; }
.mood { font-size: 26px; }
.body { font-size: 16px; line-height: 1.75; }
.body p { margin: 0 0 12px; }
.body h1, .body h2, .body h3 { margin: 18px 0 8px; line-height: 1.3; color: ${v.ink}; }
.body h1 { font-size: 26px; } .body h2 { font-size: 21px; } .body h3 { font-size: 18px; }
.body ul, .body ol { margin: 0 0 12px; padding-${rtl ? 'right' : 'left'}: 24px; }
.body blockquote { margin: 0 0 12px; padding: 2px 14px; border-${rtl ? 'right' : 'left'}: 3px solid ${v.accent}; color: ${v.muted}; }
.body hr { border: 0; border-top: 1px solid ${v.line}; margin: 18px 0; }
.photos { margin: 0 0 22px; display: flex; flex-wrap: wrap; gap: 10px; }
.photos .ph { width: 100%; page-break-inside: avoid; }
.photos img { display: block; object-fit: cover; width: 100%; height: 320px; }
.photos.many .ph { width: calc(50% - 5px); }
.photos.many img { height: 190px; }
.photos.many .ph:last-child:nth-child(odd) { width: 100%; }
.photos.many .ph:last-child:nth-child(odd) img { height: 260px; }
.foot { margin-top: 26px; text-align: center; color: ${v.muted}; font-size: 11px; letter-spacing: .08em; }
${{
  classic: `.frame { border: 1px solid ${v.accent}; outline: 1px solid ${v.accent}; outline-offset: 5px; }
.content { text-align: ${rtl ? 'right' : 'left'}; }
.head { text-align: center; border-bottom: 1px solid ${v.line}; margin-bottom: 18px; padding-bottom: 6px; }
.head .date { text-transform: uppercase; }
.head h1.title { font-weight: 400; font-style: italic; }
.head::after { content: '✧'; display: block; color: ${v.accent}; margin: 6px 0; }
.meta { justify-content: center; }
.photos img { border: 6px solid #fff; box-shadow: 0 1px 6px rgba(0,0,0,.18); }`,
  modern: `.frame { border-${rtl ? 'right' : 'left'}: 6px solid ${v.accent}; }
h1.title { font-weight: 800; letter-spacing: -.01em; font-size: 36px; }
.date { color: ${v.accent}; font-weight: 700; text-transform: uppercase; font-size: 12px; }
.chip { background: #F3F6F8; border: 0; }
.photos img { border-radius: 12px; }`,
  garden: `.frame { border-radius: 26px; box-shadow: 0 4px 18px rgba(80,100,70,.18); }
.head { text-align: center; }
.mood { display: inline-block; width: 56px; height: 56px; line-height: 56px; border-radius: 28px; background: #FBE8EC; text-align: center; margin-bottom: 4px; }
h1.title { color: ${v.accent}; font-style: italic; font-weight: 400; }
.meta { justify-content: center; }
.chip { background: #F3F8EF; }
.photos .ph { background: #fff; padding: 8px 8px 10px; border-radius: 6px; box-shadow: 0 2px 8px rgba(0,0,0,.16); transform: rotate(-.6deg); }
.photos .ph:nth-child(even) { transform: rotate(.7deg); }
.photos img { border-radius: 3px; }
.photos.many .ph img { height: 170px; }
.photos.many .ph:last-child:nth-child(odd) img { height: 240px; }`,
  cozy: `html, body { background-color: ${v.bg}; background-image: radial-gradient(#F2C9AE 1.6px, transparent 1.7px), radial-gradient(#F7D8C3 1.2px, transparent 1.3px); background-size: 22px 22px, 22px 22px; background-position: 0 0, 11px 11px; }
.frame { border-radius: 30px; border: 2.5px dashed #E9AE8F; outline: 7px solid ${v.paper}; box-shadow: 0 6px 22px rgba(176,84,63,.18); }
.frame::before { content: ''; position: absolute; top: -17px; left: 50%; width: 120px; height: 30px; margin-left: -60px; transform: rotate(-3deg); border-radius: 3px; opacity: .92; background: repeating-linear-gradient(45deg, #F8C9B6 0 9px, #FDE6D8 9px 18px); box-shadow: 0 1px 3px rgba(0,0,0,.15); }
.head { text-align: center; }
.mood { display: inline-block; width: 58px; height: 58px; line-height: 58px; border-radius: 50%; background: #FCDDCB; text-align: center; margin-bottom: 4px; box-shadow: 0 0 0 5px #FFF0E4; }
.date { color: ${v.accent}; font-weight: 700; letter-spacing: .08em; text-transform: uppercase; font-size: 12px; }
h1.title { color: ${v.accent}; font-family: 'Brush Script MT', 'Segoe Script', 'Comic Sans MS', cursive; font-weight: 400; font-size: 42px; margin: 4px 0 12px; }
.head::after { content: '♡ ✿ ♡'; display: block; color: #E9AE8F; letter-spacing: .5em; font-size: 13px; margin-bottom: 4px; }
.meta { justify-content: center; }
.chip { background: #FDEBDD; border: 1.5px solid #F3CDB6; color: ${v.accent}; font-weight: 600; }
.photos .ph { position: relative; background: #fff; padding: 8px 8px 24px; border-radius: 4px; box-shadow: 0 3px 10px rgba(120,70,40,.22); transform: rotate(-1.4deg); }
.photos .ph:nth-child(even) { transform: rotate(1.6deg); }
.photos .ph::after { content: ''; position: absolute; top: -9px; left: 50%; width: 54px; height: 18px; margin-left: -27px; transform: rotate(4deg); background: repeating-linear-gradient(45deg, #F8C9B6 0 6px, #FDE6D8 6px 12px); opacity: .9; }
.photos img { border-radius: 2px; }
.body blockquote { background: #FDEFE3; border-radius: 10px; padding: 8px 14px; }
.body hr { border-top: 2px dotted #E9AE8F; }
.foot { color: ${v.accent}; }`,
  navy: `.frame { border-top: 12px solid ${v.accent}; border-radius: 6px; box-shadow: 0 2px 10px rgba(27,42,65,.16); }
.head { border-bottom: 2px solid ${v.accent}; margin-bottom: 18px; padding-bottom: 12px; }
.date { color: ${v.muted}; font-weight: 700; letter-spacing: .14em; text-transform: uppercase; font-size: 12px; }
h1.title { color: ${v.accent}; font-weight: 800; text-transform: uppercase; letter-spacing: .02em; font-size: 32px; }
.chip { background: #EAF0F9; border: 0; border-radius: 4px; color: ${v.accent}; font-weight: 700; }
.photos img { border-radius: 2px; border: 3px solid ${v.accent}; }
.body blockquote { background: #F1F5FB; }
.foot { color: ${v.accent}; font-weight: 700; letter-spacing: .2em; text-transform: uppercase; }`,
  vanilla: `html, body { background: ${v.bg}; }
.frame { border-radius: 22px; border: 1.5px solid #E6D08A; outline: 6px solid #FFF8DA; box-shadow: 0 4px 16px rgba(133,101,15,.12); }
.head { text-align: center; }
.date { color: ${v.accent}; font-style: italic; font-size: 14px; letter-spacing: .06em; }
h1.title { font-weight: 400; color: ${v.ink}; font-size: 36px; }
.head::after { content: '· · ·'; display: block; color: #E0C466; letter-spacing: .6em; margin: 6px 0 2px; }
.meta { justify-content: center; }
.chip { background: #FCF3CC; border: 1px solid #EBD98E; color: ${v.accent}; }
.photos .ph { background: #fff; padding: 7px; border-radius: 10px; box-shadow: 0 2px 8px rgba(133,101,15,.18); }
.photos img { border-radius: 6px; }
.body hr { border-top: 1px dashed #E0C466; }
.foot { color: ${v.accent}; }`,
  professional: `.frame { border: 1px solid #C7CED6; border-radius: 2px; }
.head { text-align: ${rtl ? 'right' : 'left'}; border-bottom: 1px solid ${v.line}; padding-bottom: 10px; margin-bottom: 18px; }
.date { text-transform: uppercase; letter-spacing: .12em; font-size: 11px; font-weight: 600; }
h1.title { font-weight: 700; font-size: 30px; margin-bottom: 4px; }
.mood { font-size: 20px; float: ${rtl ? 'left' : 'right'}; }
.chip { border-radius: 3px; background: #F4F6F8; border: 1px solid ${v.line}; color: ${v.accent}; font-weight: 600; }
.photos img { border: 1px solid #C7CED6; padding: 3px; background: #fff; }
.body { font-size: 15px; line-height: 1.7; }
.foot { text-transform: uppercase; letter-spacing: .2em; font-size: 10px; border-top: 1px solid ${v.line}; padding-top: 10px; }`,
  summer: `.frame { border-radius: 26px; border: 3px solid ${v.accent}; overflow: hidden; box-shadow: 0 4px 14px rgba(14,124,134,.2); }
.frame::before { content: ''; position: absolute; top: 0; left: 0; right: 0; height: 14px; background: linear-gradient(90deg, #FF8A5B, #FFD23F 50%, #19B5C2); }
.head { text-align: center; }
.mood { display: inline-block; width: 54px; height: 54px; line-height: 54px; border-radius: 50%; background: #FFE9A3; text-align: center; }
.date { color: #E0643B; font-weight: 700; letter-spacing: .1em; text-transform: uppercase; font-size: 12px; }
h1.title { color: ${v.accent}; font-weight: 800; font-size: 36px; }
.head::after { content: '☀  ~  ☀'; display: block; color: #FFB400; letter-spacing: .3em; font-size: 14px; }
.meta { justify-content: center; }
.chip { background: #E6F6F5; border: 1.5px solid #9ADBD9; color: ${v.accent}; font-weight: 600; }
.photos .ph { background: #fff; padding: 6px; border-radius: 14px; border: 2px solid #FFD23F; }
.photos img { border-radius: 9px; }
.foot { color: ${v.accent}; }`,
  forest: `.frame { border: 2px solid ${v.accent}; outline: 1px solid ${v.accent}; outline-offset: 5px; border-radius: 4px; }
.head { text-align: center; }
.date { color: ${v.accent}; text-transform: uppercase; letter-spacing: .18em; font-size: 11px; }
h1.title { color: ${v.accent}; font-weight: 700; font-size: 34px; }
.head::after { content: '❦'; display: block; color: ${v.accent}; font-size: 20px; margin-top: 4px; }
.meta { justify-content: center; }
.chip { background: #EAF3E8; border: 1px solid #BFD6BA; color: ${v.accent}; }
.photos img { border: 5px solid #fff; box-shadow: 0 1px 6px rgba(36,53,31,.3); }
.body blockquote { background: #F0F6EE; }
.foot { color: ${v.accent}; }`,
  sunset: `.frame { border-radius: 20px; border: 2px solid #F1C5CC; overflow: hidden; box-shadow: 0 4px 16px rgba(176,58,106,.16); }
.frame::before { content: ''; position: absolute; top: 0; left: 0; right: 0; height: 12px; background: linear-gradient(90deg, #FFB38A, #F4789E 50%, #9B5DE5); }
.head { text-align: center; }
.mood { display: inline-block; width: 54px; height: 54px; line-height: 54px; border-radius: 50%; background: #FCE1E8; text-align: center; }
.date { color: ${v.accent}; font-weight: 700; letter-spacing: .12em; text-transform: uppercase; font-size: 12px; }
h1.title { color: ${v.accent}; font-weight: 800; font-size: 38px; }
.meta { justify-content: center; }
.chip { background: #FDEDF1; border: 1px solid #F3C2CF; color: ${v.accent}; font-weight: 600; }
.photos img { border-radius: 14px; }
.body blockquote { background: #FDF1F3; border-radius: 8px; }
.foot { color: ${v.accent}; }`,
  midnight: `.frame { border: 1px solid ${v.accent}; border-radius: 4px; }
h1.title { color: ${v.accent}; font-weight: 400; letter-spacing: .03em; }
.date { color: ${v.accent}; text-transform: uppercase; }
.chip { border-color: ${v.accent}; color: ${v.accent}; }
.photos img { border: 1px solid ${v.accent}; padding: 4px; background: ${v.bg}; }
.body hr { border-top-color: ${v.accent}; }`,
  sepia: `html, body { background: ${v.bg}; }
.frame { border: 1px solid #C9B089; box-shadow: inset 0 0 60px rgba(140,90,40,.18), 0 2px 10px rgba(80,50,20,.18); border-radius: 3px; }
.head { text-align: center; border-bottom: 1px double ${v.accent}; padding-bottom: 8px; margin-bottom: 18px; }
.date { color: ${v.accent}; font-style: italic; font-size: 14px; letter-spacing: .05em; }
h1.title { font-weight: 400; font-style: italic; font-size: 34px; }
.meta { justify-content: center; }
.chip { background: #F1E3C9; border: 1px solid #D8C29A; color: ${v.accent}; font-style: italic; }
.photos img { border: 8px solid #FFF8EA; box-shadow: 0 2px 8px rgba(70,40,10,.3); filter: sepia(.45) contrast(.96); }
.body hr { border-top: 1px dashed #C9B089; }
.foot { color: ${v.accent}; font-style: italic; }`,
  aurora: `.frame { border-radius: 22px; border: 1px solid ${v.line}; overflow: hidden; box-shadow: 0 0 24px rgba(95,227,192,.18); }
.frame::before { content: ''; position: absolute; top: 0; left: 0; right: 0; height: 14px; background: linear-gradient(90deg, #5FE3C0, #3BB5E8 50%, #9B7BFF); }
.head { text-align: center; }
.date { color: ${v.accent}; letter-spacing: .16em; text-transform: uppercase; font-size: 12px; font-weight: 600; }
h1.title { color: ${v.ink}; font-weight: 700; font-size: 36px; }
.head::after { content: '✦  ·  ✦'; display: block; color: ${v.accent}; letter-spacing: .4em; font-size: 13px; margin-top: 4px; }
.meta { justify-content: center; }
.chip { background: #173038; border: 1px solid #2F5560; color: ${v.accent}; }
.photos img { border-radius: 14px; border: 1px solid ${v.line}; }
.body blockquote { background: #173038; border-radius: 8px; }
.body hr { border-top-color: #2F5560; }
.foot { color: ${v.accent}; }`,
  saffron: `.frame { border-radius: 24px; border: 2px solid #E9B35E; outline: 5px solid #FFF1CF; box-shadow: 0 4px 16px rgba(163,85,8,.16); }
.head { text-align: center; }
.mood { display: inline-block; width: 54px; height: 54px; line-height: 54px; border-radius: 50%; background: #FFE3B0; text-align: center; }
.date { color: ${v.accent}; font-weight: 700; letter-spacing: .1em; text-transform: uppercase; font-size: 12px; }
h1.title { color: ${v.accent}; font-weight: 800; font-size: 36px; }
.head::after { content: '❋ ❋ ❋'; display: block; color: #E9A23B; letter-spacing: .5em; font-size: 13px; margin-top: 4px; }
.meta { justify-content: center; }
.chip { background: #FFF1D6; border: 1.5px solid #F0CF8E; color: ${v.accent}; font-weight: 600; }
.photos .ph { background: #fff; padding: 6px; border-radius: 12px; border: 2px solid #C9D9A0; }
.photos img { border-radius: 8px; }
.body hr { border-top: 2px dotted #E9B35E; }
.foot { color: ${v.accent}; }`,
  kitty: `.frame { border-radius: 26px; box-shadow: 0 4px 18px rgba(140,100,70,.16); }
.kbrow { height: 138px; box-sizing: border-box; padding: 30px 26px 8px; display: flex; align-items: center; justify-content: center; }
.kbrow.bottom { padding: 8px 26px 30px; }
.kbrow img { display: block; width: 100%; max-height: 100px; object-fit: contain; }
.head { text-align: center; }
.mood { display: inline-block; width: 54px; height: 54px; line-height: 54px; border-radius: 50%; background: #FCE6EA; text-align: center; }
.date { color: ${v.accent}; font-weight: 700; letter-spacing: .08em; font-size: 12px; }
h1.title { color: ${v.ink}; font-weight: 800; font-size: 34px; }
.meta { justify-content: center; }
.chip { background: #FDEFF1; border: 1px solid #F3CBD3; color: ${v.accent}; font-weight: 600; }
.photos .ph { background: #fff; padding: 7px; border-radius: 12px; box-shadow: 0 2px 8px rgba(140,100,70,.2); }
.photos img { border-radius: 7px; }
.body blockquote { background: #FFF3EC; border-radius: 10px; padding: 8px 14px; }
.body hr { border-top: 2px dotted #EBC9B8; }
.foot { color: ${v.accent}; }`,
  mono: `.frame { border: 2px solid ${v.ink}; border-radius: 0; box-shadow: 8px 8px 0 ${v.accent}; }
.head { text-align: ${rtl ? 'right' : 'left'}; border-bottom: 3px solid ${v.ink}; padding-bottom: 10px; margin-bottom: 18px; }
.date { color: ${v.accent}; font-weight: 800; letter-spacing: .14em; text-transform: uppercase; font-size: 12px; }
h1.title { font-weight: 900; font-size: 38px; letter-spacing: -.02em; margin-bottom: 2px; }
.mood { font-size: 22px; float: ${rtl ? 'left' : 'right'}; filter: grayscale(1); }
.chip { border: 1.5px solid ${v.ink}; border-radius: 0; background: #fff; font-weight: 700; }
.photos img { border-radius: 0; filter: grayscale(1) contrast(1.05); border: 2px solid ${v.ink}; }
.body blockquote { border-color: ${v.accent}; color: ${v.ink}; font-weight: 600; }
.body hr { border-top: 2px solid ${v.ink}; }
.foot { text-transform: uppercase; letter-spacing: .24em; font-size: 10px; font-weight: 800; }`,
}[key]}
`;

/**
 * @param {object} p
 * @param {object} p.entry          entry row ({ title, body, body_html, content_format_version, mood, tags, location })
 * @param {string} p.bodyHtml       the entry's editor HTML (entryToEditorHtml)
 * @param {string} p.template       one of TEMPLATES[].key
 * @param {string} p.dateText       already formatted date
 * @param {string[]} p.photos       image src strings (data: URIs)
 * @param {string} p.moodFace       emoji or ''
 * @param {boolean} p.rtl
 * @param {string} p.footer         small line at the end
 */
export function buildEntryHtml({ entry, bodyHtml, template = DEFAULT_TEMPLATE, dateText, photos = [], moodFace = '', rtl = false, footer = 'Kitty Journal', fontFaces = '', random = Math.random }) {
  const key = VARS[template] ? template : DEFAULT_TEMPLATE;
  const v = VARS[key];
  const tags = (entry.tags || []).map((x) => `<span class="chip">#${escapeHtml(x.name)}</span>`).join('');
  const place = entry.location && (entry.location.name || entry.location.address);
  const placeChip = place ? `<span class="chip">📍 ${escapeHtml(place)}</span>` : '';
  // The Kitten template puts two different random cat dividers in the repeating table head and foot, so they appear at the
  // top and bottom of EVERY printed page (the same pair on all pages of one export; new picks on every export).
  let kbTop = '';
  let kbBottom = '';
  if (key === 'kitty' && CAT_BORDERS.length) {
    const n = CAT_BORDERS.length;
    const a = Math.min(n - 1, Math.floor(random() * n));
    const b = n > 1 ? (a + 1 + Math.min(n - 2, Math.floor(random() * (n - 1)))) % n : a;
    kbTop = `<div class="kbrow top"><img src="${CAT_BORDERS[a]}" alt=""></div>`;
    kbBottom = `<div class="kbrow bottom"><img src="${CAT_BORDERS[b]}" alt=""></div>`;
  }
  const imgs = photos.filter(Boolean).map((src) => `<div class="ph"><img src="${src}"></div>`).join('');
  return `<!doctype html><html lang="${rtl ? 'fa' : 'en'}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><style>${CSS(v, key, rtl)}</style>${fontFaces ? `<style>${fontFaces}</style>` : ''}</head><body class="tpl-${key}"><div class="frame"></div><table class="flow"><thead><tr><td>${kbTop || '<div class="sp"></div>'}</td></tr></thead><tfoot><tr><td>${kbBottom || '<div class="sp"></div>'}</td></tr></tfoot><tbody><tr><td><div class="content">
<div class="head">${moodFace ? `<div class="mood">${/^data:/.test(moodFace) ? `<img src="${moodFace}" style="width:40px;height:40px;vertical-align:middle" />` : moodFace}</div>` : ''}<div class="date">${escapeHtml(dateText)}</div>${entry.title ? `<h1 class="title">${escapeHtml(entry.title)}</h1>` : ''}</div>
${placeChip || tags ? `<div class="meta">${placeChip}${tags}</div>` : ''}
${imgs ? `<div class="photos${photos.filter(Boolean).length > 1 ? ' many' : ''}">${imgs}</div>` : ''}
<div class="body">${sanitizeHtml(bodyHtml || '')}</div>
<div class="foot">${key === 'cozy' ? '♡' : key === 'kitty' ? '🐾' : '✧'} ${escapeHtml(footer)} ${key === 'cozy' ? '♡' : key === 'kitty' ? '🐾' : '✧'}</div>
</div></td></tr></tbody></table></body></html>`;
}
