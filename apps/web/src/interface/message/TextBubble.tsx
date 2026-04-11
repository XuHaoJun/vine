import { memo } from 'react'
import { SizableText, YStack } from 'tamagui'

type TextBubbleProps = {
  text: string
  isMine: boolean
}

export const TextBubble = memo(({ text, isMine }: TextBubbleProps) => {
  return (
    <YStack
      bg={isMine ? '#8be872' : 'white'}
      px="$3"
      py="$2"
      maxW="100%"
      style={{
        borderRadius: 18,
        borderBottomRightRadius: isMine ? 4 : undefined,
        borderTopLeftRadius: isMine ? undefined : 4,
      }}
    >
      <SizableText fontSize={15} color={isMine ? '#000' : '$gray8'} lineHeight={22}>
        {text}
      </SizableText>
    </YStack>
  )
})
