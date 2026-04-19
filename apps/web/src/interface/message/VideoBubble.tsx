import { memo, useState } from 'react'
import { Pressable } from 'react-native'
import { YStack } from 'tamagui'
import Svg, { Circle, Path } from 'react-native-svg'

type Props = {
  url: string
  isMine: boolean
}

export const VideoBubble = memo(({ url }: Props) => {
  const [playing, setPlaying] = useState(false)

  if (playing) {
    return (
      <YStack maxW={300} style={{ borderRadius: 18, overflow: 'hidden' }}>
        <video
          src={url}
          controls
          autoPlay
          style={{ width: 300, maxHeight: 400, display: 'block' }}
          onEnded={() => setPlaying(false)}
        />
      </YStack>
    )
  }

  return (
    <Pressable onPress={() => setPlaying(true)}>
      <YStack
        position="relative"
        maxW={300}
        bg="$color3"
        style={{ borderRadius: 18, overflow: 'hidden' }}
      >
        <YStack width={300} height={200} bg="$color3" />
        <YStack
          position="absolute"
          t={0}
          l={0}
          r={0}
          b={0}
          items="center"
          justify="center"
          bg="rgba(0,0,0,0.3)"
        >
          <Svg width={48} height={48} viewBox="0 0 48 48">
            <Circle cx={24} cy={24} r={24} fill="rgba(0,0,0,0.6)" />
            <Path d="M19 16l14 8-14 8V16z" fill="white" />
          </Svg>
        </YStack>
      </YStack>
    </Pressable>
  )
})
