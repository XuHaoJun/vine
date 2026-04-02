# OAuth 2.0 Authorization Server — Design Spec

**Date:** 2026-04-02
**Scope:** Implement LINE-compatible OAuth 2.0 Authorization Server using `@better-auth/oauth-provider`. This makes Vine act as an identity provider so third-party apps can integrate "Log in with Vine/LINE" OAuth — mirroring what real LINE does.

---

## Overview

Vine is a LINE clone. Real LINE exposes an OAuth 2.0 Authorization Server at `/oauth2/v2.1/authorize`, `/oauth2/v2.1/token`, and `/oauth2/v2.1/userinfo`. We replicate these exact paths so third-party apps can use LINE Login SDK patterns against our server. Authentication stays Better Auth email/password — no external OAuth providers.

**Implementation order:** A) OAuth Server (this spec) → B) Developer Console → C) LINE API endpoints

---

## Files Changed

| File | Action | Responsibility |
|------|--------|----------------|
| `apps/server/src/plugins/auth.ts` | Modify | Add `oauthProvider` plugin + LINE path alias routes |
| `packages/db/src/migrations/YYYYMMDDHHMMSS_oauth_provider.ts` | Create | Drizzle migration for OAuth tables |
| `apps/web/app/(app)/auth/consent.tsx` | Create | Consent page UI |

---

## Section 1: Server Architecture

### Better Auth Plugin

Add `oauthProvider` to the existing `plugins` array in `createAuthServer()`:

```ts
import { oauthProvider } from '@better-auth/oauth-provider'

plugins: [
  jwt({ ... }),
  bearer(),
  expo(),
  magicLink({ ... }),
  admin(),
  oauthProvider({
    loginPage: '/auth/login',
    consentPage: '/auth/consent',
  }),
]
```

This auto-exposes:
- `GET  /api/auth/oauth2/authorize` — validate client, redirect to consent page
- `POST /api/auth/oauth2/authorize` — submit consent decision, issue auth code
- `POST /api/auth/oauth2/token` — exchange code for access token (PKCE required)
- `GET  /api/auth/oauth2/userinfo` — return user profile for valid Bearer token

### LINE Path Aliases

Add routes inside `authPlugin()` that inline-proxy to Better Auth's handler (same pattern as existing `/api/auth/*` catch-all — no HTTP redirect, POST bodies preserved):

```
GET  /oauth2/v2.1/authorize  →  /api/auth/oauth2/authorize
POST /oauth2/v2.1/authorize  →  /api/auth/oauth2/authorize
POST /oauth2/v2.1/token      →  /api/auth/oauth2/token
GET  /oauth2/v2.1/userinfo   →  /api/auth/oauth2/userinfo
```

Each alias calls `deps.auth.handler(toWebRequest(...))` directly — not a redirect.

### DB Migration

`@better-auth/oauth-provider` requires three new tables (generated via `auth.api.generateSchema()`):

| Table | Purpose |
|-------|---------|
| `oauthApplication` | Registered clients — `client_id`, `client_secret`, `redirect_uris`, `scopes`, `name`, `icon` |
| `oauthAccessToken` | Issued access tokens with expiry and scope |
| `oauthConsent` | Per-user consent records (skip consent page for returning users) |

Migration file added to `packages/db/src/migrations/` as a Drizzle migration.

---

## Section 2: Consent Page UI

**Route:** `apps/web/app/(app)/auth/consent.tsx`

Auth guard: the `(app)` layout already redirects unauthenticated users to `/auth/login`. The login page must preserve the `?redirect=` param so users land back on the consent page after authenticating.

### Visual Design

Based on real LINE consent screen:

```
┌─────────────────────────────┐
│   [App icon — dark circle]  │  ← client icon URL, fallback to generic icon
│      Sample Login App       │  ← client name from oauthApplication
│   Provider: Vine            │  ← always "Vine"
│  App description text       │  ← client description
│                             │
│  Grant the following        │
│  permissions to this        │
│  service.                   │
│                             │
│  Main profile info          │
│  (Required)          [ON●]  │  ← green toggle, non-interactive (always on)
│                             │
│  Your internal identifier   │
│  (Required)          [ON●]  │
│                             │
│  [      Allow       ]       │  ← full-width #06C755 green button
│        Cancel               │  ← plain text, no border
└─────────────────────────────┘
```

### Scope Display Labels

| Scope | Display name |
|-------|-------------|
| `profile` | Main profile info (Required) |
| `openid` | Your internal identifier (Required) |

### Data Flow

1. Page reads query params: `client_id`, `scope`, `redirect_uri`, `state`, `code_challenge`, `code_challenge_method`
2. Fetches client info (name, icon, description) from `/api/auth/oauth2/get-consent-url`
3. **Allow** → `POST /api/auth/oauth2/authorize` `{ accept: true, ...oauth_params }` → Better Auth redirects to `redirect_uri?code=...&state=...`
4. **Cancel** → `POST /api/auth/oauth2/authorize` `{ accept: false, ...oauth_params }` → Better Auth redirects to `redirect_uri?error=access_denied&state=...`

Form uses `react-hook-form` + `handleSubmit` for the Allow/Cancel buttons (isSubmitting state disables both buttons during POST).

---

## Section 3: Flow & Error Handling

### Full Authorization Code Flow (PKCE)

```
Client
  → GET /oauth2/v2.1/authorize
      ?client_id=<id>
      &redirect_uri=<uri>
      &scope=profile openid
      &response_type=code
      &code_challenge=<S256 hash>
      &code_challenge_method=S256
      &state=<random>

Server (LINE alias → Better Auth)
  → Validates client_id, redirect_uri, scopes
  → Redirects to /auth/consent?<all oauth params forwarded>

User sees consent page, clicks Allow
  → POST /api/auth/oauth2/authorize { accept: true, client_id, scope, state, ... }
  → Better Auth issues auth code
  → Redirects to redirect_uri?code=<auth_code>&state=<state>

Client
  → POST /oauth2/v2.1/token
      { code, code_verifier, client_id, client_secret,
        redirect_uri, grant_type=authorization_code }
  → Returns { access_token, token_type: "Bearer", expires_in, scope }

Client
  → GET /oauth2/v2.1/userinfo
      Authorization: Bearer <access_token>
  → Returns { sub, name, picture }
```

### Error Handling

| Scenario | Behavior |
|----------|---------|
| User not logged in | `(app)` layout redirects to `/auth/login` — existing guard handles this |
| User clicks Cancel | POST `accept: false` → Better Auth → `redirect_uri?error=access_denied&state=...` |
| Invalid `client_id` | Better Auth returns 400 before consent page is reached |
| Invalid `redirect_uri` | Better Auth returns 400 — never redirects to untrusted URIs |
| Expired/replayed auth code | Better Auth returns 400 on token exchange |
| Invalid PKCE verifier | Better Auth returns 400 on token exchange |

---

## What's Not Included

- Developer Console UI for registering OAuth clients (subsystem B — separate spec)
- Seeding the first client — manual DB insert documented in the implementation plan
- Refresh token rotation endpoint
- Token revocation endpoint
- `bot_prompt` parameter (add-as-friend flow — future)

---

## Success Criteria

- `GET /oauth2/v2.1/authorize` with valid params shows consent page
- Clicking Allow redirects client app to `redirect_uri?code=...`
- Clicking Cancel redirects to `redirect_uri?error=access_denied`
- `POST /oauth2/v2.1/token` with valid code + PKCE verifier returns access token
- `GET /oauth2/v2.1/userinfo` with valid Bearer token returns `{ sub, name, picture }`
- Unauthenticated user hitting consent page → redirected to login → back to consent after login
