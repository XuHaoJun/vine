# Vine OA Manager Roadmap

> Snapshot date: 2026-05-09
>
> Vine is not the official LINE platform. This roadmap uses LINE Official
> Account Manager and LINE Developers documentation as product references only.
> Vine should keep using its own server, Zero sync layer, ConnectRPC services,
> and `/api/oa/v2` Messaging API surface.

## 1. Current State

Observed implementation:

- `/manager` lists the current user's official accounts and has a create flow.
- The account list currently exposes `Manage`, but it routes directly to
  `/manager/:oaId/richmenu`.
- There is no `/manager/:oaId` home/detail route today. Clicking a specific OA
  therefore cannot land on an OA overview page.
- `/manager/:oaId/chat` and `/manager/:oaId/chat/:chatId` exist for the OA-side
  chat workspace.
- `/manager/:oaId/richmenu` exists, including create/edit/default/per-user rich
  menu routes.
- `apps/web/src/interface/oa/OADetailContent.tsx` is a user-facing OA profile
  sheet. It should not be treated as the manager detail page.

Relevant product references:

- `line-manager-home.html` and
  `docs/line-ui-reference/manager/ui.md` show the LINE OA Manager home layout:
  account header, top tabs, left navigation, overview cards, announcements,
  to-do list, friends insight, broadcast entry points, content entry points, and
  help links.
- `docs/line-ui-reference/manager/oa-chat.md` describes the richer OA chat CRM
  workspace, while the current Vine MVP implements only the chat slice.
- `docs/messaging-api-vine.md` documents Vine's current LINE-like Messaging API
  baseline.

## 2. Product Direction

The OA manager should become the operator console for a Vine Official Account.
It should combine three jobs:

1. Account operations: profile, settings, webhook, token, quota, role, and
   lifecycle management.
2. Customer operations: one-on-one chats, contacts, tags, notes, standard
   replies, response hours, scheduled messages, and user status.
3. Growth operations: broadcasts, audiences, rich menus, coupons, add-friend
   assets, insights, and campaign measurement.

The first milestone is not "clone all of LINE OA Manager". The first milestone
is "when a manager selects an OA, they reach a useful home page with stable
navigation to the features Vine already has."

## 3. LINE Concepts Mapped To Vine

| LINE reference concept | Vine equivalent | Roadmap implication |
| --- | --- | --- |
| Developer | Authenticated Vine user | Use `useAuth()` and server auth, not LINE login sessions. |
| Provider | `oaProvider` | Keep provider as the organization boundary and future role boundary. |
| Messaging API Channel | Embedded in `officialAccount` | Channel secret, webhook, quota, and access tokens live under the OA. |
| Official Account | `officialAccount` | User-facing bot/account identity. |
| Channel roles | Future OA/provider roles | Start with owner-only, then add Admin/Member/Tester-like permissions. |
| LINE OA Manager | Vine `/manager` | Product reference only; no calls to `manager.line.biz`. |
| LINE Messaging API | Vine `/api/oa/v2` | Preserve LINE-like semantics where useful, but back them with Vine state. |

## 4. Roadmap Summary

| Phase | Name | Goal | Depends on | Status |
| --- | --- | --- | --- | --- |
| 0 | OA Detail Home | Fix entry flow and add `/manager/:oaId` overview. | Existing account list | Done |
| 1 | Profile and Basic Settings | Make account identity editable and remove mock profile gaps. | Phase 0 | Next |
| 2 | Messaging API Operations | Manage webhook, token, quota, delivery health, and API docs. | Existing OA API | Planned |
| 3 | Chat CRM | Evolve chat MVP into an operator-grade support workspace. | Existing chat MVP | Planned |
| 4 | Broadcast and Audiences | Add outbound campaign workflows and targeting. | Phase 2, friendship data | Planned |
| 5 | Interactive Content | Complete rich menus and add reusable content/coupon surfaces. | Existing rich menu MVP | Planned |
| 6 | Insights and Growth | Provide friend, message, click, webhook, and growth analytics. | Phases 2, 4, 5 | Planned |
| 7 | Collaboration and Governance | Add roles, audit logs, plan/quota policy, and account lifecycle controls. | Phases 0-6 | Planned |

