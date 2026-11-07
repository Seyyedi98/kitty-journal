# Accounts and cloud backup: how the app uses your server

Config: `src/account/config.js` → `API_BASE_URL = 'https://panjeh.ir/api/v1'`, `APP_ID = 'kitty-journal'`.
Empty URL in a debug build = built-in mock server (code 123456). Plain http is refused outside debug builds.

| App action | Route |
|---|---|
| Send code | `POST /auth/otp/request` `{phone, app_id}` → `{challenge_id, expires_in, resend_after}` |
| Verify | `POST /auth/otp/verify` `{challenge_id, code, device}` → `{access_token, refresh_token, session_id, user_id}` |
| Expired token (401) | `POST /auth/refresh` `{refresh_token}` → new pair (old refresh token is dead; the app keeps the new one) |
| Log out | `POST /auth/logout` |
| Premium status | `GET /apps/kitty-journal/entitlement` → `premium` (at start, after login, on return to the app at most every 10 min) |
| Backups | `GET/POST /apps/kitty-journal/backups`, `GET/DELETE /apps/kitty-journal/backups/{id}` |

One flow for everyone: phone → code → (first time only) name, age, gender. "First time" = GET /me returns no complete `profile`.
The app sends `PATCH /me {name, gender, birth_year}` (birth_year = this year − age) and reads `profile {name, gender, age}` back.
Gender values: female, male, other, prefer_not_to_say. If the save fails (offline), the app keeps the profile and retries at the next start or return to the app.
Backup body: `{ label, backup: { format: "kitty-journal-json", formatVersion: 1, includesAttachmentFiles: false, data: { version: 1, createdAt, entries: [...] } } }` (text only, no images; the server rejects anything else).
Restore adds missing entries and updates older ones; it never deletes.
