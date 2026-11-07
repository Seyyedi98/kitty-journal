import { fmt } from '../i18n';
import { ApiError } from './api';

const ERROR_KEY = { network: 'accErrNetwork', timeout: 'accErrNetwork', invalid_code: 'accErrCode', rate_limited: 'accErrRate', not_found: 'accErrNotFound', unauthorized: 'accErrSession', payment_required: 'accErrPaid', too_large: 'accErrTooLarge', limit_reached: 'accErrLimit', server: 'accErrServer' };

/** Friendly, translated text for any error thrown by the account/backup code. */
export const errText = (t, e, num = String) => {
  if (e instanceof ApiError && e.code === 'rate_limited' && e.retryAfter) return fmt(t.accErrRateIn, { n: num(e.retryAfter) });
  return t[ERROR_KEY[e instanceof ApiError ? e.code : 'server']] || t.accErrServer;
};
