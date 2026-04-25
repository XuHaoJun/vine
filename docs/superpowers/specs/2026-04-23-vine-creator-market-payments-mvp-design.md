# Vine Creator Market — Payments MVP(Phase 1)Design

> **Slice 範圍**:端到端付款閉環的 vertical slice。用戶能從商店購買貼圖(ECPay 信用卡)→ entitlement grant → 在聊天室發送、對方能看到。創作者側、審核、Payout 等**完全不在本 slice**。
>
> **上層 roadmap**:[`docs/vine-creator-market-roadmap.md`](../../vine-creator-market-roadmap.md)
> **原始產品規格**:[`docs/vine-creator-market-spec.md`](../../vine-creator-market-spec.md)
> **UI wireframes**:[`docs/vine-creator-market-uiux.md`](../../vine-creator-market-uiux.md)
>
> **關鍵依賴**:
> - `@xuhaojun/hyperswitch-prism@0.0.8-xuhaojun.1`(fork,含 ECPay connector)
> - `@vine/drive` fs backend(既有 `./uploads` 設定複用)
> - Zero 已支援 `message.type='sticker'`,`metadata` 可放 JSON 字串

---

## 目錄

1. [Slice 目標與成功標準](#1-slice-目標與成功標準)
2. [套件 / 模組邊界](#2-套件--模組邊界)
3. [`packages/pay` 對外契約](#3-packagespay-對外契約)
4. [DB schema + 狀態機](#4-db-schema--狀態機)
5. [Checkout 端到端 flow](#5-checkout-端到端-flow)
6. [Webhook handler + 冪等](#6-webhook-handler--冪等)
7. [Entitlement + 聊天室整合](#7-entitlement--聊天室整合)
8. [測試策略](#8-測試策略)
9. [MVP 明確 out-of-scope](#9-mvp-明確-out-of-scope)
10. [Config / 環境變數](#10-config--環境變數)
11. [本 slice 完成後的下一步](#11-本-slice-完成後的下一步)

---

## 1. Slice 目標與成功標準

### 1.1 要驗證什麼

- Vine server 能透過 `@xuhaojun/hyperswitch-prism` 成功對 ECPay 發起授權、收 webhook、驗 CheckMacValue
- `packages/pay` 的統一 interface 能夠把 connector-specific 細節關在 package 內,上層程式碼無需知道 ECPay
- 「付錢 → 取得授權 → 真實使用」閉環 demo-able(不只 DB row 跑完,是真能發貼圖)

### 1.2 成功標準(demo-level,非 SLA)

按順序通過以下即為 slice 完成:

1. Dev 啟 Docker Compose + server + web,登入 test1,看到 store 頁有 3 個 seeded package
2. 點某個 package → 詳情頁顯示封面 + 售價 → 點「立即購買」
3. Bottom sheet 出現,勾「模擬付款成功」(dev 模式)→ 確認
4. 瀏覽器自動跳轉 ECPay staging hosted form → 模擬模式下自動回流
5. `/pay/result` 頁顯示「購買成功」與雙 CTA(「去聊天室用」/「繼續逛商店」)
6. 進 test1 ↔ test2 聊天室,開 sticker picker,看到剛買的 pack
7. 點擊貼圖 → 訊息發送 → test2 端即時看到該貼圖渲染出來
8. 登入 test2(未購買者)開同一聊天室 → 看得見 test1 發的貼圖(§10.3.4 公開顯示)
9. test2 試圖在 picker 裡開啟未購買 pack → UI 沒有顯示 unowned pack(entitlement filter)

### 1.3 非目標(本 slice 不驗證的)

- 真實信用卡交易(Tier B E2E 另做)
- 退款流程
- 多創作者、多個 connector
- 美術品質

---

## 2. 套件 / 模組邊界

```
packages/
  pay/                               ← 新增
    src/
      index.ts                       re-export types + createPaymentsService
      types.ts                       Money, CreateChargeInput, WebhookEvent 等
      service.ts                     createPaymentsService({ connector, ecpay }) → PaymentsService
      errors.ts                      Vine 自家錯誤分類
      prism/
        client.ts                    封裝 PaymentClient + EventClient(UniFFI in-process)
        ecpay-config.ts              credential → prism ConnectorConfig 轉換
      test-utils/
        ecpay-mac.ts                 test helper:產生帶 CheckMacValue 的 payload

apps/server/
  src/
    services/payments/
      index.ts                       factory:wiring pay + orderRepo + entitlementRepo
      order.repository.ts            Drizzle:create / findById / transitionToPaid / transitionToFailed
      entitlement.repository.ts      Drizzle:grant(ON CONFLICT DO NOTHING)
      webhook.route.ts               Fastify route 註冊 POST /webhooks/ecpay
      event-handler.ts               WebhookEvent → DB transition 的 orchestration
    connect/
      stickerMarketUser.ts           ← 新增 ConnectRPC handler:createCheckout, getOrder
      routes.ts                      ← 加上 stickerMarketUser 註冊

packages/db/src/
  schema-public.ts                   ← +stickerPackage、+entitlement
  schema-private.ts                  ← +stickerOrder
  seed/ensureSeed.ts                 ← +3 個 seed package + drive.put fixtures
  seed/sticker-fixtures/             ← 新增:24 張 placeholder PNG + 3 cover + 3 tab icon
    pkg_cat_01/{cover.png, tab.png, 1.png ~ 8.png}
    pkg_dog_01/...
    pkg_bun_01/...

packages/zero-schema/src/
  models/stickerPackage.ts           ← 新增(公開可讀)
  models/entitlement.ts              ← 新增(serverWhere 限自己)
  relationships.ts                   ← 加 entitlement → stickerPackage 關聯

packages/proto/proto/stickerMarket/v1/
  stickerMarket.proto                ← 新增 StickerMarketUserService + Package/Money/OrderStatus types

apps/web/src/features/sticker-market/   ← 新增
  StoreHome.tsx
  PackageDetail.tsx
  CheckoutSheet.tsx
  PaymentRedirectPage.tsx
  PaymentResultPage.tsx

apps/web/app/(app)/store/              ← 新增(用戶側 routes)
  index.tsx
  [packageId].tsx

apps/web/app/(app)/pay/                ← 新增
  redirect.tsx
  result.tsx

apps/web/src/features/chat/ui/          ← 擴充
  MessageInput.tsx                   ← 加 sticker picker 按鈕
  StickerPicker.tsx                  ← 新增(bottom sheet,列 owned packages)
  MessageBubble.tsx                  ← 加 sticker 分支

apps/web/app/(app)/creator/            ← 預留,本 slice 不實作
apps/web/app/(app)/admin/              ← 預留,本 slice 不實作
```

**邊界原則**:

- `packages/pay` 不知道 Vine DB schema 存在,只做「call prism、parse webhook」。可獨立單測
- `apps/server/services/payments` 做 orchestration(Vine domain 膠水),不直接接觸 prism
- `stickerPackage`、`entitlement` 走 Zero(client 即時 sync);`stickerOrder` 僅 ConnectRPC(敏感、不廣播)

---

## 3. `packages/pay` 對外契約

### 3.1 Types

```ts
// packages/pay/src/types.ts

export type Currency = 'TWD' | 'USD'   // MVP 只會用到 TWD;型別留著方便擴展

export type Money = {
  minorAmount: number   // 對齊 prism;TWD 小數 0 位,$75 = 75
  currency: Currency
}

// --- Charge 建立 ---

export type CreateChargeInput = {
  merchantTransactionId: string    // = ECPay MerchantTradeNo,≤ 20 chars,[0-9A-Za-z]
  amount: Money
  description: string              // ECPay ItemName
  returnUrl: string                // server-to-server webhook(ECPay ReturnURL)
  orderResultUrl: string           // browser redirect(ECPay OrderResultURL)
  clientBackUrl?: string           // 取消 / 失敗返回
  idempotencyKey: string           // 上層傳(通常 = merchantTransactionId)
  testMode?: {
    simulatePaid?: boolean         // → ECPay SimulatePaid=1;僅 stage 模式允許
  }
}

export type ChargeAction =
  | { type: 'redirect_form_post'; targetUrl: string; formFields: Record<string, string> }
  | { type: 'redirect_url'; url: string }   // 預留給非 form POST 的 connector

export type CreateChargeResult = {
  status: 'pending_action'
  action: ChargeAction
  connectorName: 'ecpay'
}

// --- Webhook ---

export type WebhookEvent =
  | { kind: 'charge.succeeded'; merchantTransactionId: string; connectorChargeId: string; amount: Money; paidAt: Date }
  | { kind: 'charge.failed';    merchantTransactionId: string; reason: string }
  | { kind: 'unknown';           raw: unknown }

export type HandleWebhookInput = {
  rawBody: Buffer           // 原始 bytes,才能驗 CheckMacValue
  headers: Record<string, string | string[] | undefined>
  contentType: string
}

export type HandleWebhookResult =
  | {
      verified: true
      event: WebhookEvent
      ackReply: { status: number; body: string }    // e.g. { 200, "1|OK" }
    }
  | { verified: false; reason: string; ackReply: { status: number; body: string } }
```

### 3.2 Service

```ts
// packages/pay/src/service.ts

export type PaymentsService = {
  createCharge(input: CreateChargeInput): Promise<CreateChargeResult>
  handleWebhook(input: HandleWebhookInput): Promise<HandleWebhookResult>
  // FUTURE(refund): refund(chargeId, amount): Promise<RefundResult>
  //   — 當用戶退款或 entitlement grant 失敗需要補償時啟用
  // FUTURE(sync): getCharge(merchantTransactionId): Promise<ChargeStatus>
  //   — 對帳 / reconciliation 用
}

export type PaymentsServiceDeps = {
  connector: 'ecpay'
  ecpay: {
    merchantId: string
    hashKey: string
    hashIv: string
    mode: 'stage' | 'prod'
  }
  libPath?: string                                    // 覆寫 prism UniFFI .so 位置
}

export function createPaymentsService(deps: PaymentsServiceDeps): PaymentsService
```

### 3.3 關鍵設計決策

| 決策 | 選擇 | 原因 |
|---|---|---|
| `connectorChargeId` 的時機 | `merchantTransactionId` = ECPay `MerchantTradeNo` 就是主鍵;`TradeNo` 在 webhook 後寫入 order `connectorChargeId` | 避免兩階段 id 對映的 race |
| 冪等責任 | `idempotencyKey` 上層傳,pay 不 dedupe;dedupe 靠 DB `unique(merchantTransactionId)` | pay 保持 stateless,與 prism 一致 |
| verify 失敗是否拋 | 不拋,回 `verified: false` + 建議 ack | webhook handler 必須回 ECPay,避免 500 被 retry |
| `refund` / `getCharge` | **MVP 不放**,**在 service.ts 明顯註解 `FUTURE(refund)`** | YAGNI |
| `amount.currency` 驗證 | pay 內部擋「ecpay + non-TWD」→ throw config error | fail fast |

### 3.4 prism 呼叫細節

`createCharge` 對應 `PaymentClient.authorize`:

```ts
const req: types.IPaymentServiceAuthorizeRequest = {
  merchantTransactionId: input.merchantTransactionId,
  amount: { minorAmount: input.amount.minorAmount, currency: types.Currency.TWD },
  captureMethod: types.CaptureMethod.AUTOMATIC,
  paymentMethod: { cardRedirect: { type: types.CardRedirect.CardRedirectType.CARD_REDIRECT } },
  authType: types.AuthenticationType.THREE_DS,
  orderDetails: [{ productName: input.description, ... }],
  returnUrl: input.returnUrl,
  // ECPay 特有欄位:透過 prism ConnectorConfig 的 extra / metadata 傳遞(待確認 prism 實際欄位)
}
const res = await paymentClient.authorize(req)
// res.redirectionData.form → 轉成 CreateChargeResult.action
```

`handleWebhook` 對應 `EventClient.handleEvent`:

```ts
const req: types.IEventServiceHandleRequest = {
  merchantEventId: generateUlid(),
  requestDetails: {
    method: types.HttpMethod.POST,
    uri: '',                      // ECPay 不需要
    headers: input.headers,
    body: input.rawBody,
    queryParams: '',
  },
  webhookSecrets: { secret: deps.ecpay.hashKey, additionalSecret: deps.ecpay.hashIv },
}
const res = await eventClient.handleEvent(req)
// res.sourceVerified + res.eventType + res.eventContent + res.eventAckResponse
```

---

## 4. DB schema + 狀態機

### 4.1 新增 tables

```ts
// packages/db/src/schema-public.ts — 新增(Zero 會同步)

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
    // MVP:個別貼圖檔路徑 = stickers/{packageId}/{n}.png(n = 1..stickerCount)
    // 未來(Phase 2):拆 stickerAsset 表存 keywords、stickerResourceType 等 LINE 相容欄位
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

```ts
// packages/db/src/schema-private.ts — 新增(Zero 不同步,僅 ConnectRPC)

export const stickerOrder = pgTable(
  'stickerOrder',
  {
    id: text('id').primaryKey(),                      // = ECPay MerchantTradeNo,≤ 20,[0-9A-Za-z]
    userId: text('userId').notNull(),
    packageId: text('packageId').notNull(),
    amountMinor: integer('amountMinor').notNull(),
    currency: text('currency').notNull().$type<'TWD'>(),
    status: text('status').notNull().$type<'created' | 'paid' | 'failed'>().default('created'),
    connectorName: text('connectorName').notNull().$type<'ecpay'>(),
    connectorChargeId: text('connectorChargeId'),     // ECPay TradeNo,webhook 時填
    paidAt: timestamp('paidAt', { mode: 'string' }),
    failureReason: text('failureReason'),
    // FUTURE(refund):新增 refundedAt / refundedAmountMinor,本 slice 不做
    createdAt: timestamp('createdAt', { mode: 'string' }).defaultNow().notNull(),
    updatedAt: timestamp('updatedAt', { mode: 'string' }).defaultNow().notNull(),
  },
  (table) => [
    index('stickerOrder_userId_idx').on(table.userId),
    index('stickerOrder_status_idx').on(table.status),
  ],
)
```

### 4.2 狀態機

```
                   POST /createCheckout
                          │
                          ▼
                    ┌──────────┐
                    │ created  │◀──── 同一 idempotencyKey 進來 → 讀舊的回
                    └────┬─────┘
                         │ webhook verified
                 ┌───────┴───────┐
                 │               │
                 ▼               ▼
             ┌────────┐     ┌────────┐
             │  paid  │     │ failed │
             └────────┘     └────┬───┘
             (terminal)          │ 極少數情境:ECPay retry 第二次成功
                                 │
                                 ▼
                            ┌────────┐
                            │  paid  │
                            └────────┘
```

| 當前狀態 | 收到事件 | 行為 |
|---|---|---|
| `created` | `charge.succeeded` | → `paid`,寫 `connectorChargeId`、`paidAt`,grant entitlement |
| `created` | `charge.failed` | → `failed`,寫 `failureReason` |
| `paid` | `charge.succeeded`(同 `connectorChargeId`) | no-op,回 ack |
| `paid` | `charge.succeeded`(不同 `connectorChargeId`) | log error + 拒絕(資料異常) |
| `paid` | `charge.failed` | log error + 拒絕(不可降級) |
| `failed` | `charge.succeeded` | **接受**,→ `paid`,grant entitlement。log warn(ECPay retry 情境) |
| `failed` | `charge.failed` | no-op |

### 4.3 Grant 冪等的兩層防線

```ts
// 單一 transaction:
// 1. UPDATE stickerOrder SET status='paid' ... WHERE id=? AND status IN ('created', 'failed')
//    → affected = 0 代表已 paid,直接 return,不再 grant
// 2. INSERT INTO entitlement ... ON CONFLICT (userId, packageId) DO NOTHING
//    → 萬一 order 被其他路徑重建 / race 也不會產生雙筆 entitlement
```

### 4.4 Zero 暴露

| 表 | Zero? | 可見性 |
|---|---|---|
| `stickerPackage` | ✅ | 全用戶可讀 |
| `entitlement` | ✅ | `serverWhere: q => q.where('userId', authData.userID)` |
| `stickerOrder` | ❌ | 僅 ConnectRPC `getOrder(orderId)`,server 端檢查 `order.userId == authData.userID` |

---

## 5. Checkout 端到端 flow

### 5.1 ConnectRPC 介面

```proto
// packages/proto/proto/stickerMarket/v1/stickerMarket.proto

syntax = "proto3";
package stickerMarket.v1;

// --- MVP slice ---
service StickerMarketUserService {
  rpc CreateCheckout(CreateCheckoutRequest) returns (CreateCheckoutResponse);
  rpc GetOrder(GetOrderRequest) returns (GetOrderResponse);
}

// --- FUTURE 預留 ---
// service StickerMarketCreatorService { UploadPackage, ListSales, RequestPayout, ... }
// service StickerMarketAdminService { ReviewPackage, ListPendingReviews, ... }

// --- 共用型別(三 service 共用)---
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

// --- Requests / Responses ---
message CreateCheckoutRequest { string package_id = 1; bool simulate_paid = 2; }

message CreateCheckoutResponse {
  string order_id = 1;
  RedirectFormPost redirect = 2;
}

message RedirectFormPost {
  string target_url = 1;
  map<string, string> form_fields = 2;
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

- 兩個 RPC 都透過 `withAuthService` 包住
- `GetOrder` 在 handler 內加 `order.userId == authData.userID` 檢查
- `simulate_paid = true` 僅在 `PAYMENTS_ECPAY_MODE=stage` 才傳遞下去

### 5.2 端到端序列(文字版)

```
USER          WEB                   SERVER                pay (prism FFI)        ECPay
 │             │                      │                        │                   │
 │ 立即購買    │                      │                        │                   │
 │────────▶│ connect.createCheckout({packageId, simulate_paid}) │                   │
 │             │────────────────────▶│                        │                   │
 │             │                      │ 1. require auth        │                   │
 │             │                      │ 2. find package        │                   │
 │             │                      │ 3. check entitlement   │                   │
 │             │                      │    (已擁有 → error)     │                   │
 │             │                      │ 4. INSERT stickerOrder │                   │
 │             │                      │    status='created'    │                   │
 │             │                      │ 5. pay.createCharge()  │                   │
 │             │                      │────────────────────▶│                   │
 │             │                      │                        │ PaymentClient     │
 │             │                      │                        │   .authorize()    │
 │             │                      │                        │─────────────────▶│
 │             │                      │                        │◀─────────────────│
 │             │                      │◀────────────────────│ { action:          │
 │             │                      │  { orderId, action }    redirect_form_post │
 │             │◀────────────────────│                        │   targetUrl,       │
 │             │                      │                        │   formFields }     │
 │             │ navigate /pay/redirect(帶 action state)       │                   │
 │             │                      │                        │                   │
 │             │ hidden form auto-submit                        │                   │
 │─────────────────────────────────────────────────────────────────────────────▶│
 │◀── ECPay hosted page(stage mode + SimulatePaid=1 即時回流)──────────────────│
 │                                                                                │
 │ 同時發生(順序不保證):                                                          │
 │ (a) ECPay → ReturnURL webhook → server:                                        │
 │     pay.handleWebhook → verify CheckMacValue                                   │
 │     TX: transitionToPaid(order) + entitlement.grant (ON CONFLICT DO NOTHING)   │
 │     reply "1|OK"                                                               │
 │ (b) ECPay → OrderResultURL = /pay/result?orderId=X(browser)                   │
 │                                                                                │
 │ /pay/result 頁面:connect.getOrder(orderId),polling 1s × 10:                  │
 │   - 'paid' → 成功頁 + 雙 CTA                                                  │
 │   - 'created'(webhook 未到)→ 顯示「處理中」+ 手動重試                         │
 │   - 'failed' → 失敗頁 + 重試                                                  │
```

### 5.3 前端頁面

| 檔案 | 職責 |
|---|---|
| `features/sticker-market/StoreHome.tsx` | `useZeroQuery(stickerPackage)` + entitlement join → 列卡片,顯示「已擁有」badge |
| `features/sticker-market/PackageDetail.tsx` | 封面 + 預覽縮圖(`drive.getUrl`)+ Sticky Bottom Bar CTA |
| `features/sticker-market/CheckoutSheet.tsx` | Bottom sheet:價格摘要、支付方式(MVP 只一種)、dev 時顯示「模擬付款」checkbox |
| `features/sticker-market/PaymentRedirectPage.tsx` | 接 route state 的 `action`,渲隱藏 form + `useEffect(() => formRef.submit())` |
| `features/sticker-market/PaymentResultPage.tsx` | `useTanQuery({ queryKey: ['order', id], refetchInterval: data?.status === 'created' ? 1000 : false })` |

### 5.4 錯誤處理矩陣

| 情境 | 處理 |
|---|---|
| createCheckout: package 不存在 | `NotFound` |
| createCheckout: 已 entitled | `AlreadyExists` → UI:「已擁有,去聊天室用」+ 直跳聊天室 |
| createCheckout: prism IntegrationError | log + `Internal` → UI:「付款初始化失敗,請稍後再試」 |
| webhook: CheckMacValue 失敗 | HTTP 400 + 錯誤 body(不是 "1\|OK"),log warn |
| webhook: 找不到 order | 回 200 `1\|OK`,log warn |
| webhook: 金額不符 | 不寫 status、不 grant、log error(`AMOUNT MISMATCH`)、仍回 `1\|OK` |
| webhook: paid 狀態收到 charge.failed | log error + 拒絕,仍回 `1\|OK` |
| getOrder: 別人的 orderId | `PermissionDenied` |

### 5.5 Dev 輔助:SimulatePaid=1

- `packages/pay` 在 `createCharge` 內:`testMode?.simulatePaid && mode === 'stage'` → 塞 `SimulatePaid=1` 到 form fields;`prod` 模式則 throw
- Web 端:`VITE_DEV_ENABLE_SIMULATE_PAID=1` 時,CheckoutSheet 多一個「模擬付款成功」checkbox

---

## 6. Webhook handler + 冪等

### 6.1 Route 註冊(raw body 關鍵)

```ts
// apps/server/src/services/payments/webhook.route.ts

export async function registerPaymentsWebhookRoutes(
  fastify: FastifyInstance,
  deps: { pay: PaymentsService; orderRepo: StickerOrderRepository; entitlementRepo: EntitlementRepository; db: DB },
) {
  // 關鍵:保留 raw Buffer,讓 prism 能原樣驗 CheckMacValue
  fastify.addContentTypeParser(
    'application/x-www-form-urlencoded',
    { parseAs: 'buffer' },
    (_req, body, done) => done(null, body),
  )

  fastify.post('/webhooks/ecpay', async (request, reply) => {
    const result = await deps.pay.handleWebhook({
      rawBody: request.body as Buffer,
      headers: request.headers,
      contentType: request.headers['content-type'] ?? '',
    })

    if (!result.verified) {
      request.log.warn({ reason: result.reason }, 'ecpay webhook verification failed')
      return reply.code(result.ackReply.status).type('text/plain').send(result.ackReply.body)
    }

    try {
      await handlePaymentEvent(deps, result.event, request.log)
    } catch (err) {
      request.log.error({ err, event: result.event }, 'ecpay webhook handler failed')
      // 故意:仍回 1|OK 避免 ECPay 無限 retry。內部靠 log 監控
    }

    return reply.code(result.ackReply.status).type('text/plain').send(result.ackReply.body)
  })
}
```

### 6.2 Event → DB 轉換

```ts
// apps/server/src/services/payments/event-handler.ts

async function handlePaymentEvent(deps, event: WebhookEvent, log) {
  if (event.kind === 'unknown') {
    log.warn({ raw: event.raw }, 'unknown ecpay event')
    return
  }

  await deps.db.transaction(async (tx) => {
    const order = await deps.orderRepo.findById(tx, event.merchantTransactionId)
    if (!order) { log.warn({ id: event.merchantTransactionId }, 'webhook for unknown order'); return }

    if (event.kind === 'charge.succeeded') return applyChargeSucceeded(tx, deps, order, event, log)
    if (event.kind === 'charge.failed')    return applyChargeFailed(tx, deps, order, event, log)
  })
}

async function applyChargeSucceeded(tx, deps, order, event, log) {
  // 對帳安全線
  if (order.amountMinor !== event.amount.minorAmount || order.currency !== event.amount.currency) {
    log.error({ orderId: order.id, expected: order.amountMinor, got: event.amount }, 'AMOUNT MISMATCH')
    // 不 transition、不 grant,等人工介入
    // FUTURE(alerting):接 Sentry / 告警
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
    log.warn({ orderId: order.id }, 'order failed → paid (ECPay retry scenario)')
  }

  await deps.entitlementRepo.grant(tx, {
    userId: order.userId,
    packageId: order.packageId,
    grantedByOrderId: order.id,
  })
}

async function applyChargeFailed(tx, deps, order, event, log) {
  if (order.status === 'paid') {
    log.error({ orderId: order.id }, 'CRITICAL: charge.failed after paid — ignoring')
    return
  }
  await deps.orderRepo.transitionToFailed(tx, order.id, { failureReason: event.reason })
}
```

### 6.3 Repository

```ts
// order.repository.ts
transitionToPaid(tx, id, { connectorChargeId, paidAt }): Promise<number> {
  return tx.update(stickerOrder)
    .set({ status: 'paid', connectorChargeId, paidAt, updatedAt: sql`now()` })
    .where(and(eq(stickerOrder.id, id), inArray(stickerOrder.status, ['created', 'failed'])))
    .then(r => r.rowCount ?? 0)
}

transitionToFailed(tx, id, { failureReason }): Promise<number> {
  return tx.update(stickerOrder)
    .set({ status: 'failed', failureReason, updatedAt: sql`now()` })
    .where(and(eq(stickerOrder.id, id), eq(stickerOrder.status, 'created')))
    .then(r => r.rowCount ?? 0)
}

// entitlement.repository.ts
async grant(tx, { userId, packageId, grantedByOrderId }): Promise<void> {
  await tx.insert(entitlement)
    .values({ id: ulid(), userId, packageId, grantedByOrderId })
    .onConflictDoNothing({ target: [entitlement.userId, entitlement.packageId] })
}
```

### 6.4 冪等四層防線

| 層 | 機制 | 防什麼 |
|---|---|---|
| 1 | prism `handleEvent` 驗 CheckMacValue | 外部攻擊、錯誤設定 |
| 2 | `order.amountMinor === event.amount.minorAmount` | 金額竄改 |
| 3 | `transitionToPaid` 的 `WHERE status IN ('created', 'failed')` | ECPay retry |
| 4 | `entitlement` 的 `unique(userId, packageId)` | race 條件 |

---

## 7. Entitlement + 聊天室整合

### 7.1 Entitlement Zero 暴露

```ts
// packages/zero-schema/src/models/entitlement.ts
export const entitlementQuery = createQuery('entitlement', {
  serverWhere: (q, { authData }) => q.where('userId', authData.userID),
})
```

### 7.2 聊天室範圍(**C:完整閉環**)

1. **`StickerPicker.tsx`**(新增):MessageInput 旁加 🏷 按鈕,點開 bottom sheet
   - `useZeroQuery` 取自己的 `entitlement` join `stickerPackage`
   - Tab = 每個 owned package(tabIcon 縮圖)
   - Grid:`drive.getUrl('stickers/{packageId}/{n}.png')`,n = 1..stickerCount
   - 點擊 → `zero.mutate.message.insertSticker({ chatId, packageId, stickerId: String(n) })`

2. **Server 端 entitlement 驗證**(Zero custom mutator):
   ```ts
   // packages/zero-schema/src/server/mutators/message.ts
   async insertSticker(tx, { chatId, packageId, stickerId }, authData) {
     const owned = await tx.query.entitlement
       .where('userId', authData.userID).where('packageId', packageId).one()
     if (!owned) throw new Error('entitlement required')
     return tx.insert('message', {
       id: ulid(),
       chatId,
       senderId: authData.userID,
       senderType: 'user',
       type: 'sticker',
       metadata: JSON.stringify({ packageId, stickerId }),
       createdAt: new Date().toISOString(),
     })
   }
   ```
   後備方案:若 Zero custom mutator 在 `vine-dev-stack` 的實際配置下不順,改用 ConnectRPC `sendStickerMessage`。

3. **`MessageBubble.tsx`**(擴充):`type === 'sticker'` 分支
   ```tsx
   const { packageId, stickerId } = JSON.parse(message.metadata ?? '{}')
   const url = `/uploads/stickers/${packageId}/${stickerId}.png`
   return <Image source={{ uri: url }} style={{ width: 150, height: 150 }} />
   ```
   接收方**不查 entitlement**(§10.3.4:顯示是免費行為,drive 公開讀取)。

### 7.3 Drive 資產 key 規則(沿用既有 `./uploads` drive)

```
stickers/{packageId}/cover.png        ← stickerPackage.coverDriveKey
stickers/{packageId}/tab.png          ← stickerPackage.tabIconDriveKey
stickers/{packageId}/{n}.png          ← n = 1..stickerCount
```

Fastify 靜態服務已在 `apps/server/src/index.ts` 設好 `/uploads/*` prefix,不需新增 route。

### 7.4 Seed 擴充

```ts
// packages/db/src/seed/ensureSeed.ts(在 OA seed 之後加)

const STICKER_PACKAGE_SEEDS = [
  { id: 'pkg_cat_01',  name: '貓咪日常',     priceMinor: 75,  stickerCount: 8 },
  { id: 'pkg_dog_01',  name: '狗狗合集',     priceMinor: 45,  stickerCount: 8 },
  { id: 'pkg_bun_01',  name: '兔兔聖誕限定', priceMinor: 129, stickerCount: 8 },
] as const

async function seedStickerPackages(db, drive?: SeedDrive) {
  for (const pkg of STICKER_PACKAGE_SEEDS) {
    const existing = await db.select().from(stickerPackage)
      .where(eq(stickerPackage.id, pkg.id)).limit(1)
    if (existing.length > 0) continue

    await db.insert(stickerPackage).values({
      id: pkg.id, name: pkg.name, description: '',
      priceMinor: pkg.priceMinor, currency: 'TWD',
      coverDriveKey: `stickers/${pkg.id}/cover.png`,
      tabIconDriveKey: `stickers/${pkg.id}/tab.png`,
      stickerCount: pkg.stickerCount,
      createdAt: now, updatedAt: now,
    })

    if (drive) {
      // 從 packages/db/src/seed/sticker-fixtures/{pkg.id}/{cover,tab,1..8}.png 讀 Buffer
      // drive.put(`stickers/${pkg.id}/cover.png`, buffer, 'image/png')
      // ... 同樣處理 tab.png + 1.png ~ 8.png
    }
  }
}

// 在 ensureSeed() 主流程的對應位置呼叫 seedStickerPackages(db, drive)
```

Fixture PNGs 放 `packages/db/src/seed/sticker-fixtures/{pkg_id}/*.png`(checked in)。建議 200×200 純色背景 + 大字編號,3 個 package × (cover + tab + 8 stickers) = 30 個檔案,總大小 < 100KB。

---

## 8. 測試策略

### 8.1 Tier A — PR CI

#### (a) `packages/pay` unit test(pure,無 DB)

```
describe('createCharge')
  - rejects non-TWD for ecpay
  - rejects merchantTransactionId > 20 chars
  - rejects SimulatePaid in prod mode
  - composes PaymentClient request correctly

describe('handleWebhook')
  - verified=true + charge.succeeded for valid paid webhook
  - verified=true + charge.failed for RtnCode != 1
  - verified=false when CheckMacValue mismatch
  - returns ackReply.body='1|OK' on success
```

限制:`libconnector_service_ffi.so` 只有 Linux → Mac 本機跑不起來,容忍。CI 是 `ubuntu-latest`,OK。

#### (b) `apps/server` webhook integration(`fastify.inject`,含真 Postgres)

```
describe('POST /webhooks/ecpay')
  - created → paid, grants entitlement, returns 1|OK
  - idempotent: second identical webhook → no duplicate entitlement
  - amount mismatch: no transition, no grant, still returns 1|OK
  - bad CheckMacValue → 400, order untouched
  - unknown order id → 200 1|OK (ack) but no side effects
  - paid → charge.failed webhook → ignored, order still paid
  - failed → paid allowed (rare ECPay retry scenario)
```

依 `vine-testing`:DB integration 用真 Postgres(Docker Compose 提供),不 mock。

#### (c) `apps/server` ConnectRPC

```
describe('stickerMarketUser.createCheckout')
  - creates order, returns redirect form(prism mocked)
  - rejects if already entitled
  - rejects unknown package
  - rejects without auth

describe('stickerMarketUser.getOrder')
  - returns own order
  - rejects other user's order(PermissionDenied)
```

`@xuhaojun/hyperswitch-prism` 在本組 test 中 mock 掉 — 只驗「我們有用正確 arg 呼 PaymentClient.authorize」,真實 HTTP 留給 Tier B。

### 8.2 Tier B — 真實 ECPay staging(gated,非 PR CI)

```
describe.skipIf(!process.env.RUN_ECPAY_E2E)('ECPay staging E2E')
  - SimulatePaid=1 round trip with real ngrok tunnel
    1. 啟動 server 綁 tunnel
    2. createCheckout → action
    3. 用 undici 對 action.targetUrl POST
    4. 等 30s,poll 直到 order.status === 'paid'
    5. assert entitlement 存在
```

放獨立 workflow `.github/workflows/ecpay-e2e.yml`,**手動 dispatch**,不 PR 觸發。

### 8.3 測試覆蓋矩陣

| 場景 | (a) pay unit | (b) server integ | (c) connect | (B) E2E |
|---|:---:|:---:|:---:|:---:|
| createCharge 組 request | ✅ | | | |
| 幣別 / id 驗證 | ✅ | | | |
| 真實 ECPay HTTP | | | | ✅ |
| webhook MAC 驗證 | ✅ | ✅ | | ✅ |
| 金額不符守護 | | ✅ | | |
| 冪等(重複 webhook) | | ✅ | | |
| `failed → paid` transition | | ✅ | | |
| entitlement grant ON CONFLICT | | ✅ | | |
| createCheckout 權限檢查 | | | ✅ | |
| 端到端買 + 聊天發送 | | | | ✅ + 手動 demo |

### 8.4 測試用 helper

```ts
// packages/pay/src/test-utils/ecpay-mac.ts(僅測試用,不公開 export)

export function makeSignedFormBody(
  params: Record<string, string>,
  hashKey: string,
  hashIv: string,
): Buffer {
  // 1. 依 ECPay spec 把 params 排序
  // 2. 串接 HashKey=...&Key1=Val1&...&HashIV=...
  // 3. ECPay 客製 URL encode
  // 4. SHA256 → 大寫 → CheckMacValue
  // 5. 塞回 params,組成 application/x-www-form-urlencoded
}
```

官方測試向量在 `docs/ECPay-API-Skill/guides/13-checkmacvalue.md`,拿來做 helper 的 golden test。

---

## 9. MVP 明確 out-of-scope

| 項目 | MVP 不做的理由 | 何時做 |
|---|---|---|
| 創作者側 UI(Dashboard / 上傳 / 報表 / C1–C9) | 聚焦付款 pipeline,假資料即可驗證 | Phase 2 |
| Creator KYC(Tier 1 / Tier 2) | 沒有真創作者 | Phase 2 / 2.5 |
| 審核流程 + 拒絕通知 | 同上 | Phase 2 |
| Payout(Hyperswitch Payout API) | 沒有真 creator 要收款 | Phase 2.5 |
| 稅務處理 | 同上 | Phase 2.5 |
| **退款 / Refund** | YAGNI;關鍵 code 已標 `FUTURE(refund)` 註解 | Phase 1.5 |
| 對帳 / reconciliation job | 同上 | Phase 1.5 |
| 多幣別(USD ↔ TWD 換算) | ECPay TWD only | Phase 3 |
| 其他 ECPay 付款方式(ATM / CVS / Apple Pay) | 只驗一條 pipeline | Phase 1.5 |
| 其他 connector(Stripe / Adyen) | 同上 | Phase 3+ |
| 智能路由(Hyperswitch main API) | prism 已夠 | 無時程 |
| 用戶評價、追蹤、熱銷榜、推薦 | 規格內但 MVP 不需要 | Phase 3 |
| 我的貼圖庫頁(U7) | entitlement + picker 已夠 | Phase 2 |
| DMCA / 申訴 / 治理 | 沒真創作內容 | Phase 4 |
| Sentry / alerting | 只 log | Phase 1.5 |
| Full LINE-compatible sticker metadata(`keywords` / `stickerResourceType` / 有聲) | 存 `{packageId, stickerId}` 即可渲 | Phase 2 |

---

## 10. Config / 環境變數

### 10.1 Server `.env`(`apps/server/.env`)

```env
# --- ECPay credentials(packages/pay 讀取)---
PAYMENTS_ECPAY_MODE=stage                          # 'stage' | 'prod'
PAYMENTS_ECPAY_MERCHANT_ID=3002607                 # stage 測試商店
PAYMENTS_ECPAY_HASH_KEY=pwFHCqoQZGmho4w6
PAYMENTS_ECPAY_HASH_IV=EkRm7iFT261dpevs

# --- Payment callback URLs(server 暴露給 ECPay)---
PAYMENTS_RETURN_URL=http://localhost:3001/webhooks/ecpay
PAYMENTS_ORDER_RESULT_URL=http://localhost:3000/pay/result
PAYMENTS_CLIENT_BACK_URL=http://localhost:3000/store

# --- Prism FFI(一般不需設)---
# HYPERSWITCH_PRISM_LIB_PATH=/custom/path/libconnector_service_ffi.so

# --- Tier B E2E(手動才用)---
# RUN_ECPAY_E2E=1
# ECPAY_E2E_TUNNEL_URL=https://xxx.ngrok.io
```

Prod 切換時改為真實 merchantId / hashKey / hashIv,`MODE=prod`,URL 換成外網。

### 10.2 Web `.env`(`apps/web/.env`,需 `VITE_` 前綴)

```env
VITE_DEV_ENABLE_SIMULATE_PAID=1    # 僅 dev:CheckoutSheet 顯示「模擬付款成功」
```

### 10.3 env 驗證

所有新 env 加入 `apps/server/package.json` 的 env validation(現有慣例),型別 + required。

---

## 11. 本 slice 完成後的下一步

**預設 = Phase 1.5 Refund**(詳見 [roadmap §2](../../vine-creator-market-roadmap.md#phase-15--付款強化小包可併於-phase-1-後))。

理由:

1. Phase 1 上線後,第一類真實問題幾乎一定是「付了沒授權」或「用戶想退款」 — 這是 payment edge case,不是產品問題
2. Refund 的 code 路徑與 authorize 對稱,此設計還熱、實作最便宜
3. Refund 完成後,`packages/pay` 就接近 prod-ready,再上 Phase 2(創作者 MVP)才不會踩共同 bug

**替代路線**:若 Phase 1 上線後沒有明顯 payment pain,可跳 1.5 直接進 Phase 2(創作者 MVP),讓產品 team 先證實創作者願意上架;到 Phase 2.5 Payout 時才會強制要求 refund 等能力 — 屆時 1.5 的項目可以併進 2.5。

**本 slice 完成的定義(done-done)**:

- [ ] 所有 §1.2 成功標準的步驟手動走過一遍 OK
- [ ] Tier A 三組測試全部綠燈
- [ ] Tier B E2E(手動)至少跑通一次 SimulatePaid=1 round trip
- [ ] `docs/vine-creator-market-roadmap.md` 的 Phase 1 節點加註「✅ Completed YYYY-MM-DD」
- [ ] 本 spec 檔案 commit,PR 合併

---

## 12. 假設 / 未決事項(非 blocking,實作時再驗)

| 假設 | 若錯了的影響 |
|---|---|
| prism 的 `PaymentClient.authorize` 對 ECPay connector 會回 `redirectionData.form`(target URL + fields) | 若實際回 `html` 或 `uri`,`ChargeAction` 型別需要多一個 variant,前端渲染分支需加 |
| prism 的 `EventClient.handleEvent` 傳 `webhookSecrets.secret = hashKey, additionalSecret = hashIv` 能正確驗 ECPay CheckMacValue | 若欄位對映錯,要改 `packages/pay/src/prism/ecpay-config.ts`,或直接把 MAC 驗證搬回 Vine 側 |
| prism 的 ECPay connector 支援 `SimulatePaid=1` passthrough | 若不支援,在 `packages/pay` 自己把 `SimulatePaid=1` 塞進 `redirectionData.form.formFields` 內 |
| Zero custom mutator 能在 `vine-dev-stack` 下運作並支援 transactional entitlement 檢查 | 若不行,改走 ConnectRPC `sendStickerMessage`,message 仍以 type='sticker' 存入 Zero |
| `libconnector_service_ffi.so` 能在 `node:24-slim` image 下正常載入 | 若 glibc 版本衝突,改用 debian full image(`node:24`)而非 slim |

---

*文件版本 v1.0 · 2026-04-23 · 腦力激盪設計階段產物,進入 writing-plans 後若有變更請回頭更新此 spec*
