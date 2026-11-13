import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { getApi } from '../account/api';
import { dismissAnnouncement, loadSaved, pendingAnnouncement, refreshConfig } from '../account/remoteConfig';

const MIN_GAP_MS = 5 * 60 * 1000; // the server caches the answer for 5 minutes, so asking more often is pointless

/**
 * Remote settings: the saved copy at once, then the server at start and whenever the app returns to the front.
 * @returns {{ config: object|null, announcement: {id:string,text:string}|null, closeAnnouncement: () => void }}
 */
export function useRemoteConfig(db, language) {
  const [config, setConfig] = useState(null);
  const [dismissed, setDismissed] = useState(null);
  const configRef = useRef(null);
  const lastAsk = useRef(0);
  const alive = useRef(true);

  const ask = useCallback(async () => {
    if (Date.now() - lastAsk.current < MIN_GAP_MS) return;
    lastAsk.current = Date.now();
    const next = await refreshConfig(db, getApi(), configRef.current);
    if (alive.current && next) {
      configRef.current = next;
      setConfig(next);
    }
  }, [db]);

  useEffect(() => {
    alive.current = true;
    (async () => {
      try {
        const saved = await loadSaved(db);
        if (!alive.current) return;
        configRef.current = saved.config;
        setConfig(saved.config);
        setDismissed(saved.dismissed);
      } catch {
        /* nothing saved: carry on */
      }
      ask();
    })();
    const sub = AppState.addEventListener('change', (st) => {
      if (st === 'active') ask();
    });
    return () => {
      alive.current = false;
      sub.remove();
    };
  }, [db, ask]);

  const announcement = pendingAnnouncement(config, dismissed, language);
  const closeAnnouncement = useCallback(() => {
    const a = pendingAnnouncement(configRef.current, null, language);
    if (!a) return;
    setDismissed(a.id);
    dismissAnnouncement(db, a.id).catch(() => {});
  }, [db, language]);

  return { config, announcement, closeAnnouncement };
}
