# Milestone 5: Mini App Platform MVP

**Date:** 2026-05-05
**Status:** Ready for review
**Scope:** Add a LINE-MINI-App-shaped product surface on top of the LIFF runtime
shipped in M4: Mini App entity, gallery, system notice chat, header chrome,
permanent link, OA promotion, and Service Messages.

---

## Context

Vine M1 through M4 delivered:

- A self-hosted Messaging API for Official Accounts (M1).
- LINE-shaped interactive messages — Quick Reply, Imagemap, Flex (M2).
- Rich Menu parity (M3).
- A working LIFF runtime — SDK (`init` / `getProfile` / `sendMessages` /
  `shareTargetPicker` / `closeWindow` / `permanentLink.createUrlBy`),
  `/api/liff/v1/me`, launch tokens with `utou` / `group` / `external` contexts,
  shared LIFF message validator, fixture-based integration tests (M4).

The ROADMAP's recommended next theme is OA Manager parity. This milestone
**slots in before** OA Manager parity to turn Vine from "LIFF host" into a
LINE-MINI-App-shaped product: gallery, system notice chat, header chrome,
permanent link, OA promotion, and Service Messages.

Vine remains a self-hosted LINE clone. This work must not call official LINE
cloud APIs, require LINE Developers Console channel IDs, or depend on
`api.line.me`.

---

## Relationship to LIFF (and to LINE's MINI App architecture)

In LINE, a LINE MINI App channel is a special channel type that **wraps** one
or more LIFF apps. A MINI App channel has three internal sub-channels —
Developing, Review, Published — each containing exactly one LIFF app with its
own LIFF URL, endpoint URL, app name, size, and scopes; the parent MINI App
channel owns Basic settings, Service Message templates, Roles, and the review
request. Confirmed against the LINE Developers Console UI for a LINE MINI App
channel.

Vine M5 follows the same shape but **collapses the three-environment split
into one for MVP**. The schema reserves space for the split as a non-breaking
addition under a future verified flow.

---

## Goals

1. Turn the LIFF runtime shipped in M4 into a recognizable LINE-MINI-App-shaped
   product surface: gallery, system notice chat, header chrome, permanent
   link, OA promotion.
2. Let a Vine instance's developers register a Mini App, attach metadata and
   linked OAs, self-publish, and send Service Messages to users who have used
   the app.
3. Stay self-hosted: no calls to `api.line.me`, no LINE Developers Console
   dependencies, no LINE Login channel IDs.
4. Preserve M4's LIFF runtime, SDK, and tests unchanged. Mini App is purely
   additive.

---

## Non-Goals (deferred to a future "Mini App Verified" milestone)

The MVP schema and APIs leave room for these without breaking changes:

- Verified-vs-unverified split.
- Vine platform-admin verification console (the platform-side review surface).
- Three sub-environments per Mini App (Developing / Review / Published LIFF
  sub-apps).
- Service-notification-token chain (`remainingCount`, 1-year session,
  refresh-on-send).
- Curated, platform-managed Service Message template catalogue with localized
  per-template review.
- Custom Path (e.g. `/m/myapp` instead of `/m/{miniAppId}`).
- Channel-consent simplification.
- Custom action button SDK hook (developer-defined share action).
- LINE MINI App UI components in `@vine/liff` (loading icon, safe-area
  helpers).
- Quick-fill (form auto-fill).
- In-app purchase (LINE Pay).
- Yahoo! Ads in Mini Apps.
- Home-screen shortcut.
- Re-review-after-update workflow.
- Per-Mini-App roles (testers, admins) — provider-level roles continue to
  apply.

---

## Data Model

### `miniApp` (new)

| Field | Type | Notes |
| --- | --- | --- |
| `id` | text PK | caller-generated nanoid, prefixed `mna_` |
| `providerId` | FK → `provider.id` | owns the Mini App |
| `liffAppId` | FK → `oaLiffApp.id`, **unique** | the underlying runtime LIFF app for MVP |
| `name` | text | listing-facing name (separate from LIFF app name) |
| `iconUrl` | text \| null | square icon for gallery / notice footer / header chrome |
| `description` | text \| null | short listing copy |
| `category` | text \| null | free-form for MVP (`reservation`, `queue`, `delivery`, …); enum later |
| `isPublished` | bool default `false` | self-publish toggle |
| `publishedAt` | timestamp \| null | first-publish timestamp; preserved across re-publish |
| `createdAt` / `updatedAt` | timestamp | standard |

