# Accounts and cloud backup

Set `API_BASE_URL` in `src/account/config.js` when the server is live. Until then debug builds use a
mock server (code `123456`); release builds hide sign-in.

All bodies are JSON. Errors: HTTP status, optional body `{ "error": "<code>", "message": "..." }`.
Codes the app understands: `invalid_code`, `rate_limited` (429), `unauthorized` (401), `payment_required` (402/403), `not_found` (404).

| Call | Request | Response |
|---|---|---|
| `POST /auth/request-code` | `{ phone, mode: "login"\|"register", profile? }` (phone is E.164, `profile` = `{name, age, gender}` on register) | `{ sent: true }` — sends an SMS code. 404 on login if no such account. |
| `POST /auth/verify` | `{ phone, code, mode, profile? }` | `{ token, user:{id,phone,name,age,gender}, plan:"free"\|"premium" }` |
| `GET /me` (Bearer) | | `{ user, plan }` — called at app start; 401 signs the user out |
| `POST /auth/logout` (Bearer) | | `{ ok: true }` |
| `PUT /backup` (Bearer) | snapshot (below) | `{ updatedAt, count }` — **must return 402/403 unless the account is paid** |
| `GET /backup` (Bearer) | | the last snapshot, or 404; also paid-only |

`gender` is one of `female`, `male`, `other`, `unspecified`. Age is an integer 13–120.

Snapshot: `{ version: 1, createdAt, entries: [{ uuid, title, body, bodyHtml, formatVersion, date, mood, favorite, pinned, createdAt, updatedAt, tags: [] }] }`
Text only: no photos, places or files. Restore adds missing entries and updates ones whose `updatedAt` is newer; it never deletes.

Server must: verify the SMS code (short expiry, rate limit per phone and IP), store the snapshot encrypted at rest,
and enforce the paid check itself (the app's check is only for display).
