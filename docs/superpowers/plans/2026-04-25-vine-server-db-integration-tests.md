# Vine Server DB Integration Tests Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a backend PostgreSQL integration test lane for `apps/server` without changing the existing mock-based unit test lane.

**Architecture:** Keep `apps/server` unit tests fast and mock-only. Add `*.int.test.ts` files that run against the Docker Compose PostgreSQL database after migrations complete, with each test wrapped in a real PostgreSQL transaction that rolls back after the test. Wire this lane into the existing `scripts/integration.ts` orchestrator before app server/frontend/Playwright startup.

**Tech Stack:** Bun, Vitest, Docker Compose PostgreSQL, Drizzle ORM node-postgres, existing `@vine/db` schema and migration flow.

---

## File Structure

- `apps/server/vitest.config.ts`: keep unit tests scoped to `src/**/*.test.ts`, excluding `src/**/*.int.test.ts`.
- `apps/server/vitest.integration.config.ts`: new Vitest config for server DB integration tests only.
- `apps/server/package.json`: add `test`, `test:integration`, and keep `test:unit`.
- `apps/server/src/test/integration-db.ts`: shared real PostgreSQL test helper with rollback-per-test behavior.
- `apps/server/src/services/payments/*.int.test.ts`: first integration coverage for payment repositories and event transaction behavior.
- `scripts/integration.ts`: run server DB integration after migrations and before frontend Playwright flow.

## Task 1: Split Server Unit and Integration Test Commands

**Files:**
- Modify: `apps/server/vitest.config.ts`
- Create: `apps/server/vitest.integration.config.ts`
- Modify: `apps/server/package.json`

- [ ] **Step 1: Update unit Vitest config to exclude DB integration tests**

Modify `apps/server/vitest.config.ts`:

```ts
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    exclude: ['src/**/*.int.test.ts'],
  },

  resolve: {
    alias: {
      '~': __dirname + '/src',
    },
  },
})
```

- [ ] **Step 2: Add server integration Vitest config**

Create `apps/server/vitest.integration.config.ts`:

```ts
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.int.test.ts'],
    pool: 'forks',
    fileParallelism: false,
    testTimeout: 15_000,
    hookTimeout: 15_000,
  },

  resolve: {
    alias: {
      '~': __dirname + '/src',
    },
  },
})
```

- [ ] **Step 3: Add scripts**

Modify `apps/server/package.json` scripts:

```json
{
  "scripts": {
    "dev": "bun --watch --env-file=../../.env src/index.ts",
    "build": "bun build src/index.ts --outdir dist --target bun",
    "clean": "rm -rf dist",
    "start": "bun dist/index.js",
    "lint": "oxlint --import-plugin --type-aware",
    "typecheck": "tsc --noEmit",
    "test": "bun run test:unit",
    "test:unit": "vitest run -c vitest.config.ts",
    "test:integration": "vitest run -c vitest.integration.config.ts",
    "test:watch": "vitest"
  }
}
```

- [ ] **Step 4: Verify unit lane still ignores integration tests**

Run:

```bash
bun run --cwd apps/server test:unit -- --runInBand
```

Expected: existing server unit tests pass, and no `*.int.test.ts` file is discovered.

- [ ] **Step 5: Verify empty integration lane**

Run:

```bash
bun run --cwd apps/server test:integration
```

Expected: Vitest exits with no integration tests found if Task 2 has not been implemented yet. If Vitest treats no tests as failure in this version, continue; Task 2 adds the first tests.

- [ ] **Step 6: Commit**

```bash
git add apps/server/vitest.config.ts apps/server/vitest.integration.config.ts apps/server/package.json
git commit -m "test(server): split unit and db integration test lanes"
```

---

## Task 2: Add PostgreSQL Rollback Test Helper

**Files:**
- Create: `apps/server/src/test/integration-db.ts`

- [ ] **Step 1: Add rollback helper**

Create `apps/server/src/test/integration-db.ts`:

