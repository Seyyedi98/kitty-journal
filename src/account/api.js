// All network calls. Server routes: /auth/otp/request, /auth/otp/verify, /auth/refresh, /auth/logout, /me,
// /apps/{appId}/entitlement, /apps/{appId}/backups[/{id}], /apps/{appId}/plans, /apps/{appId}/discounts/check, /apps/{appId}/purchases[/{id}].
import { API_BASE_URL, APP_ID } from './server';
import { MOCK_CODE, REQUEST_TIMEOUT_MS, baseUrlAllowed, useMock } from './config';

export class ApiError extends Error {
  /** code: network | timeout | invalid_code | rate_limited | unauthorized | payment_required | not_found | too_large | limit_reached | server */
  constructor(code, message, extra = {}) {
    super(message || code);
    this.code = code;
    this.status = extra.status;
    this.serverCode = extra.serverCode || null;
    this.retryAfter = extra.retryAfter || null;
  }
}

const serverCodeOf = (d) => (d && (typeof d.error === 'string' ? d.error : d.error?.code || d.code)) || null;
const messageOf = (d) => (d && (d.message || d.error?.message)) || undefined;

function codeForStatus(status, ctx) {
  if (status === 429) return 'rate_limited';
  if (ctx === 'verify' && [400, 401, 403, 404, 410, 422].includes(status)) return 'invalid_code';
  if (status === 401) return 'unauthorized';
  if (status === 402 || status === 403) return 'payment_required';
  if (status === 404) return 'not_found';
  if (status === 413) return 'too_large';
  if (status === 409) return 'limit_reached';
  return 'server';
}

