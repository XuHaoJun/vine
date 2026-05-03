# M4 LIFF Completion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete Vine's existing LIFF runtime so a third-party mini app can run the supported LINE-like happy path inside Vine: init, profile, context, permanent links, sendMessages, shareTargetPicker, and closeWindow.
**Architecture:** Add a shared LIFF message validator/converter, make the SDK consume Vine runtime bootstrap data, add authenticated public LIFF runtime endpoints, resolve permanent-link paths in the One route, and route host-mediated LIFF messages through existing Zero mutations.
**Tech Stack:** TypeScript, One, React/Tamagui, Zero, Fastify, Drizzle, Vitest, Playwright, Bun.

---

## File Structure

Files to add:

```text
apps/web/src/features/liff/liffMessage.ts
apps/web/src/features/liff/liffRuntime.ts
apps/web/src/features/liff/resolveLiffPermanentUrl.ts
apps/server/src/services/liff-runtime-token.ts
apps/server/src/services/liff-runtime-token.test.ts
apps/server/src/plugins/liff-public.test.ts
packages/zero-schema/src/models/message.liff.test.ts
apps/web/src/test/unit/features/liff/liffMessage.test.ts
apps/web/src/test/unit/features/liff/liffRuntime.test.ts
apps/web/src/test/unit/features/liff/liffSdk.test.ts
apps/web/src/test/unit/features/liff/resolveLiffPermanentUrl.test.ts
apps/web/src/test/unit/features/liff/ShareTargetPicker.test.tsx
```

Files to modify:

```text
packages/liff/src/liff.ts
packages/liff/src/index.ts
packages/liff-fixtures/src/mock-share-target-picker.ts
apps/server/src/plugins/liff-public.ts
apps/server/src/index.ts
apps/web/app/(app)/liff/[liffId].tsx
apps/web/app/(app)/liff/[...liffPath].tsx
apps/web/src/interface/liff/LiffBrowser.tsx
apps/web/src/interface/liff/LiffBrowser.native.tsx
apps/web/src/features/liff/ShareTargetPicker.tsx
apps/web/app/(app)/developers/console/login-channel/[loginChannelId]/liff.tsx
apps/web/src/test/integration/liff-share-target-picker.test.ts
packages/zero-schema/src/models/message.ts
```

Existing files to inspect before edits:

```text
apps/server/src/plugins/liff-public.ts
apps/server/src/plugins/oa-webhook.ts
apps/server/src/services/liff.ts
apps/web/src/interface/liff/LiffBrowser.tsx
apps/web/src/interface/liff/LiffBrowser.native.tsx
apps/web/src/features/liff/ShareTargetPicker.tsx
apps/web/app/(app)/liff/[liffId].tsx
packages/liff/src/liff.ts
packages/zero-schema/src/models/message.ts
packages/zero-schema/src/models/chat.ts
packages/zero-schema/src/queries/entitlement.ts
packages/flex-schema/src/components/action.ts
```

Browser bootstrap note: a web iframe cannot write `window.VineLIFF` into a cross-origin child frame, and the child URL fragment must remain available for LIFF permanent-link hashes. The web host therefore uses a `postMessage` bootstrap handshake:

1. `@vine/liff.init()` posts `{ type: 'liff:bootstrap', requestId, liffId }` to `window.parent`.
2. `LiffBrowser` accepts the request only from the configured endpoint origin.
3. `LiffBrowser` replies to the child with `{ type: 'liff:bootstrap:done', requestId, bootstrap }` and `targetOrigin: endpointOrigin`.

Native WebView keeps using `injectedJavaScriptBeforeContentLoaded` because it controls the WebView document before app code runs. The SDK still reads `window.VineLIFF` first for native and same-document fixtures, then uses the web handshake, then falls back to `window.location.origin` for external-browser behavior.

## Task 1: Add Shared LIFF Message Validation And Conversion

- [ ] Write failing unit tests in `apps/web/src/test/unit/features/liff/liffMessage.test.ts`.

Test cases:

```ts
describe('validateAndConvertLiffMessages', () => {
  it('accepts sendMessages text, sticker, image, video, audio, location, and flex URI messages')
  it('accepts shareTargetPicker text, image, video, audio, location, and flex URI messages')
  it('rejects more than five messages')
  it('rejects quickReply, quoteToken, text emojis, and video trackingId')
  it('rejects template and imagemap for both methods')
  it('rejects sticker for shareTargetPicker')
  it('rejects non-URI flex actions')
  it('preserves metadata in MessageBubbleFactory-compatible shape')
})
```

Command:

```bash
rtk bun run --cwd apps/web test:unit -- src/test/unit/features/liff/liffMessage.test.ts
```

Expected red result: Vitest fails because `apps/web/src/features/liff/liffMessage.ts` does not exist.

- [ ] Implement `apps/web/src/features/liff/liffMessage.ts`.

