# Kitty backend API (v1)

The complete reference for everything the mobile app can call. Admin panel routes are not part of this API (see [SECURITY.md](SECURITY.md)).

- [Basics](#basics)
- [1. Sign in](#1-sign-in-sms-code) · [2. Tokens](#2-tokens) · [3. Account and devices](#3-account-and-devices)
- [4. App settings and plan](#4-app-settings-and-current-plan) · [5. Cloud backups](#5-cloud-backups-text-only)
- [6. Buying a plan](#6-buying-a-plan-zibal) · [7. The payment result page](#7-the-payment-result-page)
- [Error codes](#error-codes) · [Limits](#limits) · [Typical app flow](#typical-app-flow) · [Adding another app](#adding-another-app)

## Basics

| | |
| --- | --- |
| Base URL | `https://your-domain/api/v1` |
| Format | JSON in, JSON out. Requests with a body need `Content-Type: application/json`. |
| Times | ISO 8601, UTC (`2026-11-07T10:00:00.000Z`). |
| Money | Whole **Toman** (integers). |
| Sign-in | `Authorization: Bearer <access_token>` on every endpoint marked **Bearer**. A token belongs to one app: using it with another `app_id` gives `403 wrong_app`. |
| Request id | Every response has `X-Request-Id`. Quote it when reporting a problem. |
| Caching | Answers are `Cache-Control: no-store`, except `/config` (5 minutes) and `/plans` (1 minute). |
| Unknown fields | A request with a field the endpoint does not know is refused with `400 invalid_request`. |

Errors always look like this. Branch on `code`, show your own text (the `message` is English):

```json
{ "error": { "code": "invalid_code", "message": "The code is wrong or has expired" } }
```

### Endpoint summary

| Method and path | Sign-in | What it does |
| --- | --- | --- |
| `POST /auth/otp/request` | no | Send an SMS code |
| `POST /auth/otp/verify` | no | Check the code, get tokens |
| `POST /auth/refresh` | no (refresh token) | Get a new token pair |
| `POST /auth/logout` | Bearer | Sign out this device |
| `GET /me` | Bearer | Account, plan and profile |
| `PATCH /me` | Bearer | Change name, gender, birth year |
| `DELETE /me` | Bearer | Delete the account and all data |
| `GET /me/sessions` | Bearer | List signed-in devices |
| `DELETE /me/sessions/{id}` | Bearer | Sign out one device |
| `DELETE /me/sessions` | Bearer | Sign out all other devices |
| `GET /apps/{appId}/config` | no | Minimum version, flags, announcement, limits |
| `GET /apps/{appId}/entitlement` | Bearer | The plan the user has now |
| `GET /apps/{appId}/backups` | Bearer | List cloud backups |
| `POST /apps/{appId}/backups` | Bearer | Upload a backup |
| `GET /apps/{appId}/backups/{id}` | Bearer | Download a backup |
| `DELETE /apps/{appId}/backups/{id}` | Bearer | Delete a backup |
| `GET /apps/{appId}/plans` | no | Plans and prices for sale |
| `POST /apps/{appId}/discounts/check` | Bearer | Price with a discount code |
| `POST /apps/{appId}/purchases` | Bearer | Start a purchase |
| `GET /apps/{appId}/purchases` | Bearer | Purchase history |
| `GET /apps/{appId}/purchases/{id}` | Bearer | Status of one purchase |
| `GET /api/pay/zibal/callback` | no | Zibal returns the browser here (**not called by the app**; note: no `/v1`) |

---

## 1. Sign in (SMS code)

An app signs in once per device. A session belongs to **one app**, so each app signs in on its own.

### `POST /auth/otp/request`

```json
{ "phone": "09121234567", "app_id": "kitty-journal" }
```

Answer `202`:

```json
{ "challenge_id": "Xk29…", "expires_in": 120, "resend_after": 60 }
```

- Phone numbers: Iranian mobiles (`09…`, `+989…`; Persian digits are fine). Other countries are refused (`400 unsupported_country`) until you enable their prefix (`ALLOWED_PHONE_PREFIXES`).
- The answer is the same for new and known numbers, so nobody can find out who has an account.
- Wait `resend_after` seconds before asking again (`429 rate_limited`, with a `Retry-After` header in seconds).
- `503 sms_unavailable`: the daily SMS budget is used up. `502 sms_failed`: the SMS provider failed; try again.

### `POST /auth/otp/verify`

```json
{ "challenge_id": "Xk29…", "code": "123456", "device": "Pixel 8" }
```

`device` is an optional label (1 to 60 characters) shown in the device list. Answer `200`:

```json
{
  "access_token": "kja_…",
  "access_expires_at": "2026-11-07T10:15:00.000Z",
  "refresh_token": "kjr_…",
  "refresh_expires_at": "2027-01-06T10:00:00.000Z",
  "token_type": "Bearer",
  "session_id": "…",
  "user_id": "…"
}
```

- A code lasts 2 minutes, allows 5 attempts and works once. Only the newest code works.
- `401 invalid_code`: wrong or expired. `429 locked`: too many wrong codes; try later. `403 account_disabled`: an admin disabled the account.
- A new phone number creates the account automatically.

## 2. Tokens

### `POST /auth/refresh`

```json
{ "refresh_token": "kjr_…" }
```

Answer `200`: the same shape as verify, without `user_id`.

- Access tokens last **15 minutes**. Refresh tokens **rotate**: always store the new pair and discard the old one (use `expo-secure-store`).
- On `401 token_expired`: refresh once and retry the call.
- On `401 invalid_refresh` or `401 token_reuse`: the user must sign in again.
- If a refresh answer is lost, retrying with the same token within 30 seconds is safe. Later, an already-used token ends the session on purpose (it may have been stolen).
- Sessions end after 60 days without a refresh, or 180 days in total.

### `POST /auth/logout` (Bearer)

Ends this device's session. `204`.

## 3. Account and devices

### `GET /me` (Bearer)

```json
{
  "user_id": "…",
  "app_id": "kitty-journal",
  "phone": "+98912•••4567",
  "plan": "premium",
  "premium": true,
  "premium_expires_at": "2026-12-07T10:00:00.000Z",
  "profile": { "name": "Sara", "gender": "female", "birth_year": 1998, "age": 28 }
}
```

`phone` is masked. `premium_expires_at` is `null` for the free plan and for a lifetime plan.

### `PATCH /me` (Bearer)

```json
{ "name": "Sara", "gender": "female", "birth_year": 1998 }
```

Answer `200`: `{ "name", "gender", "birth_year", "age" }`.

- All fields are optional. Send only what changes. `null` (or `""` for the name) clears a field.
- `name`: 1 to 60 characters, no control characters. `gender`: `female`, `male`, `other` or `prefer_not_to_say`. `birth_year`: a year within the last 120 years.
- We store the birth year, not the age, and return `age` worked out from it. The profile is stored encrypted; the admin panel cannot show it.

### `DELETE /me` (Bearer)

Header `X-Confirm-Delete: yes` is required (`400 confirmation_required` without it). The sign-in must be fresh (from the last 10 minutes), otherwise `403 reauth_required`: ask the user to sign in again, then retry. Answer `204`.

Deletes the profile, devices, plans and backups immediately. Payment records stay for accounting but are no longer linked to the person.

### `GET /me/sessions` (Bearer)

```json
{ "sessions": [ { "id": "…", "app_id": "kitty-journal", "device": "Pixel 8", "created_at": "…", "last_used_at": "…", "current": true } ] }
```

### `DELETE /me/sessions/{id}` (Bearer)

Signs out one device. `204`; `404 unknown_session` if it is not yours.

### `DELETE /me/sessions` (Bearer)

Signs out every device except this one. `200 { "revoked": 2 }`.

## 4. App settings and current plan

### `GET /apps/{appId}/config` (no sign-in)

```json
{
  "app_id": "kitty-journal",
  "min_version": "1.0.0",
  "flags": { "new_editor": true },
  "announcement": { "id": "ann-1", "text": { "en": "…", "tr": "…", "fa": "…" } },
  "plans": { "free": { "backups": 3 }, "premium": { "backups": 20 } },
  "backup": { "max_bytes": 2097152 }
}
```

- `min_version`: if the app is older, ask the user to update.
- `flags`: on/off switches you control from the admin panel.
- `announcement`: `null` when there is none. Show it once; remember the `id` after the user closes it. Only languages the admin filled in are present (English always).
- `plans`: how many cloud backups each plan may keep. `backup.max_bytes`: the largest backup.
- Cached for 5 minutes. Limit 100 per minute per address.

### `GET /apps/{appId}/entitlement` (Bearer)

```json
{ "plan": "premium", "premium": true, "source": "zibal", "expires_at": "2026-12-07T10:00:00.000Z" }
```

- `plan`: `free` or a paid plan name (for example `premium`). `premium` is `true` for any paid plan.
- `source`: `null` (free), `admin` (given in the admin panel), `zibal` (bought), `apple` or `google` (reserved for store purchases).
- `expires_at`: `null` for free and for lifetime plans.
- Use it to turn Premium on or off in the app. Cache it and refresh when the app opens and after a purchase.

## 5. Cloud backups (text only)

Upload the same JSON the app already exports (format `kitty-journal-json`). Photos are not accepted: `includesAttachmentFiles` must be `false` and `data:` images are refused. Backups are compressed and encrypted on the server; the admin panel sees only sizes and dates.

Each upload is a **new full copy** (a snapshot). The number kept depends on the plan (`/config` → `plans`).

### `GET /apps/{appId}/backups` (Bearer)

```json
{ "backups": [ { "id": "…", "label": "My phone", "size_bytes": 5120, "created_at": "…" } ], "plan": "free", "limit": 3 }
```

### `POST /apps/{appId}/backups` (Bearer)

`label` is optional (1 to 80 characters).

```json
{
  "label": "My phone",
  "backup": { "format": "kitty-journal-json", "formatVersion": 1, "schemaVersion": 9, "includesAttachmentFiles": false, "data": { "entries": [] } }
}
```

Answer `201`: `{ "id", "label", "size_bytes", "created_at", "plan", "limit" }`.

### `GET /apps/{appId}/backups/{id}` (Bearer)

Returns the backup JSON exactly as it was uploaded.

### `DELETE /apps/{appId}/backups/{id}` (Bearer)

`204`; `404 unknown_backup`.

Errors:

| Status | `code` | Meaning |
| --- | --- | --- |
| 409 | `backup_limit` | The plan's limit is reached. Delete an old backup first (or buy a plan). |
| 413 | `backup_too_large` | Larger than `backup.max_bytes`. |
| 400 | `binary_not_allowed` | Photos or attachments are included. |
| 400 | `invalid_backup` | Not an object, missing `data`, too complex, or the `format` is not the one in the app settings. |

## 6. Buying a plan (Zibal)

Admins set the plans, prices and discount codes in the admin panel (**Sales**). The app downloads them, so it never has prices of its own. The app never sends a price either: it sends a plan id and an optional discount code, and the server works out the price.

### `GET /apps/{appId}/plans` (no sign-in)

```json
{
  "currency": "toman",
  "plans": [
    { "id": "Zk3p9QwX1aB2", "plan": "premium", "title": { "en": "Premium, 1 month", "tr": "Premium, 1 ay", "fa": "پریمیوم یک‌ماهه" }, "price": 50000, "currency": "toman", "duration_days": 30 },
    { "id": "Hs8dLm2VnC4e", "plan": "premium", "title": { "en": "Lifetime", "tr": "Lifetime", "fa": "Lifetime" }, "price": 900000, "currency": "toman", "duration_days": null }
  ]
}
```

- `id`: send it as `product_id` when buying. `plan`: the plan the user gets. `title`: pick the user's language (`tr` and `fa` fall back to English). `duration_days`: `null` = lifetime.
- Only plans the admin switched on, in the admin's order. An empty list means nothing is for sale right now.
- Cached for 1 minute. Limit 100 per minute per address.

### `POST /apps/{appId}/discounts/check` (Bearer)

```json
{ "product_id": "Zk3p9QwX1aB2", "code": "welcome20" }
```

Answer `200`: `{ "price": 50000, "discount": 10000, "amount": 40000, "currency": "toman" }`. `amount` is what the user will pay.

- Codes ignore case and surrounding spaces. Percent codes round the discount down. Fixed codes never take off more than the price.
- A result between 1 and 999 Toman becomes 1,000 (the gateway minimum). A result of exactly 0 makes the plan free.
- `400 invalid_code` with a readable `message`: *This code cannot be used* (unknown or switched off), *This code has expired*, *This code does not work for this plan*, *This code has been used up*, *You have already used this code*.
- `404 unknown_product`. Limit: 30 code tries per hour per user.

### `POST /apps/{appId}/purchases` (Bearer)

```json
{ "product_id": "Zk3p9QwX1aB2", "code": "WELCOME20" }
```

`code` is optional. Answer `201`, one of two shapes.

The user must pay: open `pay_url` in the **system browser**.

```json
{ "payment_id": "Tq7vN2mXk9Rb", "status": "pending", "amount": 40000, "pay_url": "https://gateway.zibal.ir/start/4012345678" }
```

A code made it free: the plan is already active.

```json
{ "payment_id": "Tq7vN2mXk9Rb", "status": "paid", "amount": 0, "expires_at": "2026-12-07T10:00:00.000Z" }
```

| Status | `code` | Meaning |
| --- | --- | --- |
| 404 | `unknown_product` | The plan does not exist or is switched off. Reload `/plans`. |
| 400 | `invalid_code` | The discount code cannot be used (same messages as above). |
| 502 | `gateway_unavailable` | Zibal could not be reached. Try again in a moment. |
| 502 | `gateway_refused` | Zibal refused the request. The message says why when Zibal gave a known reason. |
| 502 | `gateway_error` | Zibal sent an unreadable answer. |
| 503 | `payments_unavailable` | The server has no Zibal merchant id yet. |

Limit: 20 purchases per hour per user.

### `GET /apps/{appId}/purchases/{id}` (Bearer)

```json
{ "payment_id": "Tq7vN2mXk9Rb", "status": "paid", "plan": "premium", "amount": 40000, "expires_at": "2026-12-07T10:00:00.000Z" }
```

| `status` | Meaning | What the app does |
| --- | --- | --- |
| `pending` | Started, not confirmed yet | The user may still be paying, or closed the browser. Ask again every 2 to 3 seconds for about 30 seconds, then offer "Check again". |
| `paid` | Paid, plan is active | Call `/entitlement` and unlock Premium. |
| `failed` | Not paid or cancelled | Tell the user they were not charged. Offer to try again. (If Zibal later reports it paid, it is still activated.) |
| `review` | Zibal took the money but the plan could not be given | Tell the user it is being checked and to contact support with the `payment_id`. |

Another user's payment gives `404 unknown_payment`.

### `GET /apps/{appId}/purchases` (Bearer)

```json
{ "purchases": [ { "payment_id": "…", "status": "paid", "plan": "premium", "amount": 40000, "created_at": "…", "paid_at": "…" } ] }
```

Newest first, up to 50. `paid_at` is `null` unless paid.

## 7. The payment result page

Not an API for the app: it is the page Zibal sends the user's browser to after paying, `GET https://your-domain/api/pay/zibal/callback?trackId=…` (no `/v1`).

The server asks Zibal directly whether the payment was made, compares the amount, starts the plan **once**, and shows a small page in English, Turkish and Persian with a **Return to the app** button (it also tries to open the app after 3 seconds). The button opens:

```
kittyjournal://payment?status=<status>&payment_id=<id>
```

`status` is `paid`, `failed`, `review`, `pending` (Zibal could not be reached while verifying; opening the page again completes it) or `unknown`. **Do not trust it**: it only tells the app what to check. Always call `GET /purchases/{id}` and `/entitlement` for the real answer. The link can be changed with the `PAYMENT_APP_LINK` setting; in Expo add `"scheme": "kittyjournal"` to `app.json`.

Buying the same plan again starts after the time the user already has, so nothing is lost. More detail, the flow diagram and an Expo example are in [PAYMENT_API.md](PAYMENT_API.md); server setup and the admin pages are in [PAYMENTS.md](PAYMENTS.md).

---

## Error codes

Every error has the shape shown in [Basics](#basics). Statuses and codes the app can see:

| Status | `code` | When |
| --- | --- | --- |
| 400 | `invalid_request` | A field is missing, wrong, or not allowed |
| 400 | `invalid_json` | The body is not valid JSON |
| 400 | `invalid_phone` | Not a valid mobile number |
| 400 | `unsupported_country` | The phone's country prefix is not enabled |
| 400 | `confirmation_required` | `DELETE /me` without `X-Confirm-Delete: yes` |
| 400 | `invalid_backup`, `binary_not_allowed` | See [backups](#5-cloud-backups-text-only) |
| 400 | `invalid_code` | Purchases and discounts: the discount code cannot be used |
| 401 | `invalid_code` | Sign-in: the SMS code is wrong or expired |
| 401 | `missing_token`, `invalid_token` | No token, or a token that is not valid (sign in again) |
| 401 | `token_expired` | The 15-minute access token ended: refresh it and retry |
| 401 | `invalid_refresh`, `token_reuse` | Sign in again |
| 403 | `wrong_app` | The token belongs to another app |
| 403 | `account_disabled` | An admin disabled the account |
| 403 | `reauth_required` | Sign in again before deleting the account |
| 404 | `unknown_app`, `unknown_backup`, `unknown_session`, `unknown_product`, `unknown_payment` | The thing does not exist (or is not yours) |
| 409 | `backup_limit` | The plan's backup limit is reached |
| 413 | `too_large`, `backup_too_large` | The body or the backup is too big |
| 415 | `unsupported_media_type` | Send `Content-Type: application/json` |
| 429 | `rate_limited`, `locked` | Too many requests; wait `Retry-After` seconds |
| 502 | `sms_failed`, `gateway_unavailable`, `gateway_refused`, `gateway_error` | A provider (SMS or Zibal) failed; try again |
| 503 | `sms_unavailable`, `payments_unavailable` | The daily SMS budget is used up, or payments are not set up |
| 500 | `server_error` | Something broke on the server; quote `X-Request-Id` |

## Limits

Per address means per IP address; per account means per signed-in user.

| What | Limit |
| --- | --- |
| SMS codes per phone | 5 / hour, 10 / day (and 1 per 60 s) |
| SMS codes per address | 10 / hour, 30 / day |
| SMS codes, whole server | `SMS_DAILY_CAP` per day (default 2000) |
| Code attempts | 5 per code, 30 / hour per address |
| App config and plans (no sign-in) | 100 / minute per address |
| Authenticated calls | 300 / minute per account |
| Backup uploads | 20 / hour per account |
| Purchases started | 20 / hour per account |
| Discount code tries | 30 / hour per account |
| Payment result page | 60 / minute per address |
| JSON body | 16 KB (backups: the app's `max_bytes`) |

## Typical app flow

1. **First launch:** `GET /config`. If the app is older than `min_version`, ask for an update. Show the announcement if its `id` is new.
2. **Sign in:** `POST /auth/otp/request`, then `/auth/otp/verify`. Store both tokens in secure storage.
3. **Every start:** if the access token is near its end (or a call gives `token_expired`), `POST /auth/refresh`. Then `GET /entitlement` and set Premium on or off.
4. **Backups:** `GET /backups` to show the list and the limit; `POST /backups` to upload; `GET /backups/{id}` to restore.
5. **Paywall:** `GET /plans`, optionally `/discounts/check`, then `POST /purchases` and open `pay_url` in the browser. When the app comes back, `GET /purchases/{id}` and `GET /entitlement`.
6. **Settings:** `PATCH /me` for the profile, `GET /me/sessions` to manage devices, `DELETE /me` to delete the account.

## Adding another app

Insert it with `ensureApp({ id, name, config })` (see `DEFAULT_APPS` in `src/server/apps.js`) or add it there and run `npm run db:migrate`. Each app has its own plans, backup format and limits; edit them later in the admin panel under **Apps**, and set what is for sale under **Sales**.