```ts
import { afterAll } from 'vitest'
import { drizzle } from 'drizzle-orm/node-postgres'
import { createPool, schema } from '@vine/db'

const DEFAULT_TEST_DATABASE_URL = 'postgresql://user:password@localhost:5533/postgres'
const ROLLBACK = Symbol('ROLLBACK')

let pool: ReturnType<typeof createPool> | undefined

function getDatabaseUrl(): string {
  return process.env['ZERO_UPSTREAM_DB'] ?? DEFAULT_TEST_DATABASE_URL
}

function getPool(): ReturnType<typeof createPool> {
  if (!pool) {
    pool = createPool(getDatabaseUrl())
  }
  return pool
}

export function getIntegrationDb() {
  return drizzle({ client: getPool(), schema, logger: false })
}

export async function withRollbackDb<T>(fn: (db: any) => Promise<T>): Promise<T> {
  const db = getIntegrationDb()
  let result: T | undefined

  try {
    await db.transaction(async (tx) => {
      result = await fn(tx)
      throw ROLLBACK
    })
  } catch (err) {
    if (err !== ROLLBACK) {
      throw err
    }
  }

  return result as T
}

export async function closeIntegrationDb(): Promise<void> {
  await pool?.end()
  pool = undefined
}

afterAll(async () => {
  await closeIntegrationDb()
})
```

- [ ] **Step 2: Add a temporary smoke test locally only if needed**

If the helper type-checks poorly in the current Drizzle version, create a temporary local test while developing, then remove it before commit:

```ts
import { describe, expect, it } from 'vitest'
import { sql } from 'drizzle-orm'
import { withRollbackDb } from './integration-db'

describe('integration db helper', () => {
  it('can run a query inside a rollback transaction', async () => {
    await withRollbackDb(async (db) => {
      const rows = await db.execute(sql`select 1 as value`)
      expect(rows.rows[0].value).toBe(1)
    })
  })
})
```

- [ ] **Step 3: Verify typecheck**

Run:

```bash
bun run --cwd apps/server typecheck
```

Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add apps/server/src/test/integration-db.ts
git commit -m "test(server): add postgres rollback integration helper"
```

---

## Task 3: Add Payment Repository DB Integration Tests

**Files:**
- Create: `apps/server/src/services/payments/order.repository.int.test.ts`
- Create: `apps/server/src/services/payments/entitlement.repository.int.test.ts`

- [ ] **Step 1: Write order repository integration test**

Create `apps/server/src/services/payments/order.repository.int.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { withRollbackDb } from '../../test/integration-db'
import { createStickerOrderRepository } from './order.repository'

describe('StickerOrderRepository DB integration', () => {
  it('transitions created -> paid once and returns rowCount=0 after already paid', async () => {
    await withRollbackDb(async (db) => {
      const repo = createStickerOrderRepository(db)

      await repo.create(db, {
        id: 'int_order_paid_once',
        userId: 'user-int-1',
        packageId: 'pkg-int-1',
        amountMinor: 3000,
        currency: 'TWD',
        connectorName: 'ecpay',
      })

      const first = await repo.transitionToPaid(db, 'int_order_paid_once', {
        connectorChargeId: 'charge-int-1',
        paidAt: new Date('2026-04-25T00:00:00Z'),
      })
      const second = await repo.transitionToPaid(db, 'int_order_paid_once', {
        connectorChargeId: 'charge-int-2',
        paidAt: new Date('2026-04-25T00:01:00Z'),
      })
      const order = await repo.findById(db, 'int_order_paid_once')

      expect(first).toBe(1)
      expect(second).toBe(0)
      expect(order).toMatchObject({
        id: 'int_order_paid_once',
        status: 'paid',
        connectorChargeId: 'charge-int-1',
      })
    })
  })

  it('does not transition paid -> failed', async () => {
    await withRollbackDb(async (db) => {
      const repo = createStickerOrderRepository(db)

      await repo.create(db, {
        id: 'int_order_paid_not_failed',
        userId: 'user-int-1',
        packageId: 'pkg-int-1',
        amountMinor: 3000,
        currency: 'TWD',
        connectorName: 'ecpay',
      })
      await repo.transitionToPaid(db, 'int_order_paid_not_failed', {
        connectorChargeId: 'charge-int-1',
        paidAt: new Date('2026-04-25T00:00:00Z'),
      })

      const failed = await repo.transitionToFailed(db, 'int_order_paid_not_failed', {
        failureReason: 'late failure webhook',
      })
      const order = await repo.findById(db, 'int_order_paid_not_failed')

      expect(failed).toBe(0)
      expect(order?.status).toBe('paid')
      expect(order?.failureReason).toBeNull()
    })
  })
})
```

- [ ] **Step 2: Write entitlement repository integration test**

Create `apps/server/src/services/payments/entitlement.repository.int.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { entitlement } from '@vine/db/schema-public'
import { withRollbackDb } from '../../test/integration-db'
import { createEntitlementRepository } from './entitlement.repository'