Required exported API:

```ts
export type LiffMessageMethod = 'sendMessages' | 'shareTargetPicker'

export type ConvertedLiffMessage = {
  type: 'text' | 'image' | 'video' | 'audio' | 'sticker' | 'location' | 'flex'
  text: string | null
  metadata: string | null
}

export type LiffMessageValidationError = {
  code: 'INVALID_ARGUMENT' | 'UNSUPPORTED_MESSAGE' | 'PERMISSION_DENIED'
  message: string
}

export function validateAndConvertLiffMessages(input: {
  method: LiffMessageMethod
  messages: unknown
  canUseStickerPackage?: (packageId: string) => boolean
}): { ok: true; messages: ConvertedLiffMessage[] } | { ok: false; error: LiffMessageValidationError }
```

Validation rules:

- `messages` must be an array with 1 to 5 entries.
- Reject unknown message types.
- Reject `quickReply`, `quoteToken`, `text.emojis`, and `video.trackingId`.
- Reject `template` and `imagemap` for both methods.
- Reject `sticker` for `shareTargetPicker`.
- Require HTTPS URLs for `image`, `video`, and `audio` content URLs.
- Convert metadata with the same field names consumed by `MessageBubbleFactory`.
- For sticker messages, allow public/system package IDs without entitlement and call `canUseStickerPackage` for Vine marketplace package IDs.
- For flex messages, recursively reject every action object whose `type` is not `uri`.

Implementation details:

- Use narrow local type guards over `unknown`; do not import the OA Messaging API validator directly if it would preserve unsupported LIFF fields.
- Keep the flex URI-only traversal in this file so OA Messaging API Flex validation remains unchanged.
- Return stable error codes and human-readable messages; do not throw for expected validation failures.

- [ ] Run the focused test until green.

Command:

```bash
rtk bun run --cwd apps/web test:unit -- src/test/unit/features/liff/liffMessage.test.ts
```

Expected green result: all LIFF message validation tests pass.

- [ ] Commit this slice.

```bash
rtk git add apps/web/src/features/liff/liffMessage.ts apps/web/src/test/unit/features/liff/liffMessage.test.ts
rtk git commit -m "feat(liff): add runtime message validation"
```

## Task 2: Add SDK Bootstrap, API Base Resolution, Context, And Promise-Based sendMessages

- [ ] Write failing SDK tests.

Add SDK tests through the web unit suite so they run with Vine's configured Vitest aliases:

```text
apps/web/src/test/unit/features/liff/liffSdk.test.ts
```

Test cases:

```ts
describe('@vine/liff runtime bootstrap', () => {
  it('uses window.VineLIFF.apiBaseUrl for init, getProfile, and getFriendship')
  it('uses parent postMessage bootstrap when window.VineLIFF is absent')
  it('falls back to window.location.origin without bootstrap')
  it('returns chat context from bootstrap for getContext')
  it('resolves sendMessages only after host acknowledgement')
  it('rejects sendMessages on host error acknowledgement')
  it('does not consume or remove permanent-link URL hash values')
})
```

Command:

```bash
rtk bun run --cwd apps/web test:unit -- src/test/unit/features/liff/liffSdk.test.ts
```

Expected red result: tests fail because the SDK always uses `window.location.origin`, `sendMessages` does not wait for host acknowledgement, and no web bootstrap handshake exists.

- [ ] Update `packages/liff/src/liff.ts`.

Required changes:

- Define the runtime bootstrap type:

```ts
type VineLiffBootstrap = {
  apiBaseUrl?: string
  liffId?: string
  endpointOrigin?: string
  accessToken?: string
  chatId?: string
  contextType?: 'utou' | 'group' | 'external'
  lineVersion?: string
}
```

- Add `getBootstrap()` that reads:
  1. `window.VineLIFF`
  2. a web `liff:bootstrap` / `liff:bootstrap:done` parent handshake
  3. an empty object
- Add `getApiBaseUrl()` that returns `bootstrap.apiBaseUrl ?? window.location.origin`.
- During `init`, store `bootstrap.accessToken` as the LIFF runtime access token when present.
- Update `init`, `getProfile`, and `getFriendship` to use `getApiBaseUrl()`.
- Update `getProfile()` to call `/liff/v1/me?liffId=${encodeURIComponent(liffId)}` with `Authorization: Bearer ${accessToken}`.
- Update `getContext()` to return bootstrap context:

```ts
{
  type: bootstrap.contextType ?? (this._initialized ? 'external' : 'external'),
  viewType: this._config?.viewType,
  endpointUrl: this._config?.endpointUrl,
  liffId: this._liffId,
}
```

- Update `permanentLink.createUrlBy()` to create Vine host URLs from `apiBaseUrl` and `liffId`, preserving the supplied path/query/hash.
- Parse `access_token` and `id_token` from hash without deleting unrelated hash keys or the LIFF permanent-link hash. If token cleanup is needed, remove only token parameters and preserve the remaining fragment.
- Update `sendMessages(messages)` to post:

