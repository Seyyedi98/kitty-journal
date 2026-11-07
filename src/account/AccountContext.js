import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppState, Linking } from 'react-native';
import { ApiError, getApi } from './api';
import { ENTITLEMENT_REFRESH_MS, OFFLINE_GRACE_DAYS } from './config';
import { premiumActive } from './plan';
import { clearSession, loadSession, saveSession } from './session';
import { createAuthed } from './authed';
import { ORDER_WATCH_MS, orderOutcome, safePaymentUrl } from './purchase';
import { profileFromMe } from './validation';

const EMPTY = { ready: true, user: null, premiumRaw: null, plan: 'free', expiresAt: null, checkedAt: null, lastSeenAt: null, lastBackupAt: null, pendingOrder: null, payment: null };

export const AccountContext = React.createContext({
  ...EMPTY, ready: false,
  requestCode: async () => ({}), verifyCode: async () => {}, saveProfile: async () => {}, signOut: async () => {}, authed: async () => { throw new Error('unauthorized'); },
  refreshEntitlement: async () => {}, setLastBackupAt: () => {},
  startCheckout: async () => { throw new Error('unavailable'); }, checkOrder: async () => null, dismissPayment: () => {},
});
export const useAccount = () => React.useContext(AccountContext);

/**
 * Session = { access, refresh, userId, phone, profile, premium, plan, lastBackupAt }.
 * `user` (what screens see) = { id, phone, name?, age?, gender? }. Name/age/gender are kept on this device only.
 * `premium` (what screens read) is the server's answer, trusted offline only for OFFLINE_GRACE_DAYS after the last
 * successful check, never past the end date, and not after the clock was set back (see plan.premiumActive).
 * It is null until the server has told us once.
 */
const toState = (s) => (s ? {
  ready: true,
  user: { id: s.userId, phone: s.phone, ...(s.profile || {}), ...(s.profile && s.profile.gender === 'unspecified' ? { gender: 'prefer_not_to_say' } : {}) },
  premiumRaw: typeof s.premium === 'boolean' ? s.premium : null,
  plan: s.plan || 'free',
  expiresAt: s.expiresAt || null,
  checkedAt: s.checkedAt || null,
  lastSeenAt: s.lastSeenAt || null,
  lastBackupAt: s.lastBackupAt || null,
  pendingOrder: s.pendingOrder || null,
  payment: null,
} : EMPTY);

