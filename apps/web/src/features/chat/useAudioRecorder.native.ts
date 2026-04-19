import { useCallback, useEffect, useRef, useState } from 'react'
import {
  AudioModule,
  RecordingPresets,
  setAudioModeAsync,
  useAudioRecorder as useExpoAudioRecorder,
} from 'expo-audio'

const PRESET = RecordingPresets.HIGH_QUALITY

type StopResult = {
  blob: Blob
  mimeType: string
  durationMs: number
  uri: string
}

type UseAudioRecorderReturn = {
  isRecording: boolean
  elapsedMs: number
  startRecording: () => Promise<boolean>
  stopRecording: () => Promise<StopResult | null>
  cancelRecording: () => Promise<void>
}

export function useAudioRecorder(): UseAudioRecorderReturn {
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
        // Restore default mode so a later useAudioPlayer (AudioBubble) doesn't
        // route through the iOS receiver earpiece if the user navigates away
        // mid-recording.
        setAudioModeAsync({
          allowsRecording: false,
          playsInSilentMode: true,
          interruptionMode: 'mixWithOthers',
        }).catch(() => {})
      }
    }
  }, [recorder, stopTimer])

  const startRecording = useCallback(async (): Promise<boolean> => {
    try {
      const perm = await AudioModule.requestRecordingPermissionsAsync()
      if (!perm.granted) return false

      // iOS audio-session dance: route through the playback-and-record category
      // so recording works even when the device is in silent mode, and audio
      // routes to the speaker rather than the earpiece.
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

  const stopRecording = useCallback(async (): Promise<StopResult | null> => {
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

    // Restore default audio mode so subsequent useAudioPlayer (AudioBubble)
    // plays through the speaker, not the receiver earpiece.
    await setAudioModeAsync({
      allowsRecording: false,
      playsInSilentMode: true,
      interruptionMode: 'mixWithOthers',
    }).catch(() => {})

    // Match the web hook's return shape so MessageInput's handler is identical.
    // The fake `Blob` is only for type conformance — the native upload path
    // uses { uri, name, type } in MessageInput, not the blob field.
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