describe('EntitlementRepository DB integration', () => {
  it('is idempotent through the real unique index and onConflictDoNothing', async () => {
    await withRollbackDb(async (db) => {
      const repo = createEntitlementRepository()

      await repo.grant(db, {
        userId: 'user-int-1',
        packageId: 'pkg-int-1',
        grantedByOrderId: 'order-int-1',
      })
      await repo.grant(db, {
        userId: 'user-int-1',
        packageId: 'pkg-int-1',
        grantedByOrderId: 'order-int-2',
      })

      const rows = await db.select().from(entitlement)
      const found = await repo.find(db, {
        userId: 'user-int-1',
        packageId: 'pkg-int-1',
      })

      expect(rows).toHaveLength(1)
      expect(found).toMatchObject({
        userId: 'user-int-1',
        packageId: 'pkg-int-1',
        grantedByOrderId: 'order-int-1',
      })
    })
  })
})
```

- [ ] **Step 3: Start DB and migrations**

Run:

```bash
docker compose up -d pgdb migrate
docker compose ps migrate
```

Expected: `migrate` exits with code 0.

- [ ] **Step 4: Run payment repository integration tests**

Run:

```bash
ZERO_UPSTREAM_DB=postgresql://user:password@localhost:5533/postgres bun run --cwd apps/server test:integration -- src/services/payments/order.repository.int.test.ts src/services/payments/entitlement.repository.int.test.ts
```

Expected: PASS.

- [ ] **Step 5: Verify unit tests are unaffected**

Run:

```bash
bun run --cwd apps/server test:unit -- src/services/payments/order.repository.test.ts src/services/payments/entitlement.repository.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/server/src/services/payments/order.repository.int.test.ts apps/server/src/services/payments/entitlement.repository.int.test.ts
git commit -m "test(server): cover payment repositories against postgres"
```

---

## Task 4: Add Payment Event Transaction Integration Test

**Files:**
- Create: `apps/server/src/services/payments/event-handler.int.test.ts`

- [ ] **Step 1: Write transaction integration tests**

Create `apps/server/src/services/payments/event-handler.int.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { entitlement, stickerPackage } from '@vine/db/schema-public'
import { withRollbackDb } from '../../test/integration-db'
import { createEntitlementRepository } from './entitlement.repository'
import { handlePaymentEvent } from './event-handler'
import { createStickerOrderRepository } from './order.repository'

const silentLog = {
  warn: () => {},
  error: () => {},
  info: () => {},
}

async function seedPackage(db: any) {
  await db.insert(stickerPackage).values({
    id: 'pkg-event-int-1',
    name: 'Integration Pack',
    description: '',
    priceMinor: 3000,
    currency: 'TWD',
    coverDriveKey: 'stickers/pkg-event-int-1/cover.png',
    tabIconDriveKey: 'stickers/pkg-event-int-1/tab.png',
    stickerCount: 8,
  })
}

