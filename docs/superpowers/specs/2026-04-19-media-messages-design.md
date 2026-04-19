# Media Messages (Image / Video / Audio) Design Spec

**Date:** 2026-04-19
**Status:** Draft - awaiting user review
**Scope:** v1 = web-only (`apps/web` running in a browser). Native parity is explicit follow-up work.

## Overview

Add image, video, and audio message support to Vine's user-to-user and user-to-OA chats. Follow LINE's UX: image/video selected from system picker and sent directly; audio recorded via hold-to-record on the mic button.

## File Size Limits (v1)

LINE Messaging API spec
([reference](https://developers.line.biz/en/reference/messaging-api/#image-message))
is the source of truth for the user-facing contract. We match it for `image`
and clamp `video`/`audio` to a smaller v1 cap because the upload pipeline is
in-memory.

| Type | LINE spec | v1 enforced cap | Why the v1 delta |
|------|-----------|-----------------|------------------|
| Image | JPEG/PNG, 10 MB | **10 MB** | LINE-aligned; no delta. |
| Video | mp4, 200 MB | **25 MB** | We `data.toBuffer()` the upload before handing it to `DriveService.put`. 200 MB would need a `putStream` API + multipart streaming. See "Future Work." |
| Audio | mp3/m4a, 200 MB | **25 MB** | Same in-memory constraint as video. ~30 min of mid-bitrate Opus/AAC fits comfortably. |

Per-type caps are enforced **after** MIME validation, against `data.toBuffer().byteLength`. `@fastify/multipart`'s `limits.fileSize` is set to the largest per-type cap (25 MB) so requests above that are rejected pre-buffer with a 413; smaller per-type caps (e.g. images > 10 MB) are then enforced with their own 413 carrying a typed message. This avoids loading multi-MB videos only to reject as oversized images.

## Architecture

### 1. Image Message

**UX flow:**
1. User taps the photo icon in `MessageInput`
2. Hidden `<input type="file" accept="image/*">` opens the browser picker
3. On selection: file uploads to `POST /api/v1/media/upload`, gets a public URL back
4. Client calls `zero.mutate.message.send` with `type: 'image'` and `metadata: JSON.stringify({ originalContentUrl })`

**Bubble:** `ImageBubble` — shows the image, taps to open a full-screen lightbox.

### 2. Video Message

**UX flow:** identical to image, with `accept="video/*"`. Sent as `type: 'video'`.

**Bubble:** `VideoBubble` — shows a placeholder with a play overlay. Tapping swaps to a native `<video controls>` element. Thumbnail extraction is deferred (see Future Work); v1 shows a generic dark placeholder until the user taps play.

### 3. Audio Message

**UX flow:**
1. User **press-and-holds** the mic icon in `MessageInput` (`onPressIn`)
2. Recording starts; a strip above the input shows a pulsing red dot and elapsed `MM:SS`
3. User **releases** the mic (`onPressOut`) → recording stops, uploads, sends as `type: 'audio'` with `metadata: JSON.stringify({ originalContentUrl, duration })`
4. While recording, dragging the finger out of the mic button fires `onResponderTerminate` (or pointer-leave on web) and **cancels** the recording — nothing is sent

**Recording:** `MediaRecorder` API. The hook negotiates MIME: prefers `audio/mp4` (Safari-compatible) and falls back to `audio/webm` (Chrome/Firefox).

**Bubble:** `AudioBubble` — play/pause button, current time / total duration. No waveform in v1.

### 4. Message Bubble Rendering

| Component | File | Purpose |
|-----------|------|---------|
| `ImageBubble` | `~/interface/message/ImageBubble.tsx` | Display image, tap for lightbox |
| `VideoBubble` | `~/interface/message/VideoBubble.tsx` | Placeholder + play overlay; tap to open `<video controls>` |
| `AudioBubble` | `~/interface/message/AudioBubble.tsx` | Play/pause + duration |
| `UnsupportedBubble` | (already exists) | Used for unhandled types |

`MessageBubbleFactory` adds `if`-cases for `image`, `video`, `audio` matching the existing `text` / `flex` style.

### 5. Backend Upload Endpoint

**`POST /api/v1/media/upload`**
- Auth: requires a valid better-auth session, resolved via `getAuthDataFromRequest(auth, webReq)` (same pattern `zeroPlugin` uses). 401 if no auth data.
- Content-Type: `multipart/form-data`, single file under field name `file`
- Allowed MIME (LINE-aligned where practical):
  - **Image:** `image/jpeg`, `image/png` (LINE-strict — no GIF, no WebP).
  - **Video:** `video/mp4` (LINE-strict — no QuickTime, no WebM).
  - **Audio LINE-strict:** `audio/mpeg` (mp3), `audio/mp4` (m4a), `audio/x-m4a`.
  - **Audio browser-recorder pragma:** `audio/webm`, `audio/ogg`. Web `MediaRecorder` outputs these on Chrome / Firefox; rather than running a server-side transcoder for v1 we accept them as-is. Vine is a LINE-clone, not a Messaging API integration, so we control the receiver — files persist with their original container extension.
  - Codec parameters (`audio/webm;codecs=opus`, `video/mp4;codecs="avc1.42E01E"`) are stripped before lookup via `stripMimeParams`.
- Size enforced in two stages — `@fastify/multipart` `limits.fileSize` rejects payloads above the largest per-type cap; the route then enforces per-type caps after `toBuffer()` (see "File Size Limits" above) and returns a typed 413 message (e.g. `"image exceeds the 10 MB limit"`).
- Stores via `drive.put(key, buffer, mimeType)` with key `media/<userId>/<random>.<ext>`
- Returns `{ url: string }` — the URL produced by `drive.getUrl(key)`

### 6. Static File Serving

`drive.getUrl()` returns `${DRIVE_BASE_URL}/${key}` (defaults to `http://localhost:3001/uploads/<key>`). For these URLs to actually resolve, the server registers `@fastify/static`:

```ts
await app.register(import('@fastify/static'), {
  root: path.resolve(process.env['DRIVE_BASE_PATH'] ?? './uploads'),
  prefix: '/uploads/',
  decorateReply: false,
})
```

This is a one-line addition next to the existing plugin registrations and is the same path-prefix that the FS drive already advertises, so no client URL rewriting is needed. (Production with the S3 driver would skip this and serve from S3 directly.)

### 7. Zero Schema and Mutation

No schema changes. The existing `message.send` mutation already accepts `type` and `metadata`. The client passes:

```ts
zero.mutate.message.send({
  id: crypto.randomUUID(),
  chatId,
  senderId: userId,
  senderType: 'user',
  type: 'image' | 'video' | 'audio',
  text: null,
  metadata: JSON.stringify({ originalContentUrl, duration? }),
  createdAt: Date.now(),
})
```

Bubbles parse `metadata` with `JSON.parse(message.metadata ?? '{}')`. If parse fails, fall back to `UnsupportedBubble`.

### 8. Upload Progress in the Bubble

`useMediaUpload` exposes `progress: 0..1` and `status: 'idle' | 'uploading' | 'done' | 'error'`. While `uploading`, the message is not yet sent — the user sees the loading state on the picker affordance, not in the message stream. (The bubble only renders after `zero.mutate.message.send` runs, so the progress feedback lives in `MessageInput`'s photo button, not the bubble.) An optional inline upload-state placeholder bubble is **deferred** to keep the v1 surface small.

For send failures, show a toast (`showToast`) and leave the picker re-armed. No retry UI on existing bubbles in v1.

### 9. OA Messages

OA inbound media messages already work via the existing `POST /api/oa/v2/bot/message/:messageId/content` flow (`oa-messaging.ts`). No changes here. The new `/api/v1/media/upload` endpoint is for the user-side composer only.

### 10. Component Inventory

| Component | Location | Notes |
|-----------|----------|-------|
| `MessageBubbleFactory` | `~/interface/message/MessageBubbleFactory.tsx` | Add image/video/audio cases |
| `ImageBubble` | `~/interface/message/ImageBubble.tsx` | New |
| `VideoBubble` | `~/interface/message/VideoBubble.tsx` | New |
| `AudioBubble` | `~/interface/message/AudioBubble.tsx` | New |
| `MessageInput` | `~/features/chat/ui/MessageInput.tsx` | Surgical edits: wire photo button to picker, switch mic wrapper to a Pressable with `onPressIn` / `onPressOut`, render recording strip when active |
| `useMessages` | `~/features/chat/useMessages.ts` | Add `sendMedia(type, url, extra?)` |
| `useMediaUpload` | New (`~/features/chat/useMediaUpload.ts`) | XHR upload with progress + abort |
| `useAudioRecorder` | New (`~/features/chat/useAudioRecorder.ts`) | MediaRecorder wrapper with MIME negotiation |
| `mediaUploadPlugin` | New (`apps/server/src/plugins/media-upload.ts`) | Auth-gated upload route |
| `@fastify/static` registration | `apps/server/src/index.ts` | Serves `/uploads/*` |

### 11. Security Notes

- The upload endpoint is auth-gated. Anonymous users get 401.
- File-key namespace is per-user (`media/<userId>/...`) so we have a path to per-user quota / cleanup later.
- We do not validate that the `originalContentUrl` in a Zero mutation actually points at our drive — Zero's `message.send` permission already requires the sender be a chat member, which is the relevant authorization. URL substitution by a malicious sender at most leaks a URL the sender already chose to share.

## Future Work (deliberately out of v1)

- **Native parity** — implementation plan: `docs/superpowers/plans/2026-04-19-media-messages-native-plan.md` (4 phases, ~3.5–4 days). v1 ships native no-op stubs (web v1 plan Task 0) so the native bundle still builds and renders "coming soon" placeholders.
- Image client-side compression for >10 MB images.
- Video thumbnail extraction (web `<video>` + canvas, or server-side ffmpeg).
- Audio waveform visualization.
- Chat-list preview text (`[Photo]` / `[Video]` / `[Audio] 0:32`) — small, but touches the chat list rendering and isn't on the critical path.
- Streaming uploads + signed URLs for files > 25 MB so we can match LINE's 200 MB caps for video and audio. Requires a `putStream(key, readable, mime)` API on `DriveService` and re-wiring `mediaUploadPlugin` to forward `data.file` directly without buffering.
- Server-side transcode of `audio/webm` → `audio/m4a` so audio messages composed from Chrome/Firefox conform to LINE's strict mp3/m4a-only audio spec on the wire (currently kept as-is because vine is a clone, not an integration).
- `previewImageUrl` thumbnails for `image` and `video` to fully match the LINE message-object schema (currently we only emit `originalContentUrl`).
- File cleanup job (orphan deletion + delete-on-message-delete).
- Per-bubble upload-progress placeholder and per-bubble retry button for failed sends.

## Open Questions

1. Do we want OA-side media composing in this v1 (e.g., the OA console sending an image to a friend), or is OA media still purely "OA receives an upload via the existing v2 endpoint"? **Assumption for v1: OA composing is out of scope.**
2. Should `ImageBubble`'s lightbox be a real `Sheet` (Tamagui) for portal/escape-handling, or is the current `position:absolute` overlay good enough? **Assumption: the simple overlay is fine for v1; revisit if QA finds focus-trap issues.**
