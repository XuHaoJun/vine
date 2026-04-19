# Media Messages Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add image, video, and audio message support to the **web** chat UI, including an auth-gated server upload endpoint, three new bubble components, and hold-to-record audio.

**Scope:** v1 = web only. Native build must continue to compile and not crash — see **Task 0** for the `.native.tsx` no-op stubs that achieve this. Real native parity, image compression, file cleanup, retry UI, and chat-list preview text are explicitly out of scope (see spec "Future Work" and the separate `2026-04-19-media-messages-native-plan.md`).

**Architecture:** Auth-gated REST upload (`POST /api/v1/media/upload`) stores files via `DriveService` and returns a public URL served by `@fastify/static`. Frontend picks media, uploads with progress, then sends a Zero mutation with the URL in `metadata`. Three new bubble components render media on web; corresponding `.native.tsx` placeholders render "feature coming soon" on native so the cross-platform `apps/web` bundle stays buildable. `MessageInput` is edited surgically: on web the photo button wires to a hidden file input and the mic to a `Pressable` with `onPressIn` / `onPressOut`; on native both affordances surface a toast.

**Tech Stack:** Fastify + `@fastify/multipart` + `@fastify/static`, `DriveService`, Zero mutations, Tamagui UI, web `MediaRecorder` API, XHR (for upload progress).

**Important — `apps/web` is cross-platform:** The `apps/web` source is bundled by One/vxrn for both web **and** native (iOS/Android via `one run:ios|android`). Web-only globals (`window`, `<input>`, `<video>`, `MediaRecorder`, `Audio`, `navigator.mediaDevices`) crash or render-warn in the native bundle if not gated. Every task that touches a web API must either live in a `.web.ts(x)` file, sit behind `isWeb` from `tamagui`, or have a sibling `.native.tsx` no-op. Task 0 establishes this discipline.

---

### Task 0: Native safety stubs

**Why:** `apps/web` builds for native too. Without these stubs, Tasks 5–11 would compile-error or runtime-crash the native bundle (`MediaRecorder` undefined, `<input type="file">` unknown component, etc.).

**Files:**
- Create: `apps/web/src/features/chat/useMediaUpload.native.ts`
- Create: `apps/web/src/features/chat/useAudioRecorder.native.ts`
- Create: `apps/web/src/interface/message/VideoBubble.native.tsx`
- Create: `apps/web/src/interface/message/AudioBubble.native.tsx`

`ImageBubble` is intentionally **not** stubbed — its implementation (Task 7) is already cross-platform (`react-native` `Pressable`, `~/interface/image/Image`, tamagui layout, `position="fixed"` already wrapped in `$platform-web`).

- [ ] **Step 1: `useMediaUpload.native.ts`**

```ts
import { useCallback, useState } from 'react'

type UploadStatus = 'idle' | 'uploading' | 'done' | 'error'

export function useMediaUpload() {
  const [status] = useState<UploadStatus>('idle')
  const upload = useCallback(async (): Promise<string | null> => {
    if (__DEV__) {
      console.warn('[useMediaUpload] media upload is not yet implemented on native')
    }
    return null
  }, [])
  const abort = useCallback(() => {}, [])
  const reset = useCallback(() => {}, [])
  return {
    url: null as string | null,
    progress: 0,
    status,
    error: null as string | null,
    upload,
    abort,
    reset,
  }
}
```

The signature mirrors the web hook (Task 5) exactly so `MessageInput` can call it on either platform without conditional types.

- [ ] **Step 2: `useAudioRecorder.native.ts`**

```ts
import { useCallback, useState } from 'react'

export function useAudioRecorder() {
  const [isRecording] = useState(false)
  const [elapsedMs] = useState(0)
  const startRecording = useCallback(async (): Promise<boolean> => {
    if (__DEV__) {
      console.warn('[useAudioRecorder] audio recording is not yet implemented on native')
    }
    return false
  }, [])
  const stopRecording = useCallback(
    async (): Promise<{ blob: Blob; mimeType: string; durationMs: number } | null> => null,
    [],
  )
  const cancelRecording = useCallback(() => {}, [])
  return { isRecording, elapsedMs, startRecording, stopRecording, cancelRecording }
}
```

Same signature as Task 6's web hook. `startRecording` returning `false` makes `MessageInput`'s existing error toast fire ("無法錄音，請檢查麥克風權限") on native, which is acceptable feedback for v1 since the button shouldn't be reachable anyway (see Task 11 platform gating).

- [ ] **Step 3: `VideoBubble.native.tsx`**

```tsx
import { memo } from 'react'
import { SizableText, XStack } from 'tamagui'
import Svg, { Circle, Path } from 'react-native-svg'

type Props = {
  url: string
  isMine: boolean
}

export const VideoBubble = memo(({ isMine }: Props) => {
  return (
    <XStack
      items="center"
      gap="$2"
      px="$3"
      py="$2"
      minWidth={180}
      bg={isMine ? '#8be872' : 'white'}
      style={{ borderRadius: 18 }}
    >
      <Svg width={20} height={20} viewBox="0 0 24 24">
        <Circle cx={12} cy={12} r={11} fill="rgba(0,0,0,0.15)" />
        <Path d="M10 8l6 4-6 4V8z" fill={isMine ? 'white' : '#666'} />
      </Svg>
      <SizableText fontSize={13} color={isMine ? 'white' : '$color10'}>
        影片訊息（行動版即將推出）
      </SizableText>
    </XStack>
  )
})
```

