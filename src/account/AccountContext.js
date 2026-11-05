import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ApiError, getApi } from './api';
import { clearSession, loadSession, saveSession } from './session';

export const AccountContext = React.createContext({
  ready: false, user: null, token: null, plan: 'free', lastBackupAt: null,
  requestCode: async () => {}, verifyCode: async () => {}, signOut: async () => {}, setLastBackupAt: () => {},
});
export const useAccount = () => React.useContext(AccountContext);

export function AccountProvider({ children }) {
  const [state, setState] = useState({ ready: false, user: null, token: null, plan: 'free', lastBackupAt: null });
  const alive = useRef(true);
  useEffect(() => () => { alive.current = false; }, []);

  useEffect(() => {
    (async () => {
      const s = await loadSession();
      if (!alive.current) return;
      setState({ ready: true, user: s?.user || null, token: s?.token || null, plan: s?.plan || 'free', lastBackupAt: s?.lastBackupAt || null });
      if (s?.token) {
        // Refresh the profile/plan quietly; only an explicit 401 signs the user out (offline is fine).
        try {
          const me = await getApi().me(s.token);
          if (!alive.current) return;
          const next = { ...s, user: me.user || s.user, plan: me.plan || s.plan };
          await saveSession(next);
          setState((p) => ({ ...p, user: next.user, plan: next.plan }));
        } catch (e) {
          if (e instanceof ApiError && e.code === 'unauthorized') { await clearSession(); if (alive.current) setState({ ready: true, user: null, token: null, plan: 'free', lastBackupAt: null }); }
        }
      }
    })();
  }, []);

  const requestCode = useCallback((phone, mode, profile) => getApi().requestCode(phone, mode, profile), []);
  const verifyCode = useCallback(async (phone, code, mode, profile) => {
    const r = await getApi().verifyCode(phone, code, mode, profile);
    const session = { token: r.token, user: r.user, plan: r.plan || 'free', lastBackupAt: null };
    await saveSession(session);
    setState({ ready: true, ...session });
    return r;
  }, []);
  const signOut = useCallback(async () => {
    const token = state.token;
    await clearSession();
    setState({ ready: true, user: null, token: null, plan: 'free', lastBackupAt: null });
    if (token) getApi().logout(token).catch(() => {});
  }, [state.token]);
  const setLastBackupAt = useCallback((iso) => {
    setState((p) => {
      if (p.token) saveSession({ token: p.token, user: p.user, plan: p.plan, lastBackupAt: iso });
      return { ...p, lastBackupAt: iso };
    });
  }, []);

  const value = useMemo(() => ({ ...state, requestCode, verifyCode, signOut, setLastBackupAt }), [state, requestCode, verifyCode, signOut, setLastBackupAt]);
  return <AccountContext.Provider value={value}>{children}</AccountContext.Provider>;
}
