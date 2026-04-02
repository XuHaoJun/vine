# LINE Clone 開發評估筆記

## 開發優先順序（來自 line-clone-assessment.md）

| 階段 | 功能 | 核心技術 |
|------|------|----------|
| P0 | LINE Login | Better Auth OAuth provider |
| P0 | 1:1 聊天（文字） | Zero sync + Tamagui |
| P1 | 已讀標記 | conversationMember.lastReadMessageId |
| P1 | 群組聊天 | conversationMember 擴充 |
| P1 | 媒體訊息 | S3/R2 presigned URL |
| P2 | OA 官方帳號 | Webhook + Bot 框架 |
| P2 | Rich Menu | Tamagui 渲染 + 座標計算 |
| P2 | Messaging API 相容層 | Fastify REST routes |
| P3 | Flex Message 渲染 | Tamagui Flexbox 對應 |
| P3 | Quick Reply | Tamagui 按鈕列 |
| P4 | LIFF 框架 | LIFF SDK 模擬 + Container |
| P4 | LIFF shareTargetPicker | 聯絡人選擇 UI |

---

## Zero 架構評估

### 三層資料流

```
PostgreSQL (WAL logical replication)
    ↓
SQLite Server-Side Replica (zero-cache)
    ↓ WebSocket (poke/patch protocol)
IndexedDB Client-Side Store (Replicache)
```

### 分層載入策略（聊天訊息）

```
┌─────────────────────────────────────────────┐
│  In-Memory (React state / IVM)              │
│  ~50-100 則（當前 viewport + buffer）        │
│  用途：渲染列表，虛擬化滾動                   │
├─────────────────────────────────────────────┤
│  IndexedDB (Zero local store)               │
│  ~2000-5000 則（最近 7 天或固定數量）         │
│  用途：離線可讀、快速切換 conversation        │
├─────────────────────────────────────────────┤
│  PostgreSQL (Server source of truth)        │
│  全部歷史（10 萬+）                          │
│  用途：分頁載入舊訊息、備份、合規              │
└─────────────────────────────────────────────┘
```

### 歷史訊息載入

- 使用 **ConnectRPC**（非 Zero），因為超過 5000 則不該進 Zero
- Cursor-based pagination 使用 **UUIDv7**（天然有序且唯一，避免同毫秒多筆訊息漏載）
- 載入的資料只進 React state（虛擬化列表），不進 Zero / IndexedDB
- 切換 conversation 時清空

```protobuf
message GetOlderMessagesRequest {
  string conversation_id = 1;
  optional string cursor = 2;  // 最舊那則的 UUIDv7
  int32 limit = 3;             // 預設 50
}
```

---

## Public / Private Schema 分離

不是 PostgreSQL schema 分離，而是**邏輯分離**，都在同一個 DB 的 `public` schema。

| | Private | Public |
|---|---|---|
| 用途 | Better Auth 基礎設施 | 應用資料（Zero sync） |
| 表格 | `user`, `account`, `session`, `jwks`, `verification` | `userPublic`, `userState`, `todo` + 未來聊天 tables |
| 內容 | email、密碼 hash、token、session | name、username、image |
| Zero 能否存取 | ❌ 排除在 replication publication 之外 | ✅ 透過 WAL 同步到 client |

**資料流：** Better Auth 寫入 private `user` → `afterCreateUser` hook 複製安全欄位到 public `userPublic` → WAL replication → Zero 同步到 client。

新增 private table 只要放到 `schema-private.ts`，會自動從 Zero publication 排除。

---

## Zero Mutation 機制

### 流程

```
client: zero.mutate.table.insert(data)
  ↓ 立刻寫入本地 IndexedDB（optimistic）
  ↓ UI 立刻更新
  ↓ WebSocket push 到 server
  ↓ Server: Write Authorizer (pre + post mutation 權限檢查)
  ↓ Server: 在 PostgreSQL transaction 執行
  ↓ Poke 回來（row patches + mutation result）
  ↓ Client reconcile: server 資料覆蓋 optimistic 資料
```

### 決策矩陣

| 情境 | 方案 | 原因 |
|------|------|------|
| 簡單 CRUD（訊息、profile、群組成員） | Zero CRUD | optimistic update、離線、即時同步 |
| CRUD + auth check / 跨 table | Zero custom mutator | 同上 + server-side validation |
| 檔案上傳 | REST + React Query | binary 不能走 Zero protocol |
| 外部 API（金流、email、webhook） | REST/ConnectRPC | Zero mutation 不能發 HTTP |
| 歷史訊息分頁 | ConnectRPC | 不該污染 Zero store |
| 存取 private table | REST/ConnectRPC 或 Server Action | Zero 只能存取 public tables |
| 寫入結果會反映在 Zero table | REST/ConnectRPC 寫 PG → Zero 自動同步 | 不需要自己寫入 Zero |

### Hybrid 範例：發訊息附圖片

```
1. useTanMutation → REST 拿 presigned URL
2. 前端直傳 S3
3. zero.mutate.message.insert({ mediaUrl: s3Url, ... })  ← 訊息進 Zero
```

---

## 適合 Zero 的 LINE Clone 資料

| 資料 | 適合 Zero | 原因 |
|------|-----------|------|
| 使用者 profile | ✅ | 量小、需要即時同步 |
| 好友列表 | ✅ | 需要即時更新狀態 |
| 群組成員列表 | ✅ | 加入/離開即時反映 |
| Conversation list meta | ✅ | 最後訊息、未讀數 |
| 聊天訊息（近期） | ✅ | 即時同步、離線支援 |
| 已讀狀態 | ✅ | 需要即時推送 |
| Rich Menu 設定 | ✅ | OA 管理者改設定需要推送 |
| 聊天設定 | ✅ | 跨裝置同步 |
| 大量歷史訊息 | ❌ | 需分頁，走 ConnectRPC |
| 媒體檔案本身 | ❌ | 走 S3/R2 presigned URL |
| 統計/分析 | ❌ | 不需要即時同步 |

---

## Design / Figma

- Vine 已有 Tamagui UI 系統 + `~/interface/*` 元件庫
- MVP 階段可用現有元件快速搭建
- 如需高度還原 LINE 視覺風格，提供 Figma 或截圖參考會更好
