// Plans, prices and discount codes come from the server (see the server's payment API manual).
// The app never sends a price: it sends a plan id (`product_id`) and an optional discount code. The server talks to
// Zibal, gives us `pay_url`, and later tells us whether the purchase was paid. Plus turns on only when the server's
// entitlement says so.

const FA_DIGITS = '۰۱۲۳۴۵۶۷۸۹';

/** 99000 → "99,000" (Persian digits and separator for fa). Whole numbers only: Toman has no decimals. */
export function formatAmount(amount, language = 'en') {
  const n = Math.max(0, Math.round(Number(amount) || 0));
  const fa = language === 'fa';
  const grouped = String(n).replace(/\B(?=(\d{3})+(?!\d))/g, fa ? '٬' : ',');
  return fa ? grouped.replace(/\d/g, (d) => FA_DIGITS[Number(d)]) : grouped;
}

const whole = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : typeof v === 'string' && v.trim() !== '' && Number.isFinite(Number(v)) ? Number(v) : null);

/** The i18n key of the currency name: 'toman' → cur_IRT, 'rial' → cur_IRR. */
export const currencyKey = (currency) => (String(currency || 'toman').toLowerCase().startsWith('r') || currency === 'IRR' ? 'cur_IRR' : 'cur_IRT');

/** A title that is a string or { en, tr, fa } → the text for this language (falls back to English, then any). */
export function pickTitle(title, language = 'en') {
  if (typeof title === 'string') return title.trim().slice(0, 60);
  if (title && typeof title === 'object') {
    const v = [title[language], title.en, ...Object.values(title)].find((x) => typeof x === 'string' && x.trim());
    return v ? v.trim().slice(0, 60) : '';
  }
  return '';
}

/**
 * Server answer of GET /plans → what the screen needs. Bad plans are dropped, never guessed.
 * `price` is whole Toman; a plan's `durationDays` is null for a lifetime plan.
 */
export function normalizePlans(raw, language = 'en') {
  const out = { currency: 'toman', plans: [] };
  if (!raw || typeof raw !== 'object') return out;
  if (typeof raw.currency === 'string') out.currency = raw.currency.toLowerCase();
  for (const p of Array.isArray(raw.plans) ? raw.plans : []) {
    if (!p || typeof p.id !== 'string' || !p.id) continue;
    const price = whole(p.price);
    if (price === null || price < 0) continue;
    const days = whole(p.duration_days);
    out.plans.push({
      id: p.id,
      plan: typeof p.plan === 'string' ? p.plan : 'premium',
      title: pickTitle(p.title, language) || p.id,
      price: Math.round(price),
      durationDays: days !== null && days > 0 ? Math.round(days) : null,
    });
  }
  return out;
}

/** POST /discounts/check answer → { price, discount, amount } or null when it is not a usable answer. */
export function normalizeQuote(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const price = whole(raw.price);
  const amount = whole(raw.amount);
  if (price === null || amount === null || amount < 0 || amount > price) return null;
  return { price: Math.round(price), amount: Math.round(amount), discount: Math.max(0, Math.round(price - amount)) };
}

/** Only an https payment page is opened. */
export function safePaymentUrl(url) {
  try {
    const u = new URL(String(url));
    return u.protocol === 'https:' ? u.toString() : null;
  } catch {
    return null;
  }
}

/** Purchase status from the server → what the app does next. */
export function purchaseOutcome(status) {
  return status === 'paid' || status === 'failed' || status === 'review' ? status : 'pending';
}

/** The server's result page opens this link (needs "scheme": "kittyjournal" in app.json). */
export const PAYMENT_LINK_PREFIX = 'kittyjournal://payment';

/** The return link the server's result page opens: kittyjournal://payment?status=…&payment_id=…. Only `payment_id` is used (the status is never trusted). */
export function paymentIdFromLink(url, prefix = PAYMENT_LINK_PREFIX) {
  const s = String(url || '');
  if (!s.startsWith(prefix)) return null;
  const m = /[?&]payment_id=([^&#]+)/.exec(s);
  if (!m) return null;
  try {
    const id = decodeURIComponent(m[1]);
    return /^[A-Za-z0-9_-]{4,64}$/.test(id) ? id : null;
  } catch {
    return null;
  }
}

/** A started purchase is checked for at most this long. */
export const ORDER_WATCH_MS = 24 * 60 * 60 * 1000;
/** After coming back from the payment page: ask every 2.5 s, about 12 times, then offer "Check again". */
export const POLL_EVERY_MS = 2500;
export const POLL_TRIES = 12;
