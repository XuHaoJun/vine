# Media Messages — Native Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the native no-op stubs from the web v1 plan (`2026-04-19-media-messages-plan.md` Task 0) with real iOS/Android implementations of image, video, and audio messaging — using the existing Expo dev client, no Expo Go regression.

**Prerequisites:** The web v1 plan (`2026-04-19-media-messages-plan.md`) must be fully merged. This plan **only** touches `.native.tsx` files plus `apps/web/app.config.ts`, `MessageInput.tsx`, and a new shared upload variant. The web behavior is untouched.

**Architecture mirror of web v1:**

| Concern | Web (v1) | Native (this plan) |
|---|---|---|
| Pick image/video | `<input type="file">` | `expo-image-picker` |
| Record audio | `MediaRecorder` | `expo-audio` |
| Play audio | `new Audio(url)` | `expo-audio` `useAudioPlayer` |
| Play video | `<video controls>` | `expo-video` `VideoView` |
| Upload | `fetch` with `File` blob | `fetch` with `{ uri, name, type }` form-data shape |
| Image lightbox | absolute-positioned overlay | RN `Modal` |
| Permissions | browser prompt | Info.plist + AndroidManifest via `expo-build-properties` |

**Phasing rationale:** image is lowest risk (well-trodden picker + lightbox), video is moderate (one new native module), audio is the most complex (recorder + player + iOS audio session). Each phase can ship as an independent PR; users get an incremental capability bump per merge.

**File-key naming convention** (continue from web v1): `media/<userId>/<random>.<ext>`. The native uploader uses the same key shape so the existing server endpoint and cleanup story (when it lands) stay unified.

---

## Phase 0: App configuration and shared native upload

**Goal:** Land permissions, native picker dependency, and a shared `useMediaUpload.native.ts` that supports the URI-based upload shape native pickers return. After this phase, image/video/audio paths still go through stubs, but the underlying upload primitive is real.

### Task 0.1: Permissions in app.config.ts

**Files:**
- Modify: `apps/web/app.config.ts`

- [ ] **Step 1: Add Expo build-properties + permission strings**

Look for an existing `plugins` array in `app.config.ts`. Add (or merge into) entries for:

```ts
plugins: [
  // ...existing plugins...
  [
    'expo-build-properties',
    {
      ios: { deploymentTarget: '15.1' },
      android: { compileSdkVersion: 35, targetSdkVersion: 35 },
    },
  ],
  [
    'expo-image-picker',
    {
      photosPermission: '允許 Vine 從相簿選取照片與影片來傳送訊息。',
      cameraPermission: '允許 Vine 使用相機（目前未啟用）。',
    },
  ],
  [
    'expo-audio',
    {
      microphonePermission: '允許 Vine 錄製語音訊息。',
    },
  ],
],
```

If `expo-build-properties` is already configured (it appears in the web v1 dependencies), merge the iOS/Android sub-objects rather than duplicating the entry.

- [ ] **Step 2: Commit (config-only, no native rebuild yet)**

```bash
git add apps/web/app.config.ts
git commit -m "chore(native): add media-message permission strings to app.config"
```

### Task 0.2: Install native deps and prebuild

**Files:**
- Modify: `apps/web/package.json`, `bun.lock`
- Generated: `apps/web/ios/`, `apps/web/android/` (if not gitignored — check repo convention before staging)

- [ ] **Step 1: Install Expo SDK 55-compatible versions**

```bash
cd apps/web
bunx expo install expo-image-picker expo-audio expo-video
```

`expo install` (note: `bunx expo`, not `bun add`) is critical — it picks the SDK 55-compatible version range. Plain `bun add expo-audio` may install a newer version that breaks at runtime.

Verify in `apps/web/package.json`:
- `expo-image-picker` ~16.x (SDK 55)
- `expo-audio` ~0.4.x (SDK 55)
- `expo-video` ~2.x (SDK 55)

If `bunx expo install` complains about peer-dep mismatches, surface the conflict instead of forcing — SDK 55 + RN 0.83 + React 19 is bleeding-edge and may need a one-line override.

- [ ] **Step 2: Prebuild and verify both platforms compile**

