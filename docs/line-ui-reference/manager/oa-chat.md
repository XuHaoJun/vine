# LINE OA Chat — PC 管理介面 UI/UX 分析

> 來源：LINE Official Account Manager Chat 介面 (`vos.line-scdn.net/line-oa-crm-pc`)
> 對應產品：LINE Official Account Manager (manager.line.biz) > Chat

---

## 1. 整體佈局：4-Column 桌面佈局

```
┌──────────────────────────────────────────────────────────────────────────────┐
│  HEADER                                                                       │
│ ┌──────────────────────────────────────────────────────────────────────────┐ │
│ │ [LINE OA Logo]   │ [OA 帳號切換 ▾]     │ [🔒 Pro 升級] │ [使用者] [❓] │ │
│ │  連到 OA manager │                       │  badge       │ 頭像+名  help │ │
│ └──────────────────────────────────────────────────────────────────────────┘ │
├────────┬───────────────┬──────────────────────────────┬──────────────────────┤
│ COL 1  │  COL 2        │  COL 3                       │  COL 4               │
│ NAV    │  Chat List    │  Chat Room                   │  User Profile        │
│ ~52px  │  ~240px       │  flex: 1                    │  ~280px              │
├────────┼───────────────┼──────────────────────────────┼──────────────────────┤
│        │               │                              │                      │
│  💬    │ Search bar    │ Chat Header (name + avatar)  │ [⋮] kebab menu      │
│ Chats  │ [__________]  │                              │                      │
│        │               │ ──────────────────────────   │ ┌────────────────┐   │
│  📇    │ ● Chat 1      │                              │ │  Avatar (大)   │   │
│ Cont-  │   User Name   │  MESSAGE AREA                │ │  圓形大頭貼     │   │
│ acts   │   "last msg"  │  (scrollable)                │ └────────────────┘   │
│        │               │                              │                      │
│  📡    │   Chat 2      │  ┌────────────────────┐      │ Display Name         │
│ Multi  │   User Name   │  │ OA bubble (左側)    │      │ @user_id             │
│ msg    │   "last msg"  │  │ "您好，有什麼需要   │      │                      │
│        │               │  │  幫忙的嗎？"        │      │ ───────────────────  │
│  ⚙     │ ● Chat 3      │  └────────────────────┘      │                      │
│ Sett-  │   User Name   │                              │ Tags / Notes         │
│ ings ▾ │   "last msg"  │               ┌──────────┐   │ (collapsible)        │
│        │               │               │User bubble│   │                      │
│  Basic │   Chat 4      │               │(右側)     │   │ hide-on-collapse     │
│  Tags  │   User Name   │               │"我需要   │   │ 更多內容...          │
│  Std   │   "last msg"  │               │ 協助"    │   │                      │
│  Reply │               │               └──────────┘   └──────────────────────┘
│  Resp  │ [∞ scroll or  │                              │
│  Hours │  pagination]  │ "Try sending a sticker."     │
│  Call  │               │ (空狀態 placeholder)          │
│  Sched │               │                              │
│  Msg   │               │ ──────────────────────────   │
│  Filter│               │ EDITOR AREA                  │
│        │               │ ┌──────────────────────────┐ │
│  ◀ Hide│               │ │ [textarea:               │ │
│  Menu  │               │ │  Enter=Send              │ │
│        │               │ │  Shift+Enter=Newline]    │ │
│        │               │ └──────────────────────────┘ │
│        │               │ ┌──────────────────────────┐ │
│        │               │ │ 😊  📎  ➕  📞  [Send ▾] │ │
│        │               │ │Stick Att Rich Phone  Send │ │
│        │               │ │ er   ach  Msg  Call       │ │
│        │               │ └──────────────────────────┘ │
└────────┴───────────────┴──────────────────────────────┴──────────────────────┘
```

### COL1: 導航選單 (NAV) — ~52px (collapsed) / ~200px (expanded)

