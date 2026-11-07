import { ApiError } from './api';

/**
 * Runs authenticated calls: authed(fn) → fn(accessToken); if the server says the token has expired (401)
 * the pair is refreshed ONCE (shared by concurrent calls, because the server retires the old refresh
 * token on use) and fn is retried. A definite refusal ends the login; being offline does not.
 */
export function createAuthed({ getSession, applyTokens, endSession, api }) {
  let refreshing = null;
  const refresh = () => {
    if (refreshing) return refreshing;
    refreshing = (async () => {
      const cur = getSession();
      if (!cur) throw new ApiError('unauthorized');
      try {
        const r = await api.refresh(cur.refresh);
        if (!r || !r.access_token || !r.refresh_token) throw new ApiError('server');
        await applyTokens({ access: r.access_token, refresh: r.refresh_token });
        return r.access_token;
      } catch (e) {
        if (e instanceof ApiError && (e.code === 'unauthorized' || e.status === 400 || e.status === 403)) {
          await endSession();
          throw new ApiError('unauthorized');
        }
        throw e;
      }
    })();
    const clear = () => { refreshing = null; };
    refreshing.then(clear, clear);
    return refreshing;
  };
  return async (fn) => {
    const cur = getSession();
    if (!cur) throw new ApiError('unauthorized');
    try {
      return await fn(cur.access);
    } catch (e) {
      if (!(e instanceof ApiError) || e.code !== 'unauthorized') throw e;
      return fn(await refresh());
    }
  };
}
