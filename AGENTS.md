# Vine Agents Guide

Vine is a self-hostable instant-messaging product modeled after LINE. It is not the official LINE platform: avoid assuming LINE Developers Console, Messaging API, LINE Login with LY Corp app/channel IDs, or calling LINE’s hosted `api.line.me` as an external integration target. This codebase is the server and clients: it exposes LINE-style / `api.line.me`-compatible APIs you operate locally or on your own infra. Build features against this repo unless the user explicitly asks for real LINE cloud integration.

## Essential Commands

```bash
bun install           # Install dependencies
docker compose up -d  # Start the full local dev stack in Docker
bun run build         # Build all packages (turbo build)
bun run check:all     # Type check + lint (tko check)
bun run format        # Format all files (oxfmt)
bun run test          # Run all tests (turbo test)
```

### Docker Compose Development

Use Docker Compose as the default and only supported way to start the local dev servers for this repo.

```bash
docker compose up -d           # Start all services in the background
docker compose ps              # Check whether each service is up/healthy
docker compose logs server     # Inspect backend logs
docker compose logs web        # Inspect frontend logs
docker compose restart server  # Restart only the backend dev server
docker compose restart web     # Restart only the frontend dev server
docker compose down            # Stop the stack
docker compose down -v         # Stop the stack and remove volumes for a clean rebuild
```

The Compose stack includes these services:

- `pgdb`: PostgreSQL database for local development
- `migrate`: one-shot migration/bootstrap job that runs before dependent services
- `zero`: Zero sync service
- `server`: backend dev server on port `3001`
- `web`: frontend dev server on port `3000`

Agent rules for local development:

- Do not start `bun run dev` for frontend/backend development. It duplicates the `server` and `web` containers managed by Docker Compose.
- Before starting anything new, check whether the Compose stack is already running with `docker compose ps`.
- If the stack is already up, reuse it instead of launching another dev server process.
- If only one app needs a restart, use `docker compose restart server` or `docker compose restart web` instead of starting extra processes.
- Use `docker compose logs <service>` for debugging service output.

### Running Single Tests

```bash
# Unit tests (vitest)
bun run --cwd apps/web test:unit

# Integration tests (playwright)
bun run --cwd apps/web test:integration

# Specific integration file (path relative to apps/web/src/test — see playwright.config.ts testDir)
bun run --cwd apps/web test:integration -- integration/demo-login.test.ts

# Integration: run tests whose title matches a regexp
bun run --cwd apps/web test:integration -- -g "demo login"

# Specific unit test file (path relative to apps/web)
bun run --cwd apps/web test:unit -- src/test/unit/example.test.ts

# Watch mode
bun run --cwd apps/web test:unit -- --watch
```

### Integration Test Environment

Before running integration tests, first verify that the dev stack is up and healthy:

```bash
docker compose ps
docker compose logs server
docker compose logs web
docker compose logs zero
```

Do not start integration tests until `server`, `web`, and `zero` are running correctly.

If the environment looks stale, corrupted, or you need a fully clean state for integration tests, it is safe to rebuild from scratch:

```bash
docker compose down -v
docker compose up -d
```

`docker compose down -v` removes the local Compose volumes, including database state, so the next boot starts from a clean environment.

### Zero Schema Workflow

```bash
bun run --cwd packages/zero-schema zero:generate  # Generate types after schema changes
```

---

## Data Fetching Rules

**NEVER use raw `fetch()` for server data.** Always use:

1. **Zero** (`useZeroQuery` / `zero.mutate`) — for entities in zero-schema (real-time sync, offline support)
2. **React Query** (`useTanQuery` / `useTanMutation`) — for external APIs, file uploads, analytics
3. **ConnectRPC** — for ConnectRPC service calls:
   - **Unary RPC** (request-response): use `@connectrpc/connect-query` (`useConnectQuery` / `useConnectMutation`) for caching and React Query integration
   - **Streaming RPC** (server/client/bi-directional): use raw `@connectrpc/connect` / `@connectrpc/connect-web` directly for stream lifecycle control (`onMessage`, `onError`, `onComplete`)