```bash
bun run prebuild:native
bun run ios    # boots the sim and bundles
# stop ios sim, then:
bun run android
```

Both should reach the home screen. The app's existing behavior (chat list, login, sending text messages) must still work — if it doesn't, a native module conflict has surfaced and needs fixing before continuing.

- [ ] **Step 3: Commit**

Stage `apps/web/package.json`, `bun.lock`, and any generated native config the repo tracks (check `.gitignore` for `ios/`, `android/` first):

```bash
git add apps/web/package.json bun.lock
# Add ios/ and android/ only if not gitignored:
# git add apps/web/ios apps/web/android
git commit -m "feat(native): add expo-image-picker, expo-audio, expo-video deps"
```

### Task 0.3: Replace `useMediaUpload.native.ts` stub with a real URI uploader

**Files:**
- Modify: `apps/web/src/features/chat/useMediaUpload.native.ts`

The native picker / recorder return file URIs (`file:///...`), not browser `Blob`/`File` objects. RN's `FormData.append` accepts a `{ uri, name, type }` object as a third "file-like" form. The real native hook must accept either shape.

- [ ] **Step 1: Implement the native upload hook**

```ts
import { useCallback, useEffect, useRef, useState } from 'react'

type UploadStatus = 'idle' | 'uploading' | 'done' | 'error'

export type NativeFileInput = {
  uri: string
  name: string
  type: string
}

type UseMediaUploadReturn = {
  url: string | null
  progress: number
  status: UploadStatus
  error: string | null
  upload: (file: NativeFileInput) => Promise<string | null>
  abort: () => void
  reset: () => void
}

const API_URL = process.env['VITE_API_URL'] ?? ''

export function useMediaUpload(): UseMediaUploadReturn {
  const [url, setUrl] = useState<string | null>(null)
  const [progress, setProgress] = useState(0)
  const [status, setStatus] = useState<UploadStatus>('idle')
  const [error, setError] = useState<string | null>(null)
  const controllerRef = useRef<AbortController | null>(null)

  useEffect(() => {
    return () => controllerRef.current?.abort()
  }, [])

  const upload = useCallback(async (file: NativeFileInput): Promise<string | null> => {
    setStatus('uploading')
    setProgress(0)
    setError(null)

    const form = new FormData()
    // RN's FormData accepts the file-info-object form. The `as any` is the
    // standard idiom because TS types FormData against the web spec.
    form.append('file', { uri: file.uri, name: file.name, type: file.type } as any)

    const controller = new AbortController()
    controllerRef.current = controller

    try {
      const res = await fetch(`${API_URL}/api/v1/media/upload`, {
        method: 'POST',
        body: form,
        credentials: 'include',
        signal: controller.signal,
      })
      if (!res.ok) throw new Error(`Upload failed (${res.status})`)
      const data = (await res.json()) as { url?: string }
      if (!data.url) throw new Error('Malformed upload response')
      setUrl(data.url)
      setStatus('done')
      controllerRef.current = null
      // Native fetch doesn't expose upload progress without a third-party lib;
      // we keep `progress` at 0 → 1 transition only. Adding real progress would
      // require react-native-blob-util or expo-file-system uploadAsync.
      setProgress(1)
      return data.url
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Upload failed'
      setError(message)
      setStatus('error')
      controllerRef.current = null
      return null
    }
  }, [])

  const abort = useCallback(() => {
    controllerRef.current?.abort()
  }, [])

  const reset = useCallback(() => {
    setUrl(null)
    setProgress(0)
    setStatus('idle')
    setError(null)
  }, [])

  return { url, progress, status, error, upload, abort, reset }
}
```

Notes:
- The auth cookie travels via `credentials: 'include'` exactly like the web hook.
- Real progress events on native need `expo-file-system` `uploadAsync` (which has a `progressInterval` callback) or `react-native-blob-util`. For Phase 0 we deliberately ship without progress on native — the bubble UI doesn't surface progress in v1 anyway. A "real progress" follow-up task is listed in Future Work below.
- The hook signature **diverges** from web (web takes `File | Blob`, native takes `NativeFileInput`). Callers must construct the right shape per platform. `MessageInput` will get a thin platform-branched adapter in Phase 1.

