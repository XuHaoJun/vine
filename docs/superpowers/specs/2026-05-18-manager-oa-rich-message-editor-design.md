# Manager OA Rich Message Editor Design

Date: 2026-05-18

## Context

Phase 4A rich menu LINE parity is complete. Phase 4B starts the next
interactive-content slice for Vine Official Account Manager.

This phase is not a template-message phase. Vine has historical API and database
traces for `template`, but manager authoring should not expose template
messages. Flex Messages cover that product space better for Vine. Phase 4B is a
shared **Rich Message Editor** for structured outbound message authoring.

The editor is for the OA manager back office. It is closer to a marketing
message composer than the user chat composer in `/home/(tabs)/talks`. Its live
preview should still render message bubbles consistently with the real chat
surface so managers see what recipients will see.

Vine remains a standalone product. LINE documentation and Tiptap architecture
are references only. Do not call LINE cloud services or add `@tiptap/*` as a
dependency for this phase.

## Goals

- Add a shared Rich Message Editor that edits `MessageDraft[]` as controlled
  React state.
- Use a Tiptap-like headless editor core with extensions, starter-kit
  configuration, and commands instead of a large switch-based component.
- Support a slim composer UI: live preview as the main surface, bottom toolbar
  icon buttons for inserting message types, and dialogs for complex message
  forms.
- Support these first-sendable message types:
  - text;
  - image by URL;
  - video by URL;
  - audio by URL;
  - Flex Message.
- Keep quick reply payload/core compatibility, but do not expose quick reply UI
  in Phase 4B.
- Show imagemap, sticker, and location toolbar actions as disabled or
  coming-soon entries without allowing editor sends.
- Reuse the existing Flex Simulator editor/preview by extracting a shared
  `FlexMessageJsonEditor`.
- Integrate the editor with both OA one-on-one manager chat and campaign
  broadcast workflows.
- Evolve campaigns away from `messageText` by adding rich message payload
  storage and display summaries.

## Non-goals

- No template message authoring.
- No reusable `messagePackage` table, message package library, or saved content
  library.
- No media upload picker or asset library. Image, video, and audio authoring
  use HTTPS URL forms in this phase.
- No quick reply editor UI in the first version.
- No sendable imagemap authoring in the first version.
- No sticker picker and no manual sticker ID form in the first version.
- No location picker and no manual coordinate form in the first version.
- No automation journeys, coupons, payments, recurring schedules, or n8n-style
  automation.
- No full Tiptap/ProseMirror/contenteditable engine.
- No official LINE cloud integration.

## Product Shape

The editor value is controlled by its parent:

```ts
type RichMessageEditorProps = {
  value: MessageDraft[]
  onChange(next: MessageDraft[]): void
  extensions?: RichMessageExtension[]
  maxMessages?: number
  disabledTypes?: string[]
}
```

`maxMessages` is intentionally not hard-coded to LINE's five-message limit.
When undefined, the headless editor core applies no count limit. Each channel
wrapper decides its own limit and passes it in. The editor disables insertion
commands and toolbar buttons once the active limit is reached.

The first Phase 4B integrations should use:

- manager OA chat: omit `maxMessages` unless the chat surface later needs a
  hard channel-specific limit;
- campaigns: omit `maxMessages` unless campaign policy later needs a hard
  channel-specific limit;
- future Messaging API facade flows: can apply LINE-like limits without changing
  the editor core.

## Architecture

Phase 4B uses three layers.

### 1. Headless Core

`RichMessageEditorInstance` owns:

- current `MessageDraft[]`;
- normalized extensions;
- selected or focused draft ID;
- validation state;
- command methods;
- `can()` guards;
- serialization helpers.

It does not import Tamagui layout, router APIs, chat hooks, campaign hooks, or
channel-specific service clients.

Core command shape:

```ts
type RichMessageEditorCommands = {
  insertMessage(type: string): boolean
  updateMessage(id: string, patch: Partial<MessageDraft>): boolean
  replaceMessage(id: string, next: MessageDraft): boolean
  removeMessage(id: string): boolean
  duplicateMessage(id: string): boolean
  moveMessage(id: string, direction: 'up' | 'down'): boolean
  attachQuickReply(id: string, quickReply: QuickReplyDraft): boolean
  clearQuickReply(id: string): boolean
}
```