export function AccountProvider({ children }) {
  const [state, setState] = useState({ ...EMPTY, ready: false });
  const [tick, setTick] = useState(() => Date.now()); // re-evaluates Premium as time passes
  const sessionRef = useRef(null);
  const lastEntCheck = useRef(0);
  const checkOrderRef = useRef(null);
  const checking = useRef(false);
  const alive = useRef(true);
  // set to true again on every mount: a hot reload or Strict Mode runs the cleanup first, and without this no screen would ever update
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);

  const setSession = useCallback(async (s) => {
    sessionRef.current = s;
    if (s) await saveSession(s); else await clearSession();
    // logged out while this save was still running: do not bring the old session back
    if (s && sessionRef.current === null) { await clearSession(); return; }
    if (alive.current) setState((prev) => ({ ...toState(s), payment: s ? prev.payment : null }));
  }, []);
  const patchSession = useCallback((patch) => {
    if (!sessionRef.current) return Promise.resolve();
    return setSession({ ...sessionRef.current, ...patch });
  }, [setSession]);

  const authedRef = useRef(null);
  if (!authedRef.current) {
    authedRef.current = createAuthed({
      getSession: () => sessionRef.current,
      applyTokens: (tokens) => patchSession(tokens),
      endSession: () => setSession(null),
      get api() { return getApi(); },
    });
  }
  const authed = authedRef.current;

  const syncProfile = useCallback(async () => {
    const cur = sessionRef.current;
    if (!cur || !cur.profile || !cur.profileDirty) return;
    try {
      await authed((tok) => getApi().updateProfile(tok, cur.profile));
      await patchSession({ profileDirty: false });
    } catch { /* offline or server busy: it is retried next time the app starts or comes back */ }
  }, [authed, patchSession]);
  const refreshEntitlement = useCallback(async (force = false) => {
    if (!sessionRef.current) return;
    if (!force && Date.now() - lastEntCheck.current < ENTITLEMENT_REFRESH_MS) return;
    const started = Date.now();
    lastEntCheck.current = started;
    // remember the latest time the app has seen (used to notice a clock that was set back)
    if (started > (sessionRef.current.lastSeenAt || 0)) patchSession({ lastSeenAt: started });
    try {
      const e = await authed((tok) => getApi().entitlement(tok));
      const at = Date.now();
      if (e && typeof e.premium === 'boolean') await patchSession({ premium: e.premium, plan: e.plan || (e.premium ? 'premium' : 'free'), expiresAt: e.premium ? (e.expires_at || null) : null, checkedAt: at, lastSeenAt: at });
    } catch { /* offline: the last answer keeps working for the grace period, then Premium pauses until a check succeeds */ }
    syncProfile();
  }, [authed, patchSession]);

  // start-up: restore the session, then check the plan quietly
  useEffect(() => {
    (async () => {
      const s = await loadSession();
      sessionRef.current = s;
      if (alive.current) setState(toState(s));
      if (s) { refreshEntitlement(true); if (s.pendingOrder && checkOrderRef.current) checkOrderRef.current(); }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  // back to the foreground: plan re-checked (at most once per ENTITLEMENT_REFRESH_MS)
  useEffect(() => {
    const sub = AppState.addEventListener('change', (st) => { if (st === 'active') { setTick(Date.now()); refreshEntitlement(false); if (checkOrderRef.current) checkOrderRef.current(); } });
    const id = setInterval(() => {
      const now = Date.now();
      setTick(now);
      // keep the "latest time this app has seen" fresh, so a clock set back later is noticed
      const s = sessionRef.current;
      if (s && now - (s.lastSeenAt || 0) > 5 * 60 * 1000) patchSession({ lastSeenAt: now });
      refreshEntitlement(false); // network check only when ENTITLEMENT_REFRESH_MS (15 min) has passed
    }, 60000);
    return () => { sub.remove(); clearInterval(id); };
  }, [refreshEntitlement, patchSession]);

  // ── buying a plan ────────────────────────────────────────────────────────────
  /** Ask the server for a payment page (it talks to Zibal), remember the order and open the page in the browser. */
  const startCheckout = useCallback(async (planId, code) => {
    const r = await authed((tok) => getApi().checkout(tok, code ? { plan_id: planId, code } : { plan_id: planId }));
    const url = r && typeof r.order_id === 'string' ? safePaymentUrl(r.payment_url) : null;
    if (!url) throw new ApiError('server', 'unexpected answer from the server');
    await patchSession({ pendingOrder: { id: r.order_id, at: Date.now() } });
    if (alive.current) setState((st) => ({ ...st, payment: null }));
    try { await Linking.openURL(url); } catch { throw new ApiError('server', 'cannot open the payment page'); }
    return { orderId: r.order_id };
  }, [authed, patchSession]);
  /**
   * Ask the server how the last started order went. 'paid' → the plan is re-read from the server right away.
   * Returns 'paid' | 'failed' | 'cancelled' | 'expired' | 'pending' | 'unknown' (offline) | null (no order).
   */
  const checkOrder = useCallback(async () => {
    const cur = sessionRef.current && sessionRef.current.pendingOrder;
    if (!cur || checking.current) return cur ? 'pending' : null;
    checking.current = true;
    const finish = async (status) => {
      await patchSession({ pendingOrder: null });
      if (alive.current) setState((st) => ({ ...st, payment: { status, at: Date.now() } }));
      return status;
    };
    try {
      const o = await authed((tok) => getApi().order(tok, cur.id));
      const outcome = orderOutcome(o && o.status);
      if (outcome === 'paid') { await refreshEntitlement(true); return await finish('paid'); }
      if (outcome !== 'pending') return await finish(outcome);
      if (Date.now() - (cur.at || 0) > ORDER_WATCH_MS) return await finish('expired');
      return 'pending';
    } catch (e) {
      if (e instanceof ApiError && e.code === 'not_found') return finish('failed');
      return 'unknown'; // offline or server busy: the order stays and is checked again later
    } finally {
      checking.current = false;
    }
  }, [authed, patchSession, refreshEntitlement]);
  checkOrderRef.current = checkOrder;
  const dismissPayment = useCallback(() => { setState((st) => ({ ...st, payment: null })); }, []);

  const requestCode = useCallback((phone) => getApi().requestCode(phone), []);
  /** profile (register only) is kept on the device. */
  const verifyCode = useCallback(async (challengeId, code, { phone, profile } = {}) => {
    const r = await getApi().verifyCode(challengeId, code, 'Android phone');
    if (!r || !r.access_token || !r.refresh_token) throw new ApiError('server');
    const prev = await loadSession();
    const keepProfile = profile || (prev && prev.userId === r.user_id ? prev.profile : null) || null;
    await setSession({ access: r.access_token, refresh: r.refresh_token, userId: r.user_id, phone: phone || '', profile: keepProfile, premium: null, plan: 'free', expiresAt: null, checkedAt: null, lastSeenAt: null, lastBackupAt: null });
    refreshEntitlement(true);
    // Does the server already know this person? (needs a profile on GET /me; without one the app asks for details)
    if (!keepProfile) {
      try {
        const me = await authed((tok) => getApi().me(tok));
        const known = profileFromMe(me);
        if (known) await patchSession({ profile: known });
      } catch { /* the details form will simply ask */ }
    }
    return r;
  }, [authed, patchSession, refreshEntitlement, setSession]);
  /** Save name/age/gender on the device and on the server (retried later if it fails). */
  const saveProfile = useCallback(async (profile) => {
    await patchSession({ profile, profileDirty: true });
    await syncProfile();
  }, [patchSession, syncProfile]);

  const signOut = useCallback(async () => {
    const cur = sessionRef.current;
    await setSession(null);
    if (cur) getApi().logout(cur.access).catch(() => {});
  }, [setSession]);
  const setLastBackupAt = useCallback((iso) => { patchSession({ lastBackupAt: iso }); }, [patchSession]);

  const value = useMemo(() => {
    const { premiumRaw, ...rest } = state;
    const active = premiumActive({ premium: premiumRaw, expiresAt: state.expiresAt, checkedAt: state.checkedAt, lastSeenAt: state.lastSeenAt }, tick, OFFLINE_GRACE_DAYS);
    const expired = state.expiresAt && Date.parse(state.expiresAt) <= tick;
    return {
      ...rest,
      premium: premiumRaw === null ? null : active,
      premiumUnconfirmed: premiumRaw === true && !active && !expired, // Premium on record, but it must be confirmed online
      pendingOrder: Boolean(state.pendingOrder),
      requestCode, verifyCode, saveProfile, signOut, authed, refreshEntitlement, setLastBackupAt, startCheckout, checkOrder, dismissPayment };
  }, [state, tick, requestCode, verifyCode, saveProfile, signOut, authed, refreshEntitlement, setLastBackupAt, startCheckout, checkOrder, dismissPayment],
  );
  return <AccountContext.Provider value={value}>{children}</AccountContext.Provider>;
}
