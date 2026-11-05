// All network calls for accounts and cloud backup. Server contract: see ACCOUNT.md.
import { API_BASE_URL, MOCK_CODE, REQUEST_TIMEOUT_MS, useMock } from './config';

export class ApiError extends Error {
  /** code: network | timeout | invalid_code | rate_limited | unauthorized | payment_required | not_found | server */
  constructor(code, message) {
    super(message || code);
    this.code = code;
  }
}

const codeForStatus = (status, body) => {
  if (body && typeof body.error === 'string') return body.error;
  if (status === 401) return 'unauthorized';
  if (status === 402 || status === 403) return 'payment_required';
  if (status === 404) return 'not_found';
  if (status === 429) return 'rate_limited';
  return 'server';
};

export function createApi({ baseUrl = API_BASE_URL, fetchImpl, timeoutMs = REQUEST_TIMEOUT_MS } = {}) {
  const doFetch = fetchImpl || ((...a) => fetch(...a));
  async function call(method, path, { body, token } = {}) {
    const ctl = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const timer = ctl ? setTimeout(() => ctl.abort(), timeoutMs) : null;
    let res;
    try {
      res = await doFetch(baseUrl.replace(/\/+$/, '') + path, {
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
    try { data = await res.json(); } catch { data = null; }
    if (!res.ok) throw new ApiError(codeForStatus(res.status, data), data && data.message);
    return data;
  }
  return {
    /** Send an SMS code. mode: 'login' | 'register'. Register also sends the profile. */
    requestCode: (phone, mode, profile) => call('POST', '/auth/request-code', { body: { phone, mode, profile } }),
    /** → { token, user:{id,phone,name,age,gender}, plan:'free'|'premium' } */
    verifyCode: (phone, code, mode, profile) => call('POST', '/auth/verify', { body: { phone, code, mode, profile } }),
    me: (token) => call('GET', '/me', { token }),
    logout: (token) => call('POST', '/auth/logout', { token }),
    /** → { updatedAt, count } ; server must answer 402/403 for non-paying users. */
    uploadBackup: (token, snapshot) => call('PUT', '/backup', { token, body: snapshot }),
    /** → snapshot ; 404 when nothing has been backed up yet. */
    downloadBackup: (token) => call('GET', '/backup', { token }),
  };
}

/** In-memory stand-in for the real server (debug builds only, see config.useMock). */
export function createMockApi() {
  const users = new Map(); // phone → user
  let backup = null;
  const wait = (v) => new Promise((r) => setTimeout(() => r(v), 350));
  const tokenFor = (phone) => 'mock.' + phone;
  const phoneOf = (token) => (String(token || '').startsWith('mock.') ? token.slice(5) : null);
  return {
    requestCode: async (phone, mode) => {
      if (mode === 'login' && !users.has(phone) && users.size) throw new ApiError('not_found');
      return wait({ sent: true });
    },
    verifyCode: async (phone, code, mode, profile) => {
      if (code !== MOCK_CODE) throw new ApiError('invalid_code');
      let user = users.get(phone);
      if (mode === 'register' || (!user && profile)) { user = { id: 'u_' + phone, phone, ...profile }; users.set(phone, user); }
      if (!user) { user = { id: 'u_' + phone, phone, name: 'Guest', age: 30, gender: 'unspecified' }; users.set(phone, user); }
      return wait({ token: tokenFor(phone), user, plan: 'free' });
    },
    me: async (token) => { const u = users.get(phoneOf(token)); if (!u) throw new ApiError('unauthorized'); return wait({ user: u, plan: 'free' }); },
    logout: async () => wait({ ok: true }),
    uploadBackup: async (token, snapshot) => { backup = { ...snapshot, updatedAt: new Date().toISOString() }; return wait({ updatedAt: backup.updatedAt, count: snapshot.entries.length }); },
    downloadBackup: async () => { if (!backup) throw new ApiError('not_found'); return wait(backup); },
  };
}

let shared = null;
export const getApi = () => (shared ||= useMock() ? createMockApi() : createApi());
export const setApiForTests = (api) => { shared = api; };
