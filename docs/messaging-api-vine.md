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

## Differences From Official LINE Cloud

- Vine uses `/api/oa/v2`, not `https://api.line.me/v2`.
- Vine access tokens are issued by the Vine developer console.
- Vine does not require LINE Developers Console channels.
- Vine does not implement narrowcast in this phase.
- Vine webhook and message delivery are backed by Vine-owned PostgreSQL state.
