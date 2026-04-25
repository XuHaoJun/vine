# Vine Creator Market Payments Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Phase 1.5 payment hardening: full refund compensation, order reconciliation, alert sink boundaries, and admin ConnectRPC controls for the existing ECPay sticker-market checkout flow.

**Architecture:** Extend the existing `@vine/pay` service with direct ECPay AIO query/refund helpers, matching Phase 1's direct AIO form approach. Keep Vine domain state in `apps/server/src/services/payments`: repositories own SQL transitions, refund/reconciliation services orchestrate DB + external payment calls, and Connect handlers only authorize admin users and delegate. No web UI is added.

**Tech Stack:** TypeScript, Bun, Vitest, Fastify, Drizzle, ConnectRPC, PostgreSQL integration tests, ECPay AIO CheckMacValue helpers, `@vine/pay`, `@vine/db`, `@vine/proto`.

**Upstream spec:** [`docs/superpowers/specs/2026-04-25-vine-creator-market-payments-hardening-design.md`](../specs/2026-04-25-vine-creator-market-payments-hardening-design.md)

---

## Execution Order

- **Phase A** — `@vine/pay` ECPay helpers. Independent unit-tested package work.
- **Phase B** — DB schema + repositories. Required before server services.
- **Phase C** — Refund service + alert sink. Depends on A + B.
- **Phase D** — Webhook compensation + webhook alerts. Depends on C.
- **Phase E** — Reconciliation service. Depends on A + B + alert sink.
- **Phase F** — Admin ConnectRPC service and wiring. Depends on C + E.
- **Phase G** — Full verification and docs status.

---

## File Structure

### Create

- `packages/pay/src/ecpay/endpoints.ts` — ECPay stage/prod endpoint constants.
- `packages/pay/src/ecpay/form.ts` — urlencoded POST body parser/builder shared by query/refund.
- `packages/pay/src/ecpay/query-trade.ts` — AIO QueryTradeInfo request + result normalization.
- `packages/pay/src/ecpay/refund.ts` — AIO CreditDetail/DoAction full-refund request + result normalization.
- `packages/db/src/migrations/20260425000001_sticker_order_refunds.ts` — migration for refund/reconciliation fields and partial unique refund index.
- `apps/server/src/services/payments/alert-sink.ts` — alert interface and log-backed implementation.
- `apps/server/src/services/payments/refund.service.ts` — manual/admin refund and automatic compensation orchestration.
- `apps/server/src/services/payments/refund.service.test.ts` — mocked service unit tests.
- `apps/server/src/services/payments/reconciliation.service.ts` — manual order reconciliation service.
- `apps/server/src/services/payments/reconciliation.service.test.ts` — mocked service unit tests.
- `apps/server/src/connect/stickerMarketAdmin.ts` — admin-only ConnectRPC handler.
- `apps/server/src/connect/stickerMarketAdmin.test.ts` — admin authorization and response mapping unit tests.

### Modify

- `packages/pay/src/types.ts` — add `RefundChargeInput`, `RefundChargeResult`, `GetChargeInput`, `ChargeStatusResult`, and `fetch` dependency type.
- `packages/pay/src/service.ts` — wire `refundCharge()` and `getCharge()`.
- `packages/pay/src/service.test.ts` — cover ECPay query/refund behavior.
- `packages/db/src/schema-private.ts` — extend `stickerOrder` fields and status type.
- `apps/server/src/services/payments/order.repository.ts` — refund/reconciliation state transitions and selectors.
- `apps/server/src/services/payments/order.repository.test.ts` — unit coverage for transition payloads and row counts.
- `apps/server/src/services/payments/order.repository.int.test.ts` — real PostgreSQL transition behavior.
- `apps/server/src/services/payments/entitlement.repository.ts` — add `revokeByOrder()`.
- `apps/server/src/services/payments/entitlement.repository.test.ts` — unit coverage for delete query shape.
- `apps/server/src/services/payments/entitlement.repository.int.test.ts` — real delete-by-order behavior.
- `apps/server/src/services/payments/event-handler.ts` — inject refund service and alert sink, compensate entitlement grant failures.
- `apps/server/src/services/payments/event-handler.test.ts` — compensation and alert coverage.
- `apps/server/src/services/payments/webhook.route.ts` — emit webhook verification alerts.
- `apps/server/src/services/payments/webhook.route.test.ts` — alert coverage for bad CheckMacValue.
- `apps/server/src/services/payments/index.ts` — factory wiring for alert/refund/reconciliation services.
- `packages/proto/proto/stickerMarket/v1/stickerMarket.proto` — add admin service/messages and refund statuses.
- `packages/proto/gen/stickerMarket/v1/stickerMarket_pb.ts` — generated.
- `apps/server/src/connect/routes.ts` — register `StickerMarketAdminService`.
- `apps/server/src/index.ts` — pass admin payment service deps to Connect routes and webhook route.

---

## Phase A — `@vine/pay` Query And Refund Helpers

### Task A1: Add failing `@vine/pay` tests for query/refund behavior

**Files:**
- Modify: `packages/pay/src/service.test.ts`

- [ ] **Step 1: Add tests at the end of `packages/pay/src/service.test.ts`**

Change the first import to include `vi`:

```ts
import { describe, it, expect, vi } from 'vitest'
```

```ts
describe('getCharge', () => {
  it('maps QueryTradeInfo TradeStatus=1 to paid', async () => {
    const fetch = vi.fn().mockResolvedValue(
      new Response(
        'MerchantTradeNo=oquery001&TradeNo=2402230000000001&TradeAmt=75&TradeStatus=1&PaymentDate=2026/04/25 10:00:00',
      ),
    )
    const pay = createPaymentsService({
      connector: 'ecpay',
      ecpay: STAGE_CREDS,
      fetch,
      now: () => new Date('2026-04-25T02:00:00Z'),
    })

    const result = await pay.getCharge({ merchantTransactionId: 'oquery001' })

    expect(result).toMatchObject({
      status: 'paid',
      connectorChargeId: '2402230000000001',
      amount: { minorAmount: 75, currency: 'TWD' },
      rawStatus: '1',
    })
    expect(fetch).toHaveBeenCalledOnce()
    expect(fetch.mock.calls[0][0]).toBe(
      'https://payment-stage.ecpay.com.tw/Cashier/QueryTradeInfo/V5',
    )
    expect(String(fetch.mock.calls[0][1].body)).toContain('MerchantTradeNo=oquery001')
    expect(String(fetch.mock.calls[0][1].body)).toContain('TimeStamp=1777082400')
  })

  it('maps QueryTradeInfo order-not-found response to not_found', async () => {
    const fetch = vi
      .fn()
      .mockResolvedValue(new Response('TradeStatus=10200047&TradeStatusDesc=查無資料'))
    const pay = createPaymentsService({
      connector: 'ecpay',
      ecpay: STAGE_CREDS,
      fetch,
      now: () => new Date('2026-04-25T02:00:00Z'),
    })

    const result = await pay.getCharge({ merchantTransactionId: 'missing001' })

    expect(result).toMatchObject({
      status: 'not_found',
      rawStatus: '10200047',
    })
  })
})

describe('refundCharge', () => {
  it('returns simulated success in stage test mode without network', async () => {
    const fetch = vi.fn()
    const pay = createPaymentsService({
      connector: 'ecpay',
      ecpay: STAGE_CREDS,
      fetch,
      now: () => new Date('2026-04-25T02:00:00Z'),
    })

    const result = await pay.refundCharge({
      merchantTransactionId: 'orefund001',
      connectorChargeId: '2402230000000001',
      amount: { minorAmount: 75, currency: 'TWD' },
      reason: 'technical_error',
      testMode: true,
    })

    expect(result).toMatchObject({
      status: 'succeeded',
      connectorRefundId: undefined,
      simulated: true,
    })
    expect(fetch).not.toHaveBeenCalled()
  })

  it('maps DoAction failure response to failed', async () => {
    const fetch = vi
      .fn()
      .mockResolvedValue(new Response('RtnCode=0&RtnMsg=TradeNo not found'))
    const pay = createPaymentsService({
      connector: 'ecpay',
      ecpay: { ...STAGE_CREDS, mode: 'prod' },
      fetch,
      now: () => new Date('2026-04-25T02:00:00Z'),
    })

    const result = await pay.refundCharge({
      merchantTransactionId: 'orefund002',
      connectorChargeId: '2402230000000002',
      amount: { minorAmount: 75, currency: 'TWD' },
      reason: 'admin_exception',
    })

    expect(result).toMatchObject({
      status: 'failed',
      reason: 'TradeNo not found',
    })
    expect(fetch).toHaveBeenCalledOnce()
    expect(fetch.mock.calls[0][0]).toBe(
      'https://payment.ecpay.com.tw/CreditDetail/DoAction',
    )
    expect(String(fetch.mock.calls[0][1].body)).toContain('Action=R')
  })

  it('rejects non-TWD refund amounts', async () => {
    const pay = createPaymentsService({ connector: 'ecpay', ecpay: STAGE_CREDS })
    await expect(
      pay.refundCharge({
        merchantTransactionId: 'orefund003',
        connectorChargeId: '2402230000000003',
        amount: { minorAmount: 75, currency: 'USD' },
        reason: 'technical_error',
      }),
    ).rejects.toThrow(ConfigError)
  })
})
```