```ts
{
  type: 'liff:sendMessages',
  requestId,
  messages,
}
```

and wait for either `liff:sendMessages:done` or `liff:sendMessages:error` with the same `requestId`.

- Keep `shareTargetPicker` behavior compatible while including a `requestId`. The SDK sends to the parent window; the host sends every response back with `targetOrigin: endpointOrigin`.

- [ ] Export any needed test-only helpers through internal named exports only if tests cannot otherwise isolate the SDK singleton.

Keep the public package export unchanged for app developers.

- [ ] Run the focused SDK test until green.

Command:

```bash
rtk bun run --cwd apps/web test:unit -- src/test/unit/features/liff/liffSdk.test.ts
```

Expected green result: SDK bootstrap, context, and acknowledgement tests pass.

- [ ] Commit this slice.

```bash
rtk git add packages/liff/src/liff.ts packages/liff/src/index.ts apps/web/src/test/unit/features/liff/liffSdk.test.ts
rtk git commit -m "feat(liff): bootstrap sdk against vine runtime"
```

## Task 3: Add Server Profile Endpoint And LIFF Runtime Token Service

- [ ] Write failing runtime-token service tests in `apps/server/src/services/liff-runtime-token.test.ts`.

Test cases:

```ts
describe('createLiffRuntimeTokenService', () => {
  it('signs and resolves a valid short-lived LIFF access token')
  it('signs and resolves a valid short-lived launch token')
  it('rejects an access token with a mismatched liffId')
  it('rejects expired tokens')
  it('rejects tokens with a mismatched liffId')
  it('rejects tampered tokens')
})
```

Command:

```bash
rtk bun run --cwd apps/server test:unit -- src/services/liff-runtime-token.test.ts
```

Expected red result: test file fails because `createLiffRuntimeTokenService` does not exist.

- [ ] Implement `apps/server/src/services/liff-runtime-token.ts`.

Required exported API:

```ts
export type LiffAccessTokenContext = {
  kind: 'access'
  liffId: string
  userId: string
  scopes: string[]
  exp: number
}

export type LiffLaunchContext = {
  kind: 'launch'
  liffId: string
  chatId: string
  userId: string
  contextType: 'utou' | 'group'
  exp: number
}

export function createLiffRuntimeTokenService(input: {
  secret: string
  now?: () => number
  accessTtlMs?: number
  launchTtlMs?: number
}): {
  createAccessToken(context: Omit<LiffAccessTokenContext, 'kind' | 'exp'>): string
  resolveAccessToken(token: string, liffId: string): LiffAccessTokenContext | null
  createLaunchToken(context: Omit<LiffLaunchContext, 'kind' | 'exp'>): string
  resolveLaunchToken(token: string, liffId: string): LiffLaunchContext | null
}
```

Implementation details:

- Use Node `crypto.createHmac('sha256', secret)` with base64url segments.
- Default access-token TTL: 15 minutes.
- Default launch-token TTL: 5 minutes.
- The service is stateless; the server still validates session, app existence, and chat membership before minting tokens.
- The token payload includes `kind` so an access token cannot be used as a launch token, and a launch token cannot authenticate `/liff/v1/me`.
- Do not add a database table for LIFF runtime tokens.

- [ ] Write failing public route tests in `apps/server/src/plugins/liff-public.test.ts`.

Test cases:

```ts
describe('liffPublicPlugin profile and launch routes', () => {
  it('GET /liff/v1/me returns current Vine user profile for a valid LIFF access token')
  it('GET /liff/v1/me returns 401 without a valid LIFF access token')
  it('POST /liff/v1/access-token returns an access token for an authenticated Vine user')
  it('POST /liff/v1/launch returns a launch token for a chat member')
  it('POST /liff/v1/launch returns 403 when the user is not a chat member')
})
```

Mock `getAuthDataFromRequest` the same way `apps/server/src/plugins/oa-webhook.test.ts` does. Use a small mock Drizzle chain that returns `userPublic`, `chat`, and `chatMember` rows.

Command:

```bash
rtk bun run --cwd apps/server test:unit -- src/plugins/liff-public.test.ts
```

Expected red result: routes are missing.

- [ ] Update `apps/server/src/plugins/liff-public.ts`.

Add:

- `GET /liff/v1/me?liffId=...`
  - Require `liffId` so the Bearer token can be resolved against the expected LIFF app.
  - Authenticate with a Bearer LIFF access token resolved by `deps.liffRuntimeToken.resolveAccessToken(token, liffId)`.
  - Accept Vine session auth only for same-origin development fallback; cross-origin LIFF apps use the Bearer token.
  - Query `userPublic` by auth ID.
  - Return:

```ts
{
  userId: authData.id,
  displayName: profile.name ?? profile.username ?? authData.id,
  pictureUrl: profile.image ?? null,
  statusMessage: null,
}
```