```
┌──────────────────────┐
│ 💬 Chats             │  ← active state
│    └─ Chats          │  ← sub-title (階層指示)
├──────────────────────┤
│ 📇 Contact list      │
│    └─ Contact list   │
├──────────────────────┤
│ 📡 Messaging         │  ← 群發/廣播訊息
│    multiple users    │
├──────────────────────┤
│ ⚙ Chat settings  ▾   │  ← expandable accordion
│    Chat settings     │
│    Basic             │  ← 基本設定
│    Tags              │  ← 標籤管理
│    Standard replies  │  ← 罐頭回覆模板
│    Response hours    │  ← 服務時間 (auto-reply off-hours)
│    Call              │  ← 通話設定
│    Scheduled messages│  ← 排程訊息管理
│    Custom filters ★  │  ← 進階方案 (Pro badge)
├──────────────────────┤
│ ◀ Hide menu labels   │  ← toggle: collapse to icon-only
└──────────────────────┘
```

**行為：**
- 點選任一 nav item → COL2 切換對應內容
- "Chat settings" 為 expandable accordion，展開後顯示子項目
- "Hide menu labels" 將 COL1 縮成 ~52px icon-only，COL2/3/4 等比擴張
- Custom filters 標有 "進階方案" badge，表示 Pro 用戶專屬功能

---

## 2. COL1 對應的頁面內容

| Nav Item | COL2 顯示內容 | COL3/COL4 行為 |
|---|---|---|
| **Chats** | 聊天列表（與用戶的一對一對話） | COL3=最後選中或空狀態，COL4=該用戶 profile |
| **Contact list** | 聯絡人/好友列表管理 | 切換為聯絡人管理模式 |
| **Messaging multiple users** | 群發訊息編輯器 + 目標受眾選擇 | 訊息編輯模式 |
| **Settings > Basic** | 基本聊天設定表單 | 設定面板 |
| **Settings > Tags** | 標籤管理 CRUD | 標籤列表/編輯 |
| **Settings > Standard replies** | 罐頭回覆模板庫 (新增/編輯/刪除) | 模板管理 |
| **Settings > Response hours** | 服務時間設定 (多時段) | 時間設定 |
| **Settings > Call** | 通話功能設定 | 設定面板 |
| **Settings > Scheduled messages** | 排程訊息列表 (狀態: 待發送/已發送/取消) | 排程管理 |
| **Settings > Custom filters** | 自訂聊天篩選器 | Pro 功能 |

---

## 3. COL2: 聊天列表 (Chat List)

```
┌─────────────────────┐
│ 🔍 [Search chats..] │  ← 搜尋/過濾聊天
├─────────────────────┤
│ ● Chat Item         │  ← 未讀標記 (藍點)
│ ┌─────────────────┐ │
│ │ 👤 User Name     │ │
│ │ 最後一則訊息預覽  │ │
│ │        10:30 AM  │ │  ← timestamp
│ └─────────────────┘ │
├─────────────────────┤
│   Chat Item         │
│ ┌─────────────────┐ │
│ │ 👤 User Name     │ │
│ │ 最後一則訊息預覽  │ │
│ │         yesterday│ │
│ └─────────────────┘ │
├─────────────────────┤
│   ...               │
│   (無限滾動/分頁)    │
└─────────────────────┘
```

**行為：**
- 點選聊天項目 → COL3 載入該對話訊息，COL4 顯示該用戶 profile
- 藍點(●)表示未讀訊息
- 支援搜尋/過濾（Custom filters 為進階功能）
- 每項顯示：用戶頭像、名稱、最後訊息預覽、時間戳

---

## 4. COL3: 聊天室 (Chat Room)

### 4.1 Chat Header

```
┌──────────────────────────────────────────┐
│ 👤 [UserName]                            │
│    在線狀態 / 最後活動時間               │
└──────────────────────────────────────────┘
```

顯示對象的頭像與名稱，以及可能的在線狀態。

### 4.2 Message Area

