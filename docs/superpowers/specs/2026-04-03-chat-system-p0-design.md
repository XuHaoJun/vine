# Chat System P0 Design

**Date:** 2026-04-03  
**Scope:** 1:1 文字聊天、好友系統、已讀標記  
**Stack:** Zero (sync) + Zero custom mutators + Tamagui + OneJS routing

---

## 1. 資料 Schema

### DB（`packages/db/src/schema-public.ts`）

```typescript
// 好友關係
friendship: {
  id: string           // UUIDv7，caller-generated
  requesterId: string  // 發送者 userId
  addresseeId: string  // 接收者 userId
  status: 'pending' | 'accepted' | 'rejected' | 'blocked'
  createdAt: number
  updatedAt: number
}

// 聊天室
chat: {
  id: string
  type: 'direct' | 'group' | 'oa'  // P0 只用 direct，其餘預留
  lastMessageId: string | null
  lastMessageAt: number | null
  createdAt: number
}

// 聊天成員（含已讀標記）
chatMember: {
  id: string
  chatId: string
  userId: string
  lastReadMessageId: string | null
  lastReadAt: number | null
  joinedAt: number
}

// 訊息
message: {
  id: string           // UUIDv7，caller-generated
  chatId: string
  senderId: string
  type: 'text' | 'image' | 'video' | 'audio' | 'sticker' | 'location' | 'flex' | 'template'
  text: string | null        // type='text' 時有值，對齊 LINE message object
  metadata: string | null    // JSON，存 type-specific 資料（image URL、sticker ID 等）
  replyToMessageId: string | null  // 引用回覆，P0 不實作但欄位預留
  createdAt: number          // caller-generated（Zero 收斂規則）
}
```

### Zero Schema（`packages/zero-schema/src/`）

四個 model 對應四張表，全部進入 Zero replication（public schema）。命名：`friendship`、`chat`、`chatMember`、`message`。

---

## 2. Zero Permissions

```
friendship
  read:   requesterId = me OR addresseeId = me
  insert: requesterId = me
  update: addresseeId = me（只有接收方能改 status）
  delete: 不允許（用 blocked 取代）

chat
  read:   EXISTS chatMember WHERE chatId = chat.id AND userId = me
  insert: 不允許（由 acceptFriendship custom mutator 建立）
  update: 不允許（由 sendMessage custom mutator 更新）

chatMember
  read:   userId = me
  insert: 不允許（由 custom mutator 建立）
  update: userId = me，且只能更新 lastReadMessageId / lastReadAt

message
  read:   EXISTS chatMember WHERE chatId = message.chatId AND userId = me
  insert: senderId = me AND EXISTS chatMember（純 CRUD，custom mutator 包裝）
  update: 不允許
  delete: 不允許
```

### Custom Mutators

| Mutator | 觸發時機 | Server 端操作 |
|---------|----------|---------------|
| `acceptFriendship(friendshipId)` | 接受好友申請 | 更新 friendship.status → 'accepted'，建立 chat（type: 'direct'）+ 2x chatMember |
| `sendMessage(message)` | 發送訊息 | insert message，更新 chat.lastMessageId + lastMessageAt |

---

## 3. UI 結構與路由

### 底部 Tabs（P0）

```
聊天・好友  |  設定
```

### 路由

```
app/(app)/home/(tabs)/
  _layout.tsx                  ← 底部 tabs（聊天・好友 / 設定）
  talks/
    index.tsx                  ← 聊天・好友主頁（pill toggle）
    [chatId].tsx               ← 聊天室（push，tabs 消失）
    requests.tsx               ← 好友申請列表（收到 + 發出）
  settings/                    ← 現有保留
```

### `talks/index.tsx` 結構

```
┌─────────────────────────────────────┐
│  聊天・好友    🔔  □  ＋            │  ← header
│  ┌──────────────────────────────┐   │
│  │         🔍 搜尋              │   │  ← search bar
│  └──────────────────────────────┘   │
│  ┌────────┐ ┌────────┐              │
│  │  聊天  │ │  好友  │              │  ← pill toggle
│  └────────┘ └────────┘              │
│                                     │
│  [聊天 view]  聊天列表               │
│  or                                 │
│  [好友 view]  好友列表               │
└─────────────────────────────────────┘
```

- **🔔 icon**：pending 好友申請 badge，點入 `requests.tsx`
- **＋ dropdown（P0）**：搜尋用戶加好友（P1 加入建立群組）
- **搜尋欄**：範圍跟著 pill 切換。聊天 view 時篩對話對象名稱；好友 view 時篩好友名稱
- **聊天 view**：chat 列表，按 `lastMessageAt` 降序；每行顯示對方頭像、名稱、最後訊息預覽、時間戳、未讀 badge
- **好友 view**：accepted friendship 列表；每行顯示頭像、名稱、狀態訊息；點擊進入對應聊天室

### 聊天室（`[chatId].tsx`）

- 進入聊天室時更新 `chatMember.lastReadMessageId` + `lastReadAt`；在聊天室內收到新訊息時也立即更新
- 訊息列表（虛擬化，`useZeroQuery` 訂閱近 100 則）
- 歷史訊息（>100 則）透過 ConnectRPC cursor pagination 載入，只進 React state
- 訊息氣泡：自己靠右（綠色），對方靠左（白色）
- 已讀標記：比對對方 `lastReadMessageId` 與訊息 id 顯示「已讀」
- 底部輸入框 + 送出按鈕

### UI 參考

`docs/line-ui-reference/` 內有新版 LINE UI 截圖供實作參考：
- `talks-friends-pill-toggle-hero.jpg` — 新舊 UI 對比
- `friends-tab-subtabs-and-album.jpg` — 好友 tab
- `plus-button-dropdown-ios-android.jpg` — + 按鈕 dropdown

---

## 4. Zero Queries（`packages/zero-schema/src/queries/`）

```typescript
chatsByUserId(userId)       // 我的所有 chat，含 lastMessageId 關聯
messagesByChatId(chatId)    // 最近 100 則訊息
friendsByUserId(userId)     // accepted friendships，含對方 userPublic
pendingRequestsByUserId(userId)  // pending friendships（收到 + 發出）
```

---

## 5. Error Handling

| 情境 | 處理方式 |
|------|----------|
| 申請已是好友的人 | Zero permission 拒絕，UI 顯示「已是好友」 |
| 搜尋不存在的 username | 搜尋結果為空 |
| `acceptFriendship` mutator 失敗 | Zero rollback optimistic update，`showError()` |
| 發送訊息失敗（離線） | Zero 自動排隊，重連後同步；訊息顯示 pending 狀態 |
| 進入無權限的 chatId | Zero 回傳空資料，redirect 回聊天列表 |
| 網路斷線 | Zero 內建離線支援，重連自動同步 |

---

## 6. Testing

| 層級 | 測試內容 | 工具 |
|------|----------|------|
| Unit | `acceptFriendship` / `sendMessage` custom mutator 邏輯 | vitest |
| Unit | `chatsByUserId` / `messagesByChatId` query 正確性 | vitest |
| Integration | 好友申請完整流程（搜尋 → 申請 → 接受 → 聊天室出現） | Playwright |
| Integration | 發送訊息 + 已讀標記更新 | Playwright |

---

## 7. 不在 P0 範圍

- 媒體訊息（圖片、影片、貼圖）
- 群組聊天
- OA 官方帳號
- QR code 加好友
- 歷史訊息 ConnectRPC 實作（介面預留，P1 補上）
- 好友 Favorites / 群組子 tab