- `POST /liff/v1/access-token`
  - Body: `{ liffId: string }`.
  - Authenticate current Vine user with `getAuthDataFromRequest(deps.auth, toWebRequest(request))`.
  - Verify LIFF app exists.
  - Mint a short-lived access token with `{ liffId, userId: authData.id, scopes: appRecord.scopes }`.
  - Return `{ accessToken, expiresIn }`.

- `POST /liff/v1/launch`
  - Body: `{ liffId: string; chatId: string }`.
  - Authenticate current Vine user.
  - Verify LIFF app exists.
  - Verify current user is an accepted `chatMember` of `chatId`.
  - Read `chat.type`; map `group` to `group`, map `direct` and `oa` to `utou`.
  - Return `{ launchToken, contextType, chatId }`.

- [ ] Update `apps/server/src/index.ts` wiring.

Create a runtime token service with:

```ts
const liffRuntimeToken = createLiffRuntimeTokenService({
  secret: process.env['LIFF_RUNTIME_TOKEN_SECRET'] ?? process.env['BETTER_AUTH_SECRET'] ?? 'vine-dev-liff-runtime-token-secret',
})
```

Pass it to `liffPublicPlugin`.

- [ ] Add `LIFF_RUNTIME_TOKEN_SECRET` to `docs/envs.md`.

Use the existing fallback for local development, but make production deploys able to set a stable secret.

- [ ] Run focused server tests until green.

Commands:

```bash
rtk bun run --cwd apps/server test:unit -- src/services/liff-runtime-token.test.ts
rtk bun run --cwd apps/server test:unit -- src/plugins/liff-public.test.ts
```

Expected green result: runtime-token and public profile route tests pass.

- [ ] Commit this slice.

```bash
rtk git add apps/server/src/services/liff-runtime-token.ts apps/server/src/services/liff-runtime-token.test.ts apps/server/src/plugins/liff-public.ts apps/server/src/plugins/liff-public.test.ts apps/server/src/index.ts docs/envs.md
rtk git commit -m "feat(liff): add profile and launch context endpoints"
```

## Task 4: Add Permanent-Link Route Resolution

- [ ] Write failing resolver tests in `apps/web/src/test/unit/features/liff/resolveLiffPermanentUrl.test.ts`.

Test cases:

```ts
describe('resolveLiffPermanentUrl', () => {
  it('preserves the endpoint URL for bare /liff/{liffId}')
  it('appends path to an endpoint with no base path')
  it('appends path to an endpoint with an existing base path')
  it('preserves query and hash')
  it('does not duplicate slashes between base path and permanent path')
})
```

Command:

```bash
rtk bun run --cwd apps/web test:unit -- src/test/unit/features/liff/resolveLiffPermanentUrl.test.ts
```

Expected red result: resolver does not exist.

- [ ] Implement `apps/web/src/features/liff/resolveLiffPermanentUrl.ts`.

Required exported API:

```ts
export function resolveLiffPermanentUrl(input: {
  endpointUrl: string
  permanentPath?: string
  search?: string
  hash?: string
}): string
```

Rules:

- Empty `permanentPath`, `/`, or undefined returns `endpointUrl` plus incoming search/hash only when those were part of the LIFF permanent URL.
- A path like `/foo` appends to endpoint base path.
- Query and hash are preserved exactly once.
- The resolver accepts `hash` from the browser client (`window.location.hash`) because URL fragments are not sent to server loaders.
- Use `URL`; do not concatenate URL strings by hand except for normalized path joining.

- [ ] Update One route files.

Changes:

- Keep `apps/web/app/(app)/liff/[liffId].tsx` as the bare-route entry.
- Add `apps/web/app/(app)/liff/[...liffPath].tsx` for permanent-link-style paths.
- Move shared loading/rendering into a local helper inside one of the route files or into `apps/web/src/features/liff/liffRuntime.tsx` if duplication would exceed a small wrapper.
- The catch-all route extracts the first path segment as `liffId`; the remaining segments become `permanentPath`.
- Use `resolveLiffPermanentUrl` before passing `endpointUrl` to `LiffBrowser`.
- On web, read `window.location.hash` after mount and pass it as the permanent-link hash; do not use the hash for runtime bootstrap.

- [ ] Run focused route/resolver tests.

Command:

```bash
rtk bun run --cwd apps/web test:unit -- src/test/unit/features/liff/resolveLiffPermanentUrl.test.ts
```

Expected green result: permanent-link URL resolution tests pass.

- [ ] Commit this slice.

```bash
rtk git add apps/web/src/features/liff/resolveLiffPermanentUrl.ts apps/web/src/test/unit/features/liff/resolveLiffPermanentUrl.test.ts "apps/web/app/(app)/liff/[liffId].tsx" "apps/web/app/(app)/liff/[...liffPath].tsx"
rtk git commit -m "feat(liff): resolve permanent link paths"
```

