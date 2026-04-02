# LINE Clone 技術評估報告 v2

## 概述

基於 LINE Developers 官方文件深度研讀，評估使用 Vine 現有技術棧實作 LINE 核心功能的可行性與技術方案。

**現有技術棧：**
- 前端：OneJS (vxrn) + Tamagui + Zero + Jotai + React Hook Form
- 後端：Fastify + ConnectRPC + Drizzle ORM + Better Auth
- 資料庫：PostgreSQL（私有 schema）+ Zero sync（公開 schema）

---

## 目標功能

| 功能 | 對應 LINE 產品 |
|------|---------------|
| LINE Login | OAuth 2.0 + OpenID Connect 社交登入 |
| 1:1 聊天 | 即時雙向訊息、已讀、多媒體 |
| 群組聊天 | 多人即時訊息、成員管理 |
| OA 官方帳號 | Bot 自動回覆、Rich Menu、Flex Message |
| Messaging API | REST + Webhook 訊息收發 API |
| LIFF | LINE 內嵌 Web App 框架 |

---

## 1. LINE Login

### 可行性：高

LINE Login 是標準 OAuth 2.0 + OpenID Connect 流程，與 Better Auth 架構高度相容。

### LINE 官方規格

**OAuth 2.0 Authorization Code Flow：**

1. 導向授權 URL：`https://access.line.me/oauth2/v2.1/authorize`
   - 必要參數：`response_type=code`, `client_id`, `redirect_uri`, `state`, `scope`
   - 可選：`nonce`（防重放攻擊）、`prompt`（`consent`/`login`/`none`）、`max_age`
2. 用戶授權後回傳 `authorization_code`（有效期 10 分鐘，僅限使用一次）
3. 後端換取 token：`POST https://api.line.me/oauth2/v2.1/token`
4. 取得 access token（30 天）、refresh token（90 天）、ID token（JWT）

**API 端點：**

| 端點 | 用途 |
|------|------|
| `GET https://api.line.me/v2/profile` | 取得用戶資料（需 `profile` scope） |
| `POST https://api.line.me/oauth2/v2.1/verify` | 驗證 access token |
| `POST https://api.line.me/oauth2/v2.1/revoke` | 撤銷 token |
| `GET/POST https://api.line.me/oauth2/v2.1/userinfo` | OpenID Connect UserInfo |
| `GET https://api.line.me/oauth2/v2.1/certs` | JWK 公鑰（ES256 驗證用） |

**Scopes：**
- `profile` — 暱稱、頭像、狀態訊息
- `openid` — ID token（JWT，含 `sub` = userId）
- `email` — 電子郵件（需另外申請權限）

**PKCE（Proof Key for Code Exchange）：**
- `code_verifier`：43-128 字元隨機字串
- `code_challenge`：SHA256 hash 後 Base64URL 編碼
- 僅支援 `S256` method
- 授權請求帶 `code_challenge` + `code_challenge_method=S256`
- Token 請求帶 `code_verifier`

**ID Token（JWT）結構：**
- Header：`alg` = `HS256`（web）或 `ES256`（native/SDK）
- Payload：`iss`=`https://access.line.me`, `sub`=userId, `aud`=channelId, `exp`, `iat`
- 可選 claims：`name`, `picture`, `email`, `amr`（認證方式）, `nonce`
- 驗證：`HS256` 用 channel secret，`ES256` 用 JWK endpoint 公鑰

### 實作方案

```
用戶 → LINE 授權頁面 → 回傳 code → 後端 POST /token → 驗證 ID token → 建立/關聯本地帳號 → 簽發 session
```

**與 Vine 整合：**
- Better Auth 已有 OAuth provider 擴充機制，新增 LINE provider
- 現有 `account` 表（packages/db schema-private）已支援多 provider 關聯
- `useAuth()` hook 已處理 JWT 狀態，`authData` 供 Zero sync 使用
- 實作 PKCE 提升安全性（Better Auth 支援）

