---
name: zero-schema-migration
description: |
  Zero schema 遷移流程 - 當你有新欄位要加入現有的 Zero 同步資料表（chatMember、message 等），
  或是 DB 有 schema change 需要同步到 Zero 時使用。

  觸發時機：有人提到 zero schema 變更、新增 column 到現有 table、
  migration、zero:generate、publication rebuild，或是任何與 Zero 欄位同步相關的話題。
  即使沒有人明確說「我要做 migration」，只要看到有新增欄位的需求，就應該主動觸發此 skill。

  如果需要 Zero 的一般背景知識（如 model 結構、mutation 用法、查詢方式），請同時參考
  「zero」 skill。
---

# Zero Schema Migration

## 為什麼要走這套流程

當你在 Postgres 新增一個 column（例如 `ALTER TABLE ADD COLUMN oaId`），
這個欄位**不會自動被 Zero 的 publication 包含**。必須重建 publication，
否則 Zero server 不知道這個欄位，clients 會因为 `SchemaVersionNotSupported` 而無法同步。

## 標準流程

### Step 1: 確認 DB 現有的 schema

在動任何 code 之前，先確認該 column 確實存在於 DB：

```bash
docker compose exec db psql -U postgres -d vine -c "\d <table_name>"
```

例如：
```bash
docker compose exec db psql -U postgres -d vine -c "\d chatMember"
```

### Step 2: 建立 Drizzle migration

```bash
cd packages/db
npx drizzle-kit generate --name <migration_name>
# 例如：npx drizzle-kit generate --name 20260404120719_oa_platform
```

然後編輯產生的 migration 檔案，確認 `ALTER TABLE` 語句正確。

### Step 3: 套用 migration 到 DB

```bash
bun run migrate
# 或 docker compose run --rm migrate
```

### Step 4: 更新 Zero model

在 `packages/zero-schema/src/models/<table_name>.ts` 中加入新欄位：

```typescript
// 例如 chatMember.ts
export const chatMember = z.object({
  // ... 現有欄位 ...
  oaId: z.string().optional(),  // 新增
})
```

### Step 5: 執行 zero:generate

```bash
cd apps/web
bun zero:generate
```

這會重新產生 `packages/zero-schema/src/generated/` 下的型別檔案。

### Step 6: 重建 Zero publication

```bash
docker compose run --rm migrate
```

`migrate` job 會呼叫 `ensureZeroPublication()`，它會：
1. Drop 現有的 `zero_takeout` publication
2. 用 `CREATE PUBLICATION zero_takeout FOR ALL TABLES` 重建
3. 確保所有目前存在的 columns 都會被包含

### Step 7: 重啟 Zero server

```bash
docker compose restart zero
docker compose restart backend
```

### Step 8: 驗證

1. 確認 clients 可以連線並同步資料（打開 app，檢查網路 tab）
2. 如果有問題，檢查 `docker compose logs zero` 是否有 `SchemaVersionNotSupported` 錯誤
3. 確認新 column 有出現在 clients 的 zero schema 中

## 重要規則

- **千萬不要**跳过 `docker compose run --rm migrate`（publication rebuild 步驟）
- 如果只有 client-side model 改變但 DB 沒有變，不需走這套流程
- Zero 的 `change-source` 會自動廣播 `add-column` 協議給 clients，所以不需要一個個重啟 client

## 快速檢查清單

出問題時，用這個順序檢查：

1. [ ] DB 有那個 column 嗎？ `\d <table>`
2. [ ] Zero model 有那個欄位嗎？ `packages/zero-schema/src/models/<table>.ts`
3. [ ] `bun zero:generate` 有跑過嗎？
4. [ ] `docker compose run --rm migrate` 有跑過嗎？（重建 publication）
5. [ ] Zero server 和 backend 有重啟嗎？
6. [ ] 如果還是爛，砍掉 `zero.db` 強制重新初始化：
   ```bash
   rm apps/web/zero.db
   docker compose restart zero
   docker compose restart backend
   ```

## 參考檔案

- `packages/db/src/migrate.ts` — `ensureZeroPublication()` 實作
- `packages/zero-schema/src/models/` — Zero model 定義
- `packages/zero-schema/src/generated/` — 產生的型別（zero:generate 後更新）
