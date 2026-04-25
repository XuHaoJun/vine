# Vine Creator Market — Payments Hardening (Phase 1.5) Design

> **Slice 範圍**:在 Phase 1 付款閉環完成後,補上付款層進 prod 前最需要的補償與查核能力。這不是新商店功能,也不是創作者側 MVP。
>
> **上層 roadmap**:[`docs/vine-creator-market-roadmap.md`](../../vine-creator-market-roadmap.md)
> **前一階段設計**:[`2026-04-23-vine-creator-market-payments-mvp-design.md`](./2026-04-23-vine-creator-market-payments-mvp-design.md)
> **前一階段 plan**:[`2026-04-23-vine-creator-market-payments-mvp.md`](../plans/2026-04-23-vine-creator-market-payments-mvp.md)

---

## 1. 目標與成功標準

### 1.1 要解決什麼

Phase 1 已驗證「購買 → ECPay credit checkout → webhook → entitlement → 聊天室使用」的垂直閉環。Phase 1.5 要補的是 payment edge case:

1. 用戶付款成功,但 Vine 沒有成功 grant entitlement。
2. 用戶或客服需要針對技術性錯誤執行全額退款。
3. Vine 的 `stickerOrder` 狀態與 ECPay 實際狀態可能不一致。
4. 付款異常目前只有 log,缺少可替換的告警邊界。

### 1.2 成功標準

這個 slice 完成後,以下情境必須可測:

1. 已付款訂單可以由 admin RPC 發起全額退款,狀態從 `paid` 進入 `refund_pending`,成功後變成 `refunded`。
2. 若 refund 成功且該 order 已 grant entitlement,Vine 會 revoke 該 entitlement,但不刪除既有聊天訊息。
3. 若 webhook 付款成功但 entitlement grant 失敗,Vine 會記錄 critical alert,使用 webhook event 內的 ECPay `TradeNo` 把 order 轉入補償退款流程。
4. Refund request 重送是 idempotent:同一筆 order 不會產生第二次外部退款呼叫。
5. Reconciliation service 可以查詢近期 `created` / `paid` / `failed` / `refund_pending` orders,比對 ECPay 查詢結果,並輸出 mismatch report。
6. 所有 high-risk 異常會經過 `PaymentAlertSink`;預設實作仍寫 log,但 service 不直接耦合 Sentry。

---

## 2. 非目標

以下明確不放進 Phase 1.5:

- ATM / CVS / BARCODE 等非即時付款。
- Apple Pay / LINE Pay / TWQR / 第二 connector。
- 部分退款。貼圖數位內容退款只支援全額補償。
- 完整 admin UI。這一刀只提供 admin ConnectRPC handler 與 service。
- 創作者 dashboard、上傳、審核、payout、稅務。
- 對已發出的 sticker message 做刪除或隱藏。退款只影響日後能否從 picker 使用該 pack。

---

## 3. 已確認脈絡

### 3.1 現有付款實作

- `packages/pay` 目前 expose `createCharge()` 和 `handleWebhook()`。
- `createCharge()` 直接產生 ECPay AIO form fields,沒有走 prism `PaymentClient.authorize()`。原因是 prism ECPay authorize 對 AIO HTML redirect flow 不合用。
- `handleWebhook()` 優先嘗試 prism `EventClient.handleEvent()`,失敗時 fallback 到 Vine 自己的 CheckMacValue 驗證與 urlencoded parser。
- `apps/server/src/services/payments` 已有 order repository、entitlement repository、event handler、webhook route。
- `stickerOrder` 目前只有 `created | paid | failed` 三種狀態。

### 3.2 ECPay 限制

依 `docs/ECPay-API-Skill/guides/01-payment-aio.md`:

- AIO 訂單查詢使用 `/Cashier/QueryTradeInfo/V5`,stage domain 是 `https://payment-stage.ecpay.com.tw`。
- AIO 信用卡請退款使用 `/CreditDetail/DoAction`,正式 domain 是 `https://payment.ecpay.com.tw/CreditDetail/DoAction`。
- `DoAction` stage 環境不可實際測試。
- `Action=R` 只適用於信用卡已關帳交易;ATM / CVS / BARCODE 不支援線上退款 API。
- `QueryTradeInfo` 的 `TimeStamp` 有效期只有 3 分鐘,每次呼叫必須重新產生。