- [ ] **Step 2: Typecheck**

```bash
bun run --cwd apps/web typecheck
```

The web typecheck should still pass — the `.native.ts` file is only consumed when the bundler resolves to it.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/features/chat/useMediaUpload.native.ts
git commit -m "feat(native): real URI-based media upload hook"
```

---

## Phase 1: Image messages on native

**Goal:** Picker → upload → send → cross-platform `ImageBubble` (already works on native, no changes). Native users can both **send** and **receive** image messages.

### Task 1.1: Native image picker hook

**Files:**
- Create: `apps/web/src/features/chat/useImagePicker.ts` (web stub)
- Create: `apps/web/src/features/chat/useImagePicker.native.ts`

We add a new abstraction `useImagePicker` so `MessageInput` can call a single API on both platforms. On web it just exposes the existing file-input ref; on native it opens the system picker.

- [ ] **Step 1: Web stub**

```ts
// apps/web/src/features/chat/useImagePicker.ts
import { useCallback } from 'react'

export type PickedMedia = {
  uri: string
  name: string
  type: string
  kind: 'image' | 'video'
}

export function useImagePicker() {
  const pick = useCallback(async (): Promise<PickedMedia | null> => {
    if (__DEV__) {
      console.warn('[useImagePicker] web should use the hidden <input> path, not this hook')
    }
    return null
  }, [])
  return { pick }
}
```

The web build keeps using the hidden `<input type="file">` from web v1. This stub exists only so `useImagePicker.native.ts` resolves cleanly during typechecking.

- [ ] **Step 2: Native implementation**

```ts
// apps/web/src/features/chat/useImagePicker.native.ts
import { useCallback } from 'react'
import * as ImagePicker from 'expo-image-picker'

export type PickedMedia = {
  uri: string
  name: string
  type: string
  kind: 'image' | 'video'
}

const VIDEO_EXT_RE = /\.(mp4|mov|m4v|webm)$/i

export function useImagePicker() {
  const pick = useCallback(async (): Promise<PickedMedia | null> => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (!perm.granted) return null

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.All,
      allowsMultipleSelection: false,
      quality: 0.85,
    })
    if (result.canceled || !result.assets[0]) return null

    const asset = result.assets[0]
    const uri = asset.uri
    const isVideo =
      asset.type === 'video' || (asset.fileName ? VIDEO_EXT_RE.test(asset.fileName) : false)
    const name = asset.fileName ?? (isVideo ? 'video.mp4' : 'image.jpg')
    const mimeType =
      asset.mimeType ?? (isVideo ? 'video/mp4' : 'image/jpeg')

    return { uri, name, type: mimeType, kind: isVideo ? 'video' : 'image' }
  }, [])

  return { pick }
}
```

If `ImagePicker.MediaTypeOptions` is deprecated in the installed version (it has been renamed across SDKs), use the new `mediaTypes: ['images', 'videos']` array form. Verify against the actually-installed `expo-image-picker` version — `bun --cwd apps/web list expo-image-picker`.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/features/chat/useImagePicker.ts apps/web/src/features/chat/useImagePicker.native.ts
git commit -m "feat(native): add useImagePicker hook"
```

### Task 1.2: Wire `MessageInput` to call the native picker

**Files:**
- Modify: `apps/web/src/features/chat/ui/MessageInput.tsx`

- [ ] **Step 1: Update `handlePhotoPress` and the platform-branched flow**

Replace the existing native short-circuit ("行動版即將支援照片") with a real call to `useImagePicker`. Also import `useImagePicker`:

```ts
import { useImagePicker } from '../useImagePicker'
```

In the component body:

```ts
const { pick } = useImagePicker()
```

Replace `handlePhotoPress` with:

```ts
const handlePhotoPress = useCallback(async () => {
  if (uploadStatus === 'uploading') return
  if (isWeb) {
    fileInputRef.current?.click()
    return
  }
  const picked = await pick()
  if (!picked || !onSendMedia) return
  const url = await upload({ uri: picked.uri, name: picked.name, type: picked.type })
  if (!url) {
    showToast('上傳失敗', { type: 'error' })
    return
  }
  onSendMedia(picked.kind, url)
}, [uploadStatus, pick, upload, onSendMedia])
```