Schema reserves the following nullable additions for the verified flow:

- `verifiedAt timestamp null`.
- `customPath text null unique`.
- `developingLiffAppId` / `reviewLiffAppId` / `publishedLiffAppId` (when
  three-env split lands, the current `liffAppId` value migrates into
  `publishedLiffAppId`).

### `miniAppOaLink` (new)

| Field | Type |
| --- | --- |
| `miniAppId` | FK → `miniApp.id` |
| `oaId` | FK → `oa.id` |
| `createdAt` | timestamp |

Composite PK `(miniAppId, oaId)`.

### `miniAppServiceMessageTemplate` (new)

| Field | Type | Notes |
| --- | --- | --- |
| `id` | text PK | caller-generated, prefixed `mst_` |
| `miniAppId` | FK → `miniApp.id` | |
| `name` | text | used as `templateName` in API; convention `{kind}_{bcp47}` |
| `kind` | enum | `reservation_confirmation` \| `queue_position` \| `delivery_update` \| `generic_notification` \| `custom_flex` |
| `languageTag` | text | BCP-47 |
| `flexJson` | jsonb | Flex bubble with `${param}` placeholders |
| `paramsSchema` | jsonb | array of `{ name, required, kind: "text" \| "uri" }` |
| `useCase` | text | developer-supplied use-case description |
| `createdAt` / `updatedAt` | timestamp | |

Hard cap: 20 active templates per Mini App. Enforced at create time.

### `miniAppRecent` (new)

| Field | Type |
| --- | --- |
| `userId` | FK → `userPublic.id` |
| `miniAppId` | FK → `miniApp.id` |
| `lastOpenedAt` | timestamp |

Composite PK `(userId, miniAppId)`. Upserted server-side when `/m/{miniAppId}`
SSR resolves successfully for the user.

### Existing tables — additive changes

- `oa.kind`: new enum column, default `"user"`. Values: `"user"` |
  `"platform_system"`. One seeded row with `kind = "platform_system"` named
  "Mini App 通知" (locale-aware display name) per Vine instance.
- `message.miniAppId`: new nullable FK → `miniApp.id`. Set when the message is
  a rendered Service Message; used by the chat renderer to draw the LINE-style
  footer (mini app icon + name → tap opens `/m/{miniAppId}`). On Mini App
  delete: `set null` so historical messages survive.

---

## Public Routes & SDK Additions

### Permanent link route — `/m/[miniAppId]`

- New OneJS route `apps/web/app/(public)/m/[miniAppId]/index.tsx` plus
  `apps/web/app/(public)/m/[miniAppId]/[...rest].tsx` for path-suffix support.
- SSR resolves `miniApp.liffAppId` and forwards to `/liff/{liffId}/...` with
  query and hash preserved (consistent with M4's permanent-link semantics).
- Returns `404` when the Mini App does not exist.
- Returns `403` (rendered as a "not yet published" page) when
  `isPublished = false` and the viewer is not a provider admin of the Mini
  App's `providerId`. (Per-Mini-App tester roles are deferred to the
  verified flow.)
- Open Graph metadata uses `name`, `description`, `iconUrl` so external
  shares render meaningfully.
- Side effect on success: upsert `miniAppRecent(userId, miniAppId,
  lastOpenedAt = now)` for the authenticated viewer (skipped for anonymous
  viewers).

### Public metadata endpoint — `GET /api/liff/v1/mini-app/:miniAppId`

```json
{
  "id": "mna_…",
  "name": "…",
  "iconUrl": "…",
  "description": "…",
  "category": "…",
  "liffId": "…",
  "isPublished": true,
  "linkedOaIds": ["oa_…", "oa_…"]
}
```

Used by the gallery, the public directory, the OA-profile linked-apps section,
and the header chrome (for service name + icon when the LIFF page hasn't yet
rendered `<title>`).

### SDK additions in `@vine/liff`

Minimal — most of the SDK is already shipped in M4:

