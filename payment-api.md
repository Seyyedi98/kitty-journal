# Payment API

How the mobile app lists plans, checks a discount code, pays with Zibal and reads the result.

- Base URL: your server, for example `https://api.example.com`. All paths below start with `/api/v1`.
- Format: JSON in, JSON out (`Content-Type: application/json`).
- Money: **whole Toman** (integers). The server converts to Rial for Zibal.
- Sign-in: endpoints marked **Bearer** need the access token from the OTP login: `Authorization: Bearer <access_token>`. The token belongs to one app, and using it with another app id returns `403 wrong_app`.
- The app never sends a price. It sends a plan id (`product_id`) and an optional discount code; the server calculates the price.

| Endpoint | Sign-in | Purpose |
| --- | --- | --- |
| `GET /apps/{appId}/plans` | no | Plans and prices to show on the paywall |
| `POST /apps/{appId}/discounts/check` | Bearer | Price with a discount code, before paying |
| `POST /apps/{appId}/purchases` | Bearer | Start a purchase, get the payment page address |
| `GET /apps/{appId}/purchases/{paymentId}` | Bearer | Status of one purchase |
| `GET /apps/{appId}/purchases` | Bearer | The user's purchase history |
| `GET /apps/{appId}/entitlement` | Bearer | The plan the user has now (see API.md) |
| `GET {server}/api/pay/zibal/callback` | no | Zibal sends the browser here. **Not called by the app** |

---

## 1. List plans

`GET /api/v1/apps/{appId}/plans`

No sign-in. The answer may be cached for 60 seconds. Only plans the admin switched on are returned, in the admin's order.

```json
{
  "currency": "toman",
  "plans": [
    {
      "id": "Zk3p9QwX1aB2",
      "plan": "premium",
      "title": { "en": "Premium, 1 month", "tr": "Premium, 1 ay", "fa": "پریمیوم یک‌ماهه" },
      "price": 50000,
      "currency": "toman",
      "duration_days": 30
    },
    {
      "id": "Hs8dLm2VnC4e",
      "plan": "premium",
      "title": { "en": "Lifetime", "tr": "Lifetime", "fa": "Lifetime" },
      "price": 900000,
      "currency": "toman",
      "duration_days": null
    }
  ]
}
```

| Field | Meaning |
| --- | --- |
| `id` | Send this as `product_id` when buying. |
| `plan` | The plan the user gets (`premium`, ...). It is also what `/entitlement` returns afterwards. |
| `title` | Show the one for the user's language. `tr` and `fa` fall back to the English text. |
| `price` | Toman. Show it with thousands separators. |
| `duration_days` | Length of the plan in days. `null` means lifetime. |

The list is empty when the admin has not added any plan. Show "plans are not available right now".

---

## 2. Check a discount code

`POST /api/v1/apps/{appId}/discounts/check` (Bearer)

```json
{ "product_id": "Zk3p9QwX1aB2", "code": "welcome20" }
```

Codes are not case sensitive and spaces around them are ignored.

Answer `200`:

```json
{ "price": 50000, "discount": 10000, "amount": 40000, "currency": "toman" }
```

`amount` is what the user will pay. Rules the server applies:

- Percent codes round the discount down. Fixed codes never take off more than the price.
- If the result would be between 1 and 999 Toman, the user pays 1,000 Toman (the gateway minimum). If the code makes it exactly 0, the plan is free and no payment page is needed.

If the code cannot be used the answer is `400` with `error.code = "invalid_code"` and a readable `error.message`:

| Message | Meaning |
| --- | --- |
| This code cannot be used | Unknown, or switched off by the admin |
| This code has expired | Past its last day |
| This code does not work for this plan | The admin limited it to other plans |
| This code has been used up | Total uses reached |
| You have already used this code | Uses per person reached |

Show `error.message` to the user. Limit: 30 code tries per hour per user (`429 rate_limited`).

---

## 3. Start a purchase

`POST /api/v1/apps/{appId}/purchases` (Bearer)

```json
{ "product_id": "Zk3p9QwX1aB2", "code": "WELCOME20" }
```

`code` is optional. Any other field (for example `amount`) is rejected with `400 invalid_request`.

Answer `201`, one of two shapes.

**Normal: the user must pay.**

```json
{
  "payment_id": "Tq7vN2mXk9Rb",
  "status": "pending",
  "amount": 40000,
  "pay_url": "https://gateway.zibal.ir/start/4012345678"
}
```

Open `pay_url` in the **system browser** (not inside the app), see section 7.

**Free: a code made the price 0.** The plan is already active, nothing to open.

```json
{ "payment_id": "Tq7vN2mXk9Rb", "status": "paid", "amount": 0, "expires_at": "2026-12-07T10:00:00.000Z" }
```

`expires_at` is `null` for a lifetime plan.

Limits: 20 purchases per hour per user.

Errors:

| Status | `error.code` | Meaning |
| --- | --- | --- |
| 404 | `unknown_product` | The plan does not exist or is switched off. Reload the plan list. |
| 400 | `invalid_code` | The discount code cannot be used (same messages as section 2). |
| 502 | `gateway_unavailable` | Zibal could not be reached. Try again in a moment. |
| 502 | `gateway_refused` | Zibal refused the request. The message says why when Zibal gave a known code. |
| 503 | `payments_unavailable` | The server has no Zibal merchant id yet. |
| 429 | `rate_limited` | Too many tries. Wait for the `Retry-After` header (seconds). |

---

## 4. Purchase status

`GET /api/v1/apps/{appId}/purchases/{paymentId}` (Bearer)

```json
{ "payment_id": "Tq7vN2mXk9Rb", "status": "paid", "plan": "premium", "amount": 40000, "expires_at": "2026-12-07T10:00:00.000Z" }
```

