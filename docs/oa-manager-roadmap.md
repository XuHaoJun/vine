# Vine OA Manager Roadmap

> Snapshot date: 2026-05-15
>
> Vine is not the official LINE platform. This roadmap uses LINE Official
> Account Manager and LINE Developers documentation as product references only.
> Vine should keep using its own server, Zero sync layer, ConnectRPC services,
> and `/api/oa/v2` Messaging API surface.

## 1. Current State

Observed implementation:

- `/manager` lists the current user's official accounts and has a create flow.
- Selecting an OA lands on `/manager/:oaId`, the manager home/detail route.
- `/manager/:oaId` has stable navigation to home, chats, rich menus, campaigns,
  and audiences.
- `/manager/:oaId/chat` and `/manager/:oaId/chat/:chatId` exist for the OA-side
  chat CRM workspace, including contact CRM, tags, notes, filters, and export
  policy slices from Phase 2.
- `/manager/:oaId/campaigns` and `/manager/:oaId/campaigns/audiences` exist for
  campaign and audience-filter workflows from Phase 3.
- `/manager/:oaId/richmenu` exists, including create/edit/default/per-user,
  alias, richmenuswitch, and click-stat routes or sections.
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

1. Account operations: profile, settings, role, and lifecycle management.
   (Messaging API operations — webhook, token, quota — are handled in the
   developer console.)
2. Customer operations: one-on-one chats, contact management, CRM tags, notes,
   saved filters, retention/export policy, and tag-based audience
   handoff.
3. Growth operations: broadcasts, audiences, rich menus, add-friend assets,
   insights, and campaign measurement.

The first milestone is not "clone all of LINE OA Manager". The first milestone
is "when a manager selects an OA, they reach a useful home page with stable
navigation to the features Vine already has."

## 3. LINE Concepts Mapped To Vine

| LINE reference concept | Vine equivalent | Roadmap implication |
| --- | --- | --- |
| Developer | Authenticated Vine user | Use `useAuth()` and server auth, not LINE login sessions. |
| Provider | `oaProvider` | Keep provider as the organization boundary and future role boundary. |
| Messaging API Channel | Embedded in `officialAccount` | Channel secret, webhook, quota, and access tokens are managed in the developer console. |
| Official Account | `officialAccount` | User-facing bot/account identity. |
| Channel roles | Future OA/provider roles | Start with owner-only, then add Admin/Member/Tester-like permissions. |
| LINE OA Manager | Vine `/manager` | Product reference only; no calls to `manager.line.biz`. |
| LINE Messaging API | Vine `/api/oa/v2` | Preserve LINE-like semantics where useful, but back them with Vine state. |

## 4. Roadmap Summary

| Phase | Name | Goal | Depends on | Status |
| --- | --- | --- | --- | --- |
| 0 | OA Detail Home | Fix entry flow and add `/manager/:oaId` overview. | Existing account list | Done |
| 1 | Profile and Basic Settings | Make account identity editable and remove mock profile gaps. | Phase 0 | Done |
| 2 | Chat CRM | Evolve chat MVP into contact CRM, tagging, notes, and custom filters. | Existing chat MVP | Done |
| 3 | Broadcast and Audiences | Add outbound campaign workflows and targeting. | Friendship data | Done |
| 4A | Rich Menu LINE Parity | Complete rich menu manager parity, display period, status, validation, and worker-backed schedule jobs. | Existing rich menu MVP | Done |
| 4B | Rich Message Editor | Add a shared manager composer for Vine-supported rich message drafts, including text, media URL messages, Flex, imagemap, and quick replies. | Existing message renderers | Spec approved |
| 5 | Insights and Growth | Provide friend, message, click, webhook, and growth analytics. | Phases 3, 4A | Planned |
| 6 | Collaboration and Governance | Add roles, audit logs, plan/quota policy, and account lifecycle controls. | Phases 0-5 | Planned |

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

### Phase 2: Chat CRM

Goal: evolve the current OA chat MVP into daily support tooling.

Reference source of truth:

- `docs/line-oa-manger-chat-CRM.md` drives this phase's functional scope.
- `docs/line-ui-reference/manager/oa-chat.md` remains useful for layout context,
  but scheduled messages, standard replies, response hours, and rich message
  authoring are not Phase 2 commitments unless a later spec explicitly pulls
  them forward.

Scope:

