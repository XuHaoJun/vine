# Manager OA Profile and Basic Settings Design

Date: 2026-05-09

## Context

Phase 0 added the OA manager home at `/manager/:oaId`. Phase 1 makes the
business profile editable from the manager and replaces user-facing profile mock
data with published OA profile data.

Vine is not the official LINE platform. LINE Official Account Manager,
`oa-profile.html`, and the provided screenshots are product references only.
The implementation must use Vine's own server, ConnectRPC services, DB schema,
Zero sync layer where appropriate, and user-facing profile UI.

The reference UI shows a `Business profile settings` page with a top OA manager
header, a publish/status row, a left profile preview made of editable blocks,
and a right editor pane. The default selected block is the main business
profile block.

## Goals

- Add a LINE-like business profile editor for a Vine Official Account.
- Keep the editor in an independent account-page route group, separate from the
  Phase 0 home layout.
- Support real draft auto-save and manual publish behavior.
- Support profile photo and cover photo upload, removal, draft preview, and
  publish.
- Represent and store every Business Profile section shown in the reference
  screenshot.
- Publish changes to the user-facing OA profile and remove mock profile values.
- Keep headers owned by each independent layout while allowing component-level
  reuse.

## Non-goals

- No official LINE, LY Corporation, LINE Developers Console, or
  `api.line.me` integration.
- No full plug-in marketplace.
- No block analytics, impression tracking, or click analytics.
- No provider/OA role management beyond current owner-only checks.
- No LINE certification, verification, or premium ID claims.
- No multi-operator collaborative merge flow.

## Information Architecture

The manager account route keeps the existing route boundary:

- `/manager/:oaId` remains the OA manager home.
- `/manager/:oaId/(home)/*` remains the general manager layout for home,
  rich menus, and related manager surfaces.
- `/manager/:oaId/(account-page)/*` is a dedicated business profile editor
  layout.

The account-page layout must not share a layout-level header with the home
layout. Each independent route group owns its own header because future manager
surfaces may need different header details. Shared code is allowed only at the
component level, for example:

- `OAAccountSwitcher`
- `OAHeaderAccountBadge`
- `OAUserMenu`
- `OAHelpMenu`
- `OAPublishStatus`

The initial route is:

- `/manager/:oaId/account-page/profile`

The Phase 0 home profile card edit action should navigate to that route.

Future-compatible block routes may be added if useful:

- `/manager/:oaId/account-page/plugin/notice/:blockId`
- `/manager/:oaId/account-page/plugin/media/:blockId`
- `/manager/:oaId/account-page/plugin/socialmedia/:blockId`
- `/manager/:oaId/account-page/plugin/information/:blockId`

The implementation should prefer route-addressable selected sections when it is
reasonable, so refresh and deep links remain stable. If One route complexity is
too high for Phase 1, selected-section state is acceptable as long as the
default route opens the business profile editor.

## Page Layout

The account-page editor contains:

- Top OA manager header:
  - OA identity and account switcher.
  - User/help controls where they exist in the manager.
  - Similar information architecture to the manager home header, but
    independently implemented.
- Business profile title/status row:
  - title: `Business profile settings`
  - save/publish status
  - `Publish` button
- Left preview pane:
  - independent scroll
  - profile page preview
  - editable block outlines
  - `Preview` button
  - bottom `Add plug-in` affordance
- Right editor pane:
  - selected block editor
  - page scroll
  - default editor: `Edit business profile`

The left preview shows draft state, not published state. The selected preview
block is highlighted with a dashed outline and an `Edit` badge.

Preview blocks in Phase 1:

- Business profile face
- Announcements
- Mixed media feed
- Social media
- Basic info

Block toggles auto-save enabled or disabled state to draft. Block order should
be represented in the data model. Reorder controls may be implemented in
Phase 1 if straightforward; otherwise they should appear disabled or omitted
without implying reorder has shipped.

## Draft And Publish Behavior

Phase 1 uses real draft and publish behavior:

- Any edit auto-saves to draft.
- The preview updates from draft.
- The user-facing public OA profile reads published data only.
- `Publish` validates the full draft and copies it to published profile data.
- `Reset` discards draft changes and restores current published data.

Save status states:

- `Saving changes`
- `Changes saved`
- `Save failed`
- `All changes have been published`

Status icons should match the state:

- saving: spinner or clock-style progress icon
- saved/published: check icon
- failed: warning icon

