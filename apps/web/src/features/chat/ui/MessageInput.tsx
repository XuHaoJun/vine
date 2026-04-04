import { memo, useState } from 'react'
import { Pressable } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import Svg, { Path } from 'react-native-svg'
import { XStack, YStack } from 'tamagui'

import { Input } from '~/interface/forms/Input'

type Props = {
  onSend: (text: string) => void
  disabled?: boolean
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

export const MessageInput = memo(({ onSend, disabled }: Props) => {
  const [text, setText] = useState('')
  const insets = useSafeAreaInsets()

  const handleSend = () => {
    const trimmed = text.trim()
    if (!trimmed) return
    onSend(trimmed)
    setText('')
  }

  const hasText = text.trim().length > 0

  return (
    <XStack
      items="center"
      gap="$2"
      bg="white"
      px="$3"
      pt="$2"
      pb={8 + insets.bottom}
      borderTopWidth={1}
      borderTopColor="$color4"
    >
      {/* + button */}
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
          <Path d="M12 4.5v15m7.5-7.5h-15" strokeLinecap="round" strokeLinejoin="round" />
        </Svg>
      </XStack>

      {/* Camera */}
      <XStack style={{ flexShrink: 0 }} items="center" justify="center">
        <CameraIcon />
      </XStack>

      {/* Photo */}
      <XStack style={{ flexShrink: 0 }} items="center" justify="center">
        <PhotoIcon />
      </XStack>

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
        <XStack style={{ flexShrink: 0 }} items="center" justify="center">
          <MicIcon />
        </XStack>
      )}
    </XStack>
  )
})