- `liff.permanentLink.createUrlBy({ path?, miniAppId? })` — the existing
  helper extends to emit `/m/{miniAppId}/...` when `miniAppId` is on the
  bootstrap. Falls back to `/liff/{liffId}/...` otherwise.
- `liff.miniApp.getInfo()` — returns `{ id, name, iconUrl, description,
  category }` from the bootstrap. No extra round-trip; the host injects the
  values when the LIFF route is reached through a Mini App.

The bootstrap object grows two fields:

```ts
window.VineLIFF = {
  // …existing M4 fields…
  miniAppId?: string,
  miniApp?: { name, iconUrl, description, category },
}
```

No new `liff.ui.*` namespace, no safe-area helpers, no custom action button
hooks for MVP.

### Host-rendered header chrome — `MiniAppShell`

New component `apps/web/app/(public)/liff/MiniAppShell.tsx` wrapping the
existing `LiffBrowser`:

- Top bar (rendered outside the iframe):
  - Back button — sends `liff:host:back` to the child for in-app
    history pop, with `history.back()` fallback.
  - Service name — `miniApp.name`, falling back to LIFF page `<title>` once
    loaded.
  - Subtext — endpoint domain (matches LINE's "developing/unverified shows
    domain" rule; the LINE-style "verified badge + name" subtext is gated on
    the future verified flow).
  - Action button — opens the built-in menu (below).
  - Close / minimize button — web closes the LIFF tab/route; native closes
    the WebView.
  - Linear loading bar driven by iframe `load` events.
- The shell is activated only when the LIFF route resolves through a
  `miniApp` lookup. Bare `/liff/{liffId}` access keeps M4 behavior — no
  chrome.

### Built-in action button menu

Tap-action menu (LINE's pre-15.12 "options" view; the multi-tab view is
deferred):

- **Share permanent link to a chat** — opens the existing M4
  `shareTargetPicker` flow with a pre-filled text message containing the
  `/m/{miniAppId}` URL.
- **Copy URL** — copies the permanent link to the clipboard.
- **Open in external browser** — `window.open(permanentLink, '_blank')` on
  web; OS default browser intent on native.

Custom action buttons (developer-overridden share targets) are deferred.

### Personal gallery

New route `apps/web/app/(app)/home/(tabs)/main/mini-apps/index.tsx` (exact
placement under existing tabs to be confirmed during implementation per the
`tamagui` and `one` skills). Two horizontal scrollers:

1. **Recents** — last-opened `isPublished` Mini Apps from `miniAppRecent`,
   max 12, sorted by `lastOpenedAt` desc.
2. **From your OAs** — Mini Apps where `miniAppOaLink.oaId` is in the
   user's friended OAs, deduplicated against Recents, sorted by linked-OA
   recent-message time, then by `miniApp.publishedAt`.

Each card shows icon, name, and category. Tap navigates to `/m/{miniAppId}`.

### Public directory

Route `apps/web/app/(public)/mini-apps/index.tsx`:

- Lists all `isPublished = true` Mini Apps.
- Filters by category (free-form chips), text search by `name` /
  `description`.
- Pagination: 50 per page with "show more" — no infinite scroll for MVP, no
  curated/featured rows.

### OA-profile linked-apps section

The OA profile / manager page (existing route under `apps/web/app/(app)/oa/`)
gains a "Mini Apps" section listing rows from `miniAppOaLink` where
`oaId = current OA`. Each card links to `/m/{miniAppId}`. The section is
hidden when there are zero links. The OA rich-menu URI-action route to a Mini
App already works through M3 and needs no changes.

---

## Service Messages

The most architecturally distinctive part of M5. Approach 3 — LINE-shaped
surfaces with a **simplified token model**: no service-notification-token
chain, no `remainingCount`, no 1-year session. Each send is one-shot. The
"5 messages per user action" cap becomes a per-`(miniAppId, userId)` rolling
24-hour rate limit.

### Delivery target — platform-managed system OA

- `oa.kind: "user" | "platform_system"` (default `"user"`).
- One seeded `oa` row per Vine instance with `kind = "platform_system"`,
  display name "Mini App 通知" (locale-aware: zh-Hant: "Mini App 通知";
  en: "Mini App Notice"; ja: "ミニアプリ お知らせ").
- The system OA cannot be edited via OA Manager and cannot send replies.
  Existing OA-Manager guards check `oa.kind = "user"` for editability.
