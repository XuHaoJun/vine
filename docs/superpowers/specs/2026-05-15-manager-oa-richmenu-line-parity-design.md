# Manager OA Rich Menu LINE Parity Design

Date: 2026-05-15

## Context

Phase 3 campaign and audience work is complete. Phase 4 should start with
LINE-clone behavior before Vine-only manager features. A generic content library
would be useful later, but it is not a LINE Official Account Manager parity
feature. Coupons are also deferred because their value depends on payment and
redemption flows that Vine is not cloning yet.

This spec defines Phase 4A as a rich menu parity closure. It builds on the
existing rich menu routes, editor, aliases, per-user assignment, rich menu switch
actions, and click stats work. It should audit and fill gaps rather than replace
the existing implementation.

Vine remains a standalone product. LINE documentation is a product and API
reference only; Vine must keep using its own server, database, sync layer,
ConnectRPC services, and `/api/oa/v2` Messaging API surface.

## Goals

- Make the rich menu manager feel like a stable part of Vine Official Account
  Manager.
- Add first-party display period scheduling for manager-created rich menus.
- Preserve LINE-like rich menu priority:
  1. per-user rich menu;
  2. active default rich menu;
  3. no rich menu.
- Keep active rich menu resolution correct even if delayed worker jobs are late
  or temporarily unavailable.
- Audit existing LINE-like rich menu validation and fill parity gaps around
  uploaded image dimensions, template outline selection, status labels, and
  manager visibility around aliases, per-user assignment, and click stats.
- Integrate `graphile-worker@0.17.0-rc.0` in `apps/server` for delayed display
  period jobs using a dedicated `graphile_worker` PostgreSQL schema in the same
  database.

## Non-goals

- No generic Vine content library.
- No coupon creation or coupon messages.
- No LINE Pay or third-party payment integration.
- No n8n integration or automation builder in Phase 4A.
- No recurring display schedules, multi-window schedules, or journey-style
  automation.
- No official LINE cloud integration or calls to `api.line.me`.
- No rewrite of existing rich menu editor, alias, per-user, or click-stat
  features when a focused fix is enough.

## Existing Baseline

The current repo already includes:

- manager rich menu list/create/edit/users routes under
  `/manager/:oaId/richmenu`;
- `oaRichMenu`, `oaDefaultRichMenu`, `oaRichMenuAlias`,
  `oaRichMenuUserLink`, and `oaRichMenuClick` tables;
- ConnectRPC methods for list/get/create/update/delete/default rich menus;
- alias management and per-user rich menu methods;
- `switchRichMenu` behavior for rich menu tab switching;
- `trackRichMenuClick` and `getRichMenuStats`;
- chat-side `getActiveRichMenu` queries through `useRichMenu()`;
- image storage through the existing drive service.

Phase 4A should first verify these behaviors against LINE-like rules, then add
the display period and manager-quality status model around them.

## Validation Audit

The existing implementation already validates rich menu objects and basic image
upload requirements. Phase 4A should not rewrite that path. It should audit the
current checks against LINE-like rich menu requirements and fill only focused
gaps needed for parity:

- uploaded image content type remains limited to JPEG and PNG;
- uploaded image file size remains limited to 1 MB;
- uploaded image dimensions must match supported rich menu size rules;
- rich menu size must stay within the supported width, height, and aspect-ratio
  range;
- tappable areas must stay within the rich menu bounds;
- any Vine-specific stricter limits must be intentional and documented.

## Display Period

A display period is the time window during which a manager-created default rich
menu is eligible to appear. It is useful for marketing campaigns because the
chat-screen entry points can automatically match an active promotion, seasonal
event, or launch window without a manager manually switching menus at midnight.

Phase 4A supports one optional window per rich menu:

```ts
type RichMenuDisplayPeriod = {
  displayStartsAt: string | undefined
  displayEndsAt: string | undefined
}
```

Both values are stored as timestamps. `undefined` means the corresponding side
of the window is open-ended:

- no `displayStartsAt`: eligible immediately;
- no `displayEndsAt`: eligible until changed or deleted;
- neither value: always eligible.

Invalid windows are rejected:

- `displayEndsAt` must be after `displayStartsAt` when both are present;
- archived or deleted rich menus cannot be scheduled;
- a rich menu without an uploaded image cannot become an active default;
- a default rich menu outside its display period is not active.

## Status Model

The manager UI should expose a small status vocabulary:

```ts
type RichMenuManagerStatus =
  | "draft"
  | "inactive"
  | "scheduled"
  | "active"
  | "ended"
```

LINE Developers documents rich menu display priority, display period support in
LINE Official Account Manager, statistics, API validation, and API operation
statuses. It does not define this manager lifecycle vocabulary. Vine derives
these labels for manager visibility.

