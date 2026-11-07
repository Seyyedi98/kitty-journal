// Plans, prices and discounts come from the server; the app only shows them and starts the payment.
// The server talks to Zibal (the merchant key never reaches the phone), gives us a payment page address, and later
// tells us whether the order was paid. A plan becomes active only when the server's entitlement says so.

const FA_DIGITS = '۰۱۲۳۴۵۶۷۸۹';

/** 99000 → "99,000" (Persian digits and separator for fa). Whole numbers only: Toman and Rial have no decimals. */
export function formatAmount(amount, language = 'en') {
  const n = Math.max(0, Math.round(Number(amount) || 0));
  const fa = language === 'fa';
  const grouped = String(n).replace(/\B(?=(\d{3})+(?!\d))/g, fa ? '٬' : ',');
  return fa ? grouped.replace(/\d/g, (d) => FA_DIGITS[Number(d)]) : grouped;
}

const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : typeof v === 'string' && v.trim() !== '' && Number.isFinite(Number(v)) ? Number(v) : null);

/**
 * Server answer of GET /plans → what the screen needs. Bad plans are dropped, never guessed.
 * The charged amount is always the server's `final_price`; the app never works out a price itself.
 */
export function normalizePlans(raw) {
  const out = { currency: 'IRT', plans: [], code: null, notice: null };
  if (!raw || typeof raw !== 'object') return out;
  if (raw.currency === 'IRR' || raw.currency === 'IRT') out.currency = raw.currency;
  for (const p of Array.isArray(raw.plans) ? raw.plans : []) {
    if (!p || typeof p.id !== 'string' || !p.id) continue;
    const price = num(p.price);
    if (price === null || price < 0) continue;
    let final = num(p.final_price);
    if (final === null || final < 0 || final > price) final = price;
    const d = p.discount && typeof p.discount === 'object' ? p.discount : null;
    let percent = d ? num(d.percent) : null;
    if (final < price) percent = percent !== null && percent > 0 && percent < 100 ? Math.round(percent) : Math.round((1 - final / price) * 100);
    out.plans.push({
      id: p.id,
      title: typeof p.title === 'string' && p.title.trim() ? p.title.trim().slice(0, 40) : null,
      months: num(p.months) > 0 ? Math.round(num(p.months)) : null,
      days: num(p.days) > 0 ? Math.round(num(p.days)) : null,
      price,
      finalPrice: final,
      discounted: final < price,
      percent: final < price ? percent : null,
      discountLabel: d && typeof d.label === 'string' ? d.label.slice(0, 40) : null,
      discountEndsAt: d && typeof d.ends_at === 'string' && !Number.isNaN(Date.parse(d.ends_at)) ? d.ends_at : null,
      badge: typeof p.badge === 'string' ? p.badge.slice(0, 20) : null,
    });
  }
  if (raw.code && typeof raw.code === 'object' && typeof raw.code.value === 'string') {
    out.code = { value: raw.code.value, valid: raw.code.valid === true, message: typeof raw.code.message === 'string' ? raw.code.message.slice(0, 120) : null };
  }
  if (typeof raw.notice === 'string' && raw.notice.trim()) out.notice = raw.notice.trim().slice(0, 200);
  return out;
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

/** Order status from the server → what the app does next. */
export function orderOutcome(status) {
  if (status === 'paid') return 'paid';
  if (status === 'failed' || status === 'cancelled' || status === 'canceled' || status === 'expired') return status === 'canceled' ? 'cancelled' : status;
  return 'pending';
}

/** A started order is checked for at most this long (the payment page itself expires much sooner). */
export const ORDER_WATCH_MS = 24 * 60 * 60 * 1000;
