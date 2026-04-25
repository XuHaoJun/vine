# Vine Creator Market — Payments MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship end-to-end sticker purchase vertical slice — browse seeded packages → ECPay credit card checkout → entitlement granted → user can send/receive stickers in chat.

**Architecture:** New `@vine/pay` package wraps `@xuhaojun/hyperswitch-prism` (UniFFI in-process) behind a Vine-owned unified `PaymentsService` interface. `apps/server` adds `services/payments` with Drizzle repositories, event handler, Fastify webhook route, and ConnectRPC handlers. Web UI adds store/pay routes and extends chat with sticker picker. Entitlement drives Zero permission-based access; sticker messages use the existing `message.type='sticker'` column.

**Tech Stack:** TypeScript, Fastify, Drizzle, Zero, ConnectRPC (buf + `@connectrpc/connect`), Tamagui, `@xuhaojun/hyperswitch-prism@0.0.8-xuhaojun.1` (ECPay connector, UniFFI FFI), `@vine/drive` (fs backend), Vitest.

**Upstream spec:** [`docs/superpowers/specs/2026-04-23-vine-creator-market-payments-mvp-design.md`](../specs/2026-04-23-vine-creator-market-payments-mvp-design.md)

---

## Execution Order

- **Phase A** — DB + Proto foundation(必須最先完成,其他都依賴)
- **Phase B** — `packages/pay`(可與 Phase A 部分平行,但 integration tests 需要 A 完成)
- **Phase C** — `apps/server/services/payments`(依賴 A + B)
- **Phase D** — Seed + fixtures(依賴 A,可與 C 平行)
- **Phase E** — Web UI store flow(依賴 C proto 產生的 client)
- **Phase F** — Chat integration(依賴 C + E)
- **Phase G** — Done-done 驗證(所有 phase 完成後)

---

## Phase A — Foundation

### Task A1: Add `stickerPackage` + `entitlement` to public schema

**Files:**
- Modify: `packages/db/src/schema-public.ts`
- Test: `packages/db/src/schema-public.test.ts`(新檔,若不存在)

- [ ] **Step 1: Add schema definitions**

在 `packages/db/src/schema-public.ts` 的 import 區加 `uniqueIndex`:

```ts
import {
  boolean,
  check,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core'
```

在檔案尾端(最後一個 `export const` 之後)新增:

```ts
export const stickerPackage = pgTable(
  'stickerPackage',
  {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    description: text('description').notNull().default(''),
    priceMinor: integer('priceMinor').notNull(),
    currency: text('currency').notNull().$type<'TWD'>(),
    coverDriveKey: text('coverDriveKey').notNull(),
    tabIconDriveKey: text('tabIconDriveKey').notNull(),
    stickerCount: integer('stickerCount').notNull(),
    createdAt: timestamp('createdAt', { mode: 'string' }).defaultNow().notNull(),
    updatedAt: timestamp('updatedAt', { mode: 'string' }).defaultNow().notNull(),
  },
  (table) => [index('stickerPackage_createdAt_idx').on(table.createdAt)],
)

export const entitlement = pgTable(
  'entitlement',
  {
    id: text('id').primaryKey(),
    userId: text('userId').notNull(),
    packageId: text('packageId').notNull(),
    grantedByOrderId: text('grantedByOrderId').notNull(),
    grantedAt: timestamp('grantedAt', { mode: 'string' }).defaultNow().notNull(),
  },
  (table) => [
    index('entitlement_userId_idx').on(table.userId),
    uniqueIndex('entitlement_userPackage_unique').on(table.userId, table.packageId),
  ],
)
```

- [ ] **Step 2: Run typecheck to verify schema compiles**

Run: `bun run --cwd packages/db check`
Expected: PASS(無型別錯誤)

- [ ] **Step 3: Generate + apply migration**

Run:
```bash
cd packages/db && bun run drizzle-kit generate
```

Expected:新增一個 migration file(約 `XXXX_stickerPackage_entitlement.sql`)。

確認 migration file 包含 `CREATE TABLE "stickerPackage"` 與 `CREATE TABLE "entitlement"`。

- [ ] **Step 4: Run migration via docker compose**

Run:
```bash
docker compose up -d pgdb migrate
docker compose logs migrate | tail -20
```

Expected:`migrate` 服務顯示新 migration 已 apply。若已 up 先跑 `docker compose restart migrate`。

驗證:
```bash
docker compose exec pgdb psql -U user -d postgres -c '\d "stickerPackage"' 
docker compose exec pgdb psql -U user -d postgres -c '\d entitlement'
```

Expected:看得到兩個表、欄位、索引。

- [ ] **Step 5: Commit**

```bash
git add packages/db/src/schema-public.ts packages/db/src/migrations/
git commit -m "feat(db): add stickerPackage and entitlement tables"
```

---

### Task A2: Add `stickerOrder` to private schema

**Files:**
- Modify: `packages/db/src/schema-private.ts`

- [ ] **Step 1: Add stickerOrder table**

在 `packages/db/src/schema-private.ts` 檔案尾端新增:

```ts
export const stickerOrder = pgTable(
  'stickerOrder',
  {
    id: text('id').primaryKey(),
    userId: text('userId').notNull(),
    packageId: text('packageId').notNull(),
    amountMinor: integer('amountMinor').notNull(),
    currency: text('currency').notNull().$type<'TWD'>(),
    status: text('status').notNull().$type<'created' | 'paid' | 'failed'>().default('created'),
    connectorName: text('connectorName').notNull().$type<'ecpay'>(),
    connectorChargeId: text('connectorChargeId'),
    paidAt: timestamp('paidAt', { mode: 'string' }),
    failureReason: text('failureReason'),
    // FUTURE(refund): add refundedAt / refundedAmountMinor when refund capability is added
    createdAt: timestamp('createdAt', { mode: 'string' }).defaultNow().notNull(),
    updatedAt: timestamp('updatedAt', { mode: 'string' }).defaultNow().notNull(),
  },
  (table) => [
    index('stickerOrder_userId_idx').on(table.userId),
    index('stickerOrder_status_idx').on(table.status),
  ],
)
```

若 `schema-private.ts` 開頭沒 `import { pgTable, text, integer, timestamp, index } from 'drizzle-orm/pg-core'`,補上。

- [ ] **Step 2: Typecheck**

Run: `bun run --cwd packages/db check`
Expected: PASS

- [ ] **Step 3: Generate + apply migration**

Run:
```bash
cd packages/db && bun run drizzle-kit generate
docker compose restart migrate
docker compose logs migrate | tail -20
```

Expected:新 migration apply 成功,`docker compose exec pgdb psql -U user -d postgres -c '\d "stickerOrder"'` 有三個 index(pk、userId、status)。

- [ ] **Step 4: Commit**

```bash
git add packages/db/src/schema-private.ts packages/db/src/migrations/
git commit -m "feat(db): add stickerOrder table (private schema)"
```

---

### Task A3: Expose `stickerPackage` and `entitlement` via Zero

**Files:**
- Create: `packages/zero-schema/src/models/stickerPackage.ts`
- Create: `packages/zero-schema/src/models/entitlement.ts`
- Modify: `packages/zero-schema/src/schema.ts`
- Modify: `packages/zero-schema/src/relationships.ts`

先讀 existing models 了解 pattern:`packages/zero-schema/src/models/todo.ts` 或 `user.ts`。

- [ ] **Step 1: Create stickerPackage model**

檔案 `packages/zero-schema/src/models/stickerPackage.ts`:

```ts
import { table, string, number } from '@rocicorp/zero'

export const stickerPackage = table('stickerPackage')
  .columns({
    id: string(),
    name: string(),
    description: string(),
    priceMinor: number(),
    currency: string(),
    coverDriveKey: string(),
    tabIconDriveKey: string(),
    stickerCount: number(),
    createdAt: string(),
    updatedAt: string(),
  })
  .primaryKey('id')
```

(確切 builder API 依 `@rocicorp/zero` 版本略異 — 讀一個既存 model 檔 copy-adapt,此處以語意為準)

- [ ] **Step 2: Create entitlement model with permission**

檔案 `packages/zero-schema/src/models/entitlement.ts`:

```ts
import { table, string } from '@rocicorp/zero'

export const entitlement = table('entitlement')
  .columns({
    id: string(),
    userId: string(),
    packageId: string(),
    grantedByOrderId: string(),
    grantedAt: string(),
  })
  .primaryKey('id')

// Server-side permission: user 只看到自己的 entitlement
// 加到 permissions 定義時:serverWhere: (q, { authData }) => q.where('userId', authData.userID)
```

- [ ] **Step 3: Register tables in schema**

Modify `packages/zero-schema/src/schema.ts`:加 import:
```ts
import { stickerPackage } from './models/stickerPackage'
import { entitlement } from './models/entitlement'
```

把兩者加進 `tables` 陣列(或等效結構,依現有檔案)。

- [ ] **Step 4: Add entitlement relationship to stickerPackage**

Modify `packages/zero-schema/src/relationships.ts`:
```ts
// 如 relationships builder 支援,加:
// entitlement.relationships = { package: one(stickerPackage, { id: entitlement.packageId }) }
// 確切 API 依現有 pattern(例如 chatMember → chat)
```

參考現有 `friendship` 或 `chatMember` 的 relationship 寫法。

- [ ] **Step 5: Add server-side permission for entitlement**

找到 Zero permissions / customMutators 定義檔(可能在 `packages/zero-schema/src/server/` 或 `augment.ts`),為 `entitlement` 加 row-level filter:僅 `userId === authData.userID` 可讀。

若現有 schema 沒此機制,在 `packages/zero-schema/src/augment.ts` 加:
```ts
// entitlement: 讀權限限定自己的
permissions.entitlement = {
  select: { where: (q, authData) => q.where('userId', authData.userID) },
}
```

實際 API 依現有慣例 — 讀 `augment.ts` 既有寫法 adapt。

- [ ] **Step 6: Regenerate + typecheck**

Run:
```bash
bun run --cwd packages/zero-schema build
bun run --cwd packages/zero-schema check
```

Expected: PASS。

- [ ] **Step 7: Restart Zero service**

Run:
```bash
docker compose restart zero
docker compose logs zero | tail -30
```

Expected:Zero 啟動,log 顯示新表已被 replicate。

- [ ] **Step 8: Commit**

```bash
git add packages/zero-schema/
git commit -m "feat(zero): expose stickerPackage and entitlement"
```

---

### Task A4: Define `stickerMarket.v1` proto

**Files:**
- Create: `packages/proto/proto/stickerMarket/v1/stickerMarket.proto`

- [ ] **Step 1: Create proto file**

檔案 `packages/proto/proto/stickerMarket/v1/stickerMarket.proto`:

```proto
syntax = "proto3";
package stickerMarket.v1;

// --- MVP slice ---
service StickerMarketUserService {
  rpc CreateCheckout(CreateCheckoutRequest) returns (CreateCheckoutResponse);
  rpc GetOrder(GetOrderRequest) returns (GetOrderResponse);
}

// --- FUTURE: StickerMarketCreatorService, StickerMarketAdminService ---
// 預留 — 本 slice 不實作,避免上架 / 審核 / Payout proto 污染 handler 實作。

// --- Shared types ---
message Money {
  int32 minor_amount = 1;
  string currency = 2;
}

enum OrderStatus {
  ORDER_STATUS_UNSPECIFIED = 0;
  ORDER_STATUS_CREATED = 1;
  ORDER_STATUS_PAID = 2;
  ORDER_STATUS_FAILED = 3;
}

message RedirectFormPost {
  string target_url = 1;
  map<string, string> form_fields = 2;
}

// --- Requests / Responses ---
message CreateCheckoutRequest {
  string package_id = 1;
  bool simulate_paid = 2;  // dev-only; server rejects when PAYMENTS_ECPAY_MODE != 'stage'
}

message CreateCheckoutResponse {
  string order_id = 1;
  RedirectFormPost redirect = 2;
}

message GetOrderRequest { string order_id = 1; }

message GetOrderResponse {
  string order_id = 1;
  OrderStatus status = 2;
  string failure_reason = 3;
  int32 amount_minor = 4;
  string currency = 5;
}
```

- [ ] **Step 2: Run proto codegen**

Run: `bun run --cwd packages/proto proto:generate`

Expected:`packages/proto/gen/` 下新增 `stickerMarket/v1/stickerMarket_pb.ts` 與 `stickerMarket_connect.ts`(或等效檔名)。

若 turbo cache 作怪:`bun run --cwd packages/proto build`。

- [ ] **Step 3: Verify generated types importable**

Run:
```bash
bun run -e "import { StickerMarketUserService } from '@vine/proto/stickerMarket/v1/stickerMarket_connect'; console.log(StickerMarketUserService.typeName)"
```

若路徑不對,讀 `packages/proto/package.json` 的 exports 取正確 import path。

Expected:列印 `stickerMarket.v1.StickerMarketUserService`。

- [ ] **Step 4: Commit**

```bash
git add packages/proto/proto/stickerMarket/ packages/proto/gen/
git commit -m "feat(proto): define stickerMarket.v1 with user service"
```

---

### Task A5: Confirm `packages/pay` skeleton exists

**Files:**
- Read: `packages/pay/package.json`(已於 brainstorming 建立)
- Read: `packages/pay/src/index.ts`

- [ ] **Step 1: Verify package scaffolded**

Run: `cat packages/pay/package.json`
Expected:`"name": "@vine/pay"`,`"dependencies"` 包含 `"@xuhaojun/hyperswitch-prism": "0.0.8-xuhaojun.1"`。

若不存在,照 spec §2 建立。

Run: `ls packages/pay/node_modules/@xuhaojun/hyperswitch-prism/`
Expected:有 `dist/`、`package.json` 等。若無,跑 `bun install` 根目錄。

- [ ] **Step 2: Add tsconfig**

檔案 `packages/pay/tsconfig.json`(若不存在):
```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "rootDir": "src",
    "outDir": "dist",
    "composite": true,
    "types": ["node"]
  },
  "include": ["src/**/*"]
}
```

若根目錄無 `tsconfig.base.json`,讀 `packages/drive/tsconfig.json` adapt。

- [ ] **Step 3: Verify typecheck works**

Run: `bun run --cwd packages/pay check` 或 `bunx tsc --noEmit -p packages/pay`
Expected: PASS(或無 tsconfig 時明確錯誤,依現有慣例處理)。

- [ ] **Step 4: Commit**

若 tsconfig 為新增:
```bash
git add packages/pay/tsconfig.json
git commit -m "chore(pay): add tsconfig"
```

否則跳過此 commit。

---

## Phase B — `packages/pay` implementation

### Task B1: Define public types

**Files:**
- Create: `packages/pay/src/types.ts`
- Modify: `packages/pay/src/index.ts`

- [ ] **Step 1: Write types.ts**