The `upload({ uri, name, type })` shape works on native. On web the existing `handleFileSelected` path stays as-is and calls `upload(file)` — TypeScript narrows by file extension at build time because `useMediaUpload.ts` (web) and `useMediaUpload.native.ts` are separate modules with separate signatures. If TS complains about the shared call site, introduce a small platform-branched `useUploadMedia` adapter; otherwise inline-cast the argument with a comment.

- [ ] **Step 2: Native smoke test**

```bash
cd apps/web
bun run prebuild:native
bun run ios   # or android
```

Walk through:
1. Open a chat, tap the photo icon → permission prompt should appear once.
2. Pick an image → message bubble appears with the image.
3. Pick a video → bubble shows the "影片訊息（行動版即將推出）" placeholder for the **sender**, since `VideoBubble.native.tsx` is still the stub. Receiver on web sees the real video.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/features/chat/ui/MessageInput.tsx
git commit -m "feat(native): send images and videos from the chat composer"
```

After Phase 1: image messages are fully cross-platform. Video upload works from native, but native viewers still see the placeholder until Phase 2.

---

## Phase 2: Video playback on native

**Goal:** Replace `VideoBubble.native.tsx` with a real `expo-video` player so native users can both send (Phase 1) and receive (this phase) video messages.

### Task 2.1: Real `VideoBubble.native.tsx`

**Files:**
- Modify: `apps/web/src/interface/message/VideoBubble.native.tsx`

- [ ] **Step 1: Replace stub with `expo-video` player**

```tsx
import { memo, useState } from 'react'
import { Pressable } from 'react-native'
import { YStack } from 'tamagui'
import { useVideoPlayer, VideoView } from 'expo-video'
import Svg, { Circle, Path } from 'react-native-svg'

type Props = {
  url: string
  isMine: boolean
}

export const VideoBubble = memo(({ url }: Props) => {
  const [playing, setPlaying] = useState(false)
  const player = useVideoPlayer(url, (p) => {
    p.loop = false
  })

  if (playing) {
    return (
      <YStack maxWidth={300} style={{ borderRadius: 18, overflow: 'hidden' }}>
        <VideoView
          player={player}
          style={{ width: 300, height: 200 }}
          nativeControls
          contentFit="contain"
        />
      </YStack>
    )
  }

  return (
    <Pressable
      onPress={() => {
        setPlaying(true)
        player.play()
      }}
    >
      <YStack
        maxWidth={300}
        bg="$color3"
        style={{ borderRadius: 18, overflow: 'hidden' }}
      >
        <YStack width={300} height={200} bg="$color3" />
        <YStack
          position="absolute"
          t={0}
          l={0}
          r={0}
          b={0}
          items="center"
          justify="center"
          bg="rgba(0,0,0,0.3)"
        >
          <Svg width={48} height={48} viewBox="0 0 48 48">
            <Circle cx={24} cy={24} r={24} fill="rgba(0,0,0,0.6)" />
            <Path d="M19 16l14 8-14 8V16z" fill="white" />
          </Svg>
        </YStack>
      </YStack>
    </Pressable>
  )
})
```

The component is intentionally **state-shape-identical** to `VideoBubble.tsx` (web): same prop interface, same tap-to-play semantics, same dimensions. The only difference is the player primitive.

- [ ] **Step 2: Smoke test**

```bash
cd apps/web && bun run ios
```

1. Receive a video message sent from web → tap the placeholder → video plays inline with native controls.
2. Send a video from native → confirm it now plays back on the sender's own screen too (since both sides resolve to the real bubble after this phase).

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/interface/message/VideoBubble.native.tsx
git commit -m "feat(native): play video messages via expo-video"
```

---

## Phase 3: Audio recording and playback on native

**Goal:** Replace both `useAudioRecorder.native.ts` and `AudioBubble.native.tsx` with real `expo-audio` implementations. This is the most involved phase because of iOS audio session handling and recording-format consistency.

### Task 3.1: Audio MIME / format strategy decision