### 安全檢查清單（依 LINE 官方）

- [ ] `redirect_uri` 必須 HTTPS
- [ ] 每次登入產生密碼學安全的 `state` 值
- [ ] callback 時驗證 `state` 是否匹配
- [ ] `client_secret` 僅存於後端，絕不暴露至前端
- [ ] 驗證 access token 的 `client_id` 與 `expires_in`
- [ ] 驗證 ID token 的 `nonce` 是否匹配
- [ ] 從 client 傳至 backend 的必須是原始 token，後端自行驗證

### 風險

- LINE Login auto login 依賴 LINE app 環境，純 web 需 email/QR code
- 需要 LINE Developers Console 建立 channel 取得 channel ID/secret
- email scope 需額外申請

---

## 2. 1:1 聊天

### 可行性：高

Zero sync layer 天然適合即時聊天場景——local-first、optimistic updates、WebSocket 即時同步。

### LINE 官方規格參考

**訊息類型（Messaging API 定義）：**

| 類型 | 必要欄位 | 說明 |
|------|----------|------|
| text | `text` | 純文字，支援 mention 與 LINE emoji |
| text (v2) | `text`, `substitution` | 增強版，支援 `{mention}` 與 emoji 替換 |
| image | `originalContentUrl`, `previewImageUrl` | HTTPS URL |
| video | `originalContentUrl`, `previewImageUrl` | HTTPS URL |
| audio | `originalContentUrl`, `duration` | 毫秒 |
| sticker | `packageId`, `stickerId` | 貼圖識別 |
| location | `title`, `address`, `latitude`, `longitude` | 位置資訊 |
| imagemap | `baseUrl`, `altText`, `baseSize`, `actions[]` | 圖片 + 可點擊區域 |
| template | `template` | Buttons/Confirm/Carousel/Image Carousel |
| flex | `altText`, `contents` | CSS Flexbox 自由排版 |

**已讀機制：**
- Webhook message event 包含 `markAsReadToken`
- `POST /v2/bot/chat/markAsRead`，帶 `markAsReadToken`
- Token 無過期時間，標記該訊息及之前所有訊息為已讀

### 實作方案

**Zero Schema 設計：**

```typescript
// packages/zero-schema/src/models/conversation.ts
conversation: {
  id: string           // UUID
  type: 'direct' | 'group' | 'oa'
  name: string | null  // 群組名稱，direct 為 null
  iconUrl: string | null
  lastMessageId: string | null
  lastMessageAt: number
  createdAt: number
}

// packages/zero-schema/src/models/conversationMember.ts
conversationMember: {
  id: string
  conversationId: string
  userId: string
  role: 'admin' | 'member'
  lastReadMessageId: string | null  // 已讀標記
  lastReadAt: number
  joinedAt: number
}

// packages/zero-schema/src/models/message.ts
message: {
  id: string           // caller-generated（Zero 收斂規則）
  conversationId: string
  senderId: string
  type: 'text' | 'image' | 'video' | 'audio' | 'sticker' | 'location' | 'flex' | 'template'
  content: string      // 文字內容或 JSON
  mediaUrl: string | null
  metadata: string     // JSON: sticker info, location coords, flex contents 等
  replyToMessageId: string | null  // 引用回覆
  createdAt: number    // caller-generated timestamp
}
```

**即時同步（Zero）：**
- `useZeroQuery` 訂閱 conversation list 與 messages
- `zero.mutate` 發送訊息（optimistic update，立即顯示於 UI）
- Zero server push 同步到所有在線 client
- 離線訊息自動排隊，重連後同步

**已讀標記實作：**
- 更新 `conversationMember.lastReadMessageId` 和 `lastReadAt`
- Zero optimistic update 即時反映
- 對方 client 透過 `useZeroQuery` 自動收到已讀狀態更新
- UI 顯示：比對 `message.createdAt` 與對方 `lastReadAt`