```ts
// packages/pay/src/types.ts

export type Currency = 'TWD' | 'USD'

export type Money = {
  minorAmount: number
  currency: Currency
}

export type CreateChargeInput = {
  merchantTransactionId: string
  amount: Money
  description: string
  returnUrl: string
  orderResultUrl: string
  clientBackUrl?: string
  idempotencyKey: string
  testMode?: {
    simulatePaid?: boolean
  }
}

export type ChargeAction =
  | { type: 'redirect_form_post'; targetUrl: string; formFields: Record<string, string> }
  | { type: 'redirect_url'; url: string }

export type CreateChargeResult = {
  status: 'pending_action'
  action: ChargeAction
  connectorName: 'ecpay'
}

export type WebhookEvent =
  | {
      kind: 'charge.succeeded'
      merchantTransactionId: string
      connectorChargeId: string
      amount: Money
      paidAt: Date
    }
  | {
      kind: 'charge.failed'
      merchantTransactionId: string
      reason: string
    }
  | { kind: 'unknown'; raw: unknown }

export type HandleWebhookInput = {
  rawBody: Buffer
  headers: Record<string, string | string[] | undefined>
  contentType: string
}

export type HandleWebhookResult =
  | {
      verified: true
      event: WebhookEvent
      ackReply: { status: number; body: string }
    }
  | {
      verified: false
      reason: string
      ackReply: { status: number; body: string }
    }

export type EcpayCredentials = {
  merchantId: string
  hashKey: string
  hashIv: string
  mode: 'stage' | 'prod'
}

export type PaymentsServiceDeps = {
  connector: 'ecpay'
  ecpay: EcpayCredentials
  libPath?: string
}

export type PaymentsService = {
  createCharge(input: CreateChargeInput): Promise<CreateChargeResult>
  handleWebhook(input: HandleWebhookInput): Promise<HandleWebhookResult>
  // FUTURE(refund): refund(chargeId: string, amount?: Money): Promise<RefundResult>
  //   當用戶退款或 entitlement grant 失敗需要補償時啟用
  // FUTURE(sync): getCharge(merchantTransactionId: string): Promise<ChargeStatus>
  //   對帳 / reconciliation 用
}
```

- [ ] **Step 2: Update index.ts**

```ts
// packages/pay/src/index.ts
export * from './types'
export { createPaymentsService } from './service'
export { PaymentsError, VerificationError, ConfigError, IntegrationError } from './errors'
```

(service / errors 下一個 task 才建,這邊 import 會先 fail,但 Step 3 typecheck 會在 Step 2 單獨跑過 types.ts。)

實際上先**只 export types**,避免 index.ts fail:

```ts
export * from './types'
```

- [ ] **Step 3: Typecheck**

Run: `bun run --cwd packages/pay check`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add packages/pay/src/types.ts packages/pay/src/index.ts
git commit -m "feat(pay): define public types"
```

---

### Task B2: Define errors

**Files:**
- Create: `packages/pay/src/errors.ts`

- [ ] **Step 1: Write errors.ts**

```ts
// packages/pay/src/errors.ts

export class PaymentsError extends Error {
  constructor(message: string, public readonly cause?: unknown) {
    super(message)
    this.name = 'PaymentsError'
  }
}

export class ConfigError extends PaymentsError {
  constructor(message: string) {
    super(message)
    this.name = 'ConfigError'
  }
}

export class VerificationError extends PaymentsError {
  constructor(message: string, cause?: unknown) {
    super(message, cause)
    this.name = 'VerificationError'
  }
}

export class IntegrationError extends PaymentsError {
  constructor(message: string, cause?: unknown) {
    super(message, cause)
    this.name = 'IntegrationError'
  }
}
```

- [ ] **Step 2: Re-export in index.ts**

```ts
// packages/pay/src/index.ts
export * from './types'
export * from './errors'
```

- [ ] **Step 3: Typecheck**

Run: `bun run --cwd packages/pay check`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add packages/pay/src/errors.ts packages/pay/src/index.ts
git commit -m "feat(pay): add error classes"
```

---

### Task B3: CheckMacValue test helper (TDD with golden vectors)

**Files:**
- Create: `packages/pay/src/test-utils/ecpay-mac.ts`
- Create: `packages/pay/src/test-utils/ecpay-mac.test.ts`

官方測試向量在 `docs/ECPay-API-Skill/guides/13-checkmacvalue.md`。

- [ ] **Step 1: Read ECPay MAC spec**

Run: `grep -A 40 "測試向量\|Test Vector\|CheckMacValue =" docs/ECPay-API-Skill/guides/13-checkmacvalue.md | head -80`

從中找一組已知 input → 已知 CheckMacValue 作為 golden vector。

- [ ] **Step 2: Write failing test with golden vector**

```ts
// packages/pay/src/test-utils/ecpay-mac.test.ts

import { describe, it, expect } from 'vitest'
import { computeCheckMacValue, signFormBody } from './ecpay-mac'

// Golden vector:官方 doc 範例(取自 ECPay 13-checkmacvalue.md)
// 替換成你在 Step 1 找到的實際測試向量
const HASH_KEY = 'pwFHCqoQZGmho4w6'
const HASH_IV = 'EkRm7iFT261dpevs'

describe('computeCheckMacValue', () => {
  it('produces known-good MAC for reference example', () => {
    const params = {
      MerchantID: '3002607',
      MerchantTradeNo: 'test_001',
      TradeAmt: '75',
      // ... 其他 ECPay spec 範例欄位
    }
    const mac = computeCheckMacValue(params, HASH_KEY, HASH_IV)
    expect(mac).toMatch(/^[A-F0-9]{64}$/)  // SHA256 大寫
    // expect(mac).toBe('<從 docs 找到的預期值>')
  })

  it('is deterministic given same inputs', () => {
    const params = { A: '1', B: '2' }
    expect(computeCheckMacValue(params, HASH_KEY, HASH_IV))
      .toBe(computeCheckMacValue(params, HASH_KEY, HASH_IV))
  })

  it('changes when any param changes', () => {
    const a = computeCheckMacValue({ X: '1' }, HASH_KEY, HASH_IV)
    const b = computeCheckMacValue({ X: '2' }, HASH_KEY, HASH_IV)
    expect(a).not.toBe(b)
  })
})

describe('signFormBody', () => {
  it('returns Buffer with CheckMacValue appended', () => {
    const body = signFormBody({ MerchantTradeNo: 'o_1', TradeAmt: '75' }, HASH_KEY, HASH_IV)
    const decoded = body.toString('utf8')
    expect(decoded).toContain('CheckMacValue=')
    expect(decoded).toContain('MerchantTradeNo=o_1')
  })
})
```

- [ ] **Step 3: Run test, verify fails**

Run: `bun run --cwd packages/pay test -- test-utils/ecpay-mac.test.ts`
Expected: FAIL("Cannot find module" 或類似)

若 `packages/pay` 還沒設定 test command,加到 `packages/pay/package.json` scripts:
```json
"test": "vitest run",
"test:watch": "vitest"
```
並 `bun add -D vitest typescript` 到 packages/pay。

- [ ] **Step 4: Implement ecpay-mac.ts**

```ts
// packages/pay/src/test-utils/ecpay-mac.ts

import { createHash } from 'crypto'

/**
 * ECPay CheckMacValue 演算法(AIO,SHA256 模式)。
 * Ref: docs/ECPay-API-Skill/guides/13-checkmacvalue.md
 *
 * 1. 依 key A-Z 排序 params
 * 2. 以 & 串接 key=value
 * 3. 前接 HashKey=<hashKey>&,後接 &HashIV=<hashIv>
 * 4. ECPay 客製化 URL encode(lowercase encoded hex)
 * 5. SHA256 → 大寫
 */
export function computeCheckMacValue(
  params: Record<string, string>,
  hashKey: string,
  hashIv: string,
): string {
  const sortedKeys = Object.keys(params).filter((k) => k !== 'CheckMacValue').sort((a, b) => a.localeCompare(b))
  const joined = sortedKeys.map((k) => `${k}=${params[k]}`).join('&')
  const raw = `HashKey=${hashKey}&${joined}&HashIV=${hashIv}`
  const encoded = ecpayUrlEncode(raw).toLowerCase()
  return createHash('sha256').update(encoded).digest('hex').toUpperCase()
}

/**
 * ECPay-specific URL encode(與 RFC3986 有差異,見 ECPay 文件)。
 * 主要特別保留字元:`-_.!*()` 不編碼,其餘與標準 encodeURIComponent 相近。
 */
function ecpayUrlEncode(s: string): string {
  // ECPay 官方:PHP urlencode 版本,空白 → "+",保留 -_.!*()
  return encodeURIComponent(s)
    .replace(/%20/g, '+')
    .replace(/%21/g, '!')
    .replace(/%28/g, '(')
    .replace(/%29/g, ')')
    .replace(/%2A/g, '*')
    .replace(/%2D/g, '-')
    .replace(/%2E/g, '.')
    .replace(/%5F/g, '_')
}

/**
 * 產生一個合法的 ECPay form body(含 CheckMacValue),用於測試 webhook。
 */
export function signFormBody(
  params: Record<string, string>,
  hashKey: string,
  hashIv: string,
): Buffer {
  const mac = computeCheckMacValue(params, hashKey, hashIv)
  const full: Record<string, string> = { ...params, CheckMacValue: mac }
  const body = Object.entries(full)
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join('&')
  return Buffer.from(body, 'utf8')
}
```

- [ ] **Step 5: Run test, verify passes**

Run: `bun run --cwd packages/pay test -- test-utils/ecpay-mac.test.ts`
Expected: all pass

若 golden vector 的預期值你 Step 1 沒找到具體值,把 `expect(mac).toBe(...)` 註解掉,只留格式斷言,後續 Task B4 整合測試時與 prism 的驗證結果互相對照即可。

- [ ] **Step 6: Commit**

```bash
git add packages/pay/src/test-utils/ packages/pay/package.json
git commit -m "feat(pay): add ECPay CheckMacValue test helper"
```

---

### Task B4: Implement `handleWebhook` via prism EventClient

**Files:**
- Create: `packages/pay/src/prism/client.ts`
- Create: `packages/pay/src/prism/ecpay-config.ts`
- Create: `packages/pay/src/service.ts`
- Create: `packages/pay/src/service.test.ts`

- [ ] **Step 1: Sketch prism ConnectorConfig for ECPay**

```ts
// packages/pay/src/prism/ecpay-config.ts

import { types } from '@xuhaojun/hyperswitch-prism'
import type { EcpayCredentials } from '../types'

export function buildEcpayConnectorConfig(creds: EcpayCredentials): types.IConnectorConfig {
  // prism 的 ConnectorConfig 格式:依 proto.d.ts 的 ConnectorConfig 結構
  // ECPay 特有欄位透過 connectorConfig.ecpay 傳(prism 的 connector 名稱 = 'ecpay')
  return {
    connectorConfig: {
      ecpay: {
        merchantId: { value: creds.merchantId },
        hashKey: { value: creds.hashKey },
        hashIv: { value: creds.hashIv },
      },
    } as unknown as types.ConnectorConfig['connectorConfig'],
    // 未來:若 prism 有 mode / sandbox flag 設定,在此傳遞
  }
}
```

> **如果欄位名 / 型別跟實際 `types.ConnectorConfig` 不符**(spec §12 假設之一),讀 `node_modules/@xuhaojun/hyperswitch-prism/dist/src/payments/generated/proto.d.ts` 找 `IConnectorConfig` 與 `ecpay` 相關 interface,adapt 欄位名。

- [ ] **Step 2: Build prism client wrapper**

```ts
// packages/pay/src/prism/client.ts

import { PaymentClient, EventClient, types } from '@xuhaojun/hyperswitch-prism'
import type { EcpayCredentials } from '../types'
import { buildEcpayConnectorConfig } from './ecpay-config'

export type PrismClients = {
  paymentClient: PaymentClient
  eventClient: EventClient
}

export function createPrismClients(creds: EcpayCredentials, libPath?: string): PrismClients {
  const config = buildEcpayConnectorConfig(creds)
  const paymentClient = new PaymentClient(config, undefined, libPath)
  const eventClient = new EventClient(config, undefined, libPath)
  return { paymentClient, eventClient }
}
```

- [ ] **Step 3: Write failing test for handleWebhook**

```ts
// packages/pay/src/service.test.ts

import { describe, it, expect } from 'vitest'
import { createPaymentsService } from './service'
import { signFormBody } from './test-utils/ecpay-mac'

const STAGE_CREDS = {
  merchantId: '3002607',
  hashKey: 'pwFHCqoQZGmho4w6',
  hashIv: 'EkRm7iFT261dpevs',
  mode: 'stage' as const,
}

describe('handleWebhook', () => {
  it('verified=true with charge.succeeded for RtnCode=1', async () => {
    const pay = createPaymentsService({ connector: 'ecpay', ecpay: STAGE_CREDS })
    const rawBody = signFormBody(
      {
        MerchantID: '3002607',
        MerchantTradeNo: 'o_test_001',
        TradeAmt: '75',
        RtnCode: '1',
        RtnMsg: '交易成功',
        TradeNo: '2402230000000001',
        PaymentDate: '2026/04/23 12:34:56',
        PaymentType: 'Credit_CreditCard',
        SimulatePaid: '0',
      },
      STAGE_CREDS.hashKey,
      STAGE_CREDS.hashIv,
    )
    const res = await pay.handleWebhook({
      rawBody,
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      contentType: 'application/x-www-form-urlencoded',
    })
    expect(res.verified).toBe(true)
    if (res.verified) {
      expect(res.event.kind).toBe('charge.succeeded')
      if (res.event.kind === 'charge.succeeded') {
        expect(res.event.merchantTransactionId).toBe('o_test_001')
        expect(res.event.connectorChargeId).toBe('2402230000000001')
        expect(res.event.amount).toEqual({ minorAmount: 75, currency: 'TWD' })
      }
      expect(res.ackReply.body).toBe('1|OK')
    }
  })

  it('verified=false when CheckMacValue is wrong', async () => {
    const pay = createPaymentsService({ connector: 'ecpay', ecpay: STAGE_CREDS })
    const tampered = Buffer.from('MerchantTradeNo=o_1&TradeAmt=75&RtnCode=1&CheckMacValue=DEADBEEF', 'utf8')
    const res = await pay.handleWebhook({
      rawBody: tampered,
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      contentType: 'application/x-www-form-urlencoded',
    })
    expect(res.verified).toBe(false)
  })

  it('verified=true with charge.failed for RtnCode != 1', async () => {
    const pay = createPaymentsService({ connector: 'ecpay', ecpay: STAGE_CREDS })
    const rawBody = signFormBody(
      {
        MerchantID: '3002607',
        MerchantTradeNo: 'o_fail_001',
        TradeAmt: '75',
        RtnCode: '10100058',
        RtnMsg: '授權失敗',
        TradeNo: '',
        PaymentDate: '',
        PaymentType: 'Credit_CreditCard',
        SimulatePaid: '0',
      },
      STAGE_CREDS.hashKey,
      STAGE_CREDS.hashIv,
    )
    const res = await pay.handleWebhook({
      rawBody,
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      contentType: 'application/x-www-form-urlencoded',
    })
    expect(res.verified).toBe(true)
    if (res.verified) {
      expect(res.event.kind).toBe('charge.failed')
    }
  })
})
```

- [ ] **Step 4: Run test, verify fails**

Run: `bun run --cwd packages/pay test -- service.test.ts`
Expected: FAIL(`createPaymentsService` not defined)

- [ ] **Step 5: Implement service.ts — createPaymentsService + handleWebhook**