The web hook records `audio/mp4` (Safari) or `audio/webm` (Chrome/Firefox). On native, `expo-audio`'s recording presets default to `m4a` (AAC in MP4 container) on both iOS and Android — which is the same container as web Safari. **Decision: standardize the native recorder on `audio/m4a` (AAC).**

This means:
- Native records m4a. Server `ALLOWED_MIME_TYPES` already includes `audio/m4a`, `audio/mp4`, `audio/x-m4a` — no server change needed.
- Web Chrome/Firefox still records webm. Native users **playing back** a webm audio file via `expo-audio` will likely fail to decode — this is a **known limitation** for v1 cross-platform audio. Two paths to resolve later:
  1. **Server-side transcode webm → m4a on upload** (using `fluent-ffmpeg` or similar; a separate task, not in scope here).
  2. **Force web to record m4a too** by tightening the MIME negotiation in `useAudioRecorder.ts` to skip browsers that can't record AAC. Reduces compatibility with desktop Firefox, where m4a recording isn't supported.

For Phase 3, ship native↔native and native→web compatibility (both work because m4a is universal). Add a note in spec Future Work that webm→native playback needs a transcoder.

- [ ] **Step 1: Document the decision in the spec**

Open `docs/superpowers/specs/2026-04-19-media-messages-design.md`, add to the "Future Work" section:

```md
- **Audio cross-platform compatibility**: Web records `audio/webm` on Chrome/Firefox, which native `expo-audio` cannot decode. Either transcode webm → m4a on upload, or restrict web recording to browsers that support AAC.
```

```bash
git add docs/superpowers/specs/2026-04-19-media-messages-design.md
git commit -m "docs(spec): note webm→native audio limitation as future work"
```

### Task 3.2: Real `useAudioRecorder.native.ts`

**Files:**
- Modify: `apps/web/src/features/chat/useAudioRecorder.native.ts`

- [ ] **Step 1: Implement with `expo-audio`**

```ts
import { useCallback, useEffect, useRef, useState } from 'react'
import {
  AudioModule,
  RecordingPresets,
  setAudioModeAsync,
  useAudioRecorder as useExpoAudioRecorder,
} from 'expo-audio'

const PRESET = RecordingPresets.HIGH_QUALITY // m4a / aac

export function useAudioRecorder() {
  const recorder = useExpoAudioRecorder(PRESET)
  const [isRecording, setIsRecording] = useState(false)
  const [elapsedMs, setElapsedMs] = useState(0)
  const startedAtRef = useRef(0)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const stopTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
  }, [])

  useEffect(() => {
    return () => {
      stopTimer()
      if (recorder.isRecording) {
        recorder.stop().catch(() => {})
      }
    }
  }, [recorder, stopTimer])

  const startRecording = useCallback(async (): Promise<boolean> => {
    try {
      const perm = await AudioModule.requestRecordingPermissionsAsync()
      if (!perm.granted) return false

      // iOS: route through the playback-and-record category so recording works
      // even when the device is in silent mode, and audio routes to the speaker.
      await setAudioModeAsync({
        allowsRecording: true,
        playsInSilentMode: true,
        interruptionMode: 'duckOthers',
      })

      await recorder.prepareToRecordAsync()
      recorder.record()
      startedAtRef.current = Date.now()
      setIsRecording(true)
      setElapsedMs(0)
      timerRef.current = setInterval(() => {
        setElapsedMs(Date.now() - startedAtRef.current)
      }, 100)
      return true
    } catch {
      return false
    }
  }, [recorder])

  const stopRecording = useCallback(async () => {
    if (!recorder.isRecording) {
      setIsRecording(false)
      stopTimer()
      return null
    }
    const durationMs = Date.now() - startedAtRef.current
    await recorder.stop()
    const uri = recorder.uri
    setIsRecording(false)
    setElapsedMs(0)
    stopTimer()
    if (!uri) return null

    // Restore default audio mode so subsequent playback isn't held in record category.
    await setAudioModeAsync({
      allowsRecording: false,
      playsInSilentMode: true,
      interruptionMode: 'mixWithOthers',
    }).catch(() => {})

    // Match the web hook's return shape so MessageInput's handler is identical.
    // We hand a fake `Blob` only for shape conformance — the native upload
    // path uses { uri, name, type } in MessageInput, not the blob field.
    return {
      blob: { uri } as unknown as Blob,
      mimeType: 'audio/m4a',
      durationMs,
      uri,
    }
  }, [recorder, stopTimer])

  const cancelRecording = useCallback(async () => {
    if (recorder.isRecording) {
      await recorder.stop().catch(() => {})
    }
    setIsRecording(false)
    setElapsedMs(0)
    stopTimer()
    await setAudioModeAsync({
      allowsRecording: false,
      playsInSilentMode: true,
      interruptionMode: 'mixWithOthers',
    }).catch(() => {})
  }, [recorder, stopTimer])

  return { isRecording, elapsedMs, startRecording, stopRecording, cancelRecording }
}
```

