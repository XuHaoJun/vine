# Vine 創作者市集 — 實作 Roadmap

> 本文件回答:「既有 `vine-creator-market-spec.md` 範圍這麼大,要怎麼一步步做?」
>
> 與其他文件的關係:
> - [`vine-creator-market-spec.md`](./vine-creator-market-spec.md) — 完整系統規格(產品視角,全範圍)
> - [`vine-creator-market-uiux.md`](./vine-creator-market-uiux.md) — 完整 UI/UX wireframe(18 個頁面)
> - **本文件** — 把上述兩份規格拆成可以獨立實作、獨立上線的 phases
> - `docs/superpowers/specs/YYYY-MM-DD-*-design.md` — 每個 phase / slice 的詳細技術設計

---

## 1. 為什麼要分期

完整規格涵蓋 9 個彼此獨立的大型子系統,若一次設計 → 會產出上千行 spec、幾十個無序任務、任一環節 block 整個專案。以下把同一份規格**拆成能各自交付、依賴明確**的 phases。

### 子系統清單(對映 spec 章節)

| # | 子系統 | 對應 spec 章節 | 對應 uiux 頁面 |
|---|--------|--------------|---------------|
| A | 貼圖資料模型 + 資產儲存 | §2, §10.3 | (底層) |
| B | 創作者帳號 + KYC(Tier 1) | §3.1, §3.2, §3.3 | C9 |
| C | 貼圖上傳 + 審核流程 | §4, §5 | C1–C6 |
| D | 商店瀏覽 / 搜尋 / 詳情 | §6, §7.1, §11 | U1, U2, U3, U8 |
| E | 付款 — Hyperswitch / ECPay 整合 | §7.3, §8 | U4 |
| F | 購買後授權 + 聊天室整合 | §10 | U5, U6 |
| G | 銷售報表 + Payout + 稅務 | §9, §12 | C7, C8 |
| H | 追蹤創作者 + 推薦 + 評價 | §11 延伸 | U7, U8 延伸 |
| I | DMCA / 違規處理 / 治理 | §13, §14 | (後台) |

---

## 2. 分期總覽

### Phase 1 — MVP:付款閉環(✅ Completed 2026-04-25)

**目標**:驗證「用戶掏錢 → 貼圖可用」的端到端 pipeline,架構正確、風險清空。

- **包含子系統**:E(付款) + F 的最小版(聊天室可發 sticker)+ A 的極簡版(假資料)
- **不含創作者側** — 貼圖用 seed 假資料,沒有上傳、審核、Dashboard、Payout
- **成功標準**:用戶能在 store 頁點購買 → ECPay 付款 → 聊天室發送貼圖 → 對方看得到
- **詳細設計**:[`docs/superpowers/specs/2026-04-23-vine-creator-market-payments-mvp-design.md`](./superpowers/specs/2026-04-23-vine-creator-market-payments-mvp-design.md)
- **Implementation plan**:[`docs/superpowers/plans/2026-04-23-vine-creator-market-payments-mvp.md`](./superpowers/plans/2026-04-23-vine-creator-market-payments-mvp.md)
- **交付物**:`packages/pay`、`apps/server/src/services/payments`、`StickerMarketUserService`、`/webhooks/ecpay`、`stickerPackage` / `entitlement` / `stickerOrder` schema、Zero sticker queries、store / pay routes、chat sticker picker、seed sticker packages
- **完成 commit**:`a1109d6 feat: payments mvp (#16)`

---

### Phase 1.5 — 付款強化(✅ Completed 2026-04-25)

**目標**:把 Phase 1 暴露出的 payment edge case 補起來,讓付款層可以放心進 prod。

**詳細設計**:[`docs/superpowers/specs/2026-04-25-vine-creator-market-payments-hardening-design.md`](./superpowers/specs/2026-04-25-vine-creator-market-payments-hardening-design.md)
**實作計畫**:[`docs/superpowers/plans/2026-04-25-vine-creator-market-payments-hardening.md`](./superpowers/plans/2026-04-25-vine-creator-market-payments-hardening.md)