```ts
// packages/pay/src/service.ts

import type {
  CreateChargeInput,
  CreateChargeResult,
  HandleWebhookInput,
  HandleWebhookResult,
  PaymentsService,
  PaymentsServiceDeps,
  WebhookEvent,
  Money,
} from './types'
import { ConfigError, IntegrationError, VerificationError } from './errors'
import { createPrismClients, type PrismClients } from './prism/client'
import { types } from '@xuhaojun/hyperswitch-prism'

export function createPaymentsService(deps: PaymentsServiceDeps): PaymentsService {
  if (deps.connector !== 'ecpay') {
    throw new ConfigError(`unsupported connector: ${deps.connector}`)
  }

  const prism = createPrismClients(deps.ecpay, deps.libPath)

  return {
    createCharge: (input) => createChargeImpl(input, prism, deps),
    handleWebhook: (input) => handleWebhookImpl(input, prism, deps),
  }
}

async function handleWebhookImpl(
  input: HandleWebhookInput,
  prism: PrismClients,
  deps: PaymentsServiceDeps,
): Promise<HandleWebhookResult> {
  const req: types.IEventServiceHandleRequest = {
    merchantEventId: generateEventId(),
    requestDetails: {
      method: types.HttpMethod.POST,
      uri: '',
      headers: flattenHeaders(input.headers),
      body: new Uint8Array(input.rawBody),
      queryParams: '',
    },
    webhookSecrets: {
      secret: deps.ecpay.hashKey,
      additionalSecret: deps.ecpay.hashIv,
    },
  }

  let res: types.EventServiceHandleResponse
  try {
    res = await prism.eventClient.handleEvent(req)
  } catch (err) {
    return {
      verified: false,
      reason: `prism handleEvent threw: ${(err as Error).message}`,
      ackReply: { status: 400, body: '0|invalid' },
    }
  }

  if (!res.sourceVerified) {
    return {
      verified: false,
      reason: 'signature verification failed',
      ackReply: {
        status: 400,
        body: res.eventAckResponse?.body ?? '0|invalid',
      },
    }
  }

  const event = normalizeEvent(res)
  return {
    verified: true,
    event,
    ackReply: {
      status: (res.eventAckResponse?.statusCode as number | undefined) ?? 200,
      body: res.eventAckResponse?.body ?? '1|OK',
    },
  }
}

function normalizeEvent(res: types.EventServiceHandleResponse): WebhookEvent {
  const content = res.eventContent
  // prism 的 eventType + eventContent 依 connector 可能差異很大。
  // 這邊依 ECPay 實際回傳 normalize。若欄位名不同,讀 proto.d.ts 的 EventContent / WebhookEventType。
  const eventType = res.eventType

  if (eventType === types.WebhookEventType.PAYMENT_SUCCESS) {
    return {
      kind: 'charge.succeeded',
      merchantTransactionId: content?.payment?.merchantTransactionId ?? '',
      connectorChargeId: content?.payment?.connectorTransactionId ?? '',
      amount: {
        minorAmount: content?.payment?.amount?.minorAmount ?? 0,
        currency: 'TWD',
      },
      paidAt: new Date(),
    }
  }

  if (eventType === types.WebhookEventType.PAYMENT_FAILURE) {
    return {
      kind: 'charge.failed',
      merchantTransactionId: content?.payment?.merchantTransactionId ?? '',
      reason: content?.payment?.errorMessage ?? 'unknown',
    }
  }

  return { kind: 'unknown', raw: res }
}

async function createChargeImpl(
  input: CreateChargeInput,
  prism: PrismClients,
  deps: PaymentsServiceDeps,
): Promise<CreateChargeResult> {
  // 下一個 task(B5)實作。這邊先 stub,讓 handleWebhook 測試先過。
  throw new IntegrationError('createCharge not implemented yet (Task B5)')
}

// --- helpers ---

function generateEventId(): string {
  return `evt_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`
}

function flattenHeaders(
  headers: Record<string, string | string[] | undefined>,
): Record<string, string> {
  const out: Record<string, string> = {}
  for (const [k, v] of Object.entries(headers)) {
    if (v === undefined) continue
    out[k] = Array.isArray(v) ? v.join(',') : v
  }
  return out
}
```

- [ ] **Step 6: Run test, verify handleWebhook tests pass**

Run: `bun run --cwd packages/pay test -- service.test.ts -t 'handleWebhook'`
Expected: 3 passing

> **如果 prism 的 event type enum / content 路徑不同**:讀 `node_modules/@xuhaojun/hyperswitch-prism/dist/src/payments/generated/proto.d.ts` 搜尋 `WebhookEventType`、`EventContent`,修正 `normalizeEvent` 的欄位。若 prism 驗證 ECPay webhook 有 bug,**fallback**:在 `packages/pay/src/prism/ecpay-webhook.ts` 新增手工 parse + 用 `computeCheckMacValue` 自行驗。

- [ ] **Step 7: Commit**

```bash
git add packages/pay/src/service.ts packages/pay/src/prism/ packages/pay/src/service.test.ts
git commit -m "feat(pay): implement handleWebhook via prism EventClient"
```

---

### Task B5: Implement `createCharge` via prism PaymentClient

**Files:**
- Modify: `packages/pay/src/service.ts`
- Modify: `packages/pay/src/service.test.ts`

- [ ] **Step 1: Add failing test**

Append 到 `service.test.ts`:

```ts
describe('createCharge', () => {
  const baseInput = {
    merchantTransactionId: 'o_cc_001',
    amount: { minorAmount: 75, currency: 'TWD' as const },
    description: '貓咪日常 40 款',
    returnUrl: 'http://localhost:3001/webhooks/ecpay',
    orderResultUrl: 'http://localhost:3000/pay/result',
    idempotencyKey: 'o_cc_001',
  }

  it('returns redirect_form_post action', async () => {
    const pay = createPaymentsService({ connector: 'ecpay', ecpay: STAGE_CREDS })
    const res = await pay.createCharge(baseInput)
    expect(res.status).toBe('pending_action')
    expect(res.action.type).toBe('redirect_form_post')
    if (res.action.type === 'redirect_form_post') {
      expect(res.action.targetUrl).toContain('payment-stage.ecpay.com.tw')
      expect(res.action.formFields.MerchantTradeNo).toBe('o_cc_001')
      expect(res.action.formFields.TotalAmount).toBe('75')
      expect(res.action.formFields.CheckMacValue).toMatch(/^[A-F0-9]{64}$/)
    }
    expect(res.connectorName).toBe('ecpay')
  })

  it('injects SimulatePaid=1 in stage when testMode.simulatePaid', async () => {
    const pay = createPaymentsService({ connector: 'ecpay', ecpay: STAGE_CREDS })
    const res = await pay.createCharge({ ...baseInput, testMode: { simulatePaid: true } })
    if (res.action.type === 'redirect_form_post') {
      expect(res.action.formFields.SimulatePaid).toBe('1')
    }
  })
})
```

- [ ] **Step 2: Run test, verify fails**

Run: `bun run --cwd packages/pay test -- service.test.ts -t 'createCharge'`
Expected: FAIL("not implemented")

- [ ] **Step 3: Implement createChargeImpl**

Replace the stub in `service.ts`:

```ts
async function createChargeImpl(
  input: CreateChargeInput,
  prism: PrismClients,
  deps: PaymentsServiceDeps,
): Promise<CreateChargeResult> {
  // 快速驗證 input
  if (deps.ecpay.mode === 'prod' && input.testMode?.simulatePaid) {
    throw new ConfigError('SimulatePaid is not allowed in prod mode')
  }
  if (input.amount.currency !== 'TWD') {
    throw new ConfigError(`ecpay only supports TWD, got ${input.amount.currency}`)
  }
  if (input.merchantTransactionId.length > 20) {
    throw new ConfigError('merchantTransactionId must be <= 20 chars')
  }
  if (!/^[0-9A-Za-z]+$/.test(input.merchantTransactionId)) {
    throw new ConfigError('merchantTransactionId must be alphanumeric only')
  }

  const req: types.IPaymentServiceAuthorizeRequest = {
    merchantTransactionId: input.merchantTransactionId,
    amount: {
      minorAmount: input.amount.minorAmount,
      currency: types.Currency.TWD,
    },
    captureMethod: types.CaptureMethod.AUTOMATIC,
    paymentMethod: {
      cardRedirect: { type: types.CardRedirect.CardRedirectType.CARD_REDIRECT },
    },
    authType: types.AuthenticationType.THREE_DS,
    orderDetails: [
      {
        productName: input.description,
        quantity: 1,
        amount: input.amount.minorAmount,
      } as unknown as types.IOrderDetails,
    ],
    address: {},
    returnUrl: input.returnUrl,
    // 某些 ECPay 欄位(OrderResultURL、ClientBackURL、SimulatePaid)透過 metadata 傳遞,
    // prism 的 ECPay transformer 會 pick 起來。實際欄位名依 prism transformer 實作。
    metadata: {
      orderResultUrl: input.orderResultUrl,
      clientBackUrl: input.clientBackUrl ?? '',
      simulatePaid: input.testMode?.simulatePaid ? '1' : '0',
    } as unknown as { [k: string]: string },
  }

  let res: types.PaymentServiceAuthorizeResponse
  try {
    res = await prism.paymentClient.authorize(req)
  } catch (err) {
    throw new IntegrationError(`prism authorize failed: ${(err as Error).message}`, err)
  }

  const form = res.redirectionData?.form
  if (!form || !form.endpoint || !form.fields) {
    throw new IntegrationError('prism did not return expected redirectionData.form', res)
  }

  const formFields: Record<string, string> = {}
  for (const [k, v] of Object.entries(form.fields)) {
    formFields[k] = String(v)
  }

  // 額外保險:若 prism 沒把 SimulatePaid 注入 formFields,手動補
  if (input.testMode?.simulatePaid && deps.ecpay.mode === 'stage' && !formFields.SimulatePaid) {
    formFields.SimulatePaid = '1'
  }

  return {
    status: 'pending_action',
    action: {
      type: 'redirect_form_post',
      targetUrl: form.endpoint,
      formFields,
    },
    connectorName: 'ecpay',
  }
}
```

- [ ] **Step 4: Run test, verify createCharge tests pass**

Run: `bun run --cwd packages/pay test -- service.test.ts -t 'createCharge'`
Expected: 2 passing

> **如果 prism 回的 `form.endpoint` / `form.fields` 欄位名不同**:讀 `proto.d.ts` 找 `IFormData` 定義,修正。若 prism 對 ECPay cardRedirect 回的是 `html` 或 `uri` 而非 `form`,擴展 `ChargeAction` 加對應 variant。

- [ ] **Step 5: Commit**

```bash
git add packages/pay/src/service.ts packages/pay/src/service.test.ts
git commit -m "feat(pay): implement createCharge via prism PaymentClient"
```

---

### Task B6: Edge case validation tests

**Files:**
- Modify: `packages/pay/src/service.test.ts`

- [ ] **Step 1: Add edge case tests**

```ts
import { ConfigError } from './errors'

describe('createCharge edge cases', () => {
  const baseInput = {
    merchantTransactionId: 'o_ec_001',
    amount: { minorAmount: 75, currency: 'TWD' as const },
    description: 'test',
    returnUrl: 'http://r',
    orderResultUrl: 'http://o',
    idempotencyKey: 'o_ec_001',
  }

  it('rejects non-TWD', async () => {
    const pay = createPaymentsService({ connector: 'ecpay', ecpay: STAGE_CREDS })
    await expect(
      pay.createCharge({ ...baseInput, amount: { minorAmount: 100, currency: 'USD' } }),
    ).rejects.toThrow(ConfigError)
  })

  it('rejects merchantTransactionId > 20 chars', async () => {
    const pay = createPaymentsService({ connector: 'ecpay', ecpay: STAGE_CREDS })
    await expect(
      pay.createCharge({ ...baseInput, merchantTransactionId: 'a'.repeat(21) }),
    ).rejects.toThrow(ConfigError)
  })

  it('rejects non-alphanumeric merchantTransactionId', async () => {
    const pay = createPaymentsService({ connector: 'ecpay', ecpay: STAGE_CREDS })
    await expect(
      pay.createCharge({ ...baseInput, merchantTransactionId: 'order-with-hyphen' }),
    ).rejects.toThrow(ConfigError)
  })

  it('rejects SimulatePaid in prod mode', async () => {
    const pay = createPaymentsService({
      connector: 'ecpay',
      ecpay: { ...STAGE_CREDS, mode: 'prod' },
    })
    await expect(
      pay.createCharge({ ...baseInput, testMode: { simulatePaid: true } }),
    ).rejects.toThrow(/SimulatePaid.*prod/)
  })
})
```

- [ ] **Step 2: Run all tests**

Run: `bun run --cwd packages/pay test`
Expected: all passing(handleWebhook 3 + createCharge 2 + edge 4 + ecpay-mac 3 = 12)

- [ ] **Step 3: Commit**

```bash
git add packages/pay/src/service.test.ts
git commit -m "test(pay): add createCharge edge case validation"
```

---

### Task B7: Finalise `packages/pay` exports

**Files:**
- Modify: `packages/pay/src/index.ts`

- [ ] **Step 1: Re-verify public surface**

```ts
// packages/pay/src/index.ts
export * from './types'
export * from './errors'
export { createPaymentsService } from './service'
```

- [ ] **Step 2: Typecheck from root**

Run: `bun run check:all`
Expected: PASS(至少 `@vine/pay` 相關無錯)。

- [ ] **Step 3: Commit(若有改動)**

```bash
git add packages/pay/src/index.ts
git commit -m "chore(pay): clean up public exports" || true
```

---

## Phase C — `apps/server/services/payments`

### Task C1: Order repository

**Files:**
- Create: `apps/server/src/services/payments/order.repository.ts`
- Create: `apps/server/src/services/payments/order.repository.test.ts`

- [ ] **Step 1: Write repository interface + failing test**

```ts
// apps/server/src/services/payments/order.repository.test.ts

import { describe, it, expect, beforeEach } from 'vitest'
import { createStickerOrderRepository } from './order.repository'
import { getTestDb } from '../../test/db'  // 若無,參考 server 既有 test helper
import { stickerOrder } from '@vine/db/schema-private'

describe('stickerOrderRepository', () => {
  const db = getTestDb()
  const repo = createStickerOrderRepository(db)

  beforeEach(async () => {
    await db.delete(stickerOrder)
  })

  it('creates order with default status "created"', async () => {
    const id = 'o_repo_001'
    await repo.create(db, {
      id,
      userId: 'u1',
      packageId: 'pkg_cat_01',
      amountMinor: 75,
      currency: 'TWD',
      connectorName: 'ecpay',
    })
    const found = await repo.findById(db, id)
    expect(found).toMatchObject({ id, status: 'created' })
  })

  it('transitionToPaid returns 1 for created → paid', async () => {
    const id = 'o_repo_002'
    await repo.create(db, { id, userId: 'u1', packageId: 'pkg_x', amountMinor: 75, currency: 'TWD', connectorName: 'ecpay' })
    const n = await repo.transitionToPaid(db, id, {
      connectorChargeId: 'TRADENO_1',
      paidAt: new Date('2026-04-23T12:00:00Z'),
    })
    expect(n).toBe(1)
    const found = await repo.findById(db, id)
    expect(found).toMatchObject({ status: 'paid', connectorChargeId: 'TRADENO_1' })
  })

  it('transitionToPaid returns 0 when already paid', async () => {
    const id = 'o_repo_003'
    await repo.create(db, { id, userId: 'u1', packageId: 'pkg_x', amountMinor: 75, currency: 'TWD', connectorName: 'ecpay' })
    await repo.transitionToPaid(db, id, { connectorChargeId: 'T1', paidAt: new Date() })
    const n = await repo.transitionToPaid(db, id, { connectorChargeId: 'T2', paidAt: new Date() })
    expect(n).toBe(0)
  })

  it('transitionToPaid accepts failed → paid', async () => {
    const id = 'o_repo_004'
    await repo.create(db, { id, userId: 'u1', packageId: 'pkg_x', amountMinor: 75, currency: 'TWD', connectorName: 'ecpay' })
    await repo.transitionToFailed(db, id, { failureReason: 'card declined' })
    const n = await repo.transitionToPaid(db, id, { connectorChargeId: 'T_retry', paidAt: new Date() })
    expect(n).toBe(1)
  })

  it('transitionToFailed returns 0 when already paid', async () => {
    const id = 'o_repo_005'
    await repo.create(db, { id, userId: 'u1', packageId: 'pkg_x', amountMinor: 75, currency: 'TWD', connectorName: 'ecpay' })
    await repo.transitionToPaid(db, id, { connectorChargeId: 'T', paidAt: new Date() })
    const n = await repo.transitionToFailed(db, id, { failureReason: 'late webhook' })
    expect(n).toBe(0)
  })
})
```