export function createApi({ baseUrl = API_BASE_URL, appId = APP_ID, fetchImpl, timeoutMs = REQUEST_TIMEOUT_MS } = {}) {
  const doFetch = fetchImpl || ((...a) => fetch(...a));
  const base = baseUrl.replace(/\/+$/, '');
  const appPath = `/apps/${encodeURIComponent(appId)}`;
  async function call(method, path, { body, token, ctx } = {}) {
    if (!baseUrlAllowed(base)) throw new ApiError('network', 'https required');
    const ctl = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const timer = ctl ? setTimeout(() => ctl.abort(), timeoutMs) : null;
    let res;
    try {
      res = await doFetch(base + path, {
        method,
        headers: { 'Content-Type': 'application/json', Accept: 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: ctl ? ctl.signal : undefined,
      });
    } catch (e) {
      throw new ApiError(e && e.name === 'AbortError' ? 'timeout' : 'network');
    } finally {
      if (timer) clearTimeout(timer);
    }
    let data = null;
    let raw = '';
    if (typeof res.text === 'function') {
      try { raw = await res.text(); data = raw ? JSON.parse(raw) : null; } catch { data = null; }
    } else {
      try { data = await res.json(); } catch { data = null; }
    }
    // Debug builds only: shows in the Metro terminal exactly what was sent and what the server answered.
    if (typeof __DEV__ !== 'undefined' && __DEV__ === true && typeof console !== 'undefined') console.log('[kitty-api]', method, base + path, body && body.phone ? 'phone=' + body.phone : '', '->', res.status, serverCodeOf(data) || '', res.url && res.url !== base + path ? 'REDIRECTED to ' + res.url : '', data && data.resend_after ? 'resend_after=' + data.resend_after : '', !res.ok ? 'message=' + (messageOf(data) || '') : '', !res.ok && !data && raw ? 'body=' + raw.replace(/\s+/g, ' ').slice(0, 200) : '');
    if (!res.ok) {
      const ra = Number(res.headers && res.headers.get ? res.headers.get('retry-after') : 0) || null;
      throw new ApiError(codeForStatus(res.status, ctx), messageOf(data), { status: res.status, serverCode: serverCodeOf(data), retryAfter: ra });
    }
    return data;
  }
  return {
    /** → { challenge_id, expires_in, resend_after }. Same answer for new and existing users. */
    requestCode: async (phone) => {
      const r = await call('POST', '/auth/otp/request', { body: { phone, app_id: appId } });
      // A real answer is 202 with a challenge_id. Anything else (an HTML page, an old server) must not look like "code sent".
      if (!r || typeof r.challenge_id !== 'string' || !r.challenge_id) throw new ApiError('server', 'unexpected answer from the server');
      return r;
    },
    /** → { access_token, refresh_token, session_id, user_id, ... } */
    verifyCode: (challengeId, code, device) => call('POST', '/auth/otp/verify', { body: { challenge_id: challengeId, code, device }, ctx: 'verify' }),
    /** The old refresh token stops working: always keep the new pair. */
    refresh: (refreshToken) => call('POST', '/auth/refresh', { body: { refresh_token: refreshToken } }),
    logout: (token) => call('POST', '/auth/logout', { token }),
    me: (token) => call('GET', '/me', { token }),
    /** PATCH /me {name, gender, birth_year}. The server stores a birth year (an age goes stale) and returns `age`. */
    updateProfile: (token, profile) => call('PATCH', '/me', { token, body: { name: profile.name, gender: profile.gender, birth_year: new Date().getFullYear() - profile.age } }),
    /** → { plan, premium, source, expires_at } */
    entitlement: (token) => call('GET', `${appPath}/entitlement`, { token }),
    /** No sign-in. → { currency: 'toman', plans: [{ id, plan, title: { en, tr, fa }, price, currency, duration_days }] } */
    plans: () => call('GET', `${appPath}/plans`),
    /** Price with a discount code. → { price, discount, amount, currency }. A bad code is 400 `invalid_code` with a readable message. */
    checkDiscount: (token, productId, code) => call('POST', `${appPath}/discounts/check`, { token, body: { product_id: productId, code } }),
    /** Start a purchase. → 201 { payment_id, status: 'pending', amount, pay_url }  or, when a code made it free, { payment_id, status: 'paid', amount: 0, expires_at } */
    startPurchase: (token, body) => call('POST', `${appPath}/purchases`, { token, body }),
    /** → { payment_id, status: pending | paid | failed | review, plan, amount, expires_at } */
    purchaseStatus: (token, id) => call('GET', `${appPath}/purchases/${encodeURIComponent(id)}`, { token }),
    /** → { backups: [...], plan, limit } */
    listBackups: (token) => call('GET', `${appPath}/backups`, { token }),
    /** body: { label?, backup } */
    createBackup: (token, body) => call('POST', `${appPath}/backups`, { token, body }),
    downloadBackup: (token, id) => call('GET', `${appPath}/backups/${encodeURIComponent(id)}`, { token }),
    deleteBackup: (token, id) => call('DELETE', `${appPath}/backups/${encodeURIComponent(id)}`, { token }),
  };
}

/** In-memory stand-in for the server (debug builds with an empty API_BASE_URL). */
export function createMockApi() {
  const wait = (v) => new Promise((r) => setTimeout(() => r(v), 300));
  const challenges = new Map();
  const backups = [];
  const orders = new Map();
  let paid = false;
  let n = 0;
  const pair = (u) => ({ access_token: 'acc.' + u + '.' + ++n, refresh_token: 'kjr_' + u + '_' + n, session_id: 's' + n, user_id: u });
  return {
    requestCode: async (phone) => { const id = 'ch' + ++n; challenges.set(id, phone); return wait({ challenge_id: id, expires_in: 300, resend_after: 30 }); },
    verifyCode: async (id, code) => {
      if (!challenges.has(id) || code !== MOCK_CODE) throw new ApiError('invalid_code');
      return wait(pair('u_' + challenges.get(id)));
    },
    refresh: async (rt) => wait(pair(String(rt).split('_')[1] || 'u')),
    logout: async () => wait(null),
    me: async () => wait({ user_id: 'u', plan: 'free', premium: false }),
    updateProfile: async () => wait(null),
    entitlement: async () => wait(paid ? { plan: 'premium', premium: true, source: 'mock', expires_at: new Date(Date.now() + 30 * 86400000).toISOString() } : { plan: 'free', premium: false, source: 'mock', expires_at: null }),
    plans: async () => wait({
      currency: 'toman',
      plans: [
        { id: 'p1', plan: 'premium', title: { en: 'Plus, 1 month', tr: 'Plus, 1 ay', fa: 'پلاس یک‌ماهه' }, price: 50000, currency: 'toman', duration_days: 30 },
        { id: 'p3', plan: 'premium', title: { en: 'Plus, 3 months', tr: 'Plus, 3 ay', fa: 'پلاس سه‌ماهه' }, price: 129000, currency: 'toman', duration_days: 90 },
        { id: 'life', plan: 'premium', title: { en: 'Lifetime', tr: 'Lifetime', fa: 'Lifetime' }, price: 900000, currency: 'toman', duration_days: null },
      ],
    }),
    checkDiscount: async (t, productId, code) => {
      const price = { p1: 50000, p3: 129000, life: 900000 }[productId];
      if (!price) throw new ApiError('not_found', 'unknown plan', { status: 404, serverCode: 'unknown_product' });
      const c = String(code).trim().toUpperCase();
      if (c === 'FREE') return wait({ price, discount: price, amount: 0, currency: 'toman' });
      if (c !== 'KITTY20') throw new ApiError('server', 'This code cannot be used', { status: 400, serverCode: 'invalid_code' });
      const discount = Math.floor(price * 0.2);
      return wait({ price, discount, amount: price - discount, currency: 'toman' });
    },
    startPurchase: async (t, body) => {
      const id = 'pay' + ++n;
      const free = body.code && String(body.code).trim().toUpperCase() === 'FREE';
      orders.set(id, { checks: 0 });
      if (free) { paid = true; orders.get(id).checks = 99; return wait({ payment_id: id, status: 'paid', amount: 0, expires_at: new Date(Date.now() + 30 * 86400000).toISOString() }); }
      return wait({ payment_id: id, status: 'pending', amount: 50000, pay_url: 'https://example.com/pay/' + id });
    },
    purchaseStatus: async (t, id) => { const o = orders.get(id); if (!o) throw new ApiError('not_found', 'unknown payment', { status: 404, serverCode: 'unknown_payment' }); o.checks += 1; if (o.checks >= 2) paid = true; return wait({ payment_id: id, status: o.checks >= 2 ? 'paid' : 'pending', plan: 'premium', amount: 50000 }); },
    listBackups: async () => wait({ backups: backups.map(({ payload, ...m }) => m).reverse(), plan: 'free', limit: 3 }),
    createBackup: async (t, body) => { const m = { id: 'b' + ++n, label: body.label || null, created_at: new Date().toISOString(), payload: body.backup }; backups.push(m); return wait({ id: m.id, created_at: m.created_at }); },
    downloadBackup: async (t, id) => { const b = backups.find((x) => x.id === id); if (!b) throw new ApiError('not_found'); return wait(b.payload); },
    deleteBackup: async (t, id) => { const i = backups.findIndex((x) => x.id === id); if (i < 0) throw new ApiError('not_found'); backups.splice(i, 1); return wait(null); },
  };
}

let shared = null;
export const getApi = () => (shared ||= useMock() ? createMockApi() : createApi());
export const setApiForTests = (api) => { shared = api; };
