import { memo } from 'react'
import { SizableText, XStack } from 'tamagui'
import Svg, { Path } from 'react-native-svg'

type Props = {
  url: string
  duration?: number
  isMine: boolean
}

function formatDuration(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000))
  const m = Math.floor(total / 60)
  const s = total % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}

export const AudioBubble = memo(({ duration, isMine }: Props) => {
  const fg = isMine ? 'white' : '#666'
  return (
    <XStack
      items="center"
      gap="$2"
      px="$3"
      py="$2"
      minW={180}
      bg={isMine ? '#8be872' : 'white'}
      style={{ borderRadius: 18 }}
    >
      <Svg width={20} height={20} viewBox="0 0 24 24">
        <Path d="M8 5v14l11-7L8 5z" fill={fg} />
      </Svg>
      <SizableText fontSize={13} color={fg}>
        {duration ? `語音 ${formatDuration(duration)}` : '語音訊息'}
      </SizableText>
      <SizableText fontSize={11} color={isMine ? 'rgba(255,255,255,0.7)' : '$color10'}>
        （行動版即將推出）
      </SizableText>
    </XStack>
  )
})