**媒體訊息處理：**
- 上傳：Fastify API route 產生 S3/R2 presigned URL → 前端直傳
- `message.mediaUrl` 儲存 CDN URL
- `message.metadata` 儲存尺寸、時長等 meta 資訊
- 使用 React Query (`useTanMutation`) 處理上傳（不經 Zero）

### 風險

- 大量訊息效能需測試（Zero 分頁 + 虛擬化列表）
- 檔案上傳需額外處理（presigned URL 機制）
- 離線時間過長的訊息同步量可能很大

---

## 3. 群組聊天

### 可行性：高

基於 1:1 聊天架構延伸，主要差異在成員管理與權限控制。

### LINE 官方規格參考

**群組相關 Webhook 事件：**

| 事件 | 說明 |
|------|------|
| `join` | Bot 加入群組/聊天室 |
| `leave` | Bot 被移除 |
| `memberJoined` | 新成員加入 |
| `memberLeft` | 成員離開 |
| `message` | 群組訊息（source 含 `groupId`） |

**群組 API：**
- `GET /v2/bot/group/{groupId}/summary` — 群組摘要
- `GET /v2/bot/group/{groupId}/members/count` — 成員數
- `GET /v2/bot/group/{groupId}/members/ids` — 成員列表
- `GET /v2/bot/group/{groupId}/member/{userId}` — 成員資料
- `POST /v2/bot/group/{groupId}/leave` — 離開群組

**多人聊天（Multi-person chat）：**
- LINE 10.17.0+ 已將多人聊天合併為群組
- 使用 `roomId` 識別（歷史相容）

### 實作方案

**資料模型（延伸 conversation + conversationMember）：**

```typescript
conversation: {
  // ...同 1:1
  type: 'group'
  name: string         // 群組名稱
  iconUrl: string | null
  creatorId: string
  memberCount: number  // 快取成員數
  inviteUrl: string | null  // 邀請連結
}
```

**群組操作：**
- 建立：建立 `conversation` + 插入 `conversationMember`（creator 為 admin）
- 邀請：插入新 `conversationMember`
- 移除：刪除 `conversationMember` record（admin 權限）
- 離開：自行刪除 `conversationMember`
- 修改群組資訊：admin 權限檢查後更新 `conversation`

**Zero 權限控制：**
- `conversationMember` 查詢限制：只能看到自己所屬的 conversation
- `message` 查詢限制：只能查看自己是成員的 conversation 的訊息
- 透過 Zero permissions 的 `serverWhere` 機制實現

### 風險

- 大群組（100+ 成員）的訊息廣播效能
- 多人同時修改群組資訊的衝突處理（Zero optimistic update 自動回滾）
- 成員列表的即時同步（成員數多時）

---

## 4. OA 官方帳號

### 可行性：中高

OA 是特殊的 conversation 類型，搭配 webhook 驅動的 bot 自動回覆機制。

### LINE 官方規格參考

**Bot 架構：**
```
用戶傳送訊息 → LINE Platform → Webhook POST 到 bot server → 
bot server 處理 → 呼叫 Messaging API 回覆 → LINE Platform → 用戶收到回覆
```

**Webhook 事件結構：**
```json
{
  "destination": "bot_userId",
  "events": [{
    "type": "message",
    "webhookEventId": "unique_id",
    "deliveryContext": { "isRedelivery": false },
    "timestamp": 1692251666727,
    "source": { "type": "user", "userId": "U..." },
    "replyToken": "token",
    "message": { "type": "text", "text": "Hello" }
  }]
}
```

**Webhook 簽名驗證（HMAC-SHA256）：**
- Key：channel secret
- Input：完整 request body（不可修改）
- Header：`x-line-signature`（Base64 編碼）
- 必須在反序列化之前驗證

**Rich Menu 規格：**