### 3.3 設計假設

- Phase 1.5 只支援 Phase 1 已有的 ECPay AIO credit card checkout。
- Refund 使用 Vine direct ECPay AIO helper,不依賴 prism refund path。這與 Phase 1 的 direct AIO form creation 一致,也避開 prism 對 AIO redirect flow 的相容性風險。
- Stage mode 不打 ECPay `DoAction`;`refundCharge()` 回傳 `simulated` 結果,讓 server 狀態機、idempotency、entitlement revoke 可以在 dev/CI 測。
- Prod mode 才會對 ECPay `/CreditDetail/DoAction` 發出真 refund request。

---

## 4. 方案比較

### 4.1 推薦方案:最小付款強化

在現有 `@vine/pay` 與 server payments service 內加入:

- direct ECPay `refundCharge()` 與 `getCharge()` helper。
- order refund 狀態機。
- admin RPC: `RefundOrder`、`ReconcileStickerOrders`。
- `PaymentAlertSink` 抽象,預設 log。

優點是範圍小、接近 Phase 1 既有架構、能直接保護最危險的付款 edge case。缺點是還不是完整 payment platform,也沒有 UI。

### 4.2 替代方案:只做 reconciliation,不做 refund

這會比較快,但發現「付款成功但未授權」時仍只能人工處理。它沒有真正補上 Phase 1 最大風險,所以不採用。

### 4.3 替代方案:一次做完整 Phase 1.5 表格

把 ATM/CVS、Apple Pay/LINE Pay、第二 connector 一起做,可以更完整驗證 `PaymentsService` 抽象。但這會把下一刀擴成多付款方式平台,而 Phase 2 創作者 MVP 會被延後太久,所以不採用。

---

## 5. 模組邊界

```text
packages/pay/
  src/
    types.ts                     + RefundChargeInput/Result, GetChargeInput/Result
    service.ts                   + refundCharge(), getCharge()
    ecpay/
      endpoints.ts               stage/prod endpoint selection
      form.ts                    urlencoded POST helper + parser
      query-trade.ts             QueryTradeInfo request/response normalization
      refund.ts                  CreditDetail/DoAction refund request

apps/server/src/services/payments/
  alert-sink.ts                  PaymentAlertSink interface + log sink
  order.repository.ts            refund/reconciliation state transitions
  entitlement.repository.ts      revokeByOrder()
  refund.service.ts              admin/manual + automatic compensation orchestration
  reconciliation.service.ts      batch order comparison against ECPay
  event-handler.ts               wraps entitlement grant failure with compensation path

packages/proto/proto/stickerMarket/v1/
  stickerMarket.proto            + StickerMarketAdminService

apps/server/src/connect/
  stickerMarketAdmin.ts          admin-only handlers for refund/reconciliation
  routes.ts                      register StickerMarketAdminService with auth wrapper

packages/db/src/
  schema-private.ts              extend stickerOrder refund/reconciliation fields
  migrations/                    add migration
```

Boundary rules:

- `packages/pay` knows ECPay protocol details, but not Vine DB.
- `apps/server/src/services/payments` owns Vine order/entitlement state transitions.
- Connect handlers only authenticate, authorize admin role, validate request shape, and call services.
- No service reads `process.env`; `apps/server/src/index.ts` passes concrete config through existing wiring.

---

## 6. Public `@vine/pay` Contract

### 6.1 Types

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

