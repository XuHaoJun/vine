# OA Official Account Platform - Design Spec

## Overview

Build an OA (Official Account) bot platform within Vine that allows organizations to create official accounts, configure webhook endpoints, and interact with users via the Messaging API. Vine acts as the "LINE Platform" — external bots receive webhook events from Vine and respond by calling Vine's Messaging API endpoints.

**MVP Scope:**
- OA creation and management (self-service)
- Webhook URL configuration and verification
- Text message forwarding (user → bot webhook, bot → Vine Messaging API)
- Friend/unfollow event dispatch
- Basic reply token system
- Channel access tokens (short-lived + JWT v2.1 long-lived)
- OA discovery via OA ID search
- Unified chat list (OA chats mixed with DMs)

**Out of Scope (Future Phases):**
- Flex Message rendering
- Rich Menu management
- Push messages to audiences
- Message statistics/analytics
- Group/OA chat
- Media message forwarding (image, video, audio, sticker, location, file)
- Postback actions, quick replies, datetime pickers

---

## Architecture

### Three Subsystems

**1. OA Management Service**
- CRUD for Official Accounts
- Webhook URL management + verification
- Channel access token issuance
- OA profile settings (name, image, description, oaId alias)

**2. Webhook Dispatcher**
- Intercepts messages sent to OA chats
- Constructs LINE-compatible `CallbackRequest` payloads
- Signs with HMAC-SHA256 using OA's `channelSecret`
- POSTs to bot's registered webhook URL
- Manages reply tokens (single-use, 1-minute expiry)

**3. Messaging API Endpoints**
- Bot calls these to respond to users
- Reply messages (consume reply token)
- Push messages (send to any friend)
- Get user profile
- Get message content (for media)
- OAuth token issuance (short-lived + JWT v2.1)

### Data Flow

```
User sends message → Vine Chat → Webhook Dispatcher → POST bot's webhook URL
Bot processes event → POST /api/oa/v2/bot/message/reply → Vine delivers to user's chat
```

---

## Database Schema

### New Tables (private schema - not replicated to Zero)

#### `oaProvider`
| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | `uuid` | PK | Provider unique identifier |
| `name` | `text` | NOT NULL | Provider display name |
| `ownerId` | `uuid` | FK → `user.id`, NOT NULL | Creator/admin |
| `createdAt` | `timestamp` | NOT NULL, DEFAULT now() | |
| `updatedAt` | `timestamp` | NOT NULL, DEFAULT now() | |

**MVP Scope:** A provider has exactly one owner (the creator). No role management, no multi-admin support. The `ownerId` is the only person who can manage OAs under this provider.

#### `officialAccount`
| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | `uuid` | PK | OA unique identifier |
| `providerId` | `uuid` | FK → `oaProvider.id`, NOT NULL | Owning provider |
| `name` | `text` | NOT NULL | Display name |
| `oaId` | `text` | UNIQUE, NOT NULL | Searchable alias (e.g., `@mybot`) |
| `description` | `text` | | OA description |
| `imageUrl` | `text` | | Profile image URL |
| `channelSecret` | `text` | NOT NULL | HMAC-SHA256 signing key (auto-generated) |
| `status` | `text` | NOT NULL, DEFAULT 'active' | 'active' \| 'disabled' |
| `createdAt` | `timestamp` | NOT NULL, DEFAULT now() | |
| `updatedAt` | `timestamp` | NOT NULL, DEFAULT now() | |

#### `oaWebhook`
| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | `uuid` | PK | |
| `oaId` | `uuid` | FK → `officialAccount.id`, NOT NULL | |
| `url` | `text` | NOT NULL | Bot's webhook endpoint URL (HTTPS required) |
| `status` | `text` | NOT NULL, DEFAULT 'pending' | 'pending' \| 'verified' \| 'failed' |
| `lastVerifiedAt` | `timestamp` | | |
| `createdAt` | `timestamp` | NOT NULL, DEFAULT now() | |

#### `oaFriendship`
| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | `uuid` | PK | |
| `oaId` | `uuid` | FK → `officialAccount.id`, NOT NULL | |
| `userId` | `uuid` | FK → `user.id`, NOT NULL | |
| `status` | `text` | NOT NULL, DEFAULT 'friend' | 'friend' \| 'blocked' |
| `createdAt` | `timestamp` | NOT NULL, DEFAULT now() | When user added the OA |

