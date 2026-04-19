import { useCallback, useEffect, useRef, useState } from 'react'

type UploadStatus = 'idle' | 'uploading' | 'done' | 'error'

export type NativeFileInput = {
  uri: string
  name: string
  type: string
}

export type UploadResult = { url: string } | { error: string }

type UseMediaUploadReturn = {
  url: string | null
  progress: number
  status: UploadStatus
  error: string | null
  upload: (file: NativeFileInput) => Promise<UploadResult>
  abort: () => void
  reset: () => void
}

const API_URL = process.env['VITE_API_URL'] ?? ''

function parseServerError(responseText: string, status: number): string {
  try {
    const data = JSON.parse(responseText) as { message?: string }
    if (typeof data.message === 'string' && data.message.length > 0) {
      return `${data.message} (${status})`
    }
  } catch {
    // fall through
  }
  return `Upload failed (${status})`
}

export function useMediaUpload(): UseMediaUploadReturn {
  const [url, setUrl] = useState<string | null>(null)
  const [progress, setProgress] = useState(0)
  const [status, setStatus] = useState<UploadStatus>('idle')
  const [error, setError] = useState<string | null>(null)
  const controllerRef = useRef<AbortController | null>(null)

  useEffect(() => {
    return () => controllerRef.current?.abort()
  }, [])

  const upload = useCallback(async (file: NativeFileInput): Promise<UploadResult> => {
    setStatus('uploading')
    setProgress(0)
    setError(null)

    const form = new FormData()
    // RN's FormData accepts the file-info-object form. The `as any` is the
    // standard idiom because TS types FormData against the web spec.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
      if (!res.ok) {
        const text = await res.text().catch(() => '')
        throw new Error(parseServerError(text, res.status))
      }
      const data = (await res.json()) as { url?: string }
      if (!data.url) throw new Error('Malformed upload response')
      setUrl(data.url)
      setStatus('done')
      // Native fetch doesn't expose upload progress without a third-party lib;
      // we keep a 0 -> 1 transition only. Real progress would require
      // react-native-blob-util or expo-file-system uploadAsync.
      setProgress(1)
      controllerRef.current = null
      return { url: data.url }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Upload failed'
      setError(message)
      setStatus('error')
      controllerRef.current = null
      return { error: message }
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
