# Vine Messaging API

Vine exposes a LINE-like Messaging API for Vine Official Accounts under:

```text
/api/oa/v2
```

Vine is not the official LINE platform. Do not use LINE Developers channel IDs,
LINE channel access tokens, or `https://api.line.me` for normal Vine behavior.

## Supported Send APIs

| Method | Endpoint | Retry key |
| --- | --- | --- |
| Reply | `POST /api/oa/v2/bot/message/reply` | No |
| Push | `POST /api/oa/v2/bot/message/push` | Yes |
| Multicast | `POST /api/oa/v2/bot/message/multicast` | Yes |
| Broadcast | `POST /api/oa/v2/bot/message/broadcast` | Yes |

`X-Line-Retry-Key` follows LINE-like semantics for supported send APIs:

- use a UUID retry key on the first request;
- retry the same request body with the same key within 24 hours;
- accepted duplicate retries return `409` with `x-line-accepted-request-id`;
- reply requests reject retry keys.

Multicast accepts up to 500 user IDs in the `to` array. Users who are not
current friends of the Official Account are excluded from delivery. If no users
are eligible, Vine accepts and completes the request without creating delivery
rows.

## Example: Push Message

```sh
curl -X POST http://localhost:3001/api/oa/v2/bot/message/push \
  -H 'Content-Type: application/json' \
  -H 'Authorization: Bearer {vine_oa_access_token}' \
  -H 'X-Line-Retry-Key: 123e4567-e89b-12d3-a456-426614174000' \
  -d '{
    "to": "{vine_user_id}",
    "messages": [
      { "type": "text", "text": "Hello from Vine" }
    ]
  }'
```

## Example: Multicast Message

```sh
curl -X POST http://localhost:3001/api/oa/v2/bot/message/multicast \
  -H 'Content-Type: application/json' \
  -H 'Authorization: Bearer {vine_oa_access_token}' \
  -H 'X-Line-Retry-Key: 123e4567-e89b-12d3-a456-426614174000' \
  -d '{
    "to": ["{vine_user_id_1}", "{vine_user_id_2}"],
    "messages": [
      { "type": "text", "text": "Hello from Vine" }
    ]
  }'
```

## Message Types

The current Vine baseline accepts text, sticker, image, audio, video, location,
template, imagemap, flex, and quick reply metadata. Rendering parity varies by
client surface and should be checked in a real Vine chat.

## Quota Semantics

Vine counts sent message usage by recipient, not by the number of message
objects in a request. A push request containing five message objects to one
user counts as one usage unit.

## Mini App Service Messages

```text
POST /api/oa/v2/mini-app/notifier/send
```

Headers:

```text
Authorization: Bearer {loginChannelAccessToken}
```

Body:

```json
{
  "liffAccessToken": "...",
  "templateName": "reservation_confirmation_en",
  "params": { "name": "Noah", "button_uri_1": "https://..." }
}
```

Responses:

| Status | Body | Reason |
| --- | --- | --- |
| `200` | `{ "status": "sent", "messageId": "..." }` | Success |
| `401` | `{ "error": "Invalid or missing Login Channel access token" }` | Invalid or missing Login Channel access token |
| `401` | `{ "error": "..." }` | Invalid LIFF access token |
| `403` | `{ "error": "..." }` | Mini App not published, template not in this Mini App, or token-channel mismatch |
| `404` | `{ "error": "..." }` | Mini App or template not found |
| `422` | `{ "error": "..." }` | Parameter validation or Flex Message validation failure |
| `429` | `{ "error": "...", "retryAfterSec": 86400 }` | Rate limit exceeded: 5 messages per 24 hours per (miniAppId, userId) |

### Differences from official LINE

- No service-notification-token chain. Each send is one-shot. Rate-limited to
  5 messages per 24 hours per (miniAppId, userId) instead of LINE's stateful
  `remainingCount` / 1-year session model.
- No region-specific notice chats. All Service Messages from all Mini Apps in
  the Vine instance land in a single per-user "Mini App 通知" chat.
- No verified-vs-unverified split. Any published Mini App may send Service
  Messages.

## Differences From Official LINE Cloud

- Vine uses `/api/oa/v2`, not `https://api.line.me/v2`.
- Vine access tokens are issued by the Vine developer console.
- Vine does not require LINE Developers Console channels.
- Vine does not implement narrowcast in this phase.
- Vine webhook and message delivery are backed by Vine-owned PostgreSQL state.