export type PaymentsService = {
  createCharge(input: CreateChargeInput): Promise<CreateChargeResult>
  handleWebhook(input: HandleWebhookInput): Promise<HandleWebhookResult>
  refundCharge(input: RefundChargeInput): Promise<RefundChargeResult>
  getCharge(input: GetChargeInput): Promise<ChargeStatusResult>
}
```

### 6.2 ECPay direct helper behavior

`getCharge()`:

- POSTs `MerchantID`, `MerchantTradeNo`, `TimeStamp`, `CheckMacValue` to `/Cashier/QueryTradeInfo/V5`.
- Parses urlencoded response into `Record<string, string>`.
- Maps `TradeStatus=1` to `paid`.
- Maps known "order not found" response to `not_found`.
- Keeps unrecognized responses as `unknown` with raw payload.

`refundCharge()`:

- Rejects non-TWD.
- Requires `connectorChargeId` because ECPay refund needs `TradeNo`, not only Vine `MerchantTradeNo`.
- In stage mode with `testMode === true`, returns `succeeded` with `simulated: true` and no external call.
- In prod mode, POSTs `MerchantID`, `MerchantTradeNo`, `TradeNo`, `Action=R`, `TotalAmount`, `CheckMacValue` to `/CreditDetail/DoAction`.
- Maps ECPay success to `succeeded`; all non-success responses become `failed` with raw payload.

---

## 7. DB State Model

### 7.1 `stickerOrder` status

Extend `stickerOrder.status`:

```ts
type StickerOrderStatus =
  | 'created'
  | 'paid'
  | 'failed'
  | 'refund_pending'
  | 'refunded'
  | 'refund_failed'
```

State transitions:

| From | Event | To | Notes |
|---|---|---|---|
| `paid` | admin refund requested | `refund_pending` | Stores refund request fields before external call |
| `paid` | automatic compensation requested | `refund_pending` | Used when paid row already persisted |
| `created` / `failed` | automatic compensation requested | `refund_pending` | Allowed only when a verified `charge.succeeded` webhook supplied connector charge id |
| `refund_pending` | refund succeeded | `refunded` | Revokes entitlement after status update |
| `refund_pending` | refund failed | `refund_failed` | Keeps failure reason for retry |
| `refund_failed` | admin retry | `refund_pending` | Reuses same internal refund id |
| `refunded` | admin retry / webhook retry | `refunded` | No-op |
| `created` / `failed` | admin refund requested | unchanged | Rejected by service |

### 7.2 New `stickerOrder` fields

Add nullable fields to `packages/db/src/schema-private.ts`:

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

Indexes:

- Keep existing `stickerOrder_status_idx`.
- Add partial unique index `stickerOrder_refundId_unique` with SQL `WHERE "refundId" IS NOT NULL` in the migration file. This protects internal refund idempotency without forcing every non-refunded order to have a refund id.

### 7.3 Entitlement revoke

Add `entitlement.repository.revokeByOrder(tx, orderId)`:

- Deletes entitlement rows with `grantedByOrderId = orderId`.
- This removes the pack from the refunded user's picker.
- Existing sticker messages remain visible because message rendering reads public drive assets, not the sender's current entitlement.

---

## 8. Server Orchestration

### 8.1 `refund.service.ts`

Factory:

```ts
export type RefundServiceDeps = {
  db: any
  pay: PaymentsService
  orderRepo: StickerOrderRepository
  entitlementRepo: EntitlementRepository
  alerts: PaymentAlertSink
  mode: 'stage' | 'prod'
}
```

Primary method:

```ts
refundOrder(input: {
  orderId: string
  reason: 'technical_error' | 'admin_exception'
  requestedByUserId: string | undefined
}): Promise<{
  orderId: string
  status: 'refund_pending' | 'refunded' | 'refund_failed'
  simulated: boolean
  failureReason: string | undefined
}>
```

Automatic compensation method:

```ts
compensatePaidCharge(input: {
  orderId: string
  connectorChargeId: string
  amount: Money
  paidAt: Date
  reason: 'technical_error'
}): Promise<{
  orderId: string
  status: 'refund_pending' | 'refunded' | 'refund_failed'
  simulated: boolean
  failureReason: string | undefined
}>
```

Flow:

1. Transaction: load order and reject unless status is `paid` or `refund_failed`.
2. Transaction: reject if `connectorChargeId` is missing.
3. Transaction: move order to `refund_pending`, storing amount, reason, requester, and internal `refundId`.
4. External call: call `pay.refundCharge()` outside the DB transaction.
5. Transaction: if success, move order to `refunded`, set `refundedAt`, revoke entitlement by order id.
6. Transaction: if failure, move order to `refund_failed`, store failure reason.
7. Emit alert for failure or automatic compensation.

The external call is outside the transaction to avoid holding DB locks during network IO. Idempotency comes from the conditional transition into `refund_pending`; if a duplicate caller sees `refund_pending` or `refunded`, it returns the current state without calling ECPay again.

`compensatePaidCharge()` uses the same external refund code path, but its first transaction allows `created` and `failed` orders because the verified webhook is the source of truth that ECPay charged the user. It stores the webhook `connectorChargeId`, `paidAt`, and amount before moving to `refund_pending`.

### 8.2 Automatic compensation from webhook

`handlePaymentEvent()` currently transitions paid and grants entitlement in one transaction. Phase 1.5 changes the successful payment path:

1. In transaction, transition order to `paid` and attempt entitlement grant.
2. If the transaction succeeds, the order is paid and the user can use the pack.
3. If the transaction fails because entitlement grant failed, the paid transition rolls back too.
4. Outside that failed transaction, call `refundService.compensatePaidCharge()` with the verified webhook event's `connectorChargeId`, amount, and `paidAt`.
5. Emit `payment.entitlement_grant_failed` alert with order id, package id, user id, error class, and whether refund was simulated/succeeded/failed.

This preserves the normal-path invariant: Vine does not record `paid` unless entitlement was granted. If ECPay has charged the user but Vine cannot grant access, the compensation path records the connector charge id directly from the verified webhook and handles refund.

### 8.3 `PaymentAlertSink`

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
```

