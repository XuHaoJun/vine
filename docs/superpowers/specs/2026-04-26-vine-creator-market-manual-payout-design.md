# Vine Creator Market — Manual Payout (Phase 2.5) Design

> **Slice scope**: Add the minimum payout workflow needed after Phase 2B sales reporting: creators can request bank-transfer payouts, and Vine operations can review requests, export a batch file, manually transfer funds, and record results.
>
> **Upstream roadmap**: [`docs/vine-creator-market-roadmap.md`](../../vine-creator-market-roadmap.md)
> **Product spec**: [`docs/vine-creator-market-spec.md`](../../vine-creator-market-spec.md), §8.4 and §9.
> **UI/UX reference**: [`docs/vine-creator-market-uiux.md`](../../vine-creator-market-uiux.md), C8 and C9 only.
> **Previous phase**: [`2026-04-26-vine-creator-market-sales-reporting-design.md`](./2026-04-26-vine-creator-market-sales-reporting-design.md)

---

## 1. Goals And Success Criteria

### 1.1 Problem

Phase 2B shows creators their estimated sales and revenue, but it does not create a payable balance or a reliable operations workflow for sending money out. Automatic Stripe payouts through `hyperswitch-prism` are not dependable enough for the first Phase 2.5 slice, and adding a live payout connector now would couple the product flow to an external capability that may change.

Phase 2.5 therefore ships manual payout first: Vine keeps a private settlement ledger, lets creators request a payout, lets admins approve and batch requests, exports a CSV file for bank transfer, and records whether each transfer was paid, rejected, or failed.

### 1.2 Success Criteria

This slice is complete when:

1. A creator can open `/creator/payouts` and see available net payout balance, bank account summary, tax status, and payout history.
2. A creator can create or replace their active bank-transfer payout account from the payout/settings flow.
3. Creator UI shows only bank name and account last four digits after save; it never echoes the full bank account number back to the client.
4. A creator can request payout only when the available net amount meets the minimum threshold.
5. Admins can list pending payout requests, approve or reject them, and provide rejection reasons.
6. Admins can create a payout batch from approved requests and export a CSV file containing full bank account data.
7. Admins can mark each exported request as paid or failed with a bank transaction ID or failure reason.
8. Payout state transitions are auditable.
9. The design leaves a clear executor boundary so a future Stripe payout integration can replace only the manual transfer step.

---

## 2. Non-Goals

Phase 2.5 explicitly does not include:

- Automatic Stripe payouts.
- Hyperswitch Payout API execution.
- PayPal or wallet payouts.
- Live bank account verification.
- Live bank transfer status polling.
- Automatic retry of failed bank transfers.
- Native tax filing or official annual tax form generation.
- Multi-currency settlement. Current sticker orders and first payout ledger are `TWD`.
- Any LINE Developers, LINE Login, or `api.line.me` integration.

---

## 3. Chosen Approach

Use a private manual payout ledger and admin batch workflow.

User payments remain unchanged: buyers pay through the existing sticker market payment flow, and `stickerOrder` remains the source for paid/refunded order facts. Phase 2.5 adds a settlement layer that turns closed monthly sales into creator payout ledger rows, then turns eligible ledger rows into payout requests and admin payout batches.

The first executor is manual export. The system generates a CSV file containing full bank account details, operations performs the transfer in a bank or payment portal, and operations records the result back in Vine.

This is intentionally operational instead of connector-driven. It reduces integration risk, preserves auditability, and keeps creator-facing UX stable if Vine later adds an automated payout executor.

---

## 4. Data Model

All payout tables live in the private database schema. Payout account data is not synced through Zero.

### 4.1 Payout Account

`creatorPayoutAccount` stores the creator's active bank transfer destination.

Required fields:

- creator ID
- legal recipient name / account holder name
- bank code
- bank name
- branch name
- full bank account number
- account last four digits
- currency
- active/disabled status

Privacy rule:

```text
creator UI: bank name + accountLast4 only
admin export: full account number included
server/database: full account number stored in private schema only
```

Update rule:

```text
creator submits full bank form
  -> server disables any existing active account
  -> server inserts a new active payout account
  -> server returns only bank name + accountLast4
```

Replacing the account is safer than mutating the existing row because already-created payout requests keep their `payoutAccountId` snapshot. Requests created before a bank update still export the account selected at request time; new requests use the new active account.

### 4.2 Payout Ledger

`creatorPayoutLedger` stores the monthly settlement result per creator.

Required fields:

- creator ID
- settlement month as `YYYY-MM`
- currency
- gross amount
- refunded amount
- platform fee
- creator share
- tax withholding
- transfer fee
- net payable amount
- status