## Task 5: Add LiffBrowser Runtime Host Handling

- [ ] Write failing runtime tests in `apps/web/src/test/unit/features/liff/liffRuntime.test.ts`.

Test cases:

```ts
describe('LIFF runtime host helpers', () => {
  it('builds web iframe src without runtime bootstrap in the URL fragment')
  it('returns bootstrap payload for valid liff:bootstrap requests')
  it('computes endpoint origin from endpointUrl')
  it('accepts host events from the endpoint origin')
  it('ignores host events from a different origin')
  it('rejects sendMessages without chat context')
  it('rejects sendMessages without chat_message.write scope')
})
```

Command:

```bash
rtk bun run --cwd apps/web test:unit -- src/test/unit/features/liff/liffRuntime.test.ts
```

Expected red result: runtime helper file does not exist.

- [ ] Implement `apps/web/src/features/liff/liffRuntime.ts`.

Required exports:

```ts
export type LiffRuntimeContext = {
  apiBaseUrl: string
  liffId: string
  endpointUrl: string
  endpointOrigin: string
  accessToken?: string
  chatId?: string
  contextType: 'utou' | 'group' | 'external'
  scopes: string[]
  lineVersion: string
}

export function createLiffIframeSrc(context: LiffRuntimeContext): string
export function createLiffBootstrap(context: LiffRuntimeContext): {
  apiBaseUrl: string
  liffId: string
  endpointOrigin: string
  accessToken?: string
  chatId?: string
  contextType: 'utou' | 'group' | 'external'
  scopes: string[]
  lineVersion: string
}
export function getEndpointOrigin(endpointUrl: string): string
export function isAllowedLiffMessageOrigin(eventOrigin: string, endpointOrigin: string): boolean
export function canSendMessages(context: LiffRuntimeContext): { ok: true } | { ok: false; error: string }
```

Implementation details:

- `createLiffIframeSrc` preserves the endpoint's existing URL exactly except for permanent-link path/query/hash resolution done before this helper.
- Do not put `accessToken`, `chatId`, or runtime bootstrap JSON in the iframe URL.
- `createLiffBootstrap` returns the payload sent only through `postMessage` or native injected JavaScript.
- `canSendMessages` requires `chatId` and `chat_message.write`.

- [ ] Add server-enforced LIFF message mutation coverage in `packages/zero-schema/src/models/message.liff.test.ts`.

Test cases:

```ts
describe('message.sendLiff', () => {
  it('rejects unauthenticated callers')
  it('rejects user sender spoofing')
  it('rejects sends into chats where the caller is not a member')
  it('allows non-sticker LIFF messages for a chat member')
  it('allows public/system sticker packages without entitlement')
  it('requires entitlement for Vine marketplace sticker packages')
  it('updates the chat last-message pointer')
})
```

Command:

```bash
rtk bunx vitest run packages/zero-schema/src/models/message.liff.test.ts
```

Expected red result: tests fail because `sendLiff` does not exist.

- [ ] Update `packages/zero-schema/src/models/message.ts`.

Add a custom mutation:

```ts
sendLiff: async ({ authData, tx }, message: Message) => {
  // validate authData, senderId, chat membership, and sticker entitlement/system package policy
}
```

Rules:

- Require `authData`.
- Require `message.senderType === 'user'` and `message.senderId === authData.id`.
- Verify `authData.id` is an accepted member of `message.chatId` through `tx.query.chatMember`.
- For sticker messages:
  - parse `metadata.packageId` and `metadata.stickerId`.
  - allow public/system packages by a documented predicate in this file.
  - require `tx.query.entitlement` ownership for Vine marketplace packages.
- Insert the message and update `chat.lastMessageId` / `chat.lastMessageAt`, matching existing `send` behavior.

- [ ] Regenerate Zero artifacts after adding `sendLiff`.

Command:

```bash
rtk bun --filter @vine/zero-schema zero:generate
```

Expected result: generated Zero mutation metadata includes `message.sendLiff`.

- [ ] Run focused Zero mutation tests.

Command:

```bash
rtk bunx vitest run packages/zero-schema/src/models/message.liff.test.ts
```

Expected green result: `sendLiff` enforces membership and sticker entitlement.

- [ ] Update `apps/web/src/interface/liff/LiffBrowser.tsx`.

Required behavior:

- Props include `apiBaseUrl`, `endpointOrigin`, `chatId`, `contextType`, `scopes`, and an optional `onSendMessages`.
- Use `createLiffIframeSrc()` instead of manual `#access_token` construction.
- In `message` event listener:
  - Ignore `liff:*` events when `event.origin !== endpointOrigin`.
  - Handle `liff:bootstrap` by replying with `{ type: 'liff:bootstrap:done', requestId, bootstrap }` and `targetOrigin: endpointOrigin`.
  - Handle `liff:closeWindow`.
  - Handle `liff:shareTargetPicker`.
  - Handle `liff:sendMessages`.