| `status` | Meaning | What the app does |
| --- | --- | --- |
| `pending` | Started, not confirmed yet | The user may still be paying or closed the browser. Ask again a few times (every 2 to 3 seconds for about 30 seconds), then stop and offer "Check again". |
| `paid` | Paid, plan is active | Call `/entitlement`, unlock premium. |
| `failed` | Not paid, or cancelled | Tell the user they were not charged and offer to try again. A payment that Zibal later reports as paid is still activated. |
| `review` | Zibal took money but the plan could not be given | Tell the user it is being checked and to contact support with the `payment_id`. The admin sees this in the panel. |

A payment of another user returns `404 unknown_payment`.

---

## 5. Purchase history

`GET /api/v1/apps/{appId}/purchases` (Bearer)

```json
{
  "purchases": [
    { "payment_id": "Tq7vN2mXk9Rb", "status": "paid", "plan": "premium", "amount": 40000, "created_at": "2026-11-07T10:00:00.000Z", "paid_at": "2026-11-07T10:02:11.000Z" }
  ]
}
```

Newest first, at most 50. `paid_at` is `null` unless paid.

---

## 6. Current plan

`GET /api/v1/apps/{appId}/entitlement` (Bearer), described in [API.md](API.md):

```json
{ "plan": "premium", "premium": true, "source": "zibal", "expires_at": "2026-12-07T10:00:00.000Z" }
```

`source` is `zibal` for a purchase, `admin` for a plan the admin gave. Buying the same plan again starts after the time the user already has, so nothing is lost.

---

## 7. The whole flow

```
App                         Server                       Zibal
 | GET /plans  --------------> |
 | <-- plans                   |
 | POST /discounts/check ----> |   (optional)
 | POST /purchases ----------> | -- request ------------> |
 | <-- pay_url                 | <-- trackId ------------ |
 | open pay_url in browser ----------------------------> | user pays
 |                             | <-- browser redirected to /api/pay/zibal/callback
 |                             | -- verify -------------> |
 |                             | <-- paid, amount ------- |  plan is activated once
 | <-- browser shows result page, "Return to the app" -> opens kittyjournal://payment?status=paid&payment_id=...
 | GET /purchases/{id} ------> |
 | GET /entitlement ---------> |
```

- The result page is shown in English, Turkish and Persian, and tries to open the app after 3 seconds. It has a **Return to the app** button.
- The link is `PAYMENT_APP_LINK` (default `kittyjournal://payment`) plus `?status=<status>&payment_id=<id>`. `status` is one of `paid`, `failed`, `review`, `pending` or `unknown`. **Do not trust it:** it only tells the app what to check. Always call `GET /purchases/{id}` and `/entitlement` for the real answer.
- The server never trusts the address Zibal calls back with: it asks Zibal directly whether the payment was made and compares the amount.
- If the user closes the browser and returns to the app by hand, call `GET /purchases/{id}` with the saved `payment_id`.
- If the server could not reach Zibal while verifying, the result page says "could not confirm yet" and the payment stays `pending`. Opening the result page again, or the app asking again, completes it.

### Example (React Native / Expo)

```js
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';

const API = 'https://api.example.com/api/v1/apps/kitty-journal';
const auth = (token) => ({ authorization: `Bearer ${token}`, 'content-type': 'application/json' });

export async function buy(token, productId, code) {
  const res = await fetch(`${API}/purchases`, { method: 'POST', headers: auth(token), body: JSON.stringify({ product_id: productId, ...(code ? { code } : {}) }) });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error.message); // show this text to the user
  if (data.status === 'paid') return data;           // free with a code
  await WebBrowser.openBrowserAsync(data.pay_url);   // or Linking.openURL(data.pay_url)
  return data;                                       // keep payment_id and check it when the app comes back
}

export async function waitForResult(token, paymentId, tries = 12) {
  for (let i = 0; i < tries; i++) {
    const r = await (await fetch(`${API}/purchases/${paymentId}`, { headers: auth(token) })).json();
    if (r.status !== 'pending') return r;
    await new Promise((ok) => setTimeout(ok, 2500));
  }
  return { status: 'pending' };
}
```

Add `"scheme": "kittyjournal"` to `app.json` so the return link opens the app. When it opens, read `payment_id` from the link (`Linking.useURL()`), call `waitForResult`, then `/entitlement`.

---

## 8. Errors

Every error has the same shape and an `X-Request-Id` header (quote it when asking for support):

```json
{ "error": { "code": "invalid_code", "message": "This code has expired" } }
```

Common to all endpoints:

| Status | `error.code` | Meaning |
| --- | --- | --- |
| 400 | `invalid_request` | A field is missing, wrong, or not allowed |
| 401 | (various) | Not signed in, or the access token expired: refresh it and retry |
| 403 | `wrong_app` | The token belongs to another app |
| 403 | `account_disabled` | The account was disabled by an admin |
| 404 | `unknown_app` | No such app |
| 429 | `rate_limited` | Too many requests; wait `Retry-After` seconds |

## 9. curl

```bash
BASE=https://api.example.com/api/v1/apps/kitty-journal

curl "$BASE/plans"

curl -X POST "$BASE/discounts/check" -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"product_id":"Zk3p9QwX1aB2","code":"WELCOME20"}'

curl -X POST "$BASE/purchases" -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"product_id":"Zk3p9QwX1aB2","code":"WELCOME20"}'

curl "$BASE/purchases/Tq7vN2mXk9Rb" -H "Authorization: Bearer $TOKEN"
```

For testing without real money use Zibal's test merchant (`ZIBAL_MERCHANT=zibal`, the default outside production). Server setup and the admin pages are in [PAYMENTS.md](PAYMENTS.md).
