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
- Add default and saved filters for triage.
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

### Phase 2C: Filters And Triage

Add default triage filters based on the CRM reference:

- unread;
- pending;
- done;
- assigned or owned, implemented as an interim manager-side status until
  multi-operator roles exist.

Add saved custom filters based on chat status and tags. The first version should
avoid pretending to support unsupported dimensions. If message text, note text,
or date-range filtering is not backed by reliable queries, the UI should not
offer those conditions yet.

Saved filter behavior:

- operators can create, rename, update, and delete filters;
- saved filters are scoped to the OA;
- each filter stores selected statuses, selected tags, and match mode;
- cap the number of saved filters to keep the UI and sync payload bounded.

### Phase 2D: Retention And Export Policy

Define Vine's minimum policy for OA CRM data:

- what chat messages are retained;
- what contact tags and notes are retained;
- whether operators can export chat/contact CRM data;
- what export format is supported first;
- what data is intentionally not exportable yet.

This slice should not copy LINE's paid-plan limits. It should state Vine's own
behavior and make unsupported export/backup features explicit.

## Data Model Direction

Prefer Zero-synced data for CRM state that operators need to see update in the
workspace:

- OA contact CRM profile;
- tag definitions;
- tag assignments;
- contact notes;
- chat triage status;
- saved filters.

Likely entities:

- `oaContactProfile`: one row per OA/user relationship for manager-only CRM
  fields such as status, last interaction, and internal note summary.
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
- current triage status;
- tag chips with add/remove controls;
- editable note area.

Filtering UI:

- default filters should be one-click entries;
- saved filters should be listed below default filters;
- filter creation should use status and tag controls only in the first version.

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
  notes, triage status, and saved filters.
- Zero mutation tests for create/update/delete operations.
- Query tests that manager-owned OA data is visible only to the OA owner.
- Web integration coverage for contact list mode, tag assignment, note editing,
  default filters, and saved custom filters.
- Regression coverage that user-side chat behavior and existing OA chat send
  behavior are unchanged.

Retention/export policy tests should cover the chosen export boundary once the
export surface exists.

## Acceptance Criteria

- `/manager/:oaId/chat` supports both chat list and contact list CRM workflows.
- Operators can see CRM profile fields for an OA contact.
- Operators can create CRM tags and assign or remove them from contacts.
- Operators can write manager-only notes on OA contacts.
- Operators can use default triage filters and saved status/tag filters.
- Retention/export behavior is documented and implemented for the selected
  minimum surface.
- Scheduled sending, standard replies, response hours, and broadcast sending are
  absent from Phase 2 UI unless a later approved spec changes the roadmap.
- User-side chat behavior remains unchanged.
- `docs/oa-manager-roadmap.md` and this spec describe the same Phase 2 scope.
