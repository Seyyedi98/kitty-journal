import React, { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { WebView } from 'react-native-webview';
import { buildEditorHtml } from '../utils/richEditorHtml';
import { sanitizeHtml } from '../utils/richText';
import { TOOLBAR_FONTS, fontKeysIn, webFontFaces } from '../toolbarFonts';

/**
 * The body editor. The initial `html` is read once when the component mounts —
 * give it a new `key` to load different content. Text is reported through
 * `onChange(sanitisedHtml)` on every edit, never on load.
 */
const RichEditor = forwardRef(function RichEditor(
  { html, colors, rtl, placeholder, minHeight = 220, onChange, onState, onCaret, onFocusChange, onDrag, onDragEnd, onTouchStart },
  ref,
) {
  const web = useRef(null);
  const [height, setHeight] = useState(minHeight);
  const [loaded, setLoaded] = useState(false);
  const source = useMemo(
    () => ({ html: buildEditorHtml({ html, rtl, placeholder, minHeight, colors }) }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  // The page cannot see the app's fonts, so a font is sent into it (in small pieces) the first time it is needed.
  const sent = useRef(new Set());
  const waiting = useRef({});
  const sendFace = (face) =>
    new Promise((resolve) => {
      const w = web.current;
      if (!w) return resolve(false);
      const timer = setTimeout(() => { delete waiting.current[face.id]; resolve(false); }, 20000);
      waiting.current[face.id] = (ok) => { clearTimeout(timer); resolve(ok); };
      const CH = 100000;
      for (let i = 0; i < face.b64.length; i += CH) {
        w.injectJavaScript(`window.__fpart(${JSON.stringify(face.id)},${JSON.stringify(face.b64.slice(i, i + CH))});true;`);
      }
      w.injectJavaScript(`window.__fdone(${JSON.stringify(face.id)},${JSON.stringify(face.name)},${face.weight});true;`);
    });
  const ensureFonts = async (keys) => {
    const todo = keys.filter((k) => TOOLBAR_FONTS[k] && !sent.current.has(k));
    todo.forEach((k) => sent.current.add(k));
    if (!todo.length) return;
    try {
      const faces = await webFontFaces(todo);
      for (const face of faces) {
        const ok = await sendFace(face);
        if (!ok) throw new Error(`font ${face.id} was not accepted by the editor page`);
      }
    } catch (e) {
      todo.forEach((k) => sent.current.delete(k));
      console.warn('[kitty-fonts] editor font failed', e);
    }
  };
  useEffect(() => {
    if (loaded) ensureFonts(fontKeysIn(html));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded]);

  useImperativeHandle(ref, () => ({
    exec(cmd, arg) {
      const run = () => {
        if (web.current) web.current.injectJavaScript(`window.__cmd(${JSON.stringify(cmd)}, ${JSON.stringify(arg === undefined ? null : arg)});true;`);
      };
      if (cmd === 'font' && arg && TOOLBAR_FONTS[arg]) ensureFonts([arg]).then(run);
      else run();
    },
    focus() {
      if (web.current) web.current.injectJavaScript('window.__focus();true;');
    },
  }));

  const onMessage = (e) => {
    let m;
    try {
      m = JSON.parse(e.nativeEvent.data);
    } catch {
      return;
    }
    if (m.t === 'change') onChange?.(sanitizeHtml(m.html, { dropColor: colors && colors.ink }));
    else if (m.t === 'font') { const f = waiting.current[m.id]; delete waiting.current[m.id]; if (!m.ok) console.warn('[kitty-fonts] editor page rejected font', m.id, m.e); f?.(Boolean(m.ok)); }
    else if (m.t === 'state') onState?.(m.s);
    else if (m.t === 'height') setHeight(Math.max(minHeight, Math.min(m.h, 20000)));
    else if (m.t === 'caret') onCaret?.(m.y);
    else if (m.t === 'focus') onFocusChange?.(Boolean(m.v));
    else if (m.t === 'drag') onDrag?.(m.dy);
    else if (m.t === 'dragend') onDragEnd?.(m.v);
    else if (m.t === 'tstart') onTouchStart?.();
  };

  return (
    <WebView
      ref={web}
      originWhitelist={['about:*']}
      source={source}
      onMessage={onMessage}
      onLoadEnd={() => setLoaded(true)}
      style={{ height, backgroundColor: 'transparent' }}
      containerStyle={{ backgroundColor: 'transparent' }}
      scrollEnabled={false}
      nestedScrollEnabled
      overScrollMode="never"
      showsVerticalScrollIndicator={false}
      showsHorizontalScrollIndicator={false}
      javaScriptEnabled
      domStorageEnabled={false}
      allowFileAccess={false}
      setSupportMultipleWindows={false}
      hideKeyboardAccessoryView
      keyboardDisplayRequiresUserAction={false}
      automaticallyAdjustContentInsets={false}
      textZoom={100}
      onShouldStartLoadWithRequest={(r) => r.url === 'about:blank' || r.url.startsWith('about:')}
    />
  );
});

export default RichEditor;