- [ ] **Step 2: Run, verify fails**

Run: `bun run --cwd apps/server test -- order.repository.test.ts`
Expected: FAIL(file not found)

- [ ] **Step 3: Implement repository**

```ts
// apps/server/src/services/payments/order.repository.ts

import { and, eq, inArray, sql } from 'drizzle-orm'
import { stickerOrder } from '@vine/db/schema-private'

export type StickerOrderRow = typeof stickerOrder.$inferSelect

export type CreateOrderInput = {
  id: string
  userId: string
  packageId: string
  amountMinor: number
  currency: 'TWD'
  connectorName: 'ecpay'
}

export type StickerOrderRepository = {
  create(tx: DbLike, input: CreateOrderInput): Promise<void>
  findById(tx: DbLike, id: string): Promise<StickerOrderRow | null>
  transitionToPaid(
    tx: DbLike,
    id: string,
    input: { connectorChargeId: string; paidAt: Date },
  ): Promise<number>
  transitionToFailed(
    tx: DbLike,
    id: string,
    input: { failureReason: string },
  ): Promise<number>
}

type DbLike = Parameters<typeof eq>[0] extends unknown
  ? {
      insert: (...a: any[]) => any
      select: (...a: any[]) => any
      update: (...a: any[]) => any
    }
  : never

export function createStickerOrderRepository(db: DbLike): StickerOrderRepository {
  return {
    async create(tx, input) {
      await tx
        .insert(stickerOrder)
        .values({
          id: input.id,
          userId: input.userId,
          packageId: input.packageId,
          amountMinor: input.amountMinor,
          currency: input.currency,
          connectorName: input.connectorName,
          status: 'created',
        })
    },

    async findById(tx, id) {
      const rows = await tx.select().from(stickerOrder).where(eq(stickerOrder.id, id)).limit(1)
      return (rows[0] as StickerOrderRow | undefined) ?? null
    },

    async transitionToPaid(tx, id, input) {
      const result = await tx
        .update(stickerOrder)
        .set({
          status: 'paid',
          connectorChargeId: input.connectorChargeId,
          paidAt: input.paidAt.toISOString(),
          updatedAt: sql`now()`,
        })
        .where(
          and(
            eq(stickerOrder.id, id),
            inArray(stickerOrder.status, ['created', 'failed']),
          ),
        )
      return (result.rowCount as number | undefined) ?? 0
    },

    async transitionToFailed(tx, id, input) {
      const result = await tx
        .update(stickerOrder)
        .set({
          status: 'failed',
          failureReason: input.failureReason,
          updatedAt: sql`now()`,
        })
        .where(and(eq(stickerOrder.id, id), eq(stickerOrder.status, 'created')))
      return (result.rowCount as number | undefined) ?? 0
    },
  }
}
```

(型別 `DbLike` 是為了可同時接 full db 與 transaction;若 server 既有 test helper 有更精確的 type,沿用。)

- [ ] **Step 4: Run test**

Run: `bun run --cwd apps/server test -- order.repository.test.ts`
Expected: 5 passing

- [ ] **Step 5: Commit**

```bash
git add apps/server/src/services/payments/
git commit -m "feat(server): add sticker order repository"
```

---

### Task C2: Entitlement repository

**Files:**
- Create: `apps/server/src/services/payments/entitlement.repository.ts`
- Create: `apps/server/src/services/payments/entitlement.repository.test.ts`

- [ ] **Step 1: Write failing test**

```ts
// apps/server/src/services/payments/entitlement.repository.test.ts

import { describe, it, expect, beforeEach } from 'vitest'
import { createEntitlementRepository } from './entitlement.repository'
import { getTestDb } from '../../test/db'
import { entitlement } from '@vine/db/schema-public'

describe('entitlementRepository', () => {
  const db = getTestDb()
  const repo = createEntitlementRepository(db)

  beforeEach(async () => {
    await db.delete(entitlement)
  })

  it('grants new entitlement', async () => {
    await repo.grant(db, { userId: 'u1', packageId: 'pkg_cat_01', grantedByOrderId: 'o1' })
    const found = await repo.find(db, { userId: 'u1', packageId: 'pkg_cat_01' })
    expect(found).toBeDefined()
  })

  it('is idempotent on duplicate (userId, packageId)', async () => {
    await repo.grant(db, { userId: 'u1', packageId: 'pkg_cat_01', grantedByOrderId: 'o1' })
    await repo.grant(db, { userId: 'u1', packageId: 'pkg_cat_01', grantedByOrderId: 'o2' })
    const all = await db.select().from(entitlement)
    expect(all).toHaveLength(1)
  })
})
```

- [ ] **Step 2: Run, verify fails**

Run: `bun run --cwd apps/server test -- entitlement.repository.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement**

```ts
// apps/server/src/services/payments/entitlement.repository.ts

import { and, eq } from 'drizzle-orm'
import { ulid } from 'ulid'
import { entitlement } from '@vine/db/schema-public'

type EntitlementRow = typeof entitlement.$inferSelect

export type EntitlementRepository = {
  grant(
    tx: any,
    input: { userId: string; packageId: string; grantedByOrderId: string },
  ): Promise<void>
  find(
    tx: any,
    input: { userId: string; packageId: string },
  ): Promise<EntitlementRow | null>
}

export function createEntitlementRepository(_db: any): EntitlementRepository {
  return {
    async grant(tx, input) {
      await tx
        .insert(entitlement)
        .values({
          id: ulid(),
          userId: input.userId,
          packageId: input.packageId,
          grantedByOrderId: input.grantedByOrderId,
        })
        .onConflictDoNothing({ target: [entitlement.userId, entitlement.packageId] })
    },

    async find(tx, input) {
      const rows = await tx
        .select()
        .from(entitlement)
        .where(and(eq(entitlement.userId, input.userId), eq(entitlement.packageId, input.packageId)))
        .limit(1)
      return (rows[0] as EntitlementRow | undefined) ?? null
    },
  }
}
```

若 `ulid` 套件不在 apps/server deps:`bun add --cwd apps/server ulid`。

- [ ] **Step 4: Run, verify passes**

Run: `bun run --cwd apps/server test -- entitlement.repository.test.ts`
Expected: 2 passing

- [ ] **Step 5: Commit**

```bash
git add apps/server/src/services/payments/entitlement.repository.* apps/server/package.json
git commit -m "feat(server): add entitlement repository"
```

---

### Task C3: Event handler (state machine)

**Files:**
- Create: `apps/server/src/services/payments/event-handler.ts`
- Create: `apps/server/src/services/payments/event-handler.test.ts`

- [ ] **Step 1: Write failing test — covering state machine rules**

```ts
// apps/server/src/services/payments/event-handler.test.ts

import { describe, it, expect, beforeEach } from 'vitest'
import { handlePaymentEvent } from './event-handler'
import { createStickerOrderRepository } from './order.repository'
import { createEntitlementRepository } from './entitlement.repository'
import { getTestDb } from '../../test/db'
import { entitlement, stickerPackage } from '@vine/db/schema-public'
import { stickerOrder } from '@vine/db/schema-private'
import type { Logger } from 'pino'

const silentLog: Logger = {
  warn: () => {},
  error: () => {},
  info: () => {},
  debug: () => {},
  child: () => silentLog,
} as unknown as Logger

describe('handlePaymentEvent', () => {
  const db = getTestDb()
  const orderRepo = createStickerOrderRepository(db)
  const entitlementRepo = createEntitlementRepository(db)
  const deps = { db, orderRepo, entitlementRepo }

  beforeEach(async () => {
    await db.delete(entitlement)
    await db.delete(stickerOrder)
    await db.delete(stickerPackage)
    await db.insert(stickerPackage).values({
      id: 'pkg_test', name: 'Test', priceMinor: 75, currency: 'TWD',
      coverDriveKey: 'k', tabIconDriveKey: 'k', stickerCount: 8,
    })
  })

  async function seedOrder(id: string, status: 'created' | 'paid' | 'failed' = 'created') {
    await orderRepo.create(db, {
      id, userId: 'u1', packageId: 'pkg_test',
      amountMinor: 75, currency: 'TWD', connectorName: 'ecpay',
    })
    if (status === 'paid') {
      await orderRepo.transitionToPaid(db, id, { connectorChargeId: 'T1', paidAt: new Date() })
    }
    if (status === 'failed') {
      await orderRepo.transitionToFailed(db, id, { failureReason: 'r' })
    }
  }

  it('created → paid + grants entitlement', async () => {
    await seedOrder('o1', 'created')
    await handlePaymentEvent(deps, {
      kind: 'charge.succeeded',
      merchantTransactionId: 'o1',
      connectorChargeId: 'TRADE_1',
      amount: { minorAmount: 75, currency: 'TWD' },
      paidAt: new Date(),
    }, silentLog)
    const o = await orderRepo.findById(db, 'o1')
    expect(o?.status).toBe('paid')
    expect(await entitlementRepo.find(db, { userId: 'u1', packageId: 'pkg_test' })).toBeDefined()
  })

  it('idempotent: second charge.succeeded produces no duplicate entitlement', async () => {
    await seedOrder('o2', 'created')
    const evt = {
      kind: 'charge.succeeded' as const,
      merchantTransactionId: 'o2',
      connectorChargeId: 'TRADE_2',
      amount: { minorAmount: 75, currency: 'TWD' as const },
      paidAt: new Date(),
    }
    await handlePaymentEvent(deps, evt, silentLog)
    await handlePaymentEvent(deps, evt, silentLog)
    const rows = await db.select().from(entitlement).where(e => e.userId === 'u1')
    expect(rows).toHaveLength(1)
  })

  it('amount mismatch: no transition, no grant', async () => {
    await seedOrder('o3', 'created')
    await handlePaymentEvent(deps, {
      kind: 'charge.succeeded',
      merchantTransactionId: 'o3',
      connectorChargeId: 'T',
      amount: { minorAmount: 999, currency: 'TWD' },
      paidAt: new Date(),
    }, silentLog)
    const o = await orderRepo.findById(db, 'o3')
    expect(o?.status).toBe('created')
    expect(await entitlementRepo.find(db, { userId: 'u1', packageId: 'pkg_test' })).toBeNull()
  })

  it('paid + charge.failed: remains paid', async () => {
    await seedOrder('o4', 'paid')
    await handlePaymentEvent(deps, {
      kind: 'charge.failed',
      merchantTransactionId: 'o4',
      reason: 'stale',
    }, silentLog)
    const o = await orderRepo.findById(db, 'o4')
    expect(o?.status).toBe('paid')
  })

  it('failed → paid allowed (ECPay retry scenario)', async () => {
    await seedOrder('o5', 'failed')
    await handlePaymentEvent(deps, {
      kind: 'charge.succeeded',
      merchantTransactionId: 'o5',
      connectorChargeId: 'T_retry',
      amount: { minorAmount: 75, currency: 'TWD' },
      paidAt: new Date(),
    }, silentLog)
    const o = await orderRepo.findById(db, 'o5')
    expect(o?.status).toBe('paid')
    expect(await entitlementRepo.find(db, { userId: 'u1', packageId: 'pkg_test' })).toBeDefined()
  })

  it('unknown order: no side effects', async () => {
    await handlePaymentEvent(deps, {
      kind: 'charge.succeeded',
      merchantTransactionId: 'nonexistent',
      connectorChargeId: 'T',
      amount: { minorAmount: 75, currency: 'TWD' },
      paidAt: new Date(),
    }, silentLog)
    const rows = await db.select().from(entitlement)
    expect(rows).toHaveLength(0)
  })
})
```

- [ ] **Step 2: Run, verify fails**

Run: `bun run --cwd apps/server test -- event-handler.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement**

```ts
// apps/server/src/services/payments/event-handler.ts

import type { Logger } from 'pino'
import type { WebhookEvent } from '@vine/pay'
import type { StickerOrderRepository } from './order.repository'
import type { EntitlementRepository } from './entitlement.repository'

export type PaymentEventDeps = {
  db: any
  orderRepo: StickerOrderRepository
  entitlementRepo: EntitlementRepository
}

export async function handlePaymentEvent(
  deps: PaymentEventDeps,
  event: WebhookEvent,
  log: Logger,
): Promise<void> {
  if (event.kind === 'unknown') {
    log.warn({ raw: event.raw }, 'unknown ecpay event, skipping')
    return
  }

  await deps.db.transaction(async (tx: any) => {
    const order = await deps.orderRepo.findById(tx, event.merchantTransactionId)
    if (!order) {
      log.warn({ id: event.merchantTransactionId }, 'webhook for unknown order')
      return
    }

    if (event.kind === 'charge.succeeded') {
      return applyChargeSucceeded(tx, deps, order, event, log)
    }
    if (event.kind === 'charge.failed') {
      return applyChargeFailed(tx, deps, order, event, log)
    }
  })
}

async function applyChargeSucceeded(
  tx: any,
  deps: PaymentEventDeps,
  order: { id: string; userId: string; packageId: string; amountMinor: number; currency: string; status: string },
  event: Extract<WebhookEvent, { kind: 'charge.succeeded' }>,
  log: Logger,
): Promise<void> {
  if (order.amountMinor !== event.amount.minorAmount || order.currency !== event.amount.currency) {
    log.error(
      { orderId: order.id, expected: order.amountMinor, got: event.amount },
      'AMOUNT MISMATCH — not transitioning, not granting',
    )
    // FUTURE(alerting):接 Sentry / PagerDuty
    return
  }

  const updated = await deps.orderRepo.transitionToPaid(tx, order.id, {
    connectorChargeId: event.connectorChargeId,
    paidAt: event.paidAt,
  })

  if (updated === 0) {
    log.info({ orderId: order.id }, 'order already paid, no-op')
    return
  }

  if (order.status === 'failed') {
    log.warn({ orderId: order.id }, 'order transitioned failed → paid (ECPay retry scenario)')
  }

  await deps.entitlementRepo.grant(tx, {
    userId: order.userId,
    packageId: order.packageId,
    grantedByOrderId: order.id,
  })
}

async function applyChargeFailed(
  tx: any,
  deps: PaymentEventDeps,
  order: { id: string; status: string },
  event: Extract<WebhookEvent, { kind: 'charge.failed' }>,
  log: Logger,
): Promise<void> {
  if (order.status === 'paid') {
    log.error({ orderId: order.id }, 'CRITICAL: charge.failed after paid — ignoring')
    return
  }
  await deps.orderRepo.transitionToFailed(tx, order.id, { failureReason: event.reason })
}
```