- [ ] **Step 4: `AudioBubble.native.tsx`**

```tsx
import { memo } from 'react'
import { SizableText, XStack } from 'tamagui'
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

export const AudioBubble = memo(({ duration, isMine }: Props) => {
  const fg = isMine ? 'white' : '#666'
  return (
    <XStack
      items="center"
      gap="$2"
      px="$3"
      py="$2"
      minWidth={180}
      bg={isMine ? '#8be872' : 'white'}
      style={{ borderRadius: 18 }}
    >
      <Svg width={20} height={20} viewBox="0 0 24 24">
        <Path d="M8 5v14l11-7L8 5z" fill={fg} />
      </Svg>
      <SizableText fontSize={13} color={fg}>
        {duration ? `語音 ${formatDuration(duration)}` : '語音訊息'}
      </SizableText>
      <SizableText fontSize={11} color={isMine ? 'rgba(255,255,255,0.7)' : '$color10'}>
        （行動版即將推出）
      </SizableText>
    </XStack>
  )
})
```

- [ ] **Step 5: Verify native typecheck**

```bash
bun run --cwd apps/web typecheck
```

(Optional but recommended if you have a sim handy: `cd apps/web && bun run prebuild:native && bun run ios` to confirm the bundle compiles. If you don't, the typecheck plus the deferred Task 13 smoke test is acceptable for the v1 PR.)

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/features/chat/useMediaUpload.native.ts apps/web/src/features/chat/useAudioRecorder.native.ts apps/web/src/interface/message/VideoBubble.native.tsx apps/web/src/interface/message/AudioBubble.native.tsx
git commit -m "feat(web): add native no-op stubs for media hooks and bubbles"
```

---

### Task 1: Add server dependencies

**Files:**
- Modify: `apps/server/package.json`, `bun.lock`

- [ ] **Step 1: Add `@fastify/multipart` and `@fastify/static`**

```bash
bun add @fastify/multipart @fastify/static --filter=@vine/server
```

Verify both appear in `apps/server/package.json` `dependencies`.

- [ ] **Step 2: Commit (include the lockfile)**

```bash
git add apps/server/package.json bun.lock
git commit -m "feat(server): add multipart + static deps for media uploads"
```

---

### Task 2: Serve `/uploads/*` statically

**Files:**
- Modify: `apps/server/src/index.ts`

- [ ] **Step 1: Register `@fastify/static`**

In `apps/server/src/index.ts`, add `import path from 'node:path'` near the other imports, then register the plugin **after** `await app.register(formbody)` and **before** `await app.register(fastifyConnectPlugin, ...)`:

```ts
await app.register(import('@fastify/static'), {
  root: path.resolve(process.env['DRIVE_BASE_PATH'] ?? './uploads'),
  prefix: '/uploads/',
  decorateReply: false,
})
```

This must use the same path as the FS drive's `basePath` so that URLs returned by `drive.getUrl(key)` (which look like `${DRIVE_BASE_URL}/<key>`) actually resolve. With S3 driver in production this registration is harmless (S3 URLs go straight to S3, the route just isn't hit).

- [ ] **Step 2: Typecheck**

```bash
bun run --cwd apps/server typecheck
```

- [ ] **Step 3: Commit**

```bash
git add apps/server/src/index.ts
git commit -m "feat(server): serve /uploads/* via @fastify/static"
```

---

### Task 3: Server media upload plugin

**Files:**
- Create: `apps/server/src/plugins/media-upload.ts`
- Modify: `apps/server/src/index.ts` (wire the plugin)

- [ ] **Step 1: Create `apps/server/src/plugins/media-upload.ts`**

```ts
import { randomUUID } from 'node:crypto'
import { getAuthDataFromRequest } from '@take-out/better-auth-utils/server'
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import type { DriveService } from '@vine/drive'

import { toWebRequest } from '../utils'
import { logger } from '../lib/logger'
import type { createAuthServer } from './auth'

type MediaUploadPluginDeps = {
  auth: ReturnType<typeof createAuthServer>
  drive: DriveService
}

const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'video/mp4',
  'video/quicktime',
  'video/webm',
  'audio/mp4',
  'audio/m4a',
  'audio/x-m4a',
  'audio/mpeg',
  'audio/ogg',
  'audio/webm',
])

const MAX_FILE_SIZE = 25 * 1024 * 1024

const EXT_BY_MIME: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/gif': 'gif',
  'image/webp': 'webp',
  'video/mp4': 'mp4',
  'video/quicktime': 'mov',
  'video/webm': 'webm',
  'audio/mp4': 'm4a',
  'audio/m4a': 'm4a',
  'audio/x-m4a': 'm4a',
  'audio/mpeg': 'mp3',
  'audio/ogg': 'ogg',
  'audio/webm': 'webm',
}

export async function mediaUploadPlugin(
  fastify: FastifyInstance,
  deps: MediaUploadPluginDeps,
) {
  await fastify.register(import('@fastify/multipart'), {
    limits: { fileSize: MAX_FILE_SIZE, files: 1 },
  })

  fastify.post(
    '/api/v1/media/upload',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const webReq = toWebRequest(request)
      const authData = await getAuthDataFromRequest(deps.auth, webReq).catch(() => null)
      if (!authData?.id) {
        return reply.code(401).send({ message: 'Unauthorized' })
      }

      let data
      try {
        data = await request.file()
      } catch (err) {
        if (err instanceof Error && err.message.toLowerCase().includes('file too large')) {
          return reply.code(413).send({ message: 'File too large' })
        }
        logger.error({ err }, '[media-upload] file() failed')
        return reply.code(400).send({ message: 'Invalid multipart body' })
      }

      if (!data) {
        return reply.code(400).send({ message: 'No file provided' })
      }

      if (!ALLOWED_MIME_TYPES.has(data.mimetype)) {
        return reply.code(415).send({ message: 'Unsupported file type' })
      }

      let buffer: Buffer
      try {
        buffer = await data.toBuffer()
      } catch (err) {
        if (err instanceof Error && err.message.toLowerCase().includes('file too large')) {
          return reply.code(413).send({ message: 'File too large' })
        }
        logger.error({ err }, '[media-upload] toBuffer failed')
        return reply.code(500).send({ message: 'Upload failed' })
      }

      const ext = EXT_BY_MIME[data.mimetype] ?? 'bin'
      const key = `media/${authData.id}/${randomUUID()}.${ext}`

      try {
        await deps.drive.put(key, buffer, data.mimetype)
        const url = await deps.drive.getUrl(key)
        return reply.send({ url })
      } catch (err) {
        logger.error({ err }, '[media-upload] drive write failed')
        return reply.code(500).send({ message: 'Upload failed' })
      }
    },
  )
}
```

Key points to preserve when implementing:
- Auth uses `getAuthDataFromRequest` exactly like `zeroPlugin` (`apps/server/src/plugins/zero.ts`).
- File-key includes the user id so a future cleanup job can scope deletes by user.
- The 25 MB limit is enforced both by `@fastify/multipart` config **and** caught defensively from `toBuffer()` (some multipart errors surface there).
- Do **not** introduce a valibot schema for this — the inline checks are sufficient and `v.instance(File)` doesn't match Fastify's `MultipartFile`.

- [ ] **Step 2: Wire the plugin in `apps/server/src/index.ts`**

Add the import near the other plugin imports:

```ts
import { mediaUploadPlugin } from './plugins/media-upload'
```

Register it in the same block as the other v1/auth-aware plugins, **after** `await zeroPlugin(app, { auth, zero })`:

```ts
await mediaUploadPlugin(app, { auth, drive })
```

- [ ] **Step 3: Typecheck**

```bash
bun run --cwd apps/server typecheck
```

- [ ] **Step 4: Commit**

```bash
git add apps/server/src/plugins/media-upload.ts apps/server/src/index.ts
git commit -m "feat(server): add auth-gated media upload endpoint"
```

---

### Task 4: Server tests for the upload endpoint

**Files:**
- Create: `apps/server/src/plugins/media-upload.test.ts`

- [ ] **Step 1: Write real `fastify.inject()` tests**

Match the style of `apps/server/src/plugins/oa-messaging.test.ts`. Mock `auth` and `drive`, then exercise the route end-to-end.

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import Fastify from 'fastify'
import FormData from 'form-data'
import { mediaUploadPlugin } from './media-upload'

vi.mock('@take-out/better-auth-utils/server', () => ({
  getAuthDataFromRequest: vi.fn(),
}))

import { getAuthDataFromRequest } from '@take-out/better-auth-utils/server'

const mockedAuth = vi.mocked(getAuthDataFromRequest)

function createApp(overrides?: { driveUrl?: string }) {
  const drive = {
    put: vi.fn().mockResolvedValue(undefined),
    get: vi.fn(),
    exists: vi.fn(),
    delete: vi.fn(),
    getUrl: vi.fn().mockResolvedValue(overrides?.driveUrl ?? 'http://localhost/uploads/test.jpg'),
  }
  const auth = {} as any
  const app = Fastify()
  return { app, drive, auth, register: () => app.register(mediaUploadPlugin, { auth, drive }) }
}

function multipartPayload(filename: string, contentType: string, body: Buffer) {
  const form = new FormData()
  form.append('file', body, { filename, contentType })
  return {
    payload: form.getBuffer(),
    headers: form.getHeaders(),
  }
}

beforeEach(() => {
  mockedAuth.mockReset()
})

describe('media-upload plugin', () => {
  it('returns 401 when unauthenticated', async () => {
    mockedAuth.mockResolvedValue(null as any)
    const { app, register } = createApp()
    await register()
    const { payload, headers } = multipartPayload('a.jpg', 'image/jpeg', Buffer.from([1, 2, 3]))
    const res = await app.inject({ method: 'POST', url: '/api/v1/media/upload', payload, headers })
    expect(res.statusCode).toBe(401)
  })

  it('rejects unsupported mime types', async () => {
    mockedAuth.mockResolvedValue({ id: 'u1' } as any)
    const { app, register } = createApp()
    await register()
    const { payload, headers } = multipartPayload('a.exe', 'application/x-msdownload', Buffer.from('x'))
    const res = await app.inject({ method: 'POST', url: '/api/v1/media/upload', payload, headers })
    expect(res.statusCode).toBe(415)
  })

  it('stores file under media/<userId>/ and returns the drive URL', async () => {
    mockedAuth.mockResolvedValue({ id: 'user-42' } as any)
    const { app, drive, register } = createApp({ driveUrl: 'http://localhost/uploads/x.jpg' })
    await register()
    const { payload, headers } = multipartPayload('photo.jpg', 'image/jpeg', Buffer.from('IMG'))
    const res = await app.inject({ method: 'POST', url: '/api/v1/media/upload', payload, headers })
    expect(res.statusCode).toBe(200)
    expect(JSON.parse(res.body)).toEqual({ url: 'http://localhost/uploads/x.jpg' })
    expect(drive.put).toHaveBeenCalledTimes(1)
    const [key, buffer, mime] = drive.put.mock.calls[0]!
    expect(key).toMatch(/^media\/user-42\/[0-9a-f-]+\.jpg$/)
    expect(Buffer.isBuffer(buffer)).toBe(true)
    expect(mime).toBe('image/jpeg')
  })

  it('rejects files over the size limit with 413', async () => {
    mockedAuth.mockResolvedValue({ id: 'u1' } as any)
    const { app, register } = createApp()
    await register()
    const big = Buffer.alloc(26 * 1024 * 1024, 0)
    const { payload, headers } = multipartPayload('big.mp4', 'video/mp4', big)
    const res = await app.inject({ method: 'POST', url: '/api/v1/media/upload', payload, headers })
    expect(res.statusCode).toBe(413)
  })
})
```

If `form-data` is not yet in the test runner's resolution path, install it as a dev dependency: `bun add -d form-data --filter=@vine/server`. Stage `package.json` + `bun.lock` if so.

- [ ] **Step 2: Run tests**

```bash
bun run --cwd apps/server test:unit -- media-upload
```

- [ ] **Step 3: Commit**

```bash
git add apps/server/src/plugins/media-upload.test.ts apps/server/package.json bun.lock
git commit -m "test(server): cover media upload auth, mime, size, and storage"
```

---

### Task 5: `useMediaUpload` hook (web)

**Files:**
- Create: `apps/web/src/features/chat/useMediaUpload.ts`

- [ ] **Step 1: Create the hook with progress + abort**

```ts
import { useCallback, useEffect, useRef, useState } from 'react'

type UploadStatus = 'idle' | 'uploading' | 'done' | 'error'

type UseMediaUploadReturn = {
  url: string | null
  progress: number
  status: UploadStatus
  error: string | null
  upload: (file: File | Blob, filename?: string) => Promise<string | null>
  abort: () => void
  reset: () => void
}

export function useMediaUpload(): UseMediaUploadReturn {
  const [url, setUrl] = useState<string | null>(null)
  const [progress, setProgress] = useState(0)
  const [status, setStatus] = useState<UploadStatus>('idle')
  const [error, setError] = useState<string | null>(null)
  const xhrRef = useRef<XMLHttpRequest | null>(null)

  useEffect(() => {
    return () => {
      xhrRef.current?.abort()
    }
  }, [])

  const upload = useCallback(
    async (file: File | Blob, filename?: string): Promise<string | null> => {
      setStatus('uploading')
      setProgress(0)
      setError(null)

      const form = new FormData()
      const name = filename ?? (file instanceof File ? file.name : 'upload.bin')
      form.append('file', file, name)

      try {
        const result = await new Promise<string>((resolve, reject) => {
          const xhr = new XMLHttpRequest()
          xhrRef.current = xhr
          xhr.upload.addEventListener('progress', (e) => {
            if (e.lengthComputable) setProgress(e.loaded / e.total)
          })
          xhr.addEventListener('load', () => {
            if (xhr.status >= 200 && xhr.status < 300) {
              try {
                const data = JSON.parse(xhr.responseText) as { url?: string }
                if (data.url) resolve(data.url)
                else reject(new Error('Malformed upload response'))
              } catch {
                reject(new Error('Malformed upload response'))
              }
            } else {
              reject(new Error(`Upload failed (${xhr.status})`))
            }
          })
          xhr.addEventListener('error', () => reject(new Error('Network error')))
          xhr.addEventListener('abort', () => reject(new Error('Upload aborted')))
          xhr.open('POST', '/api/v1/media/upload')
          xhr.withCredentials = true
          xhr.send(form)
        })
        setUrl(result)
        setStatus('done')
        xhrRef.current = null
        return result
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Upload failed'
        setError(message)
        setStatus('error')
        xhrRef.current = null
        return null
      }
    },
    [],
  )

  const abort = useCallback(() => {
    xhrRef.current?.abort()
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

`xhr.withCredentials = true` ensures the better-auth session cookie is sent.

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/features/chat/useMediaUpload.ts
git commit -m "feat(web): add useMediaUpload hook with XHR progress and abort"
```

---

### Task 6: `useAudioRecorder` hook (web)

**Files:**
- Create: `apps/web/src/features/chat/useAudioRecorder.ts`

- [ ] **Step 1: Create the hook**

```ts
import { useCallback, useEffect, useRef, useState } from 'react'

type UseAudioRecorderReturn = {
  isRecording: boolean
  elapsedMs: number
  startRecording: () => Promise<boolean>
  stopRecording: () => Promise<{ blob: Blob; mimeType: string; durationMs: number } | null>
  cancelRecording: () => void
}

function pickSupportedMimeType(): string {
  const candidates = ['audio/mp4', 'audio/webm;codecs=opus', 'audio/webm']
  for (const m of candidates) {
    if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(m)) return m
  }
  return 'audio/webm'
}

export function useAudioRecorder(): UseAudioRecorderReturn {
  const [isRecording, setIsRecording] = useState(false)
  const [elapsedMs, setElapsedMs] = useState(0)
  const recorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const mimeRef = useRef<string>('audio/webm')
  const startedAtRef = useRef<number>(0)
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
      const r = recorderRef.current
      if (r && r.state !== 'inactive') {
        r.stop()
        r.stream.getTracks().forEach((t) => t.stop())
      }
    }
  }, [stopTimer])

  const startRecording = useCallback(async (): Promise<boolean> => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mime = pickSupportedMimeType()
      const recorder = new MediaRecorder(stream, { mimeType: mime })
      recorderRef.current = recorder
      chunksRef.current = []
      mimeRef.current = mime
      recorder.addEventListener('dataavailable', (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data)
      })
      recorder.start()
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
  }, [])

  const stopRecording = useCallback(
    (): Promise<{ blob: Blob; mimeType: string; durationMs: number } | null> => {
      const recorder = recorderRef.current
      if (!recorder || recorder.state === 'inactive') {
        setIsRecording(false)
        stopTimer()
        return Promise.resolve(null)
      }
      const mime = mimeRef.current
      const durationMs = Date.now() - startedAtRef.current
      return new Promise((resolve) => {
        recorder.addEventListener('stop', () => {
          const blob = new Blob(chunksRef.current, { type: mime })
          recorder.stream.getTracks().forEach((t) => t.stop())
          recorderRef.current = null
          chunksRef.current = []
          setIsRecording(false)
          setElapsedMs(0)
          stopTimer()
          resolve({ blob, mimeType: mime, durationMs })
        })
        recorder.stop()
      })
    },
    [stopTimer],
  )

  const cancelRecording = useCallback(() => {
    const recorder = recorderRef.current
    if (recorder && recorder.state !== 'inactive') {
      recorder.stop()
      recorder.stream.getTracks().forEach((t) => t.stop())
    }
    recorderRef.current = null
    chunksRef.current = []
    setIsRecording(false)
    setElapsedMs(0)
    stopTimer()
  }, [stopTimer])

  return { isRecording, elapsedMs, startRecording, stopRecording, cancelRecording }
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/features/chat/useAudioRecorder.ts
git commit -m "feat(web): add useAudioRecorder with MIME negotiation"
```

---

### Task 7: `ImageBubble` component

**Files:**
- Create: `apps/web/src/interface/message/ImageBubble.tsx`

- [ ] **Step 1: Create `ImageBubble`**

```tsx
import { memo, useState } from 'react'
import { Pressable } from 'react-native'
import { YStack } from 'tamagui'
import { Image } from '~/interface/image/Image'

type Props = {
  url: string
  isMine: boolean
}

export const ImageBubble = memo(({ url }: Props) => {
  const [open, setOpen] = useState(false)

  return (
    <>
      <Pressable onPress={() => setOpen(true)}>
        <YStack
          maxWidth={280}
          style={{ borderRadius: 18, overflow: 'hidden' }}
        >
          <Image
            source={{ uri: url }}
            style={{ width: 280, height: 200 }}
            resizeMode="cover"
          />
        </YStack>
      </Pressable>

      {open && (
        <YStack
          $platform-web={{ position: 'fixed' as 'absolute' }}
          position="absolute"
          t={0}
          l={0}
          r={0}
          b={0}
          bg="rgba(0,0,0,0.92)"
          items="center"
          justify="center"
          z={9999}
          onPress={() => setOpen(false)}
        >
          <Image
            source={{ uri: url }}
            style={{ width: '95%', height: '95%' }}
            resizeMode="contain"
          />
        </YStack>
      )}
    </>
  )
})
```

Notes:
- `Pressable` from `react-native` uses **`onPress`**, not `onClick`.
- `position="fixed"` is web-only via `$platform-web`; the cast (`as 'absolute'`) keeps the RN type checker happy without actually using `'fixed'` on native.
- `t/l/r/b` are tamagui shorthands; do not put them inside `style={{}}`.

- [ ] **Step 2: Wire into `MessageBubbleFactory`**

In `apps/web/src/interface/message/MessageBubbleFactory.tsx`:

1. Add `import { ImageBubble } from './ImageBubble'` near the existing `import { TextBubble } from './TextBubble'`.
2. Add a parser helper near the top of the file:
   ```tsx
   function parseMetadata(metadata?: string): Record<string, unknown> {
     if (!metadata) return {}
     try {
       return JSON.parse(metadata) as Record<string, unknown>
     } catch {
       return {}
     }
   }
   ```
3. Add a case **after** the existing `flex` block, **before** `return <UnsupportedBubble type={type} />`:
   ```tsx
   if (type === 'image') {
     const meta = parseMetadata(metadata)
     const url = typeof meta.originalContentUrl === 'string' ? meta.originalContentUrl : ''
     if (!url) return <UnsupportedBubble type={type} />
     return <ImageBubble url={url} isMine={isMine} />
   }
   ```

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/interface/message/ImageBubble.tsx apps/web/src/interface/message/MessageBubbleFactory.tsx
git commit -m "feat(web): render image messages with lightbox"
```

---

### Task 8: `VideoBubble` component

**Files:**
- Create: `apps/web/src/interface/message/VideoBubble.tsx`
- Modify: `apps/web/src/interface/message/MessageBubbleFactory.tsx`

- [ ] **Step 1: Create `VideoBubble`**

```tsx
import { memo, useState } from 'react'
import { Pressable } from 'react-native'
import { YStack } from 'tamagui'
import Svg, { Circle, Path } from 'react-native-svg'

type Props = {
  url: string
  isMine: boolean
}

export const VideoBubble = memo(({ url }: Props) => {
  const [playing, setPlaying] = useState(false)

  if (playing) {
    return (
      <YStack maxWidth={300} style={{ borderRadius: 18, overflow: 'hidden' }}>
        <video
          src={url}
          controls
          autoPlay
          style={{ width: 300, maxHeight: 400, display: 'block' }}
          onEnded={() => setPlaying(false)}
        />
      </YStack>
    )
  }

  return (
    <Pressable onPress={() => setPlaying(true)}>
      <YStack
        position="relative"
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

- [ ] **Step 2: Wire into `MessageBubbleFactory`**

Add `import { VideoBubble } from './VideoBubble'`. After the `image` case, add:

```tsx
if (type === 'video') {
  const meta = parseMetadata(metadata)
  const url = typeof meta.originalContentUrl === 'string' ? meta.originalContentUrl : ''
  if (!url) return <UnsupportedBubble type={type} />
  return <VideoBubble url={url} isMine={isMine} />
}
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/interface/message/VideoBubble.tsx apps/web/src/interface/message/MessageBubbleFactory.tsx
git commit -m "feat(web): render video messages with tap-to-play"
```

---

### Task 9: `AudioBubble` component

**Files:**
- Create: `apps/web/src/interface/message/AudioBubble.tsx`
- Modify: `apps/web/src/interface/message/MessageBubbleFactory.tsx`

- [ ] **Step 1: Create `AudioBubble`**

```tsx
import { memo, useEffect, useRef, useState } from 'react'
import { Pressable } from 'react-native'
import { SizableText, XStack } from 'tamagui'
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
  const [playing, setPlaying] = useState(false)
  const [elapsed, setElapsed] = useState(0)
  const audioRef = useRef<HTMLAudioElement | null>(null)

  useEffect(() => {
    const audio = new Audio(url)
    audioRef.current = audio
    const onEnded = () => {
      setPlaying(false)
      setElapsed(0)
    }
    const onTime = () => setElapsed(audio.currentTime * 1000)
    audio.addEventListener('ended', onEnded)
    audio.addEventListener('timeupdate', onTime)
    return () => {
      audio.removeEventListener('ended', onEnded)
      audio.removeEventListener('timeupdate', onTime)
      audio.pause()
      audio.src = ''
      audioRef.current = null
    }
  }, [url])

  const toggle = () => {
    const audio = audioRef.current
    if (!audio) return
    if (playing) audio.pause()
    else void audio.play()
    setPlaying(!playing)
  }

  const display = playing ? elapsed : (duration ?? elapsed)
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

- [ ] **Step 2: Wire into `MessageBubbleFactory`**

Add `import { AudioBubble } from './AudioBubble'`. After the `video` case:

```tsx
if (type === 'audio') {
  const meta = parseMetadata(metadata)
  const url = typeof meta.originalContentUrl === 'string' ? meta.originalContentUrl : ''
  const duration = typeof meta.duration === 'number' ? meta.duration : undefined
  if (!url) return <UnsupportedBubble type={type} />
  return <AudioBubble url={url} duration={duration} isMine={isMine} />
}
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/interface/message/AudioBubble.tsx apps/web/src/interface/message/MessageBubbleFactory.tsx
git commit -m "feat(web): render audio messages with play/pause"
```

---

### Task 10: Add `sendMedia` to `useMessages`

**Files:**
- Modify: `apps/web/src/features/chat/useMessages.ts`

- [ ] **Step 1: Add the helper inside the hook**

Inside `useMessages`, alongside the existing `sendMessage` function:

```ts
const sendMedia = useCallback(
  (
    type: 'image' | 'video' | 'audio',
    url: string,
    extra?: Record<string, unknown>,
  ) => {
    if (!userId) return
    zero.mutate.message.send({
      id: crypto.randomUUID(),
      chatId,
      senderId: userId,
      senderType: 'user',
      type,
      text: null,
      metadata: JSON.stringify({ originalContentUrl: url, ...(extra ?? {}) }),
      createdAt: Date.now(),
    })
  },
  [chatId, userId],
)
```

Add `sendMedia` to the returned object alongside `sendMessage`.

- [ ] **Step 2: Typecheck**

```bash
bun run --cwd apps/web typecheck
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/features/chat/useMessages.ts
git commit -m "feat(web): add sendMedia to useMessages"
```

---

### Task 11: Wire photo picker and hold-to-record in `MessageInput`

**Files:**
- Modify: `apps/web/src/features/chat/ui/MessageInput.tsx`

This is a **surgical** edit — preserve all existing icon components and the existing layout. Only the changes below are in scope.

- [ ] **Step 1: Update `Props`**

Add an optional `onSendMedia` prop:

```ts
type Props = {
  onSend: (text: string) => void
  onSendMedia?: (
    type: 'image' | 'video' | 'audio',
    url: string,
    extra?: Record<string, unknown>,
  ) => void
  disabled?: boolean
  hasRichMenu?: boolean
  onSwitchToRichMenu?: () => void
}
```

Destructure `onSendMedia` in the component signature.

- [ ] **Step 2: Add hooks and refs at the top of the component body**

After `const insets = useSafeAreaInsets()`:

```ts
const fileInputRef = useRef<HTMLInputElement | null>(null)
const { upload, status: uploadStatus } = useMediaUpload()
const {
  isRecording,
  elapsedMs,
  startRecording,
  stopRecording,
  cancelRecording,
} = useAudioRecorder()
const cancelOnReleaseRef = useRef(false)
```

Add the matching imports at the top of the file:

```ts
import { useRef, useCallback } from 'react'
import { isWeb } from 'tamagui'
import { useMediaUpload } from '../useMediaUpload'
import { useAudioRecorder } from '../useAudioRecorder'
import { showToast } from '~/interface/toast/Toast'
```

(Merge `useRef` / `useCallback` with the existing `react` import.)

`isWeb` from `tamagui` is the project-standard way to branch web vs native (see the tamagui skill's "Platform Detection" section). At native build time, `isWeb` is the literal `false`, so the bundler can dead-code-eliminate the `<input>` element and avoid the "unknown element <input>" RN warning.

- [ ] **Step 3: Add handlers**

```ts
const handlePhotoPress = useCallback(() => {
  if (!isWeb) {
    showToast('行動版即將支援照片', { type: 'info' })
    return
  }
  if (uploadStatus === 'uploading') return
  fileInputRef.current?.click()
}, [uploadStatus])

const handleFileSelected = useCallback(
  async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file || !onSendMedia) return
    const isVideo = file.type.startsWith('video/')
    const url = await upload(file)
    if (!url) {
      showToast('上傳失敗', { type: 'error' })
      return
    }
    onSendMedia(isVideo ? 'video' : 'image', url)
  },
  [onSendMedia, upload],
)

const handleMicPressIn = useCallback(async () => {
  if (!onSendMedia) return
  if (!isWeb) {
    showToast('行動版即將支援語音', { type: 'info' })
    return
  }
  cancelOnReleaseRef.current = false
  const ok = await startRecording()
  if (!ok) {
    showToast('無法錄音，請檢查麥克風權限', { type: 'error' })
  }
}, [onSendMedia, startRecording])

const handleMicPressOut = useCallback(async () => {
  if (!onSendMedia) return
  if (!isRecording) return
  if (cancelOnReleaseRef.current) {
    cancelRecording()
    return
  }
  const result = await stopRecording()
  if (!result) return
  if (result.durationMs < 500) return
  const ext = result.mimeType.includes('mp4') ? 'm4a' : 'webm'
  const file = new File([result.blob], `audio.${ext}`, { type: result.mimeType })
  const url = await upload(file)
  if (!url) {
    showToast('音訊上傳失敗', { type: 'error' })
    return
  }
  onSendMedia('audio', url, { duration: result.durationMs })
}, [onSendMedia, isRecording, stopRecording, cancelRecording, upload])

const handleMicCancel = useCallback(() => {
  if (!isRecording) return
  cancelOnReleaseRef.current = true
}, [isRecording])
```

The `cancelOnReleaseRef` flag is the "swipe up / drag away to cancel" affordance: pointer-leave or touch-cancel marks the next release as a cancel rather than a send. This works on both web (via `Pressable`'s touch responder events) and stays consistent with the spec's gesture description.

- [ ] **Step 4: Render the recording strip and rewire the photo + mic affordances**

Inside the existing `XStack` root, **prepend** the recording strip as a sibling — the `XStack` needs to become a `YStack` containing the strip plus the existing row. Restructure the JSX:

```tsx
return (
  <YStack
    bg="white"
    borderTopWidth={1}
    borderTopColor="$color4"
  >
    {isRecording && (
      <XStack
        items="center"
        justify="center"
        gap="$2"
        py="$2"
        bg="$red2"
      >
        <YStack
          width={8}
          height={8}
          rounded="$10"
          bg="$red10"
          opacity={0.85}
        />
        <SizableText fontSize={14} color="$red10">
          {formatRecordingTime(elapsedMs)}
        </SizableText>
        <SizableText fontSize={12} color="$red10">
          鬆開傳送
        </SizableText>
      </XStack>
    )}

    <XStack
      items="center"
      gap="$2"
      px="$3"
      pt="$2"
      pb={8 + insets.bottom}
    >
      {/* ... keep the existing + / RichMenu, Camera blocks unchanged ... */}

      {/* REPLACE the existing static Photo XStack with this Pressable: */}
      <Pressable onPress={handlePhotoPress} disabled={!onSendMedia || uploadStatus === 'uploading'}>
        <XStack style={{ flexShrink: 0 }} items="center" justify="center" opacity={uploadStatus === 'uploading' ? 0.5 : 1}>
          <PhotoIcon />
        </XStack>
      </Pressable>

      {/* Hidden file input — web only; isWeb is a build-time constant so the
          element gets dead-code-eliminated from the native bundle. */}
      {isWeb && (
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,video/*"
          style={{ display: 'none' }}
          onChange={handleFileSelected}
        />
      )}

      {/* ... keep the existing text input YStack unchanged ... */}

      {hasText ? (
        /* ... keep the existing Send Pressable unchanged ... */
      ) : (
        /* REPLACE the existing static Mic XStack with this Pressable: */
        <Pressable
          onPressIn={handleMicPressIn}
          onPressOut={handleMicPressOut}
          onTouchCancel={handleMicCancel}
          disabled={!onSendMedia}
        >
          <XStack
            width={36}
            height={36}
            items="center"
            justify="center"
            bg={isRecording ? '$red10' : 'transparent'}
            style={{ borderRadius: 999, flexShrink: 0 }}
          >
            <MicIcon />
          </XStack>
        </Pressable>
      )}
    </XStack>
  </YStack>
)
```

Add the `formatRecordingTime` helper near the bottom of the file (above `export const MessageInput`):

```ts
function formatRecordingTime(ms: number): string {
  const total = Math.floor(ms / 1000)
  const m = Math.floor(total / 60)
  const s = total % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}