Initial implementation:

- `createLogPaymentAlertSink(log)` writes `critical` as `log.error()` and `warning` as `log.warn()`.
- No Sentry dependency is introduced in this slice. Later Sentry wiring can implement the same interface.

---

## 9. Reconciliation

### 9.1 Service behavior

`reconciliation.service.ts` exposes:

```ts
reconcileOrders(input: {
  since: Date
  limit: number
  dryRun: boolean
}): Promise<{
  checked: number
  matched: number
  mismatches: Array<{
    orderId: string
    localStatus: string
    connectorStatus: string
    action: 'reported' | 'marked_paid' | 'marked_failed'
    reason: string
  }>
}>
```

Order selection:

- Include `created`, `paid`, `failed`, `refund_pending`, and `refund_failed`.
- Default window is the last 24 hours.
- Default limit is 100.

Mapping:

| Local | ECPay query | Action |
|---|---|---|
| `created` | `paid` | In non-dry-run, transition to `paid` and grant entitlement using existing payment event logic |
| `created` | `unpaid` | No-op |
| `created` | `not_found` | Report only |
| `paid` | `paid` | No-op |
| `paid` | `unpaid` / `not_found` | Critical mismatch alert, report only |
| `failed` | `paid` | In non-dry-run, transition to `paid` and grant entitlement |
| `refund_pending` | `paid` | Report pending; refund status still needs refund service result |
| `refund_failed` | `paid` | Report, no automatic retry |

Reconciliation is not a scheduler in this slice. It is a service plus admin RPC so it can be run manually or wired to a cron job later.

### 9.2 Why no persisted reconciliation run table

Phase 1.5 only needs a small operational safety net. Persisting every reconciliation run adds schema and UI surface without changing the core behavior. The order row keeps `lastReconciledAt`, `lastConnectorStatus`, and `lastReconciliationMismatch`, which is enough for debugging and repeated manual runs.

---

## 10. Admin ConnectRPC

Add `StickerMarketAdminService` to `packages/proto/proto/stickerMarket/v1/stickerMarket.proto`:

```proto
service StickerMarketAdminService {
  rpc RefundOrder(RefundOrderRequest) returns (RefundOrderResponse);
  rpc ReconcileStickerOrders(ReconcileStickerOrdersRequest) returns (ReconcileStickerOrdersResponse);
}
```