- For `liff:sendMessages`:
  - Run `canSendMessages`.
  - Run `validateAndConvertLiffMessages({ method: 'sendMessages', messages })`.
  - Send converted messages using `zero.mutate.message.sendLiff` so membership and sticker entitlement checks run on the Zero server mutation path.
  - Generate caller-side message IDs and `createdAt` timestamps.
  - Post acknowledgement to the child frame with `targetOrigin: endpointOrigin`.

Acknowledgement messages:

```ts
{ type: 'liff:sendMessages:done', requestId }
{ type: 'liff:sendMessages:error', requestId, error: { code, message } }
```

- [ ] Update `apps/web/src/interface/liff/LiffBrowser.native.tsx`.

Required behavior:

- Inject `window.VineLIFF` with the same runtime context.
- Handle `liff:sendMessages` from the WebView message bridge.
- Apply the same logical origin check by comparing the WebView URL origin with `endpointOrigin`.
- Use the same validation helper and `zero.mutate.message.sendLiff` path as web where possible.

- [ ] Run focused unit tests until green.

Command:

```bash
rtk bun run --cwd apps/web test:unit -- src/test/unit/features/liff/liffRuntime.test.ts src/test/unit/features/liff/liffMessage.test.ts
```

Expected green result: runtime helper and validator tests pass.

- [ ] Commit this slice.

```bash
rtk git add apps/web/src/features/liff/liffRuntime.ts apps/web/src/test/unit/features/liff/liffRuntime.test.ts apps/web/src/interface/liff/LiffBrowser.tsx apps/web/src/interface/liff/LiffBrowser.native.tsx packages/zero-schema/src/models/message.ts packages/zero-schema/src/models/message.liff.test.ts packages/zero-schema/src/generated
rtk git commit -m "feat(liff): handle host mediated messages"
```

## Task 6: Wire Launch Context Into LIFF Routes

- [ ] Add route-level tests or extend `liffRuntime.test.ts`.

Test cases:

```ts
describe('buildLiffRuntimeContext', () => {
  it('uses external context without a launch token')
  it('uses launch context when the server resolves a valid token')
  it('falls back to external context for invalid launch token responses')
})
```

Command:

```bash
rtk bun run --cwd apps/web test:unit -- src/test/unit/features/liff/liffRuntime.test.ts
```

Expected red result: route context builder is missing.

- [ ] Update `apps/web/src/features/liff/liffRuntime.ts`.

Add:

```ts
export async function resolveLiffLaunchContext(input: {
  apiBaseUrl: string
  liffId: string
  launchToken?: string | null
}): Promise<{ chatId?: string; contextType: 'utou' | 'group' | 'external' }>

export async function createLiffAccessToken(input: {
  apiBaseUrl: string
  liffId: string
}): Promise<string | undefined>
```

`resolveLiffLaunchContext` calls a server runtime endpoint only when `launchToken` is present. It returns external context on missing, invalid, expired, or mismatched token responses.

`createLiffAccessToken` calls `POST /liff/v1/access-token` with the current Vine session and returns a short-lived token for SDK `getProfile()` and `getFriendship()` calls. If token creation fails, route rendering continues with no access token and profile APIs reject normally inside the SDK.

- [ ] Update `apps/server/src/plugins/liff-public.ts`.

Add a read endpoint used by the web route:

```http
GET /liff/v1/launch-context?liffId=...&launchToken=...
```

Response:

```json
{ "chatId": "chat-id", "contextType": "utou" }
```

Errors:

- `400` for missing query fields.
- `401` for no Vine session.
- `403` for token/user mismatch or non-member chat.
- `404` for unknown LIFF app.

The endpoint revalidates the current session user and chat membership after resolving the token.

- [ ] Update `/liff` route files.

Required behavior:

- Read `launchToken` from query string.
- Resolve LIFF app metadata with `/liff/v1/apps/:liffId`.
- Mint a LIFF access token with `createLiffAccessToken`.
- Resolve launch context with `resolveLiffLaunchContext`.
- Pass `accessToken`, `chatId`, `contextType`, `scopes`, `apiBaseUrl`, and `endpointOrigin` to `LiffBrowser`.
- Developer preview and copied LIFF URLs have `contextType: 'external'`.

- [ ] Run focused route/server tests.

Commands:

```bash
rtk bun run --cwd apps/web test:unit -- src/test/unit/features/liff/liffRuntime.test.ts
rtk bun run --cwd apps/server test:unit -- src/plugins/liff-public.test.ts src/services/liff-runtime-token.test.ts
```

Expected green result: launch context tests pass.

- [ ] Commit this slice.