Status is derived from durable fields instead of trusted as the sole source of
truth:

- `draft`: menu exists but is not eligible to be active because it is
  incomplete, such as missing its uploaded image;
- `inactive`: menu is complete enough to be used but is not the OA default rich
  menu;
- `scheduled`: menu is default-eligible but `displayStartsAt` is in the future;
- `active`: menu is default and the current DB time is inside its display
  period;
- `ended`: menu is default but `displayEndsAt` is in the past.

The implementation may store a cached status for list performance, but
`getActiveRichMenu()` must recompute eligibility from DB state and current DB
time.

## Active Rich Menu Resolution

`getActiveRichMenu(officialAccountId)` remains the critical path for user chat
display. It must not depend on worker jobs having run.

Resolution order:

1. Read the authenticated user's per-user rich menu link.
2. If a linked menu exists, return it when the menu still exists and has an
   image. Per-user assignment takes priority over default display period.
3. If no valid per-user menu exists, read the OA default rich menu.
4. Return the default menu only when:
   - the menu exists;
   - it has an image;
   - `displayStartsAt` is absent or `displayStartsAt <= now`;
   - `displayEndsAt` is absent or `now < displayEndsAt`.
5. Otherwise return no rich menu.

Use DB time for `now`, not browser time. Service tests should be able to inject
or control the clock; DB integration tests should verify the real SQL behavior.

## Data Model

Add display period fields to `oaRichMenu`:

```ts
displayStartsAt: timestamp | null
displayEndsAt: timestamp | null
displayScheduleRevision: integer
```

`displayScheduleRevision` increments whenever the display period changes. Worker
jobs include the revision in their payload and no-op when it no longer matches.

Do not add a separate schedule table in Phase 4A. One rich menu has one display
period. If later phases need repeated windows or automation journeys, they can
introduce a schedule table then.

Zero schema changes are not required unless the manager UI reads rich menus
through Zero in the final implementation. Current rich menu manager flows use
ConnectRPC and React Query, so Phase 4A should continue that pattern unless the
implementation audit finds a strong reason to switch.

## Graphile Worker Integration

`apps/server` should depend on `graphile-worker@0.17.0-rc.0`.

Graphile Worker uses its own PostgreSQL schema namespace. Vine should use the
default `graphile_worker` schema in the same database as the app, not the
`public` schema, because Vine already has a `public.migrations` table and
Graphile Worker also manages a `migrations` table in its configured schema.

Server startup should initialize Graphile Worker explicitly:

```ts
await runMigrations({
  pgPool: database,
  schema: "graphile_worker",
})
```

Then start an embedded runner:

```ts
const workerRunner = await run({
  pgPool: database,
  schema: "graphile_worker",
  noHandleSignals: true,
  taskList,
})
```

The server should also create a long-lived worker utils instance for enqueueing
jobs:

```ts
const workerUtils = await makeWorkerUtils({
  pgPool: database,
  schema: "graphile_worker",
})
```

The Fastify `onClose` hook stops the runner and releases worker utils.

Phase 4A embeds the runner in `apps/server` instead of adding a new Docker
Compose service. A separate `apps/worker` process can be added later if Vine
needs independent scaling or crash isolation for background jobs.

Graphile Worker drives scheduled manager-side recomputation, such as cached
status or manager summary refreshes. It is not the source of truth for chat
display. `getActiveRichMenu()` must still recompute eligibility from durable DB
fields and DB time so worker downtime or late jobs cannot show the wrong menu.

## Worker Tasks

Use programmatic `taskList`, not a filesystem task directory.

Task identifiers:

- `oa-rich-menu-display-start`
- `oa-rich-menu-display-end`

Payload:

```ts
type RichMenuDisplayJobPayload = {
  oaId: string
  richMenuId: string
  displayScheduleRevision: number
}
```

Task behavior:

1. Re-read the rich menu by `oaId` and `richMenuId`.
2. No-op if the menu does not exist.
3. No-op if `displayScheduleRevision` differs from the payload.
4. Recompute status using DB time.
5. Update cached status or related manager summary state if the implementation
   stores one.
6. Do not blindly set the default rich menu; manager mutations remain the source
   of default selection.

Schedule edits enqueue delayed jobs with stable job keys:

```ts
jobKey: `oa-rich-menu:${oaId}:${richMenuId}:display-start`
jobKey: `oa-rich-menu:${oaId}:${richMenuId}:display-end`
```

Use `jobKeyMode: "replace"` so editing the display period replaces stale future
jobs. Use low `maxAttempts` if the task only performs idempotent recomputation,
or the Graphile Worker default retry behavior if the task touches downstream
state that may transiently fail.

## Manager UI

The rich menu list should show:

- current default status;
- display period summary;
- manager status badge;
- image completeness;
- area count;
- click count summary when available;
- entry points for edit, set default, per-user assignment, and users.

The editor should support:

- display period fields;
- clear display period;
- validation that end is after start;
- existing template outlines;
- existing action editing, including `message`, `uri`, `postback`, and
  `richmenuswitch`;
- existing alias section;
- existing assigned users section;
- existing click stats section.

Do not use visible in-app instructional text beyond normal labels, field help,
validation messages, and empty states.

## API Surface

Existing create/update rich menu RPCs should carry display period fields. Use
ISO 8601 UTC strings in proto messages to match the current OA proto style.

```proto
message RichMenuItem {
  string rich_menu_id = 1;
  string name = 2;
  string chat_bar_text = 3;
  bool selected = 4;
  int32 size_width = 5;
  int32 size_height = 6;
  repeated RichMenuArea areas = 7;
  bool has_image = 8;
  optional string display_starts_at = 9;
  optional string display_ends_at = 10;
  string manager_status = 11;
  int32 display_schedule_revision = 12;
}

message CreateRichMenuRequest {
  string official_account_id = 1;
  string name = 2;
  string chat_bar_text = 3;
  bool selected = 4;
  int32 size_width = 5;
  int32 size_height = 6;
  repeated RichMenuArea areas = 7;
  optional string display_starts_at = 8;
  optional string display_ends_at = 9;
}

message UpdateRichMenuRequest {
  string official_account_id = 1;
  string rich_menu_id = 2;
  string name = 3;
  string chat_bar_text = 4;
  bool selected = 5;
  int32 size_width = 6;
  int32 size_height = 7;
  repeated RichMenuArea areas = 8;
  optional string display_starts_at = 9;
  optional string display_ends_at = 10;
}
```

Update requests include the same display period fields. The server validates
ownership with the existing manager auth pattern before mutating rows or
enqueueing worker jobs.

The external `/api/oa/v2` Messaging API rich menu endpoints do not need display
period fields in Phase 4A. Display period is an OA Manager feature, not part of
the current LINE-shaped Messaging API subset. External API default-setting
continues to set or clear the default menu pointer immediately, but chat display
still resolves through the same display-period eligibility rules.

## Failure Modes

- Worker is down: user-facing active rich menu stays correct because the
  resolver uses DB time.
- Worker job runs late: task recomputes current state and applies only safe
  status side effects.
- Display period edited after jobs were queued: revision mismatch makes stale
  jobs no-op.
- Menu deleted before job runs: task no-ops.
- Image removed or missing: menu is not active even when inside the display
  period.
- Multiple server instances run embedded workers: Graphile Worker coordinates
  jobs through Postgres; duplicate execution is avoided by the queue.

## Testing Strategy

Server unit tests:

- display period validation;
- manager status derivation;
- rich menu validation parity gaps, including size range, area bounds, and
  uploaded image dimensions when those checks are added;
- stale worker payload no-op;
- schedule edit job-key generation.

Server DB integration tests:

- active default inside the period is returned;
- default before `displayStartsAt` is not returned;
- default after `displayEndsAt` is not returned;
- per-user rich menu wins over inactive default;
- menu without image is not active.

ConnectRPC tests:

- update rich menu accepts valid display period and returns the new fields;
- invalid period is rejected;
- ownership checks still apply;
- updating the period enqueues replacement jobs.

Web unit or integration tests:

- manager list shows `Draft`, `Inactive`, `Scheduled`, `Active`, and `Ended`
  states;
- editor validates end-before-start;
- editor or upload flow shows validation errors for image/spec violations;
- existing alias, per-user, and click stats sections remain reachable.

Worker integration can be tested without waiting for real time by enqueueing
jobs with immediate `runAt` values or by calling task functions directly with a
controlled DB state.

## Acceptance Criteria

- A manager can set or clear a display period for a rich menu.
- Rich menu list and editor show clear status for draft, inactive, scheduled,
  active, and ended menus.
- Complete non-default menus are shown as inactive, not draft.
- User chat only displays a default rich menu when the current DB time is inside
  the display period.
- External `/api/oa/v2` default-setting changes the default pointer immediately,
  while chat display still respects display-period eligibility.
- Per-user rich menu priority remains higher than default rich menu priority.
- Existing rich menu validation is audited against LINE-like requirements, and
  Phase 4A fills focused gaps without rewriting the editor or upload flow.
- Updating a display period replaces stale future worker jobs.
- Worker downtime cannot cause `getActiveRichMenu()` to return the wrong menu.
- Existing rich menu alias, per-user assignment, richmenuswitch, and click stats
  functionality remains available.
- The implementation uses the `graphile_worker` schema in the same Postgres
  database and does not place Graphile Worker private tables in `public`.
