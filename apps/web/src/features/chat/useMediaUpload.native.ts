import { useCallback, useState } from 'react'

declare const __DEV__: boolean

type UploadStatus = 'idle' | 'uploading' | 'done' | 'error'

export type UploadResult = { url: string } | { error: string }

export function useMediaUpload() {
  const [status] = useState<UploadStatus>('idle')
  const upload = useCallback(async (): Promise<UploadResult> => {
    if (__DEV__) {
      console.warn('[useMediaUpload] media upload is not yet implemented on native')
    }
    return { error: 'Media upload is not yet implemented on native' }
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
