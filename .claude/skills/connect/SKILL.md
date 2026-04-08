---
name: connect
description: |
  ConnectRPC (connect-es v2) workflow for this turborepo. Use when working with:
  - Adding a new ConnectRPC service (from proto definition to implementation)
  - Implementing service handlers (server-side), including Better Auth on handlers
  - Creating clients to call ConnectRPC services (web/client-side)
  - Proto file definitions and code generation
  - @connectrpc/connect, @connectrpc/connect-web, @connectrpc/connect-node
  - The turbo task `proto:generate` for generating TypeScript from .proto files
  - Server auth: withAuthService, requireAuthData, connectTransport + Bearer
  Trigger whenever user mentions "connectrpc", "connect", "proto", "service", "withAuth", or wants to add a new RPC endpoint.
---

# ConnectRPC Workflow

## Overview

ConnectRPC workflow in this repo:

```
1. Define proto     →  2. Generate code     →  3. Implement server  →  4. Use client
packages/proto/proto/   bun turbo proto:generate   apps/server/src/connect/   apps/web (connectTransport)
```

## Key File Locations

### Proto Definition & Generation

| Purpose             | Path                                              |
| ------------------- | ------------------------------------------------- |
| Proto definitions   | `packages/proto/proto/<service>/<version>/<name>.proto` |
| Generated TS code     | `packages/proto/gen/<service>/<version>/`       |
| Generate command    | `bun turbo proto:generate`                       |
| Generation config   | `packages/proto/buf.gen.yaml`                    |

### Server Implementation

| Purpose              | Path                                   |
| -------------------- | -------------------------------------- |
| Service handlers     | `apps/server/src/connect/<service>.ts` |
| Route registration   | `apps/server/src/connect/routes.ts`    |
| Better Auth helpers  | `apps/server/src/connect/auth-context.ts` |
| Server entry         | `apps/server/src/index.ts`             |

### Client (Web)

| Purpose           | Path                                                 |
| ----------------- | ---------------------------------------------------- |
| Transport + Bearer | `apps/web/src/features/auth/client/connectTransport.ts` |
| Client usage      | `createClient` from `@connectrpc/connect` + service from `@vine/proto/...` + `connectTransport` (see `apps/web/src/features/oa/client.ts`) |

## Authentication

Server handlers resolve the logged-in user via **Better Auth** (`AuthServer` from `createAuthServer` in `apps/server/src/plugins/auth`). Connect requests carry the session the same way as HTTP: **`Authorization: Bearer <token>`** (opaque session token from Better Auth by default; JWT if `useJWT` is enabled on the client).

### Web client: always use `connectTransport`

Use the shared transport so the underlying **`fetch` is a real `Response`** (Connect validates headers). Do **not** plug in `@better-fetch/fetch`’s `createFetch` here — it returns `{ data, error }`, which breaks Connect.

`connectTransport` merges **`Authorization: Bearer`** from `authState` (see comments in `connectTransport.ts` for session token vs JWT).

### Server: `auth-context.ts`

| Export / symbol            | Role |
| -------------------------- | ---- |
| `connectAuthDataKey`       | `ContextValues` key where `AuthData` is stored for the RPC |
| `ensureAuthInContext(auth, ctx)` | Build a `Request` from `ctx.url` / `ctx.requestMethod` / `ctx.requestHeader` / `ctx.signal`, call `getAuthDataFromRequest`, then `ctx.values.set(connectAuthDataKey, …)`. Throws `ConnectError` `Unauthenticated` if no session. |
| `requireAuthData(ctx)`     | Read `AuthData` from `connectAuthDataKey`; throws if missing (e.g. handler ran without auth). |
| `withAuth(auth, impl)`     | Wrap a **single unary** handler: `ensureAuthInContext` then `impl(req, ctx)`. |
| `withAuthService(service, auth, impl)` | Wrap an entire **`ServiceImpl`**: for each method, uses the protobuf **`DescMethod.methodKind`** (`unary`, `server_streaming`, `client_streaming`, `bidi_streaming`) so auth runs **once** before the handler (streaming: before the async iterable runs). Requires the **service descriptor** (e.g. `OAService` from codegen). |

