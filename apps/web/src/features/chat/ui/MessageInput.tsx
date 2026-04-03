import { memo, useState } from 'react'
import { XStack } from 'tamagui'

import { Button } from '~/interface/buttons/Button'
import { Input } from '~/interface/forms/Input'

type Props = {
  onSend: (text: string) => void
  disabled?: boolean
}

export const MessageInput = memo(({ onSend, disabled }: Props) => {
  const [text, setText] = useState('')

  const handleSend = () => {
    const trimmed = text.trim()
    if (!trimmed) return
    onSend(trimmed)
    setText('')
  }

  return (
    <XStack
      px="$3"
      py="$2"
      gap="$2"
      items="center"
      borderTopWidth={1}
      borderTopColor="$color4"
      bg="$background"
    >
      <Input
        flex={1}
        placeholder="傳送訊息"
        value={text}
        onChangeText={setText}
        onSubmitEditing={handleSend}
        returnKeyType="send"
        multiline={false}
      />
      <Button
        onPress={handleSend}
        disabled={disabled || !text.trim()}
        theme="green"
        px="$4"
      >
        傳送
      </Button>
    </XStack>
  )
})