```bash
rtk git add apps/web/src/features/liff/liffRuntime.ts apps/web/src/test/unit/features/liff/liffRuntime.test.ts "apps/web/app/(app)/liff/[liffId].tsx" "apps/web/app/(app)/liff/[...liffPath].tsx" apps/server/src/plugins/liff-public.ts apps/server/src/plugins/liff-public.test.ts
rtk git commit -m "feat(liff): wire chat launch context"
```

## Task 7: Upgrade ShareTargetPicker To Share All Supported LIFF Message Types

- [ ] Write failing tests for `ShareTargetPicker`.

Add focused tests in:

```text
apps/web/src/test/unit/features/liff/ShareTargetPicker.test.tsx
```

Test cases:

```ts
describe('ShareTargetPicker LIFF messages', () => {
  it('sends converted text, image, video, audio, location, and flex messages')
  it('rejects sticker messages before showing target send success')
  it('returns false on cancel without sending messages')
})
```

Command:

```bash
rtk bun run --cwd apps/web test:unit -- src/test/unit/features/liff/ShareTargetPicker.test.tsx
```

Expected red result: tests fail because the picker accepts only text-shaped messages.

- [ ] Update `apps/web/src/features/liff/ShareTargetPicker.tsx`.

Required changes:

- Replace the local text-only message type with `ConvertedLiffMessage[]`.
- Validate incoming raw LIFF messages with:

```ts
validateAndConvertLiffMessages({ method: 'shareTargetPicker', messages })
```

- For every selected target, insert each converted message through `zero.mutate.message.sendLiff`.
- For friend targets, resolve the actual direct chat ID before sending:
  - If `useShareTargets()` already exposes a `chatId`, use it.
  - Otherwise create the direct chat, then re-query or use a helper that returns the existing-or-created chat ID before sending messages.
  - Do not send to a generated fallback chat ID unless that exact chat row was inserted.
- Use caller-generated IDs and timestamps for each message mutation.
- Continue returning `{ status: 'sent' }` after all selected target sends complete.
- Continue returning `false` on cancel.

- [ ] Update `LiffBrowser` shareTargetPicker handling.

The browser/native host should validate origin before opening the picker and should send picker results back with `targetOrigin: endpointOrigin` on web.

- [ ] Run focused tests until green.

Command:

```bash
rtk bun run --cwd apps/web test:unit -- src/test/unit/features/liff/ShareTargetPicker.test.tsx src/test/unit/features/liff/liffMessage.test.ts
```

Expected green result: share picker can convert and send all supported LIFF share messages.

- [ ] Commit this slice.

```bash
rtk git add apps/web/src/features/liff/ShareTargetPicker.tsx apps/web/src/test/unit/features/liff/ShareTargetPicker.test.tsx apps/web/src/interface/liff/LiffBrowser.tsx apps/web/src/interface/liff/LiffBrowser.native.tsx
rtk git commit -m "feat(liff): share supported message types"
```

## Task 8: Add Developer Console LIFF URL And Preview Actions

- [ ] Write or update a focused UI test if there is already developer console test coverage for this screen.

If no suitable test harness exists, verify with a Playwright smoke assertion in the existing LIFF integration spec after the UI change.

- [ ] Update `apps/web/app/(app)/developers/console/login-channel/[loginChannelId]/liff.tsx`.

Required UI:

- Display the Vine LIFF URL for each app:

```text
{origin}/liff/{liffId}
```

- Display the permanent-link base URL, same value as the LIFF URL.
- Add copy actions for both URL fields using existing button/icon conventions in this file.
- Add an Open or Preview action that opens `/liff/{liffId}` in a new tab or navigates through the app router, matching nearby console patterns.
- Keep create/delete behavior unchanged.

- [ ] Run focused web check.

Command:

```bash
rtk bun run --cwd apps/web check
```

Expected green result: web typecheck/lint for the console screen passes.

- [ ] Commit this slice.

```bash
rtk git add "apps/web/app/(app)/developers/console/login-channel/[loginChannelId]/liff.tsx"
rtk git commit -m "feat(liff): show runtime urls in console"
```

## Task 9: Expand LIFF Fixture And Integration Coverage

- [ ] Update `packages/liff-fixtures/src/mock-share-target-picker.ts`.

Fixture requirements:

- Buttons and visible result fields for:
  - `liff.init()`
  - `liff.getContext()`
  - `liff.getProfile()`
  - `liff.sendMessages()` valid set
  - `liff.sendMessages()` invalid set
  - `liff.shareTargetPicker()` valid set
  - `liff.shareTargetPicker()` invalid set
  - `liff.closeWindow()`
- Valid send set includes text, image, video, audio, location, sticker, and flex URI action.
- Valid share set includes text, image, video, audio, location, and flex URI action.
- Invalid cases cover too many messages, template, imagemap, and non-URI flex action.
- Use deterministic `data-testid` values for every button/result so Playwright does not depend on visible copy.

- [ ] Rebuild fixture package.

Command:

```bash
rtk bun run --cwd packages/liff-fixtures build
```

Expected output: build writes `dist/mock-share-target-picker.js` and copies `dist/mock-share-target-picker.html`.

- [ ] Expand `apps/web/src/test/integration/liff-share-target-picker.test.ts`.

Add integration tests:

- Third-party fixture initializes from an external-style endpoint config and uses Vine API base URL.
- `getContext()` returns `external` for preview launch.
- `getProfile()` returns the current demo user's profile.
- `shareTargetPicker()` accepts supported share messages and rejects invalid ones.
- `sendMessages()` rejects in external context with a stable permission error.
- Chat-launch test path mints a launch token, opens `/liff/{liffId}?launchToken=...`, and verifies supported `sendMessages()` inserts into the source chat.
- `closeWindow()` only closes when posted from the endpoint origin.
- Host ignores spoofed `liff:*` postMessages from a non-endpoint origin.
- Permanent link `/liff/{liffId}/foo?x=1#bar` opens the fixture endpoint with `/foo?x=1#bar`.

- [ ] Run the LIFF integration spec.

Command:

```bash
rtk bun scripts/integration.ts integration/liff-share-target-picker.test.ts
```

Expected green result: the canonical integration runner starts a clean stack and the LIFF integration spec passes.

- [ ] Commit this slice.

```bash
rtk git add packages/liff-fixtures/src/mock-share-target-picker.ts packages/liff-fixtures/dist apps/web/src/test/integration/liff-share-target-picker.test.ts
rtk git commit -m "test(liff): cover completed runtime APIs"
```

## Task 10: Full Verification And Regression Check

- [ ] Run server unit tests touched by this work.

```bash
rtk bun run --cwd apps/server test:unit -- src/services/liff-runtime-token.test.ts src/plugins/liff-public.test.ts src/services/liff.test.ts
```

Expected result: server LIFF tests pass.

- [ ] Run web LIFF unit tests.

```bash
rtk bun run --cwd apps/web test:unit -- src/test/unit/features/liff/liffMessage.test.ts src/test/unit/features/liff/liffRuntime.test.ts src/test/unit/features/liff/resolveLiffPermanentUrl.test.ts src/test/unit/features/liff/ShareTargetPicker.test.tsx src/test/unit/features/liff/liffSdk.test.ts
```

Expected result: web LIFF unit tests pass.

- [ ] Run Zero LIFF mutation tests.

```bash
rtk bunx vitest run packages/zero-schema/src/models/message.liff.test.ts
```

Expected result: `message.sendLiff` membership and sticker entitlement tests pass.

- [ ] Run LIFF integration tests.

```bash
rtk bun scripts/integration.ts integration/liff-share-target-picker.test.ts
```

Expected result: LIFF integration spec passes.

- [ ] Run package checks.

```bash
rtk bun run --cwd apps/web check
rtk bun run --cwd apps/server check
rtk bun run build
```

Expected result: checks and build pass.

- [ ] Run repository diff checks.

```bash
rtk git diff --check
rtk git status --short
```

Expected result: no whitespace errors; status shows only the intended implementation commits or a clean working tree after final commit.

- [ ] Final commit if previous tasks were batched without commits.

```bash
rtk git add packages/liff apps/server/src apps/web/src apps/web/app packages/liff-fixtures docs/superpowers/plans/2026-05-03-m4-liff-completion.md
rtk git commit -m "feat(liff): complete m4 runtime"
```

## Acceptance Checklist

- [ ] `/liff/{liffId}` opens the registered LIFF app.
- [ ] `/liff/{liffId}/path?query#hash` opens the registered LIFF app with the path, query, and hash appended to the app endpoint URL.
- [ ] A third-party LIFF app can call Vine runtime APIs through bootstrap `apiBaseUrl`.
- [ ] `liff.getProfile()` returns `{ userId, displayName, pictureUrl, statusMessage }` for the current Vine user.
- [ ] `liff.getContext()` returns `external` without launch context.
- [ ] `liff.getContext()` returns `utou` or `group` with a valid chat launch token.
- [ ] `liff.sendMessages()` rejects external launches with a stable permission error.
- [ ] `liff.sendMessages()` sends text, sticker, image, video, audio, location, and flex URI messages to the source chat in chat launches.
- [ ] `liff.shareTargetPicker()` sends text, image, video, audio, location, and flex URI messages to selected targets.
- [ ] Template and imagemap are explicitly rejected by LIFF send/share APIs.
- [ ] Stickers are rejected by `shareTargetPicker`.
- [ ] Flex non-URI actions are rejected only for LIFF validation.
- [ ] Host ignores `liff:*` postMessages from origins other than the configured endpoint origin.
- [ ] `closeWindow` is origin-validated on web and native.
- [ ] Existing OA Messaging API behavior and validators remain unchanged.
- [ ] Tests pass without official LINE cloud APIs.