- [ ] **Step 2: Run the tests and verify failure**

Run:

```bash
bun run --cwd packages/pay test
```

Expected: FAIL with TypeScript/runtime errors that `fetch`, `now`, `getCharge`, and `refundCharge` are not defined on the current types/service.

### Task A2: Implement `@vine/pay` ECPay query/refund helpers

**Files:**
- Create: `packages/pay/src/ecpay/endpoints.ts`
- Create: `packages/pay/src/ecpay/form.ts`
- Create: `packages/pay/src/ecpay/query-trade.ts`
- Create: `packages/pay/src/ecpay/refund.ts`
- Modify: `packages/pay/src/types.ts`
- Modify: `packages/pay/src/service.ts`

- [ ] **Step 1: Extend service types in `packages/pay/src/types.ts`**

Add these exported types below `HandleWebhookResult`:

```ts
export type RefundChargeInput = {
  merchantTransactionId: string
  connectorChargeId: string
  amount: Money
  reason: string
  testMode?: boolean
}

export type RefundChargeResult =
  | {
      status: 'succeeded'
      connectorRefundId: string | undefined
      refundedAt: Date
      simulated: boolean
      raw: Record<string, string>
    }
  | {
      status: 'failed'
      reason: string
      raw: Record<string, string> | undefined
    }

export type GetChargeInput = {
  merchantTransactionId: string
}

export type ChargeStatusResult =
  | {
      status: 'paid'
      connectorChargeId: string
      amount: Money
      paidAt: Date | undefined
      rawStatus: string
      raw: Record<string, string>
    }
  | {
      status: 'unpaid' | 'failed' | 'not_found' | 'unknown'
      reason: string
      rawStatus: string | undefined
      raw: Record<string, string> | undefined
    }
```

Extend `PaymentsServiceDeps` and `PaymentsService`:

```ts
export type PaymentsServiceDeps = {
  connector: 'ecpay'
  ecpay: EcpayCredentials
  libPath?: string
  fetch?: typeof fetch
  now?: () => Date
}

export type PaymentsService = {
  createCharge(input: CreateChargeInput): Promise<CreateChargeResult>
  handleWebhook(input: HandleWebhookInput): Promise<HandleWebhookResult>
  refundCharge(input: RefundChargeInput): Promise<RefundChargeResult>
  getCharge(input: GetChargeInput): Promise<ChargeStatusResult>
}
```

- [ ] **Step 2: Create endpoint helpers**

`packages/pay/src/ecpay/endpoints.ts`:

```ts
import type { EcpayCredentials } from '../types'

const STAGE_PAYMENT_BASE = 'https://payment-stage.ecpay.com.tw'
const PROD_PAYMENT_BASE = 'https://payment.ecpay.com.tw'

export function getEcpayPaymentBase(mode: EcpayCredentials['mode']): string {
  return mode === 'prod' ? PROD_PAYMENT_BASE : STAGE_PAYMENT_BASE
}

export function getAioCheckoutUrl(mode: EcpayCredentials['mode']): string {
  return `${getEcpayPaymentBase(mode)}/Cashier/AioCheckOut/V5`
}

export function getQueryTradeInfoUrl(mode: EcpayCredentials['mode']): string {
  return `${getEcpayPaymentBase(mode)}/Cashier/QueryTradeInfo/V5`
}

export function getCreditDoActionUrl(mode: EcpayCredentials['mode']): string {
  return `${getEcpayPaymentBase(mode)}/CreditDetail/DoAction`
}
```

- [ ] **Step 3: Create urlencoded helpers**

`packages/pay/src/ecpay/form.ts`:

```ts
export function encodeEcpayForm(params: Record<string, string>): string {
  return new URLSearchParams(params).toString()
}

export function parseEcpayForm(body: string): Record<string, string> {
  const parsed = new URLSearchParams(body)
  const result: Record<string, string> = {}
  for (const [key, value] of parsed.entries()) {
    result[key] = value
  }
  return result
}
```

- [ ] **Step 4: Create QueryTradeInfo helper**

`packages/pay/src/ecpay/query-trade.ts`:

```ts
import type { ChargeStatusResult, EcpayCredentials, GetChargeInput } from '../types'
import { computeCheckMacValue } from '../utils/ecpay-mac'
import { encodeEcpayForm, parseEcpayForm } from './form'
import { getQueryTradeInfoUrl } from './endpoints'

export async function queryEcpayTrade(
  deps: { ecpay: EcpayCredentials; fetch: typeof fetch; now: () => Date },
  input: GetChargeInput,
): Promise<ChargeStatusResult> {
  const params: Record<string, string> = {
    MerchantID: deps.ecpay.merchantId,
    MerchantTradeNo: input.merchantTransactionId,
    TimeStamp: String(Math.floor(deps.now().getTime() / 1000)),
  }
  params['CheckMacValue'] = computeCheckMacValue(
    params,
    deps.ecpay.hashKey,
    deps.ecpay.hashIv,
  )

  const res = await deps.fetch(getQueryTradeInfoUrl(deps.ecpay.mode), {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: encodeEcpayForm(params),
  })
  const raw = parseEcpayForm(await res.text())
  const rawStatus = raw['TradeStatus']

  if (rawStatus === '1') {
    return {
      status: 'paid',
      connectorChargeId: raw['TradeNo'] ?? '',
      amount: {
        minorAmount: Number.parseInt(raw['TradeAmt'] ?? '0', 10),
        currency: 'TWD',
      },
      paidAt: raw['PaymentDate'] ? new Date(raw['PaymentDate'].replaceAll('/', '-')) : undefined,
      rawStatus,
      raw,
    }
  }

  if (rawStatus === '0') {
    return {
      status: 'unpaid',
      reason: raw['TradeStatusDesc'] ?? 'unpaid',
      rawStatus,
      raw,
    }
  }

  if (rawStatus === '10200047') {
    return {
      status: 'not_found',
      reason: raw['TradeStatusDesc'] ?? 'order not found',
      rawStatus,
      raw,
    }
  }

  return {
    status: 'unknown',
    reason: raw['TradeStatusDesc'] ?? raw['RtnMsg'] ?? 'unknown query status',
    rawStatus,
    raw,
  }
}
```

