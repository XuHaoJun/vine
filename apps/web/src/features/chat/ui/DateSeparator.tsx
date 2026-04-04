import { SizableText, XStack } from 'tamagui'

type Props = {
  label: string
}

export function DateSeparator({ label }: Props) {
  return (
    <XStack justify="center" my="$2">
      <XStack bg="rgba(0,0,0,0.18)" px="$3" py={3} rounded={99}>
        <SizableText fontSize={11} color="white">
          {label}
        </SizableText>
      </XStack>
    </XStack>
  )
}
