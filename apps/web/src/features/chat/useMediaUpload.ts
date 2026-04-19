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