| 屬性 | 說明 |
|------|------|
| size | 2500×1686 px 或 2500×843 px |
| areas[] | 可點擊區域，每區域定義 `bounds`(x,y,w,h) + `action` |
| chatBarText | 底部選單列文字 |
| selected | 預設是否展開 |
| 圖片 | JPEG/PNG，max 1MB |

**Rich Menu 優先順序（高到低）：**
1. Per-user rich menu（Messaging API 設定）
2. Default rich menu（Messaging API 設定）
3. Default rich menu（LINE Official Account Manager 設定）

**Rich Menu Tab 切換：**
- 使用 `richMenuSwitch` action + `richMenuAliasId`
- 建立 alias：`POST /v2/bot/richmenu/alias`
- 切換時可附帶 `data` 觸發 postback event

**Flex Message 結構：**

```
Flex Message
  └─ Container（bubble / carousel）
       └─ Bubble
            ├─ header（Header block）
            ├─ hero（Hero block — 主圖）
            ├─ body（Body block — 主內容）
            └─ footer（Footer block — 按鈕）
                 └─ Components: Box, Text, Image, Button, Icon, Separator, Span, Video, Filler
```

**Flex 排版屬性：**
- `layout`：vertical / horizontal / baseline
- `flex`：空間分配比例
- `spacing`, `margin`, `padding`
- `justifyContent`：flex-start / center / flex-end / space-between / space-around
- `alignItems`：flex-start / center / flex-end
- `position`：relative / absolute
- `backgroundColor`, `borderColor`, `cornerRadius`

**Quick Reply：**
- 最多 13 個按鈕
- 支援 action 類型：postback, message, uri, datetime-picker, camera, camera-roll, location, clipboard
- 點擊後自動消失（camera/datetime/location 除外）

**Actions 類型：**

| Action | 說明 |
|--------|------|
| postback | 發送 data 到 webhook，可控制 UI 顯示 |
| message | 用戶名義送出文字訊息 |
| uri | 開啟 URL（支援 tel:, mailto:, line:// 等） |
| datetimepicker | 日期/時間選擇器 |
| camera | 開啟相機 |
| cameraRoll | 開啟相簿 |
| location | 開啟位置選擇 |
| richmenuswitch | 切換 Rich Menu tab |
| clipboard | 複製文字到剪貼簿 |

### 實作方案

**資料模型：**

```typescript
officialAccount: {
  id: string
  name: string
  description: string
  iconUrl: string
  ownerId: string          // 管理者 userId
  channelSecret: string    // webhook 簽名驗證用
  channelAccessToken: string
  webhookUrl: string | null  // 外部 bot server URL
  greetingMessage: string | null
  autoReply: boolean
  createdAt: number
}

richMenu: {
  id: string
  oaId: string
  name: string
  chatBarText: string
  selected: boolean
  sizeWidth: number    // 2500
  sizeHeight: number   // 1686 or 843
  imageUrl: string
  areas: string        // JSON: [{bounds, action}]
  isDefault: boolean
  createdAt: number
}

richMenuAlias: {
  id: string
  aliasId: string      // richMenuAliasId
  richMenuId: string
}

// Per-user rich menu 透過 join table
userRichMenu: {
  userId: string
  richMenuId: string
}
```

**Webhook 處理（Fastify）：**

```typescript
// apps/server/src/services/messaging/webhook.ts
app.post('/webhook/:oaId', async (request, reply) => {
  // 1. 驗證 HMAC-SHA256 簽名
  const signature = request.headers['x-line-signature']
  const isValid = verifySignature(request.rawBody, channelSecret, signature)
  if (!isValid) return reply.status(403).send()

  // 2. 解析事件
  const { events } = request.body
  for (const event of events) {
    switch (event.type) {
      case 'message': handleMessage(event)
      case 'follow': handleFollow(event)
      case 'unfollow': handleUnfollow(event)
      case 'postback': handlePostback(event)
      // ...
    }
  }

  // 3. 轉發到外部 bot server（如設定）
  if (oa.webhookUrl) {
    await forwardWebhook(oa.webhookUrl, request.body, channelSecret)
  }

  return reply.status(200).send()
})
```