`Publish` is enabled only when the draft differs from published data and no
draft save is pending or failed. If draft equals published, status shows
`All changes have been published` and `Publish` is disabled.

## Data Model

Use separate published and draft tables.

### `oaBusinessProfile`

One row per OA. This is the published state.

Expected columns:

- `oaId`
- `displayName`
- `uniqueId`
- `statusMessage`
- `profileImageUrl`
- `coverImageUrl`
- `showFollowerCount`
- `footerButtonColor`
- `splashLabels`
- `buttons`
- `address`
- `phoneNumber`
- `paymentMethods`
- `businessHours`
- `websites`
- `visibilitySettings`
- `announcements`
- `mixedMediaFeed`
- `socialMedia`
- `basicInfoBlock`
- `blockOrder`
- `publishedAt`
- `createdAt`
- `updatedAt`

### `oaBusinessProfileDraft`

One row per OA. This is manager draft state.

Expected columns:

- same profile content fields as `oaBusinessProfile`
- `serverRevision`
- `lastSavedAt`
- `createdAt`
- `updatedAt`

Do not store the entire profile as one opaque JSON blob. The top-level model
should remain explicit. Composite values may use documented `jsonb` shapes where
they are naturally nested and not yet queried independently, such as:

- `address`
- `paymentMethods`
- `businessHours`
- `websites`
- `visibilitySettings`
- `buttons`
- `announcements`
- `mixedMediaFeed`
- `socialMedia`
- `basicInfoBlock`

Typed columns should be used for values that are commonly displayed, filtered,
validated independently, or synced to compatibility fields:

- `displayName`
- `uniqueId`
- `statusMessage`
- `profileImageUrl`
- `coverImageUrl`
- `showFollowerCount`
- `footerButtonColor`
- `splashLabels`
- timestamps and revision values

## Existing OA Compatibility

Existing `officialAccount` fields remain canonical for current APIs and list
views:

- `name`
- `uniqueId`
- `description`
- `imageUrl`
- `email`
- `country`
- `company`
- `industry`

Publishing a business profile updates both:

- `oaBusinessProfile`
- selected compatibility fields on `officialAccount`

Compatibility mapping:

- `displayName` -> `officialAccount.name`
- `uniqueId` -> `officialAccount.uniqueId`
- `statusMessage` -> `officialAccount.description`
- `profileImageUrl` -> `officialAccount.imageUrl`
- appropriate basic info fields -> existing `email`, `country`, `company`,
  `industry` when present

`uniqueId` remains globally unique. Editing it is allowed through the business
profile form, but the uniqueness check happens on publish. A duplicate
`uniqueId` blocks publish and leaves the draft intact.

Creating an OA should initialize published and draft business profile rows from
`officialAccount`. Opening the editor should create a missing draft from
published state for legacy accounts.

## RPC/API

Use ConnectRPC for all manager profile operations. Do not write draft state
from the browser through Zero mutations.

Add OA manager profile RPCs:

- `GetBusinessProfileEditorState`
  - input: `officialAccountId`
  - returns OA header data, published profile, draft profile, dirty status,
    block order, available editor sections, and publish status metadata
- `AutosaveBusinessProfileDraft`
  - input: `officialAccountId`, partial draft patch, optional
    `clientRevision`
  - writes draft only
  - returns saved draft, `serverRevision`, `savedAt`, and validation warnings
- `ResetBusinessProfileDraft`
  - input: `officialAccountId`
  - replaces draft with published profile
  - returns fresh editor state
- `PublishBusinessProfile`
  - input: `officialAccountId`, optional expected `serverRevision`
  - validates the whole draft
  - writes published profile and compatibility fields on `officialAccount`
  - returns published profile, draft profile, and status `published`
- `UploadBusinessProfileImage`
  - input: `officialAccountId`, image kind `profile | cover`, and image data
    or an upload token based on the existing asset storage pattern
  - validates file type and dimensions
  - stores the asset
  - writes the draft image field
  - returns saved draft field and preview URL
- `RemoveBusinessProfileImage`
  - input: `officialAccountId`, image kind `profile | cover`
  - clears the draft image field
  - published image remains unchanged until publish

Every RPC must:

- use `requireAuthData`
- call `assertOfficialAccountOwnedByUser`
- remain owner-only in Phase 1

Autosave is client-debounced. Autosave failures keep local dirty state visible
and allow retry. Publish is blocked while autosave is pending or failed.

Use a simple `serverRevision` integer or timestamp for draft conflict
detection. If a client saves against an old revision, return a conflict and ask
the manager to reload. Do not implement collaborative merging in Phase 1.