- [ ] **Step 4: Run, verify passes**

Run: `bun run --cwd apps/server test -- event-handler.test.ts`
Expected: 6 passing

- [ ] **Step 5: Commit**

```bash
git add apps/server/src/services/payments/event-handler.*
git commit -m "feat(server): implement payment event handler state machine"
```

---

### Task C4: Webhook Fastify route

**Files:**
- Create: `apps/server/src/services/payments/webhook.route.ts`
- Create: `apps/server/src/services/payments/webhook.route.test.ts`

- [ ] **Step 1: Write failing test**

```ts
// apps/server/src/services/payments/webhook.route.test.ts

import { describe, it, expect, beforeEach } from 'vitest'
import Fastify from 'fastify'
import { registerPaymentsWebhookRoutes } from './webhook.route'
import { createPaymentsService } from '@vine/pay'
import { signFormBody } from '@vine/pay/src/test-utils/ecpay-mac'
import { createStickerOrderRepository } from './order.repository'
import { createEntitlementRepository } from './entitlement.repository'
import { getTestDb } from '../../test/db'
import { entitlement, stickerPackage } from '@vine/db/schema-public'
import { stickerOrder } from '@vine/db/schema-private'

const CREDS = {
  merchantId: '3002607',
  hashKey: 'pwFHCqoQZGmho4w6',
  hashIv: 'EkRm7iFT261dpevs',
  mode: 'stage' as const,
}

async function buildApp() {
  const db = getTestDb()
  const pay = createPaymentsService({ connector: 'ecpay', ecpay: CREDS })
  const orderRepo = createStickerOrderRepository(db)
  const entitlementRepo = createEntitlementRepository(db)
  const app = Fastify({ logger: false })
  await registerPaymentsWebhookRoutes(app, { pay, orderRepo, entitlementRepo, db })
  await app.ready()
  return { app, db, orderRepo, entitlementRepo }
}

describe('POST /webhooks/ecpay', () => {
  beforeEach(async () => {
    const db = getTestDb()
    await db.delete(entitlement)
    await db.delete(stickerOrder)
    await db.delete(stickerPackage)
    await db.insert(stickerPackage).values({
      id: 'pkg_wh', name: 'Test', priceMinor: 75, currency: 'TWD',
      coverDriveKey: 'k', tabIconDriveKey: 'k', stickerCount: 8,
    })
  })

  it('created → paid, grants entitlement, replies 1|OK', async () => {
    const { app, db, orderRepo, entitlementRepo } = await buildApp()
    await orderRepo.create(db, {
      id: 'o_wh_001', userId: 'u1', packageId: 'pkg_wh',
      amountMinor: 75, currency: 'TWD', connectorName: 'ecpay',
    })
    const body = signFormBody({
      MerchantID: '3002607',
      MerchantTradeNo: 'o_wh_001',
      TradeAmt: '75',
      RtnCode: '1',
      TradeNo: 'TRADE_001',
      PaymentDate: '2026/04/23 12:00:00',
      PaymentType: 'Credit_CreditCard',
      SimulatePaid: '0',
    }, CREDS.hashKey, CREDS.hashIv)

    const res = await app.inject({
      method: 'POST',
      url: '/webhooks/ecpay',
      payload: body,
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
    })

    expect(res.statusCode).toBe(200)
    expect(res.body).toBe('1|OK')
    expect((await orderRepo.findById(db, 'o_wh_001'))?.status).toBe('paid')
    expect(await entitlementRepo.find(db, { userId: 'u1', packageId: 'pkg_wh' })).toBeDefined()
  })

  it('bad CheckMacValue returns 400', async () => {
    const { app } = await buildApp()
    const res = await app.inject({
      method: 'POST',
      url: '/webhooks/ecpay',
      payload: 'MerchantTradeNo=o_wh_bad&TradeAmt=75&RtnCode=1&CheckMacValue=DEADBEEF',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
    })
    expect(res.statusCode).toBe(400)
  })

  it('amount mismatch: no state change, still replies 1|OK', async () => {
    const { app, db, orderRepo, entitlementRepo } = await buildApp()
    await orderRepo.create(db, {
      id: 'o_wh_amt', userId: 'u1', packageId: 'pkg_wh',
      amountMinor: 75, currency: 'TWD', connectorName: 'ecpay',
    })
    const body = signFormBody({
      MerchantID: '3002607', MerchantTradeNo: 'o_wh_amt', TradeAmt: '750',
      RtnCode: '1', TradeNo: 'T', PaymentDate: '2026/04/23 12:00:00',
      PaymentType: 'Credit_CreditCard', SimulatePaid: '0',
    }, CREDS.hashKey, CREDS.hashIv)
    const res = await app.inject({
      method: 'POST', url: '/webhooks/ecpay', payload: body,
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
    })
    expect(res.statusCode).toBe(200)
    expect(res.body).toBe('1|OK')
    expect((await orderRepo.findById(db, 'o_wh_amt'))?.status).toBe('created')
    expect(await entitlementRepo.find(db, { userId: 'u1', packageId: 'pkg_wh' })).toBeNull()
  })
})
```

- [ ] **Step 2: Run, verify fails**

Run: `bun run --cwd apps/server test -- webhook.route.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement route**

```ts
// apps/server/src/services/payments/webhook.route.ts

import type { FastifyInstance } from 'fastify'
import type { PaymentsService } from '@vine/pay'
import type { StickerOrderRepository } from './order.repository'
import type { EntitlementRepository } from './entitlement.repository'
import { handlePaymentEvent } from './event-handler'

export type WebhookDeps = {
  pay: PaymentsService
  orderRepo: StickerOrderRepository
  entitlementRepo: EntitlementRepository
  db: any
}

export async function registerPaymentsWebhookRoutes(
  fastify: FastifyInstance,
  deps: WebhookDeps,
): Promise<void> {
  fastify.addContentTypeParser(
    'application/x-www-form-urlencoded',
    { parseAs: 'buffer' },
    (_req, body, done) => done(null, body),
  )

  fastify.post('/webhooks/ecpay', async (request, reply) => {
    const rawBody = request.body as Buffer
    const contentType = (request.headers['content-type'] as string) ?? ''

    const result = await deps.pay.handleWebhook({
      rawBody,
      headers: request.headers,
      contentType,
    })

    if (!result.verified) {
      request.log.warn({ reason: result.reason }, 'ecpay webhook verification failed')
      return reply.code(result.ackReply.status).type('text/plain').send(result.ackReply.body)
    }

    try {
      await handlePaymentEvent(deps, result.event, request.log)
    } catch (err) {
      request.log.error({ err, event: result.event }, 'ecpay webhook handler threw')
      // 故意:仍回 1|OK 避免 ECPay 無限 retry
    }

    return reply.code(result.ackReply.status).type('text/plain').send(result.ackReply.body)
  })
}
```

- [ ] **Step 4: Run, verify passes**

Run: `bun run --cwd apps/server test -- webhook.route.test.ts`
Expected: 3 passing

- [ ] **Step 5: Commit**

```bash
git add apps/server/src/services/payments/webhook.route.*
git commit -m "feat(server): add ECPay webhook route with idempotent state transitions"
```

---

### Task C5: ConnectRPC `createCheckout` handler

**Files:**
- Create: `apps/server/src/connect/stickerMarketUser.ts`
- Create: `apps/server/src/connect/stickerMarketUser.test.ts`
- Modify: `apps/server/src/connect/routes.ts`

閱讀 `apps/server/src/connect/oa.ts` 了解 handler pattern + `withAuthService` 用法。

- [ ] **Step 1: Write failing test (createCheckout only)**

```ts
// apps/server/src/connect/stickerMarketUser.test.ts

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { createStickerMarketUserHandler } from './stickerMarketUser'
import { getTestDb } from '../test/db'
import { stickerPackage, entitlement } from '@vine/db/schema-public'
import { stickerOrder } from '@vine/db/schema-private'
import { ConnectError, Code } from '@connectrpc/connect'

function makeMockPay() {
  return {
    createCharge: vi.fn().mockResolvedValue({
      status: 'pending_action',
      action: {
        type: 'redirect_form_post',
        targetUrl: 'https://payment-stage.ecpay.com.tw/Cashier/AioCheckOut/V5',
        formFields: { MerchantTradeNo: 'x', TotalAmount: '75' },
      },
      connectorName: 'ecpay',
    }),
    handleWebhook: vi.fn(),
  }
}

describe('stickerMarketUser.createCheckout', () => {
  const db = getTestDb()

  beforeEach(async () => {
    await db.delete(stickerOrder)
    await db.delete(entitlement)
    await db.delete(stickerPackage)
    await db.insert(stickerPackage).values({
      id: 'pkg_cc', name: 'CC Test', priceMinor: 75, currency: 'TWD',
      coverDriveKey: 'k', tabIconDriveKey: 'k', stickerCount: 8,
    })
  })

  it('creates order and returns redirect form', async () => {
    const pay = makeMockPay()
    const handler = createStickerMarketUserHandler({ db, pay, mode: 'stage', returnUrl: 'http://r', orderResultUrl: 'http://o' })
    const res = await handler.createCheckout(
      { packageId: 'pkg_cc', simulatePaid: false },
      { authData: { userID: 'u1' } } as any,
    )
    expect(res.orderId).toMatch(/^[0-9A-Za-z]{1,20}$/)
    expect(res.redirect?.targetUrl).toContain('ecpay')
    const [order] = await db.select().from(stickerOrder).where(o => o.id === res.orderId)
    expect(order).toMatchObject({ status: 'created', userId: 'u1', packageId: 'pkg_cc', amountMinor: 75 })
    expect(pay.createCharge).toHaveBeenCalled()
  })

  it('rejects unknown package', async () => {
    const pay = makeMockPay()
    const handler = createStickerMarketUserHandler({ db, pay, mode: 'stage', returnUrl: 'http://r', orderResultUrl: 'http://o' })
    await expect(
      handler.createCheckout({ packageId: 'missing', simulatePaid: false }, { authData: { userID: 'u1' } } as any),
    ).rejects.toThrow(/not found|NOT_FOUND/i)
  })

  it('rejects if already entitled', async () => {
    const pay = makeMockPay()
    await db.insert(entitlement).values({
      id: 'e1', userId: 'u1', packageId: 'pkg_cc', grantedByOrderId: 'prev',
    })
    const handler = createStickerMarketUserHandler({ db, pay, mode: 'stage', returnUrl: 'http://r', orderResultUrl: 'http://o' })
    await expect(
      handler.createCheckout({ packageId: 'pkg_cc', simulatePaid: false }, { authData: { userID: 'u1' } } as any),
    ).rejects.toMatchObject({ code: Code.AlreadyExists })
  })

  it('rejects simulatePaid in prod mode', async () => {
    const pay = makeMockPay()
    const handler = createStickerMarketUserHandler({ db, pay, mode: 'prod', returnUrl: 'http://r', orderResultUrl: 'http://o' })
    await expect(
      handler.createCheckout({ packageId: 'pkg_cc', simulatePaid: true }, { authData: { userID: 'u1' } } as any),
    ).rejects.toThrow(/prod|InvalidArgument/i)
  })
})
```

- [ ] **Step 2: Run, verify fails**

Run: `bun run --cwd apps/server test -- stickerMarketUser.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement handler**

```ts
// apps/server/src/connect/stickerMarketUser.ts

import { ConnectError, Code } from '@connectrpc/connect'
import { and, eq } from 'drizzle-orm'
import { ulid } from 'ulid'
import { stickerPackage, entitlement } from '@vine/db/schema-public'
import { stickerOrder } from '@vine/db/schema-private'
import type { PaymentsService } from '@vine/pay'

export type StickerMarketUserHandlerDeps = {
  db: any
  pay: PaymentsService
  mode: 'stage' | 'prod'
  returnUrl: string
  orderResultUrl: string
  clientBackUrl?: string
}

export type AuthContext = { authData: { userID: string } }

export function createStickerMarketUserHandler(deps: StickerMarketUserHandlerDeps) {
  return {
    async createCheckout(
      req: { packageId: string; simulatePaid: boolean },
      ctx: AuthContext,
    ) {
      const userId = ctx.authData.userID

      if (req.simulatePaid && deps.mode !== 'stage') {
        throw new ConnectError('simulatePaid is only allowed in stage mode', Code.InvalidArgument)
      }

      const [pkg] = await deps.db.select().from(stickerPackage).where(eq(stickerPackage.id, req.packageId)).limit(1)
      if (!pkg) throw new ConnectError(`package ${req.packageId} not found`, Code.NotFound)

      const existing = await deps.db
        .select()
        .from(entitlement)
        .where(and(eq(entitlement.userId, userId), eq(entitlement.packageId, req.packageId)))
        .limit(1)
      if (existing.length > 0) {
        throw new ConnectError('already owned', Code.AlreadyExists)
      }

      // Generate short alphanumeric id (<=20 chars for ECPay MerchantTradeNo)
      const orderId = 'o' + ulid().slice(-15) // total 16 chars, only [0-9A-Z]
      const alnum = orderId.replace(/[^0-9A-Za-z]/g, '')

      await deps.db.insert(stickerOrder).values({
        id: alnum,
        userId,
        packageId: req.packageId,
        amountMinor: pkg.priceMinor,
        currency: pkg.currency,
        connectorName: 'ecpay',
        status: 'created',
      })

      const charge = await deps.pay.createCharge({
        merchantTransactionId: alnum,
        amount: { minorAmount: pkg.priceMinor, currency: pkg.currency },
        description: pkg.name,
        returnUrl: deps.returnUrl,
        orderResultUrl: `${deps.orderResultUrl}?orderId=${alnum}`,
        clientBackUrl: deps.clientBackUrl,
        idempotencyKey: alnum,
        testMode: req.simulatePaid ? { simulatePaid: true } : undefined,
      })

      if (charge.action.type !== 'redirect_form_post') {
        throw new ConnectError(
          `unexpected action type ${charge.action.type}`,
          Code.Internal,
        )
      }

      return {
        orderId: alnum,
        redirect: {
          targetUrl: charge.action.targetUrl,
          formFields: charge.action.formFields,
        },
      }
    },

    async getOrder(req: { orderId: string }, ctx: AuthContext) {
      const userId = ctx.authData.userID
      const [order] = await deps.db.select().from(stickerOrder).where(eq(stickerOrder.id, req.orderId)).limit(1)
      if (!order) throw new ConnectError('order not found', Code.NotFound)
      if (order.userId !== userId) throw new ConnectError('forbidden', Code.PermissionDenied)
      return {
        orderId: order.id,
        status: statusToProto(order.status),
        failureReason: order.failureReason ?? '',
        amountMinor: order.amountMinor,
        currency: order.currency,
      }
    },
  }
}

function statusToProto(s: 'created' | 'paid' | 'failed'): number {
  return s === 'created' ? 1 : s === 'paid' ? 2 : 3
}
```

- [ ] **Step 4: Run, verify createCheckout passes**