- Reuses *everything*: chat plumbing, friendship, push, message rendering,
  unread counts. No new chat type, no custom message kind.
- On the first Service Message to a user, the server auto-creates the
  friendship with the system OA via the existing friendship mutator and
  routes the insert into the existing OA→user chat.

### Per-message footer rendering

- `message.miniAppId` is set to the originating `miniApp.id` for every
  rendered Service Message.
- The chat renderer detects `senderOaKind = "platform_system"` together with
  `miniAppId != null` and appends the LINE-style footer below the Flex bubble:
  - Mini App icon + Mini App name.
  - Tap navigates to `/m/{miniAppId}`.
- This is the only chat-render change required.

### Templates

`miniAppServiceMessageTemplate` schema is defined above. Behavior:

- Hard cap of 20 active templates per Mini App, enforced at create time.
- Starter catalogue: the four `kind`s ship with built-in `flexJson` and
  `paramsSchema` defaults. The developer instantiates per-language
  templates from the catalogue. `custom_flex` lets the developer paste a
  Flex bubble they author themselves.
- Validation reuses M2's Flex validator and rejects non-URI Flex actions,
  consistent with the M4 LIFF `sendMessages` validator.
- Param substitution: `${name}` placeholders in `flexJson` are replaced
  against the request `params` map. Missing required params → 422. Extra
  params are ignored.
- Param length caps mirror LINE's recommended/soft/hard limits per element
  for the predefined kinds (defined in `developers-line-biz` references).
- Language and use-case are stored but not enforced — useful for the future
  curated catalogue.

### Send API

```text
POST /api/oa/v2/mini-app/notifier/send
Authorization: Bearer {loginChannelAccessToken}
Content-Type: application/json

{
  "liffAccessToken": "…",
  "templateName": "reservation_confirmation_zh-Hant",
  "params": { "name": "value", "button_uri_1": "/orders/123" }
}
```

Server-side flow:

1. Validate Login Channel access token → resolve `loginChannelId`.
2. Validate `liffAccessToken` → resolve `userId`.
3. Resolve `miniApp` from `loginChannelId` via
   `oaLiffApp.loginChannelId` ⇒ `miniApp.liffAppId`. Reject with `403` if no
   Mini App, the Mini App is not `isPublished`, or `templateName` is not
   defined for this Mini App.
4. Validate `params` against `paramsSchema`; substitute into `flexJson`.
   Validation failures return `422`.
5. Check rate limit (next section). On exceeded → `429` with
   `retryAfterSec`.
6. Auto-friend the user with the platform-system OA if needed (idempotent).
7. Insert the message:
   - `senderOaId = platformSystemOa.id`
   - `miniAppId = miniApp.id`
   - `kind = "flex"`
   - `flexJson = rendered`
   - `id` and `createdAt` are caller-generated per Vine convention.
8. Return `{ status: "sent", messageId }`.

Error codes:

- `401` — invalid Login Channel access token or invalid LIFF access token.
- `403` — Mini App not published, template not in this Mini App, or token
  does not belong to a Mini App's Login Channel.
- `404` — Mini App or template not found by ID.
- `422` — param validation, Flex validation, or template parse failure.
- `429` — rate limit exceeded.

### Rate limit

Replaces LINE's stateful token chain for MVP:

- Per `(miniAppId, userId)`: **max 5 sends per rolling 24 hours**.
- Implementation: count rows in `message` where
  `miniAppId = ? AND recipientUserId = ? AND createdAt > now() - interval '24
  hours'`. No separate counter table.
- Returns `429` with `{ retryAfterSec }` indicating the time until the
  oldest in-window send falls off.

A future verified flow replaces this with the LINE-style notification-token
chain (`notificationToken` + `remainingCount` + 1-year session) so that
messages can be tied to a specific user-action session. See deferred-scope
index.

### Test sends from the developer console

The console "Send test message" action is **not** exposed on the public send
endpoint. It goes through the `SendTestServiceMessage` ConnectRPC, which
shares the rendering / validation core with the public send pipeline but:

- Authenticates with the developer's Better-Auth session (no Login Channel
  access token, no LIFF access token).
