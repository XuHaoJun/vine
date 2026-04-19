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