- **OA 訊息 (自己發的)**：左側氣泡，顯示發送時間
- **用戶訊息**：右側氣泡，顯示發送時間
- 支援的訊息類型（詳見第 6 節）：
  - 文字訊息（含 LINE emoji + Unicode emoji）
  - 貼圖 (Sticker)
  - 圖片
  - 影片
  - 音訊
  - 位置訊息
  - 模板訊息（Buttons, Confirm, Carousel, Image Carousel）
  - Flex Message（自訂 CSS-Flexbox 佈局）
  - Rich Menu（底部選單，可展開/折疊）
  - Quick Reply（訊息下方的快速回覆按鈕，最多 13 個）
- **空狀態**：若無訊息則顯示 "Try sending a sticker."
- **OA 打字中動畫** (Loading animation)：顯示 OA 正在處理中的動畫指示器 (最多 60 秒)

### 4.3 Editor Area

```
┌──────────────────────────────────────────┐
│ EDITOR TOOLBAR                           │
│                                          │
│ [😊]     [📎]      [➕]      [📞]        │
│ Sticker  Attach    Rich      Phone       │
│ /Emoji   ment      Message   Call        │
│ Picker   (file)    Template              │
│                                          │
│ 各按鈕行為：                              │
│ 😊 → 貼圖選擇器 popover                  │
│      (package ID + sticker ID)           │
│ 📎 → 檔案上傳 input[type=file]           │
│      (圖片/影片/音訊/檔案)               │
│ ➕ → Rich Message 模板選擇器             │
│      (Buttons/Carousel/Confirm/          │
│       Image Carousel / Flex Message)     │
│ 📞 → 發起 LINE 語音/視訊通話            │
│                                          │
├──────────────────────────────────────────┤
│                                          │
│ [Textarea: 輸入訊息]                      │
│ Enter = 發送                             │
│ Shift+Enter = 換行                       │
│ placeholder: "Enter: Send message,       │
│              Shift + Enter: New line"    │
│                                          │
├──────────────────────────────────────────┤
│                                          │
│              [Send ▾]                    │
│               Send button +              │
│               dropdown:                  │
│               ┌──────────────┐           │
│               │ Send now      │           │
│               │ Schedule...  │  ← 排程   │
│               └──────────────┘           │
└──────────────────────────────────────────┘
```

**Send 按鈕行為：**
- 點擊 Send → 立即發送
- 點擊 ▾ → 下拉選單：Send now / Schedule message
- Schedule → 開啟 ScheduledMessageDropdown: 日期/時間選擇器，設定排程發送

**Sticker/Emoji picker (`sticonButton`)：**
- 貼圖選擇器以 popover 形式彈出
- 按 sticker package 分類，點選後插入訊息
- 支援 LINE emoji 清單

**Rich Message Template (`➕`)：**
- 選取模板類型後，配置模板內容（JSON 編輯或 GUI）
- 支援的模板類型：Buttons, Confirm, Carousel, Image Carousel, Flex Message

---

## 5. COL4: 用戶資訊面板 (content-thirdly)

```
┌─────────────────────┐
│               [⋮]   │  ← kebab menu:
│                     │     View full profile
│   ┌─────────────┐   │     Block user
│   │             │   │     Report
│   │   AVATAR    │   │     Add note
│   │   (large,   │   │
│   │   rounded)  │   │
│   │             │   │
│   └─────────────┘   │
│                     │
│   Display Name      │
│   @user_id          │
│                     │
│ ─────────────────── │
│                     │
│   Tags              │
│   [tag1] [tag2]     │
│                     │
│   Notes             │
│   ┌─────────────┐   │
│   │ editable    │   │
│   │ text area   │   │
│   └─────────────┘   │
│                     │
│ ── hide-on-collapse  │  ← 可折疊區域
│                     │
│   更多用戶資訊       │
│   (自訂屬性、備註等) │
│                     │
└─────────────────────┘
```

**功能：**
- 用戶大頭貼 + 顯示名稱 + ID
- Kebab menu (⋮) 提供進一步操作
- Tags 標籤（可管理）
- Notes 備註（可編輯文字區）
- `hide-on-collapse`：可折疊區塊，顯示更多用戶屬性

---

