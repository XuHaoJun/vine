# Vine Agents Guide

## Essential Commands

```bash
bun install                    # Install dependencies
bun dev                        # Start all apps (turbo dev)
bun build                      # Build all packages
bun lint                       # Lint all packages (oxlint)
bun format                     # Format all files (oxfmt)
bun test                       # Run all tests
bun check                      # Type check + lint (tko check)
```

### Running Single Tests

```bash
# Unit tests (vitest)
bun --cwd apps/web run test:unit

# Integration tests (playwright)
bun --cwd apps/web run test:integration

# Specific test file
bun --cwd apps/web run test:unit -- path/to/test.test.ts

# Watch mode
bun --cwd apps/web run test:unit -- --watch
```

### Zero Schema Workflow

```bash
bun --cwd packages/zero-schema run zero:generate  # Generate types after schema changes
```

---

## Data Fetching Rules

**NEVER use raw `fetch()` for server data.** Always use:

1. **Zero** (`useZeroQuery` / `zero.mutate`) — for entities in zero-schema (real-time sync, offline support)
2. **React Query** (`useTanQuery` / `useTanMutation`) — for external APIs, file uploads, analytics
3. **ConnectRPC** — for ConnectRPC service calls:
   - **Unary RPC** (request-response): use `@connectrpc/connect-query` (`useConnectQuery` / `useConnectMutation`) for caching and React Query integration
   - **Streaming RPC** (server/client/bi-directional): use raw `@connectrpc/connect` / `@connectrpc/connect-web` directly for stream lifecycle control (`onMessage`, `onError`, `onComplete`)

Raw `fetch()` bypasses caching, loading states, error handling, and sync.

---

## Code Style

- **Formatter**: oxfmt (2 spaces, no semicolons, single quotes, trailing commas)
- **Linter**: oxlint with react, import, typescript plugins
- **Imports**: Sorted by type (external → internal → sibling → types → style)
- **No direct tamagui imports**: Use `~/interface/*` components instead (Button, Input, Text, etc.)
- **File naming**: `.native.ts` / `.native.tsx` for platform-specific code

---

## Architecture

- **Monorepo**: turborepo + bun workspaces
- **Web/Native**: One (vxrn) framework with cross-platform support
- **UI**: Tamagui 2.0 with custom components in `~/interface/`
- **Data**: Zero for sync, Drizzle for DB schema
- **Auth**: better-auth
- **RPC**: ConnectRPC (protobuf)

---

## Project Structure

```
apps/web/          ← One app (web + native)
apps/server/       ← Fastify + ConnectRPC server
packages/zero-schema/  ← Zero models, queries, mutations
packages/db/       ← Drizzle database schema
packages/proto/    ← Protobuf definitions
```

---

## Key Conventions

- Import from `@vine/zero-schema/queries/*` for Zero queries
- Import from `~/interface/*` for UI components (never raw tamagui)
- Zero mutations require caller-generated IDs and timestamps (convergence rule)
- Use `useAuth()` (JWT) not `useUser()` (DB query) to avoid waterfalls
- Relationships go in `packages/zero-schema/src/relationships.ts`

---

## Code Style Details

### Naming Conventions

- **Components**: PascalCase (`TodoCard`, `LoginPage`)
- **Hooks**: camelCase with `use` prefix (`useTodos`, `useAuth`)
- **Files**: kebab-case for directories, camelCase for code files (`auth/client.tsx`, `use-todos.ts`)
- **Types/Interfaces**: PascalCase (`Todo`, `UserState`)
- **Constants**: UPPER_SNAKE_CASE (`ZERO_SERVER_URL`, `API_ENDPOINT`)

### TypeScript

- Strict mode enabled — no `any` unless absolutely necessary
- Use `type` over `interface` for consistency
- Explicit `undefined` in unions: `string | undefined` not `string?`
- Prefer `as const` for literal types
- Use branded types for IDs: `type TodoId = string & { __brand: 'TodoId' }`

### Error Handling

- Throw `Error` instances, never strings
- Use try/catch with typed errors in async code
- React Query mutations should handle errors with `onError` callback
- Zero mutations are optimistic — errors auto-rollback on client
- Server errors: return structured error responses, never expose stack traces

### React Patterns

- Prefer function components with explicit return types
- Use `useMemo`/`useCallback` for expensive computations and callback props
- Colocate hooks with features: `features/todo/useTodos.ts`
- Use `~/interface/*` for all UI — never import tamagui directly
- Platform-specific code: use `.native.ts` / `.native.tsx` extensions

### Imports

```ts
// External packages first
import { useMemo } from 'react'
import { useZeroQuery } from '@rocicorp/zero/react'

// Internal packages
import { todosByUserId } from '@vine/zero-schema/queries/todo'

// Local imports with ~ alias
import { useAuth } from '~/features/auth/client/authClient'
import { Button } from '~/interface/buttons/Button'

// Relative imports last
import type { Todo } from './types'
```

### Environment Variables

- Prefix with `VITE_` for client-side access
- Server-only vars: no prefix, never expose to client
- Use `dotenvx` for environment management
- Add new vars to `package.json` env section for validation

---

## Server Patterns

### Service Factory + DI

All server services use manual dependency injection via factory functions. No DI containers or module-level singletons.

```ts
// Service definition
type AuthDeps = {
  database: Pool
  db: NodePgDatabase<typeof schema>
}

function createAuthService(deps: AuthDeps) {
  // ... service logic using deps.database, deps.db
}

// Plugin registration
async function authPlugin(fastify: FastifyInstance, deps: { auth: ReturnType<typeof createAuthService> }) {
  // ... register routes using deps.auth
}
```

### Wiring in `index.ts`

Dependencies are assembled explicitly in the entry point:

```ts
const database = getDatabase()
const db = createDb()

const auth = createAuthService({ database, db })
const zero = createZeroService({ auth, zeroUpstreamDb: process.env['ZERO_UPSTREAM_DB'] ?? '' })

await authPlugin(app, { auth })
await zeroPlugin(app, { auth, zero })
```

### Rules

- **No module-level singletons** — avoid `let _instance: T | null` + `getInstance()` patterns
- **No cross-plugin imports** — plugins should never import each other; inject via `deps`
- **Factory functions are pure** — `createXxxService(deps)` should not read env vars or import singletons
- **Env vars read in `index.ts`** — pass values through deps, not `process.env` inside services

---

## Git Conventions

- Commit messages: conventional commits (`feat:`, `fix:`, `chore:`)
- Keep commits atomic — one logical change per commit
- Never commit secrets, keys, or `.env` files
- Run `bun lint` and `bun format` before committing