## 5. Phase Details

### Phase 0: OA Detail Home

Goal: selecting an OA opens a useful manager home instead of jumping straight
into a subfeature.

Scope:

- Add `/manager/:oaId` as the OA manager home/detail page.
- Change `/manager` row click and `Manage` to navigate to `/manager/:oaId`.
- Keep `/manager/:oaId/chat` and `/manager/:oaId/richmenu` as child features.
- Show a manager header with account name, `@uniqueId`, status, lightweight
  friend count, chat status, and account switcher placeholder.
- Add overview cards:
  - Profile summary with an edit entry point.
  - Chat entry with unread or recent activity if already available.
  - Rich menu entry with default menu status if already available.
  - Messaging API/webhook health if already available.
  - Quota usage if already available.
- Add a compact to-do list for first setup:
  - Complete profile.
  - Add profile image.
  - Configure webhook.
  - Create default rich menu.
  - Open chat inbox.

Non-goals:

- No broadcast builder yet.
- No role management yet.
- No analytics system rewrite.
- No official LINE cloud integration.

Acceptance criteria:

- A manager logging in and selecting an OA lands on `/manager/:oaId`.
- The page has stable navigation to `Chats` and `Rich menus`.
- The page does not use `OADetailContent` mock values as manager data.
- Missing data appears as empty or setup states, not fake production metrics.

### Phase 1: Profile and Basic Settings

Goal: make the OA identity manageable from the manager console.

Scope:

- Add a `Business profile` or `Basic settings` manager section.
- Edit `name`, `uniqueId`, `description`, `imageUrl`, `email`, `country`,
  `company`, and `industry` using existing ConnectRPC OA service patterns.
- Replace user-facing mock profile constants with real OA fields where the
  public profile sheet needs them.
- Add basic validation that matches current creation constraints.
- Add disabled or documented future fields only when they are visible in the UI:
  privacy policy URL, terms URL, localized names, premium ID, and verification
  status.

Acceptance criteria:

- Editing the manager profile changes the user-facing OA profile.
- Account creation and edit validation stay consistent.
- Disabled future fields do not imply official LINE certification.

### Phase 2: Messaging API Operations

Goal: make Vine's LINE-like API operable from the manager.

Scope:

- Add `Messaging API` settings under `/manager/:oaId/settings` or a dedicated
  section.
- Manage webhook URL, `useWebhook`, redelivery, verification, last verify
  result, and error-statistics toggle.
- Show webhook error categories modeled after LINE's reasons:
  `could_not_connect`, `request_timeout`, `error_status_code`, and
  `unclassified`, backed by Vine delivery records.
- Manage channel secret and access tokens:
  - issue short-lived token;
  - issue JWT v2.1-style token if supported;
  - rotate/revoke token;
  - hide full secrets after creation.
- Show quota and monthly usage from `oaQuota`.
- Link to Vine API docs and examples, using `/api/oa/v2` endpoints.

LINE reference concepts used:

- Messaging API webhook flow.
- Channel access tokens.
- Webhook verification and error statistics.
- Message quota and consumption.

Acceptance criteria:

- A bot developer can configure and verify a webhook without leaving Vine.
- Webhook delivery failures are inspectable from the manager.
- Token operations are auditable and never expose stored secret material.

### Phase 3: Chat CRM

Goal: evolve the current OA chat MVP into daily support tooling.

Scope:

- Keep the current four-column chat workspace.
- Add contact list mode.
- Add user profile panel fields: friendship status, last interaction, tags,
  notes, and provider-scoped user ID.
