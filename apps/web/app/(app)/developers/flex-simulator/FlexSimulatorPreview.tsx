import { Text, YStack } from 'tamagui'
import { LfBubble, LfCarousel } from '@vine/line-flex'
import type { LFexCarousel, LFexBubble } from '@vine/line-flex'

interface FlexSimulatorPreviewProps {
  json: string
}

export function FlexSimulatorPreview({ json }: FlexSimulatorPreviewProps) {
  let contents: LFexBubble | LFexCarousel | null = null
  let error: string | null = null

  try {
    const parsed = JSON.parse(json)
    if (parsed.type === 'flex') {
      contents = parsed.contents
    } else {
      error = 'Invalid flex message: root type must be "flex"'
    }
  } catch (e) {
    error = `JSON parse error: ${e instanceof Error ? e.message : 'Unknown error'}`
  }

  if (error) {
    return (
      <YStack flex={1} p="$4" items="center" justify="center">
        <Text color="$red10" fontSize="$3">
          {error}
        </Text>
      </YStack>
    )
  }

  if (!contents) {
    return (
      <YStack flex={1} p="$4" items="center" justify="center">
        <Text color="$color10">No message to preview</Text>
      </YStack>
    )
  }

  if (contents.type === 'carousel') {
    return (
      <YStack flex={1} overflow="hidden" bg="$color2" p="$4">
        <LfCarousel {...contents} />
      </YStack>
    )
  }

  return (
    <YStack flex={1} overflow="hidden" bg="$color2" p="$4">
      <LfBubble {...contents} />
    </YStack>
  )
}