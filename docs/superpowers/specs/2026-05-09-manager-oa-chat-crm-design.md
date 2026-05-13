# Manager OA Chat CRM Design

Date: 2026-05-09

## Context

Phase 2 evolves the existing OA manager chat MVP into daily support tooling.
Vine is a standalone product; LINE Official Account Manager references are used
only as product reference. This phase must use Vine's own routes, Zero sync
layer, database schema, ConnectRPC services where needed, and existing manager
chat workspace.

The functional source of truth for this phase is
`docs/line-oa-manger-chat-CRM.md`. The broader UI analysis in
`docs/line-ui-reference/manager/oa-chat.md` remains useful for layout context,
but it includes capabilities that are not part of this phase.

This spec is intentionally synchronized with `docs/oa-manager-roadmap.md`.
Changes to Phase 2 scope should update both files together.

## Goals

- Keep the current four-column OA chat workspace.
- Add contact list mode so operators can manage OA friends without opening each
  conversation first.
- Add real CRM profile panel data: friendship status, last interaction,
  provider-scoped user ID, chat status, tags, and notes.
- Add OA-scoped tag management and assignment.
- Add manager-only notes for OA contacts.
- Add default and saved custom filters for chat list filtering.
- Define Vine's minimum retention and export policy for OA chat CRM data.
- Preserve tag data in a form that Phase 3 can use for tag-based audiences.

## Non-goals

- No official LINE cloud integration or calls to LINE-hosted services.
- No scheduled sending in Phase 2.
- No broadcast, multicast, or narrowcast sending in Phase 2.
- No standard replies in Phase 2.
- No response hours or off-hours auto-response in Phase 2.
- No call settings in Phase 2.
- No sticker/media/template/Flex send expansion in Phase 2 unless a separate
  spec pulls a specific message type forward.
- No paid-plan enforcement copied from LINE's chat advanced plan. Vine may show
  caps to keep the data model bounded, but it should not imply LINE plan
  compatibility.

## Phase Split

### Phase 2A: Contact CRM Foundation

Add contact list mode to `/manager/:oaId/chat`. Operators can switch between
chat list and contact list without leaving the OA chat workspace.

Contact list rows show:

- user avatar and display name;
- provider-scoped user ID;
- friendship status;
- last interaction time;
- unread or current chat status when available.

Selecting a contact opens the profile panel and, if a chat exists, the
conversation. If a friend has no current chat, the chat room should show a clear
empty state rather than fabricating a conversation.

### Phase 2B: Tags And Notes

Add OA-scoped CRM tags and manager-only notes.

Tags:

- belong to the OA or provider boundary, not the global user identity;
- can be created, renamed, deleted, and assigned to contacts;
- appear in the contact list, chat list, and profile panel where space allows;
- can be removed from a contact without deleting the tag definition.

Notes:

- belong to the OA contact relationship;
- are visible only to managers;
- support editing from the profile panel;
- should update without changing user-side chat behavior.

### Phase 2C: Filters

Triage status (pending, done, assigned) is deferred to Phase 6 when
multi-operator roles make it meaningful. Phase 2C focuses on default filters and
saved custom filters only.

Default filters (built-in, no schema change):

- All: show every chat (default);
- Unread: chats where the last message is from the user and the OA member has
  not read it yet (derived from existing `lastReadMessageId`).

Saved custom filters:

- operators can create, rename, update, and delete filters;
- saved filters are scoped to the OA, max 20 per OA;
- each filter stores a name, selected tag IDs, and match mode (AND or OR);
- filters match chats whose user has tag assignments satisfying the selected
  tags and match mode;
- the create/edit modal shows a live hit count: how many chat rooms match the
  current criteria in real time, computed client-side from Zero-synced data.

Filter management UI:

- accessed from COL1 sidebar under a "Custom filters" entry;
- clicking it navigates to a settings-style page (sidebar + full content area),
  not the four-column chat workspace;
- the page shows a list of saved filters with sort, edit, and delete controls;
- create and edit open a modal with: filter name input, tag chips selector,
  AND/OR match mode toggle, and live hit count;
- a "Back to chat" link returns to the chat workspace.

Filter selection UI (applying a filter):

- a dropdown above the search bar in the chat list (COL2, chats mode only);
- dropdown sections: default filters (All, Unread) at top, then a collapsible
  "Custom filters" group listing saved filters;
- selecting a filter filters the chat list in-place; the active filter name
  is shown as the dropdown label.

### Phase 2D: Retention And Export Policy

Define Vine's minimum policy for OA CRM data and ship the first export surface.
This is not a backup/compliance system; it is a pragmatic owner-only CRM export
that gives managers a portable contact snapshot.

Retention policy:

- chat messages continue to be retained by Vine's normal message storage with
  no LINE-style six-month or five-year paid-plan cutoff;
- Phase 2D does not add automatic message pruning, archive tiers, or legal-hold
  workflows;