#### `oaAccessToken`
| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | `uuid` | PK | Token unique identifier |
| `oaId` | `uuid` | FK → `officialAccount.id`, NOT NULL | Owning OA |
| `token` | `text` | NOT NULL | The actual access token value (hashed) |
| `type` | `text` | NOT NULL | 'short_lived' \| 'jwt_v21' |
| `keyId` | `text` | NULLABLE | For JWT v2.1: the key ID used to sign |
| `expiresAt` | `timestamp` | NULLABLE | Token expiration time (NULL for indefinite) |
| `createdAt` | `timestamp` | NOT NULL, DEFAULT now() | |

### Channel vs OA Relationship

In LINE's architecture, the hierarchy is: **Provider → Channel → OA**.

- **Provider**: Organizational container (company/organization). User IDs are scoped per-provider — the same LINE user gets a different userId in each provider.
- **Channel**: Developer-facing API access permission for a specific feature (Messaging API, LINE Login, MINI App, etc.). A provider can have multiple channels.
- **LINE Official Account**: User-facing entity that users chat with. Only Messaging API channels have an associated OA (1:1).

In Vine, we unify all three levels into a simplified model:

| LINE Concept | Vine Equivalent | Notes |
|---|---|---|
| **Provider** | `oaProvider` table | Organizational grouping, userId scoping |
| **Messaging API Channel** | Embedded in `officialAccount` | channelSecret, webhook URL, access tokens |
| **LINE Official Account** | `officialAccount` table | name, imageUrl, description, oaId |

The `officialAccount` table is Vine's equivalent of both the LINE Official Account Manager settings AND the LINE Developers Console channel settings, unified into one entity under a provider.

**Why Provider matters for MVP:** User IDs in webhook events are scoped per-provider, not per-OA. If a bot developer manages multiple OAs under the same provider, they receive the same userId for a given Vine user across all those OAs. This is critical for bots that track users across multiple OAs. Without Provider, adding it later would be a breaking change to all userId values in webhook payloads.

### Existing Table Updates

#### `chat` - No changes needed
- Already has `type: 'oa'` ✓

#### `chatMember` - Add `oaId` column
| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `oaId` | `uuid` | FK → `officialAccount.id`, NULLABLE | Set when `chat.type = 'oa'` |

#### `message` - Add `oaId` column
| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `oaId` | `uuid` | FK → `officialAccount.id`, NULLABLE | Set when sender is an OA |

---

## Webhook Event Dispatch

### CallbackRequest Format

Every webhook POST matches LINE's `CallbackRequest` structure:

```json
{
  "destination": "oa-uuid-here",
  "events": [
    {
      "type": "message",
      "mode": "active",
      "timestamp": 1775300725000,
      "source": { "type": "user", "userId": "provider-scoped-user-uuid" },
      "webhookEventId": "01FZ74A0TDDPYRVKNK77XKC3ZR",
      "deliveryContext": { "isRedelivery": false },
      "replyToken": "reply-token-uuid",
      "message": {
        "type": "text",
        "id": "msg-uuid",
        "text": "Hello bot"
      }
    }
  ]
}
```

**Note:** `source.userId` is scoped per-provider, not per-OA. The same Vine user will have the same userId across all OAs under the same provider, but a different userId for OAs under different providers. This matches LINE's behavior.

### Request Headers
| Header | Value |
|--------|-------|
| `Content-Type` | `application/json; charset=utf-8` |
| `x-line-signature` | HMAC-SHA256(body, channelSecret) base64-encoded |

### MVP Event Types

| Event | Trigger | Replyable |
|-------|---------|-----------|
| `message` (text) | User sends text to OA chat | Yes |
| `follow` | User adds OA as friend | Yes |
| `unfollow` | User blocks OA | No |

### Webhook Delivery Rules
- Synchronous POST to bot's registered URL
- Timeout: 10 seconds
- If delivery fails: log error, mark webhook status as `failed`
- Empty events array `[]` sent as connectivity test during webhook URL registration
- Reply tokens: single-use, expire after 1 minute
- `webhookEventId`: ULID format for deduplication

---

## Messaging API Endpoints