```

Critical correctness notes (these are exactly the bugs the previous draft had — do not regress):
- Use **`onPress`** on `Pressable`, **never** `onClick`.
- Hold-to-record uses **`onPressIn` / `onPressOut`** — toggling on `onPress` would record-and-send-instantly.
- The `bg` prop must be a **prop**, not inside `style={{}}` — Tamagui tokens / shorthands don't apply through the RN style object.
- `width={36}` / `height={36}` are component props on `XStack`, not inside `style`.
- The `<input type="file">` element must be wrapped in `{isWeb && ...}` so the native bundle doesn't try to render an unknown intrinsic element. The `handlePhotoPress` and `handleMicPressIn` handlers also short-circuit on `!isWeb` and surface an info toast — defense in depth, since the photo / mic buttons themselves are reachable on native (the rest of the layout stays cross-platform).

- [ ] **Step 5: Typecheck and lint**

```bash
bun run --cwd apps/web typecheck
```

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/features/chat/ui/MessageInput.tsx
git commit -m "feat(web): wire photo picker and hold-to-record in MessageInput"
```

---

### Task 12: Pass `sendMedia` into `MessageInput` from the chat room

**Files:**
- Modify: `apps/web/app/(app)/home/(tabs)/talks/[chatId].tsx`

- [ ] **Step 1: Pull `sendMedia` from `useMessages` and forward it**