- [ ] **Step 5: Create refund helper**

`packages/pay/src/ecpay/refund.ts`:

```ts
import type { EcpayCredentials, RefundChargeInput, RefundChargeResult } from '../types'
import { ConfigError } from '../errors'
import { computeCheckMacValue } from '../utils/ecpay-mac'
import { encodeEcpayForm, parseEcpayForm } from './form'
import { getCreditDoActionUrl } from './endpoints'

export async function refundEcpayCharge(
  deps: { ecpay: EcpayCredentials; fetch: typeof fetch; now: () => Date },
  input: RefundChargeInput,
): Promise<RefundChargeResult> {
  if (input.amount.currency !== 'TWD') {
    throw new ConfigError(
      `refundCharge: unsupported currency ${input.amount.currency}, only TWD is supported`,
    )
  }
  if (!input.connectorChargeId) {
    throw new ConfigError('refundCharge: connectorChargeId is required')
  }

  if (deps.ecpay.mode === 'stage' && input.testMode) {
    return {
      status: 'succeeded',
      connectorRefundId: undefined,
      refundedAt: deps.now(),
      simulated: true,
      raw: { simulated: 'true' },
    }
  }

  const params: Record<string, string> = {
    MerchantID: deps.ecpay.merchantId,
    MerchantTradeNo: input.merchantTransactionId,
    TradeNo: input.connectorChargeId,
    Action: 'R',
    TotalAmount: String(input.amount.minorAmount),
  }
  params['CheckMacValue'] = computeCheckMacValue(
    params,
    deps.ecpay.hashKey,
    deps.ecpay.hashIv,
  )

  const res = await deps.fetch(getCreditDoActionUrl(deps.ecpay.mode), {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: encodeEcpayForm(params),
  })
  const raw = parseEcpayForm(await res.text())
  const success = raw['RtnCode'] === '1'

  if (!success) {
    return {
      status: 'failed',
      reason: raw['RtnMsg'] ?? raw['TradeStatusDesc'] ?? 'refund failed',
      raw,
    }
  }

  return {
    status: 'succeeded',
    connectorRefundId: raw['TradeNo'],
    refundedAt: deps.now(),
    simulated: false,
    raw,
  }
}
```

- [ ] **Step 6: Wire helpers into `packages/pay/src/service.ts`**

Use `deps.fetch ?? globalThis.fetch.bind(globalThis)` and `deps.now ?? (() => new Date())`. Replace local checkout URL constants with `getAioCheckoutUrl()`, then add service methods:

```ts
const fetchImpl = deps.fetch ?? globalThis.fetch.bind(globalThis)
const nowImpl = deps.now ?? (() => new Date())
```

Inside the returned service object:

```ts
async refundCharge(input) {
  return refundEcpayCharge({ ecpay, fetch: fetchImpl, now: nowImpl }, input)
},

async getCharge(input) {
  return queryEcpayTrade({ ecpay, fetch: fetchImpl, now: nowImpl }, input)
},
```

- [ ] **Step 7: Run package tests**

Run:

```bash
bun run --cwd packages/pay test
bun run --cwd packages/pay typecheck
```

Expected: PASS.

- [ ] **Step 8: Commit Phase A**

```bash
git add packages/pay/src
git commit -m "feat(pay): add ecpay query and refund helpers"
```

---

## Phase B — DB Schema And Repositories

### Task B1: Extend `stickerOrder` schema and migration

**Files:**
- Modify: `packages/db/src/schema-private.ts`
- Create: `packages/db/src/migrations/20260425000001_sticker_order_refunds.ts`

- [ ] **Step 1: Update `stickerOrder.status` type and fields**

In `packages/db/src/schema-private.ts`, change status type to:

```ts
.$type<'created' | 'paid' | 'failed' | 'refund_pending' | 'refunded' | 'refund_failed'>()
```

Replace the existing refund future comment with concrete fields:

```ts
refundId: text('refundId'),
refundAmountMinor: integer('refundAmountMinor'),
refundReason: text('refundReason'),
refundRequestedAt: timestamp('refundRequestedAt', { mode: 'string' }),
refundedAt: timestamp('refundedAt', { mode: 'string' }),
refundFailureReason: text('refundFailureReason'),
refundRequestedByUserId: text('refundRequestedByUserId'),
lastReconciledAt: timestamp('lastReconciledAt', { mode: 'string' }),
lastConnectorStatus: text('lastConnectorStatus'),
lastReconciliationMismatch: text('lastReconciliationMismatch'),
```

- [ ] **Step 2: Add manual migration**

`packages/db/src/migrations/20260425000001_sticker_order_refunds.ts`:

```ts
import type { PoolClient } from 'pg'

const sql = `
ALTER TABLE "stickerOrder" ADD COLUMN "refundId" text;
--> statement-breakpoint
ALTER TABLE "stickerOrder" ADD COLUMN "refundAmountMinor" integer;
--> statement-breakpoint
ALTER TABLE "stickerOrder" ADD COLUMN "refundReason" text;
--> statement-breakpoint
ALTER TABLE "stickerOrder" ADD COLUMN "refundRequestedAt" timestamp;
--> statement-breakpoint
ALTER TABLE "stickerOrder" ADD COLUMN "refundedAt" timestamp;
--> statement-breakpoint
ALTER TABLE "stickerOrder" ADD COLUMN "refundFailureReason" text;
--> statement-breakpoint
ALTER TABLE "stickerOrder" ADD COLUMN "refundRequestedByUserId" text;
--> statement-breakpoint
ALTER TABLE "stickerOrder" ADD COLUMN "lastReconciledAt" timestamp;
--> statement-breakpoint
ALTER TABLE "stickerOrder" ADD COLUMN "lastConnectorStatus" text;
--> statement-breakpoint
ALTER TABLE "stickerOrder" ADD COLUMN "lastReconciliationMismatch" text;
--> statement-breakpoint
CREATE UNIQUE INDEX "stickerOrder_refundId_unique" ON "stickerOrder" ("refundId") WHERE "refundId" IS NOT NULL;
`

export async function up(client: PoolClient): Promise<void> {
  await client.query(sql)
}

export async function down(client: PoolClient): Promise<void> {
  await client.query(`