All endpoints prefixed with `/api/oa/v2/bot/`.

### Authentication

Bots authenticate via Bearer token in `Authorization` header. Tokens are issued via OAuth endpoints.

### Reply Messages
```
POST /api/oa/v2/bot/message/reply
```
**Request:**
```json
{
  "replyToken": "reply-token-uuid",
  "messages": [
    { "type": "text", "text": "Hello!" }
  ]
}
```

**Response:** `200 OK` on success, `400` if token invalid/expired

### Push Messages
```
POST /api/oa/v2/bot/message/push
```
**Request:**
```json
{
  "to": "vine-user-uuid",
  "messages": [
    { "type": "text", "text": "Notification!" }
  ]
}
```

**Response:** `200 OK` on success, `400` if user is not a friend

### Get Profile
```
GET /api/oa/v2/bot/profile/:userId
```
**Response:**
```json
{
  "userId": "vine-user-uuid",
  "displayName": "User Name",
  "pictureUrl": "https://..."
}
```

### Get Message Content
```
GET /api/oa/v2/bot/message/:messageId/content
```
Returns the raw file content (for media messages).

### Channel Access Token - Short-lived
```
POST /api/oa/v2/oauth/accessToken
```
**Request:**
```json
{
  "grant_type": "client_credentials",
  "client_id": "oa-uuid",
  "client_secret": "channel-secret"
}
```

**Response:**
```json
{
  "access_token": "eyJ...",
  "expires_in": 2592000,
  "token_type": "Bearer"
}
```

**Behavior:** Creates a new `oaAccessToken` record (type: 'short_lived'). Token is stored in DB and can be revoked individually.

### Channel Access Token v2.1 - Long-lived (JWT)
```
POST /api/oa/v2/oauth/accessToken
```
**Request:**
```json
{
  "grant_type": "client_credentials",
  "client_assertion_type": "urn:ietf:params:oauth:client-assertion-type:jwt-bearer",
  "client_assertion": "<JWT>"
}
```

**JWT Payload:**
```json
{
  "iss": "oa-uuid",
  "sub": "oa-uuid",
  "aud": "https://<vine-hostname>/api/oa/v2/oauth/accessToken",
  "exp": 1775304325,
  "jti": "unique-jti"
}
```

**Response:**
```json
{
  "access_token": "eyJ...",
  "expires_in": 2592000,
  "token_type": "Bearer",
  "key_id": "key-uuid"
}
```

**Behavior:** Creates a new `oaAccessToken` record (type: 'jwt_v21'). The `keyId` links all tokens issued with the same public key. Users can issue multiple tokens with the same key — all remain valid until revoked.

### Revoke Access Token
```
POST /api/oa/v2/oauth/revoke
```
**Request:**
```json
{
  "access_token": "eyJ..."
}
```

**Behavior:** Deletes the matching `oaAccessToken` record from DB. Token is immediately invalidated.

### Revoke All Access Tokens by Key ID
```
DELETE /api/oa/v2/oauth/accessToken/kid/:keyId
```

**Behavior:** Deletes ALL `oaAccessToken` records with the given `keyId`. This is the "clear all" operation — if a bot's private key is compromised, the OA owner can revoke every token issued with that key at once.

### Get Valid Access Tokens
```
GET /api/oa/v2/oauth/accessToken/kid/:keyId
```
Lists all valid tokens for a given key ID. Returns:
```json
{
  "keyId": "key-uuid",
  "tokenCount": 3,
  "tokens": [
    { "tokenId": "uuid", "issuedAt": "2026-04-04T00:00:00Z", "expiresAt": "2026-05-04T00:00:00Z" }
  ]
}
```

### MVP Message Types (Bot → User)

| Type | Fields |
|------|--------|
| `text` | `text: string` |
| `sticker` | `packageId: string, stickerId: string` |
| `image` | `originalContentUrl: string, previewImageUrl: string` |

---

## OA Discovery

### OA ID Search
- Users search by `oaId` (e.g., `@mybot`)
- Search endpoint: `GET /api/oa/search?q=<query>`
- Returns matching OAs with: `id`, `name`, `oaId`, `imageUrl`, `description`
- Users add OA by clicking "Add" → creates `oaFriendship` + `chat` (type: 'oa') + `chatMember`

