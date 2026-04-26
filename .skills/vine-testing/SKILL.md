---
name: vine-testing
description: Use when deciding what tests to add or run in Vine, especially unit versus integration boundaries, test placement, mocking strategy, or whether a change needs tests at all. Trigger when the user mentions Vitest, Playwright, `test:unit`, `test:integration`, regression coverage, hooks, service factories, integration prerequisites, or asks where tests should live in this repo.
---

# Vine Testing

Vine prefers focused tests that protect behavior without flooding the repo with low-value coverage.

## Test Matrix

| Area | Runner | Command |
| --- | --- | --- |
| `apps/web` unit | Vitest | `bun run --cwd apps/web test:unit` |
| `apps/web` integration | Playwright | `bun run --cwd apps/web test:integration` |
| `apps/server` unit | Vitest | `bun run --cwd apps/server test:unit` |
| `apps/server` DB integration | Vitest + PostgreSQL | `bun run --cwd apps/server test:integration` |
| packages | Vitest | `bun run --cwd packages/<name> test` |

## Where Tests Live

| Area | Preferred location |
| --- | --- |
| `apps/server` unit | next to source as `src/**/*.test.ts` |
| `apps/server` DB integration | next to source as `src/**/*.int.test.ts` |
| `apps/web` unit | `src/test/unit/**/*.test.ts` or nearby when that pattern already exists |
| integration flows | Playwright under `apps/web/src/test/integration/` |

## What To Test

### Server unit tests

- pure utilities
- service factory business logic
- validators, parsers, and data transforms
- repository and state-machine behavior with mocked dependencies

### Server DB integration tests

Use sparingly for behavior that a mock cannot prove:

- Drizzle SQL conditions and `rowCount`
- unique indexes and `onConflictDoNothing`
- real PostgreSQL transaction/savepoint behavior
- atomic multi-table updates where rollback matters
- migration-backed schema assumptions

### Web unit tests

- hooks
- utility functions
- components with meaningful logic

### Web integration tests

- page flows
- login/navigation/form submission journeys
- browser-visible end-to-end behavior

## What Not To Test

- trivial UI wrappers
- generated code
- third-party library behavior
- plain getters and setters
- tests that just restate implementation details without protecting behavior

## Choosing The Right Test

### Hook change in `apps/web`

Usually add a unit test first. Reach for integration only if the risky behavior is the full page flow rather than the hook's own logic.

### Service factory change in `apps/server`

Usually add or update a unit test that passes mocked dependencies into the service factory. Avoid real DB or network access in unit tests.

### Repository or transaction behavior in `apps/server`

Keep the unit test with mocked dependencies first. Add a focused `*.int.test.ts` only when the risk is PostgreSQL behavior itself: conditional updates, unique constraints, `onConflictDoNothing`, nested transaction rollback, or migration-backed table shape.

### User flow change

If the risk is route transitions, browser state, or a multi-step form flow, add or update a Playwright test.

## Backend DB Integration Rules

- Do not use pglite or in-memory substitutes for server DB integration. Use the Docker Compose PostgreSQL database after migrations.
- Do not make `src/**/*.test.ts` touch the real DB. Unit tests must remain mock-only and fast.
- Name backend DB integration tests `*.int.test.ts`; they are discovered only by `apps/server/vitest.integration.config.ts`.
- Use `apps/server/src/test/integration-db.ts` and `withRollbackDb()` for every test body. Each test gets a real PostgreSQL transaction and rolls back at the end.
- Do not clean tables with broad `delete` statements for isolation unless a specific test cannot run in a rollback transaction.
- When app code calls `db.transaction(...)`, pass the real transaction-scoped Drizzle DB from `withRollbackDb()` so nested transactions use PostgreSQL savepoints.
- Local host tests connect to `postgresql://user:password@localhost:5533/postgres`; containers use `pgdb:5432`.
- The full `scripts/integration.ts` runner starts Docker, waits for migrations, runs server DB integration tests, then starts backend/frontend and Playwright.

## Integration Prerequisites

Before running Playwright or other integration checks, make sure the local stack is healthy:

```bash
docker compose ps
docker compose logs server
docker compose logs web
docker compose logs zero
```

If the environment looks stale:

```bash
docker compose down -v
docker compose up -d
```

For detailed local stack guidance, use the `vine-dev-stack` skill.

For backend DB integration only:

```bash
docker compose up -d pgdb migrate
ZERO_UPSTREAM_DB=postgresql://user:password@localhost:5533/postgres bun run --cwd apps/server test:integration
```

## Test Patterns

### Server utility

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

### Service factory with mock deps

```ts
import { describe, expect, it, vi } from 'vitest'
import { createAuthService } from './auth'

describe('createAuthService', () => {
  it('creates user in public table after registration', async () => {
    const mockDb = { insert: vi.fn(), select: vi.fn().mockReturnValue({ where: vi.fn() }) }
    const auth = createAuthService({ database: {} as any, db: mockDb as any })
    // assert business behavior here
  })
})
```

### Server DB integration with rollback

```ts
import { describe, expect, it } from 'vitest'
import { withRollbackDb } from '../../test/integration-db'

describe('repository DB integration', () => {
  it('proves the PostgreSQL-specific behavior', async () => {
    await withRollbackDb(async (db) => {
      // Insert migrated schema rows, call real repository methods, assert DB state.
      // All writes roll back when the test exits.
      expect(db).toBeDefined()
    })
  })
})
```

## When To Rewrite Existing Tests

| Change | Action |
| --- | --- |
| internal refactor, same behavior | update setup if needed, keep behavior assertions |
| changed public signature | update both setup and assertions |
| extracted function | move the test if it improves locality |
| removed feature | remove obsolete tests |
| new edge case | add a focused new test |

## Common Mistakes

- adding Playwright coverage for logic that a fast unit test should cover
- unit tests that hit the real DB or network
- using pglite/in-memory DB for server integration tests that need PostgreSQL semantics
- adding backend DB integration tests without `withRollbackDb()`
- running server DB integration before migrations have completed
- pointing host-run integration tests at `pgdb:5432` instead of `localhost:5533`
- testing trivial UI wrappers instead of behavior-rich code
- forgetting integration prerequisites and blaming the app for a stale local stack
- rewriting assertions during refactors when the behavior itself has not changed

## Reference Files

- `apps/server/src/services/oa.test.ts`
- `apps/server/src/test/integration-db.ts`
- `apps/server/src/services/payments/*.int.test.ts`
- `apps/server/src/utils.test.ts`
- `apps/web/src/test/unit/`
- `apps/web/src/test/playwright.config.ts`
