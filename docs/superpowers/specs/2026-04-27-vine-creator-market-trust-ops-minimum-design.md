# Vine Creator Market — Trust Ops Minimum (Phase 4A) Design

> **Slice scope**: Add the minimum trust-and-safety operations layer needed before MVP / Public Beta: logged-in user reports, admin report triage, forced package removal/restore, creator-level payout holds, and audit history.
>
> **Upstream roadmap**: [`docs/vine-creator-market-roadmap.md`](../../vine-creator-market-roadmap.md)
> **Product spec**: [`docs/vine-creator-market-spec.md`](../../vine-creator-market-spec.md), §13 and §14 as future reference only.
> **Previous phase**: [`2026-04-26-vine-creator-market-growth-discovery-design.md`](./2026-04-26-vine-creator-market-growth-discovery-design.md)

---

## 1. Goals And Success Criteria

### 1.1 Problem

Phases 1 through 3 make creator stickers purchasable, usable, payable, and discoverable. That is enough for a marketplace beta, but it leaves operations without a safe way to react when users report infringement, prohibited content, or fraud.

Phase 4A intentionally does not build a full legal workflow. It adds a small manual safety valve: logged-in users can report a package, admins can review the report, remove or restore packages, hold or clear creator payouts, and every sensitive action is auditable.

### 1.2 Success Criteria

This slice is complete when:

1. A logged-in user can report a sticker package from the package detail page.
2. Admins can list and inspect trust reports with package and creator context.
3. Admins can force remove and restore sticker packages with required reasons.
4. Removed packages disappear from store discovery, search, recommendations, shelves, and checkout.
5. Existing owners can still use removed packages in chat through their existing entitlements.
6. Admins can place and clear a creator-level payout hold.
7. Held creators cannot create payout requests or receive payout-forward admin transitions.
8. Trust report and payout-hold actions are admin-only and auditable.

---

## 2. Non-Goals

Phase 4A explicitly does not include:

- External public DMCA form.
- Counter Notice workflow.
- Creator appeal workflow.
- SLA timers or legal deadline automation.
- AI moderation or AI-assisted review.
- Account warning, suspension, or termination workflows.
- Entitlement revocation.
- Automatic refunds for removed packages.
- Annual tax certificate generation.
- Native/mobile-specific UI beyond the existing responsive web surface.
- Any LINE Developers, LINE Login, or `api.line.me` integration.

---

## 3. Chosen Approach

Use a logged-in user report flow plus a small admin trust-ops workflow.

Reports are private operational records. They do not sync through Zero and they do not create a public dispute process. Admins use the existing sticker market admin service boundary to triage reports, force package removal or restoration, and hold creator payouts while the case is investigated.

The design keeps Phase 4A narrow. It provides enough operational control to stop new purchases and block money leaving the platform, while deferring formal DMCA, appeals, account penalties, and automation to later phases.

---

## 4. Data Model

All new trust-ops tables live in the private database schema.

### 4.1 Trust Report

`stickerTrustReport` stores one report submitted by an authenticated Vine user.

Required fields:

- `id`
- `packageId`
- `reporterUserId`
- `reasonCategory`
- `reasonText`
- `status`
- `reviewedByUserId`
- `resolutionText`
- `createdAt`
- `updatedAt`
- `resolvedAt`

Reason categories:

| Category | Meaning |
| --- | --- |
| `copyright` | Possible copyright, trademark, or likeness infringement. |
| `prohibited_content` | Possible prohibited or unsafe content. |
| `fraud` | Possible scam, impersonation, or abusive creator behavior. |
| `other` | Anything not covered above. |

Report status:

| Status | Meaning |
| --- | --- |
| `open` | Submitted and not yet handled. |
| `reviewing` | Admin started review. |
| `resolved` | Admin completed the case and took any needed action. |
| `dismissed` | Admin reviewed and decided no action is needed. |

Indexes:

- `packageId`
- `reporterUserId`
- `status`

Rules:

- Only logged-in users can create reports.
- A user may report the same package multiple times. Phase 4A does not dedupe automatically.
- External rights-holder complaints are handled manually outside this table in Phase 4A.

### 4.2 Trust Action Event

`stickerTrustActionEvent` records every sensitive trust-ops action.

Required fields:

- `id`
- `reportId` nullable
- `packageId` nullable
- `creatorId` nullable
- `actorUserId`
- `action`
- `reasonText`
- `metadataJson`
- `createdAt`