- Add manager-owned read state and search/filter improvements.
- Add standard replies.
- Add response hours and off-hours auto-response.
- Add scheduled messages from the chat composer.
- Add media/sticker/template/Flex send support only after those message types
  render reliably in Vine chats.

Acceptance criteria:

- Operators can triage user conversations without switching tools.
- Standard replies and response hours reduce repetitive manual replies.
- User-side chat behavior remains unchanged.

### Phase 4: Broadcast and Audiences

Goal: support outbound communication beyond one-on-one chat.

Scope:

- Add `Broadcast list` and `New broadcast`.
- Build a reusable message composer for text first, then rich message types.
- Support broadcast to all current friends.
- Support multicast to selected contacts.
- Add audience primitives:
  - uploaded user IDs;
  - message click audience;
  - message impression/open audience;
  - rich menu click audience if Vine tracks it.
- Add narrowcast only after audience data and privacy thresholds are defined.
- Enforce quota before enqueueing sends.
- Add retry-key and idempotency behavior aligned with `docs/messaging-api-vine.md`.

LINE reference concepts used:

- Broadcast, push, multicast, and narrowcast message families.
- Audience groups and audience sharing ideas.
- Unit-based message statistics.

Acceptance criteria:

- A manager can send a text broadcast to current OA friends.
- Message usage is counted per recipient.
- Future targeting is backed by explicit audience records, not ad hoc filters.

### Phase 5: Interactive Content

Goal: make OA conversations richer without forcing managers into API-only work.

Scope:

- Complete rich menu manager:
  - draft/save flow;
  - display period;
  - default and per-user rich menu status;
  - rich menu aliases;
  - click analytics from `oaRichMenuClick`;
  - template outlines and image validation.
- Add rich message/content library:
  - template messages;
  - imagemap;
  - Flex Message presets;
  - reusable assets.
- Add quick replies and postback action authoring.
- Add coupons as a separate content type:
  - create;
  - list;
  - discontinue;
  - send in chat/broadcast where supported.
- Defer reward cards and surveys until coupons and broadcasts are stable.

LINE reference concepts used:

- Rich menu structure, scopes, priority, and per-user behavior.
- Coupon creation and coupon messages.
- Template/Flex/action objects.

Acceptance criteria:

- Existing rich menu routes feel like part of the manager home, not a detached
  feature.
- Managers can author one reusable interactive asset and send or attach it in
  at least one channel.

### Phase 6: Insights and Growth

Goal: let managers understand whether the OA is growing and whether messages
work.

Scope:

- Add home dashboard metrics:
  - friends added;
  - friends blocked;
  - target reach;
  - message usage;
  - webhook failure rate;
  - rich menu clicks.
- Add `Gain friends` tools:
  - QR code;
  - add-friend link;
  - embeddable button snippet if Vine web supports it;
  - share/recommend link if Vine URL schemes exist.
- Add broadcast and campaign insights:
  - recipients;
  - opens/impressions;
  - URL clicks;
  - media plays if tracked.
- Apply privacy thresholds before exposing interaction analytics. LINE hides
  some aggregated values for small groups; Vine should define a similar rule
  before shipping narrow insights.

Acceptance criteria:

- The manager home reflects real recent activity.
- Growth tools generate Vine URLs, not LINE URLs.
- Small-audience analytics do not expose individual behavior.

### Phase 7: Collaboration and Governance

Goal: support real organizations and production operations.

Scope:

- Add provider and OA roles:
  - owner/admin;
  - operator/member;
  - tester/read-only if needed.
- Use role checks consistently across ConnectRPC, Zero permissions, and UI.
- Add invitations and membership management.
- Add audit logs for sensitive operations:
  - token creation/revocation;
  - webhook changes;
  - role changes;
  - broadcast sends;
  - delete/disable account.
- Add account lifecycle:
  - disable;
  - delete with confirmation;
  - export basic data;
  - plan/quota assignment.
- Add notification center for webhook failures, quota exhaustion, and system
  changes.

LINE reference concepts used:

- Provider roles.
- Channel roles.
- Developer Console notification center ideas.

Acceptance criteria:

- Multiple operators can work on one OA without sharing a single owner account.
- Sensitive manager actions have server-side authorization and audit trails.

## 6. Implementation Order Recommendation

Do this first:

1. Phase 0 `/manager/:oaId` detail home.
2. Phase 1 profile/basic settings.
3. Phase 2 webhook/token/quota operations.
4. Phase 3 chat CRM additions that reuse existing chat MVP.
5. Phase 5 rich menu completion, because routes already exist.
6. Phase 4 broadcast/audience once quota and messaging operations are visible.
7. Phase 6 insights once events are consistently tracked.
8. Phase 7 roles/governance when more than one operator per OA matters.

Reasoning:

- The immediate product gap is navigation and the missing detail page.
- Profile/settings and API operations make the home page useful quickly.
- Broadcast/audience/insights depend on tracking, quota, and deliverability
  primitives; shipping them too early creates misleading manager UI.
- Roles are important, but owner-only is acceptable until there is enough
  manager surface area to justify multi-operator complexity.

## 7. Completed Implementation Slice

Completed spec: `manager-oa-detail-home-mvp`.

Files likely involved:

- `apps/web/app/(app)/manager/index.tsx`
- `apps/web/app/(app)/manager/[oaId]/_layout.tsx`
- new `apps/web/app/(app)/manager/[oaId]/index.tsx`
- new or reused `apps/web/src/features/oa-manager/home/*`
- `apps/web/src/features/oa/client.ts` only if existing RPCs are insufficient
- `packages/proto/proto/oa/v1/oa.proto` and server handlers only if the home
  needs data not currently returned by existing endpoints

Minimal UI:

- Header: account name, `@uniqueId`, status.
- Left nav: `Home`, `Chats`, `Rich menus`, `Settings` placeholder only if it
  routes somewhere real.
- Main overview:
  - profile summary;
  - setup checklist;
  - chat card linking to `/manager/:oaId/chat`;
  - rich menu card linking to `/manager/:oaId/richmenu`;
  - webhook/quota cards only if current data exists.

Minimal verification completed by Phase 0:

- Unit or integration test that `/manager` `Manage` navigates to
  `/manager/:oaId`.
- Integration coverage that `/manager/:oaId` loads account data and shows
  child navigation.
- Existing manager chat and rich menu tests still pass.

Recommended next spec: `manager-oa-profile-basic-settings`.

## 8. Open Decisions

- Should the OA manager use "LINE Official Account Manager" text permanently,
  or should UI copy switch to "Vine Official Account Manager" to avoid implying
  official LINE affiliation?
- Should `uniqueId` be called `@id`, `Vine ID`, or `Official Account ID` in the
  manager UI?
- Should Phase 0 show unavailable metrics as disabled setup cards, or hide them
  until the backing data exists?
- Should roles be provider-scoped first or OA-scoped first? LINE has both, but
  Vine may only need provider owner/admin/member at first.

## 9. Reference Notes

Local reference documents used while drafting:

- `/home/noah/vine/.skills/developers-line-biz/references/line_developers_console_overview.md`
- `/home/noah/vine/.skills/developers-line-biz/references/managing_roles.md`
- `/home/noah/vine/.skills/developers-line-biz/references/messaging_api_overview.md`
- `/home/noah/vine/.skills/developers-line-biz/references/rich_menus_overview.md`
- `/home/noah/vine/.skills/developers-line-biz/references/use_audiences.md`
- `/home/noah/vine/.skills/developers-line-biz/references/get_statistics_of_sent_messages.md`
- `/home/noah/vine/.skills/developers-line-biz/references/gain_friends_of_your_line_official_account.md`
- `/home/noah/vine/.skills/developers-line-biz/references/create_coupons_and_send_them_to_users.md`
- `/home/noah/vine/.skills/developers-line-biz/references/check_webhook_error_causes_and_statistics.md`
