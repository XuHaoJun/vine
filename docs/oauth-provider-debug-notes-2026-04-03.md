# OAuth Provider Debug Notes

**Date:** 2026-04-03

## Summary

這次 debug 的主線不是單一 bug，而是一串互相放大的問題：

1. OAuth login 進到 `/auth/login` 後，原本授權流程的 query 參數會被 One 很快清掉。
2. login 成功後如果沒有保住原始 authorize target，就會 fallback 到 `/home/feed`。
3. consent page 一開始又假設 `consent_code` 是可 decode 的 payload，但真實 flow 給的是 opaque code。
4. integration tests 一部分在測「真正的 OAuth 行為」，一部分卻不小心綁死在容易重排的 UI 細節上，導致整包 `bun run test --force` 看起來像是隨機壞掉。

最後的結論是：問題同時存在於 app flow 和 test design，兩邊都需要修。

---

## Symptoms

最常見的表現有三種：

- `bun run test --force` 有時全綠，有時卡在 `apps/web/src/test/integration/oauth-consent.test.ts`
- OAuth consent 相關測試失敗時，預期應該停在 `/auth/consent`，實際卻跑到 `/home/feed`
- Playwright 錯誤常長這樣：

```txt
Expected pattern: /\/auth\/consent/
Received string: "http://localhost:8081/home/feed"
```

或：

```txt
Locator: getByRole('button', { name: 'Allow' })
Expected: visible
Error: element(s) not found
```

---

## Root Causes

## 1. Login page lost OAuth continuation state

`apps/web/app/(app)/auth/login.tsx` 原本在登入完成後直接導去 `/home/feed`。  
這對一般登入沒問題，但對 OAuth authorize flow 是錯的，因為 consent page 需要在 login 後繼續原本那條授權流程。

更麻煩的是，One 會在 `/auth/login?...` 初始進頁後，把 query 很快 replace 掉，所以如果 redirect target 不是「一進頁就 snapshot」，後面就再也拿不到了。

### 關鍵教訓

- 不要假設 login submit 時 `window.location.search` 還保留原始 OAuth 參數
- 對這種「會被 router 清掉」的 query，應該在最早時機 snapshot 到 sessionStorage

---

## 2. consent-details endpoint decoded the wrong thing

`apps/server/src/plugins/auth.ts` 裡的 `/api/auth/oauth2/consent-details` 一開始把 `consent_code` 當成 base64url JSON 來 decode。

這個假設只對某些 mock / conceptual flow 成立，對真實 Better Auth OAuth flow 不成立。實際拿到的是 opaque code。

結果是：

- frontend 進到 consent page
- page 立刻呼叫 `consent-details`
- server 回 `400 Invalid consent_code`
- consent page metadata / UI 狀態變得不穩，進一步放大 flaky

### 修正方向

- server 優先信任 query string 已經帶上的 `client_id` / `scope`
- 只有在這些資料缺失時，才嘗試 decode `consent_code`
- decode 失敗時不直接視為整個 request invalid

---

## 3. Auth route guard was correct in spirit, but too easy to race against

`apps/web/app/(app)/_layout.tsx` 會把已登入使用者從 guest-only auth routes 導去 `/home/feed`。  
這個想法本身是對的，但 OAuth flow 有兩個例外：

- `/auth/consent`
- `/auth/oauth-callback`

另外，當使用者正處於 `/auth/login` 但其實是 OAuth continuation 時，也不能被當成普通 login page 處理。

### 修正方向

- 保留 `/auth/consent`、`/auth/oauth-callback`
- 對 `/auth/login` 額外檢查是否存在 pending OAuth continuation target
- guest-only redirect 只能套在真正的 guest-only routes 上

---

## 4. The final flaky was in the tests, not only the app

到後面最頑固的問題其實不是功能壞掉，而是 `oauth-consent` integration tests 把「UI render timing」跟「OAuth correctness」綁在一起。

例如：

- `clicking Allow redirects ...`
- `authorization code exchanges for token and userinfo`

這類測試真正想驗證的是：

- consent flow 是否能繼續
- auth code 是否能拿到
- token / userinfo 是否正常

但如果先硬等 consent page 上的 `Allow` button 可見，測試就會被 page 瞬時重排影響，造成看似「OAuth 壞了」，實際上只是 UI 尚未穩定。

