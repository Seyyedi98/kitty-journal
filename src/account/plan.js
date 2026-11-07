/** Whole days of Premium left (rounded up, 0 when over); null when there is no end date. */
export function daysLeft(expiresAt, now = Date.now()) {
  if (!expiresAt) return null;
  const end = new Date(expiresAt).getTime();
  if (Number.isNaN(end)) return null;
  return Math.max(0, Math.ceil((end - now) / 86400000));
}

const SKEW_MS = 5 * 60 * 1000;
/**
 * Is Premium usable right now? The server's last "yes" is trusted only for a limited time offline:
 *  - never past the plan's end date,
 *  - only within `graceDays` of the last successful check with the server,
 *  - not if the phone's clock was moved back (before the last check or before the last time the app saw).
 * `checkedAt` / `lastSeenAt` are millisecond timestamps. Without a check on record the answer is false.
 */
export function premiumActive({ premium, expiresAt, checkedAt, lastSeenAt }, now = Date.now(), graceDays = 3) {
  if (premium !== true) return false;
  if (expiresAt) {
    const end = Date.parse(expiresAt);
    if (!Number.isNaN(end) && now >= end) return false;
  }
  if (!checkedAt) return false;
  if (now < checkedAt - SKEW_MS) return false;
  if (lastSeenAt && now < lastSeenAt - SKEW_MS) return false;
  return now - checkedAt <= graceDays * 86400000;
}
