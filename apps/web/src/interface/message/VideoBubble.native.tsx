import { memo } from 'react'
import { SizableText, XStack } from 'tamagui'
import Svg, { Circle, Path } from 'react-native-svg'

type Props = {
  url: string
  isMine: boolean
}

export const VideoBubble = memo(({ isMine }: Props) => {
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
        <Circle cx={12} cy={12} r={11} fill="rgba(0,0,0,0.15)" />
        <Path d="M10 8l6 4-6 4V8z" fill={isMine ? 'white' : '#666'} />
      </Svg>
      <SizableText fontSize={13} color={isMine ? 'white' : '$color10'}>
        影片訊息（行動版即將推出）
      </SizableText>
    </XStack>
  )
})