### Adding an OA
1. User searches and finds an OA
2. User clicks "Add Friend"
3. Server creates:
   - `oaFriendship` record (status: 'friend')
   - `chat` record (type: 'oa', lastMessageId: null)
   - `chatMember` record (userId: user, oaId: OA)
4. Server dispatches `follow` webhook event to bot
5. Bot can reply with welcome message

### Removing an OA
1. User clicks "Block" or "Remove"
2. Server updates `oaFriendship` status to 'blocked'
3. Server dispatches `unfollow` webhook event to bot

---

## Server Architecture

### Protocol Split

| Surface | Protocol | Reason |
|---------|----------|--------|
| **OA Management** (internal) | **ConnectRPC** | Type-safe, auto-generated client/server types, consistent with project architecture |
| **Messaging API** (external bot) | **REST** | LINE-compatible format, any language's bot can call |
| **Webhook Dispatch** (to bot) | **REST POST** | Standard webhook pattern |

### ConnectRPC Service Definitions

#### Proto file: `packages/proto/proto/oa/v1/oa.proto`

```protobuf
syntax = "proto3";

package oa.v1;

// ── Provider ──

message Provider {
  string id = 1;
  string name = 2;
  string owner_id = 3;
  string created_at = 4;
  string updated_at = 5;
}

message CreateProviderRequest {
  string name = 1;
}

message CreateProviderResponse {
  Provider provider = 1;
}

message GetProviderRequest {
  string id = 1;
}

message GetProviderResponse {
  Provider provider = 1;
}

message UpdateProviderRequest {
  string id = 1;
  optional string name = 2;
}

message UpdateProviderResponse {
  Provider provider = 1;
}

message DeleteProviderRequest {
  string id = 1;
}

message DeleteProviderResponse {}

message ListProviderAccountsRequest {
  string provider_id = 1;
}

message ListProviderAccountsResponse {
  repeated OfficialAccount accounts = 1;
}

// ── Official Account ──

message OfficialAccount {
  string id = 1;
  string provider_id = 2;
  string name = 3;
  string oa_id = 4;
  string description = 5;
  string image_url = 6;
  string channel_secret = 7;
  string status = 8;
  string created_at = 9;
  string updated_at = 10;
}

message CreateOfficialAccountRequest {
  string provider_id = 1;
  string name = 2;
  string oa_id = 3;
  optional string description = 4;
  optional string image_url = 5;
}

message CreateOfficialAccountResponse {
  OfficialAccount account = 1;
}

message GetOfficialAccountRequest {
  string id = 1;
}

message GetOfficialAccountResponse {
  OfficialAccount account = 1;
}

message UpdateOfficialAccountRequest {
  string id = 1;
  optional string name = 2;
  optional string description = 3;
  optional string image_url = 4;
  optional string status = 5;
}

message UpdateOfficialAccountResponse {
  OfficialAccount account = 1;
}

message DeleteOfficialAccountRequest {
  string id = 1;
}

message DeleteOfficialAccountResponse {}

// ── Webhook ──

message Webhook {
  string id = 1;
  string oa_id = 2;
  string url = 3;
  string status = 4;
  optional string last_verified_at = 5;
  string created_at = 6;
}

message SetWebhookRequest {
  string oa_id = 1;
  string url = 2;
}

message SetWebhookResponse {
  Webhook webhook = 1;
}

message VerifyWebhookRequest {
  string oa_id = 1;
}

message VerifyWebhookResponse {
  bool success = 1;
  string status = 2;
}

message GetWebhookRequest {
  string oa_id = 1;
}

message GetWebhookResponse {
  optional Webhook webhook = 1;
}

// ── Access Token ──

message AccessToken {
  string id = 1;
  string oa_id = 2;
  string token = 3;
  string type = 4;
  optional string key_id = 5;
  optional string expires_at = 6;
  string created_at = 7;
}

message IssueAccessTokenRequest {
  string oa_id = 1;
  string type = 2; // "short_lived" or "jwt_v21"
  optional string public_key = 3; // PEM for jwt_v21
}

message IssueAccessTokenResponse {
  string access_token = 1;
  string expires_in = 2;
  string token_type = 3;
  optional string key_id = 4;
}

message ListAccessTokensRequest {
  string oa_id = 1;
  optional string key_id = 2;
}

message ListAccessTokensResponse {
  repeated AccessTokenSummary tokens = 1;
}

message AccessTokenSummary {
  string id = 1;
  string type = 2;
  optional string key_id = 3;
  optional string expires_at = 4;
  string created_at = 5;
}

message RevokeAccessTokenRequest {
  string token_id = 1;
}

message RevokeAccessTokenResponse {}

message RevokeAllAccessTokensRequest {
  string oa_id = 1;
  string key_id = 2;
}

message RevokeAllAccessTokensResponse {
  int32 revoked_count = 1;
}

// ── Search ──

message SearchOfficialAccountsRequest {
  string query = 1;
}

message SearchOfficialAccountsResponse {
  repeated OfficialAccountSummary accounts = 1;
}

message OfficialAccountSummary {
  string id = 1;
  string name = 2;
  string oa_id = 3;
  string description = 4;
  string image_url = 5;
}

// ── Service ──

service OAService {
  // Provider management
  rpc CreateProvider(CreateProviderRequest) returns (CreateProviderResponse);
  rpc GetProvider(GetProviderRequest) returns (GetProviderResponse);
  rpc UpdateProvider(UpdateProviderRequest) returns (UpdateProviderResponse);
  rpc DeleteProvider(DeleteProviderRequest) returns (DeleteProviderResponse);
  rpc ListProviderAccounts(ListProviderAccountsRequest) returns (ListProviderAccountsResponse);

  // Official Account management
  rpc CreateOfficialAccount(CreateOfficialAccountRequest) returns (CreateOfficialAccountResponse);
  rpc GetOfficialAccount(GetOfficialAccountRequest) returns (GetOfficialAccountResponse);
  rpc UpdateOfficialAccount(UpdateOfficialAccountRequest) returns (UpdateOfficialAccountResponse);
  rpc DeleteOfficialAccount(DeleteOfficialAccountRequest) returns (DeleteOfficialAccountResponse);

  // Webhook management
  rpc SetWebhook(SetWebhookRequest) returns (SetWebhookResponse);
  rpc VerifyWebhook(VerifyWebhookRequest) returns (VerifyWebhookResponse);
  rpc GetWebhook(GetWebhookRequest) returns (GetWebhookResponse);

  // Access Token management
  rpc IssueAccessToken(IssueAccessTokenRequest) returns (IssueAccessTokenResponse);
  rpc ListAccessTokens(ListAccessTokensRequest) returns (ListAccessTokensResponse);
  rpc RevokeAccessToken(RevokeAccessTokenRequest) returns (RevokeAccessTokenResponse);
  rpc RevokeAllAccessTokens(RevokeAllAccessTokensRequest) returns (RevokeAllAccessTokensResponse);

  // Search
  rpc SearchOfficialAccounts(SearchOfficialAccountsRequest) returns (SearchOfficialAccountsResponse);
}
```