Critical notes:
- `setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true })` is the iOS audio-session dance. Without it, recording silently fails when the device is muted, and playback after recording can get stuck routed to the earpiece.
- We restore `allowsRecording: false` after stop/cancel so the next `useAudioPlayer` (used by `AudioBubble`) plays through the speaker, not the receiver earpiece.
- The return shape includes a `uri` field that web doesn't have. Update `useAudioRecorder.ts` (web) to **also** include a `uri: undefined` field in the return type so the call site in `MessageInput` doesn't need a platform check. Or, alternative: change `MessageInput`'s audio handler to read `result.uri ?? URL.createObjectURL(result.blob)` — but native should never reach the `URL.createObjectURL` branch.

- [ ] **Step 2: Update `MessageInput`'s mic handler to use the URI on native**

Open `apps/web/src/features/chat/ui/MessageInput.tsx`. In `handleMicPressOut`, after the existing web-style upload, branch:

```ts
const result = await stopRecording()
if (!result) return
if (result.durationMs < 500) return

let url: string | null
if (isWeb) {
  const ext = result.mimeType.includes('mp4') ? 'm4a' : 'webm'
  const file = new File([result.blob], `audio.${ext}`, { type: result.mimeType })
  url = await upload(file)
} else {
  // Native: result.uri is the file:// path written by expo-audio.
  url = await upload({
    uri: (result as { uri?: string }).uri ?? '',
    name: 'audio.m4a',
    type: 'audio/m4a',
  })
}
```

Then continue with the existing `if (!url) ... onSendMedia('audio', url, { duration: result.durationMs })` block.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/features/chat/useAudioRecorder.native.ts apps/web/src/features/chat/ui/MessageInput.tsx
git commit -m "feat(native): record audio messages via expo-audio"
```

### Task 3.3: Real `AudioBubble.native.tsx`

**Files:**
- Modify: `apps/web/src/interface/message/AudioBubble.native.tsx`

- [ ] **Step 1: Implement with `expo-audio` `useAudioPlayer`**

```tsx
import { memo, useEffect, useState } from 'react'
import { Pressable } from 'react-native'
import { SizableText, XStack } from 'tamagui'
import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio'
import Svg, { Path } from 'react-native-svg'

type Props = {
  url: string
  duration?: number
  isMine: boolean
}

function formatDuration(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000))
  const m = Math.floor(total / 60)
  const s = total % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}

