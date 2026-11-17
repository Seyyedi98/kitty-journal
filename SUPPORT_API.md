# Support (help) screen: API for the app

People write a **subject** and a **message** in the app; admins answer in the admin panel (Support). The answer appears in the same conversation in the app.

All calls need the signed-in user's `Authorization: Bearer <access token>` (the same token as every other call). `{appId}` is the app id, for example `kitty-journal`. Errors look like `{ "error": { "code", "message" } }`; show `message` when it is meant for people (see the codes below).

## Calls

### Start a conversation
`POST /api/v1/apps/{appId}/support/tickets`
```json
{ "subject": "Payment problem", "message": "I paid but Plus is not active. Tracking number: 123456" }
```
- `subject`: 3 to 100 characters. `message`: 3 to 2000 characters. Extra fields are refused (400).
- `201` → `{ "ticket": { "id", "subject", "status": "open", "created_at", "last_message_at", "unread": 0 } }`
- Limits: 5 new conversations a day (`429 rate_limited`), at most 10 open at once (`409 too_many_open`).

### List my conversations
`GET /api/v1/apps/{appId}/support/tickets` → `{ "tickets": [ { id, subject, status, created_at, last_message_at, unread } ] }`
Newest activity first, up to 50. `status`: `open` (waiting for us), `answered` (we replied), `closed`. `unread` = number of our answers the person has not opened yet.

### Open one conversation
`GET /api/v1/apps/{appId}/support/tickets/{id}` → `{ "ticket": {...}, "messages": [ { "id", "from": "user" | "admin", "body", "created_at" } ] }` oldest first.
Opening it marks our answers as read (`unread` becomes 0). Show `from: "admin"` messages as "Support".

### Write again
`POST /api/v1/apps/{appId}/support/tickets/{id}/messages` with `{ "message": "..." }` (1 to 2000 characters) → `201 { "ok": true }`.
Works on a closed conversation too (it reopens). Limits: 30 messages an hour; 200 messages in one conversation (`409 ticket_full`: ask the person to start a new one).

### Mark as solved
`POST /api/v1/apps/{appId}/support/tickets/{id}/close` (no body) → `{ "ok": true }`.

### Badge
`GET /api/v1/apps/{appId}/support/unread` → `{ "unread": 2 }`. Call it when the app opens (and when the Support row becomes visible) to show a dot on "Support".
There are no push notifications for answers yet; the badge is checked when the app is opened.

## Screens to build
1. **Support** (from Settings): the list (subject, status chip, date, a dot when `unread > 0`) and a "New message" button.
2. **New message**: a subject field (max 100) and a message field (max 2000, with a counter) and Send. After sending, open the conversation.
3. **Conversation**: bubbles (person on one side, Support on the other), a text box and Send, and a "Mark as solved" action. Show answers in the person's language order (text is plain, never HTML; keep new lines).

Suggested tip on the New message screen: if it is about a payment, include the tracking number shown after paying.

## Privacy
Messages are stored on the server so the admins can answer. They are deleted together with the account. Do not attach journal text automatically.