### Wiring `auth` into Connect

1. **`index.ts`**: build `auth = createAuthServer(…)` and pass it into Connect: `connectRoutes({ …, auth })`.
2. **`routes.ts`**: extend `ConnectDeps` with `auth: AuthServer` and pass `deps` into handlers that need it (e.g. `oaHandler(deps)`).
3. **Handler module** (see `apps/server/src/connect/oa.ts`):
   - Implement `const impl: ServiceImpl<typeof YourService> = { … }` (plain handlers; inside each method use `requireAuthData(ctx)` for `auth.id`, etc.).
   - Register: `router.service(YourService, withAuthService(YourService, deps.auth, impl))`.

**Public (unauthenticated) RPCs:** `withAuthService` applies auth to **every** method on that object. If you need a mix of public and private RPCs, split services in `.proto`, register two `router.service` blocks, or wrap only the methods that need auth with `withAuth` / manual `ensureAuthInContext` instead of whole-service `withAuthService`.

## Workflow: Adding a New Service

### Step 1: Create Proto Definition

Create `packages/proto/proto/<service>/<version>/<name>.proto`:

```protobuf
syntax = "proto3";

package <service>.<version>;

import "google/protobuf/timestamp.proto";

message <Request> {
  string name = 1;
}

message <Response> {
  string message = 1;
  google.protobuf.Timestamp created_at = 2;
}

service <Service>Service {
  rpc <Method>(<Request>) returns (<Response>);
}
```

### Step 2: Generate Code

```bash
bun turbo proto:generate
```

This generates in `packages/proto/gen/`:

- `<name>_pb.ts` — Message types and service descriptors (Buf protobuf ES v2)

### Step 3: Implement Server Handler

- Import the generated **service descriptor** (e.g. `YourService`) and types from `@vine/proto` / `packages/proto/gen/…`.
- Export a function `(deps) => (router: ConnectRouter) => void` that calls `router.service(…)`.
- For **authenticated** services: pass `auth: AuthServer` in `deps`, build `ServiceImpl<typeof YourService>`, then `withAuthService(YourService, deps.auth, impl)`.

Greeter (no auth): `apps/server/src/connect/greeter.ts`.  
OA (auth + `withAuthService`): `apps/server/src/connect/oa.ts`.

Register in `apps/server/src/connect/routes.ts` (and pass `auth` from `index.ts` when needed).

### Step 4: Use Client (Web)

Use **`connectTransport`** from `~/features/auth/client/connectTransport` with `createClient(Service, connectTransport)` — see `apps/web/src/features/oa/client.ts`. Do not use raw `fetch` for Connect (see AGENTS.md data-fetching rules).

## Proto Package Exports

`packages/proto/package.json` exports:

```json
{
  ".": "./gen/greeter/v1/greeter_pb.ts",
  "./greeter": "./gen/greeter/v1/greeter_pb.ts"
}
```

For a new service `<service>`, add export:

```json
"./<service>": "./gen/<service>/<version>/<name>_pb.ts"
```

## Protocol Support

The `ConnectRouter` automatically supports three protocols:

- **Connect** — Primary protocol, JSON or binary
- **gRPC** — Binary format only
- **gRPC-Web** — For browser clients

## Reference Files

- Greeter (minimal): `apps/server/src/connect/greeter.ts`
- OA + `withAuthService`: `apps/server/src/connect/oa.ts`
- Auth helpers: `apps/server/src/connect/auth-context.ts`
- Routes: `apps/server/src/connect/routes.ts`
- Web transport: `apps/web/src/features/auth/client/connectTransport.ts`
- Proto definition: `packages/proto/proto/greeter/v1/greeter.proto`