## 6. LINE Messaging API 支援的訊息類型

以下是 LINE OA Chat 編輯器可發送的完整訊息類型（基於 Messaging API）：

| 類型 | API type | 說明 |
|---|---|---|
| **Text** | `text` | 純文字，支援 LINE emoji + Unicode emoji |
| **Text v2** | `textV2` | 文字訊息 v2，支援 `{name}` 替換為 mention/emoji |
| **Sticker** | `sticker` | 貼圖，指定 `packageId` + `stickerId` |
| **Image** | `image` | 圖片，需 `originalContentUrl` + `previewImageUrl` (HTTPS) |
| **Video** | `video` | 影片，需 `originalContentUrl` + `previewImageUrl` + 可選 `trackingId` |
| **Audio** | `audio` | 音訊，需 `originalContentUrl` + `duration` (毫秒) |
| **Location** | `location` | 位置，含 `title`, `address`, `latitude`, `longitude` |
| **Imagemap** | `imagemap` | 可點擊區域的圖片地圖，含 `baseUrl`, `baseSize`, `actions` |
| **Template - Buttons** | `template` / `buttons` | 按鈕模板：圖片+標題+文字+多個 action 按鈕 |
| **Template - Confirm** | `template` / `confirm` | 確認模板：文字+兩個按鈕 |
| **Template - Carousel** | `template` / `carousel` | 輪播模板：多個可橫向滑動的 columns |
| **Template - Image Carousel** | `template` / `image_carousel` | 圖片輪播：多個可橫向滑動的圖片 |
| **Flex Message** | `flex` | 自訂佈局訊息，基於 CSS Flexbox，支援 Bubble/Carousel 容器 |

### 6.1 Actions (互動行為)

所有模板和 Flex Message 可附加的 action 類型：

| Action | 用途 |
|---|---|
| **Postback** | 點擊後發送 postback event 到伺服器，可附帶 `data` + `displayText` |
| **Message** | 點擊後以用戶身份發送指定的文字訊息 |
| **URI** | 開啟 URL（LINE in-app browser 或外部瀏覽器），支援 `tel:`, `line://` scheme |
| **Datetime picker** | 彈出日期/時間選擇器，選擇後觸發 postback event |
| **Camera** | 開啟相機 (僅 quick reply) |
| **Camera roll** | 開啟相簿 (僅 quick reply) |
| **Location** | 開啟位置選擇 (僅 quick reply) |
| **Rich menu switch** | 切換 rich menu (僅 rich menu action) |
| **Clipboard** | 複製文字到剪貼簿 |

### 6.2 Quick Reply

- 附加在**任何訊息類型**下方
- 最多 13 個按鈕
- 每個按鈕包含：`action` + 可選 `imageUrl` (icon)
- 用戶點選後按鈕會消失（除非是 camera/camera roll/location/datetime picker action）
- 新的訊息發送後 quick reply 也會消失

### 6.3 Rich Menu

- 顯示在聊天室底部的大型選單圖片
- 結構：**選單圖片** + **可點擊區域 (areas)** + **chat bar** (開關按鈕)
- 圖片需求：JPEG/PNG, 2500x1686px (large) 或 2500x843px (half)
- 每個 area 可指定 `bounds` (x, y, width, height) + `action`
- 支援 per-user rich menu（針對特定用戶顯示不同選單）
- **注意：Rich menu 不在 LINE for PC 上顯示**（僅 iOS/Android）
- 可使用 postback action 控制：關閉 rich menu / 開啟 rich menu / 開啟鍵盤 / 開啟語音輸入

### 6.4 Loading Animation (打字中動畫)

- OA 收到用戶訊息後，可對該 chat 顯示 loading animation
- 通過 API endpoint `POST /v2/bot/chat/loading/start` 觸發
- 指定 `loadingSeconds` (5-60 秒) 或直到下一則訊息到達時自動消失
- 僅在一對一聊天中可用，群聊/多人聊天不支援

---

## 7. Chat Settings 子功能詳解

### 7.1 Standard Replies (罐頭回覆)