- Sets the recipient to the calling developer's own user account.
- Sets `isTest = true` on the internal call, prefixing the rendered Flex
  bubble's title field with `[TEST]`.
- Bypasses the 5-per-24h rate limiter so the developer can iterate.

---

## Developer Console & OA Linkage

### Routing

Add under the existing provider screen:

```text
(app)/developers/console/provider/[providerId]
└── mini-app/
    ├── index.tsx                    Mini Apps list under this provider
    └── [miniAppId]/
        ├── index.tsx                Basic settings + publish toggle
        ├── liff.tsx                 Read-mostly view of underlying LIFF app
        ├── oa-links.tsx             Manage linked OAs
        └── service-templates.tsx    Template list / add / preview / test send
```

Mini App is **provider-scoped** for navigation, matching LINE's model where a
MINI App channel is a top-level channel under a provider. The underlying LIFF
app stays on its current Login Channel; the Mini App settings page surfaces
the LIFF link as read-mostly metadata with a "configure LIFF app →" deep
link to the existing LIFF screen.

### Basic settings page

| Field | Editable | Notes |
| --- | --- | --- |
| Mini App ID | read-only | copy button |
| Permanent link `/m/{miniAppId}` | read-only | copy + open buttons |
| Name | yes | listing-facing |
| Icon | yes | upload via existing media-upload plugin; required to publish |
| Description | yes | one-line listing copy |
| Category | yes | free-form text MVP |
| Underlying LIFF app | read-only | name + endpoint URL + "configure →" link |
| Linked OAs | yes (separate tab) | see below |
| Publish status | toggle | with confirm modal |
| Created at / Updated at | read-only | |

Publish toggle preconditions (validated server-side):

- `iconUrl` present.
- Underlying LIFF app exists and has an endpoint URL.

Confirm dialog wording:

> Publishing makes this Mini App visible in the public directory and lets it
> send Service Messages. You can unpublish at any time.

### "New Mini App" creation flow

Two-step modal on the provider's Mini App list page:

1. **Pick the underlying LIFF app** — dropdown of LIFF apps under this
   provider's Login Channels that are not already wrapped by another Mini
   App. Empty state links to "Create a LIFF app first" (existing flow).
2. **Mini App basic info** — Name, Icon (optional at create time, required
   to publish), Description, Category.

After create: `miniApp` row written with `isPublished = false`, redirect to
the new `mini-app/[miniAppId]/index.tsx` page.

### OA linkage tab

- Multi-select picker over OAs the current user can manage.
- Adding a link writes a `miniAppOaLink` row.
- The OA's profile page picks this up automatically (Public Surfaces
  section).
- No per-link metadata in MVP — just the link.

### Service Message Template tab

- List existing templates — name, kind, language, use-case.
- Add — pick `kind`, language, edit `params` and `useCase`, "Save" persists
  the template.
- Preview — renders the Flex bubble with sample params using the existing
  Flex Simulator UI.
- Send test message — fires `SendTestServiceMessage` RPC; recipient is the
  developer's own user account. Bypasses the public send endpoint, the
  Login-Channel-access-token check, and the 5-per-24h rate limiter so the
  developer can iterate quickly.
- Delete — removes the template; in-flight sends are unaffected.
- No review state for MVP. Spec notes the LINE `DEVELOPING` / `PUBLISHING`
  split as a verified-flow follow-up.

### ConnectRPC service

New proto service — exact placement under `packages/proto/proto/mini-app/v1/`
or `packages/proto/proto/oa/v1/` resolved at implementation per the `connect`
skill. RPCs:

| RPC | Purpose |
| --- | --- |
| `ListMiniApps(providerId)` | provider's Mini Apps |
| `GetMiniApp(miniAppId)` | basic settings |
| `CreateMiniApp({ providerId, liffAppId, name, … })` | initial create |
| `UpdateMiniApp({ id, name, iconUrl, description, category })` | basic settings |
| `PublishMiniApp(id)` / `UnpublishMiniApp(id)` | toggle, with publish-precondition validation |
| `LinkOa({ miniAppId, oaId })` / `UnlinkOa(...)` | linkage |
| `ListServiceTemplates(miniAppId)` | template list |
| `CreateServiceTemplate({ miniAppId, kind, languageTag, params, useCase })` | add |
| `UpdateServiceTemplate(...)` / `DeleteServiceTemplate(id)` | edit / delete |
| `SendTestServiceMessage({ templateId, params })` | dev-console "Send test" |