The UI calls commands instead of mutating the `MessageDraft[]` array directly.
That keeps toolbar buttons, dialogs, preview block actions, and channel wrappers
using the same behavior.

### 2. Extension Layer

Message types are added through extensions:

```ts
type RichMessageExtension<TDraft extends MessageDraft = MessageDraft> = {
  type: TDraft['type']
  label: string
  icon: React.ComponentType
  group: 'basic' | 'media' | 'interactive' | 'disabled'
  status: 'enabled' | 'disabled'
  priority?: number
  configure?(options: Record<string, unknown>): RichMessageExtension<TDraft>
  createDraft(): TDraft
  validate(draft: TDraft): ValidationResult
  toMessagingApi(draft: TDraft): unknown
  fromMessagingApi(message: unknown): TDraft | null
  renderEditor(props: DraftEditorProps<TDraft>): React.ReactNode
  renderPreview(props: DraftPreviewProps<TDraft>): React.ReactNode
}
```

The extension list is resolved similarly to Tiptap:

- flatten starter kits into child extensions;
- sort by optional priority;
- warn or reject duplicate extension `type` values;
- allow configured extensions to override default options;
- collect toolbar items, validation, serializers, and renderers from the same
  extension registry.

Phase 4B should provide a default starter kit:

```ts
const extensions = RichMessageStarterKit.configure({
  text: true,
  mediaUrl: true,
  flex: true,
  imagemap: { status: 'disabled' },
  sticker: { status: 'disabled' },
  location: { status: 'disabled' },
})
```

Direct `extensions: RichMessageExtension[]` remains available for future
specialized editor surfaces.

### 3. React UI Layer

The default UI is a slim composer:

- live preview occupies the main area;
- bottom toolbar shows icon buttons generated from enabled and disabled
  extensions;
- text inserts a draft directly;
- image/video/audio/Flex open dialogs because they need structured
  fields;
- preview blocks can be selected and reopened for editing;
- reaching `maxMessages` disables insert buttons and shows inline status text;
- validation errors are inline near the affected preview block or dialog field,
  not modal alerts.

Use `~/interface/*` components where matching shared components exist. Keep the
UI Tamagui-based and follow RN-first layout rules.

## Draft Model

Use a type-safe discriminated union for known messages, plus an unknown fallback
for forward compatibility.

```ts
type MessageDraft =
  | TextMessageDraft
  | ImageMessageDraft
  | VideoMessageDraft
  | AudioMessageDraft
  | FlexMessageDraft
  | ImagemapMessageDraft
  | UnknownMessageDraft

type BaseMessageDraft = {
  id: string
  quickReply?: QuickReplyDraft
}

type TextMessageDraft = BaseMessageDraft & {
  type: 'text'
  text: string
}

type ImageMessageDraft = BaseMessageDraft & {
  type: 'image'
  originalContentUrl: string
  previewImageUrl: string
}

type VideoMessageDraft = BaseMessageDraft & {
  type: 'video'
  originalContentUrl: string
  previewImageUrl: string
}

type AudioMessageDraft = BaseMessageDraft & {
  type: 'audio'
  originalContentUrl: string
  duration?: number
}

type FlexMessageDraft = BaseMessageDraft & {
  type: 'flex'
  altText: string
  contents: unknown
}

type ImagemapMessageDraft = BaseMessageDraft & {
  type: 'imagemap'
  altText: string
  baseUrl: string
  baseSize: { width: number; height: number }
  actions: ImagemapActionDraft[]
}

type UnknownMessageDraft = BaseMessageDraft & {
  type: string
  raw: unknown
}
```

Unknown drafts may be displayed in read-only form and preserved during editing,
but they cannot be sent unless a matching enabled extension validates and
serializes them.

## First-Version Message Types

### Text

Text drafts validate the same constraints as the Messaging API text validator:

- non-empty text before send;
- maximum text length aligned with current server validation;
- optional quick reply metadata.

### Image URL

Image drafts use a dialog with:

- `originalContentUrl`;
- `previewImageUrl`.

Both URLs must be HTTPS. No upload picker is included.

### Video URL

Video drafts use a dialog with:

- `originalContentUrl`;
- `previewImageUrl`.

Both URLs must be HTTPS. No upload picker is included.

### Audio URL

Audio drafts use a dialog with:

- `originalContentUrl`;
- optional `duration` in milliseconds.

The URL must be HTTPS. No upload picker is included.

### Flex

Flex drafts open a dialog that uses a shared `FlexMessageJsonEditor`. The
existing `/developers/flex-simulator` page should be refactored to use the same
component for JSON input, validation state, and preview.

The dialog behavior:

- opens with the selected draft JSON;
- validates through the existing Flex schema;
- save replaces the selected draft;
- cancel leaves the draft unchanged.

### Imagemap

Imagemap authoring is deferred. The toolbar may show imagemap as a disabled
or coming-soon action, but Phase 4B does not produce sendable imagemap drafts.

A future imagemap editor should use a structured dialog for:

- `altText`;
- `baseUrl`;
- `baseSize`;
- actions and areas;
- optional video fields in an advanced section, using the existing
  `@vine/imagemap-schema` video shape.

Validation must reuse `@vine/imagemap-schema` semantics. A future dialog may
start as a structured form with compact action rows rather than a visual area
editor, but it must still provide valid `actions`.

### Quick Reply

Quick reply is not a standalone message draft. It is an attachment on a message
draft. Phase 4B keeps core/server payload compatibility only and does not expose
quick reply editing UI.

Validation reuses the existing `QuickReplySchema`. Postback actions remain
Vine-owned webhook dispatch behavior, not LINE cloud behavior.

### Disabled Types

Imagemap, sticker, and location appear in the toolbar as disabled or
coming-soon actions. They are excluded from editor sendable validation in Phase
4B. Messaging API server validation still supports sticker and location.

## Preview Rendering

The live preview should use the same visual language as the real chat surface:

- reuse `MessageBubbleFactory` or extract a shared preview-friendly wrapper
  around the same bubble components;
- render text, image, video, audio, and Flex as close to recipient
  chat as possible;
- avoid copying the user-side chat input, chat membership behavior, read state,
  or conversation navigation into the manager editor;
- make the preview selectable so managers can reopen a draft's edit dialog.

The preview is a manager authoring preview, not the actual `/home/(tabs)/talks`
screen.

## OA Chat Integration

Current manager OA chat sending is text-only through `message.sendAsOA`. Phase
4B needs a rich OA send path that accepts serialized drafts.

Expected behavior:

- manager selects or opens a contact chat;
- manager opens the Rich Message Editor;
- editor validates `MessageDraft[]`;
- drafts serialize to Messaging API-compatible message objects;
- send creates one `message` row per draft with:
  - `senderType: 'oa'`;
  - `oaId`;
  - `type`;
  - `text`;
  - `metadata`;
  - shared send timestamp ordering;
- chat `lastMessageId` and `lastMessageAt` point to the final inserted message.

Authorization remains owner-only until Phase 6 roles exist. The mutation must
verify the manager owns the OA and that the target chat belongs to the OA.

## Campaign Integration

Current campaigns are text-only. Phase 4B changes campaign sending to use rich
message payloads.

Add campaign storage:

```ts
messagePayloadJson: jsonb
messageSummary: text
```

`messagePayloadJson` stores the serialized Messaging API-compatible message
array and becomes the source of truth for new campaigns.

`messageSummary` stores a compact display string for lists and cards:

- text: first text content, truncated for display;
- flex: `Flex: {altText}`;
- image/video/audio: type label;
- multi-message: include a count such as `3 messages` when useful.

Mark `messageText` as deprecated:

- keep the column for old campaign rows and backward compatibility;
- new rich campaign flows should not write `messageText` as their source of
  truth;
- old rows can be displayed by falling back from `messagePayloadJson` to
  `messageText`;
- deleting the column is a later migration, not part of Phase 4B.

Quota remains counted per recipient, not per message object.

## Serialization And Validation

Add shared helpers near the editor or a manager-rich-message feature module:

```ts
function validateMessageDrafts(
  drafts: MessageDraft[],
  extensions: RichMessageExtension[],
): ValidationResult

function toMessagingApiMessages(
  drafts: MessageDraft[],
  extensions: RichMessageExtension[],
): unknown[]

function fromMessagingApiMessages(
  messages: unknown[],
  extensions: RichMessageExtension[],
): MessageDraft[]

function summarizeMessagingMessages(messages: unknown[]): string
```

Server-side validation remains authoritative. Client validation improves UX but
does not replace service or API validation.

