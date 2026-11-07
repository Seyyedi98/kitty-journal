import { GENDERS, MAX_AGE, MIN_AGE } from './config';

const DIGITS = { '۰': '0', '۱': '1', '۲': '2', '۳': '3', '۴': '4', '۵': '5', '۶': '6', '۷': '7', '۸': '8', '۹': '9', '٠': '0', '١': '1', '٢': '2', '٣': '3', '٤': '4', '٥': '5', '٦': '6', '٧': '7', '٨': '8', '٩': '9' };

/** Persian/Arabic digits to 0-9. */
export const asciiDigits = (s) => String(s ?? '').replace(/[۰-۹٠-٩]/g, (d) => DIGITS[d]);

/**
 * Phone to E.164 (+989121234567) or null. Accepts Persian digits, spaces, dashes and
 * Iranian local forms (0912…, 912…, 0098…). Other countries must be typed with +country code.
 */
export function normalizePhone(input) {
  let s = asciiDigits(input).replace(/[\s\-().]/g, '');
  if (!s) return null;
  if (s.startsWith('00')) s = '+' + s.slice(2);
  if (s.startsWith('+')) {
    const d = s.slice(1);
    return /^[1-9]\d{7,14}$/.test(d) ? '+' + d : null;
  }
  if (!/^\d+$/.test(s)) return null;
  if (/^09\d{9}$/.test(s)) return '+98' + s.slice(1);
  if (/^9\d{9}$/.test(s)) return '+98' + s;
  if (/^989\d{9}$/.test(s)) return '+' + s;
  return null;
}

export const normalizeCode = (input) => asciiDigits(input).replace(/\D/g, '');

/** Returns { ok, errors: {name?, age?, gender?}, value } — error values are i18n keys. */
export function validateProfile({ name, age, gender }) {
  const errors = {};
  const n = String(name ?? '').trim().replace(/\s+/g, ' ');
  if (n.length < 1 || n.length > 60) errors.name = 'accErrName';
  const a = Number(asciiDigits(age));
  const g = gender === 'unspecified' ? 'prefer_not_to_say' : gender; // older saved profiles
  if (!Number.isInteger(a) || a < MIN_AGE || a > MAX_AGE) errors.age = 'accErrAge';
  if (!GENDERS.includes(g)) errors.gender = 'accErrGender';
  return { ok: Object.keys(errors).length === 0, errors, value: { name: n, age: a, gender: g } };
}

/** The server may (now or later) return the profile on GET /me, either nested or flat. Returns a valid profile or null. */
export function profileFromMe(me) {
  const p = (me && (me.profile || me)) || {};
  const v = validateProfile({ name: p.name, age: p.age, gender: p.gender });
  return v.ok ? v.value : null;
}
