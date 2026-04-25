import { memo, useCallback, useRef, useState } from 'react'
import type { ChangeEvent } from 'react'
import { Pressable } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import Svg, { Path } from 'react-native-svg'
import { XStack, YStack, SizableText, isWeb } from 'tamagui'

import { Input } from '~/interface/forms/Input'
import { showToast } from '~/interface/toast/Toast'
import { StickerPicker } from '~/features/sticker-market/StickerPicker'

import { useAudioRecorder } from '../useAudioRecorder'
import { useImagePicker } from '../useImagePicker'
import { useMediaUpload } from '../useMediaUpload'

type Props = {
  onSend: (text: string) => void
  onSendMedia?: (
    type: 'image' | 'video' | 'audio',
    url: string,
    extra?: Record<string, unknown>,
  ) => void
  onSendSticker?: (packageId: string, stickerId: number) => void
  disabled?: boolean
  hasRichMenu?: boolean
  onSwitchToRichMenu?: () => void
}

function CameraIcon() {
  return (
    <Svg
      width={22}
      height={22}
      viewBox="0 0 24 24"
      fill="none"
      stroke="#666"
      strokeWidth={1.5}
    >
      <Path
        d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0z"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  )
}

function PhotoIcon() {
  return (
    <Svg
      width={22}
      height={22}
      viewBox="0 0 24 24"
      fill="none"
      stroke="#666"
      strokeWidth={1.5}
    >
      <Path
        d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  )
}

function EmojiIcon() {
  return (
    <Svg
      width={18}
      height={18}
      viewBox="0 0 24 24"
      fill="none"
      stroke="#aaa"
      strokeWidth={1.5}
    >
      <Path
        d="M15.182 15.182a4.5 4.5 0 01-6.364 0M21 12a9 9 0 11-18 0 9 9 0 0118 0zM9.75 9.75c0 .414-.168.75-.375.75S9 10.164 9 9.75 9.168 9 9.375 9s.375.336.375.75zm5.625 0c0 .414-.168.75-.375.75s-.375-.336-.375-.75.168-.75.375-.75.375.336.375.75z"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  )
}

function StickerIcon({ active }: { active: boolean }) {
  return (
    <Svg
      width={22}
      height={22}
      viewBox="0 0 24 24"
      fill={active ? '#8be872' : 'none'}
      stroke={active ? '#8be872' : '#666'}
      strokeWidth={1.5}
    >
      <Path
        d="M12 2C6.477 2 2 6.477 2 12s4.477 10 10 10 10-4.477 10-10S17.523 2 12 2zm4 11c0 2.21-1.79 4-4 4s-4-1.79-4-4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M15.5 8.5a.5.5 0 110-1 .5.5 0 010 1zm-7 0a.5.5 0 110-1 .5.5 0 010 1z"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  )
}

function MicIcon() {
  return (
    <Svg
      width={22}
      height={22}
      viewBox="0 0 24 24"
      fill="none"
      stroke="#666"
      strokeWidth={1.5}
    >
      <Path
        d="M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 01-3-3V4.5a3 3 0 116 0v8.25a3 3 0 01-3 3z"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  )
}

function SendArrowIcon() {
  return (
    <Svg
      width={18}
      height={18}
      viewBox="0 0 24 24"
      fill="none"
      stroke="white"
      strokeWidth={2}
    >
      <Path
        d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  )
}

function formatRecordingTime(ms: number): string {
  const total = Math.floor(ms / 1000)
  const m = Math.floor(total / 60)
  const s = total % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}

export const MessageInput = memo(
  ({
    onSend,
    onSendMedia,
    onSendSticker,
    disabled,
    hasRichMenu,
    onSwitchToRichMenu,
  }: Props) => {
    const [text, setText] = useState('')
    const [showStickers, setShowStickers] = useState(false)
    const insets = useSafeAreaInsets()
    const fileInputRef = useRef<HTMLInputElement | null>(null)
    const { upload, status: uploadStatus } = useMediaUpload()
    const { pick } = useImagePicker()
    const { isRecording, elapsedMs, startRecording, stopRecording, cancelRecording } =
      useAudioRecorder()
    const cancelOnReleaseRef = useRef(false)

    const handleSend = () => {
      const trimmed = text.trim()
      if (!trimmed) return
      onSend(trimmed)
      setText('')
    }

    const hasText = text.trim().length > 0

    const handlePhotoPress = useCallback(async () => {
      if (uploadStatus === 'uploading') return
      if (isWeb) {
        fileInputRef.current?.click()
        return
      }
      const picked = await pick()
      if (!picked || !onSendMedia) return
      // Native upload accepts { uri, name, type }; web hook's TS signature
      // expects File|Blob, but this branch is unreachable on web (isWeb early-return).
      const result = await upload({
        uri: picked.uri,
        name: picked.name,
        type: picked.type,
      } as never)
      if ('error' in result) {
        showToast(result.error, { type: 'error' })
        return
      }
      onSendMedia(picked.kind, result.url)
    }, [uploadStatus, pick, upload, onSendMedia])

    const handleFileSelected = useCallback(
      async (e: ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        e.target.value = ''
        if (!file || !onSendMedia) return
        const isVideo = file.type.startsWith('video/')
        const result = await upload(file)
        if ('error' in result) {
          showToast(result.error, { type: 'error' })
          return
        }
        onSendMedia(isVideo ? 'video' : 'image', result.url)
      },
      [onSendMedia, upload],
    )

    const handleMicPressIn = useCallback(async () => {
      if (!onSendMedia) return
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
      let uploadResult
      if (isWeb) {
        const ext = result.mimeType.includes('mp4') ? 'm4a' : 'webm'
        const file = new File([result.blob], `audio.${ext}`, { type: result.mimeType })
        uploadResult = await upload(file)
      } else {
        // Native: result.uri is the file:// path written by expo-audio.
        // Web hook's TS signature expects File|Blob, but this branch is
        // unreachable on web (isWeb === true) — same convention as handlePhotoPress.
        uploadResult = await upload({
          uri: (result as { uri?: string }).uri ?? '',
          name: 'audio.m4a',
          type: 'audio/m4a',
        } as never)
      }
      if ('error' in uploadResult) {
        showToast(uploadResult.error, { type: 'error' })
        return
      }
      onSendMedia('audio', uploadResult.url, { duration: result.durationMs })
    }, [onSendMedia, isRecording, stopRecording, cancelRecording, upload])

    const handleMicCancel = useCallback(() => {
      if (!isRecording) return
      cancelOnReleaseRef.current = true
    }, [isRecording])

    const handleStickerSelect = useCallback(
      (packageId: string, stickerId: number) => {
        setShowStickers(false)
        onSendSticker?.(packageId, stickerId)
      },
      [onSendSticker],
    )

    return (
      <YStack bg="white" borderTopWidth={1} borderTopColor="$color4">
        {showStickers && onSendSticker && (
          <StickerPicker onSelect={handleStickerSelect} />
        )}

        {isRecording && (
          <XStack items="center" justify="center" gap="$2" py="$2" bg="$red2">
            <YStack width={8} height={8} rounded="$10" bg="$red10" opacity={0.85} />
            <SizableText fontSize={14} color="$red10">
              {formatRecordingTime(elapsedMs)}
            </SizableText>
            <SizableText fontSize={12} color="$red10">
              鬆開傳送
            </SizableText>
          </XStack>
        )}

        <XStack items="center" gap="$2" px="$3" pt="$2" pb={8 + insets.bottom}>
          {/* + button or Rich Menu toggle */}
          {hasRichMenu && onSwitchToRichMenu ? (
            <Pressable onPress={onSwitchToRichMenu}>
              <XStack
                style={{ width: 30, height: 30, borderRadius: 999, flexShrink: 0 }}
                bg="$gray3"
                items="center"
                justify="center"
              >
                <SizableText fontSize={14}>📋</SizableText>
              </XStack>
            </Pressable>
          ) : (
            <XStack
              style={{ width: 30, height: 30, borderRadius: 999, flexShrink: 0 }}
              bg="$gray3"
              items="center"
              justify="center"
            >
              <Svg
                width={18}
                height={18}
                viewBox="0 0 24 24"
                fill="none"
                stroke="#555"
                strokeWidth={2}
              >
                <Path
                  d="M12 4.5v15m7.5-7.5h-15"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </Svg>
            </XStack>
          )}

          {/* Camera */}
          <XStack style={{ flexShrink: 0 }} items="center" justify="center">
            <CameraIcon />
          </XStack>

          {/* Photo */}
          <Pressable
            onPress={handlePhotoPress}
            disabled={!onSendMedia || uploadStatus === 'uploading'}
          >
            <XStack
              style={{ flexShrink: 0 }}
              items="center"
              justify="center"
              opacity={uploadStatus === 'uploading' ? 0.5 : 1}
            >
              <PhotoIcon />
            </XStack>
          </Pressable>

          {onSendSticker && (
            <Pressable onPress={() => setShowStickers((v) => !v)}>
              <XStack style={{ flexShrink: 0 }} items="center" justify="center">
                <StickerIcon active={showStickers} />
              </XStack>
            </Pressable>
          )}

          {isWeb && (
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,video/*"
              style={{ display: 'none' }}
              onChange={handleFileSelected}
            />
          )}

          {/* Text input with emoji icon */}
          <YStack flex={1} position="relative">
            <Input
              bg="$gray3"
              borderWidth={0}
              px="$3"
              pr="$8"
              py="$2"
              style={{
                borderRadius: 20,
              }}
              placeholder="Aa"
              value={text}
              onChangeText={setText}
              onSubmitEditing={handleSend}
              returnKeyType="send"
              multiline={false}
            />
            <XStack
              position="absolute"
              style={{ right: 10, top: 0, bottom: 0 }}
              items="center"
              justify="center"
              pointerEvents="none"
            >
              <EmojiIcon />
            </XStack>
          </YStack>

          {/* Mic or Send */}
          {hasText ? (
            <Pressable onPress={handleSend} disabled={disabled}>
              <XStack
                style={{ width: 36, height: 36, borderRadius: 999, flexShrink: 0 }}
                bg="#8be872"
                items="center"
                justify="center"
              >
                <SendArrowIcon />
              </XStack>
            </Pressable>
          ) : (
            <Pressable
              onPressIn={handleMicPressIn}
              onPressOut={handleMicPressOut}
              onTouchCancel={handleMicCancel}
              onHoverOut={handleMicCancel}
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
  },
)
