import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppState, Linking } from 'react-native';
import { ApiError, getApi } from './api';
import { ENTITLEMENT_REFRESH_MS, OFFLINE_GRACE_DAYS } from './config';
import { premiumActive } from './plan';
import { clearSession, loadSession, saveSession } from './session';
import { createAuthed } from './authed';
import { ORDER_WATCH_MS, POLL_EVERY_MS, POLL_TRIES, paymentIdFromLink, purchaseOutcome, safePaymentUrl } from './purchase';
import { profileFromMe } from './validation';

const EMPTY = { ready: true, user: null, premiumRaw: null, plan: 'free', expiresAt: null, checkedAt: null, lastSeenAt: null, lastBackupAt: null, pendingOrder: null, payment: null, polling: false };

export const AccountContext = React.createContext({
  ...EMPTY, ready: false,
  requestCode: async () => ({}), verifyCode: async () => {}, saveProfile: async () => {}, signOut: async () => {}, authed: async () => { throw new Error('unauthorized'); },
  refreshEntitlement: async () => {}, setLastBackupAt: () => {},
  startCheckout: async () => { throw new Error('unavailable'); }, checkOrder: async () => null, pollOrder: async () => null, dismissPayment: () => {},
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
  polling: false,
} : EMPTY);

export function AccountProvider({ children }) {
  const [state, setState] = useState({ ...EMPTY, ready: false });
  const [tick, setTick] = useState(() => Date.now()); // re-evaluates Premium as time passes
  const sessionRef = useRef(null);
  const lastEntCheck = useRef(0);
  const pollRef = useRef(null);
  const linkRef = useRef(null);
  const checking = useRef(false);
  const polling = useRef(false);
  const alive = useRef(true);
  // set to true again on every mount: a hot reload or Strict Mode runs the cleanup first, and without this no screen would ever update
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);

  const setSession = useCallback(async (s) => {
    sessionRef.current = s;
    if (s) await saveSession(s); else await clearSession();
    // logged out while this save was still running: do not bring the old session back
    if (s && sessionRef.current === null) { await clearSession(); return; }
    if (alive.current) setState((prev) => ({ ...toState(s), payment: s ? prev.payment : null, polling: s ? prev.polling : false }));
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
      if (s) {
        refreshEntitlement(true);
        if (s.pendingOrder && pollRef.current) pollRef.current();
        // the app was opened by the payment result page (kittyjournal://payment?...)
        Linking.getInitialURL().then((u) => { if (u && linkRef.current) linkRef.current(u); }).catch(() => {});
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  // back to the foreground: plan re-checked (at most once per ENTITLEMENT_REFRESH_MS)
  useEffect(() => {
    const sub = AppState.addEventListener('change', (st) => { if (st === 'active') { setTick(Date.now()); refreshEntitlement(false); if (pollRef.current) pollRef.current(); } });
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
  const say = useCallback((status, id) => {
    if (alive.current) setState((st) => ({ ...st, payment: { status, at: Date.now(), id: id || null } }));
  }, []);
  /**
   * Ask the server for a purchase (it talks to Zibal) and open the payment page in the system browser.
   * Free with a code → the plan is already active, nothing is opened. Returns { paymentId, free }.
   */
  const startCheckout = useCallback(async (productId, code) => {
    const r = await authed((tok) => getApi().startPurchase(tok, code ? { product_id: productId, code } : { product_id: productId }));
    if (!r || typeof r.payment_id !== 'string') throw new ApiError('server', 'unexpected answer from the server');
    if (r.status === 'paid') {
      await refreshEntitlement(true);
      say('paid', r.payment_id);
      return { paymentId: r.payment_id, free: true };
    }
    const url = safePaymentUrl(r.pay_url);
    if (!url) throw new ApiError('server', 'unexpected answer from the server');
    await patchSession({ pendingOrder: { id: r.payment_id, at: Date.now() } });
    if (alive.current) setState((st) => ({ ...st, payment: null }));
    try { await Linking.openURL(url); } catch { throw new ApiError('server', 'cannot open the payment page'); }
    return { paymentId: r.payment_id, free: false };
  }, [authed, patchSession, refreshEntitlement, say]);
  /**
   * Ask the server once how the open purchase went. 'paid' → the plan is re-read from the server right away.
   * Returns 'paid' | 'failed' | 'review' | 'expired' | 'pending' | 'unknown' (offline) | null (no purchase).
   */
  const checkOrder = useCallback(async () => {
    const cur = sessionRef.current && sessionRef.current.pendingOrder;
    if (!cur) return null;
    if (checking.current) return 'pending';
    checking.current = true;
    const finish = async (status) => {
      await patchSession({ pendingOrder: null });
      say(status, cur.id);
      return status;
    };
    try {
      const o = await authed((tok) => getApi().purchaseStatus(tok, cur.id));
      const outcome = purchaseOutcome(o && o.status);
      if (outcome === 'paid') { await refreshEntitlement(true); return await finish('paid'); }
      if (outcome !== 'pending') return await finish(outcome);
      if (Date.now() - (cur.at || 0) > ORDER_WATCH_MS) return await finish('expired');
      return 'pending';
    } catch (e) {
      if (e instanceof ApiError && (e.code === 'not_found' || e.serverCode === 'unknown_payment')) return finish('failed');
      return 'unknown'; // offline or server busy: the purchase stays and is checked again later
    } finally {
      checking.current = false;
    }
  }, [authed, patchSession, refreshEntitlement, say]);
  /** After coming back from the payment page: ask every 2.5 s for about 30 s, then stop (the screen offers "Check again"). */
  const pollOrder = useCallback(async () => {
    if (polling.current) return null;
    polling.current = true;
    if (alive.current) setState((st) => ({ ...st, polling: true }));
    try {
      let r = null;
      for (let i = 0; i < POLL_TRIES && alive.current; i += 1) {
        r = await checkOrder();
        if (r !== 'pending') break;
        await new Promise((ok) => setTimeout(ok, POLL_EVERY_MS));
      }
      return r;
    } finally {
      polling.current = false;
      if (alive.current) setState((st) => ({ ...st, polling: false }));
    }
  }, [checkOrder]);
  pollRef.current = pollOrder;
  /** The result page opened kittyjournal://payment?...&payment_id=...: only the id is used, the server says what happened. */
  linkRef.current = async (url) => {
    const id = paymentIdFromLink(url);
    if (!id || !sessionRef.current) return;
    const cur = sessionRef.current.pendingOrder;
    if (!cur || cur.id !== id) await patchSession({ pendingOrder: { id, at: Date.now() } });
    pollOrder();
  };
  useEffect(() => {
    const sub = Linking.addEventListener('url', (e) => { if (e && e.url && linkRef.current) linkRef.current(e.url); });
    return () => { if (sub && sub.remove) sub.remove(); };
  }, []);
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
      requestCode, verifyCode, saveProfile, signOut, authed, refreshEntitlement, setLastBackupAt, startCheckout, checkOrder, pollOrder, dismissPayment };
  }, [state, tick, requestCode, verifyCode, saveProfile, signOut, authed, refreshEntitlement, setLastBackupAt, startCheckout, checkOrder, pollOrder, dismissPayment],
  );
  return <AccountContext.Provider value={value}>{children}</AccountContext.Provider>;
}
