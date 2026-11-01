// Turns the editor's sanitised HTML subset into plain blocks that a native screen can render
// (read-only preview). Pure, no DOM.
import { decodeEntities, sanitizeHtml } from './richText';

const TAG = /<(\/?)([a-z0-9]+)([^>]*)>|([^<]+)/gi;
const TEXT_BLOCKS = new Set(['p', 'h1', 'h2', 'h3', 'li']);

function styleOf(attrs) {
  const m = /style\s*=\s*"([^"]*)"/i.exec(attrs || '');
  const css = m ? m[1] : '';
  const get = (k) => {
    const r = new RegExp(`(?:^|;)\\s*${k}\\s*:\\s*([^;]+)`, 'i').exec(css);
    return r ? r[1].trim() : null;
  };
  return { color: get('color'), background: get('background-color'), font: get('font-family'), align: get('text-align') };
}

/**
 * @returns {Array<{type:'p'|'h1'|'h2'|'h3'|'li'|'hr', dir:string|null, align:string|null, quote:boolean,
 *                  marker:string|null, runs:Array<{text:string, bold?:true, italic?:true, underline?:true,
 *                  strike?:true, color?:string, background?:string, font?:string}>}>}
 */
export function htmlToBlocks(html) {
  const src = sanitizeHtml(html || '');
  const blocks = [];
  const lists = []; // { ordered, n }
  let quote = 0;
  let cur = null;
  const marks = { strong: 0, em: 0, u: 0, s: 0 };
  const spans = [];

  const open = (type, attrs, marker) => {
    const dir = /dir="(ltr|rtl|auto)"/i.exec(attrs || '');
    const al = styleOf(attrs).align;
    cur = { type, dir: dir ? dir[1] : null, align: al || null, quote: quote > 0, marker: marker || null, runs: [] };
    blocks.push(cur);
  };
  const run = (text) => {
    if (!cur) open('p', '');
    const r = { text };
    if (marks.strong) r.bold = true;
    if (marks.em) r.italic = true;
    if (marks.u) r.underline = true;
    if (marks.s) r.strike = true;
    const sp = spans[spans.length - 1];
    if (sp) {
      if (sp.color) r.color = sp.color;
      if (sp.background) r.background = sp.background;
      if (sp.font) r.font = sp.font;
    }
    cur.runs.push(r);
  };

  let m;
  TAG.lastIndex = 0;
  while ((m = TAG.exec(src))) {
    if (m[4] !== undefined) {
      const text = decodeEntities(m[4]);
      if (text) run(text);
      continue;
    }
    const closing = m[1] === '/';
    const name = m[2].toLowerCase();
    if (name === 'ul' || name === 'ol') {
      if (closing) lists.pop();
      else lists.push({ ordered: name === 'ol', n: 0 });
    } else if (name === 'blockquote') {
      quote += closing ? -1 : 1;
      cur = null;
    } else if (name === 'hr') {
      if (!closing) blocks.push({ type: 'hr', dir: null, align: null, quote: false, marker: null, runs: [] });
      cur = null;
    } else if (TEXT_BLOCKS.has(name)) {
      if (closing) cur = null;
      else if (name === 'li') {
        const l = lists[lists.length - 1] || { ordered: false, n: 0 };
        l.n += 1;
        open('li', m[3], l.ordered ? `${l.n}.` : '•');
      } else open(name, m[3]);
    } else if (name === 'br') {
      if (cur) cur.runs.push({ text: '\n' });
    } else if (name === 'strong' || name === 'em' || name === 'u' || name === 's') {
      marks[name] += closing ? -1 : 1;
    } else if (name === 'span') {
      if (closing) spans.pop();
      else spans.push(styleOf(m[3]));
    }
  }
  return blocks;
}