**Flex Message 渲染（Tamagui 對應）：**

| Flex Component | Tamagui 對應 |
|----------------|-------------|
| Box (vertical) | `YStack` |
| Box (horizontal) | `XStack` |
| Box (baseline) | `XStack` + `alignItems="baseline"` |
| Text | `Text` |
| Image | `Image` |
| Button | `Button` |
| Separator | `Separator` |
| Icon | `Image`（小尺寸） |
| Span | `Text`（巢狀多樣式） |

**Channel Access Token v2.1 發行（供 Messaging API 認證）：**

1. 產生 RSA 2048-bit key pair
2. 在 console 註冊公鑰取得 `kid`
3. 組裝 JWT（header: `{alg: RS256, typ: JWT, kid}`, payload: `{iss, sub, aud, exp, token_exp}`）
4. `POST /v2/oauth/accessToken` with JWT assertion
5. 取得 channel access token（自訂有效期，最長 30 天）

### 風險

- Flex Message 完整渲染需大量 Tamagui 元件對應工作
- Rich Menu 圖片的點擊區域座標計算
- Webhook 簽名驗證必須在 body parse 之前執行（Fastify 需 `rawBody` 設定）
- 外部 bot server 的 webhook 轉發可靠性（需重試機制 + idempotency key）

---

## 5. Messaging API（相容層）

### 可行性：高

Messaging API 是標準 REST API + Webhook，與 Fastify + ConnectRPC 架構相容。

### LINE 官方規格參考

**API Domain：**
- `api.line.me` — 一般 API
- `api-data.line.me` — 內容傳輸（訊息內容、Rich Menu 圖片）

**訊息發送 API：**

| LINE API | 端點 | 說明 |
|----------|------|------|
| Reply | `POST /v2/bot/message/reply` | 回覆訊息（需 replyToken） |
| Push | `POST /v2/bot/message/push` | 推播到單一對象 |
| Multicast | `POST /v2/bot/message/multicast` | 推播到多個 userId |
| Narrowcast | `POST /v2/bot/message/narrowcast` | 依條件篩選推播 |
| Broadcast | `POST /v2/bot/message/broadcast` | 推播給所有好友 |

**Rate Limits：**

| 端點類別 | 限制 |
|----------|------|
| Broadcast / Narrowcast / 統計 | 60 req/hr |
| Audience 操作 | 60 req/min |
| Multicast | 200 req/sec |
| Rich Menu CRUD | 100 req/hr |
| Batch Rich Menu | 3 req/hr |
| 其他端點 | 2,000 req/sec |

**請求限制：**
- 每次最多 5 個 message object
- Request body 最大 2MB
- Content-Type: `application/json; charset=utf-8`
- 認證：`Authorization: Bearer {channel_access_token}`

**重試機制：**
- `X-Line-Retry-Key` header 支援冪等重試
- 重複 key 回傳 `409 Conflict`

**User ID 格式：** `U[0-9a-f]{32}`（每個 provider 唯一）

### 實作方案

**API 對照：**

| LINE API | Vine 實作 |
|----------|-----------|
| Reply message | ConnectRPC `ReplyMessage` |
| Push message | ConnectRPC `PushMessage` |
| Multicast | ConnectRPC `MulticastMessage` |
| Broadcast | ConnectRPC `BroadcastMessage` |
| Get content | REST `GET /api/content/:messageId` |
| Get profile | ConnectRPC `GetProfile` |
| Rich Menu CRUD | ConnectRPC `RichMenuService` |
| Webhook config | ConnectRPC `WebhookService` |

**Rate Limiting：**
- 使用 Fastify `@fastify/rate-limit` plugin
- 依端點類別設定不同限制
- 回傳 `429 Too Many Requests`

