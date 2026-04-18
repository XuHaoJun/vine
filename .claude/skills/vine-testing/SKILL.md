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
| `apps/server` unit | Vitest | `bun run --cwd apps/server test` |
| packages | Vitest | `bun run --cwd packages/<name> test` |

## Where Tests Live

| Area | Preferred location |
| --- | --- |
| `apps/server` | next to source as `src/**/*.test.ts` |
| `apps/web` unit | `src/test/unit/**/*.test.ts` or nearby when that pattern already exists |
| integration flows | Playwright under `apps/web/src/test/integration/` |

## What To Test

### Server unit tests

- pure utilities
- service factory business logic
- validators, parsers, and data transforms

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

### User flow change

If the risk is route transitions, browser state, or a multi-step form flow, add or update a Playwright test.

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
- testing trivial UI wrappers instead of behavior-rich code
- forgetting integration prerequisites and blaming the app for a stale local stack
- rewriting assertions during refactors when the behavior itself has not changed

## Reference Files

- `apps/server/src/services/oa.test.ts`
- `apps/server/src/utils.test.ts`
- `apps/web/src/test/unit/`
- `apps/web/src/test/playwright.config.ts`