describe('handlePaymentEvent DB integration', () => {
  it('charge.succeeded updates order and grants entitlement in one transaction', async () => {
    await withRollbackDb(async (db) => {
      await seedPackage(db)

      const orderRepo = createStickerOrderRepository(db)
      const entitlementRepo = createEntitlementRepository()
      await orderRepo.create(db, {
        id: 'order-event-int-1',
        userId: 'user-event-int-1',
        packageId: 'pkg-event-int-1',
        amountMinor: 3000,
        currency: 'TWD',
        connectorName: 'ecpay',
      })

      await handlePaymentEvent(
        { db, orderRepo, entitlementRepo },
        {
          kind: 'charge.succeeded',
          merchantTransactionId: 'order-event-int-1',
          connectorChargeId: 'charge-event-int-1',
          amount: { minorAmount: 3000, currency: 'TWD' },
          paidAt: new Date('2026-04-25T00:00:00Z'),
        },
        silentLog,
      )

      const order = await orderRepo.findById(db, 'order-event-int-1')
      const granted = await entitlementRepo.find(db, {
        userId: 'user-event-int-1',
        packageId: 'pkg-event-int-1',
      })

      expect(order?.status).toBe('paid')
      expect(order?.connectorChargeId).toBe('charge-event-int-1')
      expect(granted).toMatchObject({
        userId: 'user-event-int-1',
        packageId: 'pkg-event-int-1',
        grantedByOrderId: 'order-event-int-1',
      })
    })
  })

  it('rolls back order transition when entitlement grant fails', async () => {
    await withRollbackDb(async (db) => {
      await seedPackage(db)

      const orderRepo = createStickerOrderRepository(db)
      const entitlementRepo = {
        ...createEntitlementRepository(),
        async grant() {
          throw new Error('forced entitlement failure')
        },
      }

      await orderRepo.create(db, {
        id: 'order-event-int-rollback',
        userId: 'user-event-int-rollback',
        packageId: 'pkg-event-int-1',
        amountMinor: 3000,
        currency: 'TWD',
        connectorName: 'ecpay',
      })

      await expect(
        handlePaymentEvent(
          { db, orderRepo, entitlementRepo },
          {
            kind: 'charge.succeeded',
            merchantTransactionId: 'order-event-int-rollback',
            connectorChargeId: 'charge-event-int-rollback',
            amount: { minorAmount: 3000, currency: 'TWD' },
            paidAt: new Date('2026-04-25T00:00:00Z'),
          },
          silentLog,
        ),
      ).rejects.toThrow('forced entitlement failure')

      const order = await orderRepo.findById(db, 'order-event-int-rollback')
      const rows = await db.select().from(entitlement)

      expect(order?.status).toBe('created')
      expect(order?.connectorChargeId).toBeNull()
      expect(rows).toHaveLength(0)
    })
  })
})
```

- [ ] **Step 2: Run event handler integration test**

Run:

```bash
ZERO_UPSTREAM_DB=postgresql://user:password@localhost:5533/postgres bun run --cwd apps/server test:integration -- src/services/payments/event-handler.int.test.ts
```

Expected: PASS.

- [ ] **Step 3: Run all server DB integration tests**

Run:

```bash
ZERO_UPSTREAM_DB=postgresql://user:password@localhost:5533/postgres bun run --cwd apps/server test:integration
```

Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add apps/server/src/services/payments/event-handler.int.test.ts
git commit -m "test(server): cover payment event postgres transaction behavior"
```

---

## Task 5: Wire Server DB Integration Into Full Integration Runner

**Files:**
- Modify: `scripts/integration.ts`

- [ ] **Step 1: Add server DB integration command after migrations**

In `scripts/integration.ts`, after:

```ts
await waitForMigrations()
```

add:

```ts
    // Run backend DB integration tests before app startup. These tests use the
    // migrated Docker PostgreSQL database and rollback every test transaction.
    console.info('\nrunning server db integration tests...')
    await $(
      'ZERO_UPSTREAM_DB=postgresql://user:password@localhost:5533/postgres bun run --cwd apps/server test:integration',
      { timeout: TEST_TIMEOUT },
    )
```

- [ ] **Step 2: Verify full runner starts server DB integration before Playwright**

Run:

```bash
bun scripts/integration.ts src/test/integration/flex-simulator.test.ts
```

Expected:
- Logs show `running server db integration tests...` after migrations complete.
- Server DB integration tests pass before backend/frontend startup.
- Existing Playwright integration still runs afterward.

- [ ] **Step 3: Verify existing unit command remains mock-only**

Run:

```bash
bun run --cwd apps/server test:unit
```

Expected: PASS, with no PostgreSQL requirement.

- [ ] **Step 4: Commit**

```bash
git add scripts/integration.ts
git commit -m "test(server): run db integration tests in integration pipeline"
```

---

## Final Verification

- [ ] Run server unit tests:

```bash
bun run --cwd apps/server test:unit
```

Expected: PASS.

- [ ] Run server DB integration tests against Docker PostgreSQL:

```bash
docker compose up -d pgdb migrate
ZERO_UPSTREAM_DB=postgresql://user:password@localhost:5533/postgres bun run --cwd apps/server test:integration
```

Expected: PASS.

- [ ] Run full integration runner:

```bash
bun scripts/integration.ts
```

Expected: server DB integration passes, then existing Playwright integration passes.

- [ ] Run full repo checks if time allows:

```bash
bun run check:all
```

Expected: PASS.