In the destructure of `useMessages(chatId!)`, add `sendMedia`:

```tsx
const {
  messages,
  isLoading,
  members,
  otherMember,
  sendMessage,
  sendMedia,
  markRead,
  myMembership,
} = useMessages(chatId!)
```

In the `<MessageInput .../>` JSX (the `inputMode === 'normal'` branch), add the new prop:

```tsx
<MessageInput
  onSend={sendMessage}
  onSendMedia={sendMedia}
  hasRichMenu={hasRichMenu}
  onSwitchToRichMenu={() => {
    setInputMode('richmenu')
    setRichMenuExpanded(false)
  }}
/>
```

- [ ] **Step 2: Typecheck**

```bash
bun run --cwd apps/web typecheck
```

- [ ] **Step 3: Commit**

```bash
git add 'apps/web/app/(app)/home/(tabs)/talks/[chatId].tsx'
git commit -m "feat(web): wire media sending into chat room"
```

---

### Task 13: Final verification

- [ ] **Step 1: Repo-wide checks**

```bash
bun run check:all
```

- [ ] **Step 2: Server tests**

```bash
bun run --cwd apps/server test:unit
```

- [ ] **Step 3: Manual smoke test, web (local Docker stack)**

Pre-conditions: `docker compose up -d` and `bun run dev` per the `vine-dev-stack` skill.