Avoid ad hoc string manipulation for payload conversion. Use existing Valibot
schemas where available:

- `FlexMessageSchema`;
- `QuickReplySchema`;
- `ImagemapMessageSchema`;
- existing server `validateMessage()` behavior.

`ImagemapMessageSchema` remains relevant for server-side Messaging API
compatibility, but the Phase 4B editor does not produce imagemap drafts.

## Data Fetching And API Boundaries

- Use Zero for synced OA chat message rows and manager chat state.
- Use ConnectRPC + React Query for campaign sends, matching existing campaign
  manager flow.
- Do not introduce raw `fetch()` for normal manager data access.
- Do not expose server-only environment values to the client.

## Testing Strategy

Use TDD during implementation. The plan should write failing tests before
production changes.

Required coverage:

- editor core unit tests:
  - resolves starter kit extensions;
  - rejects duplicate extension types;
  - enforces `maxMessages`;
  - command methods update drafts immutably;
  - disabled extension types cannot be inserted;
  - validation blocks unknown sendable drafts;
- serialization unit tests:
  - text, image, video, audio, and Flex serialize to
    Messaging API-compatible objects;
  - quick reply metadata remains supported by core/server payload helpers but
    has no editor UI in this phase;
  - imagemap remains supported by server validation where applicable but has no
    editor send path in this phase;
  - invalid URLs and invalid Flex payloads fail validation;
  - summaries are stable for text, media, Flex, and multi-message
    payloads;
- Flex refactor unit or integration coverage:
  - existing Flex Simulator still validates and previews JSON;
  - `FlexMessageJsonEditor` can be used in a dialog-style controlled flow;
- OA chat unit tests:
  - rich OA send inserts multiple message rows;
  - chat last message points to the final inserted row;
  - owner and OA chat authorization are enforced;
- campaign service tests:
  - rich message campaign persists `messagePayloadJson` and `messageSummary`;
  - old `messageText` campaigns still display through fallback;
  - quota remains recipient-based;
- focused Playwright integration:
  - manager can compose a rich message with preview and send it in OA chat;
  - manager can compose a rich campaign and see a summary in the campaign list.

Run the relevant unit suites first, then the targeted integration runner for
manager OA chat/campaign flows.

## Acceptance Criteria

- The roadmap no longer describes Phase 4B as template message authoring.
- The Rich Message Editor is shared and controlled by `MessageDraft[]`.
- The editor uses a headless core with extension-driven toolbar, validation,
  preview, and serialization.
- `RichMessageStarterKit.configure(...)` is the default extension entry point.
- The default UI is a slim composer with live preview and bottom toolbar.
- Preview bubbles visually match the real talks chat rendering closely enough
  that managers can trust the output.
- Text, image URL, video URL, audio URL, and Flex can be
  authored and validated.
- Imagemap, sticker, and location are visible only as disabled or coming-soon
  actions.
- The Flex Simulator and Rich Message Editor share `FlexMessageJsonEditor`.
- OA chat can send multiple rich message drafts as OA messages.
- Campaigns can send rich message payloads, persist `messagePayloadJson`, and
  display `messageSummary`.
- New campaign code treats `messageText` as deprecated.
- No template message editor, upload picker, reusable message package, or LINE
  cloud integration is introduced.

## Reference Notes

Local Tiptap code reviewed for architecture inspiration:

- `/home/noah/vine/tiptap/packages/core/src/ExtensionManager.ts`
- `/home/noah/vine/tiptap/packages/core/src/Extendable.ts`
- `/home/noah/vine/tiptap/packages/core/src/CommandManager.ts`
- `/home/noah/vine/tiptap/packages/starter-kit/src/starter-kit.ts`
- `/home/noah/vine/tiptap/packages/react/src/useEditorState.ts`
- `/home/noah/vine/tiptap/packages/react/src/ReactNodeViewRenderer.tsx`

External Tiptap documentation reviewed:

- https://tiptap.dev/docs/editor/core-concepts/extensions
- https://tiptap.dev/docs/editor/core-concepts/schema
- https://tiptap.dev/docs/editor/extensions/custom-extensions/create-new/extension
- https://tiptap.dev/docs/editor/extensions/custom-extensions/node-views/react
- https://tiptap.dev/docs/ui-components/getting-started/overview
