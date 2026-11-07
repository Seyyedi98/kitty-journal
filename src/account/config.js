// Other account settings. The server address itself lives in ./server.js (yours; never overwritten).
import { API_BASE_URL } from "./server";
export { API_BASE_URL, APP_ID } from "./server";

export const MOCK_CODE = "123456";
export const REQUEST_TIMEOUT_MS = 15000;
export const CODE_LENGTH = 6;
export const DEFAULT_RESEND_SECONDS = 60; // used only if the server does not send resend_after
export const ENTITLEMENT_REFRESH_MS = 15 * 60 * 1000; // plan is re-checked at most this often when the app returns to the foreground (opening the Account or Backup screen still forces one check)
export const OFFLINE_GRACE_DAYS = 7; // how long Premium keeps working with no successful check on the server
export const FALLBACK_BACKUP_LIMIT = 3; // shown only if the server does not say
export const MIN_AGE = 12;
export const MAX_AGE = 100;
export const GENDERS = ["female", "male"]; // same words as the server

const dev = () => typeof __DEV__ !== "undefined" && __DEV__ === true;
export const useMock = () => !API_BASE_URL && dev();
export const serverReady = () => Boolean(API_BASE_URL) || useMock();
/** Plain http is only allowed in development builds. */
export const baseUrlAllowed = (url) =>
  /^https:\/\//i.test(url) || (dev() && /^http:\/\//i.test(url));