1. Open a chat in the web app while logged in.
2. Tap the photo icon → pick a JPEG → verify the bubble appears with the image and the lightbox opens on tap.
3. Tap the photo icon → pick a small MP4 → verify the placeholder bubble with play overlay appears, tap plays inline.
4. Press and hold the mic for ~2 seconds → release → verify an audio bubble appears and plays back.
5. Press and hold the mic, drag the cursor outside the button, release → verify nothing is sent and a recording is **not** stored.
6. Try to upload a >25 MB file via DevTools → expect a 413 surfaced as an error toast.
7. Sign out, manually `curl -X POST http://localhost:3001/api/v1/media/upload -F file=@x.jpg` → expect 401.

- [ ] **Step 4: Native build sanity (does not need a real device)**

Confirm the native bundle still builds and the stubs render placeholders. If you have a sim handy:

```bash
cd apps/web
bun run prebuild:native
bun run ios   # or: bun run android
```

Inside the running app, ask another web user (or use a seed script) to send you image/video/audio messages, and verify:
- An incoming **image** message renders normally on native (cross-platform `ImageBubble`).
- An incoming **video** message renders the "影片訊息（行動版即將推出）" placeholder, no crash.
- An incoming **audio** message renders the "語音 X:XX（行動版即將推出）" placeholder, no crash.
- Tapping the photo icon shows the "行動版即將支援照片" toast.
- Pressing the mic shows the "行動版即將支援語音" toast (no permission prompt, no crash).

If you don't have a sim available, `bun run --cwd apps/web typecheck` plus a code review confirming `isWeb` gates and `.native.tsx` stubs are in place is acceptable for the v1 PR — the full native walkthrough can happen as part of the Phase 1 native PR.

- [ ] **Step 5: Commit any final fixups**

If `bun run check:all` made formatting changes, stage them with a `chore: format` commit.