DROP INDEX IF EXISTS "stickerOrder_refundId_unique";
ALTER TABLE "stickerOrder" DROP COLUMN IF EXISTS "lastReconciliationMismatch";
ALTER TABLE "stickerOrder" DROP COLUMN IF EXISTS "lastConnectorStatus";
ALTER TABLE "stickerOrder" DROP COLUMN IF EXISTS "lastReconciledAt";
ALTER TABLE "stickerOrder" DROP COLUMN IF EXISTS "refundRequestedByUserId";
ALTER TABLE "stickerOrder" DROP COLUMN IF EXISTS "refundFailureReason";
ALTER TABLE "stickerOrder" DROP COLUMN IF EXISTS "refundedAt";
ALTER TABLE "stickerOrder" DROP COLUMN IF EXISTS "refundRequestedAt";
ALTER TABLE "stickerOrder" DROP COLUMN IF EXISTS "refundReason";
ALTER TABLE "stickerOrder" DROP COLUMN IF EXISTS "refundAmountMinor";
ALTER TABLE "stickerOrder" DROP COLUMN IF EXISTS "refundId";
`)
}
```

- [ ] **Step 3: Typecheck DB package**

Run:

```bash
bun run --cwd packages/db typecheck
```

Expected: PASS.

### Task B2: Extend order and entitlement repositories

**Files:**
- Modify: `apps/server/src/services/payments/order.repository.ts`
- Modify: `apps/server/src/services/payments/order.repository.test.ts`
- Modify: `apps/server/src/services/payments/order.repository.int.test.ts`
- Modify: `apps/server/src/services/payments/entitlement.repository.ts`
- Modify: `apps/server/src/services/payments/entitlement.repository.test.ts`
- Modify: `apps/server/src/services/payments/entitlement.repository.int.test.ts`

- [ ] **Step 1: Add failing repository unit tests**

Add tests proving these repository methods:

```ts
await repo.beginRefund(tx, 'order-1', {
  refundId: 'refund-order-1',
  refundAmountMinor: 3000,
  refundReason: 'admin_exception',
  refundRequestedByUserId: 'admin-1',
  connectorChargeId: 'charge-abc',
  paidAt: new Date('2026-04-25T01:00:00Z'),
  allowedStatuses: ['paid', 'refund_failed'],
})

await repo.markRefunded(tx, 'order-1', {
  refundedAt: new Date('2026-04-25T01:01:00Z'),
})

await repo.markRefundFailed(tx, 'order-1', { refundFailureReason: 'denied' })

await repo.updateReconciliation(tx, 'order-1', {
  connectorStatus: 'paid',
  mismatch: 'local created, connector paid',
})
```

Expected assertions:

- `beginRefund()` sets `status: 'refund_pending'`, `refundId`, amount, reason, requester, and `updatedAt`.
- `markRefunded()` sets `status: 'refunded'`, `refundedAt`, clears `refundFailureReason`, and returns row count.
- `markRefundFailed()` sets `status: 'refund_failed'` and `refundFailureReason`.
- `updateReconciliation()` sets `lastReconciledAt`, `lastConnectorStatus`, and `lastReconciliationMismatch`.

- [ ] **Step 2: Add failing entitlement repository tests**

Add `revokeByOrder` to the mocked unit test and integration test:

```ts
await repo.revokeByOrder(tx, 'order-1')
```

Expected unit assertion: `tx.delete(entitlement).where(...)` was called.

Expected integration assertion: after granting an entitlement for `order-int-1`, `revokeByOrder(db, 'order-int-1')` deletes it and `find()` returns `null`.

- [ ] **Step 3: Implement repository methods**

Extend `StickerOrderRepository`:

```ts
beginRefund(tx: any, id: string, input: {
  refundId: string
  refundAmountMinor: number
  refundReason: string
  refundRequestedByUserId: string | undefined
  connectorChargeId: string
  paidAt: Date | undefined
  allowedStatuses: Array<'paid' | 'refund_failed' | 'created' | 'failed'>
}): Promise<number>
markRefunded(tx: any, id: string, input: { refundedAt: Date }): Promise<number>
markRefundFailed(tx: any, id: string, input: { refundFailureReason: string }): Promise<number>
updateReconciliation(tx: any, id: string, input: {
  connectorStatus: string
  mismatch: string | undefined
}): Promise<void>
findForReconciliation(tx: any, input: { since: Date; limit: number }): Promise<StickerOrderRow[]>
```

Implementation details:

- `beginRefund()` updates only rows whose `status` is in `allowedStatuses`.
- `markRefunded()` updates only `status='refund_pending'`.
- `markRefundFailed()` updates only `status='refund_pending'`.
- `findForReconciliation()` filters by `createdAt >= since.toISOString()`, status in `created`, `paid`, `failed`, `refund_pending`, `refund_failed`, orders by `createdAt`, and limits by input.

Extend `EntitlementRepository`:

```ts
revokeByOrder(tx: any, orderId: string): Promise<number>
```

Implementation returns the delete row count, defaulting to `0`.

- [ ] **Step 4: Run server unit tests for repositories**

Run:

```bash
bun run --cwd apps/server test:unit -- src/services/payments/order.repository.test.ts src/services/payments/entitlement.repository.test.ts
```

Expected: PASS.

- [ ] **Step 5: Run DB integration tests for repositories**

Run:

```bash
docker compose up -d pgdb migrate
ZERO_UPSTREAM_DB=postgresql://user:password@localhost:5533/postgres bun run --cwd apps/server test:integration -- src/services/payments/order.repository.int.test.ts src/services/payments/entitlement.repository.int.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit Phase B**

```bash
git add packages/db/src/schema-private.ts packages/db/src/migrations/20260425000001_sticker_order_refunds.ts apps/server/src/services/payments/order.repository.ts apps/server/src/services/payments/order.repository.test.ts apps/server/src/services/payments/order.repository.int.test.ts apps/server/src/services/payments/entitlement.repository.ts apps/server/src/services/payments/entitlement.repository.test.ts apps/server/src/services/payments/entitlement.repository.int.test.ts
git commit -m "feat(payments): add refund order state"
```

---

## Phase C — Alert Sink And Refund Service

### Task C1: Add `PaymentAlertSink`

**Files:**
- Create: `apps/server/src/services/payments/alert-sink.ts`

- [ ] **Step 1: Create alert sink module**

```ts
export type PaymentAlertSeverity = 'warning' | 'critical'

export type PaymentAlert = {
  type:
    | 'payment.amount_mismatch'
    | 'payment.entitlement_grant_failed'
    | 'payment.refund_failed'
    | 'payment.reconciliation_mismatch'
    | 'payment.webhook_verification_failed'
  severity: PaymentAlertSeverity
  orderId: string | undefined
  message: string
  context: Record<string, unknown>
}

export type PaymentAlertSink = {
  notify(alert: PaymentAlert): Promise<void>
}

type MinLogger = {
  warn(obj: object, msg: string): void
  error(obj: object, msg: string): void
}

export function createLogPaymentAlertSink(log: MinLogger): PaymentAlertSink {
  return {
    async notify(alert) {
      const payload = {
        type: alert.type,
        orderId: alert.orderId,
        context: alert.context,
      }
      if (alert.severity === 'critical') {
        log.error(payload, alert.message)
        return
      }
      log.warn(payload, alert.message)
    },
  }
}
```

### Task C2: Add refund service

**Files:**
- Create: `apps/server/src/services/payments/refund.service.ts`
- Create: `apps/server/src/services/payments/refund.service.test.ts`

- [ ] **Step 1: Write failing refund service tests**

Add these helpers and unit tests:

```ts
import { describe, expect, it, vi } from 'vitest'
import { createRefundService } from './refund.service'
import type { StickerOrderRow } from './order.repository'