Actions:

- `report_created`
- `report_reviewing`
- `report_resolved`
- `report_dismissed`
- `package_removed`
- `package_restored`
- `creator_payout_hold_enabled`
- `creator_payout_hold_cleared`

### 4.3 Creator Payout Hold

Extend `creatorProfile` with creator-level payout hold fields:

- `payoutHoldAt`
- `payoutHoldByUserId`
- `payoutHoldReason`

A creator is held when `payoutHoldAt` is not null.

This is intentionally creator-level only. Phase 4A does not add payout-request-level holds because infringement and fraud concerns usually attach to a creator or package, and request-level hold states would complicate the payout state machine.

---

## 5. Package Removal Semantics

`stickerPackage.status = "removed"` means the package was removed by an admin trust-ops action.

Effects:

- Public store home omits removed packages.
- Search omits removed packages.
- Featured shelves omit removed packages even if a shelf still references them.
- Package detail should not allow checkout for removed packages.
- `CreateCheckout` rejects removed packages.
- Existing entitlements remain valid.
- Chat sticker picker and message rendering continue to work for users who already own the package.

Restore:

- Admins can restore `removed -> on_sale`.
- Restore requires a reason.
- Restore writes a `package_restored` action event.
- Phase 4A does not restore to `approved` or `unlisted`. If an admin restores a removed package, it returns to sale.

---

## 6. Server APIs

Use ConnectRPC. Do not add raw `fetch()` endpoints.

### 6.1 User RPC

Add to `StickerMarketUserService`:

```proto
rpc ReportStickerPackage(ReportStickerPackageRequest) returns (ReportStickerPackageResponse);
```

Request:

- `package_id`
- `reason_category`
- `reason_text`

Response:

- `report_id`
- `status`

Validation:

- Auth is required.
- `packageId` must exist.
- Package must be `on_sale`. Phase 4A exposes the report entry point only on public package detail pages.
- `reasonCategory` must be one of the Phase 4A categories.
- Trimmed `reasonText` must be 10 to 1000 characters.

Effect:

- Insert `stickerTrustReport` with status `open`.
- Insert `stickerTrustActionEvent` with action `report_created`.

### 6.2 Admin RPCs

Add to `StickerMarketAdminService`:

- `ListTrustReports`
- `GetTrustReportDetail`
- `MarkTrustReportReviewing`
- `ResolveTrustReport`
- `DismissTrustReport`
- `ForceRemoveStickerPackage`
- `RestoreStickerPackage`
- `HoldCreatorPayouts`
- `ClearCreatorPayoutHold`

All methods require `auth.role === "admin"`.

`ListTrustReports` supports status filter and limit. It returns report rows with package name, package status, creator ID, creator display name, reporter user ID, reason category, and created time.

`GetTrustReportDetail` returns report metadata, package summary, package assets, creator summary, creator payout hold status, and recent trust action events.

`MarkTrustReportReviewing` changes `open -> reviewing`. It may include an optional note.

`ResolveTrustReport` changes `open/reviewing -> resolved`. Resolution text is required.

`DismissTrustReport` changes `open/reviewing -> dismissed`. Resolution text is required.

`ForceRemoveStickerPackage`:

- Allowed from `on_sale`, `unlisted`, or `approved`.
- Sets package status to `removed`.
- Requires reason text.
- May link to a report ID.
- Writes `package_removed`.

`RestoreStickerPackage`:

- Allowed from `removed`.
- Sets package status to `on_sale`.
- Requires reason text.
- May link to a report ID.
- Writes `package_restored`.

`HoldCreatorPayouts`:

- Sets `creatorProfile.payoutHoldAt`, `payoutHoldByUserId`, and `payoutHoldReason`.
- Requires reason text.
- May link to a report ID and package ID.
- Writes `creator_payout_hold_enabled`.

`ClearCreatorPayoutHold`:

- Clears creator payout hold fields.
- Requires reason text.
- Writes `creator_payout_hold_cleared`.

---

## 7. Service Boundaries

Add:

```text
apps/server/src/services/sticker-market/trust.repository.ts
apps/server/src/services/sticker-market/trust.service.ts
```

`trust.repository.ts` owns trust report queries, trust action event inserts, creator hold field updates, and report detail joins.

`trust.service.ts` owns validation and orchestration:

- report creation
- report status transitions
- package force remove/restore
- creator payout hold/clear