export const AudioBubble = memo(({ url, duration, isMine }: Props) => {
  const player = useAudioPlayer(url)
  const status = useAudioPlayerStatus(player)
  const [playing, setPlaying] = useState(false)

  useEffect(() => {
    setPlaying(status.playing)
    if (status.didJustFinish) {
      player.seekTo(0)
      setPlaying(false)
    }
  }, [status.playing, status.didJustFinish, player])

  const toggle = () => {
    if (playing) player.pause()
    else player.play()
  }

  const elapsedMs = status.currentTime ? status.currentTime * 1000 : 0
  const display = playing ? elapsedMs : (duration ?? elapsedMs)
  const fg = isMine ? 'white' : '#333'

  return (
    <Pressable onPress={toggle}>
      <XStack
        items="center"
        gap="$2"
        px="$3"
        py="$2"
        minWidth={140}
        bg={isMine ? '#8be872' : 'white'}
        style={{ borderRadius: 18 }}
      >
        <Svg width={20} height={20} viewBox="0 0 24 24">
          {playing ? (
            <Path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" fill={fg} />
          ) : (
            <Path d="M8 5v14l11-7L8 5z" fill={fg} />
          )}
        </Svg>
        <SizableText fontSize={13} color={fg}>
          {formatDuration(display)}
        </SizableText>
      </XStack>
    </Pressable>
  )
})
```

This is a 1:1 visual mirror of the web `AudioBubble.tsx`. The internals swap `new Audio(url)` for `useAudioPlayer(url)`.

- [ ] **Step 2: Smoke test (cross-platform matrix)**

| Sender | Receiver | Expected |
|---|---|---|
| Web (Chrome) → records webm | Web (Chrome) | ✅ plays |
| Web (Safari) → records m4a | Native iOS | ✅ plays |
| Native iOS → records m4a | Native iOS | ✅ plays |
| Native iOS → records m4a | Web (Chrome) | ✅ plays |
| Web (Chrome) → records webm | Native iOS | ❌ silent failure (known limitation, see Phase 3 Task 3.1) |

Document any deviations encountered.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/interface/message/AudioBubble.native.tsx
git commit -m "feat(native): play audio messages via expo-audio"
```

---

## Phase 4: Polish and verification

### Task 4.1: Confirm permissions are surfaced gracefully

- [ ] **Step 1: Test permission denial paths**

Reset the iOS simulator's permissions (`Settings → Privacy → Photos / Microphone → revoke`) and walk through:

1. Tap photo icon → deny photos permission → expect: silent return with no error toast (the system already showed its own dialog). The mic should still work independently.
2. Press mic → deny microphone permission → expect: "無法錄音，請檢查麥克風權限" toast.

Both should be handled by the existing `startRecording` returning `false` and `pick` returning `null`.

### Task 4.2: Audio session interruption smoke test

- [ ] **Step 1: Iterate**

1. Start playing a song in the system music app.
2. Open the chat and tap an audio message → expect: music ducks, audio plays, music resumes after.
3. Receive a phone call mid-recording → expect: recording stops, no crash, no orphaned mic indicator.

These edge cases are why `setAudioModeAsync` matters. If any of them misbehave, adjust the `interruptionMode` value (`mixWithOthers` vs `duckOthers` vs `doNotMix`).

### Task 4.3: Final cross-platform matrix

- [ ] **Step 1: Full check**

```bash
bun run check:all
bun run --cwd apps/server test:unit
```

- [ ] **Step 2: Manual matrix on iOS, Android, web side-by-side**

For each of {image, video, audio}, send and receive between every pair of {iOS, Android, web}. Note any failures in this PR's description; fix in follow-ups rather than blocking the merge unless a basic case is broken.

- [ ] **Step 3: Update spec — remove from "Future Work"**

Open the spec and remove the "Native parity" bullet from Future Work. Native is now real.

```bash
git add docs/superpowers/specs/2026-04-19-media-messages-design.md
git commit -m "docs(spec): native parity is now shipped, remove from future work"
```

---

## Future Work (deferred even after this plan)

- Real upload-progress on native (requires `expo-file-system` `uploadAsync` or `react-native-blob-util`).
- Server-side transcode of `audio/webm` → `audio/m4a` on upload, so web (Chrome/Firefox) audio messages play on iOS/Android.
- Background audio playback (lock-screen controls, notification, etc.).
- Video thumbnail extraction client-side on native (`expo-video-thumbnails`).
- Native lightbox with pinch-zoom for `ImageBubble` (current implementation is a tap-to-fullscreen overlay, not a pinch-zoomable viewer).

## Effort estimate

| Phase | Estimate |
|---|---|
| Phase 0 (config + upload primitive) | 0.5 day |
| Phase 1 (image) | 0.5 day |
| Phase 2 (video) | 0.5 day |
| Phase 3 (audio recording + playback + iOS session) | 1.5 days |
| Phase 4 (polish + matrix testing) | 0.5–1 day |
| **Total** | **3.5–4 days** of focused work |

This assumes the web v1 plan is already merged and `bun run prebuild:native` works on day 1. If `expo prebuild` surfaces unrelated native config issues, add 0.5–1 day of buffer.