All wrapped with the existing `withAuthService` + `requireAuthData` pattern.
Authorization: caller must have provider-admin role on the Mini App's
`providerId`. `LinkOa` additionally requires OA-manager role on the target
OA.

### OA Manager surface (read-only)

OA Manager's existing OA detail page surfaces a **"Linked Mini Apps"**
read-only list — same data as the public OA-profile linked-apps section.
Editing happens only from the Mini App's `oa-links.tsx` tab so that Mini App
ownership stays with the developer.

---

## Authentication & Tokens

- Send API uses the **existing Login Channel access token** issued at the
  Login Channel level. No new token namespace, no new revocation UI for MVP.
- LIFF access tokens are the existing M4 short-lived access tokens.
- The developer console's RPC service uses the existing Better-Auth-on-Connect
  flow (per the `connect` skill).
- A dedicated Service-Message-only token namespace is a deferred verified-flow
  enhancement.

---

## Testing

Per `vine-testing` conventions: unit where the logic is, integration where
boundaries are.

### Unit tests

- **Schema migrations** (`packages/db`):
  - `miniApp.liffAppId` unique constraint.
  - `oa.kind` default is `"user"`; existing OAs unaffected.
  - `message.miniAppId` nullable, `set null` on Mini App delete.
- **Service Message renderer** (`apps/server`):
  - `${param}` placeholder substitution in `flexJson`.
  - Missing required params → 422.
  - Non-URI Flex actions → 422 (consistent with M4 LIFF validator).
  - Param length caps: recommended / soft / hard limits per LINE's per-element
    rules.
- **Send-API authorization** (`apps/server`):
  - Login Channel access token must resolve to a Mini App's underlying Login
    Channel.
  - LIFF access token must resolve to a Vine user.
  - LIFF access token from a different LIFF app → 403.
- **Rate limiter**:
  - 5 sends within 24 h window pass; 6th → 429 with `retryAfterSec`.
  - Window is per `(miniAppId, userId)`; sends to other users do not count.
- **Publish preconditions**:
  - `PublishMiniApp` rejects when `iconUrl` is null.
  - Re-publish preserves `publishedAt` (first-publish timestamp).
- **Permanent link resolver** (`/m/[miniAppId]`):
  - Resolves to the underlying LIFF route with path / query / hash forwarded.
  - 404 on unknown Mini App.
  - 403 on unpublished Mini App for a viewer who is not a provider admin of
    the Mini App's provider.
- **OA linkage**:
  - `LinkOa` requires provider-admin role on the Mini App's provider AND
    OA-manager role on the OA.
  - Duplicate links are idempotent.

### Integration tests (`bun scripts/integration.ts`)

Extend the existing LIFF fixture suite:

1. End-to-end Mini App registration: create Login Channel → create LIFF app →
   create Mini App → upload icon → publish → permanent link resolves.
2. Personal gallery: open Mini App via `/m/{miniAppId}` → "Recents" updates
   → friend an OA linked to the Mini App → "From your OAs" surfaces it.
3. Public directory: query `/(public)/mini-apps`, search by name and
   category.
4. Service Messages happy path: dev-console adds a template → developer's
   server calls send API with valid Login Channel access token + LIFF access
   token → message appears in user's "Mini App 通知" chat with the correct
   footer linking to the Mini App.
5. Service Messages auto-friending: first send creates the friendship with
   the platform-system OA; subsequent sends reuse it.
6. Service Messages rate limiting: sixth send within 24 h returns 429.
7. Service Messages template validation: missing required param → 422;
   non-URI Flex action → 422.
8. Header chrome: opening `/m/{miniAppId}` renders `MiniAppShell` with name
   + close + back + action button menu; opening bare `/liff/{liffId}` keeps
   M4 behavior with no chrome.
9. Action button menu: "Share to chat" opens `shareTargetPicker` with the
   permanent link pre-filled; "Copy URL" copies; "Open in external browser"
   opens a new window.

---

## Acceptance Criteria

- A provider admin can create a Mini App that wraps an existing LIFF app, fill
  in icon / name / description / category, and toggle `isPublished`.