### Messaging API (REST — external bot-facing)

All endpoints prefixed with `/api/oa/v2/bot/`. Authenticated via Bearer token.

```
POST /api/oa/v2/bot/message/reply
POST /api/oa/v2/bot/message/push
GET  /api/oa/v2/bot/profile/:userId
GET  /api/oa/v2/bot/message/:messageId/content
POST /api/oa/v2/oauth/accessToken
POST /api/oa/v2/oauth/revoke
GET  /api/oa/v2/oauth/accessToken/kid/:keyId
```

### Service Factory (following existing DI pattern)

```typescript
// apps/server/src/services/oa.ts
type OADeps = {
  db: NodePgDatabase<typeof schema>
  database: Pool
}

function createOAService(deps: OADeps) {
  return {
    createProvider,
    getProvider,
    updateProvider,
    deleteProvider,
    listProviderAccounts,
    createOA,
    getOA,
    updateOA,
    deleteOA,
    setWebhook,
    verifyWebhook,
    getWebhook,
    dispatchWebhook,
    issueAccessToken,
    issueAccessTokenJWT,
    listAccessTokens,
    revokeAccessToken,
    revokeAllAccessTokens,
    replyMessage,
    pushMessage,
    getProfile,
    getMessageContent,
    addFriend,
    removeFriend,
    searchOAs,
  }
}
```