Authorization:

- Reuse `withAuthService()` so every RPC has auth data.
- `stickerMarketAdmin.ts` checks `requireAuthData(ctx).role === "admin"`.
- Non-admin callers receive `PermissionDenied`.

No web UI is added. Admin users can call the RPC from scripts or dev tooling.

---

## 11. Error Handling

| Error | Handling |
|---|---|
| Refund requested for non-paid order | `FailedPrecondition` from admin RPC |
| Missing `connectorChargeId` | Mark nothing, emit critical alert, return `FailedPrecondition` |
| ECPay refund API failure | Order becomes `refund_failed`, alert emitted |
| Duplicate refund request while `refund_pending` | Return current `refund_pending`, no external call |
| Duplicate refund request after `refunded` | Return `refunded`, no external call |
| Reconciliation query failure | Record mismatch reason for that order, continue batch |
| Webhook CheckMacValue failure | Existing webhook route returns invalid ack; additionally emits `payment.webhook_verification_failed` alert |
| Amount mismatch on success webhook | Keep no-grant behavior; additionally emit `payment.amount_mismatch` alert |

---

## 12. Testing Strategy

### 12.1 `packages/pay`

Unit tests:

- `getCharge()` builds QueryTradeInfo params with fresh Unix seconds timestamp and CheckMacValue.
- `getCharge()` maps `TradeStatus=1` to `paid`.
- `getCharge()` maps ECPay order-not-found response to `not_found`.
- `refundCharge()` rejects non-TWD.
- `refundCharge()` rejects missing connector charge id.
- `refundCharge()` returns simulated success in stage test mode without network.
- `refundCharge()` maps prod DoAction failure response to `failed`.

Network tests use injected fetch in service deps. Unit tests do not hit ECPay.

### 12.2 `apps/server` unit tests

Add nearby `*.test.ts`:

- `refund.service.test.ts`: paid → refund_pending → refunded, entitlement revoked.
- `refund.service.test.ts`: duplicate refunded order is no-op.
- `refund.service.test.ts`: refund API failure sets `refund_failed` and emits alert.
- `event-handler.test.ts`: entitlement grant throw triggers compensation path.
- `reconciliation.service.test.ts`: created + ECPay paid applies existing paid/grant path.
- `stickerMarketAdmin.test.ts`: non-admin receives `PermissionDenied`.

### 12.3 `apps/server` DB integration tests

Add focused `*.int.test.ts` only for PostgreSQL behavior:

- Conditional refund transition updates one row only from `paid` / `refund_failed`.
- Entitlement revoke by `grantedByOrderId` deletes the expected row.
- `lastReconciledAt` and mismatch fields persist through repository methods.

Use `withRollbackDb()` and do not touch real ECPay.

### 12.4 Verification commands

Relevant checks for implementation:

```bash
bun run --cwd packages/pay test
bun run --cwd apps/server test:unit
ZERO_UPSTREAM_DB=postgresql://user:password@localhost:5533/postgres bun run --cwd apps/server test:integration
bun run check:all
```

---

## 13. Implementation Order

1. Extend `@vine/pay` types and add ECPay query/refund helpers behind injected fetch.
2. Extend `stickerOrder` schema and migrations.
3. Extend repositories for refund and reconciliation fields.
4. Add `PaymentAlertSink`.
5. Add `refund.service.ts`.
6. Update `event-handler.ts` to use compensation path for entitlement grant failures and alert amount/webhook failures.
7. Add `reconciliation.service.ts`.
8. Add admin proto, generated client/server code, handler, and route registration.
9. Run focused package/server tests, DB integration tests, then `bun run check:all`.

---

## 14. Open Decisions Resolved

- **Partial refund**:not supported in Phase 1.5. Full refund only.
- **Stage refund behavior**:simulated success only, because ECPay AIO DoAction stage cannot actually test refund.
- **Entitlement revoke timing**:after refund success, not when refund is requested.
- **Admin surface**:ConnectRPC only, no UI.
- **Sentry**:interface only. Real Sentry integration can be a later infra task.
