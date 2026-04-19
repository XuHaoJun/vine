import { useVideoPlayer, VideoView } from 'expo-video'
import { memo, useState } from 'react'
import { Pressable } from 'react-native'
import Svg, { Circle, Path } from 'react-native-svg'
import { YStack } from 'tamagui'

type Props = {
  url: string
  isMine: boolean
}

export const VideoBubble = memo(({ url }: Props) => {
  const [playing, setPlaying] = useState(false)
  const player = useVideoPlayer(url, (p) => {
    p.loop = false
  })

  if (playing) {
    return (
      <YStack maxW={300} style={{ borderRadius: 18, overflow: 'hidden' }}>
        <VideoView
          player={player}
          style={{ width: 300, height: 200 }}
          nativeControls
          contentFit="contain"
        />
      </YStack>
    )
  }

  return (
    <Pressable
      onPress={() => {
        setPlaying(true)
        player.play()
      }}
    >
      <YStack maxW={300} bg="$color3" style={{ borderRadius: 18, overflow: 'hidden' }}>
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