Run: `bun run --cwd apps/server test -- stickerMarketUser.test.ts -t 'createCheckout'`
Expected: 4 passing

- [ ] **Step 5: Commit**

```bash
git add apps/server/src/connect/stickerMarketUser.*
git commit -m "feat(server): add StickerMarketUserService.CreateCheckout handler"
```

---

### Task C6: ConnectRPC `getOrder` handler tests

**Files:**
- Modify: `apps/server/src/connect/stickerMarketUser.test.ts`

- [ ] **Step 1: Add getOrder tests**

```ts
describe('stickerMarketUser.getOrder', () => {
  const db = getTestDb()

  beforeEach(async () => {
    await db.delete(stickerOrder)
    await db.insert(stickerOrder).values([
      { id: 'o_own', userId: 'u1', packageId: 'pkg_x', amountMinor: 75, currency: 'TWD', connectorName: 'ecpay', status: 'paid' },
      { id: 'o_other', userId: 'u2', packageId: 'pkg_x', amountMinor: 75, currency: 'TWD', connectorName: 'ecpay', status: 'created' },
    ])
  })

  it('returns own order', async () => {
    const pay = makeMockPay()
    const handler = createStickerMarketUserHandler({ db, pay, mode: 'stage', returnUrl: 'http://r', orderResultUrl: 'http://o' })
    const res = await handler.getOrder({ orderId: 'o_own' }, { authData: { userID: 'u1' } } as any)
    expect(res.orderId).toBe('o_own')
    expect(res.status).toBe(2)  // ORDER_STATUS_PAID
  })

  it('rejects other user order with PermissionDenied', async () => {
    const pay = makeMockPay()
    const handler = createStickerMarketUserHandler({ db, pay, mode: 'stage', returnUrl: 'http://r', orderResultUrl: 'http://o' })
    await expect(
      handler.getOrder({ orderId: 'o_other' }, { authData: { userID: 'u1' } } as any),
    ).rejects.toMatchObject({ code: Code.PermissionDenied })
  })

  it('rejects missing order with NotFound', async () => {
    const pay = makeMockPay()
    const handler = createStickerMarketUserHandler({ db, pay, mode: 'stage', returnUrl: 'http://r', orderResultUrl: 'http://o' })
    await expect(
      handler.getOrder({ orderId: 'nope' }, { authData: { userID: 'u1' } } as any),
    ).rejects.toMatchObject({ code: Code.NotFound })
  })
})
```

- [ ] **Step 2: Run, verify 3 getOrder tests pass**

Run: `bun run --cwd apps/server test -- stickerMarketUser.test.ts`
Expected: 7 passing total

- [ ] **Step 3: Commit**

```bash
git add apps/server/src/connect/stickerMarketUser.test.ts
git commit -m "test(server): add getOrder permission tests"
```

---

### Task C7: Wire payments service into server startup

**Files:**
- Modify: `apps/server/src/services/payments/index.ts`(create)
- Modify: `apps/server/src/connect/routes.ts`
- Modify: `apps/server/src/index.ts`
- Modify: `apps/server/package.json`(env validation)

- [ ] **Step 1: Create payments service factory**

```ts
// apps/server/src/services/payments/index.ts

import { createPaymentsService } from '@vine/pay'
import { createStickerOrderRepository } from './order.repository'
import { createEntitlementRepository } from './entitlement.repository'

export type PaymentsEnv = {
  PAYMENTS_ECPAY_MODE: 'stage' | 'prod'
  PAYMENTS_ECPAY_MERCHANT_ID: string
  PAYMENTS_ECPAY_HASH_KEY: string
  PAYMENTS_ECPAY_HASH_IV: string
  PAYMENTS_RETURN_URL: string
  PAYMENTS_ORDER_RESULT_URL: string
  PAYMENTS_CLIENT_BACK_URL?: string
}

export function createPayments(env: PaymentsEnv, db: any) {
  const pay = createPaymentsService({
    connector: 'ecpay',
    ecpay: {
      merchantId: env.PAYMENTS_ECPAY_MERCHANT_ID,
      hashKey: env.PAYMENTS_ECPAY_HASH_KEY,
      hashIv: env.PAYMENTS_ECPAY_HASH_IV,
      mode: env.PAYMENTS_ECPAY_MODE,
    },
  })
  const orderRepo = createStickerOrderRepository(db)
  const entitlementRepo = createEntitlementRepository(db)
  return { pay, orderRepo, entitlementRepo }
}

export { createStickerOrderRepository } from './order.repository'
export { createEntitlementRepository } from './entitlement.repository'
export { registerPaymentsWebhookRoutes } from './webhook.route'
```

- [ ] **Step 2: Register webhook route + RPC handler in main server**

讀 `apps/server/src/index.ts` 了解既有 wiring pattern(找 `registerOaRoutes` 或類似)。

在 `apps/server/src/index.ts` 適當位置加:

```ts
import { createPayments, registerPaymentsWebhookRoutes } from './services/payments'
import { createStickerMarketUserHandler } from './connect/stickerMarketUser'

// ... 既有 drive、db 初始化之後:

const payments = createPayments(
  {
    PAYMENTS_ECPAY_MODE: (process.env['PAYMENTS_ECPAY_MODE'] as 'stage' | 'prod') ?? 'stage',
    PAYMENTS_ECPAY_MERCHANT_ID: process.env['PAYMENTS_ECPAY_MERCHANT_ID'] ?? '3002607',
    PAYMENTS_ECPAY_HASH_KEY: process.env['PAYMENTS_ECPAY_HASH_KEY'] ?? 'pwFHCqoQZGmho4w6',
    PAYMENTS_ECPAY_HASH_IV: process.env['PAYMENTS_ECPAY_HASH_IV'] ?? 'EkRm7iFT261dpevs',
    PAYMENTS_RETURN_URL: process.env['PAYMENTS_RETURN_URL'] ?? 'http://localhost:3001/webhooks/ecpay',
    PAYMENTS_ORDER_RESULT_URL: process.env['PAYMENTS_ORDER_RESULT_URL'] ?? 'http://localhost:3000/pay/result',
    PAYMENTS_CLIENT_BACK_URL: process.env['PAYMENTS_CLIENT_BACK_URL'],
  },
  db,
)

await registerPaymentsWebhookRoutes(fastify, { ...payments, db })

const stickerMarketUserHandler = createStickerMarketUserHandler({
  db,
  pay: payments.pay,
  mode: (process.env['PAYMENTS_ECPAY_MODE'] as 'stage' | 'prod') ?? 'stage',
  returnUrl: process.env['PAYMENTS_RETURN_URL'] ?? 'http://localhost:3001/webhooks/ecpay',
  orderResultUrl: process.env['PAYMENTS_ORDER_RESULT_URL'] ?? 'http://localhost:3000/pay/result',
})
```

- [ ] **Step 3: Register ConnectRPC service in routes**

Modify `apps/server/src/connect/routes.ts`:

```ts
import { StickerMarketUserService } from '@vine/proto/stickerMarket/v1/stickerMarket_connect'

// 在 ConnectRPC registration 區塊加:
router.service(StickerMarketUserService, stickerMarketUserHandler)
```

確切 API 以 `oa.ts` / `liff.ts` pattern 為準 — 讀 `routes.ts` 既有 wiring 對齊。可能需要把 `stickerMarketUserHandler` 透過 deps 傳進 `registerRoutes`。

- [ ] **Step 4: Add env validation**

Modify `apps/server/package.json`。讀現有 env validation 區塊(若以 `envsafe` 或類似套件 declare),加:

```jsonc
{
  "env": {
    "PAYMENTS_ECPAY_MODE": { "enum": ["stage", "prod"], "default": "stage" },
    "PAYMENTS_ECPAY_MERCHANT_ID": { "type": "string", "default": "3002607" },
    "PAYMENTS_ECPAY_HASH_KEY": { "type": "string", "default": "pwFHCqoQZGmho4w6" },
    "PAYMENTS_ECPAY_HASH_IV": { "type": "string", "default": "EkRm7iFT261dpevs" },
    "PAYMENTS_RETURN_URL": { "type": "string", "default": "http://localhost:3001/webhooks/ecpay" },
    "PAYMENTS_ORDER_RESULT_URL": { "type": "string", "default": "http://localhost:3000/pay/result" },
    "PAYMENTS_CLIENT_BACK_URL": { "type": "string", "optional": true }
  }
}
```

(若 apps/server 使用其他 env validation 機制,adapt。)

- [ ] **Step 5: Smoke-test**

Run:
```bash
docker compose up -d --build server
docker compose logs server | tail -50
```

Expected:server 正常啟動,無 `prism` load 錯誤、無缺 env 錯誤。

`curl -i http://localhost:3001/webhooks/ecpay -X POST -H 'content-type: application/x-www-form-urlencoded' --data 'nope=1'`
Expected:回 400(CheckMacValue fail),不會 500。

- [ ] **Step 6: Commit**

```bash
git add apps/server/src/services/payments/index.ts apps/server/src/index.ts apps/server/src/connect/routes.ts apps/server/package.json
git commit -m "feat(server): wire payments service + webhook route + RPC handler"
```

---

## Phase D — Seed + fixtures

### Task D1: Generate fixture PNGs

**Files:**
- Create: `packages/db/src/seed/sticker-fixtures/pkg_cat_01/{cover,tab,1..8}.png`
- Create: `packages/db/src/seed/sticker-fixtures/pkg_dog_01/{cover,tab,1..8}.png`
- Create: `packages/db/src/seed/sticker-fixtures/pkg_bun_01/{cover,tab,1..8}.png`
- Create: `packages/db/src/seed/sticker-fixtures/generate.mjs`(一次性工具)

- [ ] **Step 1: Write PNG generator script**

用 node 內建 zlib + CRC 產 200×200 solid-color PNG,避免加 sharp 依賴。

```js
// packages/db/src/seed/sticker-fixtures/generate.mjs

import { deflateSync } from 'zlib'
import { createHash } from 'crypto'
import { writeFileSync, mkdirSync } from 'fs'
import path from 'path'

// 產生 200×200 單色 PNG + 中央文字(用 SVG 當 fallback 嫌煩,這裡最小做法:純色)
// 若你想要文字標示,可以用 HTML canvas / puppeteer / sharp,但會增加依賴。
// MVP 接受「純色 + filename 可辨識」即可。

function makeSolidPng(hex, size = 200) {
  const [r, g, b] = [parseInt(hex.slice(0, 2), 16), parseInt(hex.slice(2, 4), 16), parseInt(hex.slice(4, 6), 16)]
  const ihdr = Buffer.from([
    0x00, 0x00, 0x00, 0x0d,  // length 13
    0x49, 0x48, 0x44, 0x52,  // "IHDR"
    ...intBE(size), ...intBE(size),
    0x08, 0x02,  // bit depth 8, color type 2 (RGB)
    0x00, 0x00, 0x00,
  ])
  // append CRC
  const ihdrData = ihdr.slice(4)
  const ihdrWithCrc = Buffer.concat([ihdr, crc(ihdrData)])

  const rowBytes = Buffer.alloc(size * 3)
  for (let i = 0; i < size; i++) { rowBytes[i * 3] = r; rowBytes[i * 3 + 1] = g; rowBytes[i * 3 + 2] = b }
  const scanlines = Buffer.alloc(size * (size * 3 + 1))
  for (let y = 0; y < size; y++) {
    scanlines[y * (size * 3 + 1)] = 0
    rowBytes.copy(scanlines, y * (size * 3 + 1) + 1)
  }
  const compressed = deflateSync(scanlines)
  const idat = Buffer.concat([
    Buffer.from([0x49, 0x44, 0x41, 0x54]),
    compressed,
  ])
  const idatLen = Buffer.alloc(4); idatLen.writeUInt32BE(compressed.length, 0)
  const idatWithCrc = Buffer.concat([idatLen, idat, crc(idat)])

  const iend = Buffer.from([0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4e, 0x44, 0xae, 0x42, 0x60, 0x82])

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    ihdrWithCrc,
    idatWithCrc,
    iend,
  ])
}

function intBE(n) { const b = Buffer.alloc(4); b.writeUInt32BE(n, 0); return [...b] }
function crc(buf) {
  // PNG CRC via zlib.crc32 is not in stdlib; use a manual polynomial
  const table = []
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1)
    table[n] = c >>> 0
  }
  let c = 0xffffffff
  for (let i = 0; i < buf.length; i++) c = (table[(c ^ buf[i]) & 0xff] ^ (c >>> 8)) >>> 0
  const out = Buffer.alloc(4); out.writeUInt32BE((c ^ 0xffffffff) >>> 0, 0); return out
}

const PACKAGES = [
  { id: 'pkg_cat_01', baseHex: 'ffb347' },
  { id: 'pkg_dog_01', baseHex: '87ceeb' },
  { id: 'pkg_bun_01', baseHex: 'f8b4d9' },
]
const __dirname = path.dirname(new URL(import.meta.url).pathname)

for (const pkg of PACKAGES) {
  const dir = path.join(__dirname, pkg.id)
  mkdirSync(dir, { recursive: true })
  writeFileSync(path.join(dir, 'cover.png'), makeSolidPng(pkg.baseHex, 370))
  writeFileSync(path.join(dir, 'tab.png'), makeSolidPng(pkg.baseHex, 60))
  for (let i = 1; i <= 8; i++) {
    // 每張微調色調(i × 16 加 R)
    const r = Math.min(0xff, parseInt(pkg.baseHex.slice(0, 2), 16) + i * 4).toString(16).padStart(2, '0')
    const hex = r + pkg.baseHex.slice(2)
    writeFileSync(path.join(dir, `${i}.png`), makeSolidPng(hex, 200))
  }
}
console.log('fixtures generated')
```

- [ ] **Step 2: Run generator**

Run: `node packages/db/src/seed/sticker-fixtures/generate.mjs`
Expected:30 個 PNG 檔產生在對應目錄。

- [ ] **Step 3: Verify files**

Run: `ls packages/db/src/seed/sticker-fixtures/pkg_cat_01/`
Expected: `cover.png tab.png 1.png 2.png 3.png 4.png 5.png 6.png 7.png 8.png`。

Run: `file packages/db/src/seed/sticker-fixtures/pkg_cat_01/cover.png`
Expected: `PNG image data, 370 x 370, 8-bit/color RGB, ...`(或類似)。

若 PNG 無效(例如 browser 開不出來),上網找一組 public domain 200×200 PNG 替代,放對應路徑。

- [ ] **Step 4: Commit**

```bash
git add packages/db/src/seed/sticker-fixtures/
git commit -m "feat(seed): add sticker package placeholder PNG fixtures"
```

---

### Task D2: Extend `ensureSeed` with sticker packages

**Files:**
- Modify: `packages/db/src/seed/ensureSeed.ts`

- [ ] **Step 1: Import + add constant**

```ts
// packages/db/src/seed/ensureSeed.ts 頂部 import 區域新增:
import { readFileSync } from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { stickerPackage } from '../schema-public'

// 在 TEST_USERS 附近加:
const STICKER_PACKAGE_SEEDS = [
  { id: 'pkg_cat_01', name: '貓咪日常', priceMinor: 75, stickerCount: 8 },
  { id: 'pkg_dog_01', name: '狗狗合集', priceMinor: 45, stickerCount: 8 },
  { id: 'pkg_bun_01', name: '兔兔聖誕限定', priceMinor: 129, stickerCount: 8 },
] as const

const FIXTURES_DIR = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  'sticker-fixtures',
)
```