**React Query cache:** When a mutation changes data you also read with `useTanQuery`, invalidate the matching query keys on success (`useTanQueryClient().invalidateQueries({ queryKey: [...] })`) or update the cache so lists and detail views stay consistent.

Raw `fetch()` bypasses caching, loading states, error handling, and sync.

---

## State Management

**90% of cases → `useState` / `useReducer`**

For the remaining 10% (high-frequency updates, cross-component state, complex derived state, or persistence):

**→ Use Jotai only**

| Scenario | Jotai Solution |
|----------|----------------|
| Streaming / high-frequency updates | `atom` + `useAtom` (signals-based, bypasses reconciliation) |
| Cross-component shared state | Shared atoms in a module |
| Dependent selects (derived state) | `atom` with `get` for derived values |
| Cross-page persistence | `atom` + `useStorage` or persist middleware |

**Avoid Zustand, Redux, etc.** — Jotai covers all these cases without additional libraries.

---

## Form Patterns

**Use `react-hook-form` + `@hookform/resolvers/valibot` for ALL forms.**

Do NOT use `useState` per field for form state. The only exception is trivial single-input components that don't submit (e.g. search filters, live search boxes).

### Schema Definition

Define valibot schemas alongside the component or in a shared `schemas.ts` file:

```ts
import * as v from 'valibot'

const schema = v.object({
  email: v.pipe(v.string(), v.email('Invalid email'), v.nonEmpty('Required')),
  password: v.pipe(v.string(), v.minLength(1, 'Required')),
})

type FormData = v.InferInput<typeof schema>
```

### Form Hook Setup

```ts
import { valibotResolver } from '@hookform/resolvers/valibot'
import { useForm } from 'react-hook-form'

const { control, handleSubmit, formState: { isSubmitting } } = useForm<FormData>({
  resolver: valibotResolver(schema),
  defaultValues: { email: '', password: '' },
})
```

### Input Integration

Use `Controller` to connect inputs. The `~/interface/forms/Input` component supports an `error` prop:

```ts
import { Controller } from 'react-hook-form'
import { Input } from '~/interface/forms/Input'

<Controller
  control={control}
  name="email"
  render={({ field: { onChange, value }, fieldState: { error } }) => (
    <Input
      value={value}
      onChangeText={onChange}
      error={error?.message}
      onSubmitEditing={() => handleSubmit(onSubmit)()}
    />
  )}
/>
```

### Submit Handler

```ts
const onSubmit = async (data: FormData) => {
  // data is already validated
}

// Button
<Button onPress={handleSubmit(onSubmit)}>Submit</Button>

// Native submit
<Input onSubmitEditing={() => handleSubmit(onSubmit)()} />
```

### Rules

- Always use `valibotResolver` — never manual validation in submit handlers
- Use `Controller` for all inputs (do NOT pass `control`/`name` directly to Input)
- Use `onSubmitEditing={() => handleSubmit(onSubmit)()}` for native keyboard submit
- Display errors via the Input `error` prop — do NOT use `showError()` dialogs for field errors
- Use `formState.isSubmitting` for loading/disabled states instead of manual `useState`

---

## Toast & Dialog System

### Toasts

Use `showToast()` for non-blocking notifications:

```tsx
import { showToast } from '~/interface/toast/Toast'

showToast('Saved!', { type: 'success' })
showToast('Something went wrong', { type: 'error' })
showToast('Coming soon', { type: 'info' })
showToast('Warning', { type: 'warn' })
```

Types: `'success'` | `'error'` | `'info'` | `'warn'`

### Dialogs

Use imperative dialog system for blocking interactions:

```tsx
import { showError, dialogConfirm } from '~/interface/dialogs/actions'

// Error dialog (auto-parses error types)
showError(error, 'Failed to save')

// Confirm dialog (returns Promise<boolean>)
const confirmed = await dialogConfirm({
  title: 'Delete item?',
  description: 'This cannot be undone.',
})
if (confirmed) { /* proceed */ }
```

**Rules:**
- Use `showError()` for unexpected errors, NOT for form field errors
- Use `dialogConfirm()` for destructive actions requiring confirmation
- Do NOT use dialogs for validation feedback — use inline error props instead

---

## Auth Patterns

**Better Auth via `@take-out/better-auth-utils` with platform-specific plugins.**

### Core Hook: `useAuth()`

```ts
import { useAuth } from '~/features/auth/client/authClient'

const { state, user, authData, authClient, loginLink } = useAuth()
// state: 'loading' | 'logged-in' | 'logged-out'
// authData: { id: string, role?: 'admin' } | null (for Zero sync)
```

### Auth Guard

Route guards live in `app/(app)/_layout.tsx` — NOT middleware:

```tsx
const { state } = useAuth()
if (state === 'logged-out' && pathname.startsWith('/home')) {
  return <Redirect href="/auth/login" />
}
if (state === 'logged-in' && pathname.startsWith('/auth')) {
  return <Redirect href="/home/feed" />
}
```

### Login Functions

- `passwordLogin(email, password)` — wraps `authClient.signIn.email()`, returns `{ success, error }`
- `signInAsDemo()` — auto-creates demo user (ignores 422), then signs in
- `authClient.signUp.email()` / `authClient.signIn.email()` — direct client access

### Rules

- Use `useAuth()` (signal-based JWT state) NOT `useUser()` (DB query) to avoid waterfalls
- `authData` is memoized for Zero — pass it to `ProvideZero` for auth sync
- Auth errors auto-show toasts via `onAuthError` handler in client setup
- For form-level auth errors, use `passwordLogin()` result pattern, NOT `showError()` dialogs

---

## learn-projects/ Exclusion Rules

**`learn-projects/` contains reference implementations of latest beta/rc packages for AI learning. NEVER modify files inside it.**

### What to Exclude

Both `.oxlintrc.json` and `.oxfmtrc.jsonc` must ignore `learn-projects/**`:

- `.oxlintrc.json` → `ignorePatterns: ["learn-projects/**"]`
- `.oxfmtrc.jsonc` → `ignorePatterns: ["learn-projects/**"]`
- `.oxfmtignore` → already has `learn-projects/**`

### Rules

- Never run `bun lint` or `bun format` on files inside `learn-projects/`
- Never commit changes from `learn-projects/` submodules
- If a submodule shows as dirty, restore it: `git -C learn-projects/<name> checkout -- .`
- `learn-projects/` is NOT part of bun workspaces — turbo commands won't touch it

---

## CI/CD Pipeline

**Three parallel jobs on GitHub Actions (ubuntu-latest).**

### Jobs

| Job | Purpose | Skip Condition |
|-----|---------|----------------|
| `check` | `bun check:all` (typecheck + lint) | Commit/PR title contains `docs:` |
| `test-server` | Server unit tests (`bun run --cwd apps/server test`) | Commit/PR title contains `docs:` |
| `integration` | Full integration tests via `bun scripts/integration.ts` | Commit/PR title contains `docs:` |

### Install Action (`.github/actions/install/action.yml`)

Steps: Node.js 20.x → Bun (from `package.json`) → `libreadline-dev` → `bun install` → `bun run postinstall` → `bun run build`

### Common Failure Points

- **`zero-sqlite3` native build**: requires `libreadline-dev` (already in install action)
- **Missing env vars**: integration job needs secrets from `bun env:update`
- **`.env` file**: `touch .env` before `bun install` prevents postinstall from creating fake env

### Rules

- Commit messages starting with `docs:` skip all CI jobs
- Integration tests require all secrets to be configured in repo settings
- Concurrency: cancels in-progress jobs on PR updates