- `/m/{miniAppId}` resolves an `isPublished` Mini App for any viewer;
  redirects/forwards path, query, and hash to the underlying LIFF route.
- Unpublished Mini Apps are reachable only by provider admins.
- A user opening a Mini App through the gallery or `/m/...` sees the
  host-rendered header chrome (service name, back, close, action button,
  loading bar).
- The action button menu offers Share / Copy URL / Open in external browser.
- The personal gallery shows "Recents" and "From your OAs" sections sourced
  from `miniAppRecent` and `miniAppOaLink`.
- The public directory at `/mini-apps` lists all `isPublished` Mini Apps with
  text search and category filter.
- An OA's profile shows linked Mini Apps when `miniAppOaLink` rows exist.
- A Mini App developer can register up to 20 service-message templates,
  preview them, and send a test message to themselves from the developer
  console.
- Calling `POST /api/oa/v2/mini-app/notifier/send` with a valid Login Channel
  access token, a valid LIFF access token, and a registered template inserts
  a Flex-rendered message into the user's "Mini App 通知" chat with a footer
  linking to the Mini App.
- The send API enforces a 5-per-24h-per-(miniApp, user) rate limit; the sixth
  send returns 429.
- All M4 behavior is unchanged: bare `/liff/{liffId}` access still works
  without chrome; existing M4 tests pass.
- No call to `api.line.me`; no LINE Login channel ID dependency; no LINE Pay
  / Yahoo ads / IAP code shipped.

---

## Deferred-Scope Index (verbatim)

The following are intentionally deferred to a future "Mini App Verified"
milestone. The MVP schema and APIs leave room for these without breaking
changes.

| Deferred | Why | What changes when added |
| --- | --- | --- |
| Verified-vs-unverified split | governance | adds `miniApp.verifiedAt`; certain features gate on it |
| Vine platform-admin verification console | governance | new admin-side review queue UI for the platform party |
| Three sub-environments (Developing / Review / Published LIFF apps per Mini App) | parity | adds `developingLiffAppId` / `reviewLiffAppId` / `publishedLiffAppId` columns; current `liffAppId` migrates into `publishedLiffAppId` |
| Service-notification-token chain (`remainingCount`, 1-year session) | parity | adds `miniAppNotificationSession` table; replaces the 24 h rate limiter; adds `/v2/notifier/token` issue endpoint |
| Curated platform-managed template catalogue | quality | adds platform-side template review UI + per-template `publishStatus` |
| Custom Path (`/m/myapp`) | parity, verified-only | adds `miniApp.customPath` unique nullable; routing precedence rules |
| Channel-consent simplification | parity, verified-only | reuses Vine auth consent; gated on verified |
| Custom action button SDK hook | parity | new `liff.shareMessage()` SDK method + host runtime |
| LINE MINI App UI components (loading icon, safe-area helpers) | DX | small additions to `@vine/liff` |
| Quick-fill (form auto-fill) | feature | substantial new SDK + UI surface; standalone milestone |
| In-app purchase | irrelevant for self-hosted clone | Vine creator-market payments cover this differently |
| Yahoo! Ads | irrelevant for self-hosted clone | not planned |
| Home-screen shortcut | mostly-native | revisit when native client matures |
| Re-review after update | governance | part of verified flow |
| Per-Mini-App roles (testers, admins) | governance | adds role rows; provider roles cover MVP |
| Multi-tab share view (LINE 15.12+) | parity | replaces the current options menu in `MiniAppShell` |

---

## References

- `ROADMAP.md` (Milestones, P2 Mini App scope, deferred items in M4).
- `docs/superpowers/specs/2026-05-03-m4-liff-completion-design.md` (the M4
  LIFF completion design — the runtime this milestone builds on).
- `.claude/skills/developers-line-biz/references/introducing_line_mini_app.md`.
- `.claude/skills/developers-line-biz/references/line_developers_console_guide_for_line_mini_app.md`.
- `.claude/skills/developers-line-biz/references/line_mini_app_ui_components.md`.
- `.claude/skills/developers-line-biz/references/sending_service_messages.md`.
- LINE Developers Console UI reference HTMLs in repo root: `LINE
  Developers.html` (Basic settings tab) and `LINE Developers2.html` (Web app
  settings tab).