- [ ] **Step 2: Add seed function**

在 `ensureSeed` 函式內部(Test Bot OA 區段之後),新增:

```ts
await seedStickerPackages(db, drive)
```

然後在 file 尾端新增:

```ts
async function seedStickerPackages(db: any, drive?: SeedDrive): Promise<void> {
  const now = new Date().toISOString()

  for (const pkg of STICKER_PACKAGE_SEEDS) {
    const existing = await db
      .select()
      .from(stickerPackage)
      .where(eq(stickerPackage.id, pkg.id))
      .limit(1)

    if (existing.length > 0) {
      console.info(`[seed] sticker package ${pkg.id} already exists`)
    } else {
      await db.insert(stickerPackage).values({
        id: pkg.id,
        name: pkg.name,
        description: '',
        priceMinor: pkg.priceMinor,
        currency: 'TWD',
        coverDriveKey: `stickers/${pkg.id}/cover.png`,
        tabIconDriveKey: `stickers/${pkg.id}/tab.png`,
        stickerCount: pkg.stickerCount,
        createdAt: now,
        updatedAt: now,
      })
      console.info(`[seed] created sticker package ${pkg.id}`)
    }

    if (drive) {
      try {
        const base = path.join(FIXTURES_DIR, pkg.id)
        await putPng(drive, `stickers/${pkg.id}/cover.png`, path.join(base, 'cover.png'))
        await putPng(drive, `stickers/${pkg.id}/tab.png`, path.join(base, 'tab.png'))
        for (let i = 1; i <= pkg.stickerCount; i++) {
          await putPng(drive, `stickers/${pkg.id}/${i}.png`, path.join(base, `${i}.png`))
        }
      } catch (err) {
        console.warn(`[seed] failed to upload fixtures for ${pkg.id}`, err)
      }
    }
  }
}

async function putPng(drive: SeedDrive, key: string, file: string): Promise<void> {
  const buffer = readFileSync(file)
  await drive.put(key, buffer, 'image/png')
}
```

- [ ] **Step 3: Typecheck**

Run: `bun run --cwd packages/db check`
Expected: PASS

- [ ] **Step 4: Re-seed + verify**

Run:
```bash
docker compose restart server
# 等啟動完
curl -i http://localhost:3001/uploads/stickers/pkg_cat_01/cover.png
```

Expected:200 OK + Content-Type `image/png`。

DB 驗證:
```bash
docker compose exec pgdb psql -U user -d postgres -c 'SELECT id, name, "priceMinor" FROM "stickerPackage"'
```

Expected:3 rows,id 為 `pkg_cat_01` / `pkg_dog_01` / `pkg_bun_01`。

- [ ] **Step 5: Commit**

```bash
git add packages/db/src/seed/ensureSeed.ts
git commit -m "feat(seed): seed sticker packages with fixture assets"
```

---

## Phase E — Web UI store flow

### Task E1: Store home page

**Files:**
- Create: `apps/web/app/(app)/store/index.tsx`
- Create: `apps/web/src/features/sticker-market/StoreHome.tsx`

閱讀 `apps/web/app/(app)/home/index.tsx` 了解 page layout pattern;讀 `apps/web/src/features/todo/` 了解 Tamagui + useZeroQuery 實際使用。

- [ ] **Step 1: Create route page**

```tsx
// apps/web/app/(app)/store/index.tsx
import { StoreHome } from '~/features/sticker-market/StoreHome'
export default function Page() { return <StoreHome /> }
```

- [ ] **Step 2: Create StoreHome component**

```tsx
// apps/web/src/features/sticker-market/StoreHome.tsx
import { YStack, XStack, Text, ScrollView } from '~/interface'
import { useZeroQuery } from '~/query/useZeroQuery'
import { Link } from 'one'

type StickerPackageRow = {
  id: string
  name: string
  priceMinor: number
  currency: string
  coverDriveKey: string
  stickerCount: number
}

export function StoreHome() {
  const { data: packages } = useZeroQuery((z) => z.query.stickerPackage)
  const { data: entitlements } = useZeroQuery((z) => z.query.entitlement)
  const ownedIds = new Set((entitlements ?? []).map((e: any) => e.packageId))

  return (
    <ScrollView>
      <YStack gap="$4" padding="$4">
        <Text fontSize="$8" fontWeight="700">貼圖商店</Text>
        <XStack flexWrap="wrap" gap="$3">
          {(packages ?? []).map((p: StickerPackageRow) => (
            <Link key={p.id} href={`/store/${p.id}`}>
              <YStack width={160} borderRadius="$4" overflow="hidden" backgroundColor="$background">
                <img
                  src={`/uploads/${p.coverDriveKey}`}
                  alt={p.name}
                  style={{ width: '100%', height: 160, objectFit: 'cover' }}
                />
                <YStack padding="$2" gap="$1">
                  <Text fontWeight="600">{p.name}</Text>
                  <Text fontSize="$3" color="$color11">
                    {p.currency === 'TWD' ? `NT$${p.priceMinor}` : `$${p.priceMinor}`}
                  </Text>
                  {ownedIds.has(p.id) && (
                    <Text fontSize="$2" color="$green10">已擁有</Text>
                  )}
                </YStack>
              </YStack>
            </Link>
          ))}
        </XStack>
      </YStack>
    </ScrollView>
  )
}
```

若 `~/interface` 沒直接有 `img`,web 可以用原生 `<img>`(因為 `apps/web` 是 OneJS web entry);native 可能需要 `Image`,此 slice 先 web-only。

若 entitlement 沒自動在 Zero client schema 中,回頭檢查 Task A3 的 zero-schema 設定。

- [ ] **Step 3: Verify in browser**

Run:
```bash
docker compose up -d
# 開 http://localhost:3000/store
```

登入 test1,看到 3 個 package card。若 cover 圖片 404,`docker compose logs server | grep uploads`。

- [ ] **Step 4: Commit**

```bash
git add "apps/web/app/(app)/store/" apps/web/src/features/sticker-market/StoreHome.tsx
git commit -m "feat(web): add sticker market store home page"
```

---

### Task E2: Package detail page + CheckoutSheet

**Files:**
- Create: `apps/web/app/(app)/store/[packageId].tsx`
- Create: `apps/web/src/features/sticker-market/PackageDetail.tsx`
- Create: `apps/web/src/features/sticker-market/CheckoutSheet.tsx`

- [ ] **Step 1: Create route page**

```tsx
// apps/web/app/(app)/store/[packageId].tsx
import { useParams } from 'one'
import { PackageDetail } from '~/features/sticker-market/PackageDetail'
export default function Page() {
  const { packageId } = useParams()
  return <PackageDetail packageId={packageId as string} />
}
```

- [ ] **Step 2: PackageDetail + CheckoutSheet**

```tsx
// apps/web/src/features/sticker-market/PackageDetail.tsx
import { useState } from 'react'
import { YStack, XStack, Text, Button, ScrollView } from '~/interface'
import { useZeroQuery } from '~/query/useZeroQuery'
import { CheckoutSheet } from './CheckoutSheet'

export function PackageDetail({ packageId }: { packageId: string }) {
  const { data: pkgs } = useZeroQuery((z) => z.query.stickerPackage.where('id', packageId))
  const { data: ents } = useZeroQuery((z) => z.query.entitlement.where('packageId', packageId))
  const pkg = pkgs?.[0]
  const owned = (ents ?? []).length > 0
  const [sheetOpen, setSheetOpen] = useState(false)

  if (!pkg) return <Text>Loading...</Text>

  return (
    <YStack flex={1}>
      <ScrollView>
        <YStack padding="$4" gap="$4">
          <img
            src={`/uploads/${pkg.coverDriveKey}`}
            alt={pkg.name}
            style={{ width: '100%', maxWidth: 370, aspectRatio: 1, objectFit: 'cover', alignSelf: 'center' }}
          />
          <Text fontSize="$8" fontWeight="700">{pkg.name}</Text>
          <Text color="$color11">{pkg.stickerCount} 張 · {pkg.currency === 'TWD' ? `NT$${pkg.priceMinor}` : `$${pkg.priceMinor}`}</Text>
          <Text>{pkg.description}</Text>
          <XStack flexWrap="wrap" gap="$2">
            {Array.from({ length: pkg.stickerCount }).map((_, i) => (
              <img
                key={i}
                src={`/uploads/stickers/${pkg.id}/${i + 1}.png`}
                style={{ width: 80, height: 80 }}
                alt={`sticker ${i + 1}`}
              />
            ))}
          </XStack>
        </YStack>
      </ScrollView>

      {/* Sticky bottom bar */}
      <XStack
        position="absolute"
        bottom={0} left={0} right={0}
        padding="$3"
        backgroundColor="$background"
        borderTopWidth={1}
        borderTopColor="$borderColor"
        justifyContent="space-between"
        alignItems="center"
      >
        <Text fontSize="$6" fontWeight="600">
          {pkg.currency === 'TWD' ? `NT$${pkg.priceMinor}` : `$${pkg.priceMinor}`}
        </Text>
        {owned ? (
          <Button disabled>已擁有</Button>
        ) : (
          <Button onPress={() => setSheetOpen(true)}>立即購買</Button>
        )}
      </XStack>

      <CheckoutSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        pkg={pkg}
      />
    </YStack>
  )
}
```

```tsx
// apps/web/src/features/sticker-market/CheckoutSheet.tsx
import { useState } from 'react'
import { YStack, XStack, Text, Button, Sheet } from '~/interface'
import { useRouter } from 'one'
import { useTanMutation } from '~/query/tan'
import { stickerMarketUserClient } from '~/lib/connect'

const ENABLE_SIMULATE = import.meta.env.VITE_DEV_ENABLE_SIMULATE_PAID === '1'

export function CheckoutSheet({
  open, onOpenChange, pkg,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  pkg: { id: string; name: string; priceMinor: number; currency: string }
}) {
  const [simulate, setSimulate] = useState(false)
  const router = useRouter()

  const mutation = useTanMutation({
    mutationFn: (args: { simulatePaid: boolean }) =>
      stickerMarketUserClient.createCheckout({ packageId: pkg.id, simulatePaid: args.simulatePaid }),
    onSuccess: (res) => {
      onOpenChange(false)
      // 把 redirect form 透過 navigation state 傳到 /pay/redirect
      router.push({
        pathname: '/pay/redirect',
        state: { redirect: res.redirect, orderId: res.orderId },
      } as any)
    },
  })

  return (
    <Sheet modal open={open} onOpenChange={onOpenChange} dismissOnSnapToBottom>
      <Sheet.Overlay />
      <Sheet.Handle />
      <Sheet.Frame padding="$4" gap="$3">
        <Text fontSize="$6" fontWeight="700">確認購買</Text>
        <XStack gap="$3" alignItems="center">
          <YStack flex={1}>
            <Text>{pkg.name}</Text>
            <Text color="$color11">{pkg.currency === 'TWD' ? `NT$${pkg.priceMinor}` : `$${pkg.priceMinor}`}</Text>
          </YStack>
        </XStack>
        {ENABLE_SIMULATE && (
          <XStack gap="$2" alignItems="center">
            <input type="checkbox" checked={simulate} onChange={(e) => setSimulate(e.target.checked)} />
            <Text>(dev) 模擬付款成功</Text>
          </XStack>
        )}
        <Button
          onPress={() => mutation.mutate({ simulatePaid: simulate })}
          disabled={mutation.isPending}
        >
          {mutation.isPending ? '處理中...' : `確認付款 ${pkg.currency === 'TWD' ? `NT$${pkg.priceMinor}` : `$${pkg.priceMinor}`}`}
        </Button>
        {mutation.isError && (
          <Text color="$red10">付款初始化失敗,請稍後再試</Text>
        )}
        <Text fontSize="$2" color="$color11">
          付款後即可在 Vine 聊天室使用此貼圖組
        </Text>
      </Sheet.Frame>
    </Sheet>
  )
}
```

> `stickerMarketUserClient`:讀 `apps/web/src/lib/connect.ts` 或 `apps/web/src/lib/` 找既有 ConnectRPC client factory,新增一個 export:
> ```ts
> export const stickerMarketUserClient = createPromiseClient(StickerMarketUserService, transport)
> ```

- [ ] **Step 3: Verify in browser**

登入 test1 → /store → 點某個 package → 看到詳情頁 + Sticky Bottom Bar → 點「立即購買」→ sheet 跳出。

若有 error: console 看是否 RPC client 沒設好,或 path params 沒抓到。

- [ ] **Step 4: Commit**

```bash
git add "apps/web/app/(app)/store/[packageId].tsx" apps/web/src/features/sticker-market/
git commit -m "feat(web): package detail page + checkout sheet"
```

---

### Task E3: Payment redirect page

**Files:**
- Create: `apps/web/app/(app)/pay/redirect.tsx`
- Create: `apps/web/src/features/sticker-market/PaymentRedirectPage.tsx`

- [ ] **Step 1: Create route**

```tsx
// apps/web/app/(app)/pay/redirect.tsx
import { PaymentRedirectPage } from '~/features/sticker-market/PaymentRedirectPage'
export default function Page() { return <PaymentRedirectPage /> }
```

- [ ] **Step 2: Component**

```tsx
// apps/web/src/features/sticker-market/PaymentRedirectPage.tsx
import { useEffect, useRef } from 'react'
import { useLocation } from 'one'
import { YStack, Text } from '~/interface'

type RedirectState = {
  redirect?: { targetUrl: string; formFields: Record<string, string> }
  orderId?: string
}

export function PaymentRedirectPage() {
  const location = useLocation() as { state?: RedirectState }
  const formRef = useRef<HTMLFormElement>(null)
  const redirect = location.state?.redirect

  useEffect(() => {
    if (!formRef.current) return
    const t = setTimeout(() => formRef.current?.submit(), 300)
    return () => clearTimeout(t)
  }, [redirect])

  if (!redirect) {
    return (
      <YStack padding="$4" gap="$3">
        <Text>找不到付款資料,請重新進入商品頁。</Text>
      </YStack>
    )
  }

  return (
    <YStack flex={1} alignItems="center" justifyContent="center" gap="$3">
      <Text fontSize="$6">正在導向付款頁面...</Text>
      <Text fontSize="$3" color="$color11">請勿關閉此頁面</Text>
      <form ref={formRef} method="POST" action={redirect.targetUrl} style={{ display: 'none' }}>
        {Object.entries(redirect.formFields).map(([k, v]) => (
          <input key={k} type="hidden" name={k} value={v} />
        ))}
      </form>
    </YStack>
  )
}
```

`useLocation` 具體 API 看 OneJS:若無 state 傳遞,改用 `sessionStorage.setItem('pay-redirect', JSON.stringify(...))` 在 CheckoutSheet 存,在此頁讀。

- [ ] **Step 3: Manual test(dev simulate)**

Web .env 設 `VITE_DEV_ENABLE_SIMULATE_PAID=1`,重啟 web。/store/pkg_cat_01 → 購買 → 勾模擬付款 → 確認 → 進 /pay/redirect → 應跳 `payment-stage.ecpay.com.tw` → 因 SimulatePaid=1 自動回 OrderResultURL。

- [ ] **Step 4: Commit**

