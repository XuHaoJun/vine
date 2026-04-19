import { useCallback, useState } from 'react'

declare const __DEV__: boolean

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
    async (): Promise<{ blob: Blob; mimeType: string; durationMs: number } | null> =>
      null,
    [],
  )
  const cancelRecording = useCallback(() => {}, [])
  return { isRecording, elapsedMs, startRecording, stopRecording, cancelRecording }
}