| 工作 | 動機 |
|---|---|
| Refund 能力 | 用戶付款成功但 entitlement grant 失敗的補償、用戶申訴退款 |
| 對帳 / reconciliation(日批) | 確保 Vine 的 order 狀態與 ECPay 端一致 |
| 接入 Sentry / alerting | MVP 只有 log,prod 需要主動告警(尤其金額不符、MAC 驗證失敗連續出現) |
| ECPay ATM / CVS 虛擬帳號 | 非即時付款的 webhook 語意、過期處理 |
| ECPay Apple Pay / LINE Pay via PSP | 擴大 payment method coverage |
| 第二個 connector(例:Stripe 信用卡) | 驗證 `PaymentsService` interface 真的是 connector-agnostic |

**不含**:創作者側,仍是假資料。

**完成 commit 範圍**:
- `6f32f32..fa0c754` (payments hardening branch)
- 關鍵 commits:
  - `6f32f32` feat(pay): add ecpay query and refund helpers
  - `6cfa8c0` feat(payments): add refund order state
  - `2596ee2` feat(payments): add refund orchestration
  - `91e9fd3` feat(payments): compensate failed entitlement grants
  - `175a5a3` feat(payments): add order reconciliation service
  - `730a72e` feat(payments): add admin refund rpc
  - `fa0c754` fix(payments): add reconcileStickerOrders tests, name constants, and format

---

### Phase 2 — 創作者側 MVP

**目標**:讓真實創作者能上架第一個貼圖組、拿到銷售報表。

- **包含子系統**:B(Creator + Tier 1 KYC)、C(上傳 + 最簡人工審核)、A 完整版(sticker 資料表、資產管線)、G 的最小版(銷售報表)
- **不含**:Payout、稅務、AI 輔助審核、申訴、多語系
- **依賴**:Phase 1 完成(付款 pipeline 已穩)

**關鍵工作**:
- `stickerPackage` schema 擴充(從 seed 演進到真 table) + `stickerAsset` 子表(keywords、stickerResourceType、依 spec §10.3)
- 創作者 Dashboard(`(app)/creator/...`,對映 uiux C1–C5)
- ZIP 上傳 + client-side 驗證(尺寸、奇偶像素、檔案大小)
- 審核狀態機(`Draft → In Review → Approved/Rejected → On Sale`),人工審核後台(`(app)/admin/...` 或類似)
- 拒絕通知(對映 uiux C6)
- Creator Tier 1 KYC(email 驗證 + 居住國家)
- 銷售報表(對映 uiux C7)

---

### Phase 2.5 — Payout + 稅務

**目標**:創作者能把錢領出來。

- **包含子系統**:G 完整(Payout、稅務)、B 延伸 Tier 2 KYC
- **依賴**:Phase 2 有真銷售數字可結算

**關鍵工作**:
- Hyperswitch Payout API 整合(prism 的 `PayoutClient`)
- 月結流程(對映 spec §9.2):每月 1 日結算 → 5 日寄報告 → 10 日可申請 → 15–20 日打款
- 最低門檻(USD $10)、上限($10,000)
- Tier 2 KYC:政府 ID、銀行帳戶驗證、W-8BEN(對映 uiux C9)
- 稅務預扣計算(依居住地)
- Payout 頁(對映 uiux C8)

---

### Phase 3 — 成長與發現

**目標**:讓商店不再只是「有能買」,而是用戶會主動逛、創作者會有曝光動機。

- **包含子系統**:D 完整(搜尋、篩選、精緻化)、H(追蹤 / 推薦 / 評價)
- **依賴**:Phase 2 有一批創作者 + 內容

**關鍵工作**:
- 商店首頁的推薦 + 策展後台(編輯精選)
- 熱銷榜(近 7/30 天銷售量)
- 搜尋 + 篩選(uiux U2)
- 追蹤創作者 + 新品通知(uiux U8)
- 評價與評分系統(含防刷)
- 多幣別顯示(USD / JPY / 其他,ECPay 仍限 TWD,換算僅顯示用)
- 個人化推薦(長期,依購買歷史)

---

### Phase 4 — 信任與治理

**目標**:處理真實上線後會出現的侵權、違規、詐欺。

- **包含子系統**:I(DMCA / 申訴 / 違規)、C 的 AI 審核輔助
- **依賴**:Phase 2 上線一段時間、累積 edge case