預先定義的訊息模板，OA 管理者可快速插入常用回覆。

功能：
- 建立/編輯/刪除罐頭回覆
- 分類管理（標題 + 內容）
- 在 COL3 editor 中可快速搜尋並插入
- 支援文字、emoji、以及簡單格式

### 7.2 Tags (標籤)

用戶分類標籤系統。

功能：
- 建立/編輯/刪除標籤
- 為用戶加上/移除標籤（在 COL4 用戶面板操作）
- 標籤可用於過濾聊天列表、群發訊息目標篩選

### 7.3 Response Hours (服務時間)

設定 OA 的自動回覆服務時間。

功能：
- 設定多個時段（星期幾 + 起迄時間）
- 服務時間外：可設定自動回覆訊息（告知用戶目前非服務時間）
- 時區設定

### 7.4 Scheduled Messages (排程訊息)

預約發送訊息。

功能：
- 排程訊息列表：顯示狀態（待發送/已發送/已取消）
- 建立排程：選擇日期時間 + 編寫訊息內容
- 從 COL3 editor 的 Send ▾ dropdown 快速排程
- 可取消尚未發送的排程
- 支援所有訊息類型（文字、貼圖、圖片、模板等）

### 7.5 Custom Filters (自訂篩選) ★ Pro

進階聊天篩選功能（Pro 方案）。

功能：
- 建立自訂篩選條件（基於標籤、日期範圍、訊息內容等）
- 快速切換不同篩選視圖
- 存檔常用篩選器

### 7.6 Call (通話)

LINE 語音/視訊通話設定。

功能：
- 啟用/停用通話功能
- 通話記錄

---

## 8. HEADER 功能

```
┌──────────────────────────────────────────────────────────────────┐
│ [LINE OA Manager Logo]  │  OA 帳號切換器  │ Pro Badge │ 使用者區 │
│                         │                 │           │          │
│ 點擊連到 manager.      │  下拉選擇不同   │ 升級連結  │ 頭像+名  │
│ line.biz 該 OA 的管理  │  的 LINE OA     │           │ Help(❓) │
│ 頁面                    │  帳號           │           │          │
└──────────────────────────────────────────────────────────────────┘
```

- **OA Logo**：連到 `manager.line.biz/account/@{oaId}` 該 OA 的管理後台首頁
- **OA 帳號切換器**：若使用者管理多個 OA，可下拉切換
- **Pro badge**：帶鎖頭 icon，點擊可升級方案
- **使用者區**：顯示目前登入的使用者頭像與名稱 + Help 按鈕
- Help 按鈕點開為 dropdown，提供文件連結

---

## 9. 關鍵互動流程

### 9.1 開啟聊天

```
NAV "Chats" 點擊
  → COL2 顯示聊天列表
  → 點選任一聊天
    → COL3 載入該對話歷史訊息
    → COL4 顯示該用戶 profile (tags, notes, etc.)
    → URL 變更 (SPA routing)
```

### 9.2 發送訊息

```
在 COL3 editor 輸入文字
  → 按 Enter (或點 Send 按鈕)
  → 訊息發送至 Messaging API
  → 訊息立即顯示在 COL3 message area (optimistic UI)
  → 輸入框清空
```

### 9.3 排程訊息

```
在 COL3 editor 輸入文字
  → 點擊 Send ▾ → "Schedule..."
  → ScheduledMessageDropdown 彈出
  → 選擇日期 + 時間
  → 確認排程
  → 排程儲存至伺服器
  → 可從 COL1 > Settings > Scheduled messages 查看管理
```

### 9.4 發送貼圖

```
點擊 COL3 editor 😊 按鈕
  → Sticker picker popover 彈出
  → 瀏覽/搜尋 sticker packages
  → 點選貼圖
  → 貼圖發送 (sticker message type)
```

### 9.5 發送 Rich Message

```
點擊 COL3 editor ➕ 按鈕
  → Template selector 彈出
  → 選擇模板類型 (Buttons / Carousel / Confirm / Image Carousel / Flex)
  → 配置模板內容 (JSON editor 或 GUI wizard)
  → 預覽
  → 發送
```