```bash
git add "apps/web/app/(app)/pay/redirect.tsx" apps/web/src/features/sticker-market/PaymentRedirectPage.tsx
git commit -m "feat(web): payment redirect page auto-submits form to ECPay"
```

---

### Task E4: Payment result page with polling

**Files:**
- Create: `apps/web/app/(app)/pay/result.tsx`
- Create: `apps/web/src/features/sticker-market/PaymentResultPage.tsx`

- [ ] **Step 1: Create route**

```tsx
// apps/web/app/(app)/pay/result.tsx
import { PaymentResultPage } from '~/features/sticker-market/PaymentResultPage'
export default function Page() { return <PaymentResultPage /> }
```

- [ ] **Step 2: Component**

```tsx
// apps/web/src/features/sticker-market/PaymentResultPage.tsx
import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'one'
import { YStack, XStack, Text, Button } from '~/interface'
import { useTanQuery } from '~/query/tan'
import { stickerMarketUserClient } from '~/lib/connect'

const POLL_INTERVAL_MS = 1000
const POLL_TIMEOUT_MS = 10_000

export function PaymentResultPage() {
  const router = useRouter()
  const params = useSearchParams()
  const orderId = params.get('orderId') ?? ''
  const [startedAt] = useState(() => Date.now())
  const [timedOut, setTimedOut] = useState(false)

  const q = useTanQuery({
    queryKey: ['order', orderId],
    queryFn: () => stickerMarketUserClient.getOrder({ orderId }),
    enabled: !!orderId,
    refetchInterval: (q) => {
      if (q.state.data && q.state.data.status === 1) {
        // still created → keep polling
        if (Date.now() - startedAt > POLL_TIMEOUT_MS) {
          setTimedOut(true)
          return false
        }
        return POLL_INTERVAL_MS
      }
      return false
    },
  })

  if (!orderId) return <Text>缺少 orderId</Text>
  if (q.isLoading) return <Text>查詢中...</Text>
  const o = q.data
  if (!o) return <Text>無法取得訂單</Text>

  // 2 = PAID, 3 = FAILED
  if (o.status === 2) {
    return (
      <YStack padding="$4" gap="$3" alignItems="center">
        <Text fontSize="$8">🎉</Text>
        <Text fontSize="$6" fontWeight="700">購買成功!</Text>
        <Text>訂單 {o.orderId}</Text>
        <XStack gap="$3">
          <Button onPress={() => router.push('/home')}>去聊天室使用</Button>
          <Button variant="outlined" onPress={() => router.push('/store')}>繼續逛商店</Button>
        </XStack>
      </YStack>
    )
  }

  if (o.status === 3) {
    return (
      <YStack padding="$4" gap="$3">
        <Text fontSize="$6" fontWeight="700">付款失敗</Text>
        <Text color="$color11">{o.failureReason}</Text>
        <Button onPress={() => router.push('/store')}>回商店</Button>
      </YStack>
    )
  }

  return (
    <YStack padding="$4" gap="$3">
      <Text fontSize="$6">處理中...</Text>
      {timedOut && (
        <YStack gap="$2">
          <Text color="$color11">
            付款正在處理,可能需要幾分鐘。請勿重複付款。
          </Text>
          <Button onPress={() => q.refetch()}>手動重新查詢</Button>
        </YStack>
      )}
    </YStack>
  )
}
```

- [ ] **Step 3: Manual test**

完整 flow(dev simulate):/store/pkg_cat_01 → 購買 → 勾模擬 → redirect → 回 /pay/result → 看到「購買成功」。

若 status 卡在「處理中」10s:表示 webhook 沒來或沒成功。`docker compose logs server | grep ecpay` 看 webhook log。

- [ ] **Step 4: Commit**

```bash
git add "apps/web/app/(app)/pay/result.tsx" apps/web/src/features/sticker-market/PaymentResultPage.tsx
git commit -m "feat(web): payment result page with polling"
```

---

## Phase F — Chat integration

### Task F1: Zero custom mutator for sticker messages

**Files:**
- Create / Modify: `packages/zero-schema/src/server/mutators/message.ts`(若 file 不存在就 create)

讀 `packages/zero-schema/src/server/` 既有 mutator pattern。

- [ ] **Step 1: Add sticker mutator**

```ts
// packages/zero-schema/src/server/mutators/message.ts
import { ulid } from 'ulid'

// 命名對齊 F2 呼叫端:zero.mutate.message.insertSticker(...)
export async function insertSticker(
  tx: any,
  input: { chatId: string; packageId: string; stickerId: string },
  authData: { userID: string },
): Promise<void> {
  // 先查 entitlement — 必須擁有才能發
  const [owned] = await tx
    .query('entitlement')
    .where('userId', authData.userID)
    .where('packageId', input.packageId)
    .limit(1)
    .run()
  if (!owned) {
    throw new Error(`entitlement required for package ${input.packageId}`)
  }

  await tx.mutate.message.insert({
    id: ulid(),
    chatId: input.chatId,
    senderId: authData.userID,
    senderType: 'user',
    type: 'sticker',
    metadata: JSON.stringify({ packageId: input.packageId, stickerId: input.stickerId }),
    createdAt: new Date().toISOString(),
  })
}
```

實際 API 依 zero-schema 的 customMutators 慣例 — 讀現有 chat-related mutators 對齊呼叫方式。

- [ ] **Step 2: Wire into exports**

`packages/zero-schema/src/server/mutators/index.ts`(或同類檔)加 re-export,確保 server 側 Zero push handler 能呼叫到。

- [ ] **Step 3: Test via Zero integration**

這 mutator 難以 pure unit test(依 tx API)。暫以 Task F2 的 UI 手動觸發驗證(送出時 server 回 error 代表 entitlement check 有作用)。

寫一個最輕的 integration:

```ts
// packages/zero-schema/src/server/mutators/message.test.ts

import { describe, it, expect, vi } from 'vitest'
import { insertSticker } from './message'

describe('insertSticker', () => {
  it('throws when entitlement missing', async () => {
    const tx = {
      query: () => ({ where: () => ({ where: () => ({ limit: () => ({ run: async () => [] }) }) }) }),
      mutate: { message: { insert: vi.fn() } },
    } as any
    await expect(
      insertSticker(tx, { chatId: 'c', packageId: 'p', stickerId: '1' }, { userID: 'u1' }),
    ).rejects.toThrow(/entitlement required/)
    expect(tx.mutate.message.insert).not.toHaveBeenCalled()
  })

  it('inserts when entitled', async () => {
    const insert = vi.fn()
    const tx = {
      query: () => ({ where: () => ({ where: () => ({ limit: () => ({ run: async () => [{ id: 'e1' }] }) }) }) }),
      mutate: { message: { insert } },
    } as any
    await insertSticker(tx, { chatId: 'c', packageId: 'p', stickerId: '1' }, { userID: 'u1' })
    expect(insert).toHaveBeenCalledWith(expect.objectContaining({
      type: 'sticker',
      metadata: JSON.stringify({ packageId: 'p', stickerId: '1' }),
    }))
  })
})
```

Run: `bun run --cwd packages/zero-schema test -- message.test.ts`
Expected: 2 passing

> **如果 Zero customMutators API 在此 repo 未啟用**:fallback:在 `apps/server/src/connect/stickerMarketUser.ts` 加 `sendStickerMessage` RPC,前端改打 ConnectRPC。Message 仍走 Zero insert,但先在 RPC 內驗 entitlement。Proto 新增對應 message,重新 codegen。

- [ ] **Step 4: Commit**

```bash
git add packages/zero-schema/src/server/mutators/
git commit -m "feat(zero): custom mutator for sticker messages with entitlement check"
```

---

### Task F2: Sticker picker in chat

**Files:**
- Create: `apps/web/src/features/chat/ui/StickerPicker.tsx`
- Modify: `apps/web/src/features/chat/ui/MessageInput.tsx`

- [ ] **Step 1: Create StickerPicker**

```tsx
// apps/web/src/features/chat/ui/StickerPicker.tsx
import { useState } from 'react'
import { YStack, XStack, Text, Sheet, ScrollView, Button } from '~/interface'
import { useZeroQuery, useZero } from '~/query/useZeroQuery'

type Pkg = { id: string; name: string; tabIconDriveKey: string; stickerCount: number }

export function StickerPicker({
  open, onOpenChange, chatId,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  chatId: string
}) {
  const { data: ents } = useZeroQuery((z) =>
    z.query.entitlement.related('package' as any),
  )
  const ownedPackages: Pkg[] = (ents ?? [])
    .map((e: any) => e.package)
    .filter(Boolean)

  const [activeIdx, setActiveIdx] = useState(0)
  const active = ownedPackages[activeIdx]
  const zero = useZero()

  async function sendSticker(stickerId: string) {
    if (!active) return
    try {
      await zero.mutate.message.insertSticker({
        chatId,
        packageId: active.id,
        stickerId,
      })
      onOpenChange(false)
    } catch (err) {
      console.error('sendSticker failed', err)
    }
  }

  return (
    <Sheet modal open={open} onOpenChange={onOpenChange} snapPoints={[60]}>
      <Sheet.Overlay />
      <Sheet.Handle />
      <Sheet.Frame padding="$2" gap="$2">
        {ownedPackages.length === 0 ? (
          <YStack padding="$4" alignItems="center" gap="$2">
            <Text>你還沒有任何貼圖組</Text>
            <Button onPress={() => { onOpenChange(false); /* navigate /store */ }}>
              去商店
            </Button>
          </YStack>
        ) : (
          <>
            <XStack gap="$2" borderBottomWidth={1} borderBottomColor="$borderColor" paddingBottom="$2">
              {ownedPackages.map((p, i) => (
                <Button
                  key={p.id}
                  size="$2"
                  theme={i === activeIdx ? 'active' : undefined}
                  onPress={() => setActiveIdx(i)}
                >
                  <img
                    src={`/uploads/${p.tabIconDriveKey}`}
                    style={{ width: 32, height: 32 }}
                    alt={p.name}
                  />
                </Button>
              ))}
            </XStack>
            <ScrollView>
              <XStack flexWrap="wrap" gap="$2">
                {Array.from({ length: active?.stickerCount ?? 0 }).map((_, i) => {
                  const sid = String(i + 1)
                  return (
                    <Button
                      key={sid}
                      size="$6"
                      onPress={() => sendSticker(sid)}
                      unstyled
                    >
                      <img
                        src={`/uploads/stickers/${active!.id}/${sid}.png`}
                        style={{ width: 80, height: 80 }}
                        alt={sid}
                      />
                    </Button>
                  )
                })}
              </XStack>
            </ScrollView>
          </>
        )}
      </Sheet.Frame>
    </Sheet>
  )
}
```

- [ ] **Step 2: Hook into MessageInput**

讀既有 `MessageInput.tsx`,在按鈕組中加一個 🏷 icon button:

```tsx
const [stickerPickerOpen, setStickerPickerOpen] = useState(false)
// ... 既有 handler
<Button onPress={() => setStickerPickerOpen(true)}>🏷</Button>
// ... 底部:
<StickerPicker open={stickerPickerOpen} onOpenChange={setStickerPickerOpen} chatId={chatId} />
```

- [ ] **Step 3: Manual test**

登入 test1 → 買一個 pack(若尚未)→ 進聊天室 → 點 🏷 → 看到 picker → 點貼圖 → message 送出。

若送出失敗(entitlement check 拒絕):檢查 Task A3 entitlement Zero 同步 + Task F1 mutator。

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/features/chat/ui/StickerPicker.tsx apps/web/src/features/chat/ui/MessageInput.tsx
git commit -m "feat(chat): sticker picker sheet for owned packages"
```

---

### Task F3: Render sticker messages in bubble

**Files:**
- Modify: `apps/web/src/features/chat/ui/MessageBubble.tsx`

- [ ] **Step 1: Add sticker branch**

讀既有 `MessageBubble.tsx` type-by-type switch,加:

```tsx
if (message.type === 'sticker') {
  try {
    const meta = JSON.parse(message.metadata ?? '{}') as { packageId: string; stickerId: string }
    const url = `/uploads/stickers/${meta.packageId}/${meta.stickerId}.png`
    return (
      <img
        src={url}
        alt="sticker"
        style={{ width: 150, height: 150, display: 'block' }}
      />
    )
  } catch {
    return <Text color="$color11">[貼圖格式錯誤]</Text>
  }
}
```

- [ ] **Step 2: Manual test — two-browser**

在一個 browser 登 test1(買家),另一個登 test2。兩邊都開 test1↔test2 的 chat。
test1 透過 StickerPicker 送貼圖 → test1 端 MessageBubble 顯示 → test2 端也同步顯示。

test2 不需購買即可看到(§10.3.4 顯示免費)。

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/features/chat/ui/MessageBubble.tsx
git commit -m "feat(chat): render sticker messages"
```

---

## Phase G — Done-done

### Task G1: Manual done-done walkthrough

**Files:**
- Read: `docs/superpowers/specs/2026-04-23-vine-creator-market-payments-mvp-design.md`(§1.2 驗收)

- [ ] **Step 1: Docker Compose 全起**

```bash
docker compose down
docker compose up -d --build
docker compose logs -f server | grep -i error | head -20
```

Expected:無 startup error。

- [ ] **Step 2: 走過 §1.2 9 個步驟**

依 design spec §1.2,從登入 test1 → 購物 → ECPay 模擬付款 → result 成功頁 → 聊天室 picker → 送貼圖 → 兩個瀏覽器互看。

每一步確認 OK 即打勾:

- [ ] test1 登入,/store 看到 3 個 seeded package
- [ ] /store/pkg_cat_01 顯示封面 + 售價 + Sticky Bottom Bar
- [ ] 點立即購買 → sheet 出現 → 勾模擬付款 → 確認
- [ ] /pay/redirect 自動跳轉 ECPay → 回流 /pay/result
- [ ] /pay/result 顯示「購買成功」+ 雙 CTA
- [ ] test1 與 test2 聊天室,點 🏷 看到剛買的 pack
- [ ] 點貼圖 → 發送 → 即時看到
- [ ] test2 的 browser 也看到貼圖
- [ ] test2(未購買)的 picker 裡沒有 pkg_cat_01

- [ ] **Step 3: 跑 Tier A 全部 test**

```bash
bun run test
```

Expected: all green。

- [ ] **Step 4: Update roadmap**

Modify `docs/vine-creator-market-roadmap.md` Phase 1 節點:加「✅ Completed YYYY-MM-DD,交付物:payments MVP vertical slice」。

- [ ] **Step 5: Final commit**

```bash
git add docs/vine-creator-market-roadmap.md
git commit -m "docs: mark Phase 1 payments MVP as completed"
```

---

## 附錄:Tier B E2E(optional,非此 plan 必要)

若要驗證與真實 ECPay staging 交互:

1. 開 `ngrok http 3001`,取 `https://xxx.ngrok.io`
2. 設 `PAYMENTS_RETURN_URL=https://xxx.ngrok.io/webhooks/ecpay`,重啟 server
3. 走一次完整 flow,**不勾模擬付款**,用測試卡 `4311-9522-2222-2222`、CVV `222`、3DS OTP `1234`
4. 確認 server log 收到真實 ECPay webhook + CheckMacValue 驗證通過

此驗證不在 plan 預設範圍,但上 prod 前必跑一次。

---

*Plan v1 · 2026-04-23 · 執行前請先讀對應 design spec 與 AGENTS.md 的 skill routing*
