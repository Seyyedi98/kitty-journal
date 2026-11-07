# Buying Plus: what the app expects from the server

The app never talks to Zibal and never holds the merchant key. The server creates the payment, verifies it, and
grants the plan. The app only shows what the server sends and opens the payment page.

Base: `/api/v1`, appId `kitty-journal`, `Authorization: Bearer <access token>` on all three routes.
Errors use the usual `{ "error": { "code", "message" } }`. Money is always a whole number (no decimals).

## 1. GET /apps/{appId}/plans[?code=XXXX]

Prices and discounts are decided here. Apply the user's own discounts (first purchase, win-back, ...) and, if `code`
is given, that discount code. Return plans in the order to show them.

```json
{
  "currency": "IRT",
  "plans": [
    { "id": "monthly",   "months": 1,  "price": 99000,  "final_price": 99000 },
    { "id": "quarterly", "months": 3,  "price": 249000, "final_price": 199000,
      "discount": { "percent": 20, "label": "Autumn sale", "ends_at": "2026-11-20T20:30:00Z" } },
    { "id": "yearly",    "months": 12, "price": 899000, "final_price": 699000,
      "discount": { "percent": 22 }, "badge": "best_value" }
  ],
  "code": { "value": "KITTY20", "valid": true, "message": null },
  "notice": null
}
```

- `currency`: `IRT` (Toman) or `IRR` (Rial). The app shows prices in this unit and never converts.
- `price` = regular price, `final_price` = what the user will be charged. If they are equal there is no discount.
  `final_price` must never be above `price`.
- `discount.percent`, `label`, `ends_at` are optional and only for display. `ends_at` lets the app say "ends in 3 days".
- `title` (optional string) replaces the automatic name ("3 months"). `days` can be used instead of `months`.
- `badge`: `"best_value"` is highlighted. Unknown badges are ignored.
- `code` appears only when `?code=` was sent. An unknown or expired code is **200** with `valid: false` and a short
  `message`; the plans are then returned without that code.
- `notice` (optional) is one line shown above the plans (for example "Prices change on 1 Dec").

## 2. POST /apps/{appId}/checkout

Body: `{ "plan_id": "quarterly", "code": "KITTY20" }` (`code` optional).

The server prices the order again by itself (never trust the app), creates an order, asks Zibal for a `trackId`
and answers **201**:

```json
{ "order_id": "ord_8f3a...", "payment_url": "https://gateway.zibal.ir/start/1234567890", "amount": 199000, "currency": "IRT" }
```

- `payment_url` must be `https`. The app opens it in the phone's browser.
- Zibal takes **Rial**: send `amount * 10` when the plan currency is Toman.
- Set Zibal's `callbackUrl` to a page on your own site, e.g. `https://<site>/pay/return`, and pass the app's
  `order_id` as Zibal's `orderId`.
- Errors: 400 `invalid_discount_code`, 404 `plan_not_found`, 429 rate limit, 502 if Zibal fails.
- Calling it again while an unpaid order exists is fine (create a new order or reuse the open one).

## 3. Return page and verification (server side only)

After paying, Zibal sends the user's browser to `callbackUrl` with `success`, `status`, `trackId`, `orderId`.
That page must call Zibal's verify (`POST https://gateway.zibal.ir/v1/verify` with the merchant key and `trackId`) and
compare the paid amount with the order. Only after a successful verify:

1. mark the order `paid` (idempotent: a refresh of the page or a second call must not extend the plan twice),
2. extend the user's plan: if they already have Plus, add the plan length to the current `expires_at`, otherwise
   start from now,
3. show a simple page: "Payment received, you can go back to the app" (and "Payment failed" otherwise).

The app does not need a deep link: when the user comes back it asks the server (route 4) and re-reads the entitlement.

## 4. GET /apps/{appId}/orders/{order_id}

```json
{ "order_id": "ord_8f3a...", "status": "paid" }
```

`status` is one of `pending`, `paid`, `failed`, `cancelled`, `expired`. Only the order's owner may read it (404 for
anyone else). The app calls this when it returns to the foreground; after `paid` it calls
`GET /apps/{appId}/entitlement` again, which must now say `premium: true` with the new `expires_at`.
Mark an order `expired` if it has stayed `pending` for about 1 hour.

## Notes

- Premium comes only from the server's entitlement. The app never turns Plus on because of a redirect or a status it
  guessed itself.
- Refunds or a chargeback: revoke from the admin panel as before; the phone picks it up on its next plan check.
- Test with Zibal's sandbox merchant (`zibal`) before using the real one.