- Keep the current four-column chat workspace.
- Split Phase 2 into four implementation slices:
  - 2A Contact CRM foundation: contact list mode, profile panel data,
    friendship status, last interaction, provider-scoped user ID, and current
    chat status.
  - 2B Tags and notes: OA-scoped tag CRUD, assigning/removing tags from users,
    and manager-only notes on OA contacts.
  - 2C Filters: default filters (All, Unread) plus saved custom filters based
    on tags with AND/OR match mode. Triage status (pending, done, assigned)
    deferred to Phase 6 with multi-operator roles.
  - 2D Retention and export policy: keep Vine's own retention behavior explicit
    without LINE paid-plan limits, add an owner-only contact CRM CSV export, and
    state that chat history export, media export, full backup/restore,
    scheduled exports, and non-owner export remain unavailable.
- Preserve tag data in a form that Phase 3 can use for tag-based audiences, but
  do not ship broadcast sending in Phase 2.

Non-goals:

- No scheduled sending in Phase 2.
- No standard replies in Phase 2.
- No response hours or off-hours auto-response in Phase 2.
- No media/sticker/template/Flex send expansion in Phase 2 unless that message
  type already renders reliably and a separate spec pulls it forward.

Acceptance criteria:

- Operators can filter chat lists by unread status and custom tag filters.
- Operators can create CRM tags, assign them to contacts, and use them in saved
  filters.
- Operators can record internal notes on OA contacts.
- OA owners can export a contact CRM CSV snapshot that excludes chat message
  bodies and media.
- The roadmap and Phase 2 spec agree on what belongs to Phase 2 and what is
  deferred.
- User-side chat behavior remains unchanged.

### Phase 3: Audience Filters and Campaign Broadcasts

Goal: support outbound communication beyond one-on-one chat.

Scope:

- Split Phase 3 into:
  - Phase 3A: Vine-native audience filters and campaign broadcast MVP.
  - Phase 3B: LINE-compatible external Messaging API facade.
- Add reusable audience filters as named, versioned, controlled Mongo-like
  predicates over OA contact fields.
- Add campaign records for outbound bulk sends, including text content,
  recipient snapshot, send status, delivery counts, and quota usage.
- Support text campaigns to all current friends or a saved audience filter.
- Preserve Phase 2 CRM tags as first-class audience query fields.
- Enforce quota before enqueueing sends and count usage per recipient.
- Make send behavior idempotent and recoverable.
- In Phase 3B, compile supported LINE-shaped broadcast, multicast, narrowcast,
  and audience upload requests into Vine-native audience filters and campaigns.

LINE reference concepts used:

- Broadcast, push, multicast, and narrowcast message families.
- Audience groups as external API facade inputs, not Vine's internal model.
- Unit-based message statistics.

Acceptance criteria:

- A manager can create reusable audience filters for one OA.
- A manager can send a text campaign to all current OA friends or a saved
  audience filter.
- Each send stores a durable recipient snapshot.
- Message usage is counted per recipient.
- Future LINE-compatible Messaging API endpoints are backed by Vine-native
  audience filters and campaigns, not LINE-specific internal tables.

### Phase 4: Interactive Content

Goal: make OA conversations richer without forcing managers into API-only work.

Phase 4 is split into LINE-clone-first slices. Phase 4A is the approved next
slice. Vine-only content-library features are intentionally deferred until the
LINE-parity surfaces are stable.

#### Phase 4A: Rich Menu LINE Parity

Goal: make rich menus behave like a stable LINE OA Manager feature, including
display period scheduling.

Approved spec:

- `docs/superpowers/specs/2026-05-15-manager-oa-richmenu-line-parity-design.md`

Scope:

- Complete rich menu manager:
  - draft/save flow;
  - display period;
  - default and per-user rich menu status;
  - rich menu aliases;
  - click analytics from `oaRichMenuClick`;
  - template outlines and image validation.
- Add `graphile-worker@0.17.0-rc.0` to `apps/server` for delayed display-period
  jobs.
- Use a dedicated `graphile_worker` PostgreSQL schema in the same database.
- Keep `getActiveRichMenu()` correct from DB time even if worker jobs are late.
- Preserve existing alias, per-user assignment, richmenuswitch, and click-stat
  behavior.

Non-goals:

- No generic content library.
- No coupons.
- No LINE Pay or payment integration.
- No n8n automation in Phase 4A.
- No recurring schedules or journey automation.

Acceptance criteria:

- Existing rich menu routes feel like part of the manager home, not a detached
  feature.
- Managers can set and clear a display period for a rich menu.
- The manager UI exposes draft, scheduled, active, and ended states.
- User chat only displays a default rich menu when DB time is inside the display
  period.
- Per-user rich menu priority remains higher than default rich menu priority.
- Updating a display period replaces stale future worker jobs.
- Worker downtime cannot cause `getActiveRichMenu()` to return the wrong menu.

#### Phase 4B: Rich Message Editor

Goal: let managers compose Vine-supported rich message payloads without writing
raw API JSON.

Approved spec:

- `docs/superpowers/specs/2026-05-18-manager-oa-rich-message-editor-design.md`

Scope:

- Add a shared controlled Rich Message Editor using `MessageDraft[]` input and
  output.
- Use a Tiptap-like headless editor core with message extensions, a configurable
  starter kit, commands, validation, serialization, and preview renderers.
- Use a slim manager composer UI: live preview with bottom toolbar icon buttons.
- Reuse the real talks chat bubble rendering style for preview, while keeping
  the product context as an OA manager marketing composer rather than the user
  chat composer.
- Support first-version authoring for:
  - text;
  - image, video, and audio by HTTPS URL form;
  - Flex Messages through a shared Flex editor dialog;
  - imagemap messages;
  - quick replies attached to supported message drafts.
- Keep sticker and location toolbar actions disabled or coming soon in this
  slice.
- Integrate authored rich message payloads with both one-on-one OA chat and
  campaign broadcast.
- Add campaign rich payload storage and summaries; mark `messageText` as
  deprecated for new campaign flows.

Non-goals:

- No template messages in Phase 4B.
- No coupons in Phase 4B.
- No automation journeys.
- No generic asset library, media upload picker, reusable message package, or
  saved content library.

Acceptance criteria:

- Managers can author text, media URL, Flex, imagemap, and quick reply rich
  message drafts without raw Messaging API JSON.
- The Rich Message Editor is shared across manager OA chat and campaign
  broadcast surfaces.
- Authored message payloads use Vine's existing Messaging API-compatible
  validators and chat renderers where available.
- Campaigns persist `messagePayloadJson` and `messageSummary`; `messageText` is
  retained only for backward compatibility.

#### Parking Lot: Coupons

Coupons are removed from the active Phase 4 roadmap. They may be reconsidered
only if Vine defines a useful redemption model that does not depend on LINE Pay
or third-party payment integration. Until then, coupons are not a planned 4A,
4B, or 4C implementation slice.

LINE reference concepts used:

- Rich menu structure, scopes, priority, and per-user behavior.
- Rich menu display period and rich menu insights from OA Manager references.
- Flex, imagemap, quick reply, and action objects.
- Coupon creation and coupon messages are reference-only and not currently
  planned.

### Phase 5: Insights and Growth

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

### Phase 6: Collaboration and Governance

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

1. Phase 0 `/manager/:oaId` detail home. *(done)*
2. Phase 1 profile/basic settings. *(done)*
3. Phase 2 chat CRM additions that reuse existing chat MVP, split into contact
   CRM, tags/notes, custom filters, and retention/export policy. *(done)*
4. Phase 3 broadcast/audience campaign workflows. *(done)*
5. Phase 4A rich menu LINE parity and display period, because routes already
   exist and this stays closest to LINE-clone behavior. *(done)*
6. Phase 4B rich message editor for shared chat and campaign authoring.
7. Phase 5 insights once events are consistently tracked.
8. Phase 6 roles/governance when more than one operator per OA matters.

Reasoning:

- Messaging API operations (webhook, token, quota) are already handled in the
  developer console and do not need duplication in the OA manager.
- Chat CRM and broadcast/audience work are now implemented enough for Phase 4A
  to build on their manager navigation and event surfaces.
- Rich menu parity is the next LINE-clone slice because coupons have low value
  without a redemption or payment model, and a broad content library would be
  Vine-only before the LINE-compatible surfaces are complete.
- Insights depend on consistent event capture from campaigns and rich menus.
- Roles are important, but owner-only is acceptable until there is enough
  manager surface area to justify multi-operator complexity.

## 7. Completed Implementation Slices

Completed specs:

- Phase 0: `docs/superpowers/specs/2026-05-08-oa-manager-phase-0-home-design.md`
- Phase 1:
  `docs/superpowers/specs/2026-05-09-manager-oa-profile-basic-settings-design.md`
- Phase 2:
  `docs/superpowers/specs/2026-05-09-manager-oa-chat-crm-design.md`
- Phase 3:
  `docs/superpowers/specs/2026-05-13-manager-oa-broadcast-campaign-design.md`

Approved current spec:
`docs/superpowers/specs/2026-05-18-manager-oa-rich-message-editor-design.md`.

Recently completed spec:
`docs/superpowers/specs/2026-05-15-manager-oa-richmenu-line-parity-design.md`.

## 8. Open Decisions

- Should roles be provider-scoped first or OA-scoped first? LINE has both, but
  Vine may only need provider owner/admin/member at first.
- Should coupons ever return to the roadmap, and what non-payment redemption
  model would make them valuable enough?
- When background jobs grow beyond display-period scheduling, should Vine split
  embedded Graphile Worker execution out of `apps/server` into a dedicated
  worker service?

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