- contact tags, tag assignments, saved filters, and manager notes are retained
  until the manager deletes the CRM data, the OA is deleted, or a later account
  erasure flow removes the related OA/user data;
- manager notes and tags remain manager-only CRM data and do not change
  user-side chat behavior.

First export surface:

- an OA owner can export a UTF-8 CSV contact CRM snapshot for one OA;
- the export contains one row per OA contact/friendship visible to the manager;
- columns: provider-scoped user ID, display name, friendship status, last
  interaction time, current chat status when available, tag IDs, tag names,
  manager note text, and export timestamp;
- tag values are flattened for CSV: IDs and names are each semicolon-separated
  in stable name order;
- note text is CSV-escaped and exported as plain text.

Intentionally unavailable in Phase 2D:

- chat message body export;
- chat attachment/media binary export;
- full workspace backup and restore;
- scheduled recurring exports;
- export of deleted user data;
- export by non-owner operators before Phase 6 roles exist.

This slice should not copy LINE's paid-plan limits. It should state Vine's own
behavior and make unsupported export/backup features explicit.

## Data Model Direction

Prefer Zero-synced data for CRM state that operators need to see update in the
workspace:

- OA contact CRM profile;
- tag definitions;
- tag assignments;
- contact notes;
- saved filters.

Likely entities:

- `oaContactProfile`: one row per OA/user relationship for manager-only CRM
  fields such as note text and internal metadata.
- `oaContactTag`: OA-scoped tag definition.
- `oaContactTagAssignment`: relation between a tag and a user/OA contact.
- `oaChatFilter`: saved filter definition for a manager or OA.

Use caller-generated IDs and timestamps for Zero mutations. Permission rules
must follow the current manager-owned OA pattern: only the OA provider owner can
read or mutate manager CRM data until Phase 6 introduces multi-operator roles.

## UI Design

The current workspace remains the base:

- COL1: manager chat navigation;
- COL2: chat list, contact list, tag management, or filter list depending on
  selected mode;
- COL3: selected chat room or selected management panel;
- COL4: contact profile panel.

Phase 2 should avoid visible dead navigation. Add routes or navigation entries
only when the corresponding view is data-backed enough to be useful.

Profile panel additions:

- provider-scoped user ID;
- friendship status;
- last interaction;
- tag chips with add/remove controls;
- editable note area.

Filtering UI:

- a dropdown above the chat list search bar for selecting the active filter;
- default filters (All, Unread) shown at the top of the dropdown;
- saved custom filters shown in a collapsible group below default filters;
- filter management on a separate settings-style page accessible from the
  sidebar, not inside the chat workspace columns.

Export UI:

- expose one owner-only "Export contacts CSV" action from the CRM/contact
  management area;
- label the action as a contact CRM export, not a chat history backup;
- show a lightweight unavailable state or disabled copy for chat history export
  so managers understand that message backup is not part of Phase 2D.

## Phase 3 Handoff

Phase 2 does not send broadcasts. It must still shape tag data so Phase 3 can
build tag-based audiences without reworking CRM tags.

The Phase 3 handoff is:

- tag definitions are stable and OA-scoped;
- tag assignments are queryable by OA and tag;
- contact list and filters can identify the users that belong to a tag.

Broadcast send flow, quota checks, recipient expansion, and campaign statistics
remain Phase 3 work.

## Testing

Add focused tests as each slice ships:

- Zero permission tests for contact CRM rows, tag definitions, assignments,
  notes, and saved filters.
- Zero mutation tests for create/update/delete operations.
- Query tests that manager-owned OA data is visible only to the OA owner.
- Web integration coverage for contact list mode, tag assignment, note editing,
  default filters, and saved custom filters.
- Server or integration coverage that the contact CRM CSV export is owner-only,
  includes the selected columns, escapes notes safely, and excludes chat message
  bodies.
- Regression coverage that user-side chat behavior and existing OA chat send
  behavior are unchanged.

Retention/export policy tests should cover that unsupported chat history export
does not appear as an available Phase 2 action.

## Acceptance Criteria

- `/manager/:oaId/chat` supports both chat list and contact list CRM workflows.
- Operators can see CRM profile fields for an OA contact.
- Operators can create CRM tags and assign or remove them from contacts.
- Operators can write manager-only notes on OA contacts.
- Operators can use default filters (All, Unread) and saved custom tag filters.
- Retention behavior is documented without LINE paid-plan limits.
- OA owners can export a contact CRM CSV snapshot for an OA.
- Chat message body export, media export, full backup/restore, scheduled
  exports, and non-owner export are unavailable in Phase 2.
- Scheduled sending, standard replies, response hours, and broadcast sending are
  absent from Phase 2 UI unless a later approved spec changes the roadmap.
- User-side chat behavior remains unchanged.
- `docs/oa-manager-roadmap.md` and this spec describe the same Phase 2 scope.
