# LIFF Platform Design

## Overview

Implement full LINE Front-end Framework (LIFF) support for Vine, enabling third-party web apps to run inside Vine's native browser with user identity access, messaging, and more. This includes a new `loginChannel` table (separate from Messaging API channels), a `@vine/liff` SDK, LIFF Browser (native WebView), and developer console management.

## Key Decisions

- **LIFF belongs to LINE Login channels**, not Messaging API channels (LINE's official stance since Feb 2020)
- **New `loginChannel` table** linked to `oaProvider`, separate from `officialAccount`
- **`@vine/liff` SDK** mirrors `@line/liff` API for compatibility
- **Native WebView** for LIFF browser (requires `react-native-webview`)
- **ConnectRPC** for all management endpoints (consistent with existing OA service)
- **Vine's existing OAuth2** (`/oauth2/v2.1/authorize`) for LIFF authentication
- **No migration needed** — internal dev, can wipe data

---

## Section 1: Database Schema

### `login_channel` table

```sql
CREATE TABLE login_channel (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id     uuid NOT NULL REFERENCES oa_provider(id) ON DELETE CASCADE,
  name            text NOT NULL,
  channel_secret  text NOT NULL,
  channel_id      text NOT NULL UNIQUE,
  description     text,
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now()
);
```

- One provider can have multiple login channels
- `channel_id` is a unique identifier (like LINE's channel ID)
- `channel_secret` for OAuth2 token signing

### `oa_liff_app` table

```sql
CREATE TABLE oa_liff_app (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  login_channel_id  uuid NOT NULL REFERENCES login_channel(id) ON DELETE CASCADE,
  liff_id           text NOT NULL UNIQUE,
  view_type         text NOT NULL DEFAULT 'full',  -- compact | tall | full
  endpoint_url      text NOT NULL,
  module_mode       boolean DEFAULT false,
  description       text,
  scopes            text[] DEFAULT '{profile,chat_message.write}',
  bot_prompt        text DEFAULT 'none',  -- normal | aggressive | none
  qr_code           boolean DEFAULT false,
  created_at        timestamptz DEFAULT now(),
  updated_at        timestamptz DEFAULT now()
);
```

- Max 30 LIFF apps per login channel (matching LINE's limit)
- `liff_id` format: `{channelId}-{random8chars}` (e.g. `550e8400-AbcdEfgh`)
- `endpoint_url` must be HTTPS
- `scopes`: `openid`, `email`, `profile`, `chat_message.write`
- `bot_prompt`: `normal` | `aggressive` | `none`

### Drizzle schema location

```
packages/db/src/schema-login.ts  ← login_channel, oa_liff_app
```

---

## Section 2: Server — Service + ConnectRPC

### Service Factory

**File:** `apps/server/src/services/liff.ts`

```ts
function createLiffService(deps: { db: NodePgDatabase }) {
  // Login Channel operations
  createLoginChannel(providerId, input)
  getLoginChannel(id)
  listLoginChannels(providerId)
  deleteLoginChannel(id)

  // LIFF App operations
  createLiffApp(loginChannelId, input)  // generates liff_id, validates endpoint_url
  updateLiffApp(loginChannelId, liffId, input)
  getLiffApp(loginChannelId, liffId)
  listLiffApps(loginChannelId)          // max 30 enforcement
  deleteLiffApp(loginChannelId, liffId)
}
```

### Proto Definitions

**File:** `packages/proto/src/liff.proto`

```protobuf
service LoginChannelService {
  rpc CreateLoginChannel(CreateLoginChannelRequest) returns (LoginChannel);
  rpc GetLoginChannel(GetLoginChannelRequest) returns (LoginChannel);
  rpc ListLoginChannels(ListLoginChannelsRequest) returns (ListLoginChannelsResponse);
  rpc DeleteLoginChannel(DeleteLoginChannelRequest) returns (google.protobuf.Empty);
}

service LIFFService {
  rpc CreateLiffApp(CreateLiffAppRequest) returns (LiffApp);
  rpc UpdateLiffApp(UpdateLiffAppRequest) returns (LiffApp);
  rpc GetLiffApp(GetLiffAppRequest) returns (LiffApp);
  rpc ListLiffApps(ListLiffAppsRequest) returns (ListLiffAppsResponse);
  rpc DeleteLiffApp(DeleteLiffAppRequest) returns (google.protobuf.Empty);
}
```

### ConnectRPC Handler

**File:** `apps/server/src/connect/liff.ts`

Same pattern as `oa.ts`:
- Factory function `liffHandler(deps)` returns ConnectRouter handler
- Uses `requireAuthData(ctx)` for auth
- Ownership check: provider must be owned by current user
- Wraps `createLiffService` factory

### Wiring

In `apps/server/src/index.ts`:
```ts
const liff = createLiffService({ db })
router(liffHandler({ liff, auth }))
```

---

## Section 3: `@vine/liff` SDK Package

**Location:** `packages/liff/`

TypeScript SDK mirroring `@line/liff` API. Standalone package, no dependency on `@line/liff`.

### API Surface

```ts
import liff from '@vine/liff'

// Init (required before other methods)
await liff.init({ liffId: 'xxx' })

// Environment (work before init)
liff.ready                    // Promise<void>
liff.getOS()                  // 'ios' | 'android' | 'web'
liff.getAppLanguage()         // string
liff.getVersion()             // string
liff.getLineVersion()         // string (Vine version)
liff.isInClient()             // boolean (true in native WebView)
liff.isLoggedIn()             // boolean

// Auth
liff.login()                  // redirect to Vine OAuth2
liff.logout()
liff.getAccessToken()         // string | null
liff.getIDToken()             // string | null (JWT)
liff.getDecodedIDToken()      // DecodedIDToken

// Profile
liff.getProfile()             // { userId, displayName, pictureUrl, statusMessage }
liff.getFriendship()          // { friendFlag: boolean }

// Messaging
liff.sendMessages([...])      // send to current chat
liff.shareTargetPicker([...]) // share to friend/group

// Window
liff.openWindow({ url, external })
liff.closeWindow()

// Context
liff.getContext()             // { type, userId, viewType, ... }

// QR Code
liff.scanCodeV2()             // { value: string }

// Permanent Link
liff.permanentLink.createUrlBy(url)

// Feature check
liff.isApiAvailable('shareTargetPicker')
```

### Key Design Decisions

- `liff.init()` validates `liffId` against Vine's server
- `liff.login()` redirects to Vine's `/oauth2/v2.1/authorize`
- `liff.isInClient()` returns `true` when running in Vine's native WebView
- `liff.getLineVersion()` returns Vine's version string
- TypeScript types included
- Works in both LIFF browser and external browser

---

## Section 4: LIFF Browser — Native WebView

### Component

**File:** `apps/web/src/interface/liff/LiffBrowser.tsx`

```tsx
<LiffBrowser
  liffId="xxx"
  onMessage={(event) => { /* handle postMessage */ }}
  onClose={() => { /* when liff.closeWindow() is called */ }}
/>
```

### Platform Implementation

**Native (`LiffBrowser.native.tsx`):**
- Uses `react-native-webview` (`WebView` component)
- Opens LIFF app's `endpoint_url` inside fullscreen WebView
- Injects `@vine/liff` SDK script into WebView
- Bridges `liff.*` calls between WebView ↔ native via `postMessage`
- Handles OAuth2 token flow: WebView → Vine OAuth2 → redirect back with token
- `liff.isInClient()` returns `true`

**Web (`LiffBrowser.tsx`):**
- Uses `<iframe>` with `postMessage` bridge
- External browser mode (LIFF browser not available on web)

### Dependency

Add `react-native-webview` to `apps/web/package.json`:
```json
"react-native-webview": "^13.0.0"
```

### Styling Notes

- WebView only supports basic layout props (width/height/position)
- Wrap in Tamagui's `YStack` for layout
- Be mindful of z-index conflicts with Tamagui's portal/modal components

---

## Section 5: Developer Console — LIFF Management

### New Routes

```
developers/console/
├── provider/[providerId]/
│   └── index.tsx              ← unified list: Messaging API + LINE Login channels
├── channel/[channelId]/
│   └── index.tsx              ← Messaging API channel settings (existing)
├── login-channel/[loginChannelId]/
│   ├── index.tsx              ← LINE Login channel settings
│   └── liff.tsx               ← LIFF tab (CRUD for LIFF apps)
```

### Provider Page Updates

The provider page shows both channel types:
- `officialAccount` entries → "Messaging API" badge
- `loginChannel` entries → "LINE Login" badge
- "Create Channel" button with type selector

### LIFF Tab Content

- Table: liffId, view type, endpoint URL, scopes, QR code toggle
- "Add LIFF App" button → modal/form
- Edit/Delete actions per row
- Max 30 apps indicator
- Generated LIFF URL display: `https://{vine-host}/liff/{liffId}`

### Data Flow

```ts
// Login Channels
const { data } = useTanQuery({
  queryKey: ['login-channels', providerId],
  queryFn: () => loginChannelClient.listLoginChannels({ providerId }),
})

// LIFF Apps
const { data } = useTanQuery({
  queryKey: ['liff', 'apps', loginChannelId],
  queryFn: () => liffClient.listLiffApps({ loginChannelId }),
})

const createApp = useTanMutation({
  mutationFn: (input) => liffClient.createLiffApp({ loginChannelId, ...input }),
})
```

---

## Section 6: LIFF URL Routing & OAuth2 Integration

### LIFF URL Format

```
https://{vine-host}/liff/{liffId}
```

### Route Handler

**File:** `apps/web/app/liff/[liffId].tsx`

```
User opens liff URL
  ↓
Validate liffId → fetch oaLiffApp from DB
  ↓
Check login status (session cookie / access token)
  ↓
If not logged in → redirect to /oauth2/v2.1/authorize
  ↓
After OAuth2 consent → redirect back to endpoint_url with access_token
  ↓
Endpoint URL loads, calls liff.init({ liffId })
  ↓
LIFF app ready
```

### OAuth2 Integration

Uses Vine's existing OAuth2 endpoints:
- `/oauth2/v2.1/authorize` — authorization endpoint
- `/oauth2/v2.1/token` — token exchange
- LIFF SDK gets `access_token` from URL fragment after redirect

### liffId Generation

```
Format: {channelId}-{random8chars}
Example: "550e8400-e29b-41d4-a716-446655440000-AbcdEfgh"
```

URL-safe, matches LINE's format.

---

## Section 7: Opening LIFF Apps from Chat

### URL Schemes

```
https://{vine-host}/liff/{liffId}              ← web browser
vine://app/{liffId}                            ← native app deep link
```

### Use Cases

1. User shares LIFF URL in chat → recipient taps → opens in LIFF WebView
2. OA sends LIFF URL via messaging API → user taps → opens in LIFF WebView
3. Rich menu action with `uri` type pointing to LIFF URL

### Integration with Chat

- `LiffBrowser` component opens when user taps a LIFF URL
- Detects LIFF URL pattern: `/{liffId}` or `vine://app/{liffId}`
- Opens native WebView instead of external browser
- Injects `@vine/liff` SDK into WebView

### Rich Menu Integration

```ts
// URI actions can point to LIFF apps
action: {
  type: 'uri',
  uri: 'https://vine.example.com/liff/1234567890-AbcdEfgh'
}
```

---

## File Summary

### New Files

| File | Purpose |
|------|---------|
| `packages/db/src/schema-login.ts` | Drizzle schema for login_channel, oa_liff_app |
| `packages/proto/src/liff.proto` | Protobuf definitions for LIFF + LoginChannel services |
| `packages/liff/` | @vine/liff SDK package |
| `apps/server/src/services/liff.ts` | LIFF + LoginChannel service factory |
| `apps/server/src/connect/liff.ts` | ConnectRPC handler for LIFF services |
| `apps/web/app/liff/[liffId].tsx` | LIFF URL route handler |
| `apps/web/src/interface/liff/LiffBrowser.tsx` | LIFF WebView component (web) |
| `apps/web/src/interface/liff/LiffBrowser.native.tsx` | LIFF WebView component (native) |
| `apps/web/app/(app)/developers/console/login-channel/[loginChannelId]/index.tsx` | Login channel settings page |
| `apps/web/app/(app)/developers/console/login-channel/[loginChannelId]/liff.tsx` | LIFF management tab |

### Modified Files

| File | Change |
|------|--------|
| `apps/server/src/index.ts` | Wire LIFF handler |
| `apps/server/src/plugins/auth.ts` | Add LIFF OAuth2 scopes |
| `apps/web/app/(app)/developers/console/provider/[providerId]/index.tsx` | Show login channels alongside OAs |
| `apps/web/app/(app)/developers/console/channel/[channelId]/index.tsx` | Remove LIFF tab (now on login channel) |
| `apps/web/package.json` | Add react-native-webview |

### Dependencies

| Package | Purpose |
|---------|---------|
| `react-native-webview` | Native WebView for LIFF browser |
| `@vine/liff` (new) | LIFF SDK for third-party apps |

---

## Self-Review

1. **Placeholder scan:** No TBD/TODO placeholders found.
2. **Internal consistency:** Schema, service, SDK, and UI sections align. LIFF apps correctly linked to loginChannel (not officialAccount).
3. **Scope check:** Focused on LIFF platform. No unrelated features included.
4. **Ambiguity check:** Clear ownership model (provider → loginChannel → liffApp). Auth flow matches existing OAuth2.