**關鍵工作**:
- DMCA 投訴表單 + 48h 暫時下架流程(對映 spec §13.3)
- Counter Notice(反駁)機制
- 違規處分層級(警告 / 下架 / 暫停 / 終止,對映 spec §14.1)
- 分潤凍結(暫停期間累積不可提領)
- 申訴流程(5 工作天回覆)
- AI 輔助審核(降低人工成本,對映 spec §5.2)
- 年度稅務憑證自動生成

---

## 3. 依賴圖

```
        ┌─────────────────────────┐
        │ Phase 1  付款閉環 MVP   │  ✅ Completed 2026-04-25
        │   E + F 最小 + A 假資料 │
        └───────────┬─────────────┘
                    │
        ┌───────────▼─────────────┐
        │ Phase 1.5  付款強化     │  ← 現在
        │   Refund, Sentry, 對帳   │
        └───────────┬─────────────┘
                    │
        ┌───────────▼─────────────┐
        │ Phase 2  創作者 MVP     │
        │   B + C + A 完整 + G 最小│
        └───────────┬─────────────┘
                    │
        ┌───────────▼─────────────┐
        │ Phase 2.5  Payout 稅務  │
        │   G 完整 + B Tier 2     │
        └───────────┬─────────────┘
                    │
           ┌────────┴────────┐
           ▼                 ▼
   ┌──────────────┐  ┌──────────────┐
   │ Phase 3 成長 │  │ Phase 4 治理  │
   │   D + H      │  │   I + AI 審核 │
   └──────────────┘  └──────────────┘
   (可並行,依資源)
```

**硬依賴**:
- Phase 2 需要 Phase 1(付款已穩),否則創作者上架也賣不出去
- Phase 2.5 需要 Phase 2(有真實銷售才能結算)
- Phase 3/4 需要 Phase 2 以上(有真內容才能推薦 / 治理)

**軟依賴**:
- Phase 1.5 可以延後到 Phase 2 啟動前完成,不必立刻做
- Phase 3 與 4 內部子項可重排

---

## 4. 已完成 slice(Phase 1)詳細範圍

以下只給摘要,完整設計見 [2026-04-23 payments MVP design](./superpowers/specs/2026-04-23-vine-creator-market-payments-mvp-design.md)。

### 做什麼

- 新增 `packages/pay`(Vine 自家統一付款抽象,封裝 `@xuhaojun/hyperswitch-prism`)
- `apps/server` 新增 `services/payments`、ConnectRPC `StickerMarketUserService`、`/webhooks/ecpay`
- `packages/db` 新增 `stickerPackage` / `entitlement`(public)+ `stickerOrder`(private)
- `packages/zero-schema` 暴露 `stickerPackage`、`entitlement`(僅自己)
- `apps/web` 新增 `(app)/store/*`、`(app)/pay/redirect`、`(app)/pay/result`
- 聊天室 MessageInput 加 sticker picker,MessageBubble 渲染 sticker
- `ensureSeed` 擴充 3 個假 package + 25 張 fixture PNG

### 不做什麼

見 [design spec §9 非目標清單](./superpowers/specs/2026-04-23-vine-creator-market-payments-mvp-design.md#9-mvp-明確-out-of-scope)。

### 交付後,下一刀會是什麼

**預設下一刀 = Phase 1.5 Refund**,理由:

1. Phase 1 上線後,**第一個碰到的真實問題幾乎一定是「付了沒授權」或「用戶想退款」** — 這是 payment edge case,不是產品問題
2. Refund 的 code 路徑與 authorize 對稱,設計還熱、實作最便宜
3. Refund 完成後,`packages/pay` 就接近 prod-ready 的狀態,再上 Phase 2 把創作者拉進來才不會踩共同 bug

替代選擇:如果 Phase 1 上線後**沒有明顯 payment pain**,可以跳 Phase 1.5 直接進 Phase 2(創作者 MVP),讓產品團隊先證實創作者願意上架。Payout 時才會強制要求 refund 等能力完備 — 屆時 Phase 1.5 項目可以併進 Phase 2.5 一起做。

---

## 5. 如何更新本文件

每完成一個 phase:
1. 在對應 phase 節點加註「✅ Completed YYYY-MM-DD,交付物:xxx」
2. 更新 Phase 1 詳細範圍段落指向最新 slice
3. 如有學到新東西導致後續 phase 重排,直接改依賴圖與順序 — 此文件不是契約,是活的規劃

---

*最後更新:2026-04-25*
