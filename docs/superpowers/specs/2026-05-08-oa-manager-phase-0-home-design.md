# OA Manager Phase 0 Home Design

## Context

Phase 0 of `docs/oa-manager-roadmap.md` adds a useful OA manager home at
`/manager/:oaId`. Today `/manager` lists the current user's official accounts,
but `Manage` jumps directly to `/manager/:oaId/richmenu`. That makes rich menu
the accidental landing page and leaves no account overview route.

The visual reference is `line-manager-home.html` / `oa-manager-home.png`. Vine
should borrow the account header, top tabs, left grouped navigation, and manager
dashboard structure, but it must not imply unfinished LINE Manager features
exist. Vine is a standalone product and must continue using its own server,
ConnectRPC surface, Zero/DB state, and existing `/api/oa/v2` Messaging API.

## Goals

- Add `/manager/:oaId` as the OA manager home route.
- Change `/manager` row click and `Manage` to navigate to `/manager/:oaId`.
- Establish a LINE-like manager shell for home and rich menu management.
- Keep OA chat routes independent from the manager shell.
- Add a small manager summary RPC so the home page does not stitch together many
  unrelated client queries.
- Show only working Phase 0 features in navigation: `Home`, `Chats`, and
  `Chat screen > Rich menus`.
- Preserve existing rich menu manager functionality while adapting its page
  chrome to the new shell.

## Non-Goals

- No broadcast builder.
- No analytics system or insights dashboard.
- No role management.
- No full profile editor; profile editing remains Phase 1.
- No full Messaging API settings page; webhook/quota are read-only summary
  cards in Phase 0.
- No official LINE cloud integration or calls to LINE-hosted services.
- No fake announcements, metrics, friend trends, or production-like values.

## Chosen Approach

Use a "LINE Shell + Vine Operations Home" approach:

- Borrow the structural layout from LINE Official Account Manager.
- Limit visible navigation and operational cards to features Vine can support in
  Phase 0.
- Add one focused ConnectRPC summary query for account overview data.
- Reuse existing rich menu list/editor/user assignment behavior rather than
  rewriting the whole rich menu manager.

This is intentionally more than a route redirect, because Phase 0 is the point
where the OA manager gets a stable landing frame. It is intentionally less than
a broad LINE Manager clone, because only working or read-only summary features
should be visible.

## Route And Layout Architecture

The existing `apps/web/app/(app)/manager/[oaId]/_layout.tsx` currently wraps both
chat and rich menu routes. Phase 0 should split that boundary with a OneJS route
group so chat can stay independent while home and rich menus share the manager
shell.

Target shape:

```text
apps/web/app/(app)/manager/[oaId]/
  (home)/
    _layout.tsx
    index.tsx
    richmenu/
      index.tsx
      create.tsx
      [richMenuId].tsx
      users.tsx

  chat/
    index.tsx
    [chatId].tsx
```

The route group must preserve URLs:

- `/manager/:oaId`
- `/manager/:oaId/richmenu`
- `/manager/:oaId/richmenu/create`
- `/manager/:oaId/richmenu/:richMenuId`
- `/manager/:oaId/richmenu/users`
- `/manager/:oaId/chat`
- `/manager/:oaId/chat/:chatId`

There should be no shared `[oaId]/_layout.tsx` that applies the new manager
shell to chat routes. Chat pages should keep their existing full-height
workspace layout.

## Manager Shell

The `(home)/_layout.tsx` shell wraps the home route and rich menu routes.

Header:

- Product label.
- OA name.
- `@uniqueId`.
- OA status badge.
- Friend count from summary.
- Chat status from summary.
- Account switcher placeholder.
- Disabled or coming-soon settings entry on the right.

Top tabs:

- `Home` links to `/manager/:oaId`.
- `Chats` links to `/manager/:oaId/chat`.
- No top-level `Rich menus` tab.

Left navigation:

- One group: `Chat screen`.
- One child item: `Rich menus`, linking to `/manager/:oaId/richmenu`.
- `Chats` does not appear in the left nav.

Active state:

- Exact `/manager/:oaId` activates `Home`.
- `/manager/:oaId/chat*` activates `Chats`, but those pages do not render inside
  this shell.
- `/manager/:oaId/richmenu*` activates the left `Rich menus` item.

Content sizing:

- Home and rich menu pages use the manager shell's content area.
- Chat routes keep their existing workspace sizing and do not inherit the shell.

## Manager Home Page

`/manager/:oaId` is an operations dashboard, not a marketing page.

Top account summary:

- Avatar or image fallback.
- OA name.
- `@uniqueId`.
- Friend count.
- Status.
- Disabled `Edit profile` button or coming-soon treatment. The button position
  should mirror the LINE reference, but it must not imply Phase 0 supports
  profile editing.

Operations grid:

- `Chats`: links to `/manager/:oaId/chat`; shows safe activity if the summary can
  provide it, otherwise an inbox-ready empty state.
- `Rich menus`: links to `/manager/:oaId/richmenu`; shows default menu title or
  "No default menu".
- `Messaging API`: read-only webhook summary.
- `Quota`: read-only monthly usage summary.

Setup checklist:

- Complete profile.
- Add profile image.
- Configure webhook.
- Create default rich menu.
- Open chat inbox.

Secondary panels:

- `Announcements`: empty state unless Vine has real announcement data.
- `Help`: links only to stable local Vine docs if they exist; otherwise use
  disabled/help placeholders.

Responsive behavior:

- Desktop follows the reference: header, top tabs, left nav, dashboard main
  content.
- Narrow widths collapse the dashboard into one column and keep navigation
  usable.
- Phase 0 does not require a separate mobile redesign.

## Manager Summary API

Add one authenticated ConnectRPC query:

```protobuf
rpc GetOfficialAccountManagerSummary(GetOfficialAccountManagerSummaryRequest)
  returns (GetOfficialAccountManagerSummaryResponse);
```

Request:

- `official_account_id`.

Authorization:

- Use the same owner check pattern as existing OA manager RPCs.

Response shape should stay small and operational:

- `account`: OA identity fields required by the shell and home page.
- `friend_count`: count of current `oaFriendship.status = 'friend'`.
- `chat_status`: simple Phase 0 status. It can be `off` or `available` depending
  on what existing data can prove; do not invent response-hours semantics.
- `recent_chat_count`: include only if existing data can support it without
  adding unrelated chat state. Do not add unread state in Phase 0 unless it
  already exists as manager-owned data.
- `rich_menu`: default rich menu id/title and total rich menu count.
- `webhook`: configured flag, `use_webhook`, status, `last_verified_at`, and
  last verification reason where available.
- `quota`: monthly limit, total usage, remaining count or usage percent where
  available.
- `setup`: checklist booleans for profile completeness, profile image, webhook
  configuration, default rich menu, and chat inbox availability.

Client usage:

- Use the existing Connect client pattern in `~/features/oa/client`.
- Wrap the RPC with `useTanQuery(['oa', 'manager-summary', oaId])`.
- The manager shell may consume the same summary data for header metadata.
- Rich menu pages can keep their existing `listRichMenus`, `getRichMenu`, stats,
  and per-user queries.

Missing data:

- Render empty/setup states.
- Do not show mock production metrics.
- Do not use `apps/web/src/interface/oa/OADetailContent.tsx` mock values as
  manager data.

## Rich Menu Pages

`/manager/:oaId/richmenu` remains a rich menu list management page inside the
new manager shell.

The existing implementation already supports list, create, edit, default menu,
per-user assignment, delete, stats, and the rich menu editor. Phase 0 should
reuse that behavior and adjust page chrome/layout only where needed.

List page requirements:

- Header title: `Rich menus`.
- Description: explain that rich menus are shown in the chat screen.
- Primary button at the top right: `Create new`, linking to
  `/manager/:oaId/richmenu/create`.
- Secondary action: keep `Per-user` as a lower-emphasis action if needed.
- `Current menu` section shows the default rich menu when one exists.
- If no default exists, show a setup/empty state.
- List existing menus below the current/default state.
- Full LINE-style `Scheduled/Active/Ready` tabs are not required in Phase 0 unless
  existing data can support them reliably.

Create/edit/users routes:

- `/manager/:oaId/richmenu/create` stays inside the shell and reuses
  `RichMenuEditor`.
- `/manager/:oaId/richmenu/:richMenuId` stays inside the shell and reuses
  `RichMenuEditor`, assigned users, aliases, and click stats.
- `/manager/:oaId/richmenu/users` stays inside the shell and keeps per-user
  assignment behavior.

## Account List Entry Flow

`/manager` remains the account list. It should change only the entry target:

- Clicking `Manage` navigates to `/manager/:oaId`.
- If row-level click is implemented, it also navigates to `/manager/:oaId`.
- Delete behavior stays unchanged.
- Search and create flow stay unchanged.

## Error And Loading States

- Summary loading shows a spinner or skeleton inside the manager shell.
- Account not found or access denied follows the existing manager behavior:
  show an error and navigate back to `/manager`.
- Empty accounts remain handled by `/manager`.
- Summary subfields may be absent; cards should degrade to empty/setup states.

## Testing And Verification

Server:

- Add focused coverage for the manager summary query.
- Verify authorization uses the existing OA ownership boundary.
- Verify friend count, default rich menu, webhook summary, quota summary, and setup
  booleans are mapped from real data.

Web/unit where useful:

- Cover any extracted summary/card formatting helpers.

Integration:

- A manager selecting an OA lands on `/manager/:oaId`.
- `Manage` no longer jumps directly to `/manager/:oaId/richmenu`.
- `/manager/:oaId` renders the manager shell, top tabs `Home` and `Chats`, and
  left nav `Chat screen > Rich menus`.
- `/manager/:oaId/chat*` does not inherit the manager shell.
- `/manager/:oaId/richmenu*` inherits the manager shell.
- `/manager/:oaId/richmenu` shows the list management page with a `Create new`
  button.
- Create, edit, and per-user rich menu routes still work after the route move.
- Missing summary data is shown as empty/setup state, not fake metrics.

Relevant commands:

- `bun turbo proto:generate` after proto changes.
- `bun run --cwd apps/server test:unit` or targeted server tests.
- `bun run --cwd apps/web test:unit` if frontend helpers are added.
- `bun scripts/integration.ts --web-only integration/manager-oa-chat.test.ts` or a
  new targeted integration file for the manager home/rich menu flow.
- `bun run check:all` before landing if feasible.