### 修正策略

- 專門驗 redirect preservation 的 test，才去測 login -> consent UI 導航
- allow / cancel / token tests 一旦已經拿到 consent URL，就直接在 page context 裡用同一個 cookie session `fetch` consent endpoint
- render test 只驗 stable signals，例如：
  - 確實到達 `/auth/consent`
  - `client_id`
  - `consent_code`
  - `scope`

這樣功能測試和 UI timing 測試就不會互相污染

---

## Debugging Timeline

這次最有價值的幾個 debug 轉折如下：

1. 先確認 `889ebfdcff65c154e3c3983d02da08e53608dc0f` 是已知 good commit，證明問題是後續變更引入的
2. 觀察失敗輸出，發現 consent 相關 case 常常落到 `/home/feed`
3. 用 Playwright / browser script 直接觀察 `/auth/login?...` 的 query 何時消失，確認 One 會在數百毫秒內清掉參數
4. 把 login redirect target 改成 snapshot + persistence
5. 追 consent page 的 network，發現 `/api/auth/oauth2/consent-details` 回 `400 Invalid consent_code`
6. 修正 server 端 `consent-details` 的資料來源假設
7. 最後用 `--repeat-each 3` 重跑關鍵整測，找出殘留 flaky 其實來自 test helper 本身

---

## What Ended Up Changed

### App behavior

- `apps/web/app/(app)/auth/login.tsx`
  - 保留 OAuth continuation target，而不是登入後一律 `/home/feed`
- `apps/web/app/(app)/auth/consent.tsx`
  - 使用 server metadata endpoint
  - 保留 consent query state
- `apps/web/app/(app)/_layout.tsx`
  - 只對真正 guest-only routes 套用 logged-in redirect
- `apps/server/src/plugins/auth.ts`
  - `consent-details` 改為優先使用 query 中的 `client_id` / `scope`

### Test behavior

- `apps/web/src/test/integration/oauth-consent.test.ts`
  - 分離 UI navigation assertions 和 OAuth correctness assertions
  - allow / cancel / token 測試改用同頁 session 直接送 consent
  - render test 改驗穩定訊號，不綁死在易重排的 UI 細節

---

## Useful Commands

這幾個命令在這次 debug 特別有用：

```bash
# 重跑整包
bun run test --force

# 只跑最相關的 integration tests
bun run env:dev bun --cwd=./src/test playwright test integration/oauth-consent.test.ts integration/login-page.test.ts

# 重複跑以抓 flaky
bun run env:dev bun --cwd=./src/test playwright test integration/oauth-consent.test.ts integration/login-page.test.ts --repeat-each 3
```

---

## Lessons Learned

### 1. Router-managed query params are not durable state

如果某段流程真的依賴 query，尤其是 OAuth / callback / handoff 類型，不要把 query 本身當 source of truth。  
應該在最早時機 snapshot 成 local state、sessionStorage，或 server-side state。

### 2. “Looks like an app bug” and “looks like a flaky test” can both be true

前半段的確是 app flow 有 bug。  
後半段則是 app 修好後，tests 仍然過度綁定 UI timing。  
兩者如果不拆開，會一直互相掩護。

### 3. OAuth tests should prefer protocol-level assertions over fragile UI waits

真正重要的是：

- authorize -> consent continuation 有沒有保住
- consent submit 後 redirect 是否正確
- token / userinfo 是否可用

不是每次都要驗按鈕在某一瞬間已經 render。

### 4. Reproduction quality matters more than number of guesses

這次最有效的做法不是一直改碼，而是：

- 抓 page snapshot
- 抓實際 URL
- 抓 network response
- 重跑 `--repeat-each`

只要證據足夠，根因通常會很快浮出來。

---

## Current Status

在這份筆記落地時，以下驗證已通過：

```bash
bun run env:dev bun --cwd=./src/test playwright test integration/oauth-consent.test.ts integration/login-page.test.ts --repeat-each 3
bun run test --force
```

如果未來 OAuth tests 再次出現 flaky，建議先從這三個方向檢查：

1. `/auth/login` 是否又在 query 被清掉後丟失 continuation target
2. `/api/auth/oauth2/consent-details` 是否又假設了錯誤的 `consent_code` 格式
3. 測試是否又把 UI timing 當成 OAuth correctness 的必要條件