## Validation

Autosave performs field-level validation and may save incomplete drafts where
safe. Publish performs full validation and rejects invalid public state.

Validation rules:

- account name is required and follows current creation constraints
- unique ID is required, follows current creation constraints, and is globally
  unique at publish
- splash labels have at most 3 selected values
- footer button color must be one of the allowed palette values
- profile and cover image uploads accept JPG, JPEG, and PNG
- profile and cover uploads enforce size limits
- profile image should be cropped or required to a square form
- cover image should enforce or guide a wide aspect ratio
- URL fields must be valid URLs when provided
- visibility settings must not imply official LINE certification

## Frontend Details

The right editor defaults to `Edit business profile` and includes:

- profile photo upload/remove
- cover photo upload/remove
- account name
- unique ID
- status message
- show follower count
- buttons
- address/map info
- phone number
- payment methods
- business hours
- website info
- profile visibility settings
- footer button color
- footer button splash labels

Block editors:

- Announcements:
  - enabled toggle
  - title/body/link fields
- Mixed media feed:
  - enabled toggle
  - empty-state media grid if no real feed source exists
- Social media:
  - enabled toggle
  - social link list
- Basic info:
  - enabled toggle
  - display order and visibility of basic info rows

The footer `Add plug-in` affordance appears in the left preview. A full add
plug-in flow is out of scope for Phase 1.

Use project frontend conventions:

- `useAuth()` for auth state where needed
- `~/interface/*` components where available
- Tamagui layout patterns
- `useTanQuery` and `useTanMutation` for ConnectRPC calls
- no raw `fetch()` for normal server data

## User-facing Public Profile

`OADetailContent` currently contains mock cover, friend count, post count,
location, and description constants. Phase 1 removes those mock values.

Public profile behavior:

- read published `oaBusinessProfile`
- fall back to `officialAccount` for legacy accounts without published profile
  rows
- show real friend count
- show published profile image and cover image
- show published status message/description
- show published buttons, social links, and basic info when present
- never show draft-only changes before publish

Friendship and chat behavior remain unchanged.

## Testing

Server tests:

- editor state initializes draft from published state
- legacy account editor state creates missing draft from published or
  compatibility fields
- autosave writes draft only
- reset restores draft from published
- publish validates draft, writes published profile, and syncs compatibility
  fields to `officialAccount`
- duplicate `uniqueId` blocks publish
- non-owner access is rejected
- image upload rejects unsupported type and oversize files

Frontend tests:

- editor loads business profile by default
- autosave status moves through saving, saved, and error states
- publish is disabled when no unpublished changes exist
- preview reflects draft changes before publish
- public profile does not reflect draft-only changes
- public profile reflects changes after publish

Regression tests:

- `/manager/:oaId` home still loads
- chat routes still load
- rich menu routes still load
- account list still navigates to manager home
- existing OA search and resolve APIs keep returning compatibility fields

## Acceptance Criteria

- A manager can open `/manager/:oaId/account-page/profile` from the Phase 0
  home profile card.
- The account-page route has its own header implementation and may reuse only
  component-level header pieces.
- The editor shows a LINE-like split layout with preview blocks on the left and
  selected block editor on the right.
- The default selected block is Business profile.
- Editing any supported field auto-saves to draft and updates preview.
- Draft changes are not visible on the user-facing OA profile before publish.
- `Publish` applies the draft to published profile data and updates
  user-facing profile content.
- `Reset` discards draft changes and restores the current published state.
- Profile and cover images can be uploaded and removed in draft, then
  published.
- All Business Profile sections from the reference screenshot are represented
  and editable or storable in Phase 1.
- `Add plug-in` appears, but a full plugin marketplace is not implemented.
- UI copy avoids implying Vine is official LINE or LY infrastructure.

## Residual Risks

- The full structured profile schema is much larger than the current OA model
  and needs careful migration planning.
- Image upload behavior depends on the repo's existing asset storage pattern.
- Route-addressable block editors may need One routing details checked before
  implementation.
- Autosave can create a lot of writes; the implementation plan should include
  debounce timing and mutation invalidation details.

## References

- `docs/oa-manager-roadmap.md`
- `oa-profile.html`
- Provided LINE Official Account Manager screenshots
- LINE Developers reference skill:
  - `gain_friends_of_your_line_official_account.md`
  - `using_add_friend_buttons.md`
  - `get_user_profile_information.md`
  - `use_line_official_account.md`