---

## Storage Patterns

**Three-tier storage strategy:**

| Platform | Storage | Setup |
|----------|---------|-------|
| Native | MMKV (`react-native-mmkv`) | `setupStorage.native.ts` |
| Web | localStorage | Default via `@take-out/helpers` |
| Zero (synced) | IndexedDB (web) / SQLite (native) | Auto-configured by `ProvideZero` |

Use `@take-out/helpers` `createStorage()` for typed key-value storage:

```ts
import { createStorage } from '@take-out/helpers'

const settings = createStorage({
  theme: 'system' as 'light' | 'dark' | 'system',
  notifications: true,
})

// Usage
settings.get('theme')
settings.set('theme', 'dark')
```

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

**Frontend development:** Anyone working on web/native UI (`apps/web`, `~/interface/`, or other Tamagui-based surfaces) **must** read the Tamagui skill first: `.claude/skills/tamagui/SKILL.md`. It documents this repo’s layout conventions, token styling, and RN-first flex behavior that differs from plain HTML/CSS—skipping it leads to avoidable layout and styling mistakes.

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

## Testing

### Test Infrastructure

| App | Runner | Command |
|-----|--------|---------|
| `apps/web/` | vitest + Playwright | `bun run --cwd apps/web test:unit` / `test:integration` |
| `apps/server/` | vitest | `bun run --cwd apps/server test` |
| Packages | vitest | `bun run --cwd packages/<name> test` (add when needed) |

Test files: `src/**/*.test.ts` (server), `src/test/unit/**/*.test.ts` (web)

### What to Test

**Server (unit tests):**
- Utility functions (pure logic, no external deps)
- Service factories — test business logic by passing mock deps
- Data transformations, validators, parsers

**Web (unit tests):**
- React hooks (`useXxx`) — mock providers, test state/logic
- Utility functions, formatters, validators
- Components with complex logic (not trivial UI)

**Integration tests (web):**
- Page flows (login, navigation, form submission)
- API route interactions
- End-to-end user journeys

### What NOT to Test

- Trivial UI components (just Tamagui wrappers)
- Generated code (proto, zero types)
- Third-party library behavior
- Simple getters/setters

### When to Rewrite Tests

| Scenario | Action |
|----------|--------|
| Refactor internal logic, same API | Update test implementation, keep assertions |
| Change function signature | Update test setup + assertions |
| Extract function from larger module | Move test to new file, keep assertions |
| Remove feature entirely | Delete corresponding tests |
| Add new edge case | Add new test, don't modify existing ones |

### Server Testing Patterns

**Test pure utilities directly:**

```ts
import { describe, expect, it } from 'vitest'
import { toWebRequest } from './utils'

describe('toWebRequest', () => {
  it('converts a basic GET request', () => {
    const req = toWebRequest({ method: 'GET', url: '/api/test', headers: {} })
    expect(req.method).toBe('GET')
  })
})
```

**Test service factories with mock deps:**

```ts
import { describe, expect, it, vi } from 'vitest'
import { createAuthService } from './auth'

describe('createAuthService', () => {
  it('creates user in public table after registration', async () => {
    const mockDb = { insert: vi.fn(), select: vi.fn().mockReturnValue({ where: vi.fn() }) }
    const auth = createAuthService({ database: {} as any, db: mockDb as any })
    // ... test auth behavior with mock db
  })
})
```

### Rules

- Tests live next to source or in `src/test/unit/` (web)
- Test files end with `.test.ts`
- Use `describe` / `it` blocks with clear descriptions
- Mock external dependencies, don't hit real DB/APIs in unit tests
- Run `bun test` before committing

---

## Git Conventions

- Commit messages: conventional commits (`feat:`, `fix:`, `chore:`)
- Keep commits atomic — one logical change per commit
- Never commit secrets, keys, or `.env` files
- Run `bun lint` and `bun format` before committing