**冪等重試：**
- 解析 `X-Line-Retry-Key` header
- Redis/PostgreSQL 儲存已處理的 key
- 重複 key 回傳 `409 Conflict`

### 風險

- 大量 push/multicast 訊息需排隊非同步處理（Job Queue）
- Rate limit 需精確依 LINE 官方規格實作
- Channel access token 管理（v2.1 JWT 發行 + 旋轉）

---

## 6. LIFF（LINE Front-end Framework）

### 可行性：中

LIFF 是 LINE app 內的 WebView 容器，提供 JS SDK 存取 LINE 功能。Clone 需模擬此環境。

### LINE 官方規格參考

**LIFF URL 格式：**
- 標準：`https://liff.line.me/{liffId}`
- MINI App：`https://miniapp.line.me/{liffId}`
- URL 參數透過 `liff.state` query parameter 傳遞（URL-encoded）

**View Types：**
- `compact` — 小型 widget
- `tall` — 中型 modal
- `full` — 全螢幕（LINE v15.12.0+，支援 action button）

**核心 SDK API：**

| 方法 | 說明 | 需要 scope | LIFF 限定 |
|------|------|-----------|----------|
| `liff.init({liffId})` | 初始化，取得 token | — | 否 |
| `liff.isInClient()` | 是否在 LIFF browser | — | 否 |
| `liff.getOS()` | 回傳 ios/android/web | — | 否 |
| `liff.getContext()` | 回傳 context（type, userId, viewType） | — | 否 |
| `liff.getProfile()` | 用戶資料 {userId, displayName, pictureUrl} | `profile` | 否 |
| `liff.getFriendship()` | OA 好友狀態 | `profile` | 否 |
| `liff.getAccessToken()` | OAuth access token | — | 否 |
| `liff.getIDToken()` | OIDC ID token (JWT) | `openid` | 否 |
| `liff.getDecodedIDToken()` | 解碼後的 ID token | `openid` | 否 |
| `liff.sendMessages(msgs)` | 發送訊息到當前聊天 | `chat_message.write` | **是** |
| `liff.shareTargetPicker(msgs)` | 選擇朋友/群組分享 | — | 否 |
| `liff.scanCodeV2()` | QR code 掃描 | — | **是**（需開啟功能） |
| `liff.openWindow(url)` | 開啟 URL | — | 否 |
| `liff.closeWindow()` | 關閉 LIFF app | — | 否 |
| `liff.login()` | 顯式登入（外部瀏覽器用） | — | 否 |
| `liff.logout()` | 移除 access token | — | 否 |
| `liff.permission.query()` | 查詢已授權 scope | — | 否 |

**LIFF Scopes：**
- `profile` — `liff.getProfile()`, `liff.getFriendship()`
- `openid` — ID token 相關方法
- `email` — ID token 中的 email claim
- `chat_message.write` — `liff.sendMessages()`

**Pluggable SDK（v2.22.0+）：**
- 按需引入模組，減少 bundle 34%
- `liff.use(module)` 必須在 `liff.init()` 之前呼叫
- 模組：get-os, get-context, send-messages, share-target-picker, scan-code-v2, get-profile, open-window, close-window, login, logout, permission 等

**LIFF Server API（管理 LIFF app）：**
- Base：`https://api.line.me/liff/v1/apps`
- CRUD：Create / List / Update / Delete
- 每 channel 最多 30 個 LIFF app
- 參數：`view.type`, `view.url`, `description`, `features.qrCode`, `scope[]`, `botPrompt`

**LIFF-to-LIFF Transition：**
- 點擊連結開啟另一個 LIFF app（不關閉瀏覽器）
- 需要 v2.4.1+, full view, 正確 init
- 自動加上 `liff.referrer` query parameter

### 實作方案

**LIFF SDK 模擬：**