### ConnectRPC Handler

```typescript
// apps/server/src/connect/oa.ts
import { OAService } from '@vine/proto/gen/oa/v1/oa_connect'
import { createOAService } from '../services/oa'

export function createOAHandler(oa: ReturnType<typeof createOAService>) {
  return OAService.impl({
    async createProvider(req, ctx) {
      // auth check: ctx.user
      const provider = await oa.createProvider({ ...req, ownerId: ctx.user.id })
      return { provider: toProtoProvider(provider) }
    },
    // ... implement all RPCs
  })
}
```

### Wiring in `index.ts`

```typescript
const oa = createOAService({ db, database })
const oaHandler = createOAHandler(oa)

// ConnectRPC routes
const { handlers } = connectRouter({
  greeter: createGreeterHandler(greeter),
  oa: oaHandler,
})

// REST routes (Messaging API for external bots)
await oaRESTPlugin(app, { oa })
```

---

## Frontend

### OA Management UI (Settings Page)
- Create OA: form with name, oaId, description, image upload
- OA Settings: edit name, description, image, webhook URL
- Webhook Status: show pending/verified/failed with last verified time
- Channel Secret: display (copyable) for bot configuration
- Access Token Management: issue/revoke tokens, upload public key for JWT v2.1

**Data layer:** All OA management calls use ConnectRPC via `useConnectQuery` / `useConnectMutation` from `@connectrpc/connect-query`. Types are auto-generated from proto.

```typescript
import { useConnectMutation } from '@connectrpc/connect-query'
import { OAService } from '@vine/proto/gen/oa/v1/oa_connect'

const createOA = useConnectMutation(OAService.createOfficialAccount)
const setWebhook = useConnectMutation(OAService.setWebhook)
```

### OA Discovery UI
- Search bar in main chat list or dedicated "Add Friends" screen
- Search results show OA cards with name, image, description
- "Add Friend" button on each OA card

### OA Chat Display
- OA chats appear in unified chat list
- OA chat items show OA's profile image and name
- Visual distinction: small badge or icon indicating "Official Account"

---

## Security

### Webhook Signature Verification
- HMAC-SHA256 with OA's `channelSecret` as key
- Bots verify incoming webhooks from Vine the same way they'd verify LINE's webhooks
- Vine verifies bot's API calls via Bearer token

### Channel Access Token Security
- Short-lived tokens: require `channelSecret` each time, stored in `oaAccessToken` table
- JWT v2.1 tokens: require RSA/EC key pair, public key stored in OA settings
- All tokens are stored in `oaAccessToken` table — users can view issued tokens, revoke individual tokens, or clear all tokens for a given key ID
- Tokens are scoped to a single OA — cannot access other OAs' data

### Webhook URL Requirements
- Must use HTTPS (TLS 1.2+)
- Max 500 characters
- Verified before activation (sends empty events array, expects 200)

---

## Error Handling

### Webhook Delivery Failures
- Timeout (10s): log error, mark webhook as `failed`
- Non-200 response: log status code, mark webhook as `failed`
- No retry queue in MVP (manual retry via "Test Webhook" button in settings)

### Messaging API Errors
- Invalid reply token: `400 Bad Request`
- Token expired: `401 Unauthorized`
- User not a friend: `403 Forbidden`
- Rate limiting: not implemented in MVP

### Structured Error Responses
```json
{
  "message": "Invalid reply token",
  "code": "INVALID_REPLY_TOKEN"
}
```

---

## Environment Variables

| Variable | Description |
|----------|-------------|
| `OA_BASE_URL` | Base URL for OA API endpoints (e.g., `http://localhost:3001/api/oa`) |
| `OA_WEBHOOK_TIMEOUT_MS` | Webhook delivery timeout (default: 10000) |

---

## Testing Strategy

### Server Unit Tests
- Webhook signature generation (HMAC-SHA256)
- CallbackRequest payload construction
- Reply token validation (expiry, single-use)
- JWT v2.1 token issuance and verification
- OA CRUD operations with mock DB

### Integration Tests
- Full webhook dispatch flow: user message → webhook → bot reply → message delivered
- OA friend/unfollow event dispatch
- Channel access token lifecycle: issue → use → revoke
- Webhook URL verification flow