Keep `package.repository.ts` focused on package state transitions. Trust service should call package repository methods for remove/restore rather than spreading package status updates through Connect handlers.

Extend `createStickerMarketServices()` to instantiate the trust service and inject it into `StickerMarketUserService` and `StickerMarketAdminService`.

---

## 8. Payout Gates

Creator-level payout hold blocks money-forward transitions.

Blocked while creator is held:

- Creator creates a new payout request.
- Admin approves a payout request.
- Admin creates a payout batch containing the held creator's request.
- Admin exports or marks paid for a held creator's request.

Allowed while creator is held:

- Admin rejects a requested payout.
- Admin marks an exported payout failed.
- Admin clears the hold.

Rationale:

Reject and failed transitions move money away from payout and back into an operational state. They should remain available so admins can unwind work while a creator is held.

Implementation should prefer a single service-level guard in `payout.service.ts` before each forward transition. Repository queries may join `creatorProfile` to return hold status for admin display and validation.

---

## 9. Frontend UX

### 9.1 User Report Flow

Add a low-prominence report action to package detail.

The report form contains:

- reason category select
- reason text textarea
- submit button

On success, show a short toast such as "已收到回報".

Do not add report status tracking in Phase 4A.

### 9.2 Admin Trust Reports

Add `/admin/trust-reports`.

List page:

- status filter
- reason category
- package name
- creator display name
- reporter user ID
- created time

Detail page:

- report metadata
- package summary and asset preview
- creator summary and payout hold status
- trust action timeline
- actions:
  - mark reviewing
  - dismiss report
  - resolve report
  - force remove package
  - restore package
  - hold creator payouts
  - clear creator payout hold

### 9.3 Admin Payouts

Update `/admin/payouts` to display creator payout hold status.

Held creator requests:

- disable approve
- disable batch select
- disable mark paid
- keep reject enabled
- keep mark failed enabled

### 9.4 Creator Surfaces

Do not add a creator appeal UI in Phase 4A.

Existing creator package lists/details should show `removed` status. If the removal reason is safe to expose, show it as an informational message. If not, show only that the package was removed by Vine operations.

---

## 10. Data Fetching And Sync

Trust reports and action events are private operational data. They should be read and mutated through ConnectRPC, not Zero.

Public package discovery continues to use existing discovery queries and services, but all public discovery paths must filter out `removed` packages.

Chat sticker usage continues to rely on existing entitlement and sticker package data. Removed packages should remain available to users who already own them.

---

## 11. Error Handling

User report errors:

| Case | Response |
| --- | --- |
| Not signed in | `Unauthenticated` |
| Package missing | `NotFound` |
| Package is not `on_sale` | `FailedPrecondition` |
| Invalid category | `InvalidArgument` |
| Reason too short/long | `InvalidArgument` |

Admin errors:

| Case | Response |
| --- | --- |
| Non-admin | `PermissionDenied` |
| Invalid report transition | `FailedPrecondition` |
| Remove non-removable package | `FailedPrecondition` |
| Restore non-removed package | `FailedPrecondition` |
| Missing reason | `InvalidArgument` |
| Held creator payout-forward transition | `FailedPrecondition` |

---

## 12. Testing

Server unit tests:

- Logged-in report creates an `open` report and a `report_created` event.
- Invalid category is rejected.
- Short reason is rejected.
- Force remove changes package status to `removed` and writes an event.
- Restore changes `removed -> on_sale` and writes an event.
- Creator payout hold blocks create request, approve, batch, export, and mark paid.
- Creator payout hold does not block reject or mark failed.
- Non-admin admin RPCs return `PermissionDenied`.

Repository or integration tests:

- Trust report list joins report, package, and creator summary correctly.
- Trust report detail includes assets and action events.
- Payout gates work against real DB rows where existing payout integration fixtures already support it.

Frontend tests:

- Package detail report form validates required fields and submits.
- Admin trust report list renders report rows.
- Admin trust report detail renders package, creator, timeline, and actions.
- Admin payout page disables forward payout actions for held creators.

---

## 13. Rollout Notes

Phase 4A can ship without migrating historical reports because no previous trust report data exists.

The admin route can be added as a standalone trust-ops page under the existing admin area. It does not need a broader admin navigation refactor.

If Phase 4B later adds formal DMCA or appeals, it should build on `stickerTrustReport` and `stickerTrustActionEvent` rather than replacing them.