```typescript
// ~/features/liff/liffSdk.ts
export const liff = {
  init: async ({ liffId }: { liffId: string }) => {
    // 驗證 liffId、建立 session、取得 access token
  },
  ready: Promise<void>,
  id: string | null,

  // 環境偵測
  isInClient: () => boolean,
  getOS: () => 'ios' | 'android' | 'web',
  getContext: () => LiffContext,
  isLoggedIn: () => boolean,
  isApiAvailable: (api: string) => boolean,

  // 用戶資料
  getProfile: () => Promise<UserProfile>,
  getFriendship: () => Promise<{ friendFlag: boolean }>,
  getAccessToken: () => string,
  getIDToken: () => string,
  getDecodedIDToken: () => DecodedIDToken,

  // 訊息
  sendMessages: (messages: Message[]) => Promise<void>,
  shareTargetPicker: (messages: Message[]) => Promise<ShareResult>,

  // 視窗
  openWindow: (params: { url: string; external?: boolean }) => void,
  closeWindow: () => void,

  // 認證
  login: (config?: LoginConfig) => void,
  logout: () => void,

  // 權限
  permission: {
    query: (permissions: string[]) => Promise<PermissionStatus>,
    requestAll: () => Promise<void>,
    getGrantedAll: () => Promise<string[]>,
  },

  // QR Code
  scanCodeV2: () => Promise<{ value: string; type: string }>,
}
```

**LIFF Container 頁面：**
- Route：`/liff/:liffId/*`
- 以 iframe 或 WebView 載入 LIFF app endpoint URL
- 注入 `window.liff` 全域物件
- 處理 `liff.state` parameter routing
- 支援三種 view type 的 UI 呈現（compact/tall/full）

**LIFF Server API 實作：**
- ConnectRPC `LiffService`：CRUD operations
- 儲存 LIFF app 設定（liffId, endpointUrl, viewType, scopes, botPrompt）
- 每 channel 限制 30 個 LIFF app

**LIFF-to-LIFF Transition：**
- 攔截 `liff.line.me` 連結
- 載入新 LIFF app 而不關閉容器
- 傳遞 `liff.referrer` parameter

### 風險

- `liff.sendMessages()` 需要 conversation context，僅在 LIFF browser 內可用
- `liff.shareTargetPicker()` 需要完整的聯絡人選擇 UI
- `liff.scanCodeV2()` 需要 web QR scanner API（瀏覽器相容性）
- LIFF browser 的 WKWebView/Android WebView 行為難以完全模擬
- LIFF access token 機制（12 小時有效）需額外處理
- Pluggable SDK 的動態模組載入機制較複雜

---

## 整體架構

```
┌──────────────────────────────────────────────────────┐
│                      Client                           │
│  ┌───────────┐  ┌───────────┐  ┌──────────────────┐ │
│  │  Chat UI  │  │   LIFF    │  │   OA Bot UI      │ │
│  │  Tamagui  │  │ Container │  │   Tamagui        │ │
│  └─────┬─────┘  └─────┬─────┘  └────────┬─────────┘ │
│        │               │                 │            │
│  ┌─────┴───────────────┴─────────────────┴─────────┐ │
│  │               Zero Client                        │ │
│  │   useZeroQuery · zero.mutate · optimistic        │ │
│  └──────────────────────┬───────────────────────────┘ │
│                         │ WebSocket                    │
└─────────────────────────┼────────────────────────────┘
                          │
┌─────────────────────────┼────────────────────────────┐
│                       Server                          │
│  ┌──────────────────────┴───────────────────────────┐│
│  │              Fastify + ConnectRPC                 ││
│  │  ┌──────────┐ ┌──────────┐ ┌────────┐ ┌───────┐ ││
│  │  │Messaging │ │   Auth   │ │  LIFF  │ │  OA   │ ││
│  │  │ Service  │ │ Service  │ │Service │ │Service│ ││
│  │  └──────────┘ └──────────┘ └────────┘ └───────┘ ││
│  │  ┌──────────────────────────────────────────────┐││
│  │  │           Webhook Dispatcher                 │││
│  │  │   HMAC-SHA256 驗證 → 事件路由 → Bot 轉發     │││
│  │  └──────────────────────────────────────────────┘││
│  └──────────────────────┬───────────────────────────┘│
│                         │                             │
│  ┌──────────────────────┴───────────────────────────┐│
│  │                Zero Server                        ││
│  │   sync · mutations · permissions · rows           ││
│  └──────────────────────┬───────────────────────────┘│
│                         │                             │
│  ┌──────────────────────┴───────────────────────────┐│
│  │              PostgreSQL + Drizzle                  ││
│  └───────────────────────────────────────────────────┘│
└───────────────────────────────────────────────────────┘
```