Ledger status:

| Status | Meaning |
| --- | --- |
| `available` | Reached settlement and can be requested. |
| `requested` | Included in a creator payout request. |
| `locked` | Included in an exported payout batch. |
| `paid` | Transfer recorded as paid. |
| `void` | Removed from payout flow by admin correction. |

### 4.2.1 Minimum Threshold

The product-level target remains equivalent to **USD $10**, but Phase 2.5 uses the current codebase's `TWD` order model. The initial implementation threshold is **NT$300**.

When Vine adds multi-currency settlement, this threshold can move to a currency-aware finance setting. Until then, creator UI and server validation should use `TWD` and avoid displaying USD payout amounts.

### 4.3 Payout Request

`creatorPayoutRequest` represents one creator request to receive available ledger balance.

A request can cover one or more available monthly ledger rows. The request stores a snapshot of gross amount, tax withholding, transfer fee, and net amount at request time so later CSV export does not need to recalculate historical amounts if ledger rules change.

Request status:

| Status | Creator text | Meaning |
| --- | --- | --- |
| `requested` | 審核中 | Creator submitted the request. |
| `approved` | 已核准 | Admin approved it for batching. |
| `exported` | 已排入匯款批次 | Request is locked in a batch file. |
| `paid` | 已匯款 | Admin recorded transfer success. |
| `rejected` | 退件 | Admin rejected before transfer. |
| `failed` | 匯款失敗 | Bank/manual transfer failed after export. |

Only `requested` requests can be approved or rejected. Only `approved` requests can enter a batch. Only `exported` requests can be marked paid or failed.

### 4.4 Payout Batch

`creatorPayoutBatch` groups approved requests for one operations transfer run.

Required fields:

- batch ID
- status
- created by user ID
- created at
- exported by user ID
- exported at
- paid at, if the whole batch is closed

Batch export is the manual payout executor for Phase 2.5.

### 4.5 Audit Event

`creatorPayoutAuditEvent` records who performed every payout-sensitive action:

- request created
- request approved
- request rejected
- batch created
- batch exported
- request marked paid
- request marked failed

Each event stores actor user ID, related request/batch IDs, action, timestamp, and a small JSON metadata payload.

---

## 5. Creator Flow

The creator payout page is `/creator/payouts`, matching UIUX C8.

The page shows:

- available net payout balance
- minimum threshold
- payout schedule: "每月 15–20 日人工匯款"
- bank transfer method with bank name and last four digits
- tax/KYC status summary
- estimated payout breakdown
- request payout CTA
- payout history

The same page owns bank account setup. If no active payout account exists, the page shows a bank-transfer form before the request CTA. If an account exists, the page shows the masked account summary and a "修改收款資訊" action that opens the same form.

Bank account form fields:

- legal recipient name / account holder name
- bank code
- bank name
- branch name
- full bank account number
- confirmation full bank account number

Validation:

- legal name, bank code, bank name, and account number are required
- account number confirmation must match
- account number is trimmed and accepted as digits plus common bank separators only
- server derives `accountLast4`; the client does not submit it
- saved response returns only `id`, `bankName`, and `accountLast4`

CTA behavior:

| Condition | Behavior |
| --- | --- |
| No active payout account | Disable request CTA and link to payout settings. |
| Tax/KYC incomplete | Disable request CTA and link to account settings. |
| Net amount below minimum | Disable request CTA and show minimum threshold. |
| Has pending/exported request | Disable request CTA and show current status. |
| Eligible | Submit payout request and move eligible ledger rows to `requested`. |

Creator history uses human-readable statuses from §4.3.

---

## 6. Admin Flow

Admin payout operations live in an admin route such as `/admin/payouts`.

The workflow:

1. List `requested` payout requests.
2. Review creator, ledger month, amount, bank summary, and KYC/tax status.
3. Approve or reject each request.
4. Create a payout batch from selected `approved` requests.
5. Export a CSV file.
6. Operations performs manual bank transfers outside Vine.
7. Admin records success with bank transaction ID and paid date, or records failure with a bank return reason.
8. Creator payout history updates and notification can be sent.

Export fields:

- batch ID
- payout request ID
- creator ID
- creator display name
- recipient legal name
- bank code
- bank name
- branch name
- full bank account number
- account last four digits
- currency
- gross amount
- tax withholding
- transfer fee
- net amount
- internal reference / memo

CSV is the required Phase 2.5 export format. It is dependency-free and can still be opened by spreadsheet tools when needed.

---

## 7. Service Boundaries

### 7.1 Repository

`payout.repository.ts` owns SQL access:

- payout overview reads scoped by authenticated creator
- payout account reads
- payout account replacement
- ledger reads and state updates
- request creation and state updates
- batch creation and export reads
- audit event inserts

The repository does not decide business transitions. It executes requested writes.

### 7.2 Service

`payout.service.ts` owns business rules:

- minimum threshold
- payout account validation and masking
- creator eligibility checks
- state transition validation
- amount totals
- export row shaping
- audit event creation

The service must not return full bank account numbers to creator-facing methods.

### 7.3 ConnectRPC

Creator service methods:

- `GetCreatorPayoutOverview`
- `UpsertCreatorPayoutAccount`
- `RequestCreatorPayout`

Admin service methods:

- `ListPayoutRequests`
- `ApprovePayoutRequest`
- `RejectPayoutRequest`
- `CreatePayoutBatch`
- `ExportPayoutBatch`
- `MarkPayoutPaid`
- `MarkPayoutFailed`

Creator handlers use `requireAuthData(ctx)`. Admin handlers require `auth.role === "admin"`.

---

## 8. Future Automation Boundary

Phase 2.5 should preserve a conceptual `PayoutExecutor` boundary:

```ts
type PayoutExecutor = {
  exportBatch(batchId: string): Promise<PayoutExportResult>
}
```

Initial executor:

```text
ManualPayoutExecutor -> returns CSV for operations
```

Future executor:

```text
StripePayoutExecutor -> sends approved batch items through hyperswitch-prism PayoutClient or Stripe Connect
```

The future executor must reuse the same ledger, request, batch, and audit tables. It should replace the batch execution step, not the creator request flow.

---

## 9. Error Handling

Creator-facing errors:

| Error | User-facing behavior |
| --- | --- |
| Missing payout account | Ask creator to add bank transfer information. |
| KYC/tax incomplete | Ask creator to complete Tier 2 setup. |
| Below minimum threshold | Show minimum threshold and current amount. |
| Existing active request | Show current request status instead of creating another request. |

Admin-facing errors:

| Error | Admin-facing behavior |
| --- | --- |
| Approve non-requested request | Show state conflict and refresh queue. |
| Batch non-approved request | Show state conflict and skip batch creation. |
| Export missing bank account | Block export and mark request needs review. |
| Mark paid without transaction ID | Require bank transaction ID. |
| Mark failed without reason | Require failure reason. |

---

## 10. Security And Privacy

Full bank account numbers are sensitive private data.

Rules:

1. Store full account numbers only in private server tables.
2. Do not add payout account data to Zero schema.
3. Do not expose full account numbers from creator RPCs.
4. Include full account numbers only in admin export responses.
5. Record audit events for every admin action that reads or changes payout execution state.
6. Do not log CSV export contents.
7. Do not commit exported payout files.

The first implementation can store account numbers as plain private DB values if the rest of the app has no encryption helper yet. If a server-side encryption helper already exists when implementation begins, use it for `accountNumber` while still keeping `accountLast4` queryable.

---

## 11. Testing Strategy

Unit tests:

- payout account validation, replacement, and masking
- state transition validation
- minimum threshold behavior
- creator overview masking
- CSV escaping
- mark paid/failed input validation

Integration tests:

- creator can read only their payout overview
- creator payout account upsert disables the previous active account
- full account number does not appear in creator methods
- admin export includes full account number
- request creation locks available ledger rows
- batch creation only accepts approved requests

ConnectRPC tests:

- non-admin users cannot call admin payout methods
- invalid creator requests map to `InvalidArgument` or domain errors
- admin state conflicts surface as clear errors

Manual QA:

1. Create creator profile, payout account, and available ledger.
2. Open `/creator/payouts`.
3. Confirm bank display uses only last four digits.
4. Request payout.
5. Approve as admin.
6. Create batch and download CSV.
7. Confirm CSV includes full account number.
8. Mark request paid and confirm creator history shows `已匯款`.

---

## 12. Open Tradeoffs Resolved

### CSV vs XLSX

Use CSV for Phase 2.5. Native XLSX is out of scope unless operations later requires it.

### Private DB vs Zero

Use private DB only. Payout accounts and payout execution state include sensitive financial data and admin-only operations, so Zero sync is the wrong default for Phase 2.5.

### Manual First vs Stripe Now

Use manual first. `hyperswitch-prism` can remain the future automation path, but Phase 2.5 should not block on Stripe payout support or test-mode connector behavior.

---

## 13. Implementation Handoff

The implementation plan is:

[`docs/superpowers/plans/2026-04-26-vine-creator-market-manual-payout.md`](../plans/2026-04-26-vine-creator-market-manual-payout.md)