function makeOrder(overrides: Partial<StickerOrderRow> = {}): StickerOrderRow {
  return {
    id: 'order-1',
    userId: 'user-1',
    packageId: 'pkg-1',
    amountMinor: 3000,
    currency: 'TWD',
    status: 'paid',
    connectorName: 'ecpay',
    connectorChargeId: 'trade-1',
    paidAt: '2026-04-25T01:00:00.000Z',
    failureReason: null,
    refundId: null,
    refundAmountMinor: null,
    refundReason: null,
    refundRequestedAt: null,
    refundedAt: null,
    refundFailureReason: null,
    refundRequestedByUserId: null,
    lastReconciledAt: null,
    lastConnectorStatus: null,
    lastReconciliationMismatch: null,
    createdAt: '2026-04-25T00:00:00Z',
    updatedAt: '2026-04-25T00:00:00Z',
    ...overrides,
  } as StickerOrderRow
}

function makeRefundDeps(opts: { order: StickerOrderRow; refundResult?: any }) {
  const tx = {}
  const orderRepo = {
    create: vi.fn(),
    findById: vi.fn().mockResolvedValue(opts.order),
    transitionToPaid: vi.fn(),
    transitionToFailed: vi.fn(),
    beginRefund: vi.fn().mockResolvedValue(1),
    markRefunded: vi.fn().mockResolvedValue(1),
    markRefundFailed: vi.fn().mockResolvedValue(1),
    updateReconciliation: vi.fn(),
    findForReconciliation: vi.fn(),
  }
  const entitlementRepo = {
    grant: vi.fn(),
    find: vi.fn(),
    revokeByOrder: vi.fn().mockResolvedValue(1),
  }
  return {
    db: { transaction: vi.fn().mockImplementation((fn) => fn(tx)) },
    pay: {
      createCharge: vi.fn(),
      handleWebhook: vi.fn(),
      getCharge: vi.fn(),
      refundCharge: vi.fn().mockResolvedValue(
        opts.refundResult ?? {
          status: 'succeeded',
          simulated: true,
          refundedAt: new Date('2026-04-25T02:00:00Z'),
          connectorRefundId: undefined,
          raw: {},
        },
      ),
    },
    orderRepo,
    entitlementRepo,
    alerts: { notify: vi.fn().mockResolvedValue(undefined) },
    mode: 'stage' as const,
  }
}

it('refundOrder transitions paid order to refunded and revokes entitlement', async () => {
  const deps = makeRefundDeps({
    order: makeOrder({ status: 'paid', connectorChargeId: 'trade-1' }),
    refundResult: { status: 'succeeded', simulated: true, refundedAt: new Date('2026-04-25T02:00:00Z'), connectorRefundId: undefined, raw: {} },
  })

  const service = createRefundService(deps)
  const result = await service.refundOrder({
    orderId: 'order-1',
    reason: 'admin_exception',
    requestedByUserId: 'admin-1',
  })

  expect(result.status).toBe('refunded')
  expect(deps.orderRepo.beginRefund).toHaveBeenCalledOnce()
  expect(deps.pay.refundCharge).toHaveBeenCalledWith({
    merchantTransactionId: 'order-1',
    connectorChargeId: 'trade-1',
    amount: { minorAmount: 3000, currency: 'TWD' },
    reason: 'admin_exception',
    testMode: true,
  })
  expect(deps.entitlementRepo.revokeByOrder).toHaveBeenCalled()
})

it('refundOrder does not call ECPay for an already refunded order', async () => {
  const deps = makeRefundDeps({ order: makeOrder({ status: 'refunded' }) })
  const service = createRefundService(deps)
  const result = await service.refundOrder({
    orderId: 'order-1',
    reason: 'admin_exception',
    requestedByUserId: 'admin-1',
  })

  expect(result.status).toBe('refunded')
  expect(deps.pay.refundCharge).not.toHaveBeenCalled()
})

it('refundOrder marks refund_failed and alerts when ECPay rejects refund', async () => {
  const deps = makeRefundDeps({
    order: makeOrder({ status: 'paid', connectorChargeId: 'trade-1' }),
    refundResult: { status: 'failed', reason: 'TradeNo not found', raw: {} },
  })

  const service = createRefundService(deps)
  const result = await service.refundOrder({
    orderId: 'order-1',
    reason: 'admin_exception',
    requestedByUserId: 'admin-1',
  })

  expect(result).toMatchObject({ status: 'refund_failed', failureReason: 'TradeNo not found' })
  expect(deps.orderRepo.markRefundFailed).toHaveBeenCalled()
  expect(deps.alerts.notify).toHaveBeenCalledWith(expect.objectContaining({
    type: 'payment.refund_failed',
    severity: 'critical',
    orderId: 'order-1',
  }))
})

it('compensatePaidCharge allows created order with verified connector charge id', async () => {
  const deps = makeRefundDeps({
    order: makeOrder({ status: 'created', connectorChargeId: null }),
    refundResult: { status: 'succeeded', simulated: true, refundedAt: new Date('2026-04-25T02:00:00Z'), connectorRefundId: undefined, raw: {} },
  })

  const service = createRefundService(deps)
  const result = await service.compensatePaidCharge({
    orderId: 'order-1',
    connectorChargeId: 'trade-from-webhook',
    amount: { minorAmount: 3000, currency: 'TWD' },
    paidAt: new Date('2026-04-25T01:00:00Z'),
    reason: 'technical_error',
  })

  expect(result.status).toBe('refunded')
  expect(deps.orderRepo.beginRefund).toHaveBeenCalledWith(expect.anything(), 'order-1', expect.objectContaining({
    connectorChargeId: 'trade-from-webhook',
    allowedStatuses: ['created', 'failed', 'paid', 'refund_failed'],
  }))
})
```

- [ ] **Step 2: Run refund service test and verify failure**

Run:

```bash
bun run --cwd apps/server test:unit -- src/services/payments/refund.service.test.ts
```

Expected: FAIL because `refund.service.ts` does not exist.

- [ ] **Step 3: Implement `createRefundService`**

`apps/server/src/services/payments/refund.service.ts` exports:

```ts
export type RefundReason = 'technical_error' | 'admin_exception'

export function createRefundService(deps: RefundServiceDeps) {
  return {
    async refundOrder(input: RefundOrderInput): Promise<RefundOrderResult> {
      return runRefund(deps, {
        orderId: input.orderId,
        reason: input.reason,
        requestedByUserId: input.requestedByUserId,
        compensation: undefined,
        allowedStatuses: ['paid', 'refund_failed'],
      })
    },

    async compensatePaidCharge(input: CompensatePaidChargeInput): Promise<RefundOrderResult> {
      return runRefund(deps, {
        orderId: input.orderId,
        reason: input.reason,
        requestedByUserId: undefined,
        compensation: input,
        allowedStatuses: ['created', 'failed', 'paid', 'refund_failed'],
      })
    },
  }
}
```

`runRefund()` behavior:

- Load order inside transaction.
- Return current state without external calls for `refunded` or `refund_pending`.
- Throw `ConnectError` with `Code.FailedPrecondition` for admin refund on non-paid orders.
- Generate `refundId` as `refund_${order.id}`.
- Call `orderRepo.beginRefund()` inside transaction.
- Call `pay.refundCharge()` outside transaction.
- On success, call `orderRepo.markRefunded()` and `entitlementRepo.revokeByOrder()` inside transaction.
- On failure, call `orderRepo.markRefundFailed()` and `alerts.notify()`.

- [ ] **Step 4: Run refund service tests**

Run:

```bash
bun run --cwd apps/server test:unit -- src/services/payments/refund.service.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit Phase C**