### 9.6 用戶管理

```
在 COL2 或 COL4 操作:
  → COL4 kebab menu (⋮): View profile / Block / Report / Add note
  → COL4 Tags 區: 新增/移除標籤
  → COL4 Notes 區: 編輯備註
  → 所有變更立即儲存
```

### 9.7 群發訊息 (Messaging multiple users)

```
NAV "Messaging multiple users" 點擊
  → COL2 + COL3 切換為群發編輯器
  → 選擇目標受眾 (全部好友 / 特定標籤 / 自訂篩選)
  → 編寫訊息
  → 預覽
  → 發送 (或排程)
  → 查看發送統計
```

---

## 10. 路由結構 (推測)

基於 SPA routing 行為：

```
/chat                          → Chats 列表 (COL2=列表, COL3=空)
/chat/:chatId                  → 特定聊天室 (COL3=訊息, COL4=用戶資訊)
/contacts                      → 聯絡人管理
/multi-message                 → 群發訊息編輯器
/settings/basic                → 基本設定
/settings/tags                 → 標籤管理
/settings/standard-replies     → 罐頭回覆管理
/settings/response-hours       → 服務時間設定
/settings/call                 → 通話設定
/settings/scheduled-messages   → 排程訊息列表
/settings/custom-filters       → 自訂篩選器 (Pro)
```

---

## 11. 技術細節

### 11.1 前端架構
- **Framework**: Vue.js SPA (從 `vue.C0ki36MB.js` chunk 判定)
- **CSS library**: Koromo (LINE 自訂 CSS framework, `koromo.css`)
- **Icon sets**: Font Awesome Pro 5.11, Laicon (LINE 自訂 icon set), Flag Icon CSS
- **Date handling**: blueimp-load-image, @linecorp.line-image-resizer (圖片處理)
- **Carousel**: Swiper.js (模板 carousel 渲染)
- **Module bundler**: Vite (從 `type="module"` script 判定)
- **Error tracking**: Sentry

### 11.2 相關 Messaging API Endpoints

| 功能 | Endpoint |
|---|---|
| 發送訊息 | `POST /v2/bot/message/push` |
| 回覆訊息 | `POST /v2/bot/message/reply` |
| 取得用戶 profile | `GET /v2/bot/profile/{userId}` |
| 建立 rich menu | `POST /v2/bot/richmenu` |
| 上傳 rich menu 圖片 | `POST /v2/bot/richmenu/{richMenuId}/content` |
| 設定預設 rich menu | `POST /v2/bot/user/all/richmenu/{richMenuId}` |
| 連結 per-user rich menu | `POST /v2/bot/user/{userId}/richmenu/{richMenuId}` |
| 顯示 loading animation | `POST /v2/bot/chat/loading/start` |
| 取得訊息統計 | `GET /v2/bot/insight/message/event` |

---

## 12. 與 Vine 現有功能的對照

> **注意：此段僅供 Vine 開發團隊內部參考，非 LINE OA Chat 原生功能。**

| LINE OA CRM | Vine 現有 |
|---|---|
| 4-column PC layout | 目前 manager 為單欄 mobile-first |
| OA chat room (以 OA 視角) | 有 `[chatId].tsx` 但為 user 視角，不是 OA 管理視角 |
| Sticker picker | 無 |
| Rich Message template selector | 無（有 Rich Menu 管理但概念不同） |
| Scheduled messages | 無 |
| Standard replies (罐頭回覆) | 無 |
| Tags for users | 無 |
| Response hours | 無 |
| Quick Reply (在訊息下方) | 有 QuickReplyBar (解析 metadata 顯示) |
| Rich Menu (聊天室底部選單) | 有 RichMenu + RichMenuBar (顯示/互動) |
| Loading animation (OA 打字中) | 有 chatOaLoading (自己實作的 typing indicator) |
| User profile panel (COL4) | 無 |
| Contact list 管理 | 無 |
| 群發訊息 | 無 |
