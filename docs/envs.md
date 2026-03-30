# Environment Variables

## 架構概覽

```
[Browser / Mobile App]
        │
        │  VITE_API_URL (prod) / Vite proxy (dev)
        ▼
[Fastify API Server]  ←── apps/server (port 3001)
        │
        ├── /api/auth/*   (Better Auth)
        └── /api/zero/*   (Zero push/pull)

[Zero Sync Server]  ←── Docker (port 4948)
        │
        │  ZERO_MUTATE_URL / ZERO_QUERY_URL
        └──────────────────────────────────▶ [Fastify API Server]

[PostgreSQL]  ←── Docker (port 5533)
```

---

## Dev vs Prod 差異

| 項目 | Dev | Prod |
|------|-----|------|
| 前端 API 路由 | Vite proxy 轉發 `/api/*` 到 localhost:3001 | 瀏覽器直連 `VITE_API_URL` |
| CORS | `origin: true`（接受全部） | `ALLOWED_ORIGIN` 限制特定 domain |
| 前端 host | One dev server (port 8081) | S3 / CDN |
| Zero sync server | Docker (port 4948) | 獨立部署，設定 `VITE_ZERO_HOSTNAME` |
| DB | localhost:5533 (Docker) | 雲端 PostgreSQL |

---

## Fastify API Server（`apps/server`）

| 變數 | Dev 預設 | Prod 必填 | 說明 |
|------|----------|-----------|------|
| `PORT` | `3001` | 建議設定 | Fastify 監聽 port |
| `BETTER_AUTH_URL` | `http://localhost:3001` | ✅ | Better Auth 用於生成 redirect URL、magic link 等，必須填 prod API 的公開 URL |
| `BETTER_AUTH_SECRET` | `.env.development` 有預設值 | ✅ | JWT 簽名 secret，prod 必須換成強隨機字串 |
| `ZERO_UPSTREAM_DB` | `postgresql://user:password@127.0.0.1:5533/postgres` | ✅ | 主資料庫連線字串 |
| `ZERO_CVR_DB` | `postgresql://user:password@127.0.0.1:5533/zero_cvr` | ✅ | Zero CVR 資料庫 |
| `ZERO_CHANGE_DB` | `postgresql://user:password@127.0.0.1:5533/zero_cdb` | ✅ | Zero Change 資料庫 |
| `ALLOWED_ORIGIN` | 未設定（接受所有） | ✅ | 允許的前端 origin，例如 `https://app.yourdomain.com`，不設定則允許所有 |
| `DEMO_EMAIL` | `demo@takeout.tamagui.dev` | 選填 | Demo 帳號 email，用於 afterCreateUser 自動設定 username |

---

## Web 前端（`apps/web`）

> `VITE_` 前綴的變數會在 **build 時** bake 進 bundle，runtime 無法更改。

| 變數 | Dev 預設 | Prod 必填 | 說明 |
|------|----------|-----------|------|
| `VITE_API_URL` | 未設定（走 Vite proxy） | ✅ | Fastify API server 的公開 URL，例如 `https://api.yourdomain.com`。**不設定則前端無法連到 API** |
| `VITE_ZERO_HOSTNAME` | 未設定（`localhost:4948`） | ✅ | Zero sync server hostname，例如 `zero.yourdomain.com`（不含 protocol） |
| `VITE_WEB_HOSTNAME` | 未設定 | 選填 | 前端 hostname，目前未使用於關鍵邏輯 |

---

## Zero Sync Server（Docker）

Zero server 由 Docker Compose 啟動，透過以下變數回呼 Fastify：

| 變數 | Dev | Prod 必填 | 說明 |
|------|-----|-----------|------|
| `ZERO_MUTATE_URL` | `http://localhost:3001/api/zero/push` | ✅ | Zero 呼叫 Fastify mutation handler 的 URL |
| `ZERO_QUERY_URL` | `http://localhost:3001/api/zero/pull` | ✅ | Zero 呼叫 Fastify query handler 的 URL |
| `ZERO_UPSTREAM_DB` | 同 Fastify | ✅ | 主資料庫（Zero 直連讀取） |
| `ZERO_CVR_DB` | 同 Fastify | ✅ | Zero CVR 資料庫 |
| `ZERO_CHANGE_DB` | 同 Fastify | ✅ | Zero Change 資料庫 |
| `ZERO_VERSION` | 自動從 `@rocicorp/zero` 版本取得 | ✅ | Zero Docker image tag |
| `ZERO_ADMIN_PASSWORD` | `dev` | ✅ | Zero admin API 密碼，prod 必須換強密碼 |
| `ZERO_APP_PUBLICATIONS` | `zero_takeout` | 選填 | PostgreSQL publication 名稱 |
| `ZERO_NUM_SYNC_WORKERS` | `2` | 選填 | Sync worker 數量 |
| `ZERO_CVR_MAX_CONNS` | `4` | 選填 | CVR DB 最大連線數 |
| `ZERO_UPSTREAM_MAX_CONNS` | `10` | 選填 | Upstream DB 最大連線數 |
| `ZERO_LOG_LEVEL` | `warn` | 選填 | Log 等級：`debug`/`info`/`warn`/`error` |

---

## Prod 上線 Checklist

### 必填（缺一不可）
- [ ] `BETTER_AUTH_SECRET` — 換成新的強隨機字串（`openssl rand -base64 32`）
- [ ] `BETTER_AUTH_URL` — Fastify 公開 URL（`https://api.yourdomain.com`）
- [ ] `VITE_API_URL` — **build 時**設定，同上（`https://api.yourdomain.com`）
- [ ] `VITE_ZERO_HOSTNAME` — **build 時**設定，Zero server hostname（`zero.yourdomain.com`）
- [ ] `ZERO_UPSTREAM_DB` / `ZERO_CVR_DB` / `ZERO_CHANGE_DB` — 雲端 PostgreSQL 連線字串
- [ ] `ZERO_MUTATE_URL` / `ZERO_QUERY_URL` — 指向 prod Fastify URL
- [ ] `ZERO_ADMIN_PASSWORD` — 換成強密碼
- [ ] `ALLOWED_ORIGIN` — 前端 S3/CDN domain（`https://app.yourdomain.com`）

### 選填但建議設定
- [ ] `DEMO_EMAIL` — 若 prod 不需要 demo 帳號可忽略
- [ ] `ZERO_NUM_SYNC_WORKERS` / `ZERO_CVR_MAX_CONNS` / `ZERO_UPSTREAM_MAX_CONNS` — 依流量調整