```bash
git add apps/server/src/services/payments/alert-sink.ts apps/server/src/services/payments/refund.service.ts apps/server/src/services/payments/refund.service.test.ts
git commit -m "feat(payments): add refund orchestration"
```

---

## Phase D — Webhook Compensation And Alerts

### Task D1: Update payment event handler for compensation

**Files:**
- Modify: `apps/server/src/services/payments/event-handler.ts`
- Modify: `apps/server/src/services/payments/event-handler.test.ts`

- [ ] **Step 1: Add failing tests**

Add tests:

```ts
it('alerts amount mismatch', async () => {
  const alerts = { notify: vi.fn().mockResolvedValue(undefined) }
  const order = makeOrder({ amountMinor: 3000, currency: 'TWD' })
  const { orderRepo, entitlementRepo, db } = makeDeps(order)

  await handlePaymentEvent(
    { db, orderRepo, entitlementRepo, alerts },
    {
      kind: 'charge.succeeded',
      merchantTransactionId: 'order-1',
      connectorChargeId: 'charge-abc',
      amount: { minorAmount: 9999, currency: 'TWD' },
      paidAt: new Date('2026-04-25T01:00:00Z'),
    },
    silentLog,
  )

  expect(alerts.notify).toHaveBeenCalledWith(expect.objectContaining({
    type: 'payment.amount_mismatch',
    severity: 'critical',
    orderId: 'order-1',
  }))
})

it('compensates when entitlement grant throws after verified successful charge', async () => {
  const refund = { compensatePaidCharge: vi.fn().mockResolvedValue({ status: 'refunded', simulated: true }) }
  const alerts = { notify: vi.fn().mockResolvedValue(undefined) }
  const order = makeOrder({ status: 'created' })
  const { orderRepo, entitlementRepo, db } = makeDeps(order)
  entitlementRepo.grant = vi.fn().mockRejectedValue(new Error('unique index missing'))

  await handlePaymentEvent(
    { db, orderRepo, entitlementRepo, refund, alerts },
    {
      kind: 'charge.succeeded',
      merchantTransactionId: 'order-1',
      connectorChargeId: 'charge-abc',
      amount: { minorAmount: 3000, currency: 'TWD' },
      paidAt: new Date('2026-04-25T01:00:00Z'),
    },
    silentLog,
  )

  expect(refund.compensatePaidCharge).toHaveBeenCalledWith({
    orderId: 'order-1',
    connectorChargeId: 'charge-abc',
    amount: { minorAmount: 3000, currency: 'TWD' },
    paidAt: new Date('2026-04-25T01:00:00Z'),
    reason: 'technical_error',
  })
  expect(alerts.notify).toHaveBeenCalledWith(expect.objectContaining({
    type: 'payment.entitlement_grant_failed',
    severity: 'critical',
    orderId: 'order-1',
  }))
})
```

- [ ] **Step 2: Implement optional deps**

Extend `PaymentEventDeps`:

```ts
alerts?: PaymentAlertSink
refund?: Pick<ReturnType<typeof createRefundService>, 'compensatePaidCharge'>
```

Wrap `charge.succeeded` handling so entitlement grant failure is caught after the transaction fails. If `deps.refund` is missing, rethrow after alerting; production wiring will pass it.

- [ ] **Step 3: Run event handler tests**

Run:

```bash
bun run --cwd apps/server test:unit -- src/services/payments/event-handler.test.ts
```

Expected: PASS.

### Task D2: Add webhook verification alert

**Files:**
- Modify: `apps/server/src/services/payments/webhook.route.ts`
- Modify: `apps/server/src/services/payments/webhook.route.test.ts`

- [ ] **Step 1: Add failing webhook test**

Add an `alerts` mock to webhook deps and assert bad CheckMacValue emits:

```ts
expect(alerts.notify).toHaveBeenCalledWith(expect.objectContaining({
  type: 'payment.webhook_verification_failed',
  severity: 'warning',
  orderId: undefined,
}))
```

- [ ] **Step 2: Implement alert call**

Extend `WebhookDeps` with `alerts?: PaymentAlertSink`. On `!result.verified`, call:

```ts
await deps.alerts?.notify({
  type: 'payment.webhook_verification_failed',
  severity: 'warning',
  orderId: undefined,
  message: 'ecpay webhook verification failed',
  context: { reason: result.reason },
})
```

- [ ] **Step 3: Run webhook route tests**

Run:

```bash
bun run --cwd apps/server test:unit -- src/services/payments/webhook.route.test.ts
```

Expected: PASS.

- [ ] **Step 4: Commit Phase D**

```bash
git add apps/server/src/services/payments/event-handler.ts apps/server/src/services/payments/event-handler.test.ts apps/server/src/services/payments/webhook.route.ts apps/server/src/services/payments/webhook.route.test.ts
git commit -m "feat(payments): compensate failed entitlement grants"
```

---

## Phase E — Reconciliation Service

### Task E1: Add reconciliation service

**Files:**
- Create: `apps/server/src/services/payments/reconciliation.service.ts`
- Create: `apps/server/src/services/payments/reconciliation.service.test.ts`

- [ ] **Step 1: Write failing reconciliation tests**

Add these helpers and tests:

```ts
import { describe, expect, it, vi } from 'vitest'
import { createReconciliationService } from './reconciliation.service'
import type { StickerOrderRow } from './order.repository'

function makeOrder(overrides: Partial<StickerOrderRow> = {}): StickerOrderRow {
  return {
    id: 'order-1',
    userId: 'user-1',
    packageId: 'pkg-1',
    amountMinor: 3000,
    currency: 'TWD',
    status: 'created',
    connectorName: 'ecpay',
    connectorChargeId: null,
    paidAt: null,
    failureReason: null,
    refundId: null,
    refundAmountMinor: null,
    refundReason: null,
    refundRequestedAt: null,
    refundedAt: null,
    refundFailureReason: null,
    refundRequestedByUserId: null,
    lastReconciledAt: null,
    lastConnectorStatus: null,
    lastReconciliationMismatch: null,
    createdAt: '2026-04-25T00:00:00Z',
    updatedAt: '2026-04-25T00:00:00Z',
    ...overrides,
  } as StickerOrderRow
}

function makeReconciliationDeps(opts: { orders: StickerOrderRow[]; chargeStatus: any }) {
  const tx = {}
  const orderRepo = {
    create: vi.fn(),
    findById: vi.fn(),
    transitionToPaid: vi.fn().mockResolvedValue(1),
    transitionToFailed: vi.fn(),
    beginRefund: vi.fn(),
    markRefunded: vi.fn(),
    markRefundFailed: vi.fn(),
    updateReconciliation: vi.fn().mockResolvedValue(undefined),
    findForReconciliation: vi.fn().mockResolvedValue(opts.orders),
  }
  const entitlementRepo = {
    grant: vi.fn().mockResolvedValue(undefined),
    find: vi.fn(),
    revokeByOrder: vi.fn(),
  }
  return {
    db: { transaction: vi.fn().mockImplementation((fn) => fn(tx)) },
    pay: {
      createCharge: vi.fn(),
      handleWebhook: vi.fn(),
      refundCharge: vi.fn(),
      getCharge: vi.fn().mockResolvedValue(opts.chargeStatus),
    },
    orderRepo,
    entitlementRepo,
    alerts: { notify: vi.fn().mockResolvedValue(undefined) },
  }
}

it('dryRun reports created order that is paid at connector', async () => {
  const deps = makeReconciliationDeps({
    orders: [makeOrder({ id: 'order-1', status: 'created' })],
    chargeStatus: { status: 'paid', connectorChargeId: 'trade-1', amount: { minorAmount: 3000, currency: 'TWD' }, paidAt: new Date('2026-04-25T01:00:00Z'), rawStatus: '1', raw: {} },
  })

  const service = createReconciliationService(deps)
  const result = await service.reconcileOrders({
    since: new Date('2026-04-24T00:00:00Z'),
    limit: 100,
    dryRun: true,
  })

  expect(result.checked).toBe(1)
  expect(result.mismatches[0]).toMatchObject({
    orderId: 'order-1',
    localStatus: 'created',
    connectorStatus: 'paid',
    action: 'reported',
  })
  expect(deps.orderRepo.transitionToPaid).not.toHaveBeenCalled()
})

it('non-dry-run marks failed order paid and grants entitlement when connector is paid', async () => {
  const deps = makeReconciliationDeps({
    orders: [makeOrder({ id: 'order-1', status: 'failed' })],
    chargeStatus: { status: 'paid', connectorChargeId: 'trade-1', amount: { minorAmount: 3000, currency: 'TWD' }, paidAt: new Date('2026-04-25T01:00:00Z'), rawStatus: '1', raw: {} },
  })

  const service = createReconciliationService(deps)
  await service.reconcileOrders({
    since: new Date('2026-04-24T00:00:00Z'),
    limit: 100,
    dryRun: false,
  })

  expect(deps.orderRepo.transitionToPaid).toHaveBeenCalled()
  expect(deps.entitlementRepo.grant).toHaveBeenCalled()
})

it('alerts when local paid order is missing at connector', async () => {
  const deps = makeReconciliationDeps({
    orders: [makeOrder({ id: 'order-1', status: 'paid' })],
    chargeStatus: { status: 'not_found', reason: 'order not found', rawStatus: '10200047', raw: {} },
  })

  const service = createReconciliationService(deps)
  await service.reconcileOrders({
    since: new Date('2026-04-24T00:00:00Z'),
    limit: 100,
    dryRun: false,
  })

  expect(deps.alerts.notify).toHaveBeenCalledWith(expect.objectContaining({
    type: 'payment.reconciliation_mismatch',
    severity: 'critical',
    orderId: 'order-1',
  }))
})
```

- [ ] **Step 2: Implement service**

`createReconciliationService(deps)`:

- Calls `orderRepo.findForReconciliation(db, { since, limit })`.
- For each order, calls `pay.getCharge({ merchantTransactionId: order.id })`.
- Calls `orderRepo.updateReconciliation()` after each query.
- In non-dry-run, applies paid connector state for `created` and `failed` by reusing `orderRepo.transitionToPaid()` + `entitlementRepo.grant()`.
- Emits critical alert for local `paid` with connector `unpaid` or `not_found`.
- Continues batch after per-order query errors and records mismatch text.

- [ ] **Step 3: Run reconciliation tests**

Run:

```bash
bun run --cwd apps/server test:unit -- src/services/payments/reconciliation.service.test.ts
```

Expected: PASS.

- [ ] **Step 4: Commit Phase E**

```bash
git add apps/server/src/services/payments/reconciliation.service.ts apps/server/src/services/payments/reconciliation.service.test.ts
git commit -m "feat(payments): add order reconciliation service"
```

---

## Phase F — Admin ConnectRPC And Service Wiring

### Task F1: Extend proto and generate code

**Files:**
- Modify: `packages/proto/proto/stickerMarket/v1/stickerMarket.proto`
- Modify: `packages/proto/gen/stickerMarket/v1/stickerMarket_pb.ts`

- [ ] **Step 1: Add admin service and messages**

Append to `stickerMarket.proto`:

```proto
service StickerMarketAdminService {
  rpc RefundOrder(RefundOrderRequest) returns (RefundOrderResponse);
  rpc ReconcileStickerOrders(ReconcileStickerOrdersRequest) returns (ReconcileStickerOrdersResponse);
}

enum RefundStatus {
  REFUND_STATUS_UNSPECIFIED = 0;
  REFUND_STATUS_REFUND_PENDING = 1;
  REFUND_STATUS_REFUNDED = 2;
  REFUND_STATUS_REFUND_FAILED = 3;
}

message RefundOrderRequest {
  string order_id = 1;
  string reason = 2;
}

message RefundOrderResponse {
  string order_id = 1;
  RefundStatus status = 2;
  bool simulated = 3;
  string failure_reason = 4;
}

message ReconcileStickerOrdersRequest {
  string since_iso = 1;
  int32 limit = 2;
  bool dry_run = 3;
}

message ReconciliationMismatch {
  string order_id = 1;
  string local_status = 2;
  string connector_status = 3;
  string action = 4;
  string reason = 5;
}

message ReconcileStickerOrdersResponse {
  int32 checked = 1;
  int32 matched = 2;
  repeated ReconciliationMismatch mismatches = 3;
}
```

- [ ] **Step 2: Generate proto code**

Run:

```bash
bun turbo proto:generate
```

Expected: `packages/proto/gen/stickerMarket/v1/stickerMarket_pb.ts` includes `StickerMarketAdminService`.

### Task F2: Add admin handler and route wiring

**Files:**
- Create: `apps/server/src/connect/stickerMarketAdmin.ts`
- Create: `apps/server/src/connect/stickerMarketAdmin.test.ts`
- Modify: `apps/server/src/connect/routes.ts`
- Modify: `apps/server/src/services/payments/index.ts`
- Modify: `apps/server/src/index.ts`

- [ ] **Step 1: Write failing admin handler tests**

Add these helpers and tests:

```ts
import { describe, expect, it, vi } from 'vitest'
import { Code, createContextValues } from '@connectrpc/connect'
import { connectAuthDataKey } from './auth-context'
import { createStickerMarketAdminHandler } from './stickerMarketAdmin'

function makeAuthCtx(authData: { id: string; role?: 'admin' }) {
  const values = createContextValues()
  values.set(connectAuthDataKey, authData as any)
  return {
    values,
    signal: new AbortController().signal,
    timeoutMs: undefined,
    method: {} as any,
    service: {} as any,
    requestMethod: 'POST',
    url: new URL('http://localhost/'),
    peer: { addr: '127.0.0.1' },
    requestHeader: new Headers(),
    responseHeader: new Headers(),
    responseTrailer: new Headers(),
  } as any
}

function makeDeps() {
  return {
    refund: {
      refundOrder: vi.fn().mockResolvedValue({
        orderId: 'order-1',
        status: 'refunded',
        simulated: true,
        failureReason: undefined,
      }),
    },
    reconciliation: {
      reconcileOrders: vi.fn().mockResolvedValue({
        checked: 0,
        matched: 0,
        mismatches: [],
      }),
    },
  }
}

it('rejects non-admin refund with PermissionDenied', async () => {
  const handler = createStickerMarketAdminHandler(makeDeps())
  await expect(
    handler.refundOrder({ orderId: 'order-1', reason: 'admin_exception' }, makeAuthCtx({ id: 'user-1' })),
  ).rejects.toMatchObject({ code: Code.PermissionDenied })
})

it('calls refund service for admin refund', async () => {
  const deps = makeDeps()
  const handler = createStickerMarketAdminHandler(deps)
  const result = await handler.refundOrder(
    { orderId: 'order-1', reason: 'admin_exception' },
    makeAuthCtx({ id: 'admin-1', role: 'admin' }),
  )

  expect(deps.refund.refundOrder).toHaveBeenCalledWith({
    orderId: 'order-1',
    reason: 'admin_exception',
    requestedByUserId: 'admin-1',
  })
  expect(result.status).toBe(2)
})
```

- [ ] **Step 2: Implement admin handler**

`apps/server/src/connect/stickerMarketAdmin.ts`:

```ts
import { Code, ConnectError } from '@connectrpc/connect'
import type { HandlerContext } from '@connectrpc/connect'
import { RefundStatus } from '@vine/proto/stickerMarket'
import { requireAuthData } from './auth-context'

export type StickerMarketAdminHandlerDeps = {
  refund: { refundOrder(input: { orderId: string; reason: 'technical_error' | 'admin_exception'; requestedByUserId: string | undefined }): Promise<any> }
  reconciliation: { reconcileOrders(input: { since: Date; limit: number; dryRun: boolean }): Promise<any> }
}

function requireAdmin(ctx: HandlerContext) {
  const auth = requireAuthData(ctx)
  if (auth.role !== 'admin') {
    throw new ConnectError('admin required', Code.PermissionDenied)
  }
  return auth
}

export function createStickerMarketAdminHandler(deps: StickerMarketAdminHandlerDeps) {
  return {
    async refundOrder(req: { orderId: string; reason: string }, ctx: HandlerContext) {
      const auth = requireAdmin(ctx)
      const reason = req.reason === 'technical_error' ? 'technical_error' : 'admin_exception'
      const result = await deps.refund.refundOrder({
        orderId: req.orderId,
        reason,
        requestedByUserId: auth.id,
      })
      return {
        orderId: result.orderId,
        status: refundStatusToProto(result.status),
        simulated: result.simulated,
        failureReason: result.failureReason ?? '',
      }
    },

    async reconcileStickerOrders(
      req: { sinceIso: string; limit: number; dryRun: boolean },
      ctx: HandlerContext,
    ) {
      requireAdmin(ctx)
      const since = req.sinceIso ? new Date(req.sinceIso) : new Date(Date.now() - 24 * 60 * 60 * 1000)
      const result = await deps.reconciliation.reconcileOrders({
        since,
        limit: req.limit > 0 ? req.limit : 100,
        dryRun: req.dryRun,
      })
      return {
        checked: result.checked,
        matched: result.matched,
        mismatches: result.mismatches,
      }
    },
  }
}

function refundStatusToProto(status: string): RefundStatus {
  switch (status) {
    case 'refund_pending':
      return RefundStatus.REFUND_PENDING
    case 'refunded':
      return RefundStatus.REFUNDED
    case 'refund_failed':
      return RefundStatus.REFUND_FAILED
    default:
      return RefundStatus.UNSPECIFIED
  }
}
```

- [ ] **Step 3: Wire services in `apps/server/src/services/payments/index.ts`**

`createPayments(env, db, log)` should return:

```ts
const alerts = createLogPaymentAlertSink(log)
const refund = createRefundService({
  db,
  pay,
  orderRepo,
  entitlementRepo,
  alerts,
  mode: env.PAYMENTS_ECPAY_MODE,
})
const reconciliation = createReconciliationService({
  db,
  pay,
  orderRepo,
  entitlementRepo,
  alerts,
})
return { pay, orderRepo, entitlementRepo, alerts, refund, reconciliation }
```

Update call sites to pass `app.log` from `apps/server/src/index.ts`.

- [ ] **Step 4: Register admin service in routes**

In `apps/server/src/connect/routes.ts`, import `StickerMarketAdminService` and `createStickerMarketAdminHandler`, extend `ConnectDeps` with `stickerMarketAdmin`, and register:

```ts
router.service(
  StickerMarketAdminService,
  withAuthService(
    StickerMarketAdminService,
    deps.auth,
    createStickerMarketAdminHandler(deps.stickerMarketAdmin),
  ),
)
```

- [ ] **Step 5: Run admin tests and server typecheck**

Run:

```bash
bun run --cwd apps/server test:unit -- src/connect/stickerMarketAdmin.test.ts
bun run --cwd apps/server typecheck
```

Expected: PASS.

- [ ] **Step 6: Commit Phase F**

```bash
git add packages/proto/proto/stickerMarket/v1/stickerMarket.proto packages/proto/gen/stickerMarket/v1/stickerMarket_pb.ts apps/server/src/connect/stickerMarketAdmin.ts apps/server/src/connect/stickerMarketAdmin.test.ts apps/server/src/connect/routes.ts apps/server/src/services/payments/index.ts apps/server/src/index.ts
git commit -m "feat(payments): add admin refund rpc"
```

---

## Phase G — Final Verification

### Task G1: Run focused and full checks

**Files:**
- No source changes expected.

- [ ] **Step 1: Run pay package tests**

```bash
bun run --cwd packages/pay test
```

Expected: PASS.

- [ ] **Step 2: Run server unit tests**

```bash
bun run --cwd apps/server test:unit
```

Expected: PASS.

- [ ] **Step 3: Run server DB integration tests**

```bash
docker compose up -d pgdb migrate
ZERO_UPSTREAM_DB=postgresql://user:password@localhost:5533/postgres bun run --cwd apps/server test:integration
```

Expected: PASS.

- [ ] **Step 4: Run repo-wide checks**

```bash
bun run check:all
```

Expected: PASS.

- [ ] **Step 5: Update roadmap if Phase 1.5 is fully implemented**

Only after all verification commands pass, update `docs/vine-creator-market-roadmap.md`:

```md
### Phase 1.5 — 付款強化(✅ Completed 2026-04-25)
```

Add implementation plan and commit references under Phase 1.5.

- [ ] **Step 6: Commit final docs update**

```bash
git add docs/vine-creator-market-roadmap.md
git commit -m "docs: mark payments hardening complete"
```

---

## Self-Review Checklist

- Spec coverage: refund, automatic compensation, reconciliation, alert sink, admin RPC, tests, and non-goals are mapped to tasks.
- Scope control: no ATM/CVS, Apple Pay, second connector, creator dashboard, payout, tax, or web admin UI work appears in implementation tasks.
- Type consistency: refund statuses use `refund_pending`, `refunded`, and `refund_failed`; admin proto maps these to `RefundStatus`.
- Verification: each phase has a focused test command and commit point; final phase runs package, server unit, server integration, and repo checks.