---

## 開發優先順序建議

| 階段 | 功能 | 依賴 | 核心技術 |
|------|------|------|----------|
| P0 | LINE Login | 無 | Better Auth OAuth provider |
| P0 | 1:1 聊天（文字） | Zero schema | Zero sync + Tamagui |
| P1 | 已讀標記 | 1:1 聊天 | conversationMember.lastReadMessageId |
| P1 | 群組聊天 | 1:1 聊天 | conversationMember 擴充 |
| P1 | 媒體訊息 | 1:1 聊天 | S3/R2 presigned URL |
| P2 | OA 官方帳號 | 1:1 聊天 | Webhook + Bot 框架 |
| P2 | Rich Menu | OA | Tamagui 渲染 + 座標計算 |
| P2 | Messaging API 相容層 | OA | Fastify REST routes |
| P3 | Flex Message 渲染 | OA | Tamagui Flexbox 對應 |
| P3 | Quick Reply | 聊天 | Tamagui 按鈕列 |
| P4 | LIFF 框架 | LINE Login | LIFF SDK 模擬 + Container |
| P4 | LIFF shareTargetPicker | LIFF + 聊天 | 聯絡人選擇 UI |

---

## 技術風險總結

| 風險 | 嚴重度 | 緩解方案 |
|------|--------|----------|
| Zero 大訊息量效能 | 中 | 分頁查詢、虛擬化列表、歷史訊息分片 |
| LIFF 環境模擬不完整 | 中 | 優先支援核心 API（init/getProfile/sendMessages），標明限制 |
| Flex Message 渲染複雜度 | 中 | 建立 Flex-to-Tamagui 渲染器，逐步支援 components |
| Webhook 簽名驗證 | 低 | Fastify rawBody + HMAC-SHA256，依官方 spec 實作 |
| Rich Menu 座標計算 | 低 | 圖片等比縮放 + bounds 比例轉換 |
| 檔案儲存 | 低 | S3/R2 + CDN + presigned URL |
| Channel Access Token v2.1 | 低 | RSA key pair 產生 + JWT 簽發，依官方流程 |
| Rate Limiting 精確度 | 低 | @fastify/rate-limit 依端點分級設定 |

---

## 結論

**整體可行性：高**

Vine 現有技術棧非常適合實作 LINE clone 核心功能：

1. **LINE Login** — Better Auth OAuth 擴充，官方標準 OAuth 2.0 + OIDC 流程，完全相容
2. **1:1/群組聊天** — Zero sync layer 提供 local-first 即時同步，是理想的聊天基礎設施
3. **OA/Messaging API** — Fastify 處理 webhook（HMAC-SHA256 驗證），ConnectRPC 提供類型安全 API
4. **Flex Message** — Tamagui 的 Flexbox 布局與 LINE Flex Message 結構天然對應
5. **LIFF** — 需最多額外工作，但核心 API（init/getProfile/sendMessages/shareTargetPicker）可實作

最大挑戰在 LIFF 框架的完整模擬（依賴 LINE app 環境的功能）與 Flex Message 的全量渲染。建議先完成 Login + 聊天核心，再逐步擴展 OA/Messaging API/LIFF。
